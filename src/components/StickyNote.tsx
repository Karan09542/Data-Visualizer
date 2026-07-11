import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, Trash2, GripVertical, Edit2, Palette, Clipboard, CornerRightDown, CopyPlus, Check, Eraser, ListTodo, Square, CheckSquare, Type, Minus, Plus, ChevronDown, MoreVertical } from 'lucide-react';
import type { StickyNote as IStickyNote } from '../lib/db';
import { FONTS, loadGoogleFont } from '../utils/fontRegistry';

const CHECKLIST_REGEX = /^(\s*[-*]\s+\[)([ xX])(\]\s*)(.*)$/;
const CHECKLIST_TOGGLE_REGEX = /^(\s*[-*]\s+\[)([ xX])(\]\s*.*)$/;
const BULLET_REGEX = /^(\s*[-*]\s+)(?!\[[ xX]\]\s*)(.*)$/;
const LIST_CONTINUATION_REGEX = /^(\s*)([-*])\s+(?:\[([ xX])\]\s*)?(.*)$/;

const DEFAULT_STICKY_FONT = 'Hind';
const DEFAULT_FONT_SIZE = 15;
const FULLSCREEN_DEFAULT_FONT_SIZE = 18;
const MIN_NOTE_HEIGHT = 180;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
const STICKY_FONT_IDS = ['hind', 'mukta', 'poppins', 'inter', 'tirodevanagari', 'martel', 'baloo2', 'opensans'];
const STICKY_FONT_OPTIONS = FONTS.filter(font => STICKY_FONT_IDS.includes(font.id));
const getStickyFontStack = (fontFamily: string) => `"${fontFamily}", "Noto Sans Devanagari", "Noto Sans", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

const MOBILE_BREAKPOINT = 640;

const getMinNoteWidth = () => {
  if (typeof window === 'undefined') return 360;

  return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches
    ? 300
    : 360;
};

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
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const justSavedRef = useRef(false);

  useEffect(() => {
    if (!isEditing) {
      if (justSavedRef.current) {
        if (note.content === content) {
          justSavedRef.current = false;
        }
      } else {
        setContent(note.content);
      }
    }
  }, [note.content, isEditing, content]);

  const [showColors, setShowColors] = useState(false);
  const [showTypography, setShowTypography] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const [previewFontFamily, setPreviewFontFamily] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState(false);
  const [duplicateStatus, setDuplicateStatus] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    justSavedRef.current = true;
    onUpdate({ ...note, content, updatedAt: Date.now() });
  };

  const toggleMinimize = () => {
    onUpdate({ ...note, content, isMinimized: !note.isMinimized, updatedAt: Date.now() });
  };

  const toggleMaximize = () => {
    onUpdate({ ...note, content, isMaximized: !note.isMaximized, updatedAt: Date.now() });
  };

  const changeColor = (color: string) => {
    onUpdate({ ...note, content, color, updatedAt: Date.now() });
    setShowColors(false);
    setShowMobileActions(false);
  };

  const changeFontFamily = useCallback((fontFamily: string) => {
    const font = FONTS.find(f => f.fontFamily === fontFamily);
    if (font) loadGoogleFont(font.googleFontName);
    setPreviewFontFamily(null);
    setIsFontMenuOpen(false);
    onUpdate({ ...note, content, fontFamily, updatedAt: Date.now() });
  }, [content, note, onUpdate]);

  const handlePreviewFont = useCallback((fontFamily: string, googleFontName: string) => {
    loadGoogleFont(googleFontName);
    setPreviewFontFamily(fontFamily);
  }, []);

  const changeFontSize = useCallback((delta: number) => {
    const fontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, clampedFontSize + delta));
    onUpdate({ ...note, content, fontSize, updatedAt: Date.now() });
  }, [clampedFontSize, content, note, onUpdate]);

  const handleDragEnd = (_: any, info: any) => {
    if (note.isMaximized) return;
    const newX = note.x + info.offset.x;
    const newY = note.y + info.offset.y;
    onUpdate({ ...note, content, x: newX, y: newY, updatedAt: Date.now() });
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

      onUpdate({ ...note, content, width: newWidth, height: newHeight, updatedAt: Date.now() });
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
    onDuplicate({ ...note, content });
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
    if (!content) return;
    if (!confirm('Clear this sticky note text?')) return;

    setContent('');
    justSavedRef.current = true;
    onUpdate({ ...note, content: '', updatedAt: Date.now() });
  }, [content, note, onUpdate]);

  const openEditor = useCallback(() => {
    setIsEditing(true);
  }, []);

  const setContentAndCursor = useCallback((newContent: string, cursorPosition: number) => {
    setContent(newContent);
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(cursorPosition, cursorPosition);
      }
    });
  }, []);

  const handleEditorKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey) return;

    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    if (start !== end) return;

    const value = textarea.value;
    const lineStart = value.lastIndexOf('\n', start - 1) + 1;
    const nextLineBreak = value.indexOf('\n', start);
    const lineEnd = nextLineBreak === -1 ? value.length : nextLineBreak;
    const line = value.slice(lineStart, lineEnd);
    const match = LIST_CONTINUATION_REGEX.exec(line);
    if (!match) return;

    const [, indent, marker, checkState, itemText] = match;
    const isChecklist = checkState !== undefined;
    e.preventDefault();

    if (itemText.trim().length === 0) {
      const newContent = value.slice(0, lineStart) + value.slice(lineEnd);
      setContentAndCursor(newContent, lineStart);
      return;
    }

    const nextMarker = isChecklist ? `${indent}${marker} [ ] ` : `${indent}${marker} `;
    const insert = `\n${nextMarker}`;
    const newContent = value.slice(0, start) + insert + value.slice(end);
    setContentAndCursor(newContent, start + insert.length);
  }, [setContentAndCursor]);

  const handleToggleTodo = useCallback((lineIndex: number, currentChecked: boolean) => {
    const lines = content.split('\n');
    const line = lines[lineIndex];
    if (!CHECKLIST_TOGGLE_REGEX.test(line)) return;

    const newStatus = currentChecked ? ' ' : 'x';
    lines[lineIndex] = line.replace(
      CHECKLIST_TOGGLE_REGEX,
      (_, p1, _p2, p3) => `${p1}${newStatus}${p3}`
    );
    const newContent = lines.join('\n');
    setContent(newContent);
    justSavedRef.current = true;
    onUpdate({ ...note, content: newContent, updatedAt: Date.now() });
  }, [content, note, onUpdate]);

  const handleInsertChecklist = useCallback(() => {
    const template = '- [ ] ';
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const before = content.slice(0, start);
      const after = content.slice(end);
      const needsNewline = before.length > 0 && !before.endsWith('\n');
      const insert = (needsNewline ? '\n' : '') + template;
      const newContent = before + insert + after;
      setContentAndCursor(newContent, before.length + insert.length);
    } else {
      const needsNewline = content.length > 0 && !content.endsWith('\n');
      const newContent = content + (needsNewline ? '\n' : '') + template;
      setContent(newContent);
      setIsEditing(true);
    }
  }, [content, isEditing, setContentAndCursor]);

  const handleActionPointerDown = useCallback((e: React.PointerEvent<HTMLElement>) => {
    e.stopPropagation();
  }, []);

  const handleChecklistPointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const renderContentLines = useCallback(() => {
    if (!content) return <span className="opacity-20 italic font-normal">Click to edit note...</span>;
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const checkMatch = CHECKLIST_REGEX.exec(line);
      if (checkMatch) {
        const isChecked = checkMatch[2] === 'x' || checkMatch[2] === 'X';
        const text = checkMatch[4];
        return (
          <div key={idx} className="grid grid-cols-[1.35em_minmax(0,1fr)] items-start gap-x-1.5 py-[1px] group/line">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleToggleTodo(idx, isChecked);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="mt-[0.18em] flex h-[1.25em] w-[1.25em] items-center justify-center rounded transition-all duration-200 hover:scale-110 active:scale-95 focus:outline-none focus:ring-2 focus:ring-black/15"
              aria-label={isChecked ? 'Mark todo incomplete' : 'Mark todo complete'}
            >
              {isChecked ? (
                <CheckSquare size={checklistIconSize} className="text-emerald-600/80" />
              ) : (
                <Square size={checklistIconSize} className="opacity-35 group-hover/line:opacity-65 transition-opacity" />
              )}
            </button>
            <span
              className={`min-w-0 transition-all duration-200 ${isChecked ? 'line-through opacity-45' : ''
                }`}
            >
              {text || <br />}
            </span>
          </div>
        );
      }
      const bulletMatch = BULLET_REGEX.exec(line);
      if (bulletMatch && !checkMatch) {
        const text = bulletMatch[2];
        return (
          <div key={idx} className="grid grid-cols-[1.35em_minmax(0,1fr)] items-start gap-x-1.5 py-[1px]">
            <span className="mt-[0.64em] h-[0.34em] w-[0.34em] justify-self-center rounded-full bg-current opacity-35" />
            <span className="min-w-0">{text || <br />}</span>
          </div>
        );
      }
      return (
        <div key={idx} className="min-h-[1.55em]">
          {line || <br />}
        </div>
      );
    });
  }, [checklistIconSize, content, handleToggleTodo]);

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
        zIndex: isMax ? 10000 : (note.zIndex || 5000),
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`fixed shadow-2xl overflow-hidden flex flex-col group border border-black/10 dark:border-white/10 ${isMax ? 'rounded-none' : 'rounded-2xl'
        }`}
      style={{
        backgroundColor: note.color,
        backgroundImage: `linear-gradient(to bottom right, rgba(255,255,255,0.2), transparent)`,
        color: '#1a1a1a',
        pointerEvents: 'auto',
      }}
      onPointerDown={() => onFocus(note.id)}
    >
      {/* Header / Drag Handle */}
      <div className={`h-11 flex items-center justify-between pl-2 pr-3 cursor-grab active:cursor-grabbing shrink-0 bg-black/5 group-hover:bg-black/[0.08] transition-colors border-b border-black/5 ${isMax ? 'cursor-default' : ''}`}>
        <div className="flex items-center gap-1.5 min-w-0 flex-1 pr-1">
          {!isMax && (
            <span className="flex h-8 w-6 items-center justify-center rounded-md opacity-35 transition-opacity group-hover:opacity-55" title="Drag note">
              <GripVertical size={16} />
            </span>
          )}
          {isMax && <Edit2 size={14} className="opacity-30 shrink-0" />}
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] opacity-25 select-none font-sans truncate">
            {isMax ? 'Fullscreen' : 'Note'}
          </span>
        </div>

        <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0 pl-1">
          <button
            type="button"
            onPointerDown={handleChecklistPointerDown}
            onClick={handleInsertChecklist}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            title="Insert Checklist"
          >
            <ListTodo size={16} className="opacity-70" />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => {
              setShowTypography(prev => !prev);
              setShowColors(false);
              setShowMobileActions(false);
            }}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            title="Typography"
          >
            <Type size={16} className="opacity-70" />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => {
              setShowColors(!showColors);
              setShowTypography(false);
              setShowMobileActions(false);
            }}
            className="hidden sm:flex p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            title="Change Color"
          >
            <Palette size={16} className="opacity-70" />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => handleCopy(content)}
            className="hidden sm:flex p-1.5 hover:bg-black/10 rounded-lg transition-colors relative"
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
            className="hidden sm:flex p-1.5 hover:bg-black/10 rounded-lg transition-colors"
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
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors sm:hidden order-last"
            title="More Actions"
          >
            <MoreVertical size={16} className="opacity-70" />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={handleClearContent}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            title="Clear Text"
          >
            <Eraser size={16} className="opacity-70" />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={toggleMaximize}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            title={isMax ? "Restore" : "Fullscreen"}
          >
            {isMax ? <Minimize2 size={16} className="opacity-70" /> : <Maximize2 size={16} className="opacity-70" />}
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={toggleMinimize}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            title="Minimize to List"
          >
            <X size={16} className="opacity-70" />
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => onDelete(note.id)}
            className="p-1.5 hover:bg-red-500/20 text-red-700 rounded-lg transition-colors"
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
            className="absolute top-12 right-2 z-30 w-48 max-w-[calc(100%-1rem)] rounded-xl border border-black/[0.10] bg-[#fffbe8]/95 p-2 shadow-[0_12px_28px_rgba(0,0,0,0.16)] backdrop-blur-xl sm:hidden"
            onPointerDown={handleActionPointerDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-1 pb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-black/35">Color</div>
            <div className="grid grid-cols-7 gap-1.5 pb-1.5">
              {COLORS.map(c => (
                <button
                  type="button"
                  key={c}
                  onClick={() => changeColor(c)}
                  className={`h-5 w-5 rounded-full border border-black/10 shadow-sm transition-all hover:scale-110 active:scale-95 ${note.color === c ? 'ring-2 ring-black/20 ring-offset-1 ring-offset-[#fffbe8]' : ''}`}
                  style={{ backgroundColor: c }}
                  title="Change Color"
                />
              ))}
            </div>
            <div className="my-1 h-px bg-black/[0.08]" />
            <button
              type="button"
              onClick={handleMobileCopy}
              className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-black/75 transition-colors hover:bg-black/[0.06]"
            >
              {copyStatus ? <Check size={15} className="text-emerald-600" /> : <Clipboard size={15} className="opacity-70" />}
              <span>Copy</span>
            </button>
            <button
              type="button"
              onClick={handleMobileDuplicateClick}
              className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-xs font-semibold text-black/75 transition-colors hover:bg-black/[0.06]"
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
            className="absolute top-12 right-2 sm:right-3 z-20 w-52 max-w-[calc(100%-1rem)] rounded-xl border border-black/[0.08] bg-white/35 p-2 shadow-[0_8px_18px_rgba(0,0,0,0.10)] backdrop-blur-md"
            style={{
              backgroundImage: 'linear-gradient(to bottom right, rgba(255,255,255,0.30), rgba(255,255,255,0.10))',
            }}
            onPointerDown={handleActionPointerDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => changeFontSize(-1)}
                disabled={clampedFontSize <= MIN_FONT_SIZE}
                className="flex h-7 w-7 items-center justify-center rounded-md text-black/70 hover:bg-black/10 disabled:pointer-events-none disabled:opacity-25 transition-colors"
                title="Decrease Font Size"
              >
                <Minus size={15} />
              </button>
              <div className="h-7 min-w-12 flex-1 rounded-md bg-black/[0.045] px-2 text-center text-[11px] font-bold leading-7 tabular-nums text-black/70 shadow-inner shadow-white/20">
                {clampedFontSize}px
              </div>
              <button
                type="button"
                onClick={() => changeFontSize(1)}
                disabled={clampedFontSize >= MAX_FONT_SIZE}
                className="flex h-7 w-7 items-center justify-center rounded-md text-black/70 hover:bg-black/10 disabled:pointer-events-none disabled:opacity-25 transition-colors"
                title="Increase Font Size"
              >
                <Plus size={15} />
              </button>
            </div>
            <div className="relative mt-1.5">
              <button
                type="button"
                onClick={() => setIsFontMenuOpen(prev => !prev)}
                className="flex h-7 w-full items-center justify-between gap-2 rounded-md border border-black/[0.07] bg-black/[0.03] px-2 text-left text-[11px] font-semibold text-black/70 outline-none transition-colors hover:bg-black/[0.055] focus:ring-2 focus:ring-black/10"
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
                    className="absolute left-0 right-0 top-full z-50 mt-1 max-h-36 overflow-y-auto rounded-md border border-black/[0.12] bg-[#fffdf3]/95 p-1 shadow-[0_12px_28px_rgba(0,0,0,0.18)] sticky-note-scrollbar"
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
                          className={`flex h-7 w-full items-center justify-between gap-2 rounded px-2 text-left text-[11px] transition-colors ${isSelected ? 'bg-black/[0.10] text-black/90' : 'text-black/80 hover:bg-black/[0.07]'}`}
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
            <div className="mt-1.5 rounded-md bg-black/[0.03] px-2 py-1.5 text-sm text-black/60 transition-[font-family]" style={noteTextStyle}>
              Quick note sample
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <div className="flex-1 min-h-0 relative p-2 sm:p-3 overflow-hidden flex flex-col">
        <div className={`flex-1 min-h-0 flex flex-col transition-all duration-300 rounded-xl ${isEditing ? 'bg-black/[0.04] ring-1 ring-black/5' : ''}`}>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleEditorKeyDown}
              onBlur={handleSave}
              className="w-full h-full min-h-0 overflow-y-auto bg-transparent border-none focus:ring-0 focus:outline-none p-3 sm:p-4 resize-none font-medium placeholder:text-black/15 custom-scrollbar sticky-note-scrollbar"
              style={noteTextStyle}
              placeholder="Start typing your thoughts..."
            />
          ) : (
            <div
              className="w-full h-full min-h-0 font-medium whitespace-pre-wrap break-words [word-break:break-word] [overflow-wrap:anywhere] cursor-text overflow-y-auto overscroll-contain custom-scrollbar sticky-note-scrollbar p-3 sm:p-4"
              style={noteTextStyle}
              onClick={openEditor}
            >
              {renderContentLines()}
            </div>
          )}
        </div>

        {/* Color Picker Overlay */}
        <AnimatePresence>
          {showColors && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="absolute bottom-4 left-4 right-4 p-2.5 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl flex justify-between items-center border border-black/5 z-10"
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
          {content.length} chars
        </span>
        <span className="text-[8px] font-mono uppercase tracking-[0.1em] font-bold">
          {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}
