import React from 'react';
import { createPortal } from 'react-dom';
import {
  Box,
  Copy,
  Download,
  ExternalLink,
  Globe,
  FileText,
  Image as ImageIcon,
  Link2,
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
import { getAssetBlob, getOriginalAsset, resolveAssetUrl, resolveOriginalAssetId } from '../utils/assetManager';
import { downloadBlob, downloadImage, withImageExtension } from '../utils/downloadUtils';
import { MediaStore } from './notes/storage/MediaStore';

const getFileName = (url: string) => {
  const cleanUrl = url.split('?')[0].split('#')[0];
  const lastPart = cleanUrl.split('/').pop() || cleanUrl;
  return decodeURIComponent(lastPart || 'media-preview');
};

/** "youtube.com/watch?v=…" rather than "watch": the last path segment alone rarely names a page */
const getWebTitle = (url: string) => {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() || '';
    if (/\.[a-z0-9]{2,5}$/i.test(last)) return decodeURIComponent(last);
    const v = u.searchParams.get('v');
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '')}${v ? `?v=${v}` : ''}`;
  } catch {
    return getFileName(url);
  }
};

const getReadableType = (type: string) => {
  if (type === '3d-model') return '3D model';
  if (type === 'pdf') return 'PDF';
  if (type === 'smart') return 'Web';
  return type.charAt(0).toUpperCase() + type.slice(1);
};

const formatBytes = (bytes?: number) => {
  if (!bytes) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

/** Plain header action: just an icon, with a label only where it earns the room */
const HEADER_BUTTON =
  'inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-md px-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:pointer-events-none disabled:opacity-40 dark:text-slate-400 dark:hover:bg-white/7 dark:hover:text-white';

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
  const { activePreviewMedia, setActivePreviewMedia } = useStore();
  const appTheme = useStore(state => state.appTheme);
  const isDark = appTheme === "dark";
  const setNotification = useStore((state) => state.setNotification);
  const uploadedMediaMetadata = useStore((state) => state.uploadedMediaMetadata);

  const [resolvedAssetUrl, setResolvedAssetUrl] = React.useState<string | null>(null);
  const [isCopyingImage, setIsCopyingImage] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [rotation, setRotation] = React.useState(0);
  const [assetInfo, setAssetInfo] = React.useState<{ filename?: string; size?: number } | null>(null);
  const [isUIHidden, setIsUIHidden] = React.useState(false);

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

    setAssetInfo(null);
    if (cleanUrl.startsWith('img_') || cleanUrl.startsWith('thumb_')) {
      setResolvedAssetUrl(null);
      getOriginalAsset(cleanUrl).then((asset) => {
        if (!cancelled && asset) setAssetInfo({ filename: asset.filename, size: asset.size });
      });
      // Canvas nodes show a small thumbnail: preview (and copy, and save) the original it came from.
      resolveOriginalAssetId(cleanUrl)
        .then((id) => resolveAssetUrl(id))
        .then((resolved) => {
          if (!cancelled) setResolvedAssetUrl(resolved || null);
        });
    } else if (uuidRegex.test(cleanUrl)) {
      setResolvedAssetUrl(null);
      MediaStore.getMediaUrl(cleanUrl).then((resolved) => {
        if (!cancelled && resolved) setResolvedAssetUrl(resolved);
      });
    } else {
      setResolvedAssetUrl(null);
    }

    if (activePreviewMedia.type === 'audio') {
      const fileName = uploadedMediaMetadata[url]?.filename || getFileName(url);
      const openAudioPlayer = async () => {
        let finalSrc = url;
        if (cleanUrl.startsWith('img_') || cleanUrl.startsWith('thumb_')) {
          finalSrc = (await resolveAssetUrl(url)) || url;
        } else if (uuidRegex.test(cleanUrl)) {
          finalSrc = (await MediaStore.getMediaUrl(cleanUrl)) || url;
        }

        const { db } = await import('../lib/db');
        const existingTrack = await db.audio_tracks.get(url);

        const track: any = existingTrack || {
          id: url,
          title: fileName,
          artist: 'Workspace Audio',
          source: finalSrc,
          type: 'audio/mpeg',
          createdAt: Date.now(),
        };

        const { useAudioStore } = await import('../audio/stores/audioStore');
        const { audioEngine } = await import('../audio/services/audioEngine');
        useAudioStore.getState().playTrackNow(track);
        audioEngine.playTrack(track);
        setActivePreviewMedia(null);
      };

      openAudioPlayer();
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
  const isWebUrl = /^https?:\/\//i.test(originalUrl);
  const fileName =
    metadata?.filename ||
    assetInfo?.filename ||
    (isWebUrl && activePreviewMedia.type === 'smart' ? getWebTitle(originalUrl) : getFileName(originalUrl));
  const sourceLabel = originalUrl.length > 80 ? `${originalUrl.slice(0, 77)}...` : originalUrl;
  let host: string | null = null;
  try {
    if (isWebUrl) host = new URL(originalUrl).hostname.replace(/^www\./, '');
  } catch {
    host = null;
  }
  // One quiet line under the name: what it is, how big, where it is from
  const headerMeta = [getReadableType(activePreviewMedia.type), formatBytes(metadata?.size ?? assetInfo?.size), host && !fileName.includes(host) ? host : null]
    .filter(Boolean)
    .join(' · ');
  const canDownload = ['image', 'video', 'pdf', '3d-model'].includes(activePreviewMedia.type);
  const isAudioPreview = activePreviewMedia.type === 'audio';
  const isDocumentPreview = activePreviewMedia.type === 'pdf' || activePreviewMedia.type === 'smart' || activePreviewMedia.type === '3d-model';
  const metadataItems = [
    getReadableType(activePreviewMedia.type),
    metadata?.mimeType,
    metadata?.size ? `${(metadata.size / 1024).toFixed(1)} KB` : null,
  ].filter((item): item is string => Boolean(item));

  // Only offered for web addresses: an uploaded file's id means nothing outside this app
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(originalUrl);
      setNotification({ message: 'Link copied', type: 'success' });
    } catch {
      setNotification({ message: 'Could not copy the link', type: 'error' });
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
      let success = false;
      const cleanId = originalUrl.split('?')[0].split('#')[0];
      if (cleanId.startsWith('img_') || cleanId.startsWith('thumb_')) {
        // A stored image: save the original file exactly as it was added, never the thumbnail.
        const original = await getOriginalAsset(cleanId);
        const blob = original ? await getAssetBlob(original.assetId) : null;
        if (blob) {
          downloadBlob(blob, withImageExtension(original?.filename || fileName, blob.type || original?.mimeType));
          success = true;
        }
      }
      if (!success) success = await downloadImage(resolvedUrl, fileName);
      setNotification({
        message: success ? 'Image downloaded' : 'Failed to download image',
        type: success ? 'success' : 'error',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  /** Saves the original file - for uploads the stored file itself, never a thumbnail */
  const downloadOriginal = async () => {
    if (activePreviewMedia.type === 'image') return downloadCurrentImage();
    if (isResolvingAsset) return;
    setIsDownloading(true);
    try {
      const cleanId = originalUrl.split('?')[0].split('#')[0];
      let blob: Blob | null = null;
      let name = fileName;
      if (cleanId.startsWith('img_') || cleanId.startsWith('thumb_')) {
        const original = await getOriginalAsset(cleanId);
        blob = original ? await getAssetBlob(original.assetId) : null;
        name = original?.filename || fileName;
      }
      if (!blob) {
        try {
          const response = await fetch(resolvedUrl);
          if (response.ok) blob = await response.blob();
        } catch {
          // Cross-origin without CORS: handled below
        }
      }
      if (blob) {
        downloadBlob(blob, name);
      } else if (isWebUrl) {
        // The page can't read it, but the browser can still fetch it in a new tab
        window.open(originalUrl, '_blank', 'noopener');
      } else {
        setNotification({ message: 'Could not download this file', type: 'error' });
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const getIcon = () => {
    switch (activePreviewMedia?.type) {
      case 'image': return <ImageIcon size={16} />;
      case 'video': return <Video size={16} />;
      case 'audio': return <Music size={16} />;
      case 'pdf': return <FileText size={16} />;
      case 'smart': return <Globe size={16} />;
      case '3d-model': return <Box size={16} />;
      default: return <Maximize2 size={16} />;
    }
  };

  /** A soft tint per kind of file, so the type reads at a glance without a badge */
  const iconTint =
    ({
      image: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
      video: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
      audio: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
      pdf: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      smart: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      '3d-model': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    } as Record<string, string>)[activePreviewMedia.type] ?? 'bg-slate-500/10 text-slate-600 dark:text-slate-400';

  const renderContent = () => {
    const { type } = activePreviewMedia;

    if (type === 'image') {
      return (
        <div className="w-full h-full flex items-center justify-center pointer-events-auto">
          <InteractiveZoomImage
            src={resolvedUrl}
            alt={fileName}
            rotation={rotation}
            enableCoordinates
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

      const handleOpenWorkspace = async () => {
        const track: any = {
          id: originalUrl,
          title: fileName,
          artist: 'Workspace Audio',
          source: resolvedUrl,
          type: 'audio/mpeg',
          createdAt: Date.now(),
        };
        const { useAudioStore } = await import('../audio/stores/audioStore');
        const { audioEngine } = await import('../audio/services/audioEngine');
        useAudioStore.getState().setQueue([track]);
        useAudioStore.getState().setQueueIndex(0);
        useAudioStore.getState().setCurrentTrack(track);
        audioEngine.playTrack(track);
        useAudioStore.getState().setIsPlayerOpen(true);
        setActivePreviewMedia(null);
      };

      return (
        <div className="flex h-full w-full items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl shadow-slate-200/50 dark:shadow-black/60">
            <div className="flex items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 px-5 py-5 sm:px-6">
              <div className="flex min-w-0 items-center gap-3.5">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300 shadow-sm">
                  <Music size={24} />
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-base font-semibold text-slate-900 dark:text-white">{fileName}</p>
                    <span className="shrink-0 rounded-md border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
                      Audio
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{sourceLabel}</p>
                </div>
              </div>

              <button
                onClick={handleOpenWorkspace}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/40 px-3.5 py-2 text-xs font-semibold text-cyan-700 dark:text-cyan-200 transition-all hover:bg-cyan-100 dark:hover:bg-cyan-900/50 active:scale-95 shadow-sm"
              >
                <Maximize2 size={14} />
                Audio Workspace
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              <div className="flex h-24 items-end gap-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-950 px-4 py-4">
                {waveformBars.map((height, index) => (
                  <span
                    key={index}
                    className="flex-1 rounded-t bg-cyan-500/60 dark:bg-cyan-300/70"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3">
                <SmartFallbackMedia
                  type="audio"
                  src={originalUrl}
                  controls
                  className="h-11 w-full"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                {metadataItems.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                    {metadataItems.map((item) => (
                      <span key={item} className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 px-2.5 py-1 font-medium">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={handleOpenWorkspace}
                  className="sm:hidden inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-50 dark:bg-cyan-950/40 px-3 py-1.5 text-xs font-semibold text-cyan-700 dark:text-cyan-200"
                >
                  <Maximize2 size={13} />
                  Open Workspace
                </button>
              </div>
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
            <PdfViewer url={resolvedUrl} fileName={fileName} isDark={isDark} />
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
          className="fixed inset-0 z-[20000] flex flex-col bg-slate-100/95 dark:bg-[#07090e] text-slate-900 dark:text-slate-100 backdrop-blur-xl"
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* With the header hidden, two small buttons stay in the corner */}
          <AnimatePresence>
            {isUIHidden && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="absolute right-3 top-3 z-[20050] flex items-center gap-0.5 rounded-lg border border-slate-200 bg-white/90 p-0.5 shadow-lg backdrop-blur-md dark:border-white/10 dark:bg-[#0d1118]/90"
              >
                <button onClick={() => setIsUIHidden(false)} className={HEADER_BUTTON} title="Show header" aria-label="Show header">
                  <ChevronDown size={16} />
                </button>
                <button onClick={() => setActivePreviewMedia(null)} className={HEADER_BUTTON} title="Close" aria-label="Close preview">
                  <X size={16} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence initial={false}>
            {!isUIHidden && (
              <motion.header
                key="header"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="z-50 shrink-0 overflow-hidden border-b border-slate-200 bg-white dark:border-white/7 dark:bg-[#0b0e14]"
              >
                <div className="flex h-12 items-center gap-3 pl-3 pr-2 sm:pl-4">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconTint}`}>{getIcon()}</div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <h3 className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100" title={fileName}>
                      {fileName}
                    </h3>
                    <p className="truncate text-[11px] text-slate-500" title={isWebUrl ? sourceLabel : undefined}>
                      {headerMeta}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center">
                    {activePreviewMedia.type === 'image' && (
                      <>
                        <button
                          onClick={() => setRotation((prev) => (prev + 90) % 360)}
                          disabled={isResolvingAsset}
                          className={HEADER_BUTTON}
                          title="Rotate"
                          aria-label="Rotate image"
                        >
                          <RotateCw size={15} />
                        </button>
                        <button
                          onClick={copyImage}
                          disabled={isCopyingImage || isResolvingAsset}
                          className={HEADER_BUTTON}
                          title="Copy image"
                          aria-label="Copy image"
                        >
                          {isCopyingImage ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
                        </button>
                      </>
                    )}
                    {canDownload && (
                      <button
                        onClick={downloadOriginal}
                        disabled={isDownloading || isResolvingAsset}
                        className={HEADER_BUTTON}
                        title="Download"
                        aria-label="Download"
                      >
                        {isDownloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                        <span className="hidden md:inline">Download</span>
                      </button>
                    )}
                    {isWebUrl && (
                      <>
                        <button onClick={copyLink} className={HEADER_BUTTON} title="Copy link" aria-label="Copy link">
                          <Link2 size={15} />
                        </button>
                        <a
                          href={originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={HEADER_BUTTON}
                          title="Open in new tab"
                          aria-label="Open in new tab"
                        >
                          <ExternalLink size={15} />
                        </a>
                      </>
                    )}

                    <span className="mx-1.5 h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden />
                    <button onClick={() => setIsUIHidden(true)} className={HEADER_BUTTON} title="Hide header" aria-label="Hide header">
                      <ChevronUp size={16} />
                    </button>
                    <button
                      onClick={() => setActivePreviewMedia(null)}
                      className={`${HEADER_BUTTON} hover:bg-rose-500/10 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400`}
                      title="Close"
                      aria-label="Close preview"
                    >
                      <X size={17} />
                    </button>
                  </div>
                </div>
              </motion.header>
            )}
          </AnimatePresence>

          <motion.div className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden transition-all duration-300 ${isUIHidden || activePreviewMedia.type === 'pdf' ? 'p-0 sm:p-0 bg-slate-100 dark:bg-[#07090e]' : 'bg-slate-100/80 dark:bg-[#07090e] px-3 py-4 sm:px-6 sm:py-6'}`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={`flex h-full w-full items-center justify-center transition-all duration-300 ${isUIHidden || activePreviewMedia.type === 'pdf' ? 'max-w-full' : isDocumentPreview ? 'max-w-[min(1480px,100%)]' : 'max-w-[min(1280px,100%)]'}`}
            >
              <div
                className={`h-full w-full overflow-hidden transition-all duration-300 ${isAudioPreview ? 'bg-transparent' : isUIHidden || activePreviewMedia.type === 'pdf' ? 'bg-slate-100 dark:bg-[#07090e] border-0 rounded-none shadow-none' : 'rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c1017] shadow-2xl shadow-slate-200/50 dark:shadow-black/60'}`}
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
