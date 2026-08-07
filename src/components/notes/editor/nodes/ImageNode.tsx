import type { EditorConfig, LexicalEditor, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { DecoratorNode, $getNodeByKey } from 'lexical';
import React, { Suspense, useEffect, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { X, Maximize2 } from 'lucide-react';
import { createPortal } from 'react-dom';
import { MediaStore } from '../../storage/MediaStore';

export type SerializedImageNode = Spread<{
  mediaId: string;
  altText: string;
  width?: 'inherit' | number;
  height?: 'inherit' | number;
  maxWidth?: number;
}, SerializedLexicalNode>;

const ImageComponent = React.lazy(() => Promise.resolve({
  default: ({ mediaId, altText, width, height, maxWidth, nodeKey }: {
    mediaId: string, altText: string, width?: 'inherit' | number, height?: 'inherit' | number, maxWidth?: number, nodeKey: NodeKey
  }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [editor] = useLexicalComposerContext();

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

    return (
      <>
        <div className="relative group inline-block max-w-full my-2" contentEditable={false}>
          <img
            src={src}
            alt={altText}
            style={{
              width: width === 'inherit' ? '100%' : width,
              height,
              maxWidth: maxWidth || '100%',
              borderRadius: '8px',
              objectFit: 'contain'
            }}
            className="shadow-sm border border-black/5 dark:border-white/10 cursor-pointer"
            onClick={() => setIsFullscreen(true)}
            draggable="false"
          />
          <div className="absolute top-2 right-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200">
            <button 
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsFullscreen(true); }}
              className="p-1.5 bg-black/40 hover:bg-black/60 text-white rounded-full shadow-sm backdrop-blur-md"
              title="View Fullscreen"
            >
              <Maximize2 size={14} />
            </button>
            <button 
              onClick={handleDelete}
              className="p-1.5 bg-black/40 hover:bg-red-500/90 text-white rounded-full shadow-sm backdrop-blur-md"
              title="Delete Image"
            >
              <X size={14} />
            </button>
          </div>
        </div>
        
        {isFullscreen && createPortal(
          <div 
            className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-200"
            onClick={() => setIsFullscreen(false)}
          >
            <button 
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
              onClick={(e) => e.stopPropagation()} // Prevent click from bubbling to the backdrop
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
      node.__key,
    );
  }

  static importJSON(serializedNode: SerializedImageNode): ImageNode {
    const { mediaId, altText, width, height, maxWidth } = serializedNode;
    return $createImageNode({
      mediaId,
      altText,
      width,
      height,
      maxWidth,
    });
  }

  exportJSON(): SerializedImageNode {
    return {
      mediaId: this.__mediaId,
      altText: this.__altText,
      width: this.__width,
      height: this.__height,
      maxWidth: this.__maxWidth,
      type: 'image',
      version: 1,
    };
  }

  constructor(mediaId: string, altText: string, width?: 'inherit' | number, height?: 'inherit' | number, maxWidth?: number, key?: NodeKey) {
    super(key);
    this.__mediaId = mediaId;
    this.__altText = altText;
    this.__width = width || 'inherit';
    this.__height = height || 'inherit';
    this.__maxWidth = maxWidth || 0;
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
          nodeKey={this.getKey()}
        />
      </Suspense>
    );
  }
}

export function $createImageNode({ mediaId, altText, width, height, maxWidth }: { mediaId: string, altText: string, width?: 'inherit' | number, height?: 'inherit' | number, maxWidth?: number }): ImageNode {
  return new ImageNode(mediaId, altText, width, height, maxWidth);
}

export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
