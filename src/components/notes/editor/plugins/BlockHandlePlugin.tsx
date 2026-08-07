import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection, COMMAND_PRIORITY_LOW, SELECTION_CHANGE_COMMAND,
  $getNearestNodeFromDOMNode,
  $isElementNode
} from 'lexical';
import { createPortal } from 'react-dom';
import { GripVertical } from 'lucide-react';
import { CommandOption, getBaseOptions } from './BlockMenuOptions';

export default function BlockHandlePlugin() {
  const [editor] = useLexicalComposerContext();
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const handleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const options = getBaseOptions();

  const getBlockElement = (node: Node | null): HTMLElement | null => {
    if (!node) return null;
    let el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : node.parentElement;
    while (el) {
      if (
        el.tagName === 'LI' || 
        el.parentElement?.getAttribute('contenteditable') === 'true' || 
        el.parentElement?.classList.contains('editor-root')
      ) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  };

  useEffect(() => {
    const rootEl = editor.getRootElement();
    if (!rootEl) return;

    const handleEvent = (e: MouseEvent | TouchEvent) => {
      if (menuOpen) return;

      const target = e.target as Node;
      const blockEl = getBlockElement(target);

      if (blockEl) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        setTargetElement(blockEl);
      } else {
        if (handleRef.current?.contains(target as Node) || menuRef.current?.contains(target as Node)) {
          return;
        }

        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
          if (!menuOpen) setTargetElement(null);
        }, 100);
      }
    };

    const handleLeaveEvent = (e: MouseEvent | TouchEvent) => {
      if (menuOpen) return;

      // Type assertion for relatedTarget since TouchEvent doesn't have it natively,
      // but we mainly care about mouseleave for this specific logic anyway.
      const relatedTarget = (e as MouseEvent).relatedTarget;
      if (
        relatedTarget instanceof Node &&
        (handleRef.current?.contains(relatedTarget) ||
        menuRef.current?.contains(relatedTarget))
      ) {
        return;
      }

      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = setTimeout(() => {
        if (!menuOpen) setTargetElement(null);
      }, 100);
    };

    rootEl.addEventListener('mousemove', handleEvent);
    rootEl.addEventListener('mouseleave', handleLeaveEvent);

    return () => {
      rootEl.removeEventListener('mousemove', handleEvent);
      rootEl.removeEventListener('mouseleave', handleLeaveEvent);
      if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
    };
  }, [editor, menuOpen]);

  useEffect(() => {
    const handleScroll = (e: Event) => {
      if (!menuOpen) setTargetElement(null);
    };
    document.addEventListener('scroll', handleScroll, true);
    return () => document.removeEventListener('scroll', handleScroll, true);
  }, [menuOpen]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuOpen &&
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        handleRef.current && !handleRef.current.contains(e.target as Node)) {
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
          if (blockEl) {
            setTargetElement(blockEl);
          }
        }
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, menuOpen]);

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

  if (!targetElement) return null;

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
        className={`fixed flex items-center justify-center w-6 h-6 rounded hover:bg-black/10 dark:hover:bg-white/10 text-black/30 hover:text-black/60 dark:text-white/30 dark:hover:text-white/60 transition-colors z-[90000] cursor-grab active:cursor-grabbing ${menuOpen ? 'bg-black/10 dark:bg-white/10 text-black/60 dark:text-white/60' : ''}`}
        style={{
          top: top,
          left: left,
          transform: 'translateY(-1px)' // Fine-tune vertical alignment
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMenuOpen(!menuOpen);
        }}
        onMouseDown={(e) => {
          e.preventDefault();
        }}
        onMouseLeave={(e) => {
          if (menuOpen) return;
          const relatedTarget = e.relatedTarget;
          const rootEl = editor.getRootElement();
          if (relatedTarget instanceof Node && rootEl?.contains(relatedTarget)) return;

          if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
          hideTimeoutRef.current = setTimeout(() => {
            if (!menuOpen) setTargetElement(null);
          }, 100);
        }}
      >
        <GripVertical size={16} />
      </button>

      {menuOpen && (() => {
        const estimatedMenuHeight = Math.min(options.length * 40 + 30, 330);
        const spaceBelow = window.innerHeight - top - 28;
        const spaceAbove = top;
        const flip = spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow;

        return (
          <div
            ref={menuRef}
            className={`fixed z-[100000] w-64 max-h-80 overflow-y-auto bg-white/95 dark:bg-[#1a1a1a]/95 backdrop-blur-xl border border-black/5 dark:border-white/10 rounded-xl shadow-2xl p-1 animate-in fade-in ${flip ? 'slide-in-from-bottom-2' : 'slide-in-from-top-2'}`}
            style={{
              top: flip ? undefined : top + 28,
              bottom: flip ? window.innerHeight - top + 4 : undefined,
              left: left,
            }}
          >
          <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-black/40 dark:text-white/40">
            Turn into
          </div>
          {options.map((option, i) => (
            <button
              key={option.title}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left text-black/70 dark:text-white/70 hover:bg-black/5 dark:hover:bg-white/5"
              onClick={() => onSelectOption(option)}
            >
              <div className="p-1.5 rounded-md bg-black/5 dark:bg-white/5">
                {option.menuIcon}
              </div>
              {option.title}
            </button>
          ))}
        </div>
        );
      })()}
    </>,
    document.body
  );
}
