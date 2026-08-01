import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, Trash2, GripVertical, Edit2, Palette, Clipboard, CornerRightDown, CopyPlus, Check, Eraser, ListTodo, Square, CheckSquare, Type, Minus, Plus, ChevronDown, MoreVertical } from 'lucide-react';
import type { StickyNote as IStickyNote } from '../lib/db';
import { FONTS, loadGoogleFont } from '../utils/fontRegistry';
import { getMinNoteWidth } from '../utils/NoteUtils';
import LexicalEditor from './notes/editor/LexicalEditor';



const DEFAULT_STICKY_FONT = 'Hind';
const DEFAULT_FONT_SIZE = 15;
const FULLSCREEN_DEFAULT_FONT_SIZE = 18;
const MIN_NOTE_HEIGHT = 180;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const STICKY_FONT_IDS = ['hind', 'mukta', 'poppins', 'inter', 'tirodevanagari', 'martel', 'baloo2', 'opensans'];
const STICKY_FONT_OPTIONS = FONTS.filter(font => STICKY_FONT_IDS.includes(font.id));
const getStickyFontStack = (fontFamily: string) => `"${fontFamily}", "Noto Sans Devanagari", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

interface Props {
  note: IStickyNote;
  onDelete: (id: string) => void;
  onUpdate: (note: IStickyNote) => void;
  onDuplicate: (note: IStickyNote) => void;
  onFocus: (id: string) => void;
}

const COLORS = [
  '#fef08a', // Yellow
  '#bbf7d0', // Green
  '#bfdbfe', // Blue
  '#fecaca', // Red
  '#e9d5ff', // Purple
  '#fed7aa', // Orange
  '#fbcfe8', // Pink
];

export default function StickyNote({ note, onDelete, onUpdate, onDuplicate, onFocus }: Props) {
  const [content, setContent] = useState(note.content);
  const latestContentRef = useRef(note.content);
  const justSavedRef = useRef(false);

  useEffect(() => {
    if (justSavedRef.current) {
      if (note.content === content) {
        justSavedRef.current = false;
      }
    } else {
      setContent(note.content);
    }
  }, [note.content, content]);

  const [showColors, setShowColors] = useState(false);
  const [showTypography, setShowTypography] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const [previewFontFamily, setPreviewFontFamily] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState(false);
  const [duplicateStatus, setDuplicateStatus] = useState(false);
  const [clearKey, setClearKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const isMax = note.isMaximized;
  const activeFontFamily = note.fontFamily || DEFAULT_STICKY_FONT;
  const previewedFontFamily = previewFontFamily || activeFontFamily;
  const activeFontSize = note.fontSize ?? (isMax ? FULLSCREEN_DEFAULT_FONT_SIZE : DEFAULT_FONT_SIZE);
  const clampedFontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, activeFontSize));
  const noteTextStyle: React.CSSProperties = {
    fontFamily: getStickyFontStack(previewedFontFamily),
    fontSize: `${clampedFontSize}px`,
    lineHeight: isMax ? 1.65 : 1.55,
  };
  const checklistIconSize = Math.max(14, Math.min(22, Math.round(clampedFontSize * 1.05)));

  useEffect(() => {
    const font = FONTS.find(f => f.fontFamily === activeFontFamily);
    if (font) loadGoogleFont(font.googleFontName);
  }, [activeFontFamily]);

  useEffect(() => {
    if (!showTypography) {
      setIsFontMenuOpen(false);
      setPreviewFontFamily(null);
    }
  }, [showTypography]);



  const handleSave = (newContent: string) => {
    setContent(newContent);
    latestContentRef.current = newContent;
    justSavedRef.current = true;
    onUpdate({ ...note, content: newContent, updatedAt: Date.now() });
  };

  const handleInstantChange = (newContent: string) => {
    latestContentRef.current = newContent;
  };

  const toggleMinimize = () => {
    onUpdate({ ...note, content: latestContentRef.current, isMinimized: !note.isMinimized, updatedAt: Date.now() });
  };

  const toggleMaximize = () => {
    onUpdate({ ...note, content: latestContentRef.current, isMaximized: !note.isMaximized, updatedAt: Date.now() });
  };

  const changeColor = (color: string) => {
    onUpdate({ ...note, content: latestContentRef.current, color, updatedAt: Date.now() });
    setShowColors(false);
    setShowMobileActions(false);
  };

  const changeFontFamily = useCallback((fontFamily: string) => {
    const font = FONTS.find(f => f.fontFamily === fontFamily);
    if (font) loadGoogleFont(font.googleFontName);
    setPreviewFontFamily(null);
    setIsFontMenuOpen(false);
    onUpdate({ ...note, content: latestContentRef.current, fontFamily, updatedAt: Date.now() });
  }, [note, onUpdate]);

  const handlePreviewFont = useCallback((fontFamily: string, googleFontName: string) => {
    loadGoogleFont(googleFontName);
    setPreviewFontFamily(fontFamily);
  }, []);

  const changeFontSize = useCallback((delta: number) => {
    const fontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, clampedFontSize + delta));
    onUpdate({ ...note, content: latestContentRef.current, fontSize, updatedAt: Date.now() });
  }, [clampedFontSize, note, onUpdate]);

  const handleDragEnd = (_: any, info: any) => {
    if (note.isMaximized) return;
    const newX = note.x + info.offset.x;
    const newY = note.y + info.offset.y;
    onUpdate({ ...note, content: latestContentRef.current, x: newX, y: newY, updatedAt: Date.now() });
  };

  const handleResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startWidth = Math.max(note.width, getMinNoteWidth());
    const startHeight = Math.max(note.height, MIN_NOTE_HEIGHT);

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;

      const newWidth = Math.max(getMinNoteWidth(), startWidth + (currentX - startX));
      const newHeight = Math.max(MIN_NOTE_HEIGHT, startHeight + (currentY - startY));

      onUpdate({ ...note, content: latestContentRef.current, width: newWidth, height: newHeight, updatedAt: Date.now() });
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleDuplicateClick = () => {
    setDuplicateStatus(true);
    onDuplicate({ ...note, content: latestContentRef.current });
    setTimeout(() => setDuplicateStatus(false), 500);
  };

  const handleMobileCopy = () => {
    handleCopy(content);
    setShowMobileActions(false);
  };

  const handleMobileDuplicateClick = () => {
    handleDuplicateClick();
    setShowMobileActions(false);
  };

  const handleClearContent = useCallback(() => {
    if (!confirm('Clear this sticky note text?')) return;

    setContent('');
    latestContentRef.current = '';
    setClearKey(prev => prev + 1);
    justSavedRef.current = true;
    onUpdate({ ...note, content: '', updatedAt: Date.now() });
  }, [note, onUpdate]);


  const handleActionPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  const handleChecklistPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);



  return (
    <motion.div
      ref={containerRef}
      drag={!isMax}
      dragMomentum={false}
      onDragStart={() => onFocus(note.id)}
      onDragEnd={handleDragEnd}
      initial={false}
      animate={{
        opacity: 1,
        scale: 1,
        x: isMax ? 0 : note.x,
        y: isMax ? 0 : note.y,
        width: isMax ? '100vw' : Math.max(note.width, getMinNoteWidth()),
        height: isMax ? '100dvh' : Math.max(note.height, MIN_NOTE_HEIGHT),
        zIndex: isMax ? 30000 : (note.zIndex || 20000),
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`fixed bg-white dark:bg-[#1a1a1a] text-black dark:text-white/90 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.18)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col group transition-shadow hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.2)] dark:hover:shadow-[0_32px_64px_-12px_rgba(0,0,0,0.6)] ${isMax ? 'rounded-none border-0' : 'rounded-[28px] border border-black/5 dark:border-white/10'
        }`}
      style={{
        backgroundImage: `linear-gradient(to bottom right, ${note.color}15, ${note.color}02)`,
        pointerEvents: 'auto',
      }}
      onPointerDown={() => onFocus(note.id)}
    >
      {/* Header / Drag Handle */}
      <div className={`h-12 flex items-center justify-between pl-3 pr-4 cursor-grab active:cursor-grabbing shrink-0 bg-transparent transition-colors ${isMax ? 'cursor-default' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
          {!isMax && (
            <span className="flex h-8 w-6 items-center justify-center rounded-md opacity-35 transition-opacity group-hover:opacity-55" title="Drag note">
              <GripVertical size={16} />
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 pl-1">
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => {
              setShowTypography(prev => !prev);
              setShowColors(false);
              setShowMobileActions(false);
            }}
            className={`p-1.5 rounded-lg transition-colors ${showTypography ? 'bg-black/10 dark:bg-white/20 text-black dark:text-white' : 'hover:bg-black/10 dark:hover:bg-white/10'}`}
            title="Typography"
          >
            <Type size={16} className={showTypography ? 'opacity-100' : 'opacity-70'} />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => {
              setShowColors(!showColors);
              setShowTypography(false);
              setShowMobileActions(false);
            }}
            className="hidden sm:flex p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Change Color"
          >
            <Palette size={16} className="opacity-70" />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => handleCopy(content)}
            className="hidden sm:flex p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors relative"
            title="Copy to Clipboard"
          >
            <AnimatePresence mode="wait">
              {copyStatus ? (
                <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Check size={16} className="text-emerald-600" />
                </motion.div>
              ) : (
                <motion.div key="clip" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Clipboard size={16} className="opacity-70" />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={handleDuplicateClick}
            className="hidden sm:flex p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Duplicate Note"
          >
            <motion.div animate={duplicateStatus ? { scale: 1.2, rotate: 5 } : { scale: 1, rotate: 0 }}>
              <CopyPlus size={16} className="opacity-70" />
            </motion.div>
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => {
              setShowMobileActions(prev => !prev);
              setShowColors(false);
              setShowTypography(false);
            }}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors sm:hidden order-last"
            title="More Actions"
          >
            <MoreVertical size={16} className="opacity-70" />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={handleClearContent}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Clear Text"
          >
            <Eraser size={16} className="opacity-70" />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={toggleMaximize}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
            title={isMax ? "Restore" : "Fullscreen"}
          >
            {isMax ? <Minimize2 size={16} className="opacity-70" /> : <Maximize2 size={16} className="opacity-70" />}
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={toggleMinimize}
            className="p-1.5 hover:bg-black/10 dark:hover:bg-white/10 rounded-lg transition-colors"
            title="Minimize to List"
          >
            <X size={16} className="opacity-70" />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => {
              onDelete(note.id);
            }}
            className="p-1.5 hover:bg-red-500/20 dark:hover:bg-red-500/30 text-red-700 dark:text-red-400 rounded-lg transition-colors"
            title="Delete Note"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showMobileActions && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            className="absolute top-12 right-2 z-30 w-48 max-w-[calc(100%-1rem)] rounded-xl border border-black/5 dark:border-white/10 bg-white/95 dark:bg-[#1a1a1a]/95 p-2 shadow-2xl backdrop-blur-xl sm:hidden"
            onPointerDown={handleActionPointerDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-black/40 dark:text-white/40">Color</div>
            <div className="grid grid-cols-7 gap-1.5 pb-1.5">
              {COLORS.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => changeColor(c)}
                  className={`h-5 w-5 rounded-full border border-black/10 dark:border-white/10 shadow-sm transition-all hover:scale-110 active:scale-95 ${note.color === c ? 'ring-2 ring-black/20 dark:ring-white/40 ring-offset-1 ring-offset-white dark:ring-offset-[#1a1a1a]' : ''}`}
                  style={{ backgroundColor: c }}
                  title="Change Color"
                />
              ))}
            </div>
            <div className="my-1 h-px bg-black/5 dark:bg-white/10" />
            <button
              type="button"
              onClick={handleMobileCopy}
              className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-black/80 dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              {copyStatus ? <Check size={15} className="text-emerald-600" /> : <Clipboard size={15} className="opacity-70" />}
              <span>Copy</span>
            </button>
            <button
              type="button"
              onClick={handleMobileDuplicateClick}
              className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-black/80 dark:text-white/80 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            >
              <CopyPlus size={15} className="opacity-70" />
              <span>Duplicate</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTypography && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -4 }}
            className="absolute top-12 right-2 sm:right-3 z-20 w-52 max-w-[calc(100%-1rem)] rounded-xl border border-black/5 dark:border-white/10 bg-white/98 dark:bg-[#222222]/98 p-2 shadow-2xl backdrop-blur-sm"
            onPointerDown={handleActionPointerDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => changeFontSize(-1)}
                disabled={clampedFontSize <= MIN_FONT_SIZE}
                className="flex h-7 w-7 items-center justify-center rounded-md text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10 disabled:pointer-events-none disabled:opacity-25 transition-colors"
                title="Decrease Font Size"
              >
                <Minus size={15} />
              </button>
              <div className="h-7 min-w-12 flex-1 rounded-md bg-black/5 dark:bg-white/10 px-2 text-center text-[11px] font-bold leading-7 tabular-nums text-black/90 dark:text-white/90 shadow-inner shadow-white/20 dark:shadow-black/20">
                {clampedFontSize}px
              </div>
              <button
                type="button"
                onClick={() => changeFontSize(1)}
                disabled={clampedFontSize >= MAX_FONT_SIZE}
                className="flex h-7 w-7 items-center justify-center rounded-md text-black/70 dark:text-white/70 hover:bg-black/10 dark:hover:bg-white/10 disabled:pointer-events-none disabled:opacity-25 transition-colors"
                title="Increase Font Size"
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="relative mt-1.5">
              <button
                type="button"
                onClick={() => setIsFontMenuOpen(prev => !prev)}
                className="flex h-7 w-full items-center justify-between gap-2 rounded-md border border-black/5 dark:border-white/10 bg-black/5 dark:bg-white/10 px-2 text-left text-[11px] font-semibold text-black/90 dark:text-white/90 outline-none transition-colors hover:bg-black/10 dark:hover:bg-white/20 focus:ring-2 focus:ring-black/10"
                style={{ fontFamily: getStickyFontStack(previewedFontFamily) }}
                title="Font Family"
              >
                <span className="min-w-0 truncate">{previewedFontFamily}</span>
                <ChevronDown size={13} className={`shrink-0 opacity-55 transition-transform ${isFontMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              <AnimatePresence>
                {isFontMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -3, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -3, scale: 0.98 }}
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-36 overflow-y-auto rounded-md border border-black/10 dark:border-white/10 bg-[#fffdf3]/98 dark:bg-[#2a2a2a]/98 p-1 shadow-2xl backdrop-blur-sm sticky-note-scrollbar"
                    onMouseLeave={() => setPreviewFontFamily(null)}
                  >
                    {STICKY_FONT_OPTIONS.map(font => {
                      const isSelected = activeFontFamily === font.fontFamily;
                      return (
                        <button
                          type="button"
                          key={font.id}
                          onMouseEnter={() => handlePreviewFont(font.fontFamily, font.googleFontName)}
                          onFocus={() => handlePreviewFont(font.fontFamily, font.googleFontName)}
                          onClick={() => changeFontFamily(font.fontFamily)}
                          className={`flex h-7 w-full items-center justify-between gap-2 rounded px-2 text-left text-[11px] transition-colors ${isSelected ? 'bg-black/10 dark:bg-white/20 text-black dark:text-white' : 'text-black/80 dark:text-white/80 hover:bg-black/5 dark:hover:bg-white/10'}`}
                          style={{ fontFamily: getStickyFontStack(font.fontFamily) }}
                        >
                          <span className="min-w-0 truncate">{font.fontFamily}</span>
                          {isSelected && <Check size={12} className="shrink-0 opacity-60" />}
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <div className="mt-1.5 rounded-md bg-black/5 dark:bg-black/20 px-2 py-1.5 text-sm text-black/70 dark:text-white/70 transition-[font-family]" style={noteTextStyle}>
              Quick note sample
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 relative flex flex-col">
        <LexicalEditor
          key={clearKey}
          initialContent={note.content}
          noteId={note.id}
          onSave={handleSave}
          onChange={handleInstantChange}
          isEditing={true}
          style={noteTextStyle}
        />

        {/* Color Picker Overlay */}
        <AnimatePresence>
          {showColors && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 w-max max-w-[calc(100%-2rem)] p-2.5 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl rounded-2xl shadow-2xl flex flex-wrap justify-center gap-3 items-center border border-black/5 dark:border-white/10 z-10"
            >
              {COLORS.map(c => (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  key={c}
                  onClick={() => changeColor(c)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full border border-black/5 transition-all hover:scale-110 active:scale-95 shadow-sm ${note.color === c ? 'ring-2 ring-black/10 ring-offset-2' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Resize Handle */}
      {!isMax && (
        <div
          onMouseDown={handleResize}
          onTouchStart={handleResize}
          className="absolute bottom-1 right-1 w-6 h-6 cursor-nwse-resize flex items-center justify-center text-black/10 hover:text-black/30 transition-colors"
        >
          <CornerRightDown size={12} className="rotate-45" />
        </div>
      )}

      {/* Footer Info */}
      <div className="h-7 px-4 flex items-center justify-between opacity-20 select-none border-t border-black/[0.03]">
        <span className="text-[8px] font-mono uppercase tracking-[0.1em] font-bold">
          Lexical Note
        </span>
        <span className="text-[8px] font-mono uppercase tracking-[0.1em] font-bold">
          {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}
