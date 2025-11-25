import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChefHat, Camera, Mic, Volume2, ArrowLeft, Clock, AlertCircle, Sparkles, Utensils, Play, X, Loader2, RefreshCw, QrCode, Copy, Check, Share2, Edit2 } from 'lucide-react';
import { suggestRecipes } from './services/geminiService';
import { LiveClient } from './services/liveClient';
import { AppScreen, Ingredient, Recipe, LiveStatus } from './types';

export default function App() {
  // State
  const [screen, setScreen] = useState<AppScreen>(AppScreen.HOME);
  const [ingredientsText, setIngredientsText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [liveStatus, setLiveStatus] = useState<string>(LiveStatus.DISCONNECTED);
  const [audioLevel, setAudioLevel] = useState(0);
  const [showQR, setShowQR] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('');
  const [editableUrl, setEditableUrl] = useState('');
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [copied, setCopied] = useState(false);

  // Live Client Ref
  const liveClientRef = useRef<LiveClient | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        const url = window.location.href;
        // Clean up internal sandbox URLs for display if possible, otherwise keep as is
        setCurrentUrl(url);
        setEditableUrl(url);
    }
  }, []);

  // --- Handlers ---

  const handlePlanRecipe = async () => {
    if (!ingredientsText && !selectedImage) return;
    setIsLoading(true);
    try {
      const results = await suggestRecipes(ingredientsText, selectedImage?.split(',')[1]);
      setRecipes(results);
      setScreen(AppScreen.RECIPE_SELECTION);
    } catch (e) {
      alert("Failed to plan recipe. Try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const startLiveCooking = async () => {
    if (!selectedRecipe) return;
    setScreen(AppScreen.LIVE_COOKING);
    
    // Initialize Live Client
    const client = new LiveClient();
    liveClientRef.current = client;

    // Hook up UI callbacks
    client.onStatusChange = (status) => setLiveStatus(status);
    client.onAudioLevel = (level) => setAudioLevel(Math.min(level * 5, 1)); // Amplify for visuals

    // Connect
    const recipeContext = `
      Recipe: ${selectedRecipe.title}.
      Ingredients: ${selectedRecipe.ingredients.join(', ')}.
      Steps: ${selectedRecipe.steps.join(' -> ')}.
    `;
    await client.connect(recipeContext);
  };

  // Re-connect handler for when session drops
  const handleReconnect = async () => {
      // Disconnect existing if any
      liveClientRef.current?.disconnect();
      await startLiveCooking();
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(editableUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'MamaAI Cooking Companion',
                text: 'Check out this AI cooking assistant!',
                url: editableUrl
            });
        } catch (err) {
            console.error('Share failed:', err);
        }
    } else {
        handleCopyUrl();
    }
  };

  // Effect to start video loop once we are in LIVE_COOKING and connected
  useEffect(() => {
    if (screen === AppScreen.LIVE_COOKING && liveStatus === 'CONNECTED' && videoRef.current && liveClientRef.current) {
        liveClientRef.current.startVideoLoop(videoRef.current);
    }
  }, [screen, liveStatus]);

  const endSession = () => {
    liveClientRef.current?.disconnect();
    setScreen(AppScreen.HOME);
    setLiveStatus(LiveStatus.DISCONNECTED);
  };

  // --- Renders ---

  const renderQRModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in" onClick={() => setShowQR(false)}>
        <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl relative" onClick={e => e.stopPropagation()}>
            <button 
                onClick={() => setShowQR(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
                <X className="w-6 h-6" />
            </button>

            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Share & Mobile Access</h3>
            <p className="text-slate-400 text-sm mb-6">Scan to open on your phone or share with friends.</p>
            
            <div className="bg-white p-2 rounded-xl mx-auto w-max mb-6 shadow-lg shadow-black/50">
                <img 
                    src={`https://quickchart.io/qr?text=${encodeURIComponent(editableUrl || 'https://google.com')}&size=300&ecLevel=M&margin=2&format=svg`} 
                    alt="Scan this code" 
                    className="w-48 h-48 block"
                />
            </div>
            
            <div className="bg-slate-800 p-3 rounded-lg text-left mb-4">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">App URL</p>
                    <button 
                        onClick={() => setIsEditingUrl(!isEditingUrl)} 
                        className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                        <Edit2 className="w-3 h-3" /> {isEditingUrl ? 'Done' : 'Edit'}
                    </button>
                </div>
                
                {isEditingUrl ? (
                    <input 
                        type="text" 
                        value={editableUrl}
                        onChange={(e) => setEditableUrl(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-white focus:border-emerald-500 outline-none font-mono"
                        placeholder="https://..."
                    />
                ) : (
                    <div className="flex items-center gap-2 bg-slate-900 rounded border border-slate-700 p-2 overflow-hidden">
                        <span className="text-xs text-slate-300 truncate flex-1 font-mono">{editableUrl}</span>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={handleCopyUrl}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors font-medium text-sm"
                >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied' : 'Copy Link'}
                </button>
                <button 
                    onClick={handleShare}
                    className="flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors font-medium text-sm"
                >
                    <Share2 className="w-4 h-4" />
                    Share
                </button>
            </div>
        </div>
    </div>
  );

  const renderHome = () => (
    <div className="flex flex-col h-full p-6 space-y-8 animate-fade-in relative">
      <button 
        onClick={() => setShowQR(true)}
        className="absolute top-6 right-6 p-3 bg-slate-800/50 hover:bg-slate-700 text-emerald-400 rounded-full border border-emerald-500/30 transition-all shadow-lg backdrop-blur-md"
      >
        <QrCode className="w-6 h-6" />
      </button>

      <div className="mt-12 text-center">
        <div className="inline-block p-4 rounded-full bg-emerald-500/20 mb-4">
            <ChefHat className="w-12 h-12 text-emerald-400" />
        </div>
        <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-200">
          MamaAI
        </h1>
        <p className="text-slate-400 mt-2">Your real-time AI cooking companion.</p>
      </div>

      <div className="grid gap-4 mt-8">
        <button
          onClick={() => setScreen(AppScreen.INGREDIENT_INPUT)}
          className="group relative p-6 rounded-2xl bg-slate-800 border border-slate-700 hover:border-emerald-500 transition-all text-left overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Utensils className="w-24 h-24 rotate-12" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">Recipe Planner</h3>
          <p className="text-sm text-slate-400">Scan ingredients or type what you have.</p>
        </button>

        <button
          onClick={() => {
            setSelectedRecipe({
                id: 'freestyle',
                title: 'Freestyle Cooking',
                description: 'Just you and the AI.',
                time: 'Open',
                difficulty: 'Medium',
                ingredients: [],
                equipment: [],
                steps: ['Cook whatever you want!']
            });
            setScreen(AppScreen.PREP_DETAILS);
          }}
          className="group relative p-6 rounded-2xl bg-slate-800 border border-slate-700 hover:border-emerald-500 transition-all text-left overflow-hidden"
        >
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="w-24 h-24 -rotate-12" />
          </div>
          <h3 className="text-xl font-bold text-white mb-1">Freestyle Mode</h3>
          <p className="text-sm text-slate-400">Just cook. I'll watch and help.</p>
        </button>
      </div>
    </div>
  );

  const renderIngredientInput = () => (
    <div className="flex flex-col h-full p-6">
      <header className="flex items-center mb-6">
        <button onClick={() => setScreen(AppScreen.HOME)} className="p-2 rounded-full hover:bg-slate-800">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="ml-4 text-xl font-semibold">What's in your kitchen?</h2>
      </header>

      <div className="flex-1 space-y-6">
        <div className="relative">
          <label className="block text-sm font-medium text-slate-400 mb-2">Ingredients / Cravings</label>
          <textarea
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            placeholder="e.g., 2 chicken breasts, old rice, soy sauce..."
            className="w-full h-32 bg-slate-800 rounded-xl border border-slate-700 p-4 text-white focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
          />
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Or snap a photo</label>
            <div className="flex items-center gap-4">
                <label className="flex-1 h-24 border-2 border-dashed border-slate-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-emerald-500 transition-colors bg-slate-800/50">
                    <Camera className="w-6 h-6 text-emerald-400 mb-2" />
                    <span className="text-xs text-slate-500">Take Photo</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                </label>
                {selectedImage && (
                    <div className="h-24 w-24 rounded-xl overflow-hidden border border-slate-700 relative">
                        <img src={selectedImage} alt="Selected" className="w-full h-full object-cover" />
                        <button onClick={() => setSelectedImage(null)} className="absolute top-1 right-1 bg-black/50 rounded-full p-1">
                            <X className="w-3 h-3" />
                        </button>
                    </div>
                )}
            </div>
        </div>
      </div>

      <button
        onClick={handlePlanRecipe}
        disabled={isLoading || (!ingredientsText && !selectedImage)}
        className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
        Generate Recipes
      </button>
    </div>
  );

  const renderRecipeSelection = () => (
    <div className="flex flex-col h-full p-4">
       <header className="flex items-center mb-6">
        <button onClick={() => setScreen(AppScreen.INGREDIENT_INPUT)} className="p-2 rounded-full hover:bg-slate-800">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="ml-4 text-xl font-semibold">Suggested Recipes</h2>
      </header>
      
      <div className="flex-1 overflow-y-auto space-y-4 pb-4 no-scrollbar">
        {recipes.map((recipe, idx) => (
            <div key={idx} onClick={() => { setSelectedRecipe(recipe); setScreen(AppScreen.PREP_DETAILS); }} className="bg-slate-800 rounded-2xl p-5 border border-slate-700 cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-bold text-white">{recipe.title}</h3>
                    <span className={`text-xs px-2 py-1 rounded-full ${recipe.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {recipe.difficulty}
                    </span>
                </div>
                <p className="text-sm text-slate-400 mb-4 line-clamp-2">{recipe.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {recipe.time}</span>
                    <span className="flex items-center gap-1"><Utensils className="w-3 h-3" /> {recipe.ingredients.length} ingredients</span>
                </div>
            </div>
        ))}
      </div>
    </div>
  );

  const renderPrepDetails = () => (
    <div className="flex flex-col h-full bg-slate-900">
      <div className="relative h-48 bg-emerald-900/20 w-full overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900 z-10" />
        <div className="absolute bottom-4 left-6 z-20">
            <h1 className="text-3xl font-bold text-white leading-tight">{selectedRecipe?.title}</h1>
            <div className="flex items-center gap-2 text-emerald-400 text-sm mt-1">
                <Clock className="w-4 h-4" /> {selectedRecipe?.time}
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6 no-scrollbar">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
            <h3 className="font-semibold text-emerald-400 mb-3 flex items-center gap-2">
                <Utensils className="w-4 h-4" /> Ingredients
            </h3>
            <ul className="space-y-2 text-sm text-slate-300">
                {selectedRecipe?.ingredients.map((ing, i) => (
                    <li key={i} className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> {ing}
                    </li>
                ))}
            </ul>
        </div>

        <div className="p-4 bg-emerald-900/10 border border-emerald-500/20 rounded-xl">
             <div className="flex items-start gap-3">
                <Camera className="w-5 h-5 text-emerald-400 mt-1" />
                <div>
                    <h4 className="font-bold text-white text-sm">Ready for Video Mode?</h4>
                    <p className="text-xs text-slate-400 mt-1">
                        Prop your phone so the camera sees your workspace. I'll watch and guide you.
                    </p>
                </div>
             </div>
        </div>
      </div>

      <div className="p-6 bg-slate-900 border-t border-slate-800">
        <button
            onClick={startLiveCooking}
            className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
            <Play className="w-5 h-5 fill-current" />
            Start Cooking Live
        </button>
      </div>
    </div>
  );

  // Helper for Status Overlay in Live Mode
  const renderStatusOverlay = () => {
    if (liveStatus === 'CONNECTING') {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-900/80 backdrop-blur-sm">
                <Loader2 className="w-12 h-12 text-emerald-400 animate-spin mb-4" />
                <p className="text-white font-medium">Connecting to MamaAI...</p>
             </div>
        );
    }
    
    // Explicitly handle disconnect/error to show a Resume Button instead of an infinite loader
    if (liveStatus === 'DISCONNECTED' || liveStatus === 'ERROR') {
        return (
            <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-slate-900/90 backdrop-blur-sm p-6 text-center">
                <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-2">Session Paused</h3>
                <p className="text-slate-400 mb-8 max-w-xs mx-auto">
                    The connection was lost. Don't worry, your cooking plan is safe.
                </p>
                <button 
                    onClick={handleReconnect}
                    className="px-8 py-3 bg-white text-slate-900 font-bold rounded-full hover:bg-emerald-50 transition-colors flex items-center gap-2"
                >
                    <RefreshCw className="w-4 h-4" /> Resume Cooking
                </button>
             </div>
        );
    }

    return null;
  };

  const renderLiveCooking = () => (
    <div className="relative w-full h-full bg-black overflow-hidden">
        {/* Video Feed */}
        <video 
            ref={videoRef} 
            className="absolute inset-0 w-full h-full object-cover" 
            muted 
            playsInline
        />

        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/80 pointer-events-none" />

        {/* Top Controls */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-10">
            <button onClick={endSession} className="bg-red-500/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-semibold shadow-lg hover:bg-red-600/80 transition-colors">
                End Session
            </button>
            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider backdrop-blur-md shadow-lg flex items-center gap-2 ${
                liveStatus === 'CONNECTED' ? 'bg-emerald-500/80 text-white' : 'bg-slate-700/80 text-slate-300'
            }`}>
                {liveStatus === 'CONNECTED' ? (
                    <><span className="w-2 h-2 rounded-full bg-white animate-pulse" /> LIVE</>
                ) : liveStatus}
            </div>
        </div>

        {/* Status / Loading / Error Overlay */}
        {renderStatusOverlay()}

        {/* Bottom AI Interface (Only show if connected or connecting, hide on error screen) */}
        {(liveStatus === 'CONNECTED' || liveStatus === 'CONNECTING') && (
            <div className="absolute bottom-0 left-0 right-0 p-6 z-10">
                {/* Audio Visualization */}
                <div className="flex justify-center items-center gap-1 h-12 mb-6">
                    {[...Array(5)].map((_, i) => (
                        <div 
                            key={i}
                            className="w-2 bg-emerald-400 rounded-full transition-all duration-75"
                            style={{ 
                                height: Math.max(8, audioLevel * 40 * (Math.random() * 0.5 + 0.5)) + 'px',
                                opacity: 0.5 + (audioLevel * 0.5)
                            }}
                        />
                    ))}
                </div>

                <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl p-4 border border-slate-700/50 shadow-xl">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-lg">
                            <Sparkles className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-medium text-sm">
                                I'm watching your stove. Just ask "Is this done?" or "What's next?".
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );

  return (
    <div className="w-full h-screen bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {screen === AppScreen.HOME && renderHome()}
      {screen === AppScreen.INGREDIENT_INPUT && renderIngredientInput()}
      {screen === AppScreen.RECIPE_SELECTION && renderRecipeSelection()}
      {screen === AppScreen.PREP_DETAILS && renderPrepDetails()}
      {screen === AppScreen.LIVE_COOKING && renderLiveCooking()}
      {showQR && renderQRModal()}
    </div>
  );
}