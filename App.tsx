import React, { useState, useRef } from 'react';
import { Book, Wand2, Search, Edit, Video, Share2, Loader2, Sparkles, Globe, Download, CheckCircle2, ExternalLink, Image as ImageIcon } from 'lucide-react';
import html2canvas from 'html2canvas';
import { AppStep, BookMetadata, GroundingData, CATEGORIES, Language, LANGUAGES, TRANSLATIONS, MARKETPLACES } from './types';
import * as GeminiService from './services/geminiService';
import CoverCanvas from './components/CoverCanvas';

function App() {
  const [step, setStep] = useState<AppStep>(AppStep.DETAILS);
  const [isLoading, setIsLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [language, setLanguage] = useState<Language>('it');
  
  // Data State
  const [metadata, setMetadata] = useState<BookMetadata>({
    amazonMarketplace: MARKETPLACES[0].id, // Default to IT (first in list)
    category: CATEGORIES[0],
    targetMarket: '',
    topic: '',
    author: '',
    title: '',
    subtitle: '',
    description: ''
  });
  const [groundingData, setGroundingData] = useState<GroundingData | null>(null);
  const [generatedImages, setGeneratedImages] = useState<string[]>([]);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  // Edit & Video Inputs
  const [editPrompt, setEditPrompt] = useState('');
  const [videoPrompt, setVideoPrompt] = useState('');

  // Ref for capturing the full cover (image + text)
  const coverCanvasRef = useRef<HTMLDivElement>(null);

  const t = TRANSLATIONS[language];

  const handleInputChange = (field: keyof BookMetadata, value: string) => {
    setMetadata(prev => ({ ...prev, [field]: value }));
  };

  const startProcess = async () => {
    if (!metadata.topic || !metadata.author) {
      alert("Please enter a topic and author name.");
      return;
    }
    setStep(AppStep.RESEARCH);
    setIsLoading(true);

    try {
      // 1. Research
      const marketplaceName = MARKETPLACES.find(m => m.id === metadata.amazonMarketplace)?.name || 'Amazon';
      const niche = metadata.targetMarket || metadata.category;
      
      setStatusMessage(`${t.analyzing} ${marketplaceName} (${niche})...`);
      const research = await GeminiService.researchTrends(
        metadata.category, 
        metadata.topic, 
        metadata.targetMarket, 
        metadata.amazonMarketplace,
        language
      );
      setGroundingData(research);

      // 2. Generate Text
      setStatusMessage(t.crafting);
      const textData = await GeminiService.generateBookText(metadata.topic, metadata.category, metadata.author, language);
      setMetadata(prev => ({ ...prev, ...textData }));

      // 3. Generate Image
      setStatusMessage(t.painting);
      // Enhanced prompt for composition control
      const imagePrompt = `
        Create a stunning, high-resolution book cover art (NO TEXT) for a ${metadata.category} book.
        Marketplace: ${marketplaceName}.
        Niche: ${niche}.
        Topic: ${metadata.topic}.
        Art Direction: ${research.trends}.
        
        CRITICAL COMPOSITION RULES:
        1. TOP 40% of the image MUST be a PLAIN, SOLID, DARK or NEUTRAL BACKGROUND (sky, wall, void). 
        2. NO complex details, NO faces, NO objects in the TOP 40% to ensure title readability.
        3. The MAIN SUBJECT/CHARACTER/ACTION must be strictly contained in the BOTTOM 60% of the frame.
        
        Style: Professional, polished, cinematic lighting.
      `;
      // Generate 3 variations
      const images = await GeminiService.generateCoverImages(imagePrompt);
      setGeneratedImages(images);
      setCoverImage(images[0]); // Default to first

      setStep(AppStep.GENERATION);
    } catch (error) {
      console.error(error);
      alert(t.errorKey);
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleEditImage = async () => {
    if (!coverImage || !editPrompt) return;
    setIsLoading(true);
    setStatusMessage(t.applyingEdits);
    try {
      const newImage = await GeminiService.editCoverImage(coverImage, editPrompt);
      setCoverImage(newImage); // Updates the main preview
      setEditPrompt('');
    } catch (e) {
      alert(t.errorEdit);
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleCreateVideo = async () => {
    if (!coverImage) return;
    setIsLoading(true);
    setStatusMessage(t.generatingVideo);
    try {
      const url = await GeminiService.generateVeoVideo(coverImage, videoPrompt);
      setVideoUrl(url);
      setStep(AppStep.VIDEO);
    } catch (e) {
      alert(t.errorVideo);
    } finally {
      setIsLoading(false);
      setStatusMessage('');
    }
  };

  const handleDownloadFull = async () => {
    if (!coverCanvasRef.current || !coverImage) return;
    
    // We set a loading state briefly or just let the async process run
    // html2canvas capture
    try {
      const canvas = await html2canvas(coverCanvasRef.current, {
        scale: 3, // High resolution
        useCORS: true, // Allow cross-origin images (though we use base64)
        allowTaint: true,
        backgroundColor: null
      });

      // Create download link
      const imageUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imageUrl;
      link.download = `cover-${metadata.title.replace(/\s+/g, '-').toLowerCase() || 'design'}.png`;
      link.click();
    } catch (error) {
      console.error("Capture failed:", error);
      alert("Could not generate the final image. Please try again.");
    }
  };

  // Helper to find a link for a reference book
  const findLinkForRef = (refTitle: string) => {
    // Try to match with sources
    if (!groundingData) return '#';
    const match = groundingData.sources.find(s => s.title.toLowerCase().includes(refTitle.toLowerCase()) || refTitle.toLowerCase().includes(s.title.toLowerCase()));
    return match ? match.uri : `https://www.google.com/search?q=${encodeURIComponent(refTitle + ' book cover')}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Book className="text-emerald-500" size={24} />
            <h1 className="text-xl font-bold tracking-tight text-white font-cinzel">{t.appTitle} <span className="text-emerald-500">AI</span></h1>
          </div>
          
          <div className="flex items-center gap-6">
            <div className="flex items-center bg-slate-800 rounded-full px-3 py-1 border border-slate-700">
               <Globe size={14} className="text-slate-400 mr-2" />
               <select 
                 value={language}
                 onChange={(e) => setLanguage(e.target.value as Language)}
                 className="bg-transparent text-xs font-mono text-slate-300 focus:outline-none cursor-pointer"
               >
                 {LANGUAGES.map(l => (
                   <option key={l.code} value={l.code} className="bg-slate-800">{l.label}</option>
                 ))}
               </select>
            </div>
            <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-400">
              <span>{t.subtitle}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Layout Grid - Adjusted for 3 columns */}
      <main className="max-w-[1400px] mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        
        {/* COL 1: Left Sticky Sidebar - Image Selection (Visibile solo se ci sono immagini) */}
        <div className="lg:col-span-2 relative order-2 lg:order-1">
          {generatedImages.length > 0 && !isLoading && (
            <div className="lg:sticky lg:top-24 space-y-4 animate-in slide-in-from-left-4 fade-in duration-500">
              <h3 className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-2 text-center lg:text-left">{t.variations}</h3>
              <div className="flex flex-row lg:flex-col gap-4 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0">
                {generatedImages.map((img, idx) => (
                  <div key={idx} className="flex flex-col gap-2 min-w-[100px] lg:min-w-0">
                     <div 
                      onClick={() => setCoverImage(img)}
                      className={`relative aspect-[9/16] rounded-md overflow-hidden cursor-pointer transition-all hover:scale-105 group ${coverImage === img ? 'ring-2 ring-emerald-500 shadow-lg shadow-emerald-500/20' : 'opacity-60 hover:opacity-100 ring-1 ring-slate-700'}`}
                    >
                      <img src={img} alt={`Option ${idx + 1}`} className="w-full h-full object-cover" />
                      {coverImage === img && (
                        <div className="absolute top-1 right-1 bg-emerald-500 rounded-full p-0.5">
                           <CheckCircle2 size={12} className="text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* COL 2: Middle Column - Inputs & Controls */}
        <div className="lg:col-span-4 space-y-6 order-1 lg:order-2">
          
          {/* Progress Steps */}
          <div className="flex justify-between items-center mb-6 px-2">
            {[AppStep.DETAILS, AppStep.RESEARCH, AppStep.GENERATION, AppStep.VIDEO].map((s, idx) => (
              <div key={s} className={`flex flex-col items-center gap-1 ${step === s ? 'text-emerald-400' : 'text-slate-600'}`}>
                <div className={`w-3 h-3 rounded-full ${step === s ? 'bg-emerald-400 shadow-emerald-500/50 shadow-lg' : 'bg-slate-700'}`} />
              </div>
            ))}
          </div>

          <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl">
            
            {step === AppStep.DETAILS && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-4">
                <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Wand2 size={20} className="text-purple-400" />
                  {t.conceptSetup}
                </h2>
                
                {/* Inputs ... */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">{t.marketplaceLabel}</label>
                  <div className="relative">
                    <select 
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none appearance-none cursor-pointer"
                      value={metadata.amazonMarketplace}
                      onChange={(e) => handleInputChange('amazonMarketplace', e.target.value)}
                    >
                      {MARKETPLACES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                    </select>
                    <div className="absolute right-3 top-3 pointer-events-none text-slate-500">
                      <Globe size={16} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">{t.amazonCategory}</label>
                  <select 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-all"
                    value={metadata.category}
                    onChange={(e) => handleInputChange('category', e.target.value)}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">{t.targetMarketLabel}</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder:text-slate-600"
                    placeholder={t.placeholderMarket}
                    value={metadata.targetMarket}
                    onChange={(e) => handleInputChange('targetMarket', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">{t.authorName}</label>
                  <input 
                    type="text" 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder={t.placeholderAuthor}
                    value={metadata.author}
                    onChange={(e) => handleInputChange('author', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-400">{t.bookTopic}</label>
                  <textarea 
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none h-24 resize-none"
                    placeholder={t.placeholderTopic}
                    value={metadata.topic}
                    onChange={(e) => handleInputChange('topic', e.target.value)}
                  />
                </div>

                <button 
                  onClick={startProcess}
                  disabled={isLoading}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/20"
                >
                  {isLoading ? <Loader2 className="animate-spin" /> : <Sparkles size={18} />}
                  {t.generateBtn}
                </button>
              </div>
            )}

            {(step === AppStep.GENERATION || step === AppStep.VIDEO) && (
              <div className="space-y-6 animate-in fade-in zoom-in-95">
                 <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                  <Edit size={20} className="text-blue-400" />
                  {t.refineExport}
                </h2>

                {/* AI Text Edit Section */}
                <div className="space-y-3 p-4 bg-slate-950/50 rounded-lg border border-slate-800">
                  <div className="flex justify-between items-center">
                    <h3 className="text-sm font-medium text-slate-300">{t.metadataEditable}</h3>
                  </div>
                  <input 
                    value={metadata.title}
                    onChange={(e) => handleInputChange('title', e.target.value)}
                    className="w-full bg-transparent border-b border-slate-700 p-1 text-white font-bold text-sm focus:border-emerald-500 focus:outline-none"
                  />
                  <input 
                    value={metadata.subtitle}
                    onChange={(e) => handleInputChange('subtitle', e.target.value)}
                    className="w-full bg-transparent border-b border-slate-700 p-1 text-slate-400 text-xs focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Nano Banana Image Edit */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Wand2 size={14} /> {t.aiImageEdit}
                  </label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      placeholder={t.placeholderEdit}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                    <button 
                      onClick={handleEditImage}
                      disabled={isLoading}
                      className="bg-blue-600 hover:bg-blue-500 text-white px-4 rounded-lg font-medium text-xs transition-colors"
                    >
                      {isLoading ? '...' : t.editBtn}
                    </button>
                  </div>
                </div>

                {/* Veo Video Gen */}
                <div className="pt-4 border-t border-slate-800 space-y-3">
                   <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                    <Video size={14} className="text-rose-400" /> {t.veoTrailer}
                  </label>
                  <p className="text-xs text-slate-500">{t.veoNote}</p>
                   <div className="flex gap-2">
                    <input 
                      type="text" 
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      placeholder={t.placeholderVideo}
                      className="flex-1 bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm focus:ring-1 focus:ring-emerald-500 outline-none"
                    />
                    <button 
                      onClick={handleCreateVideo}
                      disabled={isLoading}
                      className="bg-rose-700 hover:bg-rose-600 text-white px-4 rounded-lg font-medium text-xs transition-colors"
                    >
                      {isLoading ? '...' : t.animateBtn}
                    </button>
                  </div>
                </div>

                 <button 
                  onClick={() => setStep(AppStep.DETAILS)}
                  className="w-full mt-4 text-slate-500 hover:text-white text-xs transition-colors"
                >
                  {t.startOver}
                </button>
              </div>
            )}
          </div>

          {/* Research Results Display */}
          {groundingData && (
            <div className="space-y-6">
              {/* Trends Summary */}
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl space-y-3 animate-in fade-in slide-in-from-bottom-4">
                <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Search size={16} /> {t.marketResearch}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed italic border-l-2 border-slate-700 pl-3">
                  {groundingData.trends}
                </p>
              </div>

              {/* Inspiration Moodboard */}
              {groundingData.references && groundingData.references.length > 0 && (
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6 shadow-xl space-y-4 animate-in fade-in slide-in-from-bottom-6">
                   <h3 className="text-sm font-semibold text-emerald-400 flex items-center gap-2 uppercase tracking-wider">
                    <ImageIcon size={16} /> {t.inspirationBoard}
                  </h3>
                  <div className="grid grid-cols-1 gap-3">
                    {groundingData.references.map((ref, i) => (
                      <div key={i} className="flex gap-3 bg-slate-950 p-3 rounded-lg border border-slate-800 hover:border-slate-700 transition-colors group">
                        {/* Placeholder Icon mimicking a cover thumbnail */}
                        <div className="w-12 h-16 bg-gradient-to-br from-slate-800 to-slate-700 rounded flex items-center justify-center flex-shrink-0 group-hover:from-slate-700 group-hover:to-slate-600">
                          <Book size={20} className="text-slate-500 group-hover:text-emerald-500 transition-colors" />
                        </div>
                        <div className="flex flex-col justify-between flex-grow min-w-0">
                          <div>
                            <h4 className="text-xs font-bold text-white truncate" title={ref.title}>{ref.title}</h4>
                            <p className="text-[10px] text-slate-400 truncate">{ref.author}</p>
                          </div>
                          <p className="text-[10px] text-slate-500 italic truncate mt-1">{ref.visualHook}</p>
                        </div>
                        <a 
                          href={findLinkForRef(ref.title)} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center self-center justify-center p-2 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-emerald-600 transition-all"
                          title={t.viewCover}
                        >
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* COL 3: Right Column - Main Preview (Spazio maggiore) */}
        <div className="lg:col-span-6 flex flex-col items-center gap-6 order-3 lg:sticky lg:top-24 h-fit">
          
             {/* Loading Status Overlay */}
             {isLoading && statusMessage && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center text-center p-4">
                    <div className="bg-slate-900 border border-emerald-500/30 p-8 rounded-2xl shadow-2xl max-w-md w-full flex flex-col items-center">
                         <div className="relative">
                            <div className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"></div>
                            <Loader2 size={48} className="text-emerald-500 animate-spin relative z-10" />
                         </div>
                         <h3 className="mt-6 text-xl font-bold text-white">AI Art Director is working</h3>
                         <p className="mt-2 text-slate-400 text-sm animate-pulse">{statusMessage}</p>
                    </div>
                </div>
             )}

            {/* Main Preview */}
            <div className="w-full flex flex-col items-center gap-6">
               {step === AppStep.VIDEO && videoUrl ? (
                  <div className="w-full max-w-[450px] aspect-[9/16] bg-black rounded-lg shadow-2xl border-4 border-slate-800 overflow-hidden relative group">
                    <video src={videoUrl} controls autoPlay loop className="w-full h-full object-cover" />
                    <div className="absolute top-4 right-4 bg-rose-600 text-white text-[10px] px-2 py-1 rounded font-bold uppercase tracking-widest shadow-lg">{t.veoGenerated}</div>
                  </div>
               ) : (
                 <div className="w-full max-w-[450px]">
                    <CoverCanvas 
                      ref={coverCanvasRef}
                      imageSrc={coverImage} 
                      metadata={metadata} 
                      isLoading={isLoading && generatedImages.length === 0 && step !== AppStep.VIDEO} // Only show canvas loader during initial gen
                      language={language}
                    />
                 </div>
               )}

               {/* Main Download Button */}
               {coverImage && !isLoading && step !== AppStep.VIDEO && (
                  <button 
                    onClick={handleDownloadFull}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-3 rounded-full font-bold shadow-lg shadow-emerald-900/40 transition-all hover:scale-105"
                  >
                    <Download size={20} /> 
                    {t.downloadBtn}
                  </button>
               )}
            </div>
        </div>

      </main>
    </div>
  );
}

export default App;