import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Video, 
  Plus, 
  Play, 
  Download, 
  Trash2, 
  Wand2, 
  Image as ImageIcon, 
  Music, 
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { ApiKeySelector } from '@/src/components/ApiKeySelector';
import { getAI, breakdownPromptIntoScenes, Scene, generateAudioForVideo } from '@/src/lib/gemini';

export default function App() {
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(-1);
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  // Check if API key is already available (e.g. Enterprise login)
  useEffect(() => {
    const checkExistingKey = async () => {
      if (window.aistudio) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) setApiKeySelected(true);
      }
    };
    checkExistingKey();
  }, []);

  const handleAnalyze = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt first");
      return;
    }
    setIsAnalyzing(true);
    try {
      const result = await breakdownPromptIntoScenes(prompt);
      setScenes(result);
      toast.success("Prompt analyzed! Scenes created.");
    } catch (error) {
      console.error(error);
      toast.error("Failed to analyze prompt");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setUploadedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateVideo = async () => {
    if (scenes.length === 0) return;
    setIsGenerating(true);
    setProgress(0);
    setGeneratedVideoUrl(null);
    setAudioUrl(null);

    try {
      const ai = getAI();
      let currentVideo: any = null;
      let finalVideoUrl = "";

      // Generate Audio in parallel
      generateAudioForVideo(prompt).then(url => setAudioUrl(url));

      for (let i = 0; i < scenes.length; i++) {
        setCurrentSceneIndex(i);
        const scene = scenes[i];
        const sceneProgress = (i / scenes.length) * 100;
        setProgress(sceneProgress);

        toast.info(`Generating Scene ${i + 1}: ${scene.description.substring(0, 30)}...`);

        const config: any = {
          numberOfVideos: 1,
          resolution: '720p',
          aspectRatio: '16:9',
        };

        let operation;
        if (i === 0) {
          // First scene - Using High Quality model for Enterprise
          operation = await ai.models.generateVideos({
            model: 'veo-3.1-generate-preview',
            prompt: scene.description,
            image: uploadedImage ? {
              imageBytes: uploadedImage.split(',')[1],
              mimeType: 'image/png'
            } : undefined,
            config
          });
        } else {
          // Extend video
          operation = await ai.models.generateVideos({
            model: 'veo-3.1-generate-preview',
            prompt: scene.description,
            video: currentVideo,
            config
          });
        }

        // Poll for completion
        while (!operation.done) {
          await new Promise(resolve => setTimeout(resolve, 5000));
          operation = await ai.operations.getVideosOperation({ operation });
        }

        currentVideo = operation.response?.generatedVideos?.[0]?.video;
        if (!currentVideo) throw new Error("Failed to generate scene " + (i + 1));

        finalVideoUrl = currentVideo.uri;
      }

      // Fetch the final video
      const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
      const response = await fetch(finalVideoUrl, {
        method: 'GET',
        headers: {
          'x-goog-api-key': apiKey!,
        },
      });
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setGeneratedVideoUrl(url);
      setProgress(100);
      toast.success("Video generation complete!");
    } catch (error: any) {
      console.error(error);
      if (error.message?.includes("Requested entity was not found")) {
        toast.error("API Key error. Please re-select your key.");
        setApiKeySelected(false);
      } else {
        toast.error("Generation failed: " + error.message);
      }
    } finally {
      setIsGenerating(false);
      setCurrentSceneIndex(-1);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-primary/30 antialiased">
      <Toaster position="top-center" richColors />
      {!apiKeySelected && <ApiKeySelector onKeySelected={() => setApiKeySelected(true)} />}

      {/* Header */}
      <header className="border-b border-white/5 bg-black/80 backdrop-blur-2xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white text-black rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)]">
              <Video className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-light tracking-tight flex items-center gap-3">
                Veo <span className="font-bold">Ultra</span>
                <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full border border-white/20 uppercase tracking-widest font-bold text-white/60">Enterprise</span>
              </h1>
              <p className="text-[10px] text-white/40 font-bold uppercase tracking-[0.3em] mt-0.5">Cinematic Intelligence Engine</p>
            </div>
          </div>
          <div className="flex items-center gap-6">
             {apiKeySelected && (
               <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                 <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                 <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">Ultra Credits Active</span>
               </div>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-8 py-16 grid grid-cols-1 lg:grid-cols-12 gap-16">
        {/* Left Column: Input & Scenes */}
        <div className="lg:col-span-5 space-y-12">
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-[0.4em] text-white/40">
                Creative Direction
              </h2>
            </div>
            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/20 to-purple-500/20 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-1000"></div>
              <Card className="bg-white/[0.02] border-white/10 rounded-3xl overflow-hidden relative backdrop-blur-sm">
                <CardContent className="p-0">
                  <Textarea 
                    placeholder="Describe your cinematic vision in detail..."
                    className="min-h-[200px] bg-transparent border-none focus-visible:ring-0 text-xl font-light p-8 resize-none placeholder:text-white/10 leading-relaxed"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    disabled={isGenerating || isAnalyzing}
                  />
                  <div className="p-6 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
                    <div className="flex gap-3">
                      <label className="cursor-pointer group/btn">
                        <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${uploadedImage ? 'bg-white text-black' : 'bg-white/5 hover:bg-white/10 border border-white/10'}`}>
                          <ImageIcon className="h-3.5 w-3.5" />
                          {uploadedImage ? 'Reference Set' : 'Reference Image'}
                        </div>
                      </label>
                    </div>
                    <Button 
                      onClick={handleAnalyze} 
                      disabled={isAnalyzing || isGenerating || !prompt}
                      className="rounded-full px-6 h-10 text-[10px] font-bold uppercase tracking-widest bg-white text-black hover:bg-white/90 transition-transform active:scale-95"
                    >
                      {isAnalyzing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5 mr-2" />}
                      Analyze Storyboard
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </section>

          <AnimatePresence mode="wait">
            {scenes.length > 0 && (
              <motion.section 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="space-y-8"
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-4">
                  <h2 className="text-xs font-bold uppercase tracking-[0.4em] text-white/40">
                    Storyboard Sequence
                  </h2>
                  <button onClick={() => setScenes([])} className="text-[10px] font-bold uppercase tracking-widest text-white/20 hover:text-white transition-colors">
                    Reset
                  </button>
                </div>
                
                <div className="space-y-4">
                  {scenes.map((scene, index) => (
                    <motion.div 
                      key={scene.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <div className={`group relative p-6 rounded-2xl transition-all duration-500 ${currentSceneIndex === index ? 'bg-white/[0.05] ring-1 ring-white/20' : 'hover:bg-white/[0.02]'}`}>
                        <div className="flex gap-6 items-start">
                          <span className="text-[10px] font-bold text-white/20 mt-1">0{index + 1}</span>
                          <div className="flex-1 space-y-2">
                            <p className="text-sm font-light leading-relaxed text-white/70 group-hover:text-white transition-colors">{scene.description}</p>
                            <div className="flex items-center gap-3">
                              <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-bold">8.0s</span>
                              <div className="h-px w-8 bg-white/10" />
                              <span className="text-[9px] uppercase tracking-[0.2em] text-white/30 font-bold">Ultra Fidelity</span>
                            </div>
                          </div>
                          {currentSceneIndex === index && (
                            <div className="flex items-center gap-2">
                              <div className="w-1 h-1 bg-primary rounded-full animate-ping" />
                              <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Rendering</span>
                            </div>
                          )}
                          {index < currentSceneIndex && (
                            <CheckCircle2 className="h-4 w-4 text-white/40" />
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                <Button 
                  className="w-full h-20 text-xs font-bold uppercase tracking-[0.3em] bg-white text-black hover:bg-white/90 rounded-2xl shadow-[0_20px_50px_rgba(255,255,255,0.1)] transition-all active:scale-[0.98]" 
                  onClick={generateVideo}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <div className="flex items-center gap-4">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Processing Ultra Stream</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4">
                      <Play className="h-5 w-5 fill-current" />
                      <span>Initialize Production</span>
                    </div>
                  )}
                </Button>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        {/* Right Column: Preview & Output */}
        <div className="lg:col-span-7 space-y-12">
          <section className="space-y-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.4em] text-white/40">
              Master Output
            </h2>
            
            <div className="aspect-video bg-white/[0.02] rounded-[2rem] border border-white/5 overflow-hidden relative group shadow-2xl ring-1 ring-white/10">
              {generatedVideoUrl ? (
                <video 
                  src={generatedVideoUrl} 
                  controls 
                  className="w-full h-full object-cover"
                  autoPlay
                />
              ) : isGenerating ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center p-16 text-center space-y-10">
                  <div className="relative">
                    <div className="w-32 h-32 border border-white/5 rounded-full animate-[spin_3s_linear_infinite]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 border-t-2 border-white rounded-full animate-spin" />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-2xl font-light tracking-tight">Synthesizing Scene 0{currentSceneIndex + 1}</h3>
                    <p className="text-white/30 text-[10px] uppercase tracking-[0.3em] max-w-xs mx-auto">
                      Veo 3.1 Ultra • High Fidelity Rendering
                    </p>
                  </div>
                  <div className="w-full max-w-md space-y-4">
                    <div className="flex justify-between text-[9px] uppercase font-bold tracking-[0.3em] text-white/20">
                      <span>Global Progress</span>
                      <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        className="h-full bg-white"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-white/10 p-16 text-center">
                  <div className="w-24 h-24 rounded-full border border-white/5 flex items-center justify-center mb-8">
                    <Video className="h-8 w-8 opacity-20" />
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.4em]">Awaiting Production</p>
                </div>
              )}
            </div>

            <AnimatePresence>
              {generatedVideoUrl && (
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex flex-wrap gap-6"
                >
                  <Button variant="outline" className="h-14 px-8 rounded-2xl bg-white/5 border-white/10 hover:bg-white/10 text-[10px] font-bold uppercase tracking-widest gap-3" asChild>
                    <a href={generatedVideoUrl} download="veo-ultra-master.mp4">
                      <Download className="h-4 w-4" />
                      Export Master
                    </a>
                  </Button>
                  {audioUrl && (
                    <div className="flex items-center gap-6 px-8 py-3 bg-white/5 border border-white/10 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <Music className="h-4 w-4 text-white/40" />
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">AI Audio Stream</span>
                      </div>
                      <audio src={audioUrl} controls className="h-8 w-40 opacity-50 hover:opacity-100 transition-opacity" />
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </section>

          {/* Enterprise Info */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-white/20" />
                <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Production Note</h4>
              </div>
              <p className="text-xs font-light text-white/30 leading-relaxed">
                Seamless scene extension is optimized for 720p cinematic output. Veo 3.1 Ultra maintains temporal consistency across all generated segments.
              </p>
            </div>
            <div className="p-8 rounded-3xl bg-white/[0.02] border border-white/5 space-y-4">
              <div className="flex items-center gap-3">
                <ImageIcon className="h-4 w-4 text-white/20" />
                <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">Reference Engine</h4>
              </div>
              <p className="text-xs font-light text-white/30 leading-relaxed">
                Reference images provide the visual seed for the Ultra engine, anchoring the aesthetic style for the entire multi-scene production.
              </p>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-20 mt-20 bg-black">
        <div className="max-w-7xl mx-auto px-8 flex flex-col items-center space-y-8">
          <div className="flex items-center gap-4 opacity-20">
            <div className="h-px w-12 bg-white" />
            <span className="text-[10px] font-bold uppercase tracking-[0.5em]">Veo Ultra Enterprise</span>
            <div className="h-px w-12 bg-white" />
          </div>
          <p className="text-[9px] text-white/10 uppercase tracking-[0.2em] text-center max-w-md leading-loose">
            High-Fidelity Video Synthesis Engine • Powered by Google Veo 3.1 & Gemini 3.1 Pro • Professional Grade Cinematic Output
          </p>
        </div>
      </footer>
    </div>
  );
}
