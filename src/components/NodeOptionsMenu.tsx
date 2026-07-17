import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, ExternalLink } from 'lucide-react';

interface NodeOptionsMenuProps {
  path: string;
  iconSize?: number;
  className?: string;
}

export function NodeOptionsMenu({ path, iconSize = 18, className = "" }: NodeOptionsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!isOpen || !buttonRef.current || !menuRef.current) return;

    let rafId: number;

    const updatePosition = () => {
      if (!buttonRef.current || !menuRef.current) return;

      const rect = buttonRef.current.getBoundingClientRect();
      const actualWidth = buttonRef.current.offsetWidth || 1;
      const zoom = rect.width / actualWidth;

      const actualMenuWidth = menuRef.current.offsetWidth || 1;
      const actualMenuHeight = menuRef.current.offsetHeight || 1;

      let transformOrigin = 'top right';
      let top = rect.bottom + (4 * zoom);
      let left = rect.right - actualMenuWidth;

      if (top + (actualMenuHeight * zoom) > window.innerHeight) {
        top = rect.top - actualMenuHeight - (4 * zoom);
        transformOrigin = 'bottom right';
      }
      
      menuRef.current.style.position = 'fixed';
      menuRef.current.style.top = `${top}px`;
      menuRef.current.style.left = `${left}px`;
      menuRef.current.style.transform = `scale(${zoom})`;
      menuRef.current.style.transformOrigin = transformOrigin;
      menuRef.current.style.zIndex = '999999';

      rafId = requestAnimationFrame(updatePosition);
    };

    updatePosition();

    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        buttonRef.current && !buttonRef.current.contains(event.target as Node) &&
        menuRef.current && !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('touchstart', handleClickOutside, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchstart', handleClickOutside, true);
    };
  }, [isOpen]);

  const handleOpenInNewTab = () => {
    setIsOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set('focusNode', path);
    window.open(url.toString(), '_blank');
  };

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`} onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
      <button 
        ref={buttonRef}
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setIsOpen(!isOpen);
        }}
        className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer rounded-md outline-none"
        title="More Options"
      >
        <MoreVertical size={iconSize} />
      </button>

      {isOpen && createPortal(
        <div 
          ref={menuRef}
          className="min-w-[180px] bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 rounded-lg shadow-[0_10px_30px_-10px_rgba(0,0,0,0.3)] py-1 overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleOpenInNewTab}
            className="w-full text-left px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-2.5 transition-colors cursor-pointer"
          >
            <ExternalLink size={15} />
            <span className="font-medium">Open in New Tab</span>
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}
