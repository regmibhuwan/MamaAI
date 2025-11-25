# MamaAI - AI Cooking Companion 🍳

MamaAI is an intelligent cooking assistant that watches you cook in real-time through your phone camera and guides you step-by-step—just like having your mom on a video call.

## Features

- **👀 Real-Time Visual Guidance**: The AI watches your pot/pan via the camera and tells you when to flip, stir, or lower the heat.
- **🗣️ Natural Conversation**: Ask questions like "Is this done?" or "What's next?" and get instant voice answers.
- **🥗 Ingredient Recognition**: Snap a photo of your fridge, and MamaAI will suggest recipes.
- **⏱️ Smart Timing**: No manual timers needed; the AI tracks cooking time for you.

## Tech Stack

- **Frontend**: React (Vite), Tailwind CSS
- **AI**: Google Gemini 2.0 Multimodal Live API (`@google/genai`)
- **Video/Audio**: WebRTC, Web Audio API

## Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/yourusername/mama-ai-cooking.git
   cd mama-ai-cooking
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set API Key**
   Create a `.env` file in the root:
   ```env
   API_KEY=your_gemini_api_key_here
   ```

4. **Run locally**
   ```bash
   npm run dev
   ```

## Deployment (Vercel)

1. Import this repository into Vercel.
2. Add your `API_KEY` in Vercel Project Settings > Environment Variables.
3. Deploy!
