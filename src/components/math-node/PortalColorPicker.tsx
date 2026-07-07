import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { HexAlphaColorPicker } from "react-colorful";

interface PortalColorPickerProps {
  isOpen: boolean;
  onClose: () => void;
  color: string;
  onChange: (c: string) => void;
  title: string;
  triggerEl: HTMLElement | null;
}

export const PortalColorPicker: React.FC<PortalColorPickerProps> = ({
  isOpen,
  onClose,
  color,
  onChange,
  title,
  triggerEl,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number }>({
    top: 0,
    left: 0,
  });

  useLayoutEffect(() => {
    if (!isOpen || !triggerEl || !popoverRef.current) return;

    const updatePosition = () => {
      const trigger = triggerEl;
      const popover = popoverRef.current;
      if (!trigger || !popover) return;

      const triggerRect = trigger.getBoundingClientRect();
      const popoverRect = popover.getBoundingClientRect();

      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Desired position is directly underneath, horizontally centered on the trigger
      let top = triggerRect.bottom + 8;
      let left =
        triggerRect.left + triggerRect.width / 2 - popoverRect.width / 2;

      // Check if it goes beyond the bottom of the viewport
      if (top + popoverRect.height > viewportHeight) {
        // Space above trigger instead
        const spaceAbove = triggerRect.top - 8 - popoverRect.height;
        if (spaceAbove > 10) {
          top = spaceAbove;
        } else {
          // If no space above either, position it matching the bottom safely clamped
          top = Math.max(10, viewportHeight - popoverRect.height - 10);
        }
      }

      // Check horizontal bounds
      if (left < 10) {
        left = 10;
      } else if (left + popoverRect.width > viewportWidth - 10) {
        left = viewportWidth - popoverRect.width - 10;
      }

      // Ensure top is not negative if viewport is tiny
      if (top < 10) {
        top = 10;
      }

      setCoords({ top, left });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition, { passive: true });
    window.addEventListener("scroll", updatePosition, { passive: true });

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition);
    };
  }, [isOpen, triggerEl]);

  // Handle click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const popover = popoverRef.current;
      const trigger = triggerEl;

      if (
        popover &&
        !popover.contains(event.target as Node) &&
        trigger &&
        !trigger.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside, {
      passive: true,
    });
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, triggerEl]);

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={popoverRef}
      style={{
        position: "fixed",
        top: `${coords.top}px`,
        left: `${coords.left}px`,
        zIndex: 9999,
      }}
      className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl w-[220px] flex flex-col items-center gap-2 animate-fadeIn"
    >
      <div className="flex justify-between items-center w-full mb-1">
        <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
          {title}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="w-[196px] polygon-picker">
        <HexAlphaColorPicker color={color} onChange={onChange} />
      </div>
      <input
        type="text"
        value={color}
        onChange={(e) => {
          const val = e.target.value;
          if (val.startsWith("#") && val.length <= 9) {
            onChange(val);
          }
        }}
        className="w-full text-center font-mono text-[10px] py-1 border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-950 text-slate-700 dark:text-slate-300 uppercase outline-none focus:border-blue-500"
        placeholder="#HEXCODE"
      />
    </div>,
    document.body,
  );
};
