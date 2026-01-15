import React, { forwardRef } from 'react';
import { BookMetadata, Language, TRANSLATIONS } from '../types';

interface CoverCanvasProps {
  imageSrc: string | null;
  metadata: BookMetadata;
  isLoading: boolean;
  language: Language;
}

const CoverCanvas = forwardRef<HTMLDivElement, CoverCanvasProps>(({ imageSrc, metadata, isLoading, language }, ref) => {
  const t = TRANSLATIONS[language];

  return (
    // Outer Container: UI Styling (Shadows, Borders, Rounded corners for display)
    <div className="relative w-full max-w-[400px] aspect-[9/16] bg-slate-800 rounded-lg shadow-2xl overflow-hidden group mx-auto border-4 border-slate-900">
      
      {/* Loading Overlay */}
      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 z-30">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-emerald-500 mb-4"></div>
          <p className="text-emerald-400 font-mono text-sm animate-pulse">{t.designing}</p>
        </div>
      ) : null}

      {/* Empty State */}
      {!imageSrc && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-500 z-20">
          <p>{t.noCover}</p>
        </div>
      )}

      {/* Actual Print Area - This is what gets captured by html2canvas */}
      {/* We apply the ref here to capture strictly the image and text, ignoring the UI border/rounding if we wanted strict rectangles */}
      <div ref={ref} className="relative w-full h-full bg-slate-900">
        {imageSrc && (
          <>
            <img 
              src={imageSrc} 
              alt="Generated Book Cover" 
              className="absolute inset-0 w-full h-full object-cover z-0"
              // Ensure cross-origin images work if they come from external URLs, though here they are base64
              crossOrigin="anonymous"
            />
            
            {/* Overlay Layout - Optimized for readability */}
            <div className="absolute inset-0 z-10 flex flex-col justify-between">
              
              {/* Top Section: Title & Subtitle with protection gradient */}
              <div className="flex flex-col items-center text-center space-y-2 pt-8 pb-12 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-6">
                <h1 className="text-4xl md:text-5xl font-bold text-white font-serif-title leading-tight drop-shadow-xl tracking-wide break-words w-full">
                  {metadata.title}
                </h1>
                {metadata.subtitle && (
                  <h2 className="text-lg md:text-xl text-yellow-50 font-cinzel tracking-wider drop-shadow-lg max-w-[95%]">
                    {metadata.subtitle}
                  </h2>
                )}
              </div>

              {/* Middle Section: Kept Empty for Subject */}
              <div className="flex-grow"></div>

              {/* Bottom Section: Author & Description */}
              <div className="flex flex-col items-center pb-6 pt-12 bg-gradient-to-t from-black/90 via-black/50 to-transparent px-6">
                 {metadata.description && (
                    <p className="text-xs md:text-sm text-white/90 font-medium italic drop-shadow-md text-center mb-3 max-w-[90%]">
                      "{metadata.description}"
                    </p>
                 )}
                 <div className="border-t border-white/50 w-16 mb-3"></div>
                 <p className="text-white text-sm tracking-[0.2em] font-medium uppercase drop-shadow-md">
                  {metadata.author}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
});

export default CoverCanvas;