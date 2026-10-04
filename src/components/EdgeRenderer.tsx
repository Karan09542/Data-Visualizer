import React, { useId, useState } from 'react';
import { useStore } from '../store/useStore';
import { PALETTE_EDGE_COLORS } from '../constants/visualizer';

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
  targetData?: any;
}

function EdgeRenderer({ d, style, nodeTheme, isHighlighted, isDimmed, isSelected, source, target, layoutMode, targetData }: EdgeProps) {
  const isHoveredState = useState(false);
  const isHovered = isHoveredState[0];
  const setIsHovered = isHoveredState[1];
  const edgeWidth = useStore(state => state.edgeWidth ?? 1.0);
  // For this edge's own arrowhead marker and fade gradient
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const appTheme = useStore(state => state.appTheme);
  const jsNodeErrors = useStore(state => state.jsNodeErrors);
  const jsNodeResponses = useStore(state => state.jsNodeResponses);

  let stroke = "#334155";
  let strokeWidth = 1.5;
  let strokeDasharray = "none";
  let inlines: React.CSSProperties = {
    transition: 'stroke 300ms ease-out, stroke-width 300ms ease-out, filter 300ms ease-out, opacity 300ms ease-out',
    opacity: 1,
    filter: 'none'
  };

  const isJsNodeEdge = targetData && targetData.type === 'string' && typeof targetData.name === 'string' && (targetData.name.endsWith('_js_node') || targetData.name.endsWith('_ts_node'));

  // Base style logic
  if (style === 'dashed') {
    strokeDasharray = "5,5";
  } else if (style === 'circuit') {
    stroke = "#10b981";
    strokeWidth = 1.2;
    inlines.filter = "drop-shadow(1px 1px 0 rgba(0,0,0,0.5))";
    strokeDasharray = "30,10,5,10";
  } else if (style === 'metro' || style === 'angled-step') {
    stroke = "#ec4899";
    strokeWidth = 2;
  }

  // Fine round dots (a near-zero dash with round caps draws a dot)
  if (style === 'dotted') {
    strokeDasharray = "0.1 5";
    strokeWidth = 2;
    inlines.strokeLinecap = 'round';
  }

  // JS Node Edge Override
  if (isJsNodeEdge) {
    stroke = "#eab308"; // yellow-500
    strokeWidth = 2;
    strokeDasharray = "6,4";
    inlines.filter = "drop-shadow(0 0 6px rgba(234, 179, 8, 0.4))";
    inlines.animation = "flow 1.5s linear infinite";
    
    const isError = jsNodeErrors[targetData.path];
    const isSuccess = jsNodeResponses[targetData.path] !== undefined;
    
    if (isError) {
      stroke = "#ef4444";
      inlines.filter = "drop-shadow(0 0 6px rgba(239, 68, 68, 0.6))";
      inlines.animation = "none";
    } else if (isSuccess) {
      stroke = "#22c55e";
      inlines.filter = "drop-shadow(0 0 6px rgba(34, 197, 94, 0.6))";
      inlines.animation = "flow 3s linear infinite"; // slower pulse
    }
  }

  // Palette themes tint the neutral edge styles to match the nodes
  const paletteEdge =
    PALETTE_EDGE_COLORS[nodeTheme as keyof typeof PALETTE_EDGE_COLORS] ?? STYLED_THEME_EDGE_COLORS[nodeTheme];
  if (paletteEdge && ['curved', 'straight', 'step', 'dashed', 'pipe', 'arrow', 'dotted', 'fade', 'arc', 'ribbon'].includes(style)) {
    stroke = paletteEdge[appTheme === 'dark' ? 0 : 1];
  }

  // Theme-specific overrides if style is default or specifically requested
  if (nodeTheme === 'hacker') {
    // A thin dashed data stream drifting toward the child
    stroke = appTheme === 'dark' ? 'rgba(0, 255, 65, 0.55)' : 'rgba(10, 143, 60, 0.6)';
    strokeWidth = 1.2;
    strokeDasharray = "2,4";
    inlines.animation = "flow 6s linear infinite";
    inlines.filter = "none";
  } else if (nodeTheme === 'terminal') {
    stroke = appTheme === 'dark' ? 'rgba(63, 185, 80, 0.65)' : 'rgba(26, 127, 55, 0.55)';
    strokeWidth = 1.5;
    inlines.filter = "none";
  } else if (nodeTheme === 'nature') {
    stroke = appTheme === 'dark' ? '#5e8a55' : '#9dbd8f';
    strokeWidth = 2;
    inlines.strokeLinecap = 'round';
    inlines.filter = "none";
  } else if (style === 'seed' || nodeTheme === 'seed') {
    // Two close greens, so neighbouring stems read as separate without looking busy
    const vineColors = appTheme === 'dark' ? ['#7cab5c', '#6c9b4f'] : ['#8db174', '#7aa45f'];
    const idx = target ? Math.abs(Math.floor(target.x) + Math.floor(target.y)) % 2 : 0;
    stroke = vineColors[idx];
    strokeWidth = 2;
    inlines.strokeLinecap = 'round';
    inlines.filter = "none";
  } else if (style === 'chalk' || nodeTheme === 'chalk') {
    stroke = appTheme === 'dark' ? "#cbd5e1" : "#334155";
    strokeWidth = 2;
    strokeDasharray = "5,4";
    inlines.strokeLinecap = 'round';
    inlines.filter = "none";
  }

  strokeWidth = strokeWidth * edgeWidth;

  if (isSelected) {
    stroke = "#a855f7"; // purple-500
    strokeWidth = strokeWidth + 1.5;
    inlines.filter = "drop-shadow(0 0 6px rgba(168,85,247,0.6))";
    inlines.zIndex = 10;
  }

  if (isHighlighted) {
    stroke = "#38bdf8"; // sky-400
    strokeWidth = strokeWidth + 1;
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

  const showFade = style === 'fade' && !!source && !!target && !isSelected && !isHovered && !isHighlighted;

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
      {showFade && (
        <defs>
          {/* Strong at the parent, fading toward the child */}
          {showFade && source && target && (
            <linearGradient
              id={`edge-fade-${uid}`}
              gradientUnits="userSpaceOnUse"
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
            >
              <stop offset="0%" stopColor={stroke} stopOpacity={1} />
              <stop offset="100%" stopColor={stroke} stopOpacity={0.12} />
            </linearGradient>
          )}
        </defs>
      )}
      {/* Ribbon: a soft translucent band under the line */}
      {style === 'ribbon' && (
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth * 6}
          strokeLinecap="round"
          style={{ transition: inlines.transition, opacity: Number(inlines.opacity ?? 1) * 0.16, pointerEvents: 'none' }}
        />
      )}
      {/* Visible path */}
      <path
        d={d}
        fill="none"
        stroke={showFade ? `url(#edge-fade-${uid})` : stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        style={{ ...inlines, pointerEvents: 'none' }}
      />
      {style === 'arrow' && source && target && (() => {
        // The curve passes through the midpoint; its direction there depends on how the layout bends it
        const dx = target.x - source.x;
        const dy = target.y - source.y;
        const mode = layoutMode ?? '';
        const [tx, ty] = ['force', 'molecule', 'radial'].includes(mode)
          ? [dx, dy]
          : mode === 'vertical' || mode === 'compact' || mode === 'grid'
            ? [2 * dx, dy]
            : [dx, 2 * dy];
        const angle = (Math.atan2(ty, tx) * 180) / Math.PI;
        const size = 4 + edgeWidth;
        return (
          <path
            d={`M ${-size} ${-size} L ${size * 0.9} 0 L ${-size} ${size} Z`}
            transform={`translate(${(source.x + target.x) / 2}, ${(source.y + target.y) / 2}) rotate(${angle})`}
            fill={stroke}
            style={{ transition: inlines.transition, opacity: inlines.opacity, pointerEvents: 'none' }}
          />
        );
      })()}
      {(style === 'seed' || nodeTheme === 'seed') && source && target && (() => {
        // A small leaf halfway along the stem (curved and step paths both pass through the midpoint),
        // on alternating sides, and a bud where the stem meets the node
        const mx = (source.x + target.x) / 2;
        const my = (source.y + target.y) / 2;
        const angle = (Math.atan2(target.y - source.y, target.x - source.x) * 180) / Math.PI;
        const side = Math.abs(Math.floor(target.x + target.y)) % 2 ? 1 : -1;
        return (
          <g style={{ pointerEvents: 'none', opacity: inlines.opacity }}>
            <g transform={`translate(${mx}, ${my}) rotate(${angle + side * 38})`}>
              <path d="M 0 0 Q 7 -7.5 17 0 Q 7 7.5 0 0 Z" fill={stroke} />
              <path d="M 1 0 L 14 0" stroke={appTheme === 'dark' ? '#17241b' : '#ffffff'} strokeWidth={0.6} opacity={0.5} />
            </g>
            <circle cx={target.x} cy={target.y} r={3.5} fill={stroke} />
          </g>
        );
      })()}
      {isJsNodeEdge && target && source && (
        <g transform={`translate(${layoutMode === 'vertical' ? target.x : target.x - 30}, ${layoutMode === 'vertical' ? target.y - 20 : target.y - 12})`} style={{ pointerEvents: 'none' }}>
           <text
             textAnchor="middle" 
             className={`text-[8px] font-bold uppercase tracking-widest ${jsNodeErrors[targetData.path] ? 'fill-red-500' : jsNodeResponses[targetData.path] !== undefined ? 'fill-green-500' : 'fill-yellow-500 animate-pulse'}`}
             style={{ filter: "drop-shadow(0px 1px 2px rgba(0,0,0,0.6))" }}
           >
             Data In
           </text>
        </g>
      )}
    </g>
  );
}

/** Edge colour for other themes that tint their lines: [dark, light] */
const STYLED_THEME_EDGE_COLORS: Record<string, [string, string]> = {
  glass: ["rgba(255, 255, 255, 0.32)", "rgba(15, 23, 42, 0.22)"],
  math: ["rgba(96, 165, 250, 0.6)", "rgba(37, 99, 235, 0.45)"],
  architect: ["rgba(125, 167, 214, 0.65)", "rgba(71, 85, 105, 0.55)"],
  minimal: ["#3a3a3a", "#d6d6d3"],
  gradient: ["rgba(139, 92, 246, 0.7)", "rgba(139, 92, 246, 0.5)"],
  ocean: ["rgba(34, 165, 196, 0.6)", "rgba(14, 116, 144, 0.45)"],
  tree: ["#7a5c3e", "#c2a27e"],
  zen: ["#4a4640", "#d8d2c6"],
  // Like the editor's indent guides
  vscode: ["#4b4b4b", "#c4c4c4"],
  notebook: ["rgba(107, 143, 199, 0.75)", "rgba(59, 91, 146, 0.65)"],
  rune: ["rgba(201, 162, 74, 0.55)", "rgba(150, 110, 40, 0.5)"],
};

export default React.memo(EdgeRenderer);
