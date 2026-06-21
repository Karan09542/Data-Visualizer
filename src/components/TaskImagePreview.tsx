import React, { useState, useEffect } from "react";
import { resolveAssetUrl } from "../utils/assetManager";
import { Image as ImageIcon, PlayCircle, Music, X } from "lucide-react";

export function TaskImagePreview({ 
  imageHashes = [], 
  compact = true,
  onDelete,
  onPreview
}: { 
  imageHashes?: string[], 
  compact?: boolean,
  onDelete?: (index: number) => void,
  onPreview?: (index: number) => void
}) {
  const [urls, setUrls] = useState<string[]>([]);
  
  useEffect(() => {
    let unmounted = false;
    const loadOriginalsOrThumbs = async () => {
      const resolving = imageHashes.map(async hash => {
        if (compact && hash.startsWith("img_")) {
          const thumbUrl = await resolveAssetUrl(hash.replace("img_", "thumb_"));
          if (thumbUrl) return thumbUrl;
        }
        return resolveAssetUrl(hash);
      });
      const loaded = await Promise.all(resolving);
      if (!unmounted) {
        setUrls(loaded);
      }
    };
    if (imageHashes && imageHashes.length > 0) {
      loadOriginalsOrThumbs();
    } else {
      setUrls((prev) => prev.length === 0 ? prev : []);
    }
    return () => { unmounted = true; };
  }, [imageHashes ? imageHashes.join(",") : ""]);

  if (!imageHashes || imageHashes.length === 0) return null;

  const isVideo = (url: string) => {
     return url.includes('#file.mp4') || url.includes('#file.webm') || url.includes('#file.mov') || url.startsWith('data:video');
  };

  const isAudio = (url: string) => {
    return url.includes('#file.mp3') || url.includes('#file.wav') || url.includes('#file.ogg') || url.includes('#file.m4a') || url.startsWith('data:audio');
  };

  const renderMedia = (url: string, i: number, isCompact: boolean) => {
    const content = (() => {
      if (isVideo(url) && !url.match(/#file\.(jpg|jpeg|png|gif|webp)$/i)) {
        return (
           <div className="w-full h-full relative">
              <video src={url} className="w-full h-full object-cover select-none" muted playsInline />
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                 <PlayCircle className="text-white/80 w-6 h-6 drop-shadow-md" />
              </div>
           </div>
        );
      }
      if (isAudio(url)) {
        return (
          <div className="w-full h-full flex flex-col items-center justify-center bg-amber-500/10 gap-1 p-2">
            <Music size={isCompact ? 24 : 32} className="text-amber-500" />
            {!isCompact && <audio src={url} controls className="w-full h-8 scale-90" onClick={(e) => e.stopPropagation()} />}
          </div>
        );
      }
      return <img src={url} className="w-full h-full object-cover select-none" alt={isCompact ? `attachment ${i+1}` : "attachment"} />;
    })();

    return (
      <div className="w-full h-full relative group/mediaitem" key={i}>
        {content}
        {!isCompact && onDelete && (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(i);
            }}
            className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-lg opacity-0 group-hover/mediaitem:opacity-100 transition-opacity shadow-lg hover:bg-rose-600 active:scale-95"
          >
            <X size={14} strokeWidth={3} />
          </button>
        )}
      </div>
    );
  };

  if (compact) {
    if (imageHashes.length === 1) {
      return (
        <div className="mt-1 w-full max-w-[200px] h-[100px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/50 relative shadow-sm shrink-0">
          {urls[0] ? renderMedia(urls[0], 0, false) : (
            <div className="w-full h-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
          )}
        </div>
      );
    } else {
      // Carousel / Multi-image (max 3)
      const previewUrls = urls.slice(0, 3);
      
      return (
        <div className="mt-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[220px]">
          {previewUrls.map((url, i) => (
             url ? (
               <div key={i} className="relative w-14 h-14 rounded-md overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700/50">
                 {renderMedia(url, i, true)}
                 {i === 2 && imageHashes.length > 3 && (
                   <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[12px] font-bold">
                     +{imageHashes.length - 3}
                   </div>
                 )}
               </div>
             ) : (
               <div key={i} className="w-14 h-14 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-md shrink-0" />
             )
          ))}
        </div>
      );
    }
  }

  // Large gallery
  return (
    <div className="w-full grid gap-2 grid-cols-2 mt-2">
      {urls.map((url, i) => (
         url ? (
           <div 
             key={i} 
             onClick={() => onPreview && onPreview(i)}
             className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50 shadow-sm cursor-pointer group"
           >
             {renderMedia(url, i, false)}
           </div>
         ) : (
           <div key={i} className="aspect-video bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
         )
      ))}
    </div>
  );
}
