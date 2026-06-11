import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Type } from 'lucide-react';
import { loadGoogleFont } from '../utils/fontRegistry';

interface Preset {
  name: string;
  props: {
    fontFamily: string;
    fontWeight: string | number;
    fontStyle: string;
    fontSize: number;
    fill: string;
    textAlign: string;
    charSpacing: number;
    lineHeight: number;
    shadow?: { color: string; blur: number; offsetX: number; offsetY: number };
    stroke?: string;
    strokeWidth?: number;
  };
}

const PRESETS: Record<string, Preset[]> = {
  "Social Media": [
    {
      name: "Instagram Quote",
      props: { fontFamily: "Playfair Display", fontWeight: "italic", fontStyle: "italic", fontSize: 48, fill: "#ffffff", textAlign: "center", charSpacing: 20, lineHeight: 1.4 },
    },
    {
      name: "YouTube Thumbnail",
      props: { fontFamily: "Anton", fontWeight: "normal", fontStyle: "normal", fontSize: 120, fill: "#ffffff", textAlign: "center", charSpacing: 50, lineHeight: 1.1, stroke: "#000000", strokeWidth: 8, shadow: { color: "rgba(0,0,0,0.8)", blur: 20, offsetX: 0, offsetY: 10 } },
    },
    {
      name: "Meme Text",
      props: { fontFamily: "Impact", fontWeight: "normal", fontStyle: "normal", fontSize: 64, fill: "#ffffff", textAlign: "center", charSpacing: 0, lineHeight: 1.2, stroke: "#000000", strokeWidth: 4 },
    },
    {
      name: "Poster Title",
      props: { fontFamily: "Montserrat", fontWeight: "900", fontStyle: "normal", fontSize: 80, fill: "#ff3366", textAlign: "left", charSpacing: -20, lineHeight: 1.0 },
    }
  ],
  "Sacred / Bhakti": [
    {
      name: "Bhagavad Gita",
      props: { fontFamily: "Tiro Devanagari Hindi", fontWeight: "normal", fontStyle: "normal", fontSize: 50, fill: "#ff9933", textAlign: "center", charSpacing: 10, lineHeight: 1.5, shadow: { color: "rgba(255, 153, 51, 0.4)", blur: 15, offsetX: 0, offsetY: 0 } },
    },
    {
      name: "Sanskrit Verse",
      props: { fontFamily: "Martel", fontWeight: "bold", fontStyle: "normal", fontSize: 44, fill: "#ffffcc", textAlign: "center", charSpacing: 0, lineHeight: 1.6 },
    },
    {
      name: "Ramayan",
      props: { fontFamily: "Yatra One", fontWeight: "normal", fontStyle: "normal", fontSize: 60, fill: "#ff4d4d", textAlign: "center", charSpacing: 20, lineHeight: 1.2 },
    }
  ],
  "Professional": [
    {
      name: "Presentation Title",
      props: { fontFamily: "Inter", fontWeight: "bold", fontStyle: "normal", fontSize: 72, fill: "#1a1a1a", textAlign: "left", charSpacing: -30, lineHeight: 1.1 },
    },
    {
      name: "Blog Heading",
      props: { fontFamily: "Merriweather", fontWeight: "900", fontStyle: "normal", fontSize: 56, fill: "#333333", textAlign: "left", charSpacing: 0, lineHeight: 1.3 },
    },
    {
      name: "Documentation Header",
      props: { fontFamily: "Fira Code", fontWeight: "normal", fontStyle: "normal", fontSize: 32, fill: "#0066cc", textAlign: "left", charSpacing: 0, lineHeight: 1.5 },
    }
  ]
};

interface TypographyPresetsProps {
  onApplyPreset: (props: any) => void;
}

export function TypographyPresets({ onApplyPreset }: TypographyPresetsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleApply = (preset: Preset) => {
    loadGoogleFont(preset.props.fontFamily);
    onApplyPreset(preset.props);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 bg-[#1e1e1e] hover:bg-[#2c2c2c] border border-[#3a3a3a] rounded text-[10px] uppercase font-bold tracking-wider text-[#A0A0A0] hover:text-white transition-colors"
      >
        <Type size={12} />
        Presets
        <ChevronDown size={10} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-[#1A1A1A] border border-[#3A3A3A] rounded-lg shadow-2xl z-50 overflow-hidden text-left flex flex-col max-h-80 animate-in fade-in zoom-in-95">
          <div className="overflow-y-auto no-scrollbar py-1">
            {Object.entries(PRESETS).map(([category, items]) => (
              <div key={category} className="mb-2 last:mb-0">
                <div className="px-3 py-1 text-[9px] uppercase font-bold text-[#6A6A6A] tracking-widest bg-[#111]">
                  {category}
                </div>
                {items.map(preset => (
                  <button
                    key={preset.name}
                    className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-blue-600/20 active:bg-blue-600/40 transition-colors"
                    onClick={() => handleApply(preset)}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
