import React from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Copy,
  Download,
  ExternalLink,
  Globe,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Music,
  Video,
  X,
  RotateCw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import { InteractiveZoomImage } from './InteractiveZoomImage';
import SmartMediaRenderer from './SmartMediaRenderer';
import { SmartFallbackMedia } from './SmartFallbackMedia';
import { PdfViewer } from './PdfViewer';
import { SafeModelViewer } from './SafeModelViewer';
import { resolveAssetUrl } from '../utils/assetManager';
import { downloadImage } from '../utils/downloadUtils';
import { MediaStore } from './notes/storage/MediaStore';

const getFileName = (url: string) => {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const lastPart = cleanUrl.split('/').pop() || cleanUrl;
  return decodeURIComponent(lastPart || 'media-preview');
};

const getReadableType = (type: string) => {
  if (type === '3d-model') return '3D model';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const getBlobForClipboard = async (url: string) => {
  const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
  if (!response.ok) throw new Error('Unable to load image');
  const sourceBlob = await response.blob();

  if (sourceBlob.type === 'image/png') {
    return sourceBlob;
  }

  const imageBitmap = await createImageBitmap(sourceBlob);
  const canvas = document.createElement('canvas');
  canvas.width = imageBitmap.width;
  canvas.height = imageBitmap.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Unable to prepare image');
  context.drawImage(imageBitmap, 0, 0);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Unable to convert image'));
    }, 'image/png');
  });
};

const MediaPreviewPopup: React.FC = () => {
  const activePreviewMedia = useStore((state) => state.activePreviewMedia);
  const setActivePreviewMedia = useStore((state) => state.setActivePreviewMedia);
  const setNotification = useStore((state) => state.setNotification);
  const uploadedMediaMetadata = useStore((state) => state.uploadedMediaMetadata);

  const [resolvedAssetUrl, setResolvedAssetUrl] = React.useState<string | null>(null);
  const [isCopyingImage, setIsCopyingImage] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [rotation, setRotation] = React.useState(0);
  const [isUIHidden, setIsUIHidden] = React.useState(false);
  const [pdfAlignment, setPdfAlignment] = React.useState<'top' | 'center'>('top');

  React.useEffect(() => {
    if (!activePreviewMedia?.url) {
      setResolvedAssetUrl(null);
      setRotation(0);
      return;
    }

    setRotation(0);

    let cancelled = false;
    const { url } = activePreviewMedia;
    const cleanUrl = url.split('?')[0].split('#')[0];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (cleanUrl.startsWith('img_') || cleanUrl.startsWith('thumb_')) {
      setResolvedAssetUrl(null);
      resolveAssetUrl(url).then((resolved) => {
        if (!cancelled) setResolvedAssetUrl(resolved);
      });
    } else if (uuidRegex.test(cleanUrl)) {
      setResolvedAssetUrl(null);
      MediaStore.getMediaUrl(cleanUrl).then((resolved) => {
        if (!cancelled && resolved) setResolvedAssetUrl(resolved);
      });
    } else {
      setResolvedAssetUrl(null);
    }

    return () => {
      cancelled = true;
    };
  }, [activePreviewMedia?.url]);

  if (!activePreviewMedia) return null;

  const originalUrl = activePreviewMedia.url;
  const resolvedUrl = resolvedAssetUrl || originalUrl;
  const isResolvingAsset =
    (originalUrl.startsWith('img_') || originalUrl.startsWith('thumb_')) && resolvedAssetUrl === null;
  const metadata = uploadedMediaMetadata[originalUrl] || uploadedMediaMetadata[resolvedUrl];
  const fileName = metadata?.filename || getFileName(originalUrl);
  const sourceLabel = originalUrl.length > 80 ? `${originalUrl.slice(0, 77)}...` : originalUrl;
  const isAudioPreview = activePreviewMedia.type === 'audio';
  const isDocumentPreview = activePreviewMedia.type === 'pdf' || activePreviewMedia.type === 'smart' || activePreviewMedia.type === '3d-model';
  const metadataItems = [
    getReadableType(activePreviewMedia.type),
    metadata?.mimeType,
    metadata?.size ? `${(metadata.size / 1024).toFixed(1)} KB` : null,
  ].filter((item): item is string => Boolean(item));

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(originalUrl);
      setNotification({ message: 'Source copied to clipboard', type: 'success' });
    } catch {
      setNotification({ message: 'Failed to copy source', type: 'error' });
    }
  };

  const copyImage = async () => {
    if (activePreviewMedia.type !== 'image' || isResolvingAsset) return;

    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
      setNotification({ message: 'Image clipboard is not supported in this browser', type: 'error' });
      return;
    }

    setIsCopyingImage(true);
    try {
      const blob = await getBlobForClipboard(resolvedUrl);
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || 'image/png']: blob }),
      ]);
      setNotification({ message: 'Image copied to clipboard', type: 'success' });
    } catch (error) {
      console.error('Failed to copy image:', error);
      setNotification({ message: 'Failed to copy image', type: 'error' });
    } finally {
      setIsCopyingImage(false);
    }
  };

  const downloadCurrentImage = async () => {
    if (activePreviewMedia.type !== 'image' || isResolvingAsset) return;

    setIsDownloading(true);
    try {
      const success = await downloadImage(resolvedUrl, fileName);
      setNotification({
        message: success ? 'Image downloaded' : 'Failed to download image',
        type: success ? 'success' : 'error',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const getIcon = () => {
    switch (activePreviewMedia?.type) {
      case 'image': return <ImageIcon size={20} />;
      case 'video': return <Video size={20} />;
      case 'audio': return <Music size={20} />;
      case 'pdf': return <span className="font-black text-[12px] tracking-widest mt-[1px] ml-[1px]">PDF</span>;
      case 'smart': return <Globe size={20} />;
      case '3d-model': return <Box size={20} />;
      default: return <Maximize2 size={20} />;
    }
  };

  const renderContent = () => {
    const { type } = activePreviewMedia;

    if (type === 'image') {
      return (
        <div className="w-full h-full flex items-center justify-center pointer-events-auto">
          <InteractiveZoomImage
            src={resolvedUrl}
            alt={fileName}
            rotation={rotation}
            className="w-full h-full max-w-full max-h-full object-contain rounded-md shadow-xl"
          />
        </div>
      );
    }

    if (type === 'video') {
      return (
        <div className="relative w-full h-full flex items-center justify-center">
          <SmartFallbackMedia
            type="video"
            src={originalUrl}
            controls
            autoPlay
            className="max-w-full max-h-full rounded-lg shadow-xl border border-white/10"
          />
        </div>
      );
    }

    if (type === 'audio') {
      const waveformBars = [34, 58, 42, 76, 50, 88, 44, 66, 38, 72, 54, 84, 46, 62, 36, 70, 48, 80];

      return (
        <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900 shadow-2xl shadow-black/50">
            <div className="flex items-center gap-4 border-b border-slate-800 bg-slate-900 px-5 py-5 sm:px-6">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-indigo-400/25 bg-indigo-500/15 text-indigo-200">
                <Music size={28} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-base font-semibold text-slate-50">{fileName}</p>
                  <span className="shrink-0 rounded-md border border-indigo-400/25 bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-200">
                    Audio
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{sourceLabel}</p>
              </div>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex h-24 items-end gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-4 py-4">
                {waveformBars.map((height, index) => (
                  <span
                    key={index}
                    className="flex-1 rounded-t bg-indigo-300/75"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>

              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <SmartFallbackMedia
                  type="audio"
                  src={originalUrl}
                  controls
                  className="h-11 w-full accent-indigo-400"
                />
              </div>

              {metadataItems.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {metadataItems.map((item) => (
                    <span key={item} className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1">
                      {item}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }

    if (type === 'pdf') {
      return (
        <div className="h-full w-full overflow-hidden">
          {resolvedAssetUrl === null && originalUrl.startsWith('img_') ? (
            <div className="flex w-full h-full justify-center items-center text-slate-500">Loading asset...</div>
          ) : (
            <PdfViewer url={resolvedUrl} alignment={pdfAlignment} />
          )}
        </div>
      );
    }

    if (type === '3d-model') {
      return (
        <div className="relative h-full w-full flex items-center justify-center overflow-hidden rounded-xl border border-slate-700/70 bg-slate-950/60 shadow-2xl">
          {resolvedAssetUrl === null && originalUrl.startsWith('img_') ? (
            <div className="flex w-full h-full justify-center items-center text-slate-500 text-xs">Loading 3D asset...</div>
          ) : (
            <SafeModelViewer
              src={resolvedUrl}
              autoRotate
              cameraControls
              showControls
              style={{ width: '100%', height: '100%', backgroundColor: 'transparent' }}
            />
          )}
        </div>
      );
    }

    if (type === 'smart') {
      return (
        <div className="h-full w-full flex items-center justify-center overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900/60 shadow-2xl">
          <div className="w-full h-full flex items-center justify-center [&>div]:w-full [&>div]:h-full [&>div>iframe]:w-full [&>div>iframe]:h-full [&>div>iframe]:rounded-xl [&>div>img]:max-w-full [&>div>img]:max-h-full [&>div>img]:object-contain [&>div>img]:rounded-xl [&>div>video]:max-w-full [&>div>video]:max-h-full [&>div>video]:rounded-xl">
            <SmartMediaRenderer
              url={originalUrl}
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

  return createPortal(
    <AnimatePresence>
      {activePreviewMedia && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[20000] flex flex-col bg-slate-950 text-slate-100"
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* FLOATING CONTROLS WHEN UI IS HIDDEN */}
          <AnimatePresence>
            {isUIHidden && (
              <>
                <motion.button
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 0.3, y: 0 }}
                  whileHover={{ opacity: 1 }}
                  exit={{ opacity: 0, y: -20 }}
                  onClick={() => setIsUIHidden(false)}
                  className="absolute top-4 left-1/2 -translate-x-1/2 z-[20050] flex items-center gap-2 rounded-full border border-slate-700/80 bg-slate-900/90 px-4 py-2 text-sm font-medium text-slate-300 shadow-2xl backdrop-blur-md transition-colors hover:bg-slate-800 hover:text-white"
                >
                  <ChevronDown size={16} />
                  Show Header
                </motion.button>
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 0.3, scale: 1 }}
                  whileHover={{ opacity: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  onClick={() => setActivePreviewMedia(null)}
                  className="absolute top-4 right-4 z-[20050] flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/90 text-slate-400 shadow-2xl backdrop-blur-md transition-all hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-500/50"
                >
                  <X size={20} />
                </motion.button>
              </>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {!isUIHidden && (
              <motion.div
                key="header"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="z-50 shrink-0 border-b border-slate-800 bg-slate-950/95 overflow-hidden"
              >
                <div className="flex min-h-[48px] sm:min-h-[56px] items-center justify-between gap-2.5 px-3 py-1.5 sm:px-5 sm:py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg border ${activePreviewMedia.type === 'pdf' ? 'border-rose-500/40 bg-rose-500/15 text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.15)]' : 'border-slate-700 bg-slate-900 text-indigo-300'}`}>
                      {getIcon()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <h3 className="truncate text-xs font-semibold text-white sm:text-sm">{fileName}</h3>
                        <span className="hidden shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:inline-flex">
                          {getReadableType(activePreviewMedia.type)}
                        </span>
                      </div>
                      <p className="hidden sm:block truncate text-[11px] text-slate-400">{sourceLabel}</p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {activePreviewMedia.type === 'image' && (
                      <div className="flex items-center gap-0.5 rounded-lg border border-slate-700/80 bg-slate-900/60 p-1 shadow-sm">
                        <button
                          onClick={() => setRotation((prev) => (prev + 90) % 360)}
                          disabled={isResolvingAsset}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/50 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Rotate image"
                        >
                          <RotateCw size={14} />
                          <span className="hidden sm:inline">Rotate</span>
                        </button>
                        <button
                          onClick={copyImage}
                          disabled={isCopyingImage || isResolvingAsset}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/50 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Copy image"
                        >
                          {isCopyingImage ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                          <span className="hidden sm:inline">Copy image</span>
                        </button>
                        <button
                          onClick={downloadCurrentImage}
                          disabled={isDownloading || isResolvingAsset}
                          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/50 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
                          title="Download image"
                        >
                          {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                          <span className="hidden sm:inline">Download</span>
                        </button>
                      </div>
                    )}

                    {activePreviewMedia.type !== 'pdf' && activePreviewMedia.type !== 'image' && (
                      <button
                        onClick={copySource}
                        className="inline-flex h-8 items-center gap-2 rounded-md border border-slate-700/80 bg-slate-900/60 px-3 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700/50 hover:text-slate-100"
                        title="Copy source"
                      >
                        <ExternalLink size={14} />
                        <span className="hidden sm:inline">Copy source</span>
                      </button>
                    )}

                    {activePreviewMedia.type === 'pdf' && (
                      <button
                        onClick={() => setPdfAlignment(prev => prev === 'top' ? 'center' : 'top')}
                        className={`inline-flex h-8 items-center justify-center rounded-md border border-slate-700/80 px-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors ${pdfAlignment === 'center' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/50' : 'bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
                        title="Toggle PDF Alignment"
                      >
                        {pdfAlignment === 'top' ? 'Align: Top' : 'Align: Ctr'}
                      </button>
                    )}

                    <button
                      onClick={() => setIsUIHidden(true)}
                      className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/60 text-slate-400 transition-all hover:bg-slate-800 hover:text-slate-100"
                      title="Hide Header"
                    >
                      <ChevronUp size={16} />
                    </button>

                    <button
                      onClick={() => setActivePreviewMedia(null)}
                      className="inline-flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full border border-slate-700/80 bg-slate-900/60 text-slate-400 transition-all hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
                      title="Close preview"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden transition-all duration-300 ${isUIHidden || activePreviewMedia.type === 'pdf' ? 'p-0 sm:p-0 bg-slate-950' : 'bg-[radial-gradient(circle_at_center,rgba(30,41,59,0.42),transparent_46%)] px-3 py-4 sm:px-6 sm:py-6'}`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={`flex h-full w-full items-center justify-center transition-all duration-300 ${isUIHidden || activePreviewMedia.type === 'pdf' ? 'max-w-full' : isDocumentPreview ? 'max-w-[min(1480px,100%)]' : 'max-w-[min(1280px,100%)]'}`}
            >
              <div
                className={`h-full w-full overflow-hidden transition-all duration-300 ${isAudioPreview ? 'bg-transparent' : isUIHidden || activePreviewMedia.type === 'pdf' ? 'bg-slate-950 border-0 rounded-none shadow-none' : 'rounded-xl border border-slate-800 bg-slate-950/80 shadow-2xl shadow-black/30'}`}
              >
                {isResolvingAsset ? (
                  <div className="flex h-full w-full items-center justify-center gap-3 text-sm text-slate-400">
                    <Loader2 size={18} className="animate-spin text-indigo-300" />
                    Loading media...
                  </div>
                ) : (
                  renderContent()
                )}
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MediaPreviewPopup;
