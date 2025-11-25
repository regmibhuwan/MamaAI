import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";

// Audio/Video Constants
const AUDIO_INPUT_SAMPLE_RATE = 16000;
const AUDIO_OUTPUT_SAMPLE_RATE = 24000;
const VIDEO_FPS = 1; // Reduced to 1 FPS for better stability
const JPEG_QUALITY = 0.4; // Slightly compressed for faster transmission

export class LiveClient {
  private ai: GoogleGenAI;
  private session: any = null; // Holds the active session promise
  private inputAudioContext: AudioContext | null = null;
  private outputAudioContext: AudioContext | null = null;
  private inputSource: MediaStreamAudioSourceNode | null = null;
  private processor: ScriptProcessorNode | null = null;
  private outputNode: GainNode | null = null;
  private nextStartTime: number = 0;
  private videoInterval: number | null = null;
  private stream: MediaStream | null = null;
  
  // Callbacks
  public onStatusChange: (status: string) => void = () => {};
  public onAudioLevel: (level: number) => void = () => {};

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  async connect(recipeContext: string) {
    this.onStatusChange("CONNECTING");

    try {
      // 1. Setup Audio Contexts
      // We must create these before getUserMedia to ensure we can resume them
      this.inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_INPUT_SAMPLE_RATE,
      });
      this.outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: AUDIO_OUTPUT_SAMPLE_RATE,
      });
      this.outputNode = this.outputAudioContext.createGain();
      this.outputNode.connect(this.outputAudioContext.destination);

      // CRITICAL: Resume contexts immediately. Browsers often suspend them until gesture, 
      // but we are usually in a click handler here.
      await this.inputAudioContext.resume();
      await this.outputAudioContext.resume();

      // 2. Get Media Stream (Mic & Camera)
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: AUDIO_INPUT_SAMPLE_RATE,
        },
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "environment", // Rear camera preferred for cooking
        },
      });

      // 3. Connect to Gemini Live
      const config = {
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
          },
          systemInstruction: `
            You are "Mama AI", a warm, encouraging, and observant cooking assistant.
            You are watching the user cook in real-time via their camera.
            
            Current Recipe Context: ${recipeContext}

            Your Role:
            1. Guide the user step-by-step through the recipe.
            2. Visually monitor the food. Warn immediately if something looks like it's burning, smoking, or unsafe.
            3. Answer questions naturally like "Is this done?" by looking at the video frame.
            4. Keep track of time verbally (e.g., "I'll count 2 minutes for you").
            5. Be concise. The user is busy. Keep the tone friendly and supportive.
          `,
        },
      };

      const sessionPromise = this.ai.live.connect({
        ...config,
        callbacks: {
          onopen: () => {
            this.onStatusChange("CONNECTED");
            this.startAudioInput(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            await this.handleServerMessage(message);
          },
          onclose: () => {
            console.log("Session closed by server");
            this.onStatusChange("DISCONNECTED");
            this.cleanupResources();
          },
          onerror: (err) => {
            console.error("Live API Error:", err);
            this.onStatusChange("ERROR");
            this.cleanupResources();
          },
        },
      });

      this.session = sessionPromise;
      
    } catch (error) {
      console.error("Connection failed:", error);
      this.onStatusChange("ERROR");
      this.cleanupResources();
    }
  }

  startVideoLoop(videoElement: HTMLVideoElement) {
    if (!this.stream) return;

    // Ensure video element is playing the stream
    videoElement.srcObject = this.stream;
    videoElement.play().catch(e => console.error("Video play error", e));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    // Clear any existing interval
    if (this.videoInterval) clearInterval(this.videoInterval);

    this.videoInterval = window.setInterval(() => {
        if (!ctx || !videoElement.videoWidth || !this.session) return;

        canvas.width = videoElement.videoWidth;
        canvas.height = videoElement.videoHeight;
        ctx.drawImage(videoElement, 0, 0);

        const base64Data = canvas.toDataURL("image/jpeg", JPEG_QUALITY).split(",")[1];

        // Send frame if session is ready
        this.session.then((s: any) => {
             s.sendRealtimeInput({
                media: {
                    mimeType: "image/jpeg",
                    data: base64Data
                }
            });
        }).catch(() => {
            // Ignore send errors if session is closed
        });

    }, 1000 / VIDEO_FPS);
  }

  private startAudioInput(sessionPromise: Promise<any>) {
    if (!this.inputAudioContext || !this.stream) return;

    this.inputSource = this.inputAudioContext.createMediaStreamSource(this.stream);
    this.processor = this.inputAudioContext.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0);
      
      // Calculate volume for UI visualization
      let sum = 0;
      for (let i = 0; i < inputData.length; i++) {
        sum += inputData[i] * inputData[i];
      }
      this.onAudioLevel(Math.sqrt(sum / inputData.length));

      // Create blob and send
      const pcm16 = this.floatTo16BitPCM(inputData);
      const base64 = this.arrayBufferToBase64(pcm16.buffer);

      sessionPromise.then((session) => {
        session.sendRealtimeInput({
          media: {
            mimeType: "audio/pcm;rate=" + AUDIO_INPUT_SAMPLE_RATE,
            data: base64,
          },
        });
      }).catch(() => {});
    };

    this.inputSource.connect(this.processor);
    this.processor.connect(this.inputAudioContext.destination);
  }

  private async handleServerMessage(message: LiveServerMessage) {
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    
    if (audioData && this.outputAudioContext && this.outputNode) {
        // Handle interruptions
        if (message.serverContent?.interrupted) {
             this.nextStartTime = this.outputAudioContext.currentTime;
             return;
        }

        try {
            const audioBuffer = await this.decodeAudioData(
                this.base64ToArrayBuffer(audioData),
                this.outputAudioContext
            );
            
            const source = this.outputAudioContext.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(this.outputNode);
            
            // Schedule playback
            const currentTime = this.outputAudioContext.currentTime;
            const startTime = Math.max(currentTime, this.nextStartTime);
            
            source.start(startTime);
            this.nextStartTime = startTime + audioBuffer.duration;
        } catch (e) {
            console.error("Audio decode error", e);
        }
    }
  }

  disconnect() {
    if (this.session) {
      this.session.then((s: any) => s.close());
      this.session = null;
    }
    this.cleanupResources();
    this.onStatusChange("DISCONNECTED");
  }

  private cleanupResources() {
    if (this.videoInterval) clearInterval(this.videoInterval);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    if (this.inputAudioContext) this.inputAudioContext.close();
    if (this.outputAudioContext) this.outputAudioContext.close();
    
    this.videoInterval = null;
    this.stream = null;
    this.inputAudioContext = null;
    this.outputAudioContext = null;
  }

  // --- Helpers ---

  private floatTo16BitPCM(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      let s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return int16Array;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async decodeAudioData(data: ArrayBuffer, ctx: AudioContext): Promise<AudioBuffer> {
     // Raw PCM decoding for 24kHz
     const dataInt16 = new Int16Array(data);
     const buffer = ctx.createBuffer(1, dataInt16.length, AUDIO_OUTPUT_SAMPLE_RATE);
     const channelData = buffer.getChannelData(0);
     for(let i=0; i<dataInt16.length; i++) {
         channelData[i] = dataInt16[i] / 32768.0;
     }
     return buffer;
  }
}