import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, Star, Clock, ChevronDown, Check } from 'lucide-react';
import { FONTS, FontNode, loadGoogleFont } from '../utils/fontRegistry';
import { useStore } from '../store/useStore';

interface FontPickerProps {
  value: string;
  onChange: (fontFamily: string) => void;
  className?: string;
  triggerClassName?: string;
  selectedText?: string;
  onHover?: (fontFamily: string | null) => void;
}

export function FontPicker({ value, onChange, className = "", triggerClassName = "", selectedText = "", onHover }: FontPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<'all' | 'hindi' | 'english'>('all');
  const [hoveredFont, setHoveredFont] = useState<FontNode | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  
  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('studio_favorite_fonts') || '[]');
    } catch {
      return [];
    }
  });
  const [recents, setRecents] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('studio_recent_fonts') || '[]');
    } catch {
      return [];
    }
  });

  const pickerRef = useRef<HTMLDivElement>(null);
  const [hoverCardPos, setHoverCardPos] = useState<{top: number, right: number} | null>(null);

  useEffect(() => {
    if (hoveredFont && pickerRef.current) {
       const rect = pickerRef.current.getBoundingClientRect();
       setHoverCardPos({ top: rect.top, right: window.innerWidth - rect.left + 8 });
    }
  }, [hoveredFont]);

  useEffect(() => {
    localStorage.setItem('studio_favorite_fonts', JSON.stringify(favorites));
  }, [favorites]);

  useEffect(() => {
    localStorage.setItem('studio_recent_fonts', JSON.stringify(recents));
  }, [recents]);

  const toggleFavorite = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setFavorites(prev => 
      prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
    );
  };

  const handleSelect = (font: FontNode) => {
    loadGoogleFont(font.googleFontName);
    onChange(font.fontFamily);
    
    const newRecents = [font.id, ...recents.filter(id => id !== font.id)].slice(0, 10);
    setRecents(newRecents);
    
    setIsOpen(false);
  };

  const filteredFonts = useMemo(() => {
    let result = FONTS;
    
    // Setup exact match for testing query logic
    const s = search.toLowerCase();
    
    if (s) {
       result = result.filter(f => 
          f.fontFamily.toLowerCase().includes(s) || 
          f.category.toLowerCase().includes(s)
       );
    }
    
    if (s === 'devanagari') {
       result = FONTS.filter(f => f.supportsHindi);
    } else if (s === 'serif') {
       result = FONTS.filter(f => f.category.toLowerCase().includes('serif'));
    } else if (s === 'creative') {
       result = FONTS.filter(f => f.category.toLowerCase().includes('creative'));
    }
    
    if (filter === 'hindi') {
      result = result.filter(f => f.supportsHindi);
    } else if (filter === 'english') {
      result = result.filter(f => !f.supportsHindi);
    }
    
    return result;
  }, [search, filter]);

  const favoriteFonts = useMemo(() => FONTS.filter(f => favorites.includes(f.id)), [favorites]);
  const recentFontsList = useMemo(() => recents.map(id => FONTS.find(f => f.id === id)).filter(Boolean) as FontNode[], [recents]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setHoveredFont(null);
      setFocusedIndex(-1);
      onHover?.(null);
    }
  }, [isOpen]);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [search, filter]);
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    
    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextId = Math.min(focusedIndex + 1, filteredFonts.length - 1);
      setFocusedIndex(nextId);
      const f = filteredFonts[nextId];
      if (f) {
        loadGoogleFont(f.googleFontName);
        onHover?.(f.fontFamily);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const nextId = Math.max(focusedIndex - 1, 0);
      setFocusedIndex(nextId);
      const f = filteredFonts[nextId];
      if (f) {
        loadGoogleFont(f.googleFontName);
        onHover?.(f.fontFamily);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (focusedIndex >= 0 && focusedIndex < filteredFonts.length) {
        handleSelect(filteredFonts[focusedIndex]);
      }
    }
  };

  return (
    <div className={`relative ${className}`} ref={pickerRef} onKeyDown={handleKeyDown}>
      <button
        type="button"
        className={`w-full flex items-center justify-between text-xs bg-[#181818] border border-[#3A3A3A] px-3 py-2 rounded text-white hover:border-[#4A4A4A] transition-colors focus:border-blue-500 focus:outline-none truncate ${triggerClassName}`}
        onClick={() => setIsOpen(!isOpen)}
        style={{ fontFamily: value }}
      >
        <span className="truncate flex-1 text-left">{value || "Select Font"}</span>
        <ChevronDown size={14} className="text-[#8A8A8A] shrink-0 ml-2" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-1 w-72 bg-[#1E1E1E] border border-[#3A3A3A] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          
          {/* Search Header */}
          <div className="p-3 border-b border-[#2C2C2C] space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8A8A8A]" />
              <input
                autoFocus
                type="text"
                placeholder="Search fonts, categories..."
                className="w-full bg-[#121212] border border-[#2C2C2C] rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-[#6A6A6A] focus:border-blue-500 focus:outline-none transition-colors"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex bg-[#121212] p-1 rounded-lg border border-[#2C2C2C]">
               {(['all', 'hindi', 'english'] as const).map(f => (
                  <button
                     key={f}
                     onClick={() => setFilter(f)}
                     className={`flex-1 text-[10px] font-bold uppercase tracking-wider py-1.5 rounded-md transition-colors ${filter === f ? 'bg-blue-600/20 text-blue-400' : 'text-[#6A6A6A] hover:bg-[#222]'}`}
                  >
                     {f}
                  </button>
               ))}
            </div>
          </div>

          {/* List Area */}
          <div className="max-h-[360px] overflow-y-auto no-scrollbar py-2">
            
            {!search && filter === 'all' && favoriteFonts.length > 0 && (
              <div className="mb-2">
                <div className="px-4 py-1.5 text-[10px] uppercase font-bold text-[#A0A0A0] flex items-center gap-1.5">
                  <Star size={12} className="text-yellow-500" /> Favorites
                </div>
                {favoriteFonts.map(f => (
                  <FontItem key={`fav-${f.id}`} font={f} selected={value === f.fontFamily} isFocused={false} selectedText={selectedText} onSelect={handleSelect} onToggleFav={toggleFavorite} isFav={true} onMouseEnter={(font) => { setHoveredFont(font); onHover?.(font.fontFamily); loadGoogleFont(font.googleFontName); }} onMouseLeave={() => { setHoveredFont(null); onHover?.(null); }} />
                ))}
              </div>
            )}

            {!search && filter === 'all' && recentFontsList.length > 0 && (
              <div className="mb-2">
                <div className="px-4 py-1.5 text-[10px] uppercase font-bold text-[#A0A0A0] flex items-center gap-1.5">
                  <Clock size={12} className="text-blue-400" /> Recent
                </div>
                {recentFontsList.slice(0, 5).map(f => (
                  <FontItem key={`rec-${f.id}`} font={f} selected={value === f.fontFamily} isFocused={false} selectedText={selectedText} onSelect={handleSelect} onToggleFav={toggleFavorite} isFav={favorites.includes(f.id)} onMouseEnter={(font) => { setHoveredFont(font); onHover?.(font.fontFamily); loadGoogleFont(font.googleFontName); }} onMouseLeave={() => { setHoveredFont(null); onHover?.(null); }} />
                ))}
              </div>
            )}

            <div className="px-4 py-1.5 text-[10px] uppercase font-bold text-[#A0A0A0]">
              {search ? 'Search Results' : 'All Fonts'}
            </div>
            
            {filteredFonts.length === 0 ? (
               <div className="px-4 py-6 text-center text-xs text-[#6A6A6A]">
                  No fonts found.
               </div>
            ) : (
               <div className="pb-2">
                 {filteredFonts.map((f, i) => (
                   <FontItem key={f.id} font={f} selected={value === f.fontFamily} isFocused={focusedIndex === i} selectedText={selectedText} onSelect={handleSelect} onToggleFav={toggleFavorite} isFav={favorites.includes(f.id)} onMouseEnter={(font) => { setHoveredFont(font); onHover?.(font.fontFamily); loadGoogleFont(font.googleFontName); }} onMouseLeave={() => { setHoveredFont(null); onHover?.(null); }} />
                 ))}
               </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Hover Card */}
      {hoveredFont && hoverCardPos && createPortal(
         <div 
            className="fixed z-[1000] pointer-events-none w-64 md:w-80 bg-[#1A1A1A] border border-[#3A3A3A] rounded-xl shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100 hidden md:flex" 
            style={{ 
               top: `${hoverCardPos.top}px`, 
               right: `${hoverCardPos.right}px`,
               transform: "translateY(10px)" 
            }}
         >
            <div>
               <div className="flex items-center justify-between">
                  <h3 className="text-white font-bold text-sm tracking-tight">{hoveredFont.fontFamily}</h3>
                  <span className="text-[10px] uppercase font-bold text-[#6A6A6A] tracking-wider">{hoveredFont.category}</span>
               </div>
               <div className="text-[#8A8A8A] text-xs mt-0.5">
                  {hoveredFont.supportsHindi ? 'Hindi + English' : 'English only'}
               </div>
            </div>
            
            <div className="bg-[#121212] border border-[#2C2C2C] rounded p-3 overflow-hidden">
               <div 
                  className="text-white text-base leading-snug break-words" 
                  style={{ fontFamily: `"${hoveredFont.fontFamily}", sans-serif` }}
               >
                 {selectedText || hoveredFont.previewText || (hoveredFont.supportsHindi ? "Aa राम" : "The quick brown fox jumps over the lazy dog")}
               </div>
            </div>
         </div>,
         document.body
      )}
    </div>
  );
}

const FontItem = React.memo(({ font, selected, isFocused, selectedText, onSelect, onToggleFav, isFav, onMouseEnter, onMouseLeave }: { font: FontNode, selected: boolean, isFocused: boolean, selectedText: string, onSelect: (f: FontNode) => void, onToggleFav: (e: React.MouseEvent, id: string) => void, isFav: boolean, onMouseEnter: (f: FontNode) => void, onMouseLeave: () => void }) => {
  const isObserverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadGoogleFont(font.googleFontName);
        observer.disconnect();
      }
    });

    if (isObserverRef.current) {
      observer.observe(isObserverRef.current);
    }
    return () => observer.disconnect();
  }, [font.googleFontName]);

  return (
    <div 
      ref={isObserverRef}
      className={`px-3 py-2 flex flex-col gap-1 cursor-pointer transition-colors group ${selected ? 'bg-blue-600/10' : (isFocused ? 'bg-[#3A3A3A]' : 'hover:bg-[#252525]')}`}
      onClick={() => onSelect(font)}
      onMouseEnter={() => onMouseEnter(font)}
      onMouseLeave={onMouseLeave}
      onTouchStart={() => onMouseEnter(font)}
      onTouchEnd={onMouseLeave}
      onTouchCancel={onMouseLeave}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {selected && <Check size={12} className="text-blue-500 shrink-0" />}
          <span className={`text-xs ${selected ? 'text-white' : 'text-[#A0A0A0]'} group-hover:text-white transition-colors`}>
            {font.fontFamily}
          </span>
          {font.supportsHindi && (
             <span className="text-[9px] px-1.5 bg-purple-500/10 text-purple-400 rounded uppercase font-bold tracking-tighter">Dual</span>
          )}
        </div>
        <button 
          onClick={(e) => onToggleFav(e, font.id)}
          className={`opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity p-1 ${isFav ? 'opacity-100 text-yellow-500' : 'text-[#4A4A4A] hover:text-yellow-400'}`}
        >
          <Star size={14} fill={isFav ? "currentColor" : "none"} />
        </button>
      </div>
      <div 
         className="text-white text-base truncate opacity-80 mt-0.5" 
         style={{ fontFamily: `"${font.fontFamily}", sans-serif` }}
      >
        {selectedText || font.previewText || (font.supportsHindi ? "Aa राम" : "The quick brown fox")}
      </div>
    </div>
  );
});
