import React, { 
  useState, 
  useRef, 
  useLayoutEffect, 
  useEffect, 
  useMemo, 
  useCallback,
  forwardRef
} from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  isToday,
  startOfDay,
  parseISO
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SmartDatePickerProps {
  selected: Date | string | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  className?: string;
  containerClassName?: string;
  disabled?: boolean;
  children?: React.ReactNode;
}

export const SmartDatePicker = ({
  selected,
  onChange,
  placeholder = "Select date",
  className,
  containerClassName,
  disabled = false,
  children
}: SmartDatePickerProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(() => {
    if (selected) {
      return startOfMonth(typeof selected === 'string' ? parseISO(selected) : selected);
    }
    return startOfMonth(new Date());
  });

  const triggerRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, placement: 'bottom' as 'top' | 'bottom', width: 0 });
  const [isMobile, setIsMobile] = useState(false);

  const selectedDate = useMemo(() => {
    if (!selected) return null;
    return typeof selected === 'string' ? parseISO(selected) : selected;
  }, [selected]);

  // Sync current month when popover opens
  useEffect(() => {
    if (isOpen && selectedDate) {
      setCurrentMonth(startOfMonth(selectedDate));
    }
  }, [isOpen]);

  // Handle positioning
  useLayoutEffect(() => {
    if (!isOpen || !triggerRef.current || isMobile) return;

    const updatePosition = () => {
      const triggerRect = triggerRef.current!.getBoundingClientRect();
      const calendarWidth = 320; 
      const calendarHeight = 380;
      const vh = window.innerHeight;
      const vw = window.innerWidth;

      let top = triggerRect.bottom + 8;
      let left = triggerRect.left;
      let placement: 'top' | 'bottom' = 'bottom';

      // Bottom edge detection
      if (top + calendarHeight > vh - 20) {
        const spaceAbove = triggerRect.top;
        const spaceBelow = vh - triggerRect.bottom;
        if (spaceAbove > spaceBelow) {
          top = triggerRect.top - calendarHeight - 8;
          placement = 'top';
        }
      }

      // Right edge detection
      if (left + calendarWidth > vw - 20) {
        left = vw - calendarWidth - 20;
      }

      // Left edge detection
      if (left < 20) {
        left = 20;
      }

      setCoords({ top, left, placement, width: calendarWidth });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, isMobile]);

  // Breakpoint detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle outside click
  useEffect(() => {
    if (!isOpen || isMobile) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        calendarRef.current && 
        !calendarRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen, isMobile]);

  const handleDateSelect = (date: Date) => {
    onChange(date);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  const content = (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Mobile Overlay */}
          {isMobile ? (
            <div className="fixed inset-0 z-[12000] flex items-end justify-center bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg bg-white dark:bg-[#0f141d] rounded-t-3xl shadow-2xl overflow-hidden pb-safe"
              >
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Select Date</h3>
                  <button onClick={() => setIsOpen(false)} className="p-2 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-4">
                  {renderCalendar()}
                </div>

                <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex gap-3">
                  <button 
                    onClick={() => { onChange(null); setIsOpen(false); }}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={() => setIsOpen(false)}
                    className="flex-1 py-3 px-4 rounded-xl bg-blue-600 text-white font-semibold shadow-lg shadow-blue-500/20"
                  >
                    Done
                  </button>
                </div>
              </motion.div>
            </div>
          ) : (
            /* Desktop Popup */
            createPortal(
              <motion.div
                ref={calendarRef}
                initial={{ opacity: 0, scale: 0.96, y: coords.placement === 'bottom' ? -4 : 4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: coords.placement === 'bottom' ? -4 : 4 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                style={{
                  position: 'fixed',
                  top: coords.top,
                  left: coords.left,
                  width: 320,
                  zIndex: 12000
                }}
                className="smart-datepicker-content bg-white dark:bg-[#0f141d] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden"
              >
                <div className="p-4" onClick={(e) => e.stopPropagation()}>
                  {renderCalendar()}
                </div>
              </motion.div>,
              document.body
            )
          )}
        </>
      )}
    </AnimatePresence>
  );

  function renderCalendar() {
    return (
      <div className="flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 px-2">
            {format(currentMonth, 'MMMM yyyy')}
          </h4>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-600 dark:text-slate-400 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map(day => (
            <div key={day} className="h-8 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              {day}
            </div>
          ))}
          {days.map((day, idx) => {
            const isSel = selectedDate && isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDateSelect(day)}
                className={cn(
                  "h-10 w-full rounded-xl flex items-center justify-center text-sm font-medium transition-all relative group",
                  !isCurrentMonth && "text-slate-300 dark:text-slate-600",
                  isCurrentMonth && !isSel && "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                  isSel && "bg-blue-600 text-white shadow-lg shadow-blue-500/20 z-10 scale-105",
                  isTodayDate && !isSel && "before:absolute before:bottom-1.5 before:w-1 before:h-1 before:bg-blue-500 before:rounded-full"
                )}
              >
                {format(day, 'd')}
                {isSel && (
                  <motion.div 
                    layoutId="selected-date" 
                    className="absolute inset-0 bg-blue-600 rounded-xl -z-10"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("relative inline-block", containerClassName)}>
      <div 
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={cn("w-full h-full cursor-pointer")}
      >
        {children ? children : (
          <div 
            className={cn(
              "group flex items-center gap-2 px-3 py-2 rounded-xl border transition-all",
              isOpen 
                ? "border-blue-500 bg-blue-50/30 dark:bg-blue-500/5 ring-4 ring-blue-500/10" 
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1117] hover:border-slate-300 dark:hover:border-slate-700",
              disabled && "opacity-50 cursor-not-allowed",
              className
            )}
          >
            <CalendarIcon 
              size={16} 
              className={cn(
                "transition-colors",
                selectedDate ? "text-blue-500" : "text-slate-400 group-hover:text-slate-500"
              )} 
            />
            <span className={cn(
              "text-sm font-medium flex-1 truncate",
              !selectedDate ? "text-slate-400" : "text-slate-900 dark:text-slate-100"
            )}>
              {selectedDate ? format(selectedDate, 'MMM d, yyyy') : placeholder}
            </span>
            {selectedDate && (
              <button 
                onClick={handleClear}
                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>
      {content}
    </div>
  );
};
