import React, { useState, useRef, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronRight } from "lucide-react";

export const ContextMenuItem = ({ icon: Icon, label, onClick, danger, shortcut, disabled }: any) => (
   <button 
     className={`w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${danger && !disabled ? 'text-red-400 hover:bg-red-500/10' : !disabled ? 'text-slate-300 hover:bg-white/5 hover:text-white' : 'text-slate-300'}`}
     onClick={(e) => { e.stopPropagation(); if(!disabled) onClick(); }}
     disabled={disabled}
   >
      <div className="flex items-start gap-2 text-left">
         {Icon && <Icon size={14} className="shrink-0 mt-[1px]" />}
         <span className="leading-tight pt-[1px]">{label}</span>
      </div>
      {shortcut && <span className="text-[10px] text-slate-600 font-mono tracking-tighter shrink-0 ml-4 pt-[2px]">{shortcut}</span>}
   </button>
);

export const ContextSubMenu = ({ icon: Icon, label, children }: any) => {
   const [isOpen, setIsOpen] = useState(false);
   const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
   const containerRef = useRef<HTMLDivElement>(null);
   const menuRef = useRef<HTMLDivElement>(null);

   useLayoutEffect(() => {
      if (isOpen && containerRef.current && menuRef.current) {
         const rect = containerRef.current.getBoundingClientRect();
         const menuRect = menuRef.current.getBoundingClientRect();
         
         let top = rect.top;
         let left = rect.right - 4;
         
         if (left + menuRect.width > window.innerWidth) {
             left = rect.left - menuRect.width + 4;
         }
         if (top + menuRect.height > window.innerHeight) {
             top = window.innerHeight - menuRect.height - 4;
         }
         
         setPosition({ top, left });
      } else if (!isOpen) {
         setPosition(null);
      }
   }, [isOpen]);

   return (
      <div 
         ref={containerRef}
         className="relative w-full"
         onMouseEnter={() => setIsOpen(true)}
         onMouseLeave={() => setIsOpen(false)}
      >
         <button 
           className="w-full px-3 py-1.5 flex items-center justify-between text-xs transition-colors text-slate-300 hover:bg-white/5 hover:text-white"
           onClick={(e) => e.stopPropagation()}
         >
            <div className="flex items-start gap-2 text-left">
               {Icon && <Icon size={14} className="shrink-0 mt-[1px]" />}
               <span className="leading-tight pt-[1px]">{label}</span>
            </div>
            <ChevronRight size={14} className="opacity-50 shrink-0" />
         </button>
         {isOpen && createPortal(
            <div 
               ref={menuRef}
               onMouseEnter={() => setIsOpen(true)}
               onMouseLeave={() => setIsOpen(false)}
               className="context-menu-container fixed min-w-[120px] bg-[#1a1a1a] border border-[#333] rounded shadow-2xl py-1 z-[60000]"
               style={position ? { top: position.top, left: position.left } : { visibility: 'hidden', top: 0, left: 0 }}
            >
               {children}
            </div>,
            document.body
         )}
      </div>
   );
};
