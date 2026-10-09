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
  ChevronLeft,
  ChevronRight,
  Film,
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
import { db } from '../lib/db';

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

/** Detect whether an asset ID or URL represents a thumbnail */
const isThumbnailAsset = (val: string): boolean => {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim().toLowerCase();
  if (trimmed.startsWith('thumb_') || trimmed.startsWith('thumbnail_')) return true;
  if (trimmed.includes('/thumb/') || trimmed.includes('/thumbnails/')) return true;
  if (/[-_.]thumb(nail)?\./i.test(trimmed)) return true;
  return false;
};

/** Convert a thumbnail asset ID to its original full-size asset ID */
const toOriginalAssetId = (val: string): string => {
  if (!val || typeof val !== 'string') return val;
  const trimmed = val.trim();
  if (trimmed.startsWith('thumb_')) {
    return 'img_' + trimmed.slice(6);
  }
  return trimmed;
};

/** Detect whether a string value represents an image URL or image asset */
const isImageCandidate = (val: string, uploadedMeta?: Record<string, { mimeType?: string } | undefined>) => {
  if (!val || typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (trimmed.length > 5000) return false;
  if (isThumbnailAsset(trimmed) && !trimmed.startsWith('thumb_')) return false;
  if (uploadedMeta?.[trimmed]?.mimeType?.startsWith('image/')) return true;
  if (trimmed.startsWith('data:image/')) return true;
  if (trimmed.startsWith('blob:') && (trimmed.includes('image') || uploadedMeta?.[trimmed]?.mimeType?.startsWith('image/'))) return true;
  if (trimmed.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp|avif|jfif)(\?.*)?$/i)) return true;
  if (trimmed.startsWith('img_') || trimmed.startsWith('thumb_')) {
    const ext = trimmed.match(/\.[a-zA-Z0-9]+$/);
    if (!ext) return true;
    return ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.avif'].includes(ext[0].toLowerCase());
  }
  return false;
};

/** Recursively gathers unique image URLs and asset IDs from workspace data */
const collectWorkspaceImages = (
  data: unknown,
  uploadedMeta: Record<string, { mimeType?: string } | undefined>
): string[] => {
  const images: string[] = [];
  const seen = new Set<string>();

  const addImage = (url: string) => {
    if (!url || typeof url !== 'string') return;
    const trimmed = url.trim();
    if (!trimmed) return;
    const norm = toOriginalAssetId(trimmed);
    if (isThumbnailAsset(norm)) return;
    if (!seen.has(norm)) {
      seen.add(norm);
      images.push(norm);
    }
  };

  let count = 0;
  const walk = (val: unknown) => {
    if (count++ > 15000) return;
    if (!val) return;

    if (typeof val === 'string') {
      if (isImageCandidate(val, uploadedMeta)) {
        addImage(val);
      }
      return;
    }

    if (Array.isArray(val)) {
      for (const item of val) walk(item);
      return;
    }

    if (typeof val === 'object') {
      const obj = val as Record<string, unknown>;
      // Exclude obj.thumbnail property so thumbnails are not collected
      const candidate = obj.url ?? obj.src ?? obj.image ?? obj.assetId ?? obj.img;
      if (typeof candidate === 'string' && isImageCandidate(candidate, uploadedMeta)) {
        addImage(candidate);
      }
      for (const k in obj) {
        if (k === 'thumbnail' || k === 'thumbnailUrl' || k === 'thumbnailId') continue;
        walk(obj[k]);
      }
    }
  };

  if (data) walk(data);

  if (uploadedMeta) {
    for (const key in uploadedMeta) {
      const meta = uploadedMeta[key];
      if (meta?.mimeType?.startsWith('image/') || isImageCandidate(key, uploadedMeta)) {
        addImage(key);
      }
    }
  }

  return images;
};

/** Traverse canvas tree nodes to find all image nodes */
const collectImagesFromTree = (node: any, seen: Set<string>, images: string[]) => {
  if (!node) return;

  const checkAndAdd = (val: unknown) => {
    if (!val || typeof val !== 'string') return;
    const trim = val.trim();
    if (isImageCandidate(trim)) {
      const norm = toOriginalAssetId(trim);
      if (!isThumbnailAsset(norm) && !seen.has(norm)) {
        seen.add(norm);
        images.push(norm);
      }
    }
  };

  if (node.rawValue && typeof node.rawValue === 'object') {
    const raw = node.rawValue as Record<string, unknown>;
    const candidate = raw.assetId || raw.assetRef || raw.url || raw.src || (raw._type === 'media' ? raw.assetId : null);
    if (typeof candidate === 'string') checkAndAdd(candidate);
  }

  if (typeof node.value === 'string') checkAndAdd(node.value);
  if (typeof node.rawValue === 'string') checkAndAdd(node.rawValue);

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      collectImagesFromTree(child, seen, images);
    }
  }
};

/** Thumbnail item rendered inside the bottom gallery strip */
const ThumbnailItem: React.FC<{
  url: string;
  index: number;
  isActive: boolean;
  onClick: () => void;
}> = ({ url, index, isActive, onClick }) => {
  const [thumbSrc, setThumbSrc] = React.useState<string | null>(null);
  const itemRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (isActive && itemRef.current) {
      itemRef.current.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [isActive]);

  React.useEffect(() => {
    let cancelled = false;
    const clean = url.split('?')[0].split('#')[0];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (clean.startsWith('img_') || clean.startsWith('thumb_')) {
      const thumbId = clean.startsWith('img_') ? clean.replace('img_', 'thumb_') : clean;
      resolveAssetUrl(thumbId).then((resolved) => {
        if (!cancelled && resolved) {
          setThumbSrc(resolved);
        } else if (!cancelled) {
          resolveAssetUrl(clean).then((resOrig) => {
            if (!cancelled && resOrig) setThumbSrc(resOrig);
          });
        }
      });
    } else if (uuidRegex.test(clean)) {
      MediaStore.getMediaUrl(clean).then((res) => {
        if (!cancelled && res) setThumbSrc(res);
      });
    } else {
      setThumbSrc(url);
    }

    return () => {
      cancelled = true;
    };
  }, [url]);

  return (
    <button
      ref={itemRef}
      type="button"
      onClick={onClick}
      className={`group relative shrink-0 overflow-hidden rounded-lg transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
        isActive
          ? 'h-11 w-11 sm:h-13 sm:w-13 ring-2 ring-indigo-500 dark:ring-sky-400 shadow-md scale-105 opacity-100 z-10'
          : 'h-9 w-9 sm:h-11 sm:w-11 opacity-55 hover:opacity-95 hover:scale-102 border border-slate-300 dark:border-white/10'
      } bg-slate-200 dark:bg-slate-800`}
      title={`Image ${index + 1}`}
      aria-label={`Image ${index + 1}`}
    >
      {thumbSrc ? (
        <img
          src={thumbSrc}
          alt={`Thumbnail ${index + 1}`}
          className="h-full w-full object-cover select-none pointer-events-none"
          loading="lazy"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-[10px] font-semibold text-slate-500 dark:text-slate-400">
          {index + 1}
        </div>
      )}
      {isActive && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-indigo-500 dark:bg-sky-400" />
      )}
    </button>
  );
};

const MediaPreviewPopup: React.FC = () => {
  const { activePreviewMedia, setActivePreviewMedia } = useStore();
  const appTheme = useStore((state) => state.appTheme);
  const isDark = appTheme === 'dark';
  const setNotification = useStore((state) => state.setNotification);
  const uploadedMediaMetadata = useStore((state) => state.uploadedMediaMetadata);
  const parsedData = useStore((state) => state.parsedData);
  const treeData = useStore((state) => state.treeData);

  const [resolvedAssetUrl, setResolvedAssetUrl] = React.useState<string | null>(null);
  const [isCopyingImage, setIsCopyingImage] = React.useState(false);
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [rotation, setRotation] = React.useState(0);
  const [assetInfo, setAssetInfo] = React.useState<{ filename?: string; size?: number } | null>(null);
  const [isUIHidden, setIsUIHidden] = React.useState(false);
  const [showThumbnails, setShowThumbnails] = React.useState(true);
  const [dbAssetImages, setDbAssetImages] = React.useState<string[]>([]);

  // Asynchronously query all stored image assets in Dexie IndexedDB
  React.useEffect(() => {
    if (activePreviewMedia?.type !== 'image') return;
    let cancelled = false;

    db.assets
      .toArray()
      .then((all) => {
        if (cancelled) return;
        // Build set of all IDs registered as thumbnails of any asset
        const thumbnailIds = new Set<string>();
        for (const a of all) {
          if (a.thumbnailId) thumbnailIds.add(a.thumbnailId);
        }

        const originals = all
          .filter((a) => {
            if (!a.assetId) return false;
            // Never add any asset that is stored as a thumbnail in IndexedDB:
            // 1. If it is referenced as another asset's thumbnailId, skip
            if (thumbnailIds.has(a.assetId)) return false;
            // 2. If its assetId starts with thumb_ or matches thumbnail patterns, skip
            if (isThumbnailAsset(a.assetId)) return false;
            // 3. If it has a thumbnail metadata flag, skip
            if ((a as any).isThumbnail || (a as any).category === 'thumbnail') return false;
            // 4. If its filename indicates a thumbnail, skip
            if (a.filename && isThumbnailAsset(a.filename)) return false;

            const isImgMime = !a.mimeType || a.mimeType.startsWith('image/');
            const isImgId = a.assetId.startsWith('img_') || /\.(jpeg|jpg|gif|png|webp|svg|bmp|avif)$/i.test(a.assetId);
            return isImgMime && isImgId;
          })
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
          .map((a) => a.assetId);

        setDbAssetImages(originals);
      })
      .catch((err) => {
        console.warn('Failed to load db assets in preview', err);
      });

    return () => {
      cancelled = true;
    };
  }, [activePreviewMedia?.type]);

  // Discover workspace images in stable, deterministic order
  const workspaceImages = React.useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];

    const addImg = (url: string) => {
      if (!url || typeof url !== 'string') return;
      const trim = url.trim();
      if (!trim) return;
      const norm = toOriginalAssetId(trim);
      if (isThumbnailAsset(norm)) return;
      if (!seen.has(norm)) {
        seen.add(norm);
        result.push(norm);
      }
    };

    // 1. Canvas treeData
    if (treeData) {
      collectImagesFromTree(treeData, seen, result);
    }

    // 2. Parsed workspace data
    if (parsedData) {
      const fromParsed = collectWorkspaceImages(parsedData, uploadedMediaMetadata);
      for (const img of fromParsed) addImg(img);
    }

    // 3. Uploaded media metadata
    if (uploadedMediaMetadata) {
      for (const k in uploadedMediaMetadata) {
        const meta = uploadedMediaMetadata[k];
        if (meta?.mimeType?.startsWith('image/') || isImageCandidate(k, uploadedMediaMetadata)) {
          addImg(k);
        }
      }
    }

    // 4. Dexie IndexedDB assets - only verified original assets
    for (const id of dbAssetImages) {
      addImg(id);
    }

    return result;
  }, [treeData, parsedData, uploadedMediaMetadata, dbAssetImages]);

  // Stable list of images for navigation and thumbnail filmstrip
  const availableImages = React.useMemo(() => {
    if (!activePreviewMedia || activePreviewMedia.type !== 'image') return [];

    // If an explicit gallery was provided (e.g. from task attachments or node gallery), preserve its exact order
    if (activePreviewMedia.gallery && activePreviewMedia.gallery.length > 0) {
      const seen = new Set<string>();
      const list: string[] = [];
      for (const item of activePreviewMedia.gallery) {
        const norm = toOriginalAssetId(item);
        if (norm && !isThumbnailAsset(norm) && !seen.has(norm)) {
          seen.add(norm);
          list.push(norm);
        }
      }
      if (list.length > 0) return list;
    }

    // Fallback: use workspaceImages in stable order, appending active image if not yet in list
    const list = [...workspaceImages];
    if (activePreviewMedia.url) {
      const curNorm = toOriginalAssetId(activePreviewMedia.url);
      if (curNorm && !isThumbnailAsset(curNorm) && !list.includes(curNorm)) {
        list.push(curNorm);
      }
    }
    return list;
  }, [activePreviewMedia?.type, activePreviewMedia?.gallery, workspaceImages]);

  const isImage = activePreviewMedia?.type === 'image';
  const hasMultipleImages = isImage && availableImages.length > 1;

  const currentIndex = React.useMemo(() => {
    if (!activePreviewMedia || availableImages.length === 0) return 0;
    const cur = activePreviewMedia.url;
    const normCur = toOriginalAssetId(cur);
    const idx = availableImages.findIndex(
      (img) => img === cur || toOriginalAssetId(img) === normCur
    );
    if (idx !== -1) return idx;
    if (
      typeof activePreviewMedia.index === 'number' &&
      activePreviewMedia.index >= 0 &&
      activePreviewMedia.index < availableImages.length
    ) {
      return activePreviewMedia.index;
    }
    return 0;
  }, [availableImages, activePreviewMedia?.url, activePreviewMedia?.index]);

  const canGoPrev = hasMultipleImages && currentIndex > 0;
  const canGoNext = hasMultipleImages && currentIndex < availableImages.length - 1;

  const goToIndex = React.useCallback(
    (targetIdx: number) => {
      if (!activePreviewMedia || targetIdx < 0 || targetIdx >= availableImages.length || targetIdx === currentIndex) {
        return;
      }
      const nextUrl = availableImages[targetIdx];
      if (nextUrl) {
        setActivePreviewMedia({
          ...activePreviewMedia,
          url: nextUrl,
          type: 'image',
          gallery: activePreviewMedia.gallery,
          index: targetIdx,
        });
      }
    },
    [availableImages, currentIndex, activePreviewMedia, setActivePreviewMedia]
  );

  const goToPrev = React.useCallback(() => {
    if (canGoPrev) {
      goToIndex(currentIndex - 1);
    }
  }, [canGoPrev, currentIndex, goToIndex]);

  const goToNext = React.useCallback(() => {
    if (canGoNext) {
      goToIndex(currentIndex + 1);
    }
  }, [canGoNext, currentIndex, goToIndex]);

  // Preload adjacent images for zero-latency switching
  React.useEffect(() => {
    if (!hasMultipleImages) return;
    const toPreload = [availableImages[currentIndex - 1], availableImages[currentIndex + 1]].filter(Boolean);

    toPreload.forEach(async (url) => {
      let resolved = url;
      const clean = url.split('?')[0].split('#')[0];
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (clean.startsWith('img_') || clean.startsWith('thumb_')) {
        const origId = await resolveOriginalAssetId(clean);
        resolved = (await resolveAssetUrl(origId)) || url;
      } else if (uuidRegex.test(clean)) {
        resolved = (await MediaStore.getMediaUrl(clean)) || url;
      }
      if (resolved) {
        const img = new window.Image();
        img.src = resolved;
      }
    });
  }, [hasMultipleImages, currentIndex, availableImages]);

  // Keyboard navigation for image gallery
  React.useEffect(() => {
    if (!hasMultipleImages) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'ArrowLeft' || e.key === 'KeyA') {
        e.preventDefault();
        goToPrev();
      } else if (e.key === 'ArrowRight' || e.key === 'KeyD') {
        e.preventDefault();
        goToNext();
      } else if (e.key === 'Home') {
        e.preventDefault();
        goToIndex(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        goToIndex(availableImages.length - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [hasMultipleImages, goToPrev, goToNext, goToIndex, availableImages.length]);

  // Resolve current active preview asset
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
  const headerMeta = [
    getReadableType(activePreviewMedia.type),
    formatBytes(metadata?.size ?? assetInfo?.size),
    host && !fileName.includes(host) ? host : null,
  ]
    .filter(Boolean)
    .join(' · ');
  const canDownload = ['image', 'video', 'pdf', '3d-model'].includes(activePreviewMedia.type);
  const isAudioPreview = activePreviewMedia.type === 'audio';
  const isDocumentPreview =
    activePreviewMedia.type === 'pdf' || activePreviewMedia.type === 'smart' || activePreviewMedia.type === '3d-model';
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
            onSwipeLeft={canGoNext ? goToNext : undefined}
            onSwipeRight={canGoPrev ? goToPrev : undefined}
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
          onKeyDown={(e) => {
            if (hasMultipleImages) {
              if (e.key === 'ArrowLeft' || e.key === 'KeyA') {
                e.preventDefault();
                goToPrev();
              } else if (e.key === 'ArrowRight' || e.key === 'KeyD') {
                e.preventDefault();
                goToNext();
              }
            }
            e.stopPropagation();
          }}
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

          {/* Header */}
          <AnimatePresence initial={false}>
            {!isUIHidden && (
              <motion.header
                key="header"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="z-50 shrink-0 overflow-hidden border-b border-slate-200 bg-white dark:border-white/7 dark:bg-[#0b0e14]"
              >
                <div className="flex h-12 items-center gap-2 sm:gap-3 px-2 sm:px-4">
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconTint}`}>{getIcon()}</div>
                  <div className="min-w-0 flex-1 leading-tight">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="truncate text-[13px] font-semibold text-slate-900 dark:text-slate-100" title={fileName}>
                        {fileName}
                      </h3>
                      {isImage && (
                        <span className="shrink-0 text-[10px] sm:text-[11px] font-semibold text-indigo-600 dark:text-sky-400 bg-indigo-50 dark:bg-sky-500/10 px-2 py-0.5 rounded-full border border-indigo-200/60 dark:border-sky-400/20 tabular-nums">
                          {currentIndex + 1} / {availableImages.length}
                        </span>
                      )}
                    </div>
                    <p className="truncate text-[11px] text-slate-500 hidden xs:block sm:block" title={isWebUrl ? sourceLabel : undefined}>
                      {headerMeta}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
                    {/* Header Previous / Next buttons */}
                    {isImage && (
                      <div className="flex items-center gap-0.5 mr-1 border-r border-slate-200 dark:border-white/10 pr-1.5">
                        <button
                          onClick={goToPrev}
                          disabled={!canGoPrev}
                          className={HEADER_BUTTON}
                          title={canGoPrev ? "Previous image (Left Arrow)" : "No previous image"}
                          aria-label="Previous image"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <button
                          onClick={goToNext}
                          disabled={!canGoNext}
                          className={HEADER_BUTTON}
                          title={canGoNext ? "Next image (Right Arrow)" : "No next image"}
                          aria-label="Next image"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    )}

                    {isImage && (
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
                          className={`${HEADER_BUTTON} hidden sm:inline-flex`}
                          title="Copy image"
                          aria-label="Copy image"
                        >
                          {isCopyingImage ? <Loader2 size={15} className="animate-spin" /> : <Copy size={15} />}
                        </button>
                        <button
                          onClick={() => setShowThumbnails((prev) => !prev)}
                          className={`${HEADER_BUTTON} ${showThumbnails ? 'text-indigo-600 dark:text-sky-400 bg-indigo-50 dark:bg-white/10' : ''}`}
                          title={showThumbnails ? 'Hide thumbnail strip' : 'Show thumbnail strip'}
                          aria-label="Toggle thumbnail strip"
                        >
                          <Film size={15} />
                          <span className="hidden xl:inline text-[11px]">Thumbnails</span>
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
                        <button onClick={copyLink} className={`${HEADER_BUTTON} hidden sm:inline-flex`} title="Copy link" aria-label="Copy link">
                          <Link2 size={15} />
                        </button>
                        <a
                          href={originalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`${HEADER_BUTTON} hidden sm:inline-flex`}
                          title="Open in new tab"
                          aria-label="Open in new tab"
                        >
                          <ExternalLink size={15} />
                        </a>
                      </>
                    )}

                    <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-white/10" aria-hidden />
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

          {/* Main Media Content Area */}
          <motion.div
            className={`relative flex min-h-0 flex-1 items-center justify-center overflow-hidden transition-all duration-300 ${
              isUIHidden || activePreviewMedia.type === 'pdf'
                ? 'p-0 bg-slate-100 dark:bg-[#07090e]'
                : isImage
                ? 'p-0 sm:px-4 sm:py-3 md:px-6 md:py-4 bg-slate-100/80 dark:bg-[#07090e]'
                : 'px-3 py-4 sm:px-6 sm:py-6 bg-slate-100/80 dark:bg-[#07090e]'
            }`}
          >
            {/* Floating Navigation Arrows for back and forth navigation (desktop/tablet) */}
            {hasMultipleImages && (
              <>
                <button
                  type="button"
                  onClick={goToPrev}
                  disabled={!canGoPrev}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-40 hidden sm:flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-slate-900/60 hover:bg-slate-900/85 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-20 disabled:pointer-events-none group"
                  title="Previous image (Left Arrow)"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={22} className="transition-transform group-hover:-translate-x-0.5" />
                </button>
                <button
                  type="button"
                  onClick={goToNext}
                  disabled={!canGoNext}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-40 hidden sm:flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-full bg-slate-900/60 hover:bg-slate-900/85 text-white backdrop-blur-md border border-white/20 shadow-xl transition-all duration-150 hover:scale-105 active:scale-95 disabled:opacity-20 disabled:pointer-events-none group"
                  title="Next image (Right Arrow)"
                  aria-label="Next image"
                >
                  <ChevronRight size={22} className="transition-transform group-hover:translate-x-0.5" />
                </button>
              </>
            )}

            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className={`flex h-full w-full items-center justify-center transition-all duration-300 ${
                isUIHidden || activePreviewMedia.type === 'pdf' || isImage
                  ? 'max-w-full'
                  : isDocumentPreview
                  ? 'max-w-[min(1480px,100%)]'
                  : 'max-w-[min(1280px,100%)]'
              }`}
            >
              <div
                className={`h-full w-full overflow-hidden transition-all duration-300 ${
                  isAudioPreview
                    ? 'bg-transparent'
                    : isUIHidden || activePreviewMedia.type === 'pdf'
                    ? 'bg-slate-100 dark:bg-[#07090e] border-0 rounded-none shadow-none'
                    : isImage
                    ? 'rounded-none sm:rounded-2xl border-0 sm:border border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-[#0c1017] sm:shadow-2xl sm:shadow-slate-200/50 dark:sm:shadow-black/60'
                    : 'rounded-2xl border border-slate-200 dark:border-slate-800/80 bg-white dark:bg-[#0c1017] shadow-2xl shadow-slate-200/50 dark:shadow-black/60'
                }`}
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

          {/* Mobile Floating Navigation Pill (Bottom Left side - matches right panel UI exactly) */}
          {isImage && hasMultipleImages && isUIHidden && (
            <div
              data-zoom-ui
              className="fixed bottom-3 left-3 z-30 sm:hidden flex items-center gap-0.5 p-1 rounded-full bg-black/65 backdrop-blur-md border border-white/10 text-white shadow-lg"
              onPointerDown={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={goToPrev}
                disabled={!canGoPrev}
                className="h-7 min-w-7 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-medium text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                title="Previous image"
                aria-label="Previous image"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="h-7 px-2 inline-flex items-center justify-center text-[11px] font-medium font-mono tabular-nums text-slate-200 select-none">
                {currentIndex + 1} / {availableImages.length}
              </span>
              <button
                type="button"
                onClick={goToNext}
                disabled={!canGoNext}
                className="h-7 min-w-7 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-medium text-slate-200 hover:text-white hover:bg-white/10 active:scale-95 disabled:opacity-35 disabled:pointer-events-none transition-colors"
                title="Next image"
                aria-label="Next image"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          {/* Bottom Thumbnail Strip for Image Galleries */}
          <AnimatePresence>
            {isImage && showThumbnails && !isUIHidden && availableImages.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="shrink-0 overflow-hidden border-t border-slate-200/90 dark:border-white/8 bg-white/95 dark:bg-[#0b0e14]/95 backdrop-blur-xl z-30"
              >
                <div className="flex items-center justify-between gap-3 px-2 sm:px-4 py-2 sm:py-2.5">
                  <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth py-0.5 min-w-0 flex-1">
                    {availableImages.map((imgUrl, idx) => (
                      <ThumbnailItem
                        key={`${imgUrl}-${idx}`}
                        url={imgUrl}
                        index={idx}
                        isActive={idx === currentIndex}
                        onClick={() => goToIndex(idx)}
                      />
                    ))}
                  </div>
                  <div className="shrink-0 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 select-none hidden sm:flex">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                      {currentIndex + 1}
                    </span>
                    <span>/</span>
                    <span>{availableImages.length}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default MediaPreviewPopup;
