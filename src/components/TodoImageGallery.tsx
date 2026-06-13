import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { importFile, resolveAssetUrl } from "../utils/assetManager";
import { Image as ImageIcon, X, Trash2, Camera, MoveVertical, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { CameraCaptureModal } from "./CameraCaptureModal";
import { motion, AnimatePresence } from "motion/react";
import { TransformWrapper, TransformComponent } from "react-zoom-pan-pinch";

interface TodoTaskProps {
  imageHashes?: string[];
  onChange?: (newHashes: string[]) => void;
  readOnly?: boolean;
}

export function TodoImageGallery({ imageHashes = [], onChange, readOnly }: TodoTaskProps) {
  const [urls, setUrls] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [hasCamera, setHasCamera] = useState(false);

  useEffect(() => {
    // Check if camera API is supported
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      setHasCamera(true);
    }
  }, []);

  useEffect(() => {
    let unmounted = false;
    const loadOriginalsOrThumbs = async () => {
      const resolving = imageHashes.map(hash => resolveAssetUrl(hash));
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    addFiles(files);
  };

  const addFiles = async (files: File[]) => {
    if (readOnly || !onChange) return;
    const imagesOnly = files.filter(f => f.type.startsWith('image/'));
    
    // Process imports
    const newHashes = [...imageHashes];
    for (const file of imagesOnly) {
      try {
         const { assetId } = await importFile(file);
         if (!newHashes.includes(assetId)) {
             newHashes.push(assetId);
         }
      } catch (err) {
         console.error('Failed to import file', err);
      }
    }
    onChange(newHashes);
  };

  const handleCameraCapture = (file: File) => {
    addFiles([file]);
  };

  const handlePaste = async (e: ClipboardEvent) => {
    if (readOnly || !onChange) return;
    const items = Array.from(e.clipboardData?.items || []);
    const files = items.map(item => item.getAsFile()).filter(f => f !== null) as File[];
    if (files.length > 0) {
       addFiles(files);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    if (readOnly || !onChange) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
       addFiles(files);
    }
  };

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => {
      document.removeEventListener("paste", handlePaste);
    };
  }, [imageHashes, readOnly]);

  const removeImage = (index: number) => {
    if (readOnly || !onChange) return;
    const newHashes = [...imageHashes];
    newHashes.splice(index, 1);
    onChange(newHashes);
  };

  if (!imageHashes || imageHashes.length === 0) {
    if (readOnly) return null;
    return (
      <div className="w-full mt-4 flex flex-col gap-2">
        <div 
          className="w-full flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700/50 rounded-xl p-6 bg-slate-50/50 dark:bg-slate-900/20 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => document.getElementById("hidden-file-input")?.click()}
        >
           <ImageIcon size={24} className="mb-2 opacity-50" />
           <span className="text-xs font-semibold">Drop images here or click to upload</span>
           <span className="text-[10px] opacity-70">Supports JPG, PNG, GIF, clipboard paste</span>
           <input type="file" multiple id="hidden-file-input" className="hidden" accept="image/*" onChange={handleFileSelect} />
        </div>
        {hasCamera && (
          <button 
            className="w-full flex items-center justify-center gap-2 py-3 border border-slate-300 dark:border-slate-700/50 rounded-xl bg-white dark:bg-slate-800 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
            onClick={() => setShowCamera(true)}
          >
            <Camera size={16} />
            Take Photo
          </button>
        )}
        {showCamera && <CameraCaptureModal onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}
      </div>
    );
  }

  // Large gallery
  return (
    <div className="w-full mt-4 flex flex-col gap-3">
       
       <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
         <span className="flex items-center gap-1.5"><ImageIcon size={12} className="opacity-70" /> Attachments</span>
       </div>

       <div 
          className="grid grid-cols-2 lg:grid-cols-3 gap-2"
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
       >
         {urls.map((url, i) => (
            url ? (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700/50 shadow-sm group">
                <img src={url} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-300 cursor-pointer" alt={`attachment ${i}`} onClick={() => { setIsFullscreen(true); setFullscreenIndex(i); setSlideDirection(0); }} />
                {!readOnly && (
                  <button onClick={() => removeImage(i)} className="absolute top-1 right-1 p-1.5 bg-black/50 hover:bg-red-500 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
            ) : (
              <div key={i} className="aspect-square bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
            )
         ))}
         
         {!readOnly && (
           <>
             <div 
               className="aspect-square rounded-xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700/50 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors flex items-center justify-center flex-col text-slate-500"
               onClick={() => document.getElementById("hidden-file-input-add")?.click()}
             >
                <div className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full mb-1">
                   <ImageIcon size={16} />
                </div>
                <span className="text-[10px] font-semibold uppercase tracking-wider">Add Image</span>
                <input type="file" multiple id="hidden-file-input-add" className="hidden" accept="image/*" onChange={handleFileSelect} />
             </div>
             {hasCamera && (
               <div 
                 className="aspect-square rounded-xl overflow-hidden border border-slate-300 dark:border-slate-700/50 cursor-pointer bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-center flex-col text-slate-500 shadow-sm"
                 onClick={() => setShowCamera(true)}
               >
                  <div className="p-3 bg-slate-100 dark:bg-slate-700/50 rounded-full mb-1">
                     <Camera size={16} />
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider">Take Photo</span>
               </div>
             )}
           </>
         )}
       </div>

       {showCamera && <CameraCaptureModal onClose={() => setShowCamera(false)} onCapture={handleCameraCapture} />}

       {isFullscreen && createPortal(
          <div 
             className="fixed inset-0 z-[99999] bg-black flex items-center justify-center backdrop-blur-md"
          >
             <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setIsFullscreen(false)} />
             <button onClick={() => setIsFullscreen(false)} className="absolute top-4 right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors z-50">
               <X size={20} />
             </button>

             <div className="relative w-full h-full flex items-center justify-center overflow-hidden z-40">
                <AnimatePresence initial={false} custom={slideDirection}>
                   <motion.div
                      key={fullscreenIndex}
                      custom={slideDirection}
                      variants={{
                         enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 300 : -300 }),
                         center: { opacity: 1, x: 0 },
                         exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -300 : 300 })
                      }}
                      initial="enter"
                      animate="center"
                      exit="exit"
                      transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      className="absolute inset-0 flex items-center justify-center p-0 md:p-8"
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={1}
                      onDragEnd={(e, { offset, velocity }) => {
                         const swipe = offset.x;
                         if (swipe < -50 && fullscreenIndex < urls.length - 1) {
                            setSlideDirection(1);
                            setFullscreenIndex(i => i + 1);
                         } else if (swipe > 50 && fullscreenIndex > 0) {
                            setSlideDirection(-1);
                            setFullscreenIndex(i => i - 1);
                         }
                      }}
                   >
                     {urls[fullscreenIndex] && (
                        <TransformWrapper
                           initialScale={1}
                           minScale={0.5}
                           maxScale={5}
                           centerOnInit
                           wheel={{ step: 0.1 }}
                        >
                           <TransformComponent wrapperClass="w-full h-full flex items-center justify-center" contentClass="w-full h-full flex items-center justify-center">
                              <img src={urls[fullscreenIndex]} className="max-w-full max-h-full object-contain drop-shadow-2xl md:rounded-lg select-none pointer-events-auto" draggable={false} alt={`fullscreen ${fullscreenIndex}`} />
                           </TransformComponent>
                        </TransformWrapper>
                     )}
                   </motion.div>
                </AnimatePresence>

                {/* Desktop Navigation Arrows */}
                {urls.length > 1 && fullscreenIndex > 0 && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); setSlideDirection(-1); setFullscreenIndex(i => i - 1); }} 
                     className="absolute left-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors z-50 hidden md:block"
                   >
                     <ChevronLeft size={24} />
                   </button>
                )}
                {urls.length > 1 && fullscreenIndex < urls.length - 1 && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); setSlideDirection(1); setFullscreenIndex(i => i + 1); }} 
                     className="absolute right-4 p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-colors z-50 hidden md:block"
                   >
                     <ChevronRight size={24} />
                   </button>
                )}
             </div>

             {urls.length > 1 && (
               <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/50 backdrop-blur-md rounded-full border border-white/10 z-50" onClick={e => e.stopPropagation()}>
                  {urls.map((u, i) => (
                    <button key={i} onClick={() => { setSlideDirection(i > fullscreenIndex ? 1 : -1); setFullscreenIndex(i); }} className={cn("w-2 h-2 rounded-full transition-all", i === fullscreenIndex ? "bg-white scale-125" : "bg-white/30 hover:bg-white/50")} />
                  ))}
               </div>
             )}
          </div>,
          document.body
       )}
    </div>
  );
}

