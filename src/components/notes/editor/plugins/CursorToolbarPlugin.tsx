import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection, $isRangeSelection, $setSelection, FORMAT_TEXT_COMMAND, TextFormatType,
  $isNodeSelection, COMMAND_PRIORITY_LOW, COMMAND_PRIORITY_NORMAL, SELECTION_CHANGE_COMMAND, BLUR_COMMAND,
  FORMAT_ELEMENT_COMMAND, ElementFormatType, $createParagraphNode, RangeSelection,
  $isTextNode, $isElementNode, INSERT_PARAGRAPH_COMMAND, createCommand
} from 'lexical';

export const OPEN_CURSOR_TOOLBAR_COMMAND = createCommand<void>('OPEN_CURSOR_TOOLBAR_COMMAND');
import {
  Bold, Italic, Underline, Strikethrough, Code, SquareTerminal,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Minus, Plus, RotateCcw,
  Baseline, Highlighter, Pipette, Space, Copy, Check
} from 'lucide-react';
import { $setBlocksType, $patchStyleText, $getSelectionStyleValueForProperty } from '@lexical/selection';
import { $createCodeNode } from '@lexical/code';
import { createPortal } from 'react-dom';
import { FontPicker } from '../../../FontPicker';
import { ColorPickerPortal } from '../../../image-workspace/components/shared/ColorPickers';

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 72;
const TOOLBAR_MARGIN = 10;

const TEXT_COLORS = [
  { label: 'Default', value: '' },
  { label: 'Charcoal', value: '#18181b' },
  { label: 'Slate', value: '#64748b' },
  { label: 'Red', value: '#ef4444' },
  { label: 'Rose', value: '#f43f5e' },
  { label: 'Orange', value: '#f97316' },
  { label: 'Amber', value: '#d97706' },
  { label: 'Green', value: '#16a34a' },
  { label: 'Emerald', value: '#059669' },
  { label: 'Teal', value: '#0d9488' },
  { label: 'Cyan', value: '#0284c7' },
  { label: 'Blue', value: '#2563eb' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Purple', value: '#9333ea' },
  { label: 'Fuchsia', value: '#c026d3' },
  { label: 'White', value: '#ffffff' },
];

const HIGHLIGHT_COLORS = [
  { label: 'None', value: '' },
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Lime', value: '#d9f99d' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Teal', value: '#99f6e4' },
  { label: 'Cyan', value: '#bae6fd' },
  { label: 'Blue', value: '#bfdbfe' },
  { label: 'Indigo', value: '#c7d2fe' },
  { label: 'Purple', value: '#e9d5ff' },
  { label: 'Pink', value: '#fbcfe8' },
  { label: 'Orange', value: '#fed7aa' },
  { label: 'Red', value: '#fecaca' },
  { label: 'Gray', value: '#e2e8f0' },
  { label: 'Dark', value: '#334155' },
];

/** The family alone is not a safe stack, so a fallback chain is stored with it */
const toFontStack = (family: string) =>
  `"${family}", "Noto Sans Devanagari", "Noto Sans", system-ui, -apple-system, sans-serif`;

/** Pulls the family back out of a stored stack, so the picker shows what is applied */
const fromFontStack = (stack: string) => {
  const first = stack.split(',')[0]?.trim() ?? '';
  return first.replace(/^["']|["']$/g, '');
};

const BUTTON_BASE =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors';
const BUTTON_IDLE =
  'text-black/55 hover:bg-black/6 hover:text-black dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white';
const BUTTON_ACTIVE =
  'bg-black/8 text-black dark:bg-white/16 dark:text-white';

export default function CursorToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const [copiedSelection, setCopiedSelection] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isCodeBlock, setIsCodeBlock] = useState(false);
  const [alignment, setAlignment] = useState<ElementFormatType>('left');

  const [fontFamily, setFontFamily] = useState('');
  const [fontSize, setFontSize] = useState<number | null>(null);
  const [baseFontSize, setBaseFontSize] = useState(15);
  const [textColor, setTextColor] = useState('');
  const [highlightColor, setHighlightColor] = useState('');
  const [isSpacePadded, setIsSpacePadded] = useState(false);
  const [selectedTextSnippet, setSelectedTextSnippet] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<'text' | 'highlight' | null>(null);
  const [activeColorTab, setActiveColorTab] = useState<'text' | 'highlight'>('text');
  const [previewingColor, setPreviewingColor] = useState<string | null>(null);
  const textColorBtnRef = useRef<HTMLButtonElement>(null);
  const highlightColorBtnRef = useRef<HTMLButtonElement>(null);
  const colorPickerOpenRef = useRef(false);
  colorPickerOpenRef.current = showColorPicker !== null;

  const isInteractingToolbarRef = useRef(false);
  const interactionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const markInteracting = useCallback(() => {
    isInteractingToolbarRef.current = true;
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    interactionTimerRef.current = setTimeout(() => {
      isInteractingToolbarRef.current = false;
    }, 600);
  }, []);

  const dismissNativeKeyboard = useCallback(() => {
    if (typeof document !== 'undefined') {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
      const editables = document.querySelectorAll<HTMLElement>('[contenteditable="true"]');
      editables.forEach(el => el.blur());
    }
    try {
      editor.getRootElement()?.blur();
    } catch { /* ignore */ }
    if (typeof navigator !== 'undefined' && 'virtualKeyboard' in navigator) {
      try {
        (navigator as any).virtualKeyboard?.hide?.();
      } catch { /* ignore */ }
    }
  }, [editor]);

  const setSelectionTransparent = useCallback((transparent: boolean) => {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('sticky-previewing-selection', transparent);

      let styleEl = document.getElementById('sticky-preview-selection-style') as HTMLStyleElement | null;
      if (transparent) {
        if (!styleEl) {
          styleEl = document.createElement('style');
          styleEl.id = 'sticky-preview-selection-style';
          styleEl.textContent = `
            ::selection {
              background: transparent !important;
              background-color: transparent !important;
              color: inherit !important;
              -webkit-text-fill-color: currentcolor !important;
              text-shadow: none !important;
            }
            *::selection {
              background: transparent !important;
              background-color: transparent !important;
              color: inherit !important;
              -webkit-text-fill-color: currentcolor !important;
              text-shadow: none !important;
            }
            [contenteditable]::selection,
            [contenteditable] *::selection,
            [contenteditable="true"]::selection,
            [contenteditable="true"] *::selection {
              background: transparent !important;
              background-color: transparent !important;
              color: inherit !important;
              -webkit-text-fill-color: currentcolor !important;
              text-shadow: none !important;
            }
          `;
          document.head.appendChild(styleEl);
        }
      } else {
        if (styleEl) {
          styleEl.remove();
        }
      }
    }
  }, []);

  const deselectAfterApply = useCallback(() => {
    dismissNativeKeyboard();
    editor.update(() => {
      const sel = $getSelection();
      if ($isRangeSelection(sel)) {
        sel.style = '';
      }
      $setSelection(null);
    });
    if (typeof window !== 'undefined') {
      window.getSelection()?.removeAllRanges();
      requestAnimationFrame(() => {
        window.getSelection()?.removeAllRanges();
        dismissNativeKeyboard();
      });
    }
    savedSelectionRef.current = null;
    setSelectedTextSnippet('');
    setShow(false);
    setShowColorPicker(null);
    setSelectionTransparent(false);
    setPreviewingColor(null);
  }, [editor, setSelectionTransparent, dismissNativeKeyboard]);

  useEffect(() => {
    return () => {
      if (typeof document !== 'undefined') {
        document.body.classList.remove('sticky-previewing-selection');
        document.getElementById('sticky-preview-selection-style')?.remove();
      }
    };
  }, []);

  useEffect(() => {
    if (show && showColorPicker !== null) {
      setSelectionTransparent(true);
    } else if (!previewingColor) {
      setSelectionTransparent(false);
      setPreviewingColor(null);
    }
  }, [show, showColorPicker, previewingColor, setSelectionTransparent]);

  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Opening the font list moves focus out of the editor, which would otherwise close this
  const fontMenuOpenRef = useRef(false);
  // The selection as it was before focus moved into the picker, so styles still land on it
  const savedSelectionRef = useRef<RangeSelection | null>(null);

  const updateToolbarPosition = useCallback((force?: boolean) => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!selection) {
        if (!force) setShow(false);
        return;
      }

      let element: any = null;

      if ($isRangeSelection(selection)) {
        savedSelectionRef.current = selection.clone();

        setIsBold(selection.hasFormat('bold'));
        setIsItalic(selection.hasFormat('italic'));
        setIsUnderline(selection.hasFormat('underline'));
        setIsStrikethrough(selection.hasFormat('strikethrough'));
        setIsCode(selection.hasFormat('code'));

        const storedFamily = $getSelectionStyleValueForProperty(selection, 'font-family', '');
        setFontFamily(storedFamily ? fromFontStack(storedFamily) : '');

        const storedSize = $getSelectionStyleValueForProperty(selection, 'font-size', '');
        setFontSize(storedSize ? parseInt(storedSize, 10) || null : null);

        const storedColor = $getSelectionStyleValueForProperty(selection, 'color', '');
        setTextColor(storedColor || '');

        const storedBg = $getSelectionStyleValueForProperty(selection, 'background-color', '');
        setHighlightColor(storedBg || '');

        const anchorNode = selection.anchor.getNode();
        element = anchorNode.getKey() === 'root'
          ? anchorNode
          : (typeof (anchorNode as any).getTopLevelElementOrThrow === 'function'
            ? (anchorNode as any).getTopLevelElementOrThrow()
            : (anchorNode as any).getTopLevelElement?.() || anchorNode);

        setIsCodeBlock(element.getType() === 'code');
        const format = (element as any).getFormatType?.() || 'left';
        setAlignment(format === '' ? 'left' : format);

        const text = selection.getTextContent();
        const rawSnippet = text ? text.replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, '') : '';
        setSelectedTextSnippet(rawSnippet.length > 25 ? rawSnippet.slice(0, 25) + '...' : rawSnippet);

        let isPadded = (text.startsWith('\u00A0') || text.startsWith(' ')) && (text.endsWith('\u00A0') || text.endsWith(' '));
        if (!isPadded && selection.anchor.key === selection.focus.key) {
          const node = selection.anchor.getNode();
          if ($isTextNode(node)) {
            const fullText = node.getTextContent();
            const start = Math.min(selection.anchor.offset, selection.focus.offset);
            const end = Math.max(selection.anchor.offset, selection.focus.offset);
            if (start > 0 && end < fullText.length) {
              if (fullText[start - 1] === '\u00A0' && fullText[end] === '\u00A0') {
                isPadded = true;
              }
            }
          }
        }
        setIsSpacePadded(isPadded);

        // What the text renders at now, so the stepper starts from the right number
        const dom = editor.getElementByKey(element.getKey());
        if (dom) setBaseFontSize(Math.round(parseFloat(getComputedStyle(dom).fontSize)) || 15);
      }

      let rect: DOMRect | null = null;

      if ($isNodeSelection(selection)) {
        const nodes = selection.getNodes();
        if (nodes.length > 0) {
          const el = editor.getElementByKey(nodes[0].getKey());
          if (el) rect = el.getBoundingClientRect();
        }
      } else if ($isRangeSelection(selection)) {
        const nativeSelection = window.getSelection();
        if (!nativeSelection) {
          if (!force) setShow(false);
          return;
        }

        if (nativeSelection.isCollapsed && !force) {
          const text = nativeSelection.anchorNode?.textContent || '';
          if (text.trim().length > 0) {
            setShow(false);
            return;
          }
        }
        if (nativeSelection.rangeCount > 0) {
          const r = nativeSelection.getRangeAt(0).getBoundingClientRect();
          if (r.width > 0 || r.height > 0) {
            rect = r;
          }
        }
      }

      if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) {
        if (force && element) {
          const el = editor.getElementByKey(element.getKey()) || editor.getRootElement();
          if (el) rect = el.getBoundingClientRect();
        }
      }

      if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) {
        setShow(false);
        return;
      }

      setAnchorRect(rect);
      setShow(true);
    });
  }, [editor]);

  /** Measures the toolbar, then places it below the selection, or above when there is no room */
  useLayoutEffect(() => {
    if (!show || !anchorRect) return;
    const toolbar = toolbarRef.current;
    if (!toolbar) return;

    const place = () => {
      const width = toolbar.offsetWidth;
      const height = toolbar.offsetHeight;

      const roomBelow = window.innerHeight - anchorRect.bottom - TOOLBAR_MARGIN - 8;
      const top = height <= roomBelow || roomBelow >= anchorRect.top
        ? anchorRect.bottom + 8
        : Math.max(TOOLBAR_MARGIN, anchorRect.top - 8 - height);

      const half = width / 2;
      const left = Math.max(
        half + TOOLBAR_MARGIN,
        Math.min(window.innerWidth - half - TOOLBAR_MARGIN, anchorRect.left + anchorRect.width / 2),
      );

      setPosition({ top, left });
    };

    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [show, anchorRect, showColorPicker]);

  useEffect(() => {
    const queueUpdate = () => {
      if (fontMenuOpenRef.current || colorPickerOpenRef.current || isInteractingToolbarRef.current) return;
      setShow(false);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = setTimeout(updateToolbarPosition, 600);
    };

    const handleScroll = (e: Event) => {
      if (fontMenuOpenRef.current || colorPickerOpenRef.current || isInteractingToolbarRef.current) return;
      const target = e.target as Node | null;
      if (target && toolbarRef.current && toolbarRef.current.contains(target)) {
        // Scrolling inside the toolbar itself (e.g. bold formatting row horizontal scroll) - DO NOT CLOSE!
        markInteracting();
        return;
      }
      setShow(false);
    };

    document.addEventListener('selectionchange', queueUpdate);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('selectionchange', queueUpdate);
      document.removeEventListener('scroll', handleScroll, true);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current);
    };
  }, [editor, updateToolbarPosition, markInteracting]);

  useEffect(() => {
    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND as any,
      () => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && selection.isCollapsed()) {
          const anchor = selection.anchor;
          const node = anchor.getNode();
          if ($isElementNode(node) && node.isEmpty()) {
            selection.style = '';
          }
        }
        if (fontMenuOpenRef.current || colorPickerOpenRef.current || isInteractingToolbarRef.current) return false;
        setShow(false);
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = setTimeout(updateToolbarPosition, 600);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const unregisterInsertParagraph = editor.registerCommand(
      INSERT_PARAGRAPH_COMMAND,
      () => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          return false;
        }
        const newBlock = selection.insertParagraph();
        const currSel = $getSelection();
        if ($isRangeSelection(currSel)) {
          currSel.style = '';
        }
        if (newBlock) {
          for (const child of newBlock.getChildren()) {
            if ($isTextNode(child) && child.getTextContent() === '') {
              child.setStyle('');
            }
          }
        }
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );

    const unregisterBlur = editor.registerCommand(
      BLUR_COMMAND,
      () => {
        if (fontMenuOpenRef.current || colorPickerOpenRef.current || isInteractingToolbarRef.current) return false;
        setShow(false);
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const unregisterOpenToolbar = editor.registerCommand(
      OPEN_CURSOR_TOOLBAR_COMMAND,
      () => {
        markInteracting();
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) && selection.isCollapsed()) {
            const anchorNode = selection.anchor.getNode();
            const element = anchorNode.getKey() === 'root'
              ? anchorNode
              : (typeof (anchorNode as any).getTopLevelElementOrThrow === 'function'
                ? (anchorNode as any).getTopLevelElementOrThrow()
                : (anchorNode as any).getTopLevelElement?.() || anchorNode);
            if (element && typeof (element as any).select === 'function') {
              const textContent = element.getTextContent();
              if (textContent.trim().length > 0) {
                element.select();
              }
            }
          }
        });
        setTimeout(() => {
          markInteracting();
          updateToolbarPosition(true);
        }, 30);
        return true;
      },
      COMMAND_PRIORITY_NORMAL,
    );

    return () => {
      unregisterSelection();
      unregisterInsertParagraph();
      unregisterBlur();
      unregisterOpenToolbar();
    };
  }, [editor, updateToolbarPosition, markInteracting]);

  /** Runs against the live selection, falling back to the one saved before focus moved away */
  const withSelection = useCallback((apply: (selection: RangeSelection) => void, tag?: string) => {
    editor.update(() => {
      let selection = $getSelection();
      if (!$isRangeSelection(selection) && savedSelectionRef.current) {
        $setSelection(savedSelectionRef.current.clone());
        selection = $getSelection();
      }
      if ($isRangeSelection(selection)) apply(selection);
    }, tag ? { tag } : undefined);
  }, [editor]);

  /** Puts whatever is selected on the clipboard, without changing it. */
  const copySelectedText = useCallback(() => {
    let text = '';
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if ($isRangeSelection(selection)) text = selection.getTextContent();
    });
    if (!text) return;
    navigator.clipboard.writeText(text).then(
      () => {
        setCopiedSelection(true);
        window.setTimeout(() => setCopiedSelection(false), 1400);
      },
      (err) => console.error('Copying the selection failed', err),
    );
  }, [editor]);

  const formatText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    deselectAfterApply();
  };

  const formatElement = (format: ElementFormatType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format);
    deselectAfterApply();
  };

  // What the selection had before previewing, so moving off the list puts it back
  const familyBeforePreviewRef = useRef<string | null>(null);

  const previewFontFamily = useCallback((family: string | null) => {
    if (family !== null) {
      setSelectionTransparent(true);
    } else {
      setSelectionTransparent(false);
    }
    if (familyBeforePreviewRef.current === null) familyBeforePreviewRef.current = fontFamily;

    const next = family ?? familyBeforePreviewRef.current;
    // Merged into the previous history entry, so hovering does not fill up undo
    withSelection(
      (selection) => $patchStyleText(selection, { 'font-family': next ? toFontStack(next) : null }),
      'history-merge',
    );

    if (family !== null) {
      dismissNativeKeyboard();
      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
        requestAnimationFrame(() => {
          window.getSelection()?.removeAllRanges();
          dismissNativeKeyboard();
        });
        setTimeout(() => {
          window.getSelection()?.removeAllRanges();
          dismissNativeKeyboard();
        }, 0);
      }
    } else {
      familyBeforePreviewRef.current = null;
    }
  }, [fontFamily, withSelection, setSelectionTransparent, dismissNativeKeyboard]);

  const applyFontFamily = useCallback((family: string) => {
    setSelectionTransparent(false);
    familyBeforePreviewRef.current = null;
    setFontFamily(family);
    withSelection((selection) => $patchStyleText(selection, { 'font-family': toFontStack(family) }));
    deselectAfterApply();
  }, [withSelection, setSelectionTransparent, deselectAfterApply]);

  const applyFontSize = useCallback((size: number) => {
    markInteracting();
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
    setFontSize(next);
    withSelection((selection) => $patchStyleText(selection, { 'font-size': `${next}px` }));
    requestAnimationFrame(() => {
      updateToolbarPosition();
    });
  }, [withSelection, markInteracting, updateToolbarPosition]);

  /** Back to whatever the block itself says, by clearing the inline overrides */
  const clearTypography = useCallback(() => {
    setSelectionTransparent(false);
    setPreviewingColor(null);
    setFontFamily('');
    setFontSize(null);
    setTextColor('');
    setHighlightColor('');
    withSelection((selection) =>
      $patchStyleText(selection, {
        'font-family': null,
        'font-size': null,
        color: null,
        'background-color': null,
      }),
    );
    deselectAfterApply();
  }, [withSelection, setSelectionTransparent, deselectAfterApply]);

  const colorBeforePreviewRef = useRef<string | null>(null);

  const previewTextColor = useCallback((color: string | null) => {
    if (color !== null) {
      setSelectionTransparent(true);
      setPreviewingColor(color);
    } else {
      setSelectionTransparent(false);
      setPreviewingColor(null);
    }

    if (colorBeforePreviewRef.current === null) {
      colorBeforePreviewRef.current = textColor;
    }
    const next = color ?? colorBeforePreviewRef.current;
    withSelection(
      (selection) => $patchStyleText(selection, { color: next || null }),
      'history-merge',
    );

    if (color !== null) {
      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
        requestAnimationFrame(() => window.getSelection()?.removeAllRanges());
        setTimeout(() => window.getSelection()?.removeAllRanges(), 0);
      }
    } else {
      colorBeforePreviewRef.current = null;
    }
  }, [textColor, withSelection, setSelectionTransparent]);

  const applyTextColor = useCallback((color: string | null) => {
    setSelectionTransparent(false);
    setPreviewingColor(null);
    colorBeforePreviewRef.current = null;
    setTextColor(color || '');
    withSelection((selection) => $patchStyleText(selection, { color: color || null }));
    deselectAfterApply();
  }, [withSelection, setSelectionTransparent, deselectAfterApply]);

  const bgBeforePreviewRef = useRef<string | null>(null);

  const previewHighlightColor = useCallback((bg: string | null) => {
    if (bg !== null) {
      setSelectionTransparent(true);
      setPreviewingColor(bg);
    } else {
      setSelectionTransparent(false);
      setPreviewingColor(null);
    }

    if (bgBeforePreviewRef.current === null) {
      bgBeforePreviewRef.current = highlightColor;
    }
    const next = bg ?? bgBeforePreviewRef.current;
    withSelection(
      (selection) => $patchStyleText(selection, { 'background-color': next || null }),
      'history-merge',
    );

    if (bg !== null) {
      if (typeof window !== 'undefined') {
        window.getSelection()?.removeAllRanges();
        requestAnimationFrame(() => window.getSelection()?.removeAllRanges());
        setTimeout(() => window.getSelection()?.removeAllRanges(), 0);
      }
    } else {
      bgBeforePreviewRef.current = null;
    }
  }, [highlightColor, withSelection, setSelectionTransparent]);

  const applyHighlightColor = useCallback((bg: string | null) => {
    setSelectionTransparent(false);
    setPreviewingColor(null);
    bgBeforePreviewRef.current = null;
    setHighlightColor(bg || '');
    withSelection((selection) => $patchStyleText(selection, { 'background-color': bg || null }));
    deselectAfterApply();
  }, [withSelection, setSelectionTransparent, deselectAfterApply]);

  const toggleWordPadding = useCallback(() => {
    editor.update(() => {
      let selection = $getSelection();
      if (!$isRangeSelection(selection) && savedSelectionRef.current) {
        $setSelection(savedSelectionRef.current.clone());
        selection = $getSelection();
      }
      if (!$isRangeSelection(selection)) return;

      const textContent = selection.getTextContent();
      if (!textContent) return;

      // Check if selection itself has leading and trailing space or non-breaking space
      const startsWithSpace = textContent.startsWith('\u00A0') || textContent.startsWith(' ');
      const endsWithSpace = textContent.endsWith('\u00A0') || textContent.endsWith(' ');

      if (startsWithSpace && endsWithSpace) {
        // Remove padding spaces
        const unpadded = textContent.replace(/^[\s\u00A0]/, '').replace(/[\s\u00A0]$/, '');
        selection.insertText(unpadded);
        return;
      }

      // Check if the word is surrounded by non-breaking spaces in the same text node
      const anchor = selection.anchor;
      const focus = selection.focus;
      if (anchor.key === focus.key) {
        const node = anchor.getNode();
        if ($isTextNode(node)) {
          const fullText = node.getTextContent();
          const start = Math.min(anchor.offset, focus.offset);
          const end = Math.max(anchor.offset, focus.offset);

          const prevChar = start > 0 ? fullText[start - 1] : null;
          const nextChar = end < fullText.length ? fullText[end] : null;

          if (prevChar === '\u00A0' && nextChar === '\u00A0') {
            const updated = fullText.slice(0, start - 1) + fullText.slice(start, end) + fullText.slice(end + 1);
            node.setTextContent(updated);
            return;
          }
        }
      }

      // Add non-breaking space padding at beginning and end
      selection.insertText(`\u00A0${textContent}\u00A0`);
    });

    deselectAfterApply();
  }, [editor, deselectAfterApply]);

  // If active color tab switches, cancel any ongoing preview
  useEffect(() => {
    if (colorBeforePreviewRef.current !== null) {
      previewTextColor(null);
    }
    if (bgBeforePreviewRef.current !== null) {
      previewHighlightColor(null);
    }
    setSelectionTransparent(false);
    setPreviewingColor(null);
  }, [activeColorTab, previewTextColor, previewHighlightColor, setSelectionTransparent]);

  // Touch and pointer tracking for mobile hold and swipe preview
  const isHoldingTouchRef = useRef(false);
  const activeTouchColorRef = useRef<string | null>(null);
  const hasAppliedViaTouchRef = useRef(false);

  const getSwatchFromPoint = (x: number, y: number): { button: HTMLButtonElement; color: string } | null => {
    const el = document.elementFromPoint(x, y);
    const btn = el?.closest<HTMLButtonElement>('[data-swatch-button]');
    if (!btn) return null;
    const color = btn.getAttribute('data-color-value') ?? '';
    return { button: btn, color };
  };

  const handleSwatchesPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;

    const found = getSwatchFromPoint(e.clientX, e.clientY);
    if (found) {
      isHoldingTouchRef.current = true;
      hasAppliedViaTouchRef.current = false;
      activeTouchColorRef.current = found.color;

      if (activeColorTab === 'text') {
        previewTextColor(found.color);
      } else {
        previewHighlightColor(found.color);
      }
    }
  };

  const handleSwatchesPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isHoldingTouchRef.current) return;

    const found = getSwatchFromPoint(e.clientX, e.clientY);
    if (found) {
      if (activeTouchColorRef.current !== found.color) {
        activeTouchColorRef.current = found.color;
        if (activeColorTab === 'text') {
          previewTextColor(found.color);
        } else {
          previewHighlightColor(found.color);
        }
      }
    } else {
      if (activeTouchColorRef.current !== null) {
        activeTouchColorRef.current = null;
        if (activeColorTab === 'text') {
          previewTextColor(null);
        } else {
          previewHighlightColor(null);
        }
      }
    }
  };

  const handleSwatchesPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isHoldingTouchRef.current) return;
    isHoldingTouchRef.current = false;

    const found = getSwatchFromPoint(e.clientX, e.clientY);
    if (found) {
      hasAppliedViaTouchRef.current = true;
      if (activeColorTab === 'text') {
        applyTextColor(found.color || null);
      } else {
        applyHighlightColor(found.color || null);
      }
    } else {
      if (activeColorTab === 'text') {
        previewTextColor(null);
      } else {
        previewHighlightColor(null);
      }
    }
    activeTouchColorRef.current = null;
  };

  const handleSwatchesPointerCancel = () => {
    if (!isHoldingTouchRef.current) return;
    isHoldingTouchRef.current = false;
    activeTouchColorRef.current = null;
    if (activeColorTab === 'text') {
      previewTextColor(null);
    } else {
      previewHighlightColor(null);
    }
  };

  const handleFontMenuOpenChange = useCallback((open: boolean) => {
    fontMenuOpenRef.current = open;
    if (open) {
      setShow(true);
      dismissNativeKeyboard();
    }
  }, [dismissNativeKeyboard]);

  if (!show) return null;

  const shownSize = fontSize ?? baseFontSize;
  const hasOverride = fontFamily !== '' || fontSize !== null || textColor !== '' || highlightColor !== '';

  return createPortal(
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        top: position?.top ?? -9999,
        left: position?.left ?? -9999,
        transform: 'translateX(-50%)',
        visibility: position ? 'visible' : 'hidden',
        zIndex: 100000,
      }}
      className="w-[min(94vw,28.5rem)] overflow-hidden rounded-2xl bg-white/95 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/8 backdrop-blur-xl dark:bg-[#1c1c1f]/95 dark:ring-white/12 select-none"
      onPointerDown={(e) => {
        e.stopPropagation();
        markInteracting();
        dismissNativeKeyboard();
      }}
      onPointerUp={(e) => {
        e.stopPropagation();
        markInteracting();
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        markInteracting();
        dismissNativeKeyboard();
      }}
      onTouchEnd={(e) => {
        e.stopPropagation();
        markInteracting();
      }}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
        markInteracting();
        dismissNativeKeyboard();
      }}
      onMouseUp={(e) => {
        e.stopPropagation();
        markInteracting();
      }}
      onClick={(e) => {
        e.stopPropagation();
        markInteracting();
      }}
      onPointerMove={() => {
        markInteracting();
      }}
      onTouchMove={() => {
        markInteracting();
      }}
    >
      {/* Typeface and size */}
      <div className="flex items-center gap-1.5 border-b border-black/6 p-1.5 dark:border-white/10">
        <FontPicker
          value={fontFamily}
          onChange={applyFontFamily}
          onOpenChange={handleFontMenuOpenChange}
          onHover={previewFontFamily}
          selectedText={selectedTextSnippet}
          className="min-w-0 flex-1"
          triggerClassName="!py-1.5 rounded-lg"
          triggerTextClass="text-black/80 dark:text-white/80"
          triggerSurfaceClass="bg-black/4 border-black/8 dark:bg-white/6 dark:border-white/12 rounded-lg"
          menuSurfaceClass="bg-white dark:bg-[#1E1E1E] border-black/10 dark:border-[#3A3A3A]"
        />

        <div className="flex shrink-0 items-center rounded-lg border border-black/8 dark:border-white/12">
          <button
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.stopPropagation();
              markInteracting();
            }}
            onClick={(e) => {
              e.stopPropagation();
              markInteracting();
              applyFontSize(shownSize - 1);
            }}
            disabled={shownSize <= MIN_FONT_SIZE}
            className={`${BUTTON_BASE} ${BUTTON_IDLE} h-7 w-7 rounded-r-none disabled:pointer-events-none disabled:opacity-30`}
            title="Smaller text"
          >
            <Minus size={13} />
          </button>
          <span className="w-7 text-center text-[11px] font-semibold tabular-nums text-black/70 dark:text-white/70">
            {shownSize}
          </span>
          <button
            onMouseDown={(e) => e.preventDefault()}
            onPointerDown={(e) => {
              e.stopPropagation();
              markInteracting();
            }}
            onClick={(e) => {
              e.stopPropagation();
              markInteracting();
              applyFontSize(shownSize + 1);
            }}
            disabled={shownSize >= MAX_FONT_SIZE}
            className={`${BUTTON_BASE} ${BUTTON_IDLE} h-7 w-7 rounded-l-none disabled:pointer-events-none disabled:opacity-30`}
            title="Bigger text"
          >
            <Plus size={13} />
          </button>
        </div>

        {hasOverride && (
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); clearTypography(); }}
            className={`${BUTTON_BASE} ${BUTTON_IDLE} h-7 w-7`}
            title="Back to the note's own font"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {/* Formatting */}
      <div 
        className="no-scrollbar flex items-center gap-0.5 overflow-x-auto p-1.5 overscroll-contain select-none"
        style={{
          touchAction: 'pan-x',
          WebkitOverflowScrolling: 'touch',
        }}
        onWheel={(e) => {
          if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
            e.currentTarget.scrollLeft += e.deltaY;
            e.stopPropagation();
            markInteracting();
          }
        }}
        onScroll={() => {
          markInteracting();
        }}
      >
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); copySelectedText(); }}
          className={`${BUTTON_BASE} ${copiedSelection ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Copy the selected text"
        >
          {copiedSelection ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
        </button>
        <span className="mx-0.5 h-5 w-px shrink-0 bg-black/8 dark:bg-white/12" />
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); formatText('bold'); }}
          className={`${BUTTON_BASE} ${isBold ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Bold (Ctrl+B)"
        >
          <Bold size={15} />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); formatText('italic'); }}
          className={`${BUTTON_BASE} ${isItalic ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Italic (Ctrl+I)"
        >
          <Italic size={15} />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); formatText('underline'); }}
          className={`${BUTTON_BASE} ${isUnderline ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Underline (Ctrl+U)"
        >
          <Underline size={15} />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); formatText('strikethrough'); }}
          className={`${BUTTON_BASE} ${isStrikethrough ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => { e.stopPropagation(); formatText('code'); }}
          className={`${BUTTON_BASE} ${isCode ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Inline code"
        >
          <Code size={15} />
        </button>
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.stopPropagation();
            editor.update(() => {
              const selection = $getSelection();
              if (!$isRangeSelection(selection)) return;

              if (!isCodeBlock) {
                $setBlocksType(selection, () => $createCodeNode('typescript'));
                return;
              }

              const nodes = selection.getNodes();
              const topLevelNodes = new Set(nodes.map(n => n.getTopLevelElement()?.getKey()));
              if (topLevelNodes.size !== 1) {
                $setBlocksType(selection, () => $createParagraphNode());
                return;
              }

              const codeNode = nodes[0].getTopLevelElement();
              if (!codeNode || codeNode.getType() !== 'code') {
                $setBlocksType(selection, () => $createParagraphNode());
                return;
              }

              const isFullSelection =
                selection.getTextContent() === codeNode.getTextContent() && codeNode.getTextContent() !== '';
              if (isFullSelection) {
                $setBlocksType(selection, () => $createParagraphNode());
                return;
              }

              // Split the code block, then tidy up any empty halves the split leaves behind
              const paragraph = $createParagraphNode();
              selection.insertNodes([paragraph]);

              const previous = paragraph.getPreviousSibling();
              const next = paragraph.getNextSibling();
              if (previous && previous.getType() === 'code' && previous.getTextContent().trim() === '') previous.remove();
              if (next && next.getType() === 'code' && next.getTextContent().trim() === '') next.remove();
              $setSelection(null);
            });
            deselectAfterApply();
          }}
          className={`${BUTTON_BASE} ${isCodeBlock ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Code block"
        >
          <SquareTerminal size={15} />
        </button>

        <div className="mx-1 h-5 w-px shrink-0 bg-black/10 dark:bg-white/10" />

        {/* Text color button */}
        <button
          ref={textColorBtnRef}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.stopPropagation();
            markInteracting();
            dismissNativeKeyboard();
          }}
          onClick={(e) => {
            e.stopPropagation();
            markInteracting();
            dismissNativeKeyboard();
            setShowColorPicker(prev => (prev === 'text' ? null : 'text'));
          }}
          className={`${BUTTON_BASE} ${showColorPicker === 'text' || textColor ? BUTTON_ACTIVE : BUTTON_IDLE} relative flex flex-col items-center justify-center`}
          title="Text color"
          aria-label="Text color"
        >
          <Baseline size={14} />
          <span
            className="mt-[-2px] h-[3px] w-3.5 rounded-full"
            style={{ backgroundColor: textColor || 'currentColor' }}
          />
        </button>

        {/* Highlight color button */}
        <button
          ref={highlightColorBtnRef}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.stopPropagation();
            markInteracting();
            dismissNativeKeyboard();
          }}
          onClick={(e) => {
            e.stopPropagation();
            markInteracting();
            dismissNativeKeyboard();
            setShowColorPicker(prev => (prev === 'highlight' ? null : 'highlight'));
          }}
          className={`${BUTTON_BASE} ${showColorPicker === 'highlight' || highlightColor ? BUTTON_ACTIVE : BUTTON_IDLE} relative flex flex-col items-center justify-center`}
          title="Highlight color"
          aria-label="Highlight color"
        >
          <Highlighter size={13} />
          <span
            className="mt-[-2px] h-[3px] w-3.5 rounded-full ring-1 ring-black/15 dark:ring-white/20"
            style={{ backgroundColor: highlightColor || 'transparent' }}
          />
        </button>

        {/* Word space padding button */}
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onPointerDown={(e) => {
            e.stopPropagation();
            markInteracting();
          }}
          onClick={(e) => {
            e.stopPropagation();
            markInteracting();
            toggleWordPadding();
          }}
          className={`${BUTTON_BASE} ${isSpacePadded ? BUTTON_ACTIVE : BUTTON_IDLE} relative flex items-center justify-center`}
          title={isSpacePadded ? "Remove space padding" : "Word space padding (add space at begin & end)"}
          aria-label="Word space padding"
        >
          <Space size={15} />
        </button>

        <div className="mx-1 h-5 w-px shrink-0 bg-black/10 dark:bg-white/10" />

        {([
          { value: 'left', icon: AlignLeft, label: 'Align left' },
          { value: 'center', icon: AlignCenter, label: 'Align centre' },
          { value: 'right', icon: AlignRight, label: 'Align right' },
          { value: 'justify', icon: AlignJustify, label: 'Justify' },
        ] as const).map(({ value, icon: Icon, label }) => (
          <button
            key={value}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => { e.stopPropagation(); formatElement(value); }}
            className={`${BUTTON_BASE} ${alignment === value ? BUTTON_ACTIVE : BUTTON_IDLE}`}
            title={label}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>

      {/* ColorPickerPortal from ColorPickers.tsx for Text Color */}
      {showColorPicker === 'text' && (
        <ColorPickerPortal
          color={previewingColor || textColor || '#18181b'}
          onChange={(c: string) => previewTextColor(c)}
          onHover={(c: string | null) => previewTextColor(c)}
          onApply={(c: string) => applyTextColor(c)}
          onClear={() => applyTextColor(null)}
          onClose={() => {
            if (previewingColor) {
              previewTextColor(null);
            }
            setShowColorPicker(null);
            setSelectionTransparent(false);
          }}
          anchorRef={textColorBtnRef}
        />
      )}

      {/* ColorPickerPortal from ColorPickers.tsx for Highlight Color */}
      {showColorPicker === 'highlight' && (
        <ColorPickerPortal
          color={previewingColor || highlightColor || '#fef08a'}
          presets={[
            '#fef08a', '#d9f99d', '#bbf7d0', '#99f6e4', '#bae6fd', '#bfdbfe',
            '#c7d2fe', '#e9d5ff', '#fbcfe8', '#fed7aa', '#fecaca', '#e2e8f0'
          ]}
          onChange={(c: string) => previewHighlightColor(c)}
          onHover={(c: string | null) => previewHighlightColor(c)}
          onApply={(c: string) => applyHighlightColor(c)}
          onClear={() => applyHighlightColor(null)}
          onClose={() => {
            if (previewingColor) {
              previewHighlightColor(null);
            }
            setShowColorPicker(null);
            setSelectionTransparent(false);
          }}
          anchorRef={highlightColorBtnRef}
        />
      )}
    </div>,
    document.body,
  );
}
