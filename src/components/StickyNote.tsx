import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, Trash2, GripVertical, Clipboard, ClipboardPaste, CopyPlus, Check, Eraser, Type, Minus, Plus, MoreHorizontal, Undo2, Redo2, ImageDown, Hash, Code2, ArrowUpToLine, ArrowDownToLine, Lock, LockOpen } from 'lucide-react';
import type { StickyNote as IStickyNote } from '../lib/db';
import { FONTS, loadGoogleFont, loadFontsFromContent } from '../utils/fontRegistry';
import { getMinNoteWidth } from '../utils/NoteUtils';
import LexicalEditor from './notes/editor/LexicalEditor';
import type { HistoryState } from './notes/editor/LexicalEditor';
import { UNDO_COMMAND, REDO_COMMAND, $getRoot, $getSelection, $isRangeSelection, $createParagraphNode, $isRootNode, LexicalNode, LexicalEditor as ILexicalEditor } from 'lexical';



import { $convertToMarkdownString, TRANSFORMERS } from '@lexical/markdown';
import { $generateHtmlFromNodes } from '@lexical/html';
import * as snapdom from '@zumer/snapdom';
import { copyCanvas } from '../utils/tableImage';
import { FontPicker } from './FontPicker';

import StickyConfirmModal from './notes/StickyConfirmModal';
import { pasteFromClipboard } from './notes/editor/plugins/BlockMenuOptions';

const DEFAULT_STICKY_FONT = 'Hind';
const DEFAULT_FONT_SIZE = 15;
const FULLSCREEN_DEFAULT_FONT_SIZE = 18;
const MIN_NOTE_HEIGHT = 180;
const MIN_FONT_SIZE = 12;
const MAX_FONT_SIZE = 28;
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

/**
 * One surface for every popover, so the note reads as a single piece of UI. note-export-hide
 * keeps whichever popover is open out of the picture when the note is copied as an image.
 */
const POPOVER_SURFACE =
  'note-export-hide rounded-2xl border border-black/7 dark:border-white/12 bg-white/95 dark:bg-[#1c1c1f]/95 shadow-[0_20px_44px_-16px_rgba(0,0,0,0.45)] backdrop-blur-xl';
const POPOVER_LABEL =
  'px-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-black/40 dark:text-white/40';
const TOOL_BUTTON =
  'flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg text-black/55 dark:text-white/55 transition-colors hover:bg-black/6 dark:hover:bg-white/10 hover:text-black/85 dark:hover:text-white/90 disabled:pointer-events-none disabled:opacity-30';
const TOOL_BUTTON_ACTIVE =
  'flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg bg-black/8 dark:bg-white/16 text-black/85 dark:text-white transition-colors';
const MENU_ITEM =
  'flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium text-black/75 dark:text-white/75 transition-colors hover:bg-black/6 dark:hover:bg-white/10 hover:text-black dark:hover:text-white disabled:pointer-events-none disabled:opacity-35';

const TIME_FORMAT = new Intl.DateTimeFormat([], { hour: '2-digit', minute: '2-digit' });

/**
 * getMinNoteWidth() calls matchMedia, which is too expensive to run on every render of an
 * animating element. This reads it once and only again when the breakpoint is actually crossed.
 */
const useMinNoteWidth = () => {
  const [minWidth, setMinWidth] = useState(getMinNoteWidth);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 639px)');
    const sync = () => setMinWidth(getMinNoteWidth());
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  return minWidth;
};

function StickyNote({ note, onDelete, onUpdate, onDuplicate, onFocus }: Props) {
  const latestNoteRef = useRef(note);
  latestNoteRef.current = note;

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
      latestContentRef.current = note.content;
    }
  }, [note.content, content]);

  const [showColors, setShowColors] = useState(false);
  const [showTypography, setShowTypography] = useState(false);
  const [showMoreActions, setShowMoreActions] = useState(false);
  const [previewFontFamily, setPreviewFontFamily] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState(false);
  // Which of the copy actions just ran, so its row can show a tick
  const [copiedKind, setCopiedKind] = useState<string | null>(null);
  const copiedTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
  }, []);
  const [duplicateStatus, setDuplicateStatus] = useState(false);
  const [clearKey, setClearKey] = useState(0);
  const [history, setHistory] = useState<HistoryState>({ canUndo: false, canRedo: false });
  const containerRef = useRef<HTMLDivElement>(null);

  // Size while a resize is in progress; null when the stored size is in charge
  const [liveSize, setLiveSize] = useState<{ width: number; height: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; width: number; height: number; startWidth: number; startHeight: number; frame: number } | null>(null);
  const resizeHandleRef = useRef<HTMLDivElement>(null);
  const minNoteWidth = useMinNoteWidth();

  const updatedLabel = useMemo(() => TIME_FORMAT.format(note.updatedAt), [note.updatedAt]);
  const editorRef = useRef<ILexicalEditor | null>(null);

  const isReadOnly = !!note.isReadOnly;
  const toggleReadOnly = useCallback(() => {
    onUpdate({ ...latestNoteRef.current, content: latestContentRef.current, isReadOnly: !latestNoteRef.current.isReadOnly, updatedAt: Date.now() });
  }, [onUpdate]);

  /** Whatever is on the clipboard, dropped into the note where the cursor is. */
  const pasteIntoNote = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || isReadOnly) return;
    editor.focus();
    const landed = await pasteFromClipboard(editor);
    if (landed) flashCopiedRef.current?.('pasted');
  }, [isReadOnly]);

  // Assigned below, once flashCopied exists; kept in a ref so the callback above stays stable.
  const flashCopiedRef = useRef<((kind: string) => void) | null>(null);



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
    loadGoogleFont(activeFontFamily);
    if (content) {
      loadFontsFromContent(content);
    }
  }, [activeFontFamily, content]);

  useEffect(() => {
    if (!showTypography) setPreviewFontFamily(null);
  }, [showTypography]);

  const moreActionsRef = useRef<HTMLDivElement>(null);
  const moreActionsBtnRef = useRef<HTMLButtonElement>(null);
  const typographyRef = useRef<HTMLDivElement>(null);
  const typographyBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!showMoreActions) return;
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (
        moreActionsRef.current &&
        !moreActionsRef.current.contains(target) &&
        moreActionsBtnRef.current &&
        !moreActionsBtnRef.current.contains(target)
      ) {
        setShowMoreActions(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick, true);
    };
  }, [showMoreActions]);

  useEffect(() => {
    if (!showTypography) return;
    const handleOutsideClick = (e: MouseEvent | PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const fontPickerPortal = document.querySelector('.font-picker-portal');
      if (fontPickerPortal && fontPickerPortal.contains(target)) return;

      if (
        typographyRef.current &&
        !typographyRef.current.contains(target) &&
        typographyBtnRef.current &&
        !typographyBtnRef.current.contains(target)
      ) {
        setShowTypography(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick, true);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick, true);
    };
  }, [showTypography]);



  const handleSave = useCallback((newContent: string) => {
    setContent(newContent);
    latestContentRef.current = newContent;
    justSavedRef.current = true;
    onUpdate({ ...latestNoteRef.current, content: newContent, updatedAt: Date.now() });
  }, [onUpdate]);

  const handleInstantChange = (newContent: string) => {
    latestContentRef.current = newContent;
  };

  const handleHistoryChange = useCallback((state: HistoryState) => setHistory(state), []);

  // Clearing the text remounts the editor, which starts it with an empty history
  useEffect(() => {
    setHistory({ canUndo: false, canRedo: false });
  }, [clearKey]);

  const undo = useCallback(() => editorRef.current?.dispatchCommand(UNDO_COMMAND, undefined), []);
  const redo = useCallback(() => editorRef.current?.dispatchCommand(REDO_COMMAND, undefined), []);

  const addLine = useCallback((where: 'before' | 'after') => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.update(() => {
      const selection = $getSelection();
      let targetBlock: LexicalNode | null = null;
      if ($isRangeSelection(selection)) {
        const anchorNode = selection.anchor.getNode();
        let current: LexicalNode | null = anchorNode;
        while (current) {
          const parent: LexicalNode | null = current.getParent();
          if (parent === null) break;
          if ($isRootNode(parent)) {
            targetBlock = current;
            break;
          }
          current = parent;
        }
      }

      const root = $getRoot();
      const paragraph = $createParagraphNode();

      if (targetBlock && targetBlock.getParent()) {
        if (where === 'before') {
          targetBlock.insertBefore(paragraph);
        } else {
          targetBlock.insertAfter(paragraph);
        }
      } else {
        if (where === 'before') {
          const firstChild = root.getFirstChild();
          if (firstChild) {
            firstChild.insertBefore(paragraph);
          } else {
            root.append(paragraph);
          }
        } else {
          root.append(paragraph);
        }
      }
      paragraph.select();
    });
    editor.focus();
  }, []);

  const toggleMinimize = () => {
    onUpdate({ ...latestNoteRef.current, content: latestContentRef.current, isMinimized: !note.isMinimized, updatedAt: Date.now() });
  };

  const toggleMaximize = () => {
    onUpdate({ ...latestNoteRef.current, content: latestContentRef.current, isMaximized: !note.isMaximized, updatedAt: Date.now() });
  };

  const changeColor = (color: string) => {
    onUpdate({ ...latestNoteRef.current, content: latestContentRef.current, color, updatedAt: Date.now() });
    setShowColors(false);
    setShowMoreActions(false);
  };

  const changeFontFamily = useCallback((fontFamily: string) => {
    loadGoogleFont(fontFamily);
    setPreviewFontFamily(null);
    latestNoteRef.current = { ...latestNoteRef.current, fontFamily };
    onUpdate({ ...latestNoteRef.current, content: latestContentRef.current, fontFamily, updatedAt: Date.now() });
  }, [onUpdate]);


  const changeFontSize = useCallback((delta: number) => {
    const fontSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, clampedFontSize + delta));
    onUpdate({ ...latestNoteRef.current, content: latestContentRef.current, fontSize, updatedAt: Date.now() });
  }, [clampedFontSize, onUpdate]);

  const handleDragEnd = (_: any, info: any) => {
    if (note.isMaximized) return;
    // A resize that leaked into a drag would write the old size back over the new one
    if (resizeRef.current) return;
    const newX = note.x + info.offset.x;
    const newY = note.y + info.offset.y;
    onUpdate({ ...latestNoteRef.current, content: latestContentRef.current, x: newX, y: newY, updatedAt: Date.now() });
  };

  // Resizing used to write to the database on every pointer move, and each write re-ran the
  // live query that re-renders every note. Now the gesture only moves local state, at most once
  // per frame, and the note is saved once when the pointer is released.
  // Read by the native listener below without making it re-subscribe on every change
  const resizeStartSizeRef = useRef({ width: note.width, height: note.height, minWidth: minNoteWidth });
  resizeStartSizeRef.current = { width: note.width, height: note.height, minWidth: minNoteWidth };

  /**
   * Framer Motion arms dragging from a native pointerdown listener on the note itself. A React
   * handler here runs later, at the React root, so the note had already begun dragging and its
   * drag-end write then put the old size back. Starting the resize from a native listener on the
   * handle lets stopPropagation land before Motion ever sees the event.
   */
  useEffect(() => {
    const handle = resizeHandleRef.current;
    if (!handle) return;

    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture?.(e.pointerId);

      const { width, height, minWidth } = resizeStartSizeRef.current;
      const startWidth = Math.max(width, minWidth);
      const startHeight = Math.max(height, MIN_NOTE_HEIGHT);
      resizeRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startWidth,
        startHeight,
        width: startWidth,
        height: startHeight,
        frame: 0,
      };
      setLiveSize({ width: startWidth, height: startHeight });
    };

    handle.addEventListener('pointerdown', onPointerDown);
    return () => handle.removeEventListener('pointerdown', onPointerDown);
  }, [isMax]);

  const handleResizeMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const state = resizeRef.current;
    if (!state) return;

    state.width = Math.max(minNoteWidth, state.startWidth + (e.clientX - state.startX));
    state.height = Math.max(MIN_NOTE_HEIGHT, state.startHeight + (e.clientY - state.startY));

    // Pointer events can fire several times per frame; one repaint per frame is plenty
    if (state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      setLiveSize({ width: state.width, height: state.height });
    });
  }, [minNoteWidth]);

  const handleResizeEnd = useCallback(() => {
    const state = resizeRef.current;
    if (!state) return;
    if (state.frame) cancelAnimationFrame(state.frame);
    resizeRef.current = null;
    // liveSize is kept until the saved note catches up, otherwise the note springs back to its
    // old size for the frames between releasing the pointer and the database write arriving.
    onUpdate({ ...latestNoteRef.current, content: latestContentRef.current, width: state.width, height: state.height, updatedAt: Date.now() });
  }, [onUpdate]);

  useEffect(() => {
    if (!liveSize || resizeRef.current) return;
    if (note.width === liveSize.width && note.height === liveSize.height) setLiveSize(null);
  }, [note.width, note.height, liveSize]);

  // A resize left running by an unmount would keep its frame queued
  useEffect(() => () => {
    if (resizeRef.current?.frame) cancelAnimationFrame(resizeRef.current.frame);
  }, []);

  // The stored content is the editor's serialised state, so the readable text is read from the
  // editor itself. Copying used to hand over that raw JSON.
  const handleCopy = () => {
    let text = '';
    editorRef.current?.getEditorState().read(() => {
      text = $getRoot().getTextContent();
    });
    if (!text) return;

    navigator.clipboard.writeText(text);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const flashCopied = useCallback((kind: string) => {
    setCopiedKind(kind);
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = window.setTimeout(() => setCopiedKind(null), 1600);
  }, []);
  flashCopiedRef.current = flashCopied;



  /** The note's text as Markdown, headings, lists and all */
  const copyAsMarkdown = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    let markdown = '';
    editor.getEditorState().read(() => {
      markdown = $convertToMarkdownString(TRANSFORMERS);
    });
    if (!markdown.trim()) return;

    try {
      await navigator.clipboard.writeText(markdown);
      flashCopied('markdown');
    } catch (err) {
      console.error('Copying the note as Markdown failed', err);
    }
  }, [flashCopied]);

  /**
   * Written to the clipboard as rich text as well as source, so pasting into a document keeps
   * the formatting while pasting into an editor gives you the markup.
   */
  const copyAsHtml = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    let html = '';
    editor.getEditorState().read(() => {
      html = $generateHtmlFromNodes(editor, null);
    });
    if (!html.trim()) return;

    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([html], { type: 'text/plain' }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(html);
      }
      flashCopied('html');
    } catch (err) {
      console.error('Copying the note as HTML failed', err);
    }
  }, [flashCopied]);

  /** A picture of the note itself, with the toolbar and footer left out */
  const copyAsImage = useCallback(async () => {
    const element = containerRef.current;
    if (!element) return;

    /**
     * The note is a fixed-size box with the editor scrolling inside it, so capturing it directly
     * only gets what happens to be on screen. This copies it off to the side, opens up every
     * scrolling area so the whole note is laid out at its true height, and photographs that.
     */
    const clone = element.cloneNode(true) as HTMLElement;

    // cloneNode keeps the tree identical, so the two walk in step and computed styles carry over
    const originals = [element, ...Array.from(element.querySelectorAll('*'))];
    const copies = [clone, ...Array.from(clone.querySelectorAll('*'))];
    originals.forEach((original, i) => {
      const copy = copies[i];
      if (!(original instanceof HTMLElement) || !(copy instanceof HTMLElement)) return;

      const styles = getComputedStyle(original);
      const scrolls = ['auto', 'scroll'].includes(styles.overflowY) || ['auto', 'scroll'].includes(styles.overflowX);
      if (scrolls || original.scrollHeight > original.clientHeight + 1) {
        copy.style.setProperty('overflow', 'visible', 'important');
        copy.style.setProperty('max-height', 'none', 'important');
        copy.style.setProperty('height', 'auto', 'important');
      }
    });

    // Parked off screen, free of the note's fixed placement and its animated size
    clone.style.setProperty('position', 'fixed', 'important');
    clone.style.setProperty('left', '-10000px', 'important');
    clone.style.setProperty('top', '0', 'important');
    clone.style.setProperty('transform', 'none', 'important');
    clone.style.setProperty('width', `${element.getBoundingClientRect().width}px`, 'important');
    clone.style.setProperty('height', 'auto', 'important');
    clone.style.setProperty('max-height', 'none', 'important');
    clone.style.setProperty('overflow', 'visible', 'important');
    document.body.appendChild(clone);

    try {
      const canvas = await snapdom.snapdom.toCanvas(clone, {
        scale: 2,
        embedFonts: true,
        backgroundColor: note.color,
        // Dropped rather than hidden, so the picture has no empty band where they were
        exclude: ['.note-export-hide'],
        excludeMode: 'remove',
      });
      const result = await copyCanvas(canvas, `sticky-note-${note.id.slice(0, 6)}.png`);
      flashCopied(result === 'copied' ? 'image' : 'image-saved');
    } catch (err) {
      console.error('Copying the note as an image failed', err);
    } finally {
      clone.remove();
    }
  }, [note.color, note.id, flashCopied]);

  const handleDuplicateClick = () => {
    setDuplicateStatus(true);
    onDuplicate({ ...note, content: latestContentRef.current });
    setTimeout(() => setDuplicateStatus(false), 500);
  };

  const handleMobileCopy = () => {
    handleCopy();
    setShowMoreActions(false);
  };

  const handleMobileDuplicateClick = () => {
    handleDuplicateClick();
    setShowMoreActions(false);
  };

  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { },
  });

  const handleClearContent = useCallback(() => {
    setConfirmConfig({
      isOpen: true,
      title: 'Clear Note Text',
      message: 'Are you sure you want to clear all text in this sticky note?',
      confirmText: 'Clear Text',
      onConfirm: () => {
        setContent('');
        latestContentRef.current = '';
        setClearKey(prev => prev + 1);
        justSavedRef.current = true;
        onUpdate({ ...latestNoteRef.current, content: '', updatedAt: Date.now() });
      },
    });
  }, [onUpdate]);


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
        width: isMax ? '100vw' : (liveSize ? liveSize.width : Math.max(note.width, minNoteWidth)),
        height: isMax ? '100dvh' : (liveSize ? liveSize.height : Math.max(note.height, MIN_NOTE_HEIGHT)),
        zIndex: isMax ? 30000 : (note.zIndex || 20000),
      }}
      transition={liveSize ? { duration: 0 } : { type: 'spring', damping: 25, stiffness: 300 }}
      className={`fixed bg-white dark:bg-[#161618] text-black dark:text-white/90 overflow-hidden flex flex-col group shadow-[0_18px_40px_-16px_rgba(0,0,0,0.30)] dark:shadow-[0_24px_52px_-18px_rgba(0,0,0,0.75)] transition-shadow hover:shadow-[0_26px_56px_-16px_rgba(0,0,0,0.38)] dark:hover:shadow-[0_32px_68px_-18px_rgba(0,0,0,0.85)] ${isMax ? 'rounded-none' : 'rounded-[22px] ring-1 ring-black/6 dark:ring-white/10'
        }`}
      style={{
        backgroundImage: `linear-gradient(160deg, ${note.color}22, ${note.color}08 45%, transparent 75%)`,
        pointerEvents: 'auto',
      }}
      onPointerDown={() => onFocus(note.id)}
    >
      {/* A thin band of the note's colour, so the colour actually reads */}
      <div
        className={`absolute inset-x-0 top-0 h-1 ${isMax ? '' : 'rounded-t-[22px]'}`}
        style={{ backgroundColor: note.color }}
      />

      {/* Header / Drag Handle */}
      <div className={`note-export-hide relative h-12 flex items-center justify-between gap-1.5 sm:gap-2 pl-2 sm:pl-2.5 pr-2 sm:pr-2.5 cursor-grab active:cursor-grabbing shrink-0 ${isMax ? 'cursor-default' : ''}`}>
        <div className="flex items-center gap-1 min-w-0">
          {!isMax && (
            <span
              className="hidden sm:flex h-8 w-5 items-center justify-center text-black/20 dark:text-white/20 transition-colors group-hover:text-black/35 dark:group-hover:text-white/35"
              title="Drag note"
            >
              <GripVertical size={15} />
            </span>
          )}
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => {
              setShowColors(prev => !prev);
              setShowTypography(false);
              setShowMoreActions(false);
            }}
            className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-lg transition-colors hover:bg-black/6 dark:hover:bg-white/10"
            title="Change colour"
          >
            <span
              className="h-4 w-4 rounded-full ring-1 ring-inset ring-black/15 dark:ring-white/25"
              style={{ backgroundColor: note.color }}
            />
          </button>
        </div>

        <div className="flex items-center gap-0.5 shrink-0 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity">
          <button
            ref={typographyBtnRef}
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => {
              setShowTypography(prev => !prev);
              setShowColors(false);
              setShowMoreActions(false);
            }}
            className={showTypography ? TOOL_BUTTON_ACTIVE : TOOL_BUTTON}
            title="Text style"
          >
            <Type size={15} />
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={undo}
            disabled={!history.canUndo || isReadOnly}
            className={TOOL_BUTTON}
            title={history.canUndo ? 'Undo' : 'Nothing to undo'}
          >
            <Undo2 size={15} />
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={redo}
            disabled={!history.canRedo || isReadOnly}
            className={TOOL_BUTTON}
            title={history.canRedo ? 'Redo' : 'Nothing to redo'}
          >
            <Redo2 size={15} />
          </button>

          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => addLine('before')}
            disabled={isReadOnly}
            className={TOOL_BUTTON}
            title="Add line above"
          >
            <ArrowUpToLine size={15} />
          </button>
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onClick={() => addLine('after')}
            disabled={isReadOnly}
            className={TOOL_BUTTON}
            title="Add line below"
          >
            <ArrowDownToLine size={15} />
          </button>

          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={toggleReadOnly}
            className={isReadOnly ? TOOL_BUTTON_ACTIVE : TOOL_BUTTON}
            title={isReadOnly ? 'Locked for reading - press to edit' : 'Lock for reading'}
            aria-pressed={isReadOnly}
          >
            {isReadOnly ? <Lock size={15} /> : <LockOpen size={15} />}
          </button>

          <button
            ref={moreActionsBtnRef}
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={() => {
              setShowMoreActions(prev => !prev);
              setShowColors(false);
              setShowTypography(false);
            }}
            className={showMoreActions ? TOOL_BUTTON_ACTIVE : TOOL_BUTTON}
            title="More actions"
          >
            <MoreHorizontal size={15} />
          </button>

          <span className="mx-0.5 sm:mx-1 h-4 sm:h-5 w-px bg-black/10 dark:bg-white/10" />

          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={toggleMaximize}
            className={TOOL_BUTTON}
            title={isMax ? 'Restore' : 'Fullscreen'}
          >
            {isMax ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <button
            type="button"
            onPointerDown={handleActionPointerDown}
            onClick={toggleMinimize}
            className={TOOL_BUTTON}
            title="Close to list"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* More actions */}
      <AnimatePresence>
        {showMoreActions && (
          <motion.div
            ref={moreActionsRef}
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={`absolute top-13 right-2.5 z-30 w-52 max-w-[calc(100%-1.25rem)] p-1.5 ${POPOVER_SURFACE}`}
            onPointerDown={handleActionPointerDown}
            onClick={(e) => e.stopPropagation()}
          >
            <button type="button" onClick={handleMobileCopy} className={MENU_ITEM}>
              {copyStatus ? <Check size={15} className="shrink-0 text-emerald-500" /> : <Clipboard size={15} className="shrink-0 opacity-60" />}
              <span>{copyStatus ? 'Copied' : 'Copy text'}</span>
            </button>
            <button type="button" onClick={copyAsMarkdown} className={MENU_ITEM}>
              {copiedKind === 'markdown' ? <Check size={15} className="shrink-0 text-emerald-500" /> : <Hash size={15} className="shrink-0 opacity-60" />}
              <span>{copiedKind === 'markdown' ? 'Copied' : 'Copy as Markdown'}</span>
            </button>
            <button type="button" onClick={copyAsHtml} className={MENU_ITEM}>
              {copiedKind === 'html' ? <Check size={15} className="shrink-0 text-emerald-500" /> : <Code2 size={15} className="shrink-0 opacity-60" />}
              <span>{copiedKind === 'html' ? 'Copied' : 'Copy as HTML'}</span>
            </button>
            <button type="button" onClick={copyAsImage} className={MENU_ITEM}>
              {copiedKind === 'image' || copiedKind === 'image-saved'
                ? <Check size={15} className="shrink-0 text-emerald-500" />
                : <ImageDown size={15} className="shrink-0 opacity-60" />}
              <span>
                {copiedKind === 'image' ? 'Copied' : copiedKind === 'image-saved' ? 'Saved' : 'Copy as image'}
              </span>
            </button>

            <div className="my-1 h-px bg-black/7 dark:bg-white/10" />

            <button
              type="button"
              onClick={() => {
                setShowMoreActions(false);
                void pasteIntoNote();
              }}
              disabled={isReadOnly}
              className={MENU_ITEM}
            >
              {copiedKind === 'pasted'
                ? <Check size={15} className="shrink-0 text-emerald-500" />
                : <ClipboardPaste size={15} className="shrink-0 opacity-60" />}
              <span>{copiedKind === 'pasted' ? 'Pasted' : 'Paste from clipboard'}</span>
            </button>

            <button type="button" onClick={handleMobileDuplicateClick} className={MENU_ITEM}>
              <CopyPlus size={15} className="shrink-0 opacity-60" />
              <span>Duplicate note</span>
            </button>

            <div className="my-1 h-px bg-black/7 dark:bg-white/10" />

            <button
              type="button"
              onClick={() => {
                setShowMoreActions(false);
                handleClearContent();
              }}
              className={MENU_ITEM}
            >
              <Eraser size={15} className="shrink-0 opacity-60" />
              <span>Clear text</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowMoreActions(false);
                setConfirmConfig({
                  isOpen: true,
                  title: 'Delete Sticky Note',
                  message: 'Are you sure you want to delete this sticky note? This action cannot be undone.',
                  confirmText: 'Delete Note',
                  onConfirm: () => onDelete(note.id),
                });
              }}
              className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-[13px] font-medium text-red-600 dark:text-red-400 transition-colors hover:bg-red-500/10"
            >
              <Trash2 size={15} className="shrink-0" />
              <span>Delete note</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Text style */}
      <AnimatePresence>
        {showTypography && (
          <motion.div
            ref={typographyRef}
            initial={{ opacity: 0, scale: 0.97, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -6 }}
            transition={{ duration: 0.14, ease: 'easeOut' }}
            className={`absolute top-13 right-2.5 z-30 w-60 max-w-[calc(100%-1.25rem)] p-3 ${POPOVER_SURFACE}`}
            onPointerDown={handleActionPointerDown}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={POPOVER_LABEL}>Size</div>
            <div className="mt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => changeFontSize(-1)}
                disabled={clampedFontSize <= MIN_FONT_SIZE}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/7 dark:border-white/12 text-black/70 dark:text-white/70 transition-colors hover:bg-black/6 dark:hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
                title="Smaller"
              >
                <Minus size={15} />
              </button>
              <div className="flex h-9 flex-1 items-center justify-center rounded-xl bg-black/5 dark:bg-white/8 text-[13px] font-semibold tabular-nums text-black/80 dark:text-white/85">
                {clampedFontSize}px
              </div>
              <button
                type="button"
                onClick={() => changeFontSize(1)}
                disabled={clampedFontSize >= MAX_FONT_SIZE}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-black/7 dark:border-white/12 text-black/70 dark:text-white/70 transition-colors hover:bg-black/6 dark:hover:bg-white/10 disabled:pointer-events-none disabled:opacity-30"
                title="Bigger"
              >
                <Plus size={15} />
              </button>
            </div>

            <div className={`${POPOVER_LABEL} mt-4`}>Typeface</div>
            {/* The full picker, with search, favourites and hover preview */}
            <div className="mt-1.5">
              <FontPicker
                value={activeFontFamily}
                onChange={changeFontFamily}
                onHover={(family) => setPreviewFontFamily(family)}
                selectedText="The quick brown fox"
                triggerClassName="!py-2 rounded-lg"
                triggerTextClass="text-black/80 dark:text-white/80"
                triggerSurfaceClass="bg-black/4 border-black/8 dark:bg-white/6 dark:border-white/12 rounded-lg"
                menuSurfaceClass="bg-white dark:bg-[#1E1E1E] border-black/10 dark:border-[#3A3A3A]"
              />
            </div>
            <div className="mt-3 rounded-xl bg-black/4 dark:bg-black/25 px-3 py-2.5">
              <div className={`${POPOVER_LABEL} px-0 pb-1`}>Preview</div>
              <div className="text-black/70 dark:text-white/75 truncate" style={noteTextStyle}>
                The quick brown fox
              </div>
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
          isReadOnly={isReadOnly}
          style={noteTextStyle}
          editorRef={editorRef}
          onHistoryChange={handleHistoryChange}
        />



        {/* Color Picker Overlay */}
        <AnimatePresence>
          {showColors && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={{ duration: 0.14, ease: 'easeOut' }}
              className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex w-max max-w-[calc(100%-2rem)] flex-wrap items-center justify-center gap-2 p-2 ${POPOVER_SURFACE}`}
            >
              {COLORS.map(c => (
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  key={c}
                  onClick={() => changeColor(c)}
                  title="Change colour"
                  className={`h-7 w-7 rounded-full transition-transform hover:scale-110 active:scale-95 ${note.color === c
                    ? 'ring-2 ring-black/30 dark:ring-white/60 ring-offset-2 ring-offset-white dark:ring-offset-[#1c1c1f]'
                    : 'ring-1 ring-inset ring-black/10 dark:ring-white/20'
                    }`}
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
          ref={resizeHandleRef}
          onPointerMove={handleResizeMove}
          onPointerUp={handleResizeEnd}
          onPointerCancel={handleResizeEnd}
          style={{ touchAction: 'none' }}
          className="note-export-hide absolute bottom-0 right-0 w-7 h-7 cursor-nwse-resize flex items-end justify-end p-1.5 text-black/20 dark:text-white/20 opacity-0 group-hover:opacity-100 hover:text-black/45 dark:hover:text-white/45 transition-all"
          title="Drag to resize"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M9 1v8H1" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* Footer Info */}
      <div className="note-export-hide h-7 shrink-0 px-4 flex items-center justify-end select-none">
        <span className="text-[10px] font-medium tabular-nums text-black/25 dark:text-white/25">
          Edited {updatedLabel}
        </span>
      </div>

      <StickyConfirmModal
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        confirmText={confirmConfig.confirmText}
        onConfirm={confirmConfig.onConfirm}
        onClose={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
      />
    </motion.div>
  );
}

/**
 * Dexie hands back freshly built objects on every query, so each note gets a new `note` prop
 * whenever any note changes. Comparing the fields keeps untouched notes from re-rendering.
 */
export default memo(StickyNote, (prev, next) =>
  prev.onDelete === next.onDelete &&
  prev.onUpdate === next.onUpdate &&
  prev.onDuplicate === next.onDuplicate &&
  prev.onFocus === next.onFocus &&
  prev.note.id === next.note.id &&
  prev.note.content === next.note.content &&
  prev.note.color === next.note.color &&
  prev.note.x === next.note.x &&
  prev.note.y === next.note.y &&
  prev.note.width === next.note.width &&
  prev.note.height === next.note.height &&
  prev.note.zIndex === next.note.zIndex &&
  prev.note.isMinimized === next.note.isMinimized &&
  prev.note.isMaximized === next.note.isMaximized &&
  prev.note.isReadOnly === next.note.isReadOnly &&
  prev.note.fontFamily === next.note.fontFamily &&
  prev.note.fontSize === next.note.fontSize &&
  prev.note.updatedAt === next.note.updatedAt
);
