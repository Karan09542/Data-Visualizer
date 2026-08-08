import type { EditorConfig, LexicalEditor, LexicalNode, NodeKey, SerializedLexicalNode, Spread } from 'lexical';
import { DecoratorNode, $getNodeByKey } from 'lexical';
import React, { Suspense, useEffect, useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { X, Play, Pause, Volume1, Volume2, VolumeX, Repeat, MoreHorizontal } from 'lucide-react';
import { MediaStore } from '../../storage/MediaStore';
export type SerializedAudioNode = Spread<{
  mediaId: string;
}, SerializedLexicalNode>;

const AudioComponent = React.lazy(() => Promise.resolve({
  default: ({ mediaId, nodeKey }: { mediaId: string, nodeKey: NodeKey }) => {
    const [src, setSrc] = useState<string | null>(null);
    const [isVideo, setIsVideo] = useState(false);
    const [editor] = useLexicalComposerContext();
    
    // Custom Player State
    const [howl, setHowl] = useState<any>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [progress, setProgress] = useState(0);
    const [duration, setDuration] = useState(0);
    const [speed, setSpeed] = useState(1);
    const [volume, setVolume] = useState(1);
    const [isLooping, setIsLooping] = useState(false);
    const requestRef = useRef<number | null>(null);
    
    const [isVolOpen, setIsVolOpen] = useState(false);
    const volBtnRef = useRef<HTMLDivElement>(null);
    const [volPos, setVolPos] = useState({ top: 0, left: 0, isTop: true });
    const volPopupRef = useRef<HTMLDivElement>(null);

    const [isMoreOpen, setIsMoreOpen] = useState(false);
    const moreBtnRef = useRef<HTMLButtonElement>(null);
    const [morePos, setMorePos] = useState({ top: 0, left: 0, isTop: true });
    const morePopupRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
      if (isVolOpen && volBtnRef.current) {
        const rect = volBtnRef.current.getBoundingClientRect();
        let left = rect.left + rect.width / 2;
        const halfWidth = 16;
        if (left + halfWidth > window.innerWidth) left = window.innerWidth - halfWidth - 10;
        if (left - halfWidth < 0) left = halfWidth + 10;
        const isTop = rect.top > 120;
        setVolPos({ top: isTop ? rect.top : rect.bottom, left, isTop });
      }
    }, [isVolOpen, volume]);

    useLayoutEffect(() => {
      if (isMoreOpen && moreBtnRef.current) {
        const rect = moreBtnRef.current.getBoundingClientRect();
        let left = rect.left + rect.width / 2;
        const halfWidth = 96;
        if (left + halfWidth > window.innerWidth) left = window.innerWidth - halfWidth - 10;
        if (left - halfWidth < 0) left = halfWidth + 10;
        const isTop = rect.top > 180;
        setMorePos({ top: isTop ? rect.top : rect.bottom, left, isTop });
      }
    }, [isMoreOpen]);

    useEffect(() => {
      const handleClickOutside = (e: Event) => {
        const target = e.target as Node;
        const clickedVolBtn = volBtnRef.current?.contains(target);
        const clickedVolPopup = volPopupRef.current?.contains(target);
        if (!clickedVolBtn && !clickedVolPopup) setIsVolOpen(false);
        
        const clickedMoreBtn = moreBtnRef.current?.contains(target);
        const clickedMorePopup = morePopupRef.current?.contains(target);
        if (!clickedMoreBtn && !clickedMorePopup) setIsMoreOpen(false);
      };
      if (isVolOpen || isMoreOpen) {
        document.addEventListener('pointerdown', handleClickOutside, { capture: true });
      }
      return () => document.removeEventListener('pointerdown', handleClickOutside, { capture: true });
    }, [isVolOpen, isMoreOpen]);

    const toggleVolOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isVolOpen && volBtnRef.current) {
        const rect = volBtnRef.current.getBoundingClientRect();
        let left = rect.left + rect.width / 2;
        const halfWidth = 16;
        if (left + halfWidth > window.innerWidth) left = window.innerWidth - halfWidth - 10;
        if (left - halfWidth < 0) left = halfWidth + 10;
        const isTop = rect.top > 120;
        setVolPos({ top: isTop ? rect.top : rect.bottom, left, isTop });
      }
      setIsVolOpen(prev => !prev);
      setIsMoreOpen(false);
    };

    const toggleMoreOpen = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!isMoreOpen && moreBtnRef.current) {
        const rect = moreBtnRef.current.getBoundingClientRect();
        let left = rect.left + rect.width / 2;
        const halfWidth = 96;
        if (left + halfWidth > window.innerWidth) left = window.innerWidth - halfWidth - 10;
        if (left - halfWidth < 0) left = halfWidth + 10;
        const isTop = rect.top > 180;
        setMorePos({ top: isTop ? rect.top : rect.bottom, left, isTop });
      }
      setIsMoreOpen(prev => !prev);
      setIsVolOpen(false);
    };

    const handleDelete = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (howl) howl.unload();
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
            } else {
              // Duration hack for recorded WebM blobs that have Infinity duration
              const tempAudio = new Audio(url);
              tempAudio.addEventListener('loadedmetadata', () => {
                if (tempAudio.duration === Infinity || isNaN(tempAudio.duration)) {
                  tempAudio.currentTime = 1e99;
                  tempAudio.addEventListener('durationchange', () => {
                    tempAudio.currentTime = 0;
                    if (isFinite(tempAudio.duration)) setDuration(tempAudio.duration);
                  }, { once: true });
                } else if (isFinite(tempAudio.duration)) {
                  setDuration(tempAudio.duration);
                }
              });
            }
          }).catch(() => {});
        }
      });
      return () => {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      };
    }, [mediaId]);

    // Initialize Howler
    useEffect(() => {
      if (src && !isVideo) {
        import('howler').then(({ Howl }) => {
          const sound = new Howl({
            src: [src],
            html5: true,
            format: ['webm', 'mp3', 'ogg', 'wav', 'm4a', 'mp4'],
            onload: () => {
              const d = sound.duration();
              if (d && isFinite(d) && d > 0) setDuration(d);
            },
            onplay: () => setIsPlaying(true),
            onpause: () => setIsPlaying(false),
            onend: () => {
              if (!sound.loop()) {
                setIsPlaying(false);
                setProgress(0);
              }
            },
            onseek: () => setProgress(sound.seek() as number)
          });
          setHowl(sound);
        });
      }
      return () => {
        if (howl) howl.unload();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, isVideo]);

    const updateProgress = () => {
      if (howl && howl.playing()) {
        setProgress(howl.seek() as number);
        requestRef.current = requestAnimationFrame(updateProgress);
      }
    };

    useEffect(() => {
      if (isPlaying) {
        requestRef.current = requestAnimationFrame(updateProgress);
      } else if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
      };
    }, [isPlaying, howl]);

    const togglePlay = () => {
      if (!howl) return;
      if (isPlaying) {
        howl.pause();
      } else {
        howl.play();
      }
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setProgress(val);
      if (howl) howl.seek(val);
    };

    const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setVolume(val);
      if (howl) howl.volume(val);
    };

    const cycleSpeed = () => {
      const next = speed === 1 ? 1.5 : speed === 1.5 ? 2 : speed === 2 ? 0.5 : 1;
      setSpeed(next);
      if (howl) howl.rate(next);
    };

    const formatTime = (seconds: number) => {
      if (typeof seconds !== 'number' || !isFinite(seconds) || isNaN(seconds)) return "0:00";
      const m = Math.floor(seconds / 60);
      const s = Math.floor(seconds % 60).toString().padStart(2, '0');
      return `${m}:${s}`;
    };

    const toggleLoop = () => {
      const next = !isLooping;
      setIsLooping(next);
      if (howl) howl.loop(next);
    };

    if (!src) return <div className="animate-pulse bg-black/10 rounded-lg h-12 w-full flex items-center justify-center text-xs opacity-50">Loading audio...</div>;

    return (
      <div className="relative group my-2 flex max-w-full" contentEditable={false}>
        {isVideo ? (
          <div className="p-2 rounded-xl bg-black/5 dark:bg-white/10 border border-black/10 dark:border-white/10 pr-10 max-w-full">
            <video src={src} controls className="max-w-full rounded-lg max-h-[400px] object-contain bg-black/5 dark:bg-black/20" />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-3 px-2 py-1.5 bg-black/5 dark:bg-white/10 rounded-full border border-black/10 dark:border-white/10 shadow-sm pr-8 sm:pr-10 w-full max-w-md h-11 overflow-hidden">
            <button 
              onClick={togglePlay} 
              className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center hover:bg-blue-600 transition-transform active:scale-95 shadow-md shadow-blue-500/20 shrink-0"
            >
              {isPlaying ? <Pause size={14} className="fill-current" /> : <Play size={14} className="fill-current ml-0.5" />}
            </button>
            
            <span className="text-xs font-mono text-black/60 dark:text-white/70 min-w-[32px] text-right shrink-0">
              {formatTime(progress)}
            </span>
            
            <input 
              type="range" 
              min={0} 
              max={isFinite(duration) && duration > 0 ? duration : 100} 
              step="0.1"
              value={progress} 
              onChange={handleSeek}
              className="flex-1 w-16 min-w-[40px] h-1.5 bg-black/10 dark:bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all"
            />
            
            <span className="text-xs font-mono text-black/60 dark:text-white/70 min-w-[32px] shrink-0">
              {formatTime(duration)}
            </span>
            
            <div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-0.5 shrink-0 hidden sm:block" />
            
            <div className="hidden sm:flex items-center gap-1 sm:gap-2 ml-auto sm:ml-0 shrink-0">
              <button 
                onClick={cycleSpeed} 
                className="text-[10px] font-bold w-7 h-7 rounded-full hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors text-black/70 dark:text-white/80 shrink-0"
                title="Playback Speed"
              >
                {speed}x
              </button>
              
              <button 
                onClick={toggleLoop} 
                className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full hover:bg-black/10 dark:hover:bg-white/20 flex items-center justify-center transition-colors shrink-0 ${isLooping ? 'text-blue-500' : 'text-black/70 dark:text-white/80'}`}
                title="Toggle Repeat"
              >
                <Repeat size={14} />
              </button>
              
              <div 
                className="relative flex items-center justify-center shrink-0"
                ref={volBtnRef}
              >
                <div 
                  className="w-6 h-6 sm:w-7 sm:h-7 flex items-center justify-center text-black/70 dark:text-white/80 cursor-pointer hover:bg-black/10 dark:hover:bg-white/20 rounded-full transition-colors" 
                  onClick={toggleVolOpen}
                >
                  {volume === 0 ? <VolumeX size={14} /> : volume < 0.5 ? <Volume1 size={14} /> : <Volume2 size={14} />}
                </div>
              </div>
            </div>

            <button
              ref={moreBtnRef}
              onClick={toggleMoreOpen}
              className="sm:hidden w-8 h-8 rounded-full flex items-center justify-center text-black/70 dark:text-white/80 hover:bg-black/10 dark:hover:bg-white/20 transition-colors shrink-0 ml-auto"
              title="More Options"
            >
              <MoreHorizontal size={16} />
            </button>
            
            {isVolOpen && createPortal(
              <div 
                className="fixed z-[999999]"
                style={{
                  top: volPos.isTop ? volPos.top - 8 : volPos.top + 8,
                  left: volPos.left,
                  transform: volPos.isTop ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
                }}
              >
                <div 
                  ref={volPopupRef}
                  className={"w-8 h-24 bg-white/90 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-full flex items-center justify-center shadow-lg animate-in fade-in zoom-in-95 duration-100 " + (volPos.isTop ? "origin-bottom" : "origin-top")}
                  onClick={(e) => e.stopPropagation()}
                >
                <input 
                  type="range" 
                  min={0} 
                  max={1} 
                  step="0.05"
                  value={volume} 
                  onChange={handleVolume}
                  className="w-16 h-1.5 bg-black/10 dark:bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer -rotate-90"
                />
                </div>
              </div>,
              document.body
            )}

            {isMoreOpen && createPortal(
              <div 
                className="fixed z-[999999]"
                style={{
                  top: morePos.isTop ? morePos.top - 8 : morePos.top + 8,
                  left: morePos.left,
                  transform: morePos.isTop ? 'translate(-50%, -100%)' : 'translate(-50%, 0)'
                }}
              >
                <div 
                  ref={morePopupRef}
                  className={"w-48 p-3 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border border-black/10 dark:border-white/10 rounded-2xl flex flex-col gap-3 shadow-2xl animate-in fade-in zoom-in-95 duration-100 " + (morePos.isTop ? "origin-bottom" : "origin-top")}
                  onClick={(e) => e.stopPropagation()}
                >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-black/80 dark:text-white/80">Playback Speed</span>
                  <button onClick={cycleSpeed} className="text-xs font-bold w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors flex items-center justify-center">
                    {speed}x
                  </button>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-black/80 dark:text-white/80">Repeat</span>
                  <button onClick={toggleLoop} className={`w-8 h-8 rounded-full hover:bg-black/10 dark:hover:bg-white/20 transition-colors flex items-center justify-center ${isLooping ? 'bg-blue-500/10 text-blue-500' : 'bg-black/5 dark:bg-white/10 text-black/70 dark:text-white/80'}`}>
                    <Repeat size={14} />
                  </button>
                </div>
                
                <div className="flex flex-col gap-2 pt-2 border-t border-black/5 dark:border-white/5">
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-medium text-black/80 dark:text-white/80">Volume</span>
                     <span className="text-xs text-black/50 dark:text-white/50">{Math.round(volume * 100)}%</span>
                  </div>
                  <input 
                    type="range" 
                    min={0} max={1} step="0.05"
                    value={volume} onChange={handleVolume}
                    className="w-full h-1.5 bg-black/10 dark:bg-white/20 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full cursor-pointer transition-all"
                  />
                </div>
                </div>
              </div>,
              document.body
            )}
          </div>
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
