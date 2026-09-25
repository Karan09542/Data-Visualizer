import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND,
  $getNearestNodeFromDOMNode,
  $isElementNode,
  $getRoot, $createParagraphNode
} from 'lexical';
import { createPortal } from 'react-dom';
import { GripVertical, Trash2 } from 'lucide-react';
import { CommandOption, getBaseOptions, getMediaOptions } from './BlockMenuOptions';

export default function BlockHandlePlugin() {
  const [editor] = useLexicalComposerContext();
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const handleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const options = getBaseOptions();
  const mediaOptions = getMediaOptions();

  /** Resolves the top-level block (or LI) inside the editor root from any DOM node */
  const getBlockElement = useCallback((node: Node | null): HTMLElement | null => {
    if (!node) return null;
    const root = editor.getRootElement();
    if (!root) return null;

    let el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    while (el && el !== root) {
      if (el.tagName === 'LI') {
        return el;
      }
      if (el.parentElement === root) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }, [editor]);

  /** Finds which block on the screen corresponds vertically to y coordinate (useful for gutter/padding hover) */
  const findBlockAtY = useCallback((y: number): HTMLElement | null => {
    const root = editor.getRootElement();
    if (!root) return null;

    const children = Array.from(root.children) as HTMLElement[];
    for (const child of children) {
      if (!(child instanceof HTMLElement)) continue;
      const rect = child.getBoundingClientRect();
      if (rect.height === 0) continue;

      // Check if y is within the block's vertical bounds with slight buffer
      if (y >= rect.top - 4 && y <= rect.bottom + 4) {
        if (child.tagName === 'UL' || child.tagName === 'OL') {
          const items = Array.from(child.children) as HTMLElement[];
          for (const item of items) {
            if (!(item instanceof HTMLElement)) continue;
            const itemRect = item.getBoundingClientRect();
            if (y >= itemRect.top - 2 && y <= itemRect.bottom + 2) {
              return item;
            }
          }
        }
        return child;
      }
    }
    return null;
  }, [editor]);

  /** Global mousemove listener ensures hover detection works reliably across desktop big screens and gutters */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (menuOpen) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Keep active if mouse is hovering over the handle button itself or the open menu
      if (handleRef.current?.contains(target) || menuRef.current?.contains(target)) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        return;
      }

      const root = editor.getRootElement();
      if (!root) return;

      const rootRect = root.getBoundingClientRect();
      const container = root.closest('.sticky-note-scrollbar') || root.parentElement;
      const containerRect = container ? container.getBoundingClientRect() : rootRect;

      // Check if mouse is horizontally within the editor area or in the gutter/margin to the left
      // On desktop big screens (max-w-4xl), user may hover in the left gutter space next to text
      const minX = Math.min(rootRect.left - 80, containerRect.left);
      const maxX = Math.max(rootRect.right + 40, containerRect.right);
      const isNearX = e.clientX >= minX && e.clientX <= maxX;
      const isNearY = e.clientY >= containerRect.top && e.clientY <= containerRect.bottom;

      if (!isNearX || !isNearY) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
          if (!menuOpen) setTargetElement(null);
        }, 250);
        return;
      }

      // 1. Try finding block from the directly hovered element
      let block = getBlockElement(target);

      // 2. If hovering in the margin/padding/gutter or between lines, find block by Y coordinate
      if (!block) {
        block = findBlockAtY(e.clientY);
      }

      if (block && block.isConnected) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        setTargetElement(block);
      } else {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
          if (!menuOpen) setTargetElement(null);
        }, 250);
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [editor, menuOpen, getBlockElement, findBlockAtY]);

  useEffect(() => {
    const handleScroll = () => {
      if (!menuOpen) setTargetElement(null);
    };
    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [menuOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuOpen &&
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        handleRef.current && !handleRef.current.contains(e.target as Node)
      ) {
        setMenuOpen(false);
        setTargetElement(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        if (menuOpen) return false;

        const nativeSelection = window.getSelection();
        if (nativeSelection && nativeSelection.anchorNode) {
          const blockEl = getBlockElement(nativeSelection.anchorNode);
          if (blockEl && blockEl.isConnected) {
            setTargetElement(blockEl);
          }
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, menuOpen, getBlockElement]);

  const onSelectOption = (option: CommandOption) => {
    if (targetElement) {
      editor.update(() => {
        const node = $getNearestNodeFromDOMNode(targetElement);
        if (node && $isElementNode(node)) {
          node.select();
        }
      }, {
        onUpdate: () => {
          option.onSelect(editor);
        }
      });
    } else {
      option.onSelect(editor);
    }
    setMenuOpen(false);
    setTargetElement(null);
  };

  if (!targetElement || !targetElement.isConnected) return null;

  const rect = targetElement.getBoundingClientRect();
  const top = rect.top;
  let left = rect.left - 24;

  if (targetElement.tagName === 'LI') {
    const isChecklist = targetElement.classList.contains('lexical-checklist-checked') || targetElement.classList.contains('lexical-checklist-unchecked');
    if (!isChecklist) {
      left = rect.left - 42;
    }
  }

  return createPortal(
    <>
      <button
        ref={handleRef}
        type="button"
        className={`fixed flex items-center justify-center w-6 h-6 rounded hover:bg-black/10 dark:hover:bg-white/10 text-black/30 hover:text-black/60 dark:text-white/30 dark:hover:text-white/60 transition-colors z-[90000] cursor-grab active:cursor-grabbing ${
          menuOpen ? 'bg-black/10 dark:bg-white/10 text-black/60 dark:text-white/60' : ''
        }`}
        style={{
          top: top,
          left: left,
          transform: 'translateY(-1px)'
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
        }}
      >
        <GripVertical size={16} />
      </button>

      {menuOpen && (() => {
        const estimatedMenuHeight = Math.min((options.length + mediaOptions.length) * 40 + 60, 330);
        const spaceBelow = window.innerHeight - top - 28;
        const spaceAbove = top;
        const flip = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

        return (
          <div
            ref={menuRef}
            className={`fixed z-[100000] w-64 max-h-80 overflow-y-auto bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-xl shadow-2xl p-1 animate-in fade-in custom-scrollbar sticky-note-scrollbar ${
              flip ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'
            }`}
            style={{
              top: flip ? undefined : top + 28,
              bottom: flip ? window.innerHeight - top + 4 : undefined,
              left: left,
            }}
          >
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
              Insert
            </div>
            {mediaOptions.map((option) => (
              <button
                key={option.title}
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => onSelectOption(option)}
              >
                <div className="p-1.5 rounded-md bg-black/5 dark:bg-white/5">
                  {option.menuIcon}
                </div>
                {option.title}
              </button>
            ))}

            <div className="my-1 mx-2 h-px bg-black/5 dark:bg-white/10" />
            <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
              Turn into
            </div>
            {options.map((option) => (
              <button
                key={option.title}
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"
                onClick={() => onSelectOption(option)}
              >
                <div className="p-1.5 rounded-md bg-black/5 dark:bg-white/5">
                  {option.menuIcon}
                </div>
                {option.title}
              </button>
            ))}
            <div className="my-1 mx-2 h-px bg-black/5 dark:bg-white/10" />
            <button
              type="button"
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (targetElement) {
                  editor.update(() => {
                    const node = $getNearestNodeFromDOMNode(targetElement);
                    if (node) {
                      if ($isElementNode(node)) {
                        node.remove();
                      } else if (node.getParent()) {
                        node.getParent()?.remove();
                      }
                      const root = $getRoot();
                      if (root.getChildrenSize() === 0) {
                        root.append($createParagraphNode());
                      }
                    }
                  });
                }
                setMenuOpen(false);
                setTargetElement(null);
              }}
            >
              <div className="p-1.5 rounded-md bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400">
                <Trash2 size={16} />
              </div>
              Delete Block
            </button>
          </div>
        );
      })()}
    </>,
    document.body
  );
}
