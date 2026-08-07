import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { 
  $getSelection, $isRangeSelection, FORMAT_TEXT_COMMAND, TextFormatType, 
  $isNodeSelection, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND, BLUR_COMMAND, 
  FORMAT_ELEMENT_COMMAND, ElementFormatType, $createParagraphNode
} from 'lexical';
import { 
  Bold, Italic, Underline, Strikethrough, Code, SquareTerminal,
  AlignLeft, AlignCenter, AlignRight, AlignJustify 
} from 'lucide-react';
import { $setBlocksType } from '@lexical/selection';
import { $createCodeNode } from '@lexical/code';
import { createPortal } from 'react-dom';

export default function CursorToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrikethrough, setIsStrikethrough] = useState(false);
  const [isCode, setIsCode] = useState(false);
  const [isCodeBlock, setIsCodeBlock] = useState(false);
  const [alignment, setAlignment] = useState<ElementFormatType>('left');

  const showTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateToolbarPosition = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();
      if (!selection) {
        setShow(false);
        return;
      }

      if ($isRangeSelection(selection)) {
        setIsBold(selection.hasFormat('bold'));
        setIsItalic(selection.hasFormat('italic'));
        setIsUnderline(selection.hasFormat('underline'));
        setIsStrikethrough(selection.hasFormat('strikethrough'));
        setIsCode(selection.hasFormat('code'));

        const anchorNode = selection.anchor.getNode();
        const element = anchorNode.getKey() === 'root'
          ? anchorNode
          : (typeof (anchorNode as any).getTopLevelElementOrThrow === 'function' 
              ? (anchorNode as any).getTopLevelElementOrThrow() 
              : (anchorNode as any).getTopLevelElement?.() || anchorNode);
        
        setIsCodeBlock(element.getType() === 'code');
        const format = (element as any).getFormatType?.() || 'left';
        setAlignment(format === '' ? 'left' : format);
      }

      let rect: DOMRect | null = null;

      if ($isNodeSelection(selection)) {
        const nodes = selection.getNodes();
        if (nodes.length > 0) {
          const element = editor.getElementByKey(nodes[0].getKey());
          if (element) {
            rect = element.getBoundingClientRect();
          }
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
        if (nativeSelection && nativeSelection.rangeCount > 0) {
          const domRange = nativeSelection.getRangeAt(0);
          rect = domRange.getBoundingClientRect();
        }
      }

      if (!rect || (rect.width === 0 && rect.height === 0 && rect.top === 0 && rect.left === 0)) {
        setShow(false);
        return;
      }

      const top = rect.bottom + 8;
      const toolbarWidth = toolbarRef.current ? toolbarRef.current.offsetWidth : 320;
      const toolbarHalfWidth = toolbarWidth / 2;
      const margin = 10;

      const desiredLeft = rect.left + (rect.width / 2);
      const clampedLeft = Math.max(
        toolbarHalfWidth + margin,
        Math.min(window.innerWidth - toolbarHalfWidth - margin, desiredLeft)
      );

      setPosition({
        top: Math.max(margin, top),
        left: clampedLeft,
      });
      setShow(true);
    });
  }, [editor]);

  useEffect(() => {
    const handleSelectionChange = () => {
      setShow(false);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = setTimeout(() => {
        updateToolbarPosition();
      }, 600);
    };

    const handleScroll = () => {
      setShow(false);
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('scroll', handleScroll, true);
      if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
    };
  }, [editor, updateToolbarPosition]);

  useEffect(() => {
    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND as any,
      () => {
        setShow(false);
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = setTimeout(() => {
          updateToolbarPosition();
        }, 600);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    const unregisterBlur = editor.registerCommand(
      BLUR_COMMAND,
      () => {
        setShow(false);
        if (showTimeoutRef.current) clearTimeout(showTimeoutRef.current);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );

    return () => {
      unregisterSelection();
      unregisterBlur();
    };
  }, [editor, updateToolbarPosition]);

  const formatText = (format: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
  };
  
  const formatElement = (format: ElementFormatType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, format);
  };

  if (!show) return null;

  return createPortal(
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        transform: 'translateX(-50%)',
        zIndex: 100000,
      }}
      className="flex items-center gap-0.5 sm:gap-1 p-0.5 sm:p-1 bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.18)] border border-black/10 dark:border-white/15 transition-opacity duration-300 max-w-[calc(100vw-20px)] overflow-x-auto [&::-webkit-scrollbar]:hidden"
      onPointerDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        onClick={(e) => { e.stopPropagation(); formatText('bold'); }}
        className={`p-2 rounded-full transition-colors ${isBold ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
        title="Bold (Ctrl+B)"
      >
        <Bold size={15} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); formatText('italic'); }}
        className={`p-2 rounded-full transition-colors ${isItalic ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
        title="Italic (Ctrl+I)"
      >
        <Italic size={15} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); formatText('underline'); }}
        className={`p-2 rounded-full transition-colors ${isUnderline ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
        title="Underline (Ctrl+U)"
      >
        <Underline size={15} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); formatText('strikethrough'); }}
        className={`p-2 rounded-full transition-colors ${isStrikethrough ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
        title="Strikethrough"
      >
        <Strikethrough size={15} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); formatText('code'); }}
        className={`p-2 rounded-full transition-colors ${isCode ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
        title="Inline Code"
      >
        <Code size={15} />
      </button>

      <button
        onClick={(e) => { 
          e.stopPropagation(); 
          editor.update(() => {
            const selection = $getSelection();
            if ($isRangeSelection(selection)) {
              if (isCodeBlock) {
                const nodes = selection.getNodes();
                const topLevelNodes = new Set(nodes.map(n => n.getTopLevelElement()?.getKey()));
                
                if (topLevelNodes.size === 1) {
                  const codeNode = nodes[0].getTopLevelElement();
                  if (codeNode && codeNode.getType() === 'code') {
                    const isFullSelection = selection.getTextContent() === codeNode.getTextContent() && codeNode.getTextContent() !== '';
                    if (isFullSelection) {
                      $setBlocksType(selection, () => $createParagraphNode());
                    } else {
                      // Split the code block or break out
                      const p = $createParagraphNode();
                      selection.insertNodes([p]);
                      p.select();
                      
                      // Cleanup any empty code blocks created by the split
                      const prev = p.getPreviousSibling();
                      const next = p.getNextSibling();
                      if (prev && prev.getType() === 'code' && prev.getTextContent().trim() === '') {
                        prev.remove();
                      }
                      if (next && next.getType() === 'code' && next.getTextContent().trim() === '') {
                        next.remove();
                      }
                    }
                  } else {
                    $setBlocksType(selection, () => $createParagraphNode());
                  }
                } else {
                  $setBlocksType(selection, () => $createParagraphNode());
                }
              } else {
                $setBlocksType(selection, () => $createCodeNode('typescript'));
              }
            }
          });
        }}
        className={`p-2 rounded-full transition-colors ${isCodeBlock ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
        title="Code Block"
      >
        <SquareTerminal size={15} />
      </button>

      <div className="w-px h-5 bg-black/10 dark:bg-white/10 mx-0.5" />

      <button
        onClick={(e) => { e.stopPropagation(); formatElement('left'); }}
        className={`p-2 rounded-full transition-colors ${alignment === 'left' ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
        title="Align Left"
      >
        <AlignLeft size={15} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); formatElement('center'); }}
        className={`p-2 rounded-full transition-colors ${alignment === 'center' ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
        title="Align Center"
      >
        <AlignCenter size={15} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); formatElement('right'); }}
        className={`p-2 rounded-full transition-colors ${alignment === 'right' ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
        title="Align Right"
      >
        <AlignRight size={15} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); formatElement('justify'); }}
        className={`p-2 rounded-full transition-colors ${alignment === 'justify' ? 'bg-black/15 dark:bg-white/20 text-black dark:text-white' : 'text-black/60 hover:bg-black/5 hover:text-black dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white'}`}
        title="Justify"
      >
        <AlignJustify size={15} />
      </button>
    </div>,
    document.body
  );
}
