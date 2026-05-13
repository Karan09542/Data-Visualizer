import React, { useState } from 'react';

interface EdgeProps {
  key?: React.Key;
  d: string;
  style: string;
  nodeTheme?: string;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  isSelected?: boolean;
  source?: { x: number, y: number };
  target?: { x: number, y: number };
  layoutMode?: string;
}

export default function EdgeRenderer({ d, style, nodeTheme, isHighlighted, isDimmed, isSelected, source, target, layoutMode }: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);

  let stroke = "#334155";
  let strokeWidth = 1.5;
  let strokeDasharray = "none";
  let inlines: React.CSSProperties = {
    transition: 'all 300ms ease-out',
    opacity: 1,
    filter: 'none'
  };

  // Base style logic
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
    inlines.filter = "drop-shadow(0 0 4px " + stroke + ")";
    inlines.animation = "pulse 1.5s ease-in-out infinite";
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

  // Theme-specific overrides if style is default or specifically requested
  if (nodeTheme === 'nature') {
    stroke = "#6b8e23";
    strokeWidth = 2;
    // Living branches logic: more organic feel
  } else if (nodeTheme === 'circuit') {
    stroke = "#00f3ff";
    strokeWidth = 1;
    strokeDasharray = "50,10,5,10";
    inlines.filter = "drop-shadow(0 0 2px rgba(0,243,255,0.5))";
  } else if (nodeTheme === 'galaxy') {
    stroke = "rgba(168, 85, 247, 0.4)";
    strokeWidth = 1;
    inlines.filter = "drop-shadow(0 0 5px rgba(168, 85, 247, 0.3))";
  } else if (nodeTheme === 'neon') {
    stroke = "#ff00ff";
    inlines.filter = "drop-shadow(0 0 8px #ff00ff)";
  } else if (nodeTheme === 'lava') {
    stroke = "#ff4500";
    strokeWidth = 2.5;
    inlines.filter = "drop-shadow(0 0 10px #ff4500)";
  } else if (nodeTheme === 'ocean') {
    stroke = "#005f73";
    strokeWidth = 1.5;
    inlines.filter = "drop-shadow(0 0 8px rgba(0,95,115,0.4))";
  } else if (nodeTheme === 'hacker') {
    stroke = "#00ff41";
    strokeWidth = 0.8;
  } else if (nodeTheme === 'neural') {
    stroke = "rgba(96, 165, 250, 0.5)";
    strokeDasharray = "2,4";
    inlines.animation = "dash 5s linear infinite";
  } else if (nodeTheme === 'river') {
    stroke = "#00b4d8";
    strokeWidth = 3;
    inlines.opacity = 0.6;
    strokeDasharray = "10,5";
    inlines.animation = "flow 2s linear infinite";
  } else if (nodeTheme === 'abstract') {
    stroke = "url(#abstract-gradient)"; // Need to define this in GraphVisualizer
    strokeWidth = 2;
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
