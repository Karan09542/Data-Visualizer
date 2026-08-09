import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RgbaStringColorPicker } from "react-colorful";
import { Pipette } from "lucide-react";

export const ColorPickerPortal = ({ color, onChange, onClose, anchorRef }: any) => {
   const popoverRef = useRef<HTMLDivElement>(null);
   const [coords, setCoords] = useState({ top: 0, left: 0 });
   const [isPositioned, setIsPositioned] = useState(false);
   const [isEyeDropperSupported, setIsEyeDropperSupported] = useState(false);

   useEffect(() => {
      setIsEyeDropperSupported('EyeDropper' in window);
   }, []);

   useEffect(() => {
      const handleOutsideClick = (e: MouseEvent) => {
         if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
            onClose();
         }
      };
      // Use capture phase to ensure we catch the click before other elements might stop propagation
      document.addEventListener("mousedown", handleOutsideClick, true);
      return () => document.removeEventListener("mousedown", handleOutsideClick, true);
   }, [onClose, anchorRef]);

   React.useLayoutEffect(() => {
      if (!anchorRef.current || !popoverRef.current) return;

      const anchorRect = anchorRef.current.getBoundingClientRect();
      const popoverRect = popoverRef.current.getBoundingClientRect();

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Default positioning: below the trigger
      let top = anchorRect.bottom + window.scrollY + 8;
      let left = anchorRect.left + window.scrollX;

      // Adjust vertical position if it overflows the bottom
      if (anchorRect.bottom + popoverRect.height + 8 > viewportHeight) {
         // Place it above if there is space
         if (anchorRect.top - popoverRect.height - 8 > 0) {
            top = anchorRect.top + window.scrollY - popoverRect.height - 8;
         } else {
            // Otherwise, constrain it inside viewport
            top = Math.max(8 + window.scrollY, viewportHeight - popoverRect.height - 8 + window.scrollY);
         }
      }

      // Adjust horizontal position if it overflows the right side
      if (anchorRect.left + popoverRect.width > viewportWidth) {
         left = viewportWidth - popoverRect.width - 12 + window.scrollX;
      }

      // Ensure it doesn't clip off the left or top edges
      if (left < window.scrollX) left = window.scrollX + 8;
      if (top < window.scrollY) top = window.scrollY + 8;

      setCoords({ top, left });
      setIsPositioned(true);
   }, [anchorRef]);

   const hexToRgba = (hex: string, alpha = 1) => {
      let c = hex.replace('#', '');
      if (c.length === 3) {
         c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      }
      const r = parseInt(c.substring(0, 2), 16) || 0;
      const g = parseInt(c.substring(2, 4), 16) || 0;
      const b = parseInt(c.substring(4, 6), 16) || 0;
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
   };

   const hexToRgb = (hex: string) => {
      let c = hex.replace('#', '');
      if (c.length === 3) {
         c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
      }
      const r = parseInt(c.substring(0, 2), 16) || 0;
      const g = parseInt(c.substring(2, 4), 16) || 0;
      const b = parseInt(c.substring(4, 6), 16) || 0;
      return `rgb(${r}, ${g}, ${b})`;
   };

   const handleEyeDropper = async () => {
      if (!('EyeDropper' in window)) return;
      try {
         const eyeDropper = new (window as any).EyeDropper();
         const result = await eyeDropper.open();
         if (result && result.sRGBHex) {
            let pickedColor = result.sRGBHex;
            if (color && typeof color === 'string') {
               if (color.toLowerCase().startsWith('rgba')) {
                  pickedColor = hexToRgba(pickedColor);
               } else if (color.toLowerCase().startsWith('rgb')) {
                  pickedColor = hexToRgb(pickedColor);
               }
            }
            onChange(pickedColor);
         }
      } catch (err) {
         console.warn("EyeDropper failed or cancelled:", err);
      }
   };

   if (!anchorRef.current) return null;

   return createPortal(
      <div 
         ref={popoverRef} 
         className="absolute p-3 bg-white dark:bg-[#1C1C1C] border border-slate-200 dark:border-[#333] rounded-xl shadow-2xl flex flex-col gap-3 transition-opacity duration-100 z-[999999]"
         style={{ 
            top: coords.top, 
            left: coords.left, 
            opacity: isPositioned ? 1 : 0,
            visibility: isPositioned ? 'visible' : 'hidden'
         }}
      >
         <RgbaStringColorPicker color={color} onChange={onChange} />
         <div className="flex items-center gap-2 mt-0.5">
            <div className="w-7 h-7 rounded-md shadow-inner border border-white/10 shrink-0" style={{ backgroundColor: color }}></div>
            <div className="flex-1 relative">
               <input 
                  type="text" 
                  value={color} 
                  onChange={(e) => onChange(e.target.value)} 
                  className="bg-slate-100 dark:bg-[#121212] border border-slate-200 dark:border-[#333] rounded-md px-2.5 py-1.5 text-[11px] text-slate-800 dark:text-slate-300 font-mono w-full focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50 transition-all" 
               />
            </div>
            {isEyeDropperSupported && (
               <button 
                  type="button"
                  onClick={handleEyeDropper}
                  className="w-7 h-7 bg-slate-100 dark:bg-[#2A2A2A] hover:bg-slate-200 dark:hover:bg-[#3A3A3A] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-md border border-slate-200 dark:border-[#333] hover:border-slate-300 dark:hover:border-[#444] transition-all active:scale-95 shrink-0 flex items-center justify-center shadow-sm"
                  title="Pick color from screen"
               >
                  <Pipette size={14} />
               </button>
            )}
         </div>
      </div>,
      document.body
   );
};

export const ColorPickerTrigger = ({ color, onChange, className, label }: any) => {
   const [isOpen, setIsOpen] = useState(false);
   const triggerRef = useRef<HTMLButtonElement>(null);
   const defaultClass = "w-5 h-5 rounded border border-[#333] shadow-inner cursor-pointer transition active:scale-95 hover:border-slate-400";
   return (
      <>
         <button ref={triggerRef} className={className || defaultClass} style={{ backgroundColor: color }} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
            {label && <span className="sr-only">{label}</span>}
         </button>
         {isOpen && <ColorPickerPortal color={color} onChange={onChange} onClose={() => setIsOpen(false)} anchorRef={triggerRef} />}
      </>
   );
};
