import React, { useState, useEffect } from "react";
import { resolveAssetUrl } from "../utils/assetManager";
import { Image as ImageIcon } from "lucide-react";

export function TaskImagePreview({ imageHashes = [], compact = true }: { imageHashes?: string[], compact?: boolean }) {
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

  if (compact) {
    if (imageHashes.length === 1) {
      return (
        <div className="mt-1 w-full max-w-[200px] h-[100px] rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700/50 relative shadow-sm shrink-0">
          {urls[0] ? (
            <img src={urls[0]} className="w-full h-full object-cover select-none" alt="attachment" />
          ) : (
            <div className="w-full h-full bg-slate-100 dark:bg-slate-800 animate-pulse" />
          )}
        </div>
      );
    } else {
      // Carousel / Multi-image
      return (
        <div className="mt-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-[220px]">
          {urls.map((url, i) => (
             url ? (
               <div key={i} className="relative w-14 h-14 rounded-md overflow-hidden shrink-0 border border-slate-200 dark:border-slate-700/50">
                 <img src={url} className="w-full h-full object-cover select-none" alt={`attachment ${i+1}`} />
                 {i === urls.length - 1 && imageHashes.length > urls.length && (
                   <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white text-[10px] font-bold">
                     +{imageHashes.length - urls.length}
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
           <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50 shadow-sm cursor-pointer group">
             <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300" alt={`attachment ${i}`} />
           </div>
         ) : (
           <div key={i} className="aspect-video bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
         )
      ))}
    </div>
  );
}
