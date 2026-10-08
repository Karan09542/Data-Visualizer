import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  COMMAND_PRIORITY_LOW,
  SELECTION_CHANGE_COMMAND,
} from 'lexical';
import { createPortal } from 'react-dom';
import { GripVertical } from 'lucide-react';
import {
  TOGGLE_SLASH_MENU_COMMAND,
  SLASH_MENU_STATE_CHANGED_COMMAND,
} from './SlashCommandPlugin';

export default function BlockHandlePlugin() {
  const [editor] = useLexicalComposerContext();
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const handleRef = useRef<HTMLButtonElement>(null);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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
          const allLis = Array.from(child.querySelectorAll('li')) as HTMLElement[];
          // Search leaf LIs first (items that don't have nested ul/ol)
          for (const item of allLis) {
            if (item.querySelector('ul, ol')) continue;
            const itemRect = item.getBoundingClientRect();
            if (y >= itemRect.top - 2 && y <= itemRect.bottom + 2) {
              return item;
            }
          }
          // Fallback to any LI
          for (const item of allLis) {
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

  /** Global mousemove listener ensures hover detection only activates when cursor is in the gutter / left margin */
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (menuOpen) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Keep active if mouse is hovering over the handle button itself or the open slash menu
      if (handleRef.current?.contains(target) || target.closest('[data-slash-menu="true"]')) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        return;
      }

      const root = editor.getRootElement();
      if (!root) return;

      const rootRect = root.getBoundingClientRect();
      const container = root.closest('.sticky-note-scrollbar') || root.parentElement;
      const containerRect = container ? container.getBoundingClientRect() : rootRect;

      // Check if mouse is vertically within the editor container
      const isNearY = e.clientY >= containerRect.top && e.clientY <= containerRect.bottom;
      if (!isNearY) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
          if (!menuOpen) setTargetElement(null);
        }, 150);
        return;
      }

      // Find the block at the cursor's Y coordinate
      const block = findBlockAtY(e.clientY) || getBlockElement(target);
      if (!block || !block.isConnected) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
          if (!menuOpen) setTargetElement(null);
        }, 150);
        return;
      }

      const blockRect = block.getBoundingClientRect();
      const isChecklist =
        block.classList.contains('lexical-checklist-checked') ||
        block.classList.contains('lexical-checklist-unchecked');
      const isBullet = block.tagName === 'LI' && !isChecklist;

      // Strict gutter boundary to ensure hovering ON the checkbox, bullet, or text NEVER shows 6-dots handle
      // Checkbox is at blockRect.left -> gutter is strictly left of it
      // Bullet marker is at ~blockRect.left - 18px -> gutter is strictly left of it
      // Regular block text starts at blockRect.left -> gutter is left margin
      const minX = Math.min(rootRect.left - 80, containerRect.left);
      const gutterRightBound = isChecklist
        ? blockRect.left - 2
        : isBullet
        ? blockRect.left - 22
        : blockRect.left + 4;

      const isInGutter = e.clientX >= minX && e.clientX <= gutterRightBound;

      if (isInGutter) {
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        setTargetElement(block);
      } else {
        // Cursor is over checkbox, bullet, or text content -> hide handle
        if (hideTimeoutRef.current) clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = setTimeout(() => {
          if (!menuOpen) setTargetElement(null);
        }, 150);
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

  // Synchronize menu open state from SlashCommandPlugin
  useEffect(() => {
    return editor.registerCommand(
      SLASH_MENU_STATE_CHANGED_COMMAND,
      ({ isOpen }) => {
        setMenuOpen(isOpen);
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

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

  const root = editor.getRootElement();
  const container = root ? (root.closest('.sticky-note-scrollbar') || root.parentElement) : null;
  const containerLeft = container ? container.getBoundingClientRect().left : 0;
  left = Math.max(containerLeft + 2, left);

  return createPortal(
    <button
      ref={handleRef}
      type="button"
      data-block-handle="true"
      aria-label="Block formatting options"
      aria-haspopup="menu"
      aria-expanded={menuOpen}
      title="Click to open block options"
      className={`fixed flex items-center justify-center w-6 h-6 rounded-lg hover:bg-black/8 dark:hover:bg-white/10 text-black/45 hover:text-black/80 dark:text-white/45 dark:hover:text-white/85 transition-colors z-[90000] cursor-grab active:cursor-grabbing ${
        menuOpen ? 'bg-black/10 dark:bg-white/14 text-black dark:text-white' : ''
      }`}
      style={{
        top: top,
        left: left,
        transform: 'translateY(-1px)'
      }}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (handleRef.current && targetElement) {
          const handleRect = handleRef.current.getBoundingClientRect();
          editor.dispatchCommand(TOGGLE_SLASH_MENU_COMMAND, {
            rect: handleRect,
            targetElement: targetElement,
          });
        }
      }}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
    >
      <GripVertical size={16} />
    </button>,
    document.body
  );
}
