import React, { useState } from 'react';
import { useStore } from '../store/useStore';

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

function EdgeRenderer({ d, style, nodeTheme, isHighlighted, isDimmed, isSelected, source, target, layoutMode }: EdgeProps) {
  const [isHovered, setIsHovered] = useState(false);
  const edgeWidth = useStore(state => state.edgeWidth ?? 1.0);

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
  } else if (style === 'zigzag' || style === 'metro' || style === 'angled-step') {
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
  } else if (nodeTheme === 'nature2') {
    const vineColors = ['#95b876', '#4a7c59', '#3d5a40', '#6c8f5c', '#839e6a', '#a67c52', '#417b7a'];
    const idx = target ? (Math.floor(target.x) + Math.floor(target.y)) % vineColors.length : 0;
    stroke = vineColors[Math.abs(idx)];
    strokeWidth = 3;
    inlines.strokeLinecap = 'round';
    inlines.filter = "drop-shadow(0 2px 3px rgba(0,0,0,0.1))";
  } else if (style === 'hydrogen' || nodeTheme === 'hydrogen') {
    stroke = '#93c5fd'; // blue-300
    strokeWidth = 1.5;
    strokeDasharray = "3, 8";
    inlines.strokeLinecap = 'round';
    inlines.animation = "flow 3s linear infinite";
    inlines.filter = "drop-shadow(0 0 4px rgba(147,197,253,0.6))";
  } else if (style === 'seed' || nodeTheme === 'seed') {
    const vineColors = ['#5a8c33', '#71a044', '#467c26', '#699938'];
    const idx = target ? (Math.floor(target.x) + Math.floor(target.y)) % vineColors.length : 0;
    stroke = vineColors[Math.abs(idx)];
    strokeWidth = 2.5;
    inlines.strokeLinecap = 'round';
    inlines.filter = "drop-shadow(0 2px 3px rgba(90,140,51,0.2))";
  } else if (style === 'peepal' || nodeTheme === 'peepal') {
    stroke = "#daf379";
    strokeWidth = 2.4;
    inlines.strokeLinecap = 'round';
    inlines.filter = "drop-shadow(0 2px 4px rgba(0,0,0,0.2))";
  } else if (style === 'banyan' || nodeTheme === 'banyan') {
    stroke = "#e2f97c";
    strokeWidth = 3.2;
    inlines.strokeLinecap = 'round';
    inlines.filter = "drop-shadow(0 2px 5px rgba(0,0,0,0.25))";
  }

  if (style === 'ludo' || nodeTheme === 'ludo') {
    const ludoColors = ['#ff4d4d', '#2ecc71', '#f1c40f', '#3498db'];
    // Try to get a consistent color based on target data if source is not available enough
    // For now we'll use a neutral slate or a random-but-deterministic color if we can
    stroke = '#94a3b8'; // default
    strokeWidth = 14;
    inlines.strokeLinecap = 'butt';
  }

  if (style === 'chess' || nodeTheme === 'chess') {
    stroke = '#d4af37'; // gold
    strokeWidth = 1.5;
    inlines.opacity = 0.6;
    inlines.filter = "drop-shadow(0 0 4px rgba(212,175,55,0.4))";
  }

  if (style === 'octopus' || nodeTheme === 'octopus') {
    stroke = '#4f46e5'; // Deep Indigo glow base
    strokeWidth = 8;
    inlines.strokeLinecap = 'round';
    inlines.filter = "drop-shadow(0 0 6px rgba(79,70,229,0.5))";
  }

  strokeWidth = strokeWidth * edgeWidth;

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
      {(style === 'ludo' || nodeTheme === 'ludo') && (
        <>
           {/* White middle track */}
           <path
             d={d}
             fill="none"
             stroke="white"
             strokeWidth={strokeWidth * 0.4}
             style={{ ...inlines, pointerEvents: 'none', opacity: 0.8 }}
           />
           {/* Ladder steps */}
           <path
             d={d}
             fill="none"
             stroke="#000"
             strokeWidth={strokeWidth}
             strokeDasharray={`1, 10`}
             style={{ ...inlines, pointerEvents: 'none', opacity: 0.2 }}
           />
        </>
      )}
      {(style === 'octopus' || nodeTheme === 'octopus') && (
        <>
           {/* Tentacle texture / suction cups */}
           <path
             d={d}
             fill="none"
             stroke="#c7d2fe"
             strokeWidth={strokeWidth * 0.4}
             strokeDasharray="0, 10"
             strokeLinecap="round"
             style={{ ...inlines, pointerEvents: 'none', filter: "drop-shadow(0 0 4px #818cf8)", opacity: 0.8 }}
           />
           {/* Inner luminescent core */}
           <path
             d={d}
             fill="none"
             stroke="#a5b4fc"
             strokeWidth={strokeWidth * 0.15}
             style={{ opacity: 0.9, pointerEvents: 'none', filter: "drop-shadow(0 0 3px #6366f1)" }}
           />
        </>
      )}
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
      {(style === 'nature2' || nodeTheme === 'nature2') && source && target && (
        <>
           <path 
             d={`M ${(source.x + target.x)/2} ${(source.y + target.y)/2} Q ${(source.x + target.x)/2 - 12} ${(source.y + target.y)/2 - 12} ${(source.x + target.x)/2 + 2} ${(source.y + target.y)/2 - 15} Q ${(source.x + target.x)/2 + 10} ${(source.y + target.y)/2} ${(source.x + target.x)/2} ${(source.y + target.y)/2}`}
             fill={stroke}
             opacity={0.85}
             style={{pointerEvents: 'none'}}
           />
        </>
      )}
      {(style === 'hydrogen' || nodeTheme === 'hydrogen') && source && target && (
        <>
           <circle
             cx={(source.x + target.x) / 2}
             cy={(source.y + target.y) / 2}
             r={2.5}
             fill="#bfdbfe"
             style={{ filter: "drop-shadow(0 0 6px rgba(191,219,254,1))", pointerEvents: 'none' }}
           >
             <animate attributeName="cx" values={`${source.x};${target.x}`} dur="4s" repeatCount="indefinite" />
             <animate attributeName="cy" values={`${source.y};${target.y}`} dur="4s" repeatCount="indefinite" />
           </circle>
           <circle
             cx={target.x}
             cy={target.y}
             r={3.5}
             fill="#93c5fd"
             style={{ filter: "drop-shadow(0 0 5px rgba(147,197,253,0.8))", pointerEvents: 'none' }}
           />
        </>
      )}    
      {(style === 'seed' || nodeTheme === 'seed') && source && target && (
        <g style={{pointerEvents: 'none'}}>
           <circle cx={target.x} cy={target.y} r={4} fill="#f4f7f0" stroke={stroke} strokeWidth={2} />
           {/* Draw a little leaf near the target */}
           <path 
             d={`M ${target.x} ${target.y} Q ${target.x - 12} ${target.y - 18}, ${target.x - 18} ${target.y - 6} Q ${target.x - 6} ${target.y}, ${target.x} ${target.y}`}
             fill={stroke} opacity={0.9}
           />
        </g>
      )}
      {(style === 'peepal' || nodeTheme === 'peepal') && source && target && (
        <g style={{pointerEvents: 'none'}}>
           {/* Draw a beautiful yellow-green petiole connection joint swelling at the base of the leaf */}
           <circle cx={target.x} cy={target.y} r={3.5} fill="#daf379" stroke="#3a5a40" strokeWidth={1} />
        </g>
      )}
      {(style === 'banyan' || nodeTheme === 'banyan') && source && target && (
        <g style={{pointerEvents: 'none'}}>
           {/* Draw a robust golden-green woody petiole sheath swelling at the base of the banyan leaf */}
           <circle cx={target.x} cy={target.y} r={4.5} fill="#e2f97c" stroke="#1b4332" strokeWidth={1.5} />
        </g>
      )}
    </g>
  );
}

export default React.memo(EdgeRenderer);
