import type { EditorConfig, LexicalEditor, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { DecoratorNode, $getNodeByKey } from 'lexical';
import React, { Suspense, useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { X } from 'lucide-react';
import { MediaStore } from '../../storage/MediaStore';
import CustomAudioPlayer from '../../../CustomAudioPlayer';
export type SerializedAudioNode = Spread<{
  mediaId: string;
}, SerializedLexicalNode>;

const AudioComponent = React.lazy(() => Promise.resolve({
  default: ({ mediaId, nodeKey }: { mediaId: string, nodeKey: NodeKey }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [isVideo, setIsVideo] = useState(false);
    const [editor] = useLexicalComposerContext();
    
    const handleDelete = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if (node) node.remove();
      });
    };

    useEffect(() => {
      let objectUrl: string | null = null;
      MediaStore.getMediaUrl(mediaId).then(url => {
        if (url) {
          objectUrl = url;
          setSrc(url);
          fetch(url).then(r => r.blob()).then(blob => {
            if (blob.type.startsWith('video/')) {
              setIsVideo(true);
            }
          }).catch(() => {});
        }
      });
      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, [mediaId]);

    if (!src) return <div className="animate-pulse bg-black/10 rounded-lg h-12 w-full flex items-center justify-center text-xs opacity-50">Loading audio...</div>;

    return (
      <div className="relative group my-2 flex max-w-full" contentEditable={false}>
        {isVideo ? (
          <div className="p-2 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 pr-10 max-w-full">
            <video src={src} controls className="max-w-full rounded-lg max-h-[400px] object-contain bg-black/5 dark:bg-black/20" />
          </div>
        ) : (
          <CustomAudioPlayer src={src} />
        )}
        <button 
          onClick={handleDelete}
          className="absolute right-1 top-1/2 -translate-y-1/2 p-1.5 bg-black/10 dark:bg-white/10 hover:bg-red-500/90 text-black/60 dark:text-white/60 hover:text-white rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200"
          title="Delete Audio"
        >
          <X size={14} />
        </button>
      </div>
    );
  }
}));

export class AudioNode extends DecoratorNode<React.JSX.Element> {
  __mediaId: string;

  static getType(): string {
    return 'audio';
  }

  static clone(node: AudioNode): AudioNode {
    return new AudioNode(node.__mediaId, node.__key);
  }

  static importJSON(serializedNode: SerializedAudioNode): AudioNode {
    const { mediaId } = serializedNode;
    return $createAudioNode(mediaId);
  }

  exportJSON(): SerializedAudioNode {
    return {
      mediaId: this.__mediaId,
      type: 'audio',
      version: 1,
    };
  }

  constructor(mediaId: string, key?: NodeKey) {
    super(key);
    this.__mediaId = mediaId;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    const theme = config.theme;
    const className = theme.image; // Reusing image class or can define audio
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
        <AudioComponent mediaId={this.__mediaId} nodeKey={this.getKey()} />
      </Suspense>
    );
  }
}

export function $createAudioNode(mediaId: string): AudioNode {
  return new AudioNode(mediaId);
}

export function $isAudioNode(node: LexicalNode | null | undefined): node is AudioNode {
  return node instanceof AudioNode;
}
