import React, { useState } from 'react';

interface EdgeProps {
  key?: React.Key;
  d: string;
  style: string;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  isSelected?: boolean;
  source?: { x: number, y: number };
  target?: { x: number, y: number };
  layoutMode?: string;
}

export default function EdgeRenderer({ d, style, isHighlighted, isDimmed, isSelected, source, target, layoutMode }: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  let stroke = "#334155";
  let strokeWidth = 1.5;
  let strokeDasharray = "none";
  let inlines: React.CSSProperties = {
    transition: 'all 300ms ease-out',
    opacity: 1,
    filter: 'none'
  };

  if (style === 'dashed') {
    strokeDasharray = "5,5";
  } else if (style === 'neon') {
    stroke = "#0ea5e9";
    inlines.filter = "drop-shadow(0 0 4px rgba(14,165,233,0.8))";
  } else if (style === 'glow') {
    stroke = "#f59e0b";
    strokeWidth = 2.5;
    inlines.filter = "drop-shadow(0 0 8px rgba(245,158,11,1)) drop-shadow(0 0 12px rgba(245,158,11,0.6))";
  } else if (style === 'pulse') {
    strokeDasharray = "4,4";
    strokeWidth = 2;
    // Animation might not export, but filter will
    inlines.filter = "drop-shadow(0 0 4px " + stroke + ")";
    inlines.animation = "pulse 1.5s ease-in-out infinite"; // Not easily exported but fine
  } else if (style === 'circuit') {
    stroke = "#10b981";
    strokeWidth = 1.2;
    inlines.filter = "drop-shadow(1px 1px 0 rgba(0,0,0,0.5))";
    strokeDasharray = "30,10,5,10";
  } else if (style === 'zigzag') {
    stroke = "#ec4899";
    strokeWidth = 2;
  } else if (style === 'double') {
    strokeWidth = 4;
    strokeDasharray = "2,2";
  } else if (style === 'thin') {
    strokeWidth = 0.5;
  } else if (style === 'animated') {
    strokeDasharray = "8,8";
    inlines.animation = "dash 20s linear infinite"; 
  }

  if (isSelected) {
    stroke = "#a855f7"; // purple-500
    strokeWidth = style === 'thin' ? 1.5 : strokeWidth + 1.5;
    inlines.filter = "drop-shadow(0 0 6px rgba(168,85,247,0.6))";
    inlines.zIndex = 10;
  }

  if (isHighlighted) {
    stroke = "#38bdf8"; // sky-400
    strokeWidth = style === 'thin' ? 1.5 : strokeWidth + 1;
    inlines.filter = "drop-shadow(0 0 6px rgba(56,189,248,0.5))";
    inlines.zIndex = 20;
  } else if (isDimmed && !isHovered && !isSelected) {
    inlines.opacity = 0.2;
    inlines.filter = "grayscale(100%)";
  }

  if (isHovered) {
    stroke = "#60a5fa"; // blue-400
    strokeWidth += 2;
    inlines.filter = "drop-shadow(0 0 8px rgba(96,165,250,0.8))";
    inlines.zIndex = 30;
  }

  return (
    <g 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
    >
      {/* Invisible wider path for hit detection */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={30}
        style={{ pointerEvents: 'stroke' }}
      />
      {/* Visible path */}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        style={{ ...inlines, pointerEvents: 'none' }}
      />
      {style === 'orgChart' && source && target && (
        <>
          <circle 
            cx={layoutMode === 'vertical' ? source.x : (source.x + target.x) / 2}
            cy={layoutMode === 'vertical' ? (source.y + target.y) / 2 : source.y}
            r={5}
            fill="#0d1117"
            stroke={stroke}
            strokeWidth={1.5}
            style={{ ...inlines, pointerEvents: 'none' }}
          />
          <circle 
            cx={layoutMode === 'vertical' ? target.x : (source.x + target.x) / 2}
            cy={layoutMode === 'vertical' ? (source.y + target.y) / 2 : target.y}
            r={5}
            fill="#0d1117"
            stroke={stroke}
            strokeWidth={1.5}
            style={{ ...inlines, pointerEvents: 'none' }}
          />
        </>
      )}
    </g>
  );
}
