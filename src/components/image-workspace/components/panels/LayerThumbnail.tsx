import React, { useEffect, useState } from 'react';
import { Layers, Image as ImageIcon, Type, Brush, Square, Circle } from 'lucide-react';
import * as fabric from 'fabric';

interface LayerThumbnailProps {
   layer: fabric.Object;
   sizePx: number;
}

export const LayerThumbnail: React.FC<LayerThumbnailProps> = ({ layer, sizePx }) => {
   const [previewUrl, setPreviewUrl] = useState<string | null>(null);

   useEffect(() => {
      let isMounted = true;
      
      const generateThumbnail = () => {
         try {
            // Check if it's an image and has a direct src we can use
            if (layer.type === 'image' && (layer as any).getElement) {
               const el = (layer as any).getElement();
               if (el && el.src && !el.src.startsWith('blob:')) {
                  // If it's a regular url or base64, we can just use it directly for max performance
                  setPreviewUrl(el.src);
                  return;
               }
            }
            
            // Otherwise generate a data url
            // Calculate a safe multiplier to generate a roughly 64px image
            const maxDim = Math.max(layer.width || 100, layer.height || 100);
            const scale = layer.scaleX || 1;
            const actualDim = maxDim * scale;
            let multiplier = 64 / actualDim;
            if (multiplier > 1) multiplier = 1; // Don't upscale
            
            const url = layer.toDataURL({
               format: 'png',
               multiplier: multiplier
            });
            
            if (isMounted && url) {
               setPreviewUrl(url);
            }
         } catch (e) {
            console.warn("Failed to generate layer thumbnail", e);
         }
      };

      // Generate initially
      generateThumbnail();

      // Listen for modifications if layer supports it
      const onChange = () => {
         // Debounce could be added here if it's too heavy
         generateThumbnail();
      };
      
      layer.on('modified', onChange);
      
      return () => {
         isMounted = false;
         layer.off('modified', onChange);
      };
   }, [layer]);

   if (previewUrl) {
      return (
         <div 
            className="flex items-center justify-center rounded overflow-hidden shrink-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIj48L3JlY3Q+CjxyZWN0IHdpZHRoPSI0IiBoZWlnaHQ9IjQiIGZpbGw9IiNjY2MiPjwvcmVjdD4KPHJlY3QgeD0iNCIgeT0iNCIgd2lkdGg9IjQiIGhlaWdodD0iNCIgZmlsbD0iI2NjYyI+PC9yZWN0Pgo8L3N2Zz4=')] bg-slate-100 dark:bg-white/5 shadow-inner border border-slate-200 dark:border-white/10"
            style={{ width: sizePx, height: sizePx }}
         >
            <img 
               src={previewUrl} 
               alt="layer preview" 
               className="max-w-full max-h-full object-contain drop-shadow-md"
               style={{ width: 'auto', height: 'auto' }}
            />
         </div>
      );
   }

   // Fallback icons
   const iconSize = Math.max(12, Math.min(24, sizePx * 0.6));
   
   return (
      <div 
         className="flex items-center justify-center shrink-0 opacity-60 bg-slate-100 dark:bg-white/5 rounded border border-transparent"
         style={{ width: sizePx, height: sizePx }}
      >
         {layer.type === 'image' ? <ImageIcon size={iconSize} /> :
           layer.type === 'i-text' || layer.type === 'text' || layer.type === 'textbox' ? <Type size={iconSize} /> : 
           layer.type === 'path' ? <Brush size={iconSize} /> :
           layer.type === 'rect' ? <Square size={iconSize} /> :
           layer.type === 'circle' ? <Circle size={iconSize} /> :
           <Layers size={iconSize} />}
      </div>
   );
};
