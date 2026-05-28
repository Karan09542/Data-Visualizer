import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, ZoomIn, ZoomOut, RotateCcw, Maximize2, Download, Music, Video, Image as ImageIcon, FileText, Globe, Move, Box } from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { TransformWrapper, TransformComponent, ReactZoomPanPinchRef } from 'react-zoom-pan-pinch';
import SmartMediaRenderer from './SmartMediaRenderer';
import { SmartFallbackMedia } from './SmartFallbackMedia';

const MediaPreviewPopup: React.FC = () => {
  const { activePreviewMedia, setActivePreviewMedia } = useStore();
  const transformComponentRef = useRef<ReactZoomPanPinchRef>(null);

  if (!activePreviewMedia) return null;

  const handleZoomIn = () => transformComponentRef.current?.zoomIn(0.5);
  const handleZoomOut = () => transformComponentRef.current?.zoomOut(0.5);
  const handleReset = () => transformComponentRef.current?.resetTransform();

  const renderContent = () => {
    const { url, type } = activePreviewMedia;

    if (type === 'image') {
      return (
        <div className="w-full h-full flex items-center justify-center overflow-hidden relative group/image">
          <TransformWrapper
            ref={transformComponentRef}
            initialScale={1}
            centerOnInit={true}
            minScale={0.1}
            maxScale={8}
            wheel={{ step: 0.1 }}
          >
            <TransformComponent 
              wrapperStyle={{ width: '100%', height: '100%' }}
              contentStyle={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <SmartFallbackMedia 
                type="image"
                src={url} 
                alt="Preview" 
                className="max-w-full max-h-[90vh] object-contain shadow-2xl rounded-lg"
                draggable={false}
              />
            </TransformComponent>
          </TransformWrapper>
          
          {/* Zoom Overlay Info */}
          <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-4 px-4 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/10 text-white/60 text-[10px] font-mono tracking-widest pointer-events-none opacity-0 group-hover/image:opacity-100 transition-opacity z-50">
            <Move size={12} />
            PAN & ZOOM ENABLED
          </div>
        </div>
      );
    }

    if (type === 'video') {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          <SmartFallbackMedia
            type="video" 
            src={url} 
            controls 
            autoPlay
            className="max-w-[95%] max-h-[95%] rounded-lg shadow-2xl border border-white/5"
          />
        </div>
      );
    }

    if (type === 'audio') {
      return (
        <div className="flex flex-col items-center gap-8 p-16 bg-slate-900/80 rounded-[2.5rem] border border-slate-700/50 backdrop-blur-2xl shadow-2xl ring-1 ring-white/5">
          <div className="w-40 h-40 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 rounded-full flex items-center justify-center shadow-inner relative overflow-hidden group">
            <div className="absolute inset-0 bg-indigo-500/10 animate-ping opacity-20" />
            <Music size={80} className="relative z-10 group-hover:scale-110 transition-transform duration-500" />
          </div>
          <div className="space-y-4 w-full">
            <SmartFallbackMedia type="audio" src={url} controls className="w-full sm:w-[450px]" />
            <p className="text-slate-400 font-mono text-xs truncate max-w-[400px] text-center opacity-60">
              {url.split('/').pop()}
            </p>
          </div>
        </div>
      );
    }

    if (type === 'pdf') {
      return (
        <div className="w-[95%] h-[92%] bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl ring-1 ring-white/10">
          <iframe 
            src={url} 
            className="w-full h-full border-0" 
            title="PDF Preview"
          />
        </div>
      );
    }

    if (type === '3d-model') {
      const ModelViewer = 'model-viewer' as any;
      return (
        <div className="relative w-[95%] h-[95%] max-w-7xl flex items-center justify-center bg-transparent rounded-2xl overflow-hidden shadow-2xl">
          <ModelViewer
            src={url}
            auto-rotate
            camera-controls
            style={{ width: "100%", height: "100%", backgroundColor: "transparent" }}
          ></ModelViewer>
        </div>
      );
    }

    if (type === 'smart') {
      return (
        <div className="w-[95%] h-[92%] max-w-7xl flex items-center justify-center bg-slate-900/40 rounded-3xl border border-slate-700/50 overflow-hidden shadow-2xl backdrop-blur-sm">
          <div className="w-full h-full p-2 sm:p-4 flex items-center justify-center [&>div]:w-full [&>div]:h-full [&>div>iframe]:w-full [&>div>iframe]:h-full [&>div>iframe]:rounded-2xl [&>div>img]:max-w-full [&>div>img]:max-h-full [&>div>img]:object-contain [&>div>img]:rounded-2xl [&>div>video]:max-w-full [&>div>video]:max-h-full [&>div>video]:rounded-2xl">
            <SmartMediaRenderer 
              url={url} 
              onResolvedType={(detected, actualUrl) => {
                if (detected === 'image') {
                  setActivePreviewMedia({ url: actualUrl, type: 'image' });
                } else if (detected === 'video' || detected === 'audio') {
                  setActivePreviewMedia({ url: actualUrl, type: detected });
                }
              }} 
            />
          </div>
        </div>
      );
    }

    return null;
  };

  const getIcon = () => {
    switch (activePreviewMedia?.type) {
      case 'image': return <ImageIcon size={20} />;
      case 'video': return <Video size={20} />;
      case 'audio': return <Music size={20} />;
      case 'pdf': return <FileText size={20} />;
      case 'smart': return <Globe size={20} />;
      case '3d-model': return <Box size={20} />;
      default: return <Maximize2 size={20} />;
    }
  };

  return createPortal(
    <AnimatePresence>
      {activePreviewMedia && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[10001] flex flex-col bg-slate-950/95 backdrop-blur-xl group"
        >
          {/* Top Header */}
          <div className="flex items-center justify-between px-8 py-6 bg-gradient-to-b from-slate-900/80 to-transparent z-50">
            <div className="flex items-center gap-5">
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/20 shadow-lg shadow-indigo-500/5">
                {getIcon()}
              </div>
              <div className="hidden md:block">
                <h3 className="text-white font-bold tracking-tight text-lg">Media Intelligence</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-1 uppercase tracking-[0.2em] truncate max-w-[400px]">
                  SOURCE: {activePreviewMedia.url}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {['image'].includes(activePreviewMedia.type) && (
                <div className="flex items-center bg-slate-900/60 backdrop-blur-md rounded-2xl border border-slate-700/50 p-1.5 shadow-xl mr-4">
                  <button onClick={handleZoomOut} className="p-2.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all" title="Zoom Out">
                    <ZoomOut size={20} />
                  </button>
                  <div className="w-[1px] h-5 bg-slate-700/50 mx-1" />
                  <button onClick={handleZoomIn} className="p-2.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all" title="Zoom In">
                    <ZoomIn size={20} />
                  </button>
                  <div className="w-[1px] h-5 bg-slate-700/50 mx-1" />
                  <button onClick={handleReset} className="p-2.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-xl transition-all" title="Reset Zoom">
                    <RotateCcw size={20} />
                  </button>
                </div>
              )}
              
              <button
                onClick={() => setActivePreviewMedia(null)}
                className="group/close relative p-3 bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-white rounded-2xl border border-slate-700/50 hover:border-slate-500 transition-all shadow-xl backdrop-blur-md"
              >
                <X size={24} />
                <span className="absolute -bottom-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-800 text-slate-200 text-[10px] font-medium tracking-wider rounded border border-slate-700 opacity-0 group-hover/close:opacity-100 transition-all transform pointer-events-none whitespace-nowrap shadow-lg">CLOSE</span>
              </button>
            </div>
          </div>

          {/* Main Viewer Space */}
          <div className="flex-1 flex items-center justify-center overflow-hidden relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full h-full flex items-center justify-center"
            >
              {renderContent()}
            </motion.div>
          </div>

          {/* Footer Metadata */}
          <div className="px-8 py-6 bg-gradient-to-t from-slate-900/80 to-transparent flex justify-between items-center text-[10px] text-slate-500 font-mono tracking-[0.3em] font-bold z-50">
            <div className="flex items-center gap-6">
              <span className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                SECURE STREAM
              </span>
              <span className="hidden sm:inline border-l border-slate-800 pl-6 h-3 flex items-center">
                TYPE: {activePreviewMedia.type.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span className="animate-pulse">LIVE VIEW</span>
              <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)]" />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MediaPreviewPopup;
