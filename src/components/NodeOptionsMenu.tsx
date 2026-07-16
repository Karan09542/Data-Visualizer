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
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (isOpen && buttonRef.current && menuRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const menuRect = menuRef.current.getBoundingClientRect();

      let top = rect.bottom + 4;
      let left = rect.right - menuRect.width;

      if (top + menuRect.height > window.innerHeight) {
        top = rect.top - menuRect.height - 4;
      }
      
      setMenuStyle({
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        zIndex: 999999,
      });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
        onClick={(e) => {
          e.stopPropagation();
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
          style={menuStyle}
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
