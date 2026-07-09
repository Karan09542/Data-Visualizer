import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { RgbaStringColorPicker } from "react-colorful";
import { Pipette } from "lucide-react";

export const ColorPickerPortal = ({ color, onChange, onClose, anchorRef }: any) => {
   const popoverRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const handleOutsideClick = (e: MouseEvent) => {
         if (popoverRef.current && !popoverRef.current.contains(e.target as Node) && anchorRef.current && !anchorRef.current.contains(e.target as Node)) {
            onClose();
         }
      };
      document.addEventListener("mousedown", handleOutsideClick);
      return () => document.removeEventListener("mousedown", handleOutsideClick);
   }, [onClose, anchorRef]);

   if (!anchorRef.current) return null;

   const rect = anchorRef.current.getBoundingClientRect();
   const top = rect.bottom + window.scrollY + 10;
   const left = rect.left + window.scrollX;

   return createPortal(
      <div 
         ref={popoverRef} 
         className="absolute z-50 p-3 bg-[#1C1C1C] border border-[#333] rounded-lg shadow-2xl flex flex-col gap-3"
         style={{ top, left }}
      >
         <RgbaStringColorPicker color={color} onChange={onChange} />
         <div className="flex items-center gap-2 px-1">
            <div className="w-6 h-6 rounded-md shadow-inner border border-white/10" style={{ backgroundColor: color }}></div>
            <input type="text" value={color} onChange={(e) => onChange(e.target.value)} className="bg-[#121212] border border-[#333] rounded px-2 py-1 text-xs text-slate-300 font-mono w-full focus:outline-none focus:border-blue-500" />
         </div>
      </div>,
      document.body
   );
};

export const ColorPickerTrigger = ({ color, onChange, className, label }: any) => {
   const [isOpen, setIsOpen] = useState(false);
   const triggerRef = useRef<HTMLButtonElement>(null);
   return (
      <>
         <button ref={triggerRef} className={className} style={{ backgroundColor: color }} onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}>
            {label && <span className="sr-only">{label}</span>}
         </button>
         {isOpen && <ColorPickerPortal color={color} onChange={onChange} onClose={() => setIsOpen(false)} anchorRef={triggerRef} />}
      </>
   );
};
