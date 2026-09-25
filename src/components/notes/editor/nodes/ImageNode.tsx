import type { EditorConfig, LexicalEditor, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { DecoratorNode, $getNodeByKey } from 'lexical';
import React, { Suspense, useEffect, useState, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { X, Maximize2, MoreHorizontal } from 'lucide-react';
import { createPortal } from 'react-dom';
import { MediaStore } from '../../storage/MediaStore';

export type ImageSize = 'sm' | 'md' | 'lg' | 'default';

export type SerializedImageNode = Spread<{
  mediaId: string;
  altText: string;
  width?: 'inherit' | number;
  height?: 'inherit' | number;
  maxWidth?: number;
  size?: ImageSize;
}, SerializedLexicalNode>;

export const getImageDimensions = (size: ImageSize = 'lg', originalMaxWidth?: number) => {
  switch (size) {
    case 'sm':
      return { maxWidth: '180px', width: '100%' };
    case 'md':
      return { maxWidth: '320px', width: '100%' };
    case 'lg':
    case 'default':
    default:
      return { maxWidth: originalMaxWidth ? `${originalMaxWidth}px` : '100%', width: '100%' };
  }
};

const SIZES: { key: 'sm' | 'md' | 'lg'; label: string; tooltip: string }[] = [
  { key: 'sm', label: 'SM', tooltip: 'Small (180px)' },
  { key: 'md', label: 'MD', tooltip: 'Medium (320px)' },
  { key: 'lg', label: 'LG', tooltip: 'Large (Default)' },
];

const ImageComponent = React.lazy(() => Promise.resolve({
  default: ({ mediaId, altText, width, height, maxWidth, size, nodeKey }: {
    mediaId: string;
    altText: string;
    width?: 'inherit' | number;
    height?: 'inherit' | number;
    maxWidth?: number;
    size?: ImageSize;
    nodeKey: NodeKey;
  }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showSizeMenu, setShowSizeMenu] = useState(false);
    const [currentSize, setCurrentSize] = useState<ImageSize>(size || 'lg');
    const [isTouchDevice, setIsTouchDevice] = useState(() =>
      typeof window !== 'undefined' && (
        'ontouchstart' in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
        window.matchMedia?.('(pointer: coarse)').matches ||
        window.matchMedia?.('(hover: none)').matches
      )
    );
    const [editor] = useLexicalComposerContext();
    const isEditable = editor.isEditable();

    const menuRef = useRef<HTMLDivElement>(null);
    const threeDotsBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
      const checkTouch = () => {
        setIsTouchDevice(
          typeof window !== 'undefined' && (
            'ontouchstart' in window ||
            (navigator.maxTouchPoints && navigator.maxTouchPoints > 0) ||
            window.matchMedia?.('(pointer: coarse)').matches ||
            window.matchMedia?.('(hover: none)').matches
          )
        );
      };
      checkTouch();
      window.addEventListener('resize', checkTouch);
      return () => window.removeEventListener('resize', checkTouch);
    }, []);

    useEffect(() => {
      setCurrentSize(size || 'lg');
    }, [size]);

    // Close size menu on click outside
    useEffect(() => {
      if (!showSizeMenu) return;
      const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
        const target = e.target as Node;
        if (
          menuRef.current &&
          !menuRef.current.contains(target) &&
          threeDotsBtnRef.current &&
          !threeDotsBtnRef.current.contains(target)
        ) {
          setShowSizeMenu(false);
        }
      };
      document.addEventListener('pointerdown', handleOutsideClick);
      return () => document.removeEventListener('pointerdown', handleOutsideClick);
    }, [showSizeMenu]);

    const handleSetSize = (newSize: ImageSize) => {
      setCurrentSize(newSize);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isImageNode(node)) {
          node.setSize(newSize);
        }
      });
    };

    const handleDelete = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node) {
          node.remove();
        }
      });
    };

    useEffect(() => {
      let objectUrl: string | null = null;
      MediaStore.getMediaUrl(mediaId).then(url => {
        if (url) {
          objectUrl = url;
          setSrc(url);
        }
      });
      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, [mediaId]);

    if (!src) return <div className="animate-pulse bg-black/10 rounded-lg h-32 w-full flex items-center justify-center text-xs opacity-50">Loading image...</div>;

    const dimensions = getImageDimensions(currentSize, maxWidth);

    return (
      <>
        <div className="relative group inline-block max-w-full my-2.5" contentEditable={false}>
          <img
            src={src}
            alt={altText}
            style={{
              width: dimensions.width,
              maxWidth: dimensions.maxWidth,
              height: height === 'inherit' ? 'auto' : (height || 'auto'),
              borderRadius: '8px',
              objectFit: 'contain'
            }}
            className="max-w-full shadow-sm border border-black/5 dark:border-white/10 cursor-pointer transition-all duration-200"
            onClick={() => {
              if (showSizeMenu) {
                setShowSizeMenu(false);
                return;
              }
              setIsFullscreen(true);
            }}
            draggable="false"
          />

          {/* Action buttons at top right of image */}
          <div
            className={`note-export-hide image-action-overlay absolute top-2 right-2 flex items-center gap-1.5 transition-opacity duration-200 z-20 ${
              showSizeMenu || isTouchDevice
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 pointer-events-auto'
            }`}
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {isEditable && (
              <button
                ref={threeDotsBtnRef}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setShowSizeMenu((prev) => !prev);
                }}
                className={`w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center rounded-full shadow-md backdrop-blur-md transition-all active:scale-95 ${
                  showSizeMenu
                    ? 'bg-white text-black dark:bg-white dark:text-black shadow-lg scale-105'
                    : 'bg-black/60 hover:bg-black/80 active:bg-black/90 text-white'
                }`}
                title="Image size options"
                aria-label="Image size options"
              >
                <MoreHorizontal size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsFullscreen(true);
              }}
              className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center bg-black/60 hover:bg-black/80 active:bg-black/90 active:scale-95 text-white rounded-full shadow-md backdrop-blur-md transition-all"
              title="View Fullscreen"
              aria-label="View Fullscreen"
            >
              <Maximize2 size={13} />
            </button>

            {isEditable && (
              <button
                type="button"
                onClick={handleDelete}
                className="w-7 h-7 sm:w-6 sm:h-6 flex items-center justify-center bg-black/60 hover:bg-red-500/90 active:scale-95 text-white rounded-full shadow-md backdrop-blur-md transition-all"
                title="Delete Image"
                aria-label="Delete Image"
              >
                <X size={14} />
              </button>
            )}

            {/* Size options popover when three dots is clicked */}
            {showSizeMenu && (
              <div
                ref={menuRef}
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                className="absolute top-9 sm:top-8 right-0 z-30 flex items-center p-0.5 bg-black/85 dark:bg-[#1c1c1f]/95 backdrop-blur-xl text-white rounded-xl shadow-2xl border border-white/15 animate-in fade-in zoom-in-95 duration-150 select-none whitespace-nowrap"
              >
                <div className="flex items-center bg-white/10 rounded-lg p-0.5 gap-0.5">
                  {SIZES.map(({ key, label, tooltip }) => {
                    const isSelected = currentSize === key || (key === 'lg' && (!currentSize || currentSize === 'default'));
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleSetSize(key);
                          setShowSizeMenu(false);
                        }}
                        className={`px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-md text-xs sm:text-[11px] font-semibold shrink-0 whitespace-nowrap transition-all active:scale-95 ${
                          isSelected
                            ? 'bg-white text-black shadow-sm'
                            : 'text-white/80 hover:text-white hover:bg-white/10'
                        }`}
                        title={tooltip}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {isFullscreen && createPortal(
          <div
            className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
            onClick={() => setIsFullscreen(false)}
          >
            <button
              type="button"
              onClick={() => setIsFullscreen(false)}
              className="absolute top-6 right-6 p-2 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
              title="Close"
            >
              <X size={24} />
            </button>
            <img
              src={src}
              alt={altText}
              className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
      </>
    );
  }
}));

export class ImageNode extends DecoratorNode<React.JSX.Element> {
  __mediaId: string;
  __altText: string;
  __width: 'inherit' | number;
  __height: 'inherit' | number;
  __maxWidth: number;
  __size: ImageSize;

  static getType(): string {
    return 'image';
  }

  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__mediaId,
      node.__altText,
      node.__width,
      node.__height,
      node.__maxWidth,
      node.__size,
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { mediaId, altText, width, height, maxWidth, size } = serializedNode;
    return $createImageNode({
      mediaId,
      altText,
      width,
      height,
      maxWidth,
      size,
    });
  }

  exportJSON(): SerializedImageNode {
    return {
      mediaId: this.__mediaId,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
      maxWidth: this.__maxWidth,
      size: this.__size,
      type: 'image',
      version: 1,
    };
  }

  constructor(
    mediaId: string,
    altText: string,
    width?: 'inherit' | number,
    height?: 'inherit' | number,
    maxWidth?: number,
    size?: ImageSize,
    key?: NodeKey,
  ) {
    super(key);
    this.__mediaId = mediaId;
    this.__altText = altText;
    this.__width = width || 'inherit';
    this.__height = height || 'inherit';
    this.__maxWidth = maxWidth || 0;
    this.__size = size || 'lg';
  }

  setSize(size: ImageSize): void {
    const writable = this.getWritable();
    writable.__size = size;
  }

  getSize(): ImageSize {
    return this.__size;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    const theme = config.theme;
    const className = theme.image;
    if (className !== undefined) {
      span.className = className;
    }
    return span;
  }

  updateDOM(): false {
    return false;
  }

  decorate(): React.JSX.Element {
    return (
      <Suspense fallback={null}>
        <ImageComponent
          mediaId={this.__mediaId}
          altText={this.__altText}
          width={this.__width}
          height={this.__height}
          maxWidth={this.__maxWidth}
          size={this.__size}
          nodeKey={this.getKey()}
        />
      </Suspense>
    );
  }
}

export function $createImageNode({
  mediaId,
  altText,
  width,
  height,
  maxWidth,
  size,
}: {
  mediaId: string;
  altText: string;
  width?: 'inherit' | number;
  height?: 'inherit' | number;
  maxWidth?: number;
  size?: ImageSize;
}): ImageNode {
  return new ImageNode(mediaId, altText, width, height, maxWidth, size);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
