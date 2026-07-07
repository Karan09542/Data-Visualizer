import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Maximize2, Minimize2, Trash2, GripHorizontal, Edit2, Palette, Clipboard, CornerRightDown, CopyPlus, Check } from 'lucide-react';
import { db, StickyNote as IStickyNote } from '../lib/db';

interface Props {
  note: IStickyNote;
  onDelete: (id: string) => void;
  onUpdate: (note: IStickyNote) => void;
  onDuplicate: (note: IStickyNote) => void;
  onFocus: (id: string) => void;
}

const COLORS = [
  '#fef08a', // Yellow
  '#bbf7d0', // Green
  '#bfdbfe', // Blue
  '#fecaca', // Red
  '#e9d5ff', // Purple
  '#fed7aa', // Orange
  '#fbcfe8', // Pink
];

export default function StickyNote({ note, onDelete, onUpdate, onDuplicate, onFocus }: Props) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(note.content);
  const [showColors, setShowColors] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);
  const [duplicateStatus, setDuplicateStatus] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [isEditing]);

  const handleSave = () => {
    setIsEditing(false);
    onUpdate({ ...note, content, updatedAt: Date.now() });
  };

  const toggleMinimize = () => {
    onUpdate({ ...note, isMinimized: !note.isMinimized, updatedAt: Date.now() });
  };

  const toggleMaximize = () => {
    onUpdate({ ...note, isMaximized: !note.isMaximized, updatedAt: Date.now() });
  };

  const changeColor = (color: string) => {
    onUpdate({ ...note, color, updatedAt: Date.now() });
    setShowColors(false);
  };

  const handleDragEnd = (_: any, info: any) => {
    if (note.isMaximized) return;
    const newX = note.x + info.offset.x;
    const newY = note.y + info.offset.y;
    onUpdate({ ...note, x: newX, y: newY, updatedAt: Date.now() });
  };

  const handleResize = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const startY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const startWidth = note.width;
    const startHeight = note.height;

    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const currentX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const currentY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const newWidth = Math.max(160, startWidth + (currentX - startX));
      const newHeight = Math.max(160, startHeight + (currentY - startY));
      
      onUpdate({ ...note, width: newWidth, height: newHeight, updatedAt: Date.now() });
    };

    const onEnd = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onEnd);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onEnd);
  };

  const handleCopy = (content: string) => {
    navigator.clipboard.writeText(content);
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  const handleDuplicateClick = () => {
    setDuplicateStatus(true);
    onDuplicate(note);
    setTimeout(() => setDuplicateStatus(false), 500);
  };

  const isMax = note.isMaximized;

  return (
    <motion.div
      ref={containerRef}
      drag={!isMax}
      dragMomentum={false}
      onDragStart={() => onFocus(note.id)}
      onDragEnd={handleDragEnd}
      initial={false}
      animate={{ 
        opacity: 1, 
        scale: 1, 
        x: isMax ? 0 : note.x, 
        y: isMax ? 0 : note.y,
        width: isMax ? '100vw' : note.width,
        height: isMax ? '100dvh' : note.height,
        zIndex: isMax ? 10000 : (note.zIndex || 5000),
      }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`fixed shadow-2xl overflow-hidden flex flex-col group border border-black/5 dark:border-white/10 ${
        isMax ? 'rounded-none' : 'rounded-2xl'
      }`}
      style={{ 
        backgroundColor: note.color, 
        color: '#1a1a1a',
        pointerEvents: 'auto',
      }}
      onPointerDown={() => onFocus(note.id)}
    >
      {/* Header / Drag Handle */}
      <div className={`h-10 flex items-center justify-between px-3 cursor-grab active:cursor-grabbing shrink-0 bg-black/5 group-hover:bg-black/10 transition-colors ${isMax ? 'cursor-default' : ''}`}>
        <div className="flex items-center gap-2">
          {!isMax && <GripHorizontal size={16} className="opacity-40" />}
          {isMax && <Edit2 size={14} className="opacity-40" />}
          <span className="text-[10px] font-bold uppercase tracking-widest opacity-30 select-none">
            {isMax ? 'Fullscreen Note' : 'Sticky Note'}
          </span>
        </div>
        
        <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button 
            onClick={() => setShowColors(!showColors)}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            title="Change Color"
          >
            <Palette size={16} />
          </button>
          <button 
            onClick={() => handleCopy(note.content)}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors relative"
            title="Copy to Clipboard"
          >
            <AnimatePresence mode="wait">
              {copyStatus ? (
                <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Check size={16} className="text-emerald-600" />
                </motion.div>
              ) : (
                <motion.div key="clip" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                  <Clipboard size={16} />
                </motion.div>
              )}
            </AnimatePresence>
          </button>
          <button 
            onClick={handleDuplicateClick}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            title="Duplicate Note"
          >
            <motion.div animate={duplicateStatus ? { scale: 1.2, rotate: 5 } : { scale: 1, rotate: 0 }}>
              <CopyPlus size={16} />
            </motion.div>
          </button>
          <button 
            onClick={toggleMaximize}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            title={isMax ? "Restore" : "Fullscreen"}
          >
            {isMax ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button 
            onClick={toggleMinimize}
            className="p-1.5 hover:bg-black/10 rounded-lg transition-colors"
            title="Minimize to List"
          >
            <X size={16} />
          </button>
          <button 
            onClick={() => onDelete(note.id)}
            className="p-1.5 hover:bg-red-500/20 text-red-700 rounded-lg transition-colors ml-1"
            title="Delete Note"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative p-4 sm:p-6 overflow-hidden">
        <div className={`h-full flex flex-col transition-shadow duration-200 rounded-xl ${isEditing ? 'bg-black/5 ring-1 ring-black/10' : ''}`}>
          {isEditing ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onBlur={handleSave}
              className={`w-full h-full bg-transparent border-none focus:ring-0 focus:outline-none p-3 resize-none font-medium leading-relaxed placeholder:opacity-30 custom-scrollbar ${
                isMax ? 'text-2xl sm:text-4xl' : 'text-sm sm:text-base'
              }`}
              placeholder="Start typing..."
            />
          ) : (
            <div 
              className={`w-full h-full font-medium leading-relaxed whitespace-pre-wrap break-words cursor-text overflow-y-auto custom-scrollbar p-3 ${
                isMax ? 'text-2xl sm:text-4xl' : 'text-sm sm:text-base'
              }`}
              onClick={() => setIsEditing(true)}
            >
              {note.content || <span className="opacity-30 italic">Click to edit note...</span>}
            </div>
          )}
        </div>

        {/* Color Picker Overlay */}
        <AnimatePresence>
          {showColors && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-4 left-4 right-4 p-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl flex justify-between border border-black/10 z-10"
            >
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => changeColor(c)}
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded-full border border-black/10 transition-all hover:scale-125 shadow-sm"
                  style={{ backgroundColor: c }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Resize Handle */}
      {!isMax && (
        <div 
          onMouseDown={handleResize}
          onTouchStart={handleResize}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize flex items-center justify-center text-black/20 hover:text-black/40 transition-colors"
        >
          <CornerRightDown size={14} className="rotate-45" />
        </div>
      )}

      {/* Footer Info */}
      <div className="h-6 px-4 flex items-center justify-between opacity-30 select-none">
        <span className="text-[9px] font-mono uppercase tracking-widest">
          {note.content.length} characters
        </span>
        <span className="text-[9px] font-mono uppercase tracking-widest">
          Updated {new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </motion.div>
  );
}
