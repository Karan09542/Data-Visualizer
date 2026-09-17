import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection, $isRangeSelection, $setSelection, FORMAT_TEXT_COMMAND, TextFormatType,
  $isNodeSelection, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND, BLUR_COMMAND,
  FORMAT_ELEMENT_COMMAND, ElementFormatType, $createParagraphNode, RangeSelection
} from 'lexical';
import {
  Bold, Italic, Underline, Strikethrough, Code, SquareTerminal,
  AlignLeft, AlignCenter, AlignRight, AlignJustify, Minus, Plus, RotateCcw
} from 'lucide-react';
import { $setBlocksType, $patchStyleText, $getSelectionStyleValueForProperty } from '@lexical/selection';
import { $createCodeNode } from '@lexical/code';
import { createPortal } from 'react-dom';
import { FontPicker } from '../../../FontPicker';

const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 72;
const TOOLBAR_MARGIN = 10;

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

  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  // Opening the font list moves focus out of the editor, which would otherwise close this
  const fontMenuOpenRef = useRef(false);
  // The selection as it was before focus moved into the picker, so styles still land on it
  const savedSelectionRef = useRef<RangeSelection | null>(null);

  const updateToolbarPosition = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!selection) {
        setShow(false);
        return;
      }

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

        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === 'root'
          ? anchorNode
          : (typeof (anchorNode as any).getTopLevelElementOrThrow === 'function'
            ? (anchorNode as any).getTopLevelElementOrThrow()
            : (anchorNode as any).getTopLevelElement?.() || anchorNode);

        setIsCodeBlock(element.getType() === 'code');
        const format = (element as any).getFormatType?.() || 'left';
        setAlignment(format === '' ? 'left' : format);

        // What the text renders at now, so the stepper starts from the right number
        const dom = editor.getElementByKey(element.getKey());
        if (dom) setBaseFontSize(Math.round(parseFloat(getComputedStyle(dom).fontSize)) || 15);
      }

      let rect: DOMRect | null = null;

      if ($isNodeSelection(selection)) {
        const nodes = selection.getNodes();
        if (nodes.length > 0) {
          const element = editor.getElementByKey(nodes[0].getKey());
          if (element) rect = element.getBoundingClientRect();
        }
      } else if ($isRangeSelection(selection)) {
        const nativeSelection = window.getSelection();
        if (!nativeSelection) {
          setShow(false);
          return;
        }

        if (nativeSelection.isCollapsed) {
          const text = nativeSelection.anchorNode?.textContent || '';
          if (text.trim().length > 0) {
            setShow(false);
            return;
          }
        }
        if (nativeSelection.rangeCount > 0) {
          rect = nativeSelection.getRangeAt(0).getBoundingClientRect();
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
  }, [show, anchorRect]);

  useEffect(() => {
    const queueUpdate = () => {
      if (fontMenuOpenRef.current) return;
      setShow(false);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = setTimeout(updateToolbarPosition, 600);
    };

    const handleScroll = () => {
      if (fontMenuOpenRef.current) return;
      setShow(false);
    };

    document.addEventListener('selectionchange', queueUpdate);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('selectionchange', queueUpdate);
      document.removeEventListener('scroll', handleScroll, true);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    };
  }, [editor, updateToolbarPosition]);

  useEffect(() => {
    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND as any,
      () => {
        if (fontMenuOpenRef.current) return false;
        setShow(false);
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = setTimeout(updateToolbarPosition, 600);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    const unregisterBlur = editor.registerCommand(
      BLUR_COMMAND,
      () => {
        if (fontMenuOpenRef.current) return false;
        setShow(false);
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
        return false;
      },
      COMMAND_PRIORITY_LOW,
    );

    return () => {
      unregisterSelection();
      unregisterBlur();
    };
  }, [editor, updateToolbarPosition]);

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

  const formatText = (format: TextFormatType) => editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  const formatElement = (format: ElementFormatType) => editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format);

  // What the selection had before previewing, so moving off the list puts it back
  const familyBeforePreviewRef = useRef<string | null>(null);

  const previewFontFamily = useCallback((family: string | null) => {
    if (familyBeforePreviewRef.current === null) familyBeforePreviewRef.current = fontFamily;

    const next = family ?? familyBeforePreviewRef.current;
    // Merged into the previous history entry, so hovering does not fill up undo
    withSelection(
      (selection) => $patchStyleText(selection, { 'font-family': next ? toFontStack(next) : null }),
      'history-merge',
    );

    if (family === null) familyBeforePreviewRef.current = null;
  }, [fontFamily, withSelection]);

  const applyFontFamily = useCallback((family: string) => {
    familyBeforePreviewRef.current = null;
    setFontFamily(family);
    withSelection((selection) => $patchStyleText(selection, { 'font-family': toFontStack(family) }));
  }, [withSelection]);

  const applyFontSize = useCallback((size: number) => {
    const next = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
    setFontSize(next);
    withSelection((selection) => $patchStyleText(selection, { 'font-size': `${next}px` }));
  }, [withSelection]);

  /** Back to whatever the block itself says, by clearing the inline overrides */
  const clearTypography = useCallback(() => {
    setFontFamily('');
    setFontSize(null);
    withSelection((selection) => $patchStyleText(selection, { 'font-family': null, 'font-size': null }));
  }, [withSelection]);

  const handleFontMenuOpenChange = useCallback((open: boolean) => {
    fontMenuOpenRef.current = open;
    if (open) setShow(true);
  }, []);

  if (!show) return null;

  const shownSize = fontSize ?? baseFontSize;
  const hasOverride = fontFamily !== '' || fontSize !== null;

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
      className="w-[min(92vw,26rem)] overflow-hidden rounded-2xl bg-white/95 shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)] ring-1 ring-black/8 backdrop-blur-xl dark:bg-[#1c1c1f]/95 dark:ring-white/12"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      {/* Typeface and size */}
      <div className="flex items-center gap-1.5 border-b border-black/6 p-1.5 dark:border-white/10">
        <FontPicker
          value={fontFamily}
          onChange={applyFontFamily}
          onOpenChange={handleFontMenuOpenChange}
          onHover={previewFontFamily}
          selectedText="The quick brown fox"
          className="min-w-0 flex-1"
          triggerClassName="!py-1.5 rounded-lg"
          triggerTextClass="text-black/80 dark:text-white/80"
          triggerSurfaceClass="bg-black/4 border-black/8 dark:bg-white/6 dark:border-white/12 rounded-lg"
          menuSurfaceClass="bg-white dark:bg-[#1E1E1E] border-black/10 dark:border-[#3A3A3A]"
        />

        <div className="flex shrink-0 items-center rounded-lg border border-black/8 dark:border-white/12">
          <button
            onClick={(e) => { e.stopPropagation(); applyFontSize(shownSize - 1); }}
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
            onClick={(e) => { e.stopPropagation(); applyFontSize(shownSize + 1); }}
            disabled={shownSize >= MAX_FONT_SIZE}
            className={`${BUTTON_BASE} ${BUTTON_IDLE} h-7 w-7 rounded-l-none disabled:pointer-events-none disabled:opacity-30`}
            title="Bigger text"
          >
            <Plus size={13} />
          </button>
        </div>

        {hasOverride && (
          <button
            onClick={(e) => { e.stopPropagation(); clearTypography(); }}
            className={`${BUTTON_BASE} ${BUTTON_IDLE} h-7 w-7`}
            title="Back to the note's own font"
          >
            <RotateCcw size={13} />
          </button>
        )}
      </div>

      {/* Formatting */}
      <div className="no-scrollbar flex items-center gap-0.5 overflow-x-auto p-1.5">
        <button
          onClick={(e) => { e.stopPropagation(); formatText('bold'); }}
          className={`${BUTTON_BASE} ${isBold ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Bold (Ctrl+B)"
        >
          <Bold size={15} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); formatText('italic'); }}
          className={`${BUTTON_BASE} ${isItalic ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Italic (Ctrl+I)"
        >
          <Italic size={15} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); formatText('underline'); }}
          className={`${BUTTON_BASE} ${isUnderline ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Underline (Ctrl+U)"
        >
          <Underline size={15} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); formatText('strikethrough'); }}
          className={`${BUTTON_BASE} ${isStrikethrough ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Strikethrough"
        >
          <Strikethrough size={15} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); formatText('code'); }}
          className={`${BUTTON_BASE} ${isCode ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Inline code"
        >
          <Code size={15} />
        </button>
        <button
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
              paragraph.select();

              const previous = paragraph.getPreviousSibling();
              const next = paragraph.getNextSibling();
              if (previous && previous.getType() === 'code' && previous.getTextContent().trim() === '') previous.remove();
              if (next && next.getType() === 'code' && next.getTextContent().trim() === '') next.remove();
            });
          }}
          className={`${BUTTON_BASE} ${isCodeBlock ? BUTTON_ACTIVE : BUTTON_IDLE}`}
          title="Code block"
        >
          <SquareTerminal size={15} />
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
            onClick={(e) => { e.stopPropagation(); formatElement(value); }}
            className={`${BUTTON_BASE} ${alignment === value ? BUTTON_ACTIVE : BUTTON_IDLE}`}
            title={label}
          >
            <Icon size={15} />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
