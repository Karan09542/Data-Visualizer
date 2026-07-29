import { useState, useRef, useLayoutEffect, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, Check, Search } from "lucide-react";

interface Option {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  label?: string;
  value: string;
  options: Option[] | string[];
  onChange: (value: string) => void;
  icon?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  placeholder?: string;
  searchable?: boolean;
}

export default function CustomSelect({
  label,
  value,
  options: rawOptions,
  onChange,
  icon,
  className = "",
  disabled = false,
  placeholder = "Select...",
  searchable = false,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const options = rawOptions.map((opt) =>
    typeof opt === "string" ? { label: opt, value: opt } : opt
  );

  const filteredOptions = options.filter(opt => 
    !searchable || opt.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedOption = options.find((opt) => opt.value === value);

  useLayoutEffect(() => {
    if (isOpen && containerRef.current && dropdownRef.current) {
      const parentRect = containerRef.current.getBoundingClientRect();
      const dropdownRect = dropdownRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let top = parentRect.bottom + 4;
      let left = parentRect.left;

      // Vertical adjustment
      if (top + dropdownRect.height > viewportHeight) {
        top = parentRect.top - dropdownRect.height - 4;
      }

      // Horizontal adjustment
      if (left + dropdownRect.width > viewportWidth) {
        left = viewportWidth - dropdownRect.width - 8;
      }

      if (left < 8) {
        left = 8;
      }

      setCoords({ top, left, width: Math.max(parentRect.width, 160) });
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        if (searchable) setSearchQuery("");
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, searchable]);

  return (
    <div
      ref={containerRef}
      className={`relative flex items-center gap-2 ${className}`}
    >
      {label && (
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 transition-colors">
          {label}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center justify-between gap-2 px-2 py-1 text-xs font-semibold rounded border transition-all outline-none
          ${
            isOpen
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/50 dark:bg-blue-900/10"
              : "border-slate-200 dark:border-slate-800/60 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
          }
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          text-slate-800 dark:text-slate-200
        `}
      >
        <div className="flex items-center gap-1.5 truncate">
          {icon && <span className="text-slate-400">{icon}</span>}
          <span className="truncate">
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>
        <ChevronDown
          size={14}
          className={`text-slate-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.1, ease: "easeOut" }}
            style={{
              position: "fixed",
              top: coords.top,
              left: coords.left,
              minWidth: coords.width,
              zIndex: 99999,
            }}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-xl overflow-hidden py-1"
          >
            {searchable && (
              <div className="p-2 border-b border-slate-200 dark:border-slate-800">
                <div className="relative">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    autoFocus
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 text-xs rounded-md pl-7 pr-2 py-1.5 outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            )}
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors
                    ${
                      value === option.value
                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                        : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    }
                  `}
                >
                  <div className="flex items-center gap-2">
                    {option.icon}
                    <span>{option.label}</span>
                  </div>
                  {value === option.value && <Check size={12} />}
                </button>
              ))
            ) : (
              <div className="p-3 text-xs text-center text-slate-500">No results found</div>
            )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
