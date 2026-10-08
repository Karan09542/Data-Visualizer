import type {
  EditorConfig,
  LexicalEditor,
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  DOMExportOutput,
} from 'lexical';
import {
  DecoratorNode,
  $getNodeByKey,
  $createParagraphNode,
  $getRoot,
} from 'lexical';
import React, { useState, useRef, useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { Youtube, ExternalLink, Trash2, Copy, Check, Pencil, X } from 'lucide-react';

export type YouTubeSize = 'sm' | 'md' | 'full';

export type SerializedYouTubeNode = Spread<
  {
    videoId: string;
    url?: string;
    size?: YouTubeSize;
  },
  SerializedLexicalNode
>;

/**
 * Extracts the 11-character YouTube video ID from various YouTube URL formats
 * (watch?v=, youtu.be/, shorts/, embed/, live/, mobile, timestamped, etc.)
 */
export function extractYouTubeId(urlOrText: string): string | null {
  if (!urlOrText) return null;
  const trimmed = urlOrText.trim();
  const match = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^&\s]*&)*v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i
  );
  return match ? match[1] : null;
}

/**
 * Extracts start time in seconds from YouTube URL if present (e.g. ?t=120, ?t=1m30s)
 */
export function extractYouTubeStartTime(url: string): number | null {
  if (!url) return null;
  try {
    const fullUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
    const parsed = new URL(fullUrl);
    const t = parsed.searchParams.get('t') || parsed.searchParams.get('start');
    if (t) {
      let totalSeconds = 0;
      const hMatch = t.match(/(\d+)h/i);
      const mMatch = t.match(/(\d+)m/i);
      const sMatch = t.match(/(\d+)s/i);
      if (hMatch || mMatch || sMatch) {
        if (hMatch) totalSeconds += parseInt(hMatch[1], 10) * 3600;
        if (mMatch) totalSeconds += parseInt(mMatch[1], 10) * 60;
        if (sMatch) totalSeconds += parseInt(sMatch[1], 10);
        return totalSeconds;
      }
      const num = parseInt(t, 10);
      if (!isNaN(num)) return num;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Extracts or builds a clean canonical YouTube URL
 */
export function extractYouTubeUrl(urlOrText: string, videoId: string): string {
  if (!urlOrText) return `https://www.youtube.com/watch?v=${videoId}`;
  const match = urlOrText.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?[^\s"'>]+|embed\/[^\s"'>]+|shorts\/[^\s"'>]+|live\/[^\s"'>]+)|youtu\.be\/[^\s"'>]+)/i
  );
  if (match) {
    const found = match[0].replace(/[.,;:!?]+$/, '');
    return found.startsWith('http://') || found.startsWith('https://') ? found : `https://${found}`;
  }
  return `https://www.youtube.com/watch?v=${videoId}`;
}

interface YouTubeComponentProps {
  videoId: string;
  url?: string;
  size?: YouTubeSize;
  nodeKey: NodeKey;
}

function YouTubeComponent({ videoId, url, size: initialSize = 'full', nodeKey }: YouTubeComponentProps) {
  const [editor] = useLexicalComposerContext();
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState<YouTubeSize>(initialSize);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isEditing, setIsEditing] = useState(!videoId);
  const [inputValue, setInputValue] = useState(url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''));
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const isEditable = editor.isEditable();

  const targetUrl = url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
  const startTime = targetUrl ? extractYouTubeStartTime(targetUrl) : null;
  const embedSrc = videoId ? `https://www.youtube.com/embed/${videoId}?rel=0${startTime ? `&start=${startTime}` : ''}` : '';

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleCopyUrl = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!targetUrl) return;
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if (node) {
        node.remove();
        const root = $getRoot();
        if (root.getChildrenSize() === 0) {
          root.append($createParagraphNode());
        }
      }
    });
  };

  const handleSizeChange = (newSize: YouTubeSize) => {
    setSize(newSize);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isYouTubeNode(node)) {
        node.setSize(newSize);
      }
    });
  };

  const handleEmbedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed) {
      setError('Please enter a YouTube video URL or ID.');
      return;
    }
    const extractedId = extractYouTubeId(trimmed);
    if (!extractedId) {
      setError('Invalid YouTube link or ID. Please check and try again.');
      return;
    }

    const fullUrl = extractYouTubeUrl(trimmed, extractedId);
    editor.update(() => {
      const node = $getNodeByKey(nodeKey);
      if ($isYouTubeNode(node)) {
        node.setVideoId(extractedId);
        node.setUrl(fullUrl);
      }
    });
    setIsEditing(false);
    setError('');
  };

  const handleCancel = () => {
    if (!videoId) {
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node) {
          node.remove();
          const root = $getRoot();
          if (root.getChildrenSize() === 0) {
            root.append($createParagraphNode());
          }
        }
      });
    } else {
      setIsEditing(false);
      setInputValue(targetUrl);
      setError('');
    }
  };

  // Inline card when adding or editing URL (non-blocking, matching sticky note theme)
  if (isEditing) {
    return (
      <div
        className="my-3 w-full max-w-xl mx-auto border border-black/8 dark:border-white/12 bg-white/95 dark:bg-[#1c1c1f]/95 p-4 select-none rounded-2xl shadow-[0_16px_36px_-12px_rgba(0,0,0,0.35)] backdrop-blur-xl"
        contentEditable={false}
      >
        <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-black/6 dark:border-white/10">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white font-bold shadow-xs">
              <Youtube size={13} className="fill-current" />
            </div>
            <span className="font-semibold text-xs tracking-wide text-black/85 dark:text-white/90 whitespace-nowrap">
              {videoId ? 'Edit YouTube Video' : 'Embed YouTube Video'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="flex h-7 w-7 items-center justify-center text-black/45 hover:text-black/85 dark:text-white/45 dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            title="Cancel"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={handleEmbedSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              if (error) setError('');
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                handleCancel();
              }
            }}
            placeholder="Paste YouTube link or ID (e.g. youtu.be/...)"
            className="flex-1 min-w-0 h-9 px-3 text-xs bg-black/3 dark:bg-white/5 border border-black/8 dark:border-white/12 focus:border-red-600/70 dark:focus:border-red-500/70 focus:bg-white dark:focus:bg-[#121214] outline-none text-black dark:text-white placeholder-black/35 dark:placeholder-white/35 rounded-xl transition-all shadow-inner"
            autoFocus
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="submit"
              className="h-9 px-3.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-sm transition-colors cursor-pointer whitespace-nowrap active:scale-[0.98]"
            >
              {videoId ? 'Update Video' : 'Embed Video'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="h-9 px-3 text-xs border border-black/8 dark:border-white/12 hover:bg-black/5 dark:hover:bg-white/8 text-black/70 dark:text-white/70 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>
          </div>
        </form>

        {error && (
          <p className="mt-2 text-[11px] text-red-600 dark:text-red-400 font-medium">
            {error}
          </p>
        )}
      </div>
    );
  }

  // Live video player frame with rounded corners and sticky note theme
  const sizeClasses =
    size === 'sm'
      ? 'max-w-[380px]'
      : size === 'md'
      ? 'max-w-[560px]'
      : 'w-full max-w-full';

  return (
    <div
      className="my-3 flex flex-col group/yt relative select-none w-full"
      contentEditable={false}
    >
      <div
        className={`relative overflow-hidden rounded-2xl bg-white/95 dark:bg-[#1c1c1f]/95 border border-black/8 dark:border-white/12 ${sizeClasses} mx-auto shadow-[0_12px_32px_-12px_rgba(0,0,0,0.25)] backdrop-blur-md transition-all`}
      >
        {/* Header bar with controls */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-black/[0.02] dark:bg-white/[0.03] border-b border-black/6 dark:border-white/10 text-xs text-black/80 dark:text-white/80 select-none min-w-0 flex-nowrap overflow-hidden">
          {/* Left badge & videoId */}
          <div className="flex items-center gap-2 min-w-0 flex-nowrap shrink overflow-hidden">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-red-600 text-white font-bold shadow-xs">
              <Youtube size={12} className="fill-current" />
            </div>
            <span className="font-semibold text-[11px] tracking-wide text-black/85 dark:text-white/90 whitespace-nowrap shrink-0">
              YouTube
            </span>
            <span className="font-mono text-[10px] text-black/40 dark:text-white/40 truncate min-w-0 shrink">
              {videoId}
            </span>
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-1 shrink-0 flex-nowrap">
            {/* Segmented Size Switcher with rounded pills */}
            <div className="flex items-center p-0.5 bg-black/4 dark:bg-white/6 border border-black/6 dark:border-white/10 text-[10px] font-medium rounded-lg gap-0.5">
              <button
                type="button"
                onClick={() => handleSizeChange('sm')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  size === 'sm'
                    ? 'bg-white dark:bg-[#2a2a2e] font-semibold text-black dark:text-white shadow-xs'
                    : 'text-black/55 dark:text-white/55 hover:text-black dark:hover:text-white'
                }`}
                title="Small player (380px)"
              >
                SM
              </button>
              <button
                type="button"
                onClick={() => handleSizeChange('md')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  size === 'md'
                    ? 'bg-white dark:bg-[#2a2a2e] font-semibold text-black dark:text-white shadow-xs'
                    : 'text-black/55 dark:text-white/55 hover:text-black dark:hover:text-white'
                }`}
                title="Medium player (560px)"
              >
                MD
              </button>
              <button
                type="button"
                onClick={() => handleSizeChange('full')}
                className={`px-2 py-0.5 rounded-md transition-all ${
                  size === 'full'
                    ? 'bg-white dark:bg-[#2a2a2e] font-semibold text-black dark:text-white shadow-xs'
                    : 'text-black/55 dark:text-white/55 hover:text-black dark:hover:text-white'
                }`}
                title="Full width player"
              >
                Full
              </button>
            </div>

            {/* Edit URL Button */}
            {isEditable && (
              <button
                type="button"
                onClick={() => {
                  setInputValue(targetUrl);
                  setIsEditing(true);
                }}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
                title="Edit YouTube video URL"
              >
                <Pencil size={12} />
              </button>
            )}

            {/* Copy Link Button */}
            <button
              type="button"
              onClick={handleCopyUrl}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title={copied ? 'Copied link!' : 'Copy YouTube link'}
            >
              {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
            </button>

            {/* External Link */}
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white hover:bg-black/6 dark:hover:bg-white/10 transition-colors cursor-pointer"
              title="Open video on YouTube"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
            </a>

            {/* Delete button (editable mode only) */}
            {isEditable && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500/70 hover:text-red-600 dark:text-red-400/70 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                title="Remove video player"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Video Player Frame (16:9) */}
        <div className="relative w-full aspect-video bg-black">
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs text-white/50">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent" />
                <span>Loading video...</span>
              </div>
            </div>
          )}

          {/* Fallback image behind iframe for snapdom toCanvas image export */}
          <div
            className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-0"
            style={{
              backgroundImage: `url(https://img.youtube.com/vi/${videoId}/hqdefault.jpg)`,
            }}
          />

          <iframe
            src={embedSrc}
            title={`YouTube video player ${videoId}`}
            className="note-export-hide w-full h-full border-0 relative z-10"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
            allowFullScreen
            onLoad={() => setIsLoaded(true)}
          />
        </div>
      </div>
    </div>
  );
}

export class YouTubeNode extends DecoratorNode<React.JSX.Element> {
  __videoId: string;
  __url: string;
  __size: YouTubeSize;

  static getType(): string {
    return 'youtube';
  }

  static clone(node: YouTubeNode): YouTubeNode {
    return new YouTubeNode(node.__videoId, node.__url, node.__size, node.__key);
  }

  static importJSON(serializedNode: SerializedYouTubeNode): YouTubeNode {
    return $createYouTubeNode({
      videoId: serializedNode.videoId,
      url: serializedNode.url,
      size: serializedNode.size,
    });
  }

  exportJSON(): SerializedYouTubeNode {
    return {
      type: 'youtube',
      version: 1,
      videoId: this.__videoId,
      url: this.__url,
      size: this.__size,
    };
  }

  constructor(videoId: string, url?: string, size: YouTubeSize = 'full', key?: NodeKey) {
    super(key);
    this.__videoId = videoId;
    this.__url = url || (videoId ? `https://www.youtube.com/watch?v=${videoId}` : '');
    this.__size = size;
  }

  getVideoId(): string {
    return this.__videoId;
  }

  setVideoId(videoId: string): void {
    const writable = this.getWritable();
    writable.__videoId = videoId;
  }

  getUrl(): string {
    return this.__url;
  }

  setUrl(url: string): void {
    const writable = this.getWritable();
    writable.__url = url;
  }

  getSize(): YouTubeSize {
    return this.__size;
  }

  setSize(size: YouTubeSize): void {
    const writable = this.getWritable();
    writable.__size = size;
  }

  isInline(): boolean {
    return false;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    div.className = 'lexical-youtube-container my-3 w-full';
    return div;
  }

  updateDOM(): false {
    return false;
  }

  getTextContent(): string {
    return this.__url || (this.__videoId ? `https://www.youtube.com/watch?v=${this.__videoId}` : '');
  }

  exportDOM(): DOMExportOutput {
    if (!this.__videoId) {
      const div = document.createElement('div');
      return { element: div };
    }
    const iframe = document.createElement('iframe');
    iframe.setAttribute('width', '560');
    iframe.setAttribute('height', '315');
    iframe.setAttribute('src', `https://www.youtube.com/embed/${this.__videoId}`);
    iframe.setAttribute('title', 'YouTube video player');
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute(
      'allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share',
    );
    iframe.setAttribute('allowfullscreen', 'true');
    return { element: iframe };
  }

  decorate(editor: LexicalEditor, config: EditorConfig): React.JSX.Element {
    return (
      <YouTubeComponent
        videoId={this.__videoId}
        url={this.__url}
        size={this.__size}
        nodeKey={this.getKey()}
      />
    );
  }
}

export function $createYouTubeNode({
  videoId,
  url,
  size = 'full',
}: {
  videoId: string;
  url?: string;
  size?: YouTubeSize;
}): YouTubeNode {
  return new YouTubeNode(videoId, url, size);
}

export function $isYouTubeNode(
  node: LexicalNode | null | undefined
): node is YouTubeNode {
  return node instanceof YouTubeNode;
}
