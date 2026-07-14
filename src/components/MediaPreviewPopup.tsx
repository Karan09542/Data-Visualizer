import React from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  Music,
  Video,
  X,
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
  const {
    activePreviewMedia,
    setActivePreviewMedia,
    setNotification,
    uploadedMediaMetadata,
  } = useStore();

  const [resolvedAssetUrl, setResolvedAssetUrl] = React.useState<string | null>(null);
  const [isCopyingImage, setIsCopyingImage] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);

  React.useEffect(() => {
    if (!activePreviewMedia?.url) {
      setResolvedAssetUrl(null);
      return;
    }

    let cancelled = false;
    const { url } = activePreviewMedia;

    if (url.startsWith('img_') || url.startsWith('thumb_')) {
      setResolvedAssetUrl(null);
      resolveAssetUrl(url).then((resolved) => {
        if (!cancelled) setResolvedAssetUrl(resolved);
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
      case 'pdf': return <FileText size={20} />;
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
        <div className="h-full w-full overflow-hidden rounded-xl border border-slate-700/70 bg-slate-900 shadow-2xl">
          {resolvedAssetUrl === null && originalUrl.startsWith('img_') ? (
            <div className="flex w-full h-full justify-center items-center text-slate-500">Loading asset...</div>
          ) : (
            <PdfViewer url={resolvedUrl} />
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
          <div className="w-full h-full p-2 flex items-center justify-center [&>div]:w-full [&>div]:h-full [&>div>iframe]:w-full [&>div>iframe]:h-full [&>div>iframe]:rounded-lg [&>div>img]:max-w-full [&>div>img]:max-h-full [&>div>img]:object-contain [&>div>img]:rounded-lg [&>div>video]:max-w-full [&>div>video]:max-h-full [&>div>video]:rounded-lg">
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
          <div className="z-50 flex min-h-[68px] items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-indigo-300">
                {getIcon()}
              </div>
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h3 className="truncate text-sm font-semibold text-white sm:text-base">{fileName}</h3>
                  <span className="hidden shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 sm:inline-flex">
                    {getReadableType(activePreviewMedia.type)}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{sourceLabel}</p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              {activePreviewMedia.type === 'image' && (
                <>
                  <button
                    onClick={copyImage}
                    disabled={isCopyingImage || isResolvingAsset}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-indigo-400/60 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Copy image"
                  >
                    {isCopyingImage ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
                    <span className="hidden sm:inline">Copy image</span>
                  </button>
                  <button
                    onClick={downloadCurrentImage}
                    disabled={isDownloading || isResolvingAsset}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-indigo-400/60 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    title="Download image"
                  >
                    {isDownloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                    <span className="hidden sm:inline">Download</span>
                  </button>
                </>
              )}
              <button
                onClick={copySource}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 transition-colors hover:border-indigo-400/60 hover:bg-slate-800"
                title="Copy source"
              >
                <ExternalLink size={15} />
                <span className="hidden lg:inline">Copy source</span>
              </button>
              <button
                onClick={() => setActivePreviewMedia(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900 text-slate-300 transition-colors hover:border-rose-400/50 hover:bg-rose-500/10 hover:text-white"
                title="Close preview"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_center,rgba(30,41,59,0.42),transparent_46%)] px-3 py-4 sm:px-6 sm:py-6">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={`flex h-full w-full items-center justify-center ${isDocumentPreview ? 'max-w-[min(1480px,100%)]' : 'max-w-[min(1280px,100%)]'}`}
            >
              <div
                className={`h-full w-full overflow-hidden ${isAudioPreview ? 'bg-transparent' : 'rounded-xl border border-slate-800 bg-slate-950/80 shadow-2xl shadow-black/30'}`}
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
          </div>

          <div className="z-50 flex min-h-[44px] items-center justify-between gap-4 border-t border-slate-800 bg-slate-950/95 px-4 py-2 text-xs text-slate-500 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1 text-slate-400">
                <Check size={13} className="text-emerald-400" />
                Ready
              </span>
              <span className="hidden truncate sm:inline">{sourceLabel}</span>
            </div>
            {metadataItems.length > 0 && (
              <div className="hidden shrink-0 items-center gap-2 sm:flex">
                {metadataItems.map((item) => (
                  <span key={item} className="rounded-md border border-slate-800 bg-slate-900 px-2.5 py-1">
                    {item}
                  </span>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MediaPreviewPopup;
