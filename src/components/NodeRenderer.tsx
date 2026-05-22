import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { HierarchyPointNode } from 'd3';
import { TreeNode } from '../utils/transformer';
import { useStore, NodeTheme } from '../store/useStore';
import { ChevronRight, ChevronDown, Type, Hash, Braces, AlignLeft, ToggleLeft, HelpCircle, MoreVertical } from 'lucide-react';
import SmartMediaRenderer from './SmartMediaRenderer';

interface NodeProps {
  key?: React.Key;
  node: HierarchyPointNode<TreeNode>;
  layoutMode: string;
  isSelectedPath?: boolean;
  isSelected?: boolean;
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
}

const getMediaType = (val: string) => {
  if (!val || typeof val !== 'string') return null;
  val = val.trim();
  if (val.startsWith('data:image/') || val.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i) || val.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp|svg|bmp)/i)) return 'image';
  if (val.startsWith('data:audio/') || val.match(/\.(mp3|wav|ogg|aac)(\?.*)?$/i) || val.match(/^https?:\/\/.*\.(mp3|wav|ogg|aac)/i)) return 'audio';
  if (val.startsWith('data:video/') || val.match(/\.(mp4|webm|ogg)(\?.*)?$/i) || val.match(/^https?:\/\/.*\.(mp4|webm|ogg)/i)) return 'video';
  // Use inspector for youtube, vimoe, spotfiy, or any http url
  // Just treat any http/https link as potential smart media if we didn't natively catch it
  if (val.startsWith('http://') || val.startsWith('https://')) return 'smart';
  return null;
}

export default function NodeRenderer({ node, layoutMode, isSelectedPath, isSelected, onContextMenu }: NodeProps) {
  const { 
    nodeTheme, nodeShape, nodeSize, 
    nodeColor, nodeTextColor, nodeGradientColor1, nodeGradientColor2, 
    useNodeGradient, nodeGradientAngle, nodeGradientType,
    toggleNodeCollapse, collapsedNodes, searchQuery, searchMatches, searchAncestors, 
    setSelectedNodeId, showMediaPreview, setDragOverride 
  } = useStore();
  const foreignRef = useRef<SVGForeignObjectElement>(null);
  
  const nodeRef = useRef(node);
  nodeRef.current = node;

  useEffect(() => {
    if (!foreignRef.current) return;

    const drag = d3.drag<SVGForeignObjectElement, unknown>()
      .subject(() => ({ x: nodeRef.current.x, y: nodeRef.current.y }))
      .on('start', function (event) {
        event.sourceEvent?.stopPropagation();
        d3.select(this).raise();
      })
      .on('drag', function (event) {
        setDragOverride(nodeRef.current.data.id, { x: event.x, y: event.y });
      });

    d3.select(foreignRef.current).call(drag);
  }, [setDragOverride]);

  const [smartMediaFailed, setSmartMediaFailed] = React.useState(false);

  const data = node.data;
  const isCollapsed = collapsedNodes.has(data.id);
  const hasChildren = !!data.children && data.children.length > 0;

  const hasQuery = !!searchQuery;
  const isMatch = searchMatches.has(data.id);
  const isAncestor = searchAncestors.has(data.id);
  const isDimmed = (hasQuery && !isMatch && !isAncestor) || (!hasQuery && !isSelected && !isSelectedPath && useStore.getState().selectedNodeId != null);
  
  const strVal = data.value !== undefined ? String(data.value) : '';
  const mediaType = showMediaPreview && data.type === 'string' && !smartMediaFailed ? getMediaType(strVal) : null;
  const isMedia = !!mediaType;

  // reset smartMediaFailed if value changes
  React.useEffect(() => { setSmartMediaFailed(false); }, [strVal]);


  const getThemeClasses = (theme: NodeTheme) => {
    switch (theme) {
      case 'vscode':
        return 'bg-[#1e1e1e] border-[#3c3c3c] text-[#d4d4d4] shadow-md';
      case 'github':
        return 'bg-[#0d1117] border-[#30363d] text-[#c9d1d9] shadow-sm';
      case 'glassmorphism':
        return 'bg-white/10 border-white/20 text-white backdrop-blur-md shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]';
      case 'cyberpunk':
        return 'bg-[#000000] border-[#00ff2a] text-[#00ff2a] shadow-[0_0_10px_#00ff2a]';
      case 'minimal':
        return 'bg-white border-transparent text-slate-800 shadow-sm';
      case 'gradient':
        return 'bg-gradient-to-br from-indigo-500 to-purple-600 border-transparent text-white shadow-lg';
      case 'pastel':
        return 'bg-[#fdfcdc] border-[#f0ead2] text-[#6d6875] shadow-sm';
      case 'terminal':
        return 'bg-black border-[#33ff00] text-[#33ff00] shadow-none font-mono';
      case 'material':
        return 'bg-[#212121] border-transparent text-white shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]';
      case 'blueprint':
        return 'bg-[#003366] border-[#4fa8fb] text-[#4fa8fb] shadow-none';
      case 'retro':
        return 'bg-[#ff9900] border-[#8a2be2] text-[#8a2be2] shadow-[4px_4px_0_#8a2be2]';
      case 'nature':
        return 'bg-[#3d5a80]/20 border-[#98c1d9] text-[#e0fbfc] backdrop-blur-sm shadow-inner rounded-2xl';
      case 'circuit':
        return 'bg-[#0b0e14] border-[#00f3ff] text-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.3)] font-mono border-2';
      case 'galaxy':
        return 'bg-gradient-to-br from-[#0b0014] to-[#1a0033] border-purple-500/50 text-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.4)]';
      case 'glass':
        return 'bg-white/5 border-white/30 text-white backdrop-blur-xl shadow-2xl ring-1 ring-white/10';
      case 'neon':
        return 'bg-black border-[#ff00ff] text-[#ff00ff] shadow-[0_0_20px_#ff00ff] font-bold tracking-wider';
      case 'math':
        return 'bg-[#f8f9fa] border-slate-300 text-slate-800 shadow-none font-mono border-dashed';
      case 'neural':
        return 'bg-[#0a192f] border-blue-400/50 text-blue-200 shadow-[0_0_15px_rgba(96,165,250,0.2)] rounded-full animate-pulse-subtle';
      case 'river':
        return 'bg-gradient-to-r from-blue-600/80 to-cyan-500/80 border-transparent text-white shadow-lg rounded-3xl';
      case 'tree':
        return 'bg-[#2d3a3a] border-[#6b8e23] text-[#f5f5dc] border-b-4 border-r-2';
      case 'pixel':
        return 'bg-[#3a4466] border-[#1a1c2c] text-[#f4f4f4] shadow-[4px_4px_0_#1a1c2c] rounded-none';
      case 'hacker':
        return 'bg-black border-[#00ff41] text-[#00ff41] shadow-[0_0_5px_#00ff41] font-mono lowercase animate-scanline';
      case 'cloud':
        return 'bg-white border-sky-200 text-sky-900 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] rounded-xl';
      case 'dna':
        return 'bg-[#1a1a2e] border-fuchsia-500/60 text-fuchsia-200 shadow-[inset_0_0_10px_rgba(217,70,239,0.2)]';
      case 'lava':
        return 'bg-[#2a0800] border-[#ff4500] text-[#ff4500] shadow-[0_0_25px_#ff4500] border-t-2';
      case 'ocean':
        return 'bg-[#001219]/80 border-[#005f73] text-[#94d2bd] shadow-[0_0_20px_rgba(0,18,25,0.8)] backdrop-blur-lg';
      case 'rhythm':
        return 'bg-[#1a1a1a] border-[#ff0055] text-white shadow-[0_0_30px_rgba(255,0,85,0.4)] animate-pulse-subtle';
      case 'rune':
        return 'bg-[#1c1c1c] border-[#d4af37]/40 text-[#d4af37] shadow-inner font-serif italic';
      case 'zen':
        return 'bg-[#fafafa] border-transparent text-slate-400 shadow-none hover:text-slate-900 transition-all';
      case 'abstract':
        return 'bg-gradient-to-tr from-[#6366f1] via-[#d946ef] to-[#f43f5e] border-transparent text-white shadow-2xl';
      case 'architect':
        return 'bg-slate-50 border-slate-400 text-slate-800 shadow-none font-mono';
      case 'holographic':
        return 'bg-gradient-to-tr from-fuchsia-500/30 via-cyan-500/30 to-violet-500/30 border-cyan-400/50 text-cyan-100 backdrop-blur-xl shadow-[0_0_15px_rgba(34,211,238,0.5)]';
      case 'notebook':
        return 'bg-[#fff9e6] border-[#e0d6b8] text-[#4a4a4a] border-l-4 border-l-red-400 shadow-md font-serif';
      case 'custom':
        if (useNodeGradient) {
           return 'border-white/20 shadow-lg';
        }
        return 'border-white/20 shadow-md';
      default:
        return 'bg-[#1e293b] border-[#334155] text-slate-200 shadow-sm';
    }
  };

  const getIcon = (type: string) => {
    const iconStyle = isCustom ? { color: nodeTextColor } : {};
    const iconOpacity = isCustom ? 'opacity-80' : 'opacity-70';
    
    switch (type) {
      case 'object': return <Braces size={14} className={isCustom ? '' : 'opacity-70'} style={iconStyle} />;
      case 'array': return <AlignLeft size={14} className={isCustom ? '' : 'opacity-70'} style={iconStyle} />;
      case 'string': return <Type size={14} className={isCustom ? '' : 'text-green-400 opacity-80'} style={iconStyle} />;
      case 'number': return <Hash size={14} className={isCustom ? '' : 'text-orange-400 opacity-80'} style={iconStyle} />;
      case 'boolean': return <ToggleLeft size={14} className={isCustom ? '' : 'text-blue-400 opacity-80'} style={iconStyle} />;
      default: return <HelpCircle size={14} className={isCustom ? '' : 'opacity-50'} style={iconStyle} />;
    }
  }

  const baseClasses = getThemeClasses(nodeTheme);

  // Custom tweaks per theme
  const isDarkBase = ['vscode', 'github', 'cyberpunk', 'terminal', 'material', 'blueprint', 'glassmorphism', 'gradient', 'holographic', 'custom', 'nature', 'circuit', 'galaxy', 'glass', 'neon', 'neural', 'river', 'tree', 'pixel', 'hacker', 'dna', 'lava', 'ocean', 'rhythm', 'rune', 'abstract'].includes(nodeTheme);
  const isLightBase = ['minimal', 'pastel', 'math', 'cloud', 'zen', 'architect'].includes(nodeTheme);
  
  // Text color logic
  const isCustom = nodeTheme === 'custom';
  const mutedText = isCustom ? '' : isDarkBase ? 'text-white/50' : isLightBase ? 'text-slate-500' : nodeTheme === 'retro' ? 'text-[#8a2be2]/70' : 'text-black/50';
  const valText = isCustom ? '' : isDarkBase ? 'text-white/90' : isLightBase ? 'text-slate-900' : nodeTheme === 'retro' ? 'text-[#8a2be2]/90' : 'text-black/90';
  const labelText = isCustom ? '' : ''; // Label usually inherits or has own logic

  let highlightClasses = '';
  if (isMatch) {
    highlightClasses = 'ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.6)] brightness-110';
  } else if (isAncestor) {
    highlightClasses = 'ring-1 ring-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]';
  } else if (isSelected) {
    highlightClasses = 'ring-2 ring-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.6)] brightness-110';
  } else if (isSelectedPath) {
    highlightClasses = 'ring-1 ring-purple-400 shadow-[0_0_10px_rgba(168,85,247,0.4)]';
  }



  let fWidth = isMedia ? 320 : 260;
  let fHeight = isMedia ? 240 : 120; 

  const isDefaultShape = nodeShape === 'default';

  let shapeClasses = 'rounded-md px-3 py-1.5 min-w-[120px] max-w-[260px]';
  let shapeStyle: React.CSSProperties = {};

  // Apply Theme-Specific Shapes ONLY if shape is at 'default'
  if (isDefaultShape) {
    switch (nodeTheme) {
      case 'nature':
        shapeClasses = 'px-4 py-2 min-w-[140px]';
        shapeStyle.borderRadius = '24% 76% 30% 70% / 71% 20% 80% 29%';
        break;
      case 'circuit':
        shapeClasses = 'px-4 py-2 min-w-[140px]';
        shapeStyle.clipPath = 'polygon(0% 15%, 15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%)';
        break;
      case 'galaxy':
        shapeClasses = 'px-5 py-5 min-w-[150px] aspect-square justify-center text-center';
        shapeStyle.borderRadius = '50%';
        break;
      case 'glass':
        shapeClasses = 'px-4 py-2 min-w-[130px]';
        shapeStyle.borderRadius = '12px';
        shapeStyle.transform = 'skewX(-5deg)';
        break;
      case 'neon':
        shapeClasses = 'px-4 py-2 min-w-[130px] border-2';
        shapeStyle.borderRadius = '0px';
        break;
      case 'math':
        shapeClasses = 'px-5 py-1.5 min-w-[120px]';
        shapeStyle.borderRadius = '4px 20px 4px 20px';
        break;
      case 'neural':
        shapeClasses = 'px-6 py-6 min-w-[160px] aspect-square rounded-full flex-col';
        break;
      case 'river':
        shapeClasses = 'px-5 py-3 min-w-[140px]';
        shapeStyle.borderRadius = '40px 10px 40px 10px';
        break;
      case 'tree':
        shapeClasses = 'px-4 py-2 min-w-[130px]';
        shapeStyle.clipPath = 'polygon(5% 0%, 95% 0%, 100% 20%, 100% 80%, 95% 100%, 5% 100%, 0% 80%, 0% 20%)';
        break;
      case 'pixel':
        shapeClasses = 'px-4 py-2 min-w-[120px]';
        shapeStyle.boxShadow = 'calc(-1 * 4px) 0 0 #1a1c2c, 4px 0 0 #1a1c2c, 0 calc(-1 * 4px) 0 #1a1c2c, 0 4px 0 #1a1c2c';
        break;
      case 'hacker':
        shapeClasses = 'px-4 py-2 min-w-[130px] border-x-2 border-y-0';
        break;
      case 'cloud':
        shapeClasses = 'px-6 py-4 min-w-[150px]';
        shapeStyle.borderRadius = '50px 50px 10px 10px';
        break;
      case 'dna':
        shapeClasses = 'px-3 py-6 min-w-[100px] flex-col';
        shapeStyle.borderRadius = '100px';
        break;
      case 'lava':
        shapeClasses = 'px-5 py-3 min-w-[140px]';
        shapeStyle.clipPath = 'polygon(0% 20%, 20% 0%, 100% 10%, 90% 90%, 10% 100%)';
        break;
      case 'ocean':
        shapeClasses = 'px-4 py-4 min-w-[150px]';
        shapeStyle.borderRadius = '30% 70% 70% 30% / 30% 30% 70% 70%';
        break;
      case 'rhythm':
        shapeClasses = 'px-4 py-2 min-w-[130px] border-l-4';
        break;
      case 'rune':
        shapeClasses = 'px-6 py-3 min-w-[140px]';
        shapeStyle.clipPath = 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)';
        break;
      case 'zen':
        shapeClasses = 'px-8 py-2 min-w-[140px] border-b';
        shapeStyle.borderRadius = '0px';
        break;
      case 'abstract':
        shapeClasses = 'px-4 py-3 min-w-[150px]';
        shapeStyle.clipPath = 'polygon(10% 0%, 100% 20%, 90% 100%, 0% 80%)';
        break;
      case 'architect':
        shapeClasses = 'px-4 py-2 min-w-[140px] border-slate-400 border-2';
        shapeStyle.outline = '1px solid #94a3b8';
        shapeStyle.outlineOffset = '4px';
        break;
    }
  }
  
  if (nodeTheme === 'custom') {
    shapeStyle.color = nodeTextColor;
    if (useNodeGradient) {
      shapeStyle.background = nodeGradientType === 'linear'
        ? `linear-gradient(${nodeGradientAngle}deg, ${nodeGradientColor1}, ${nodeGradientColor2})`
        : `radial-gradient(circle at center, ${nodeGradientColor1}, ${nodeGradientColor2})`;
    } else {
      shapeStyle.backgroundColor = nodeColor;
    }
  }

  if (!isDefaultShape) {
    switch(nodeShape) {
      case 'circle':
        fWidth = isMedia ? 320 : 200;
        fHeight = isMedia ? 240 : 200;
        shapeClasses = 'rounded-full justify-center text-center p-6 min-w-[160px] max-w-[200px]';
        shapeStyle.aspectRatio = '1';
        break;
      case 'pill':
        shapeClasses = 'rounded-[2rem] px-8 py-3 min-w-[140px] max-w-[260px] text-center justify-center';
        break;
      case 'rectangle':
        shapeClasses = 'rounded-none px-4 py-2 min-w-[120px] max-w-[260px]';
        break;
      case 'hexagon':
        fWidth = isMedia ? 340 : 280;
        fHeight = isMedia ? 260 : 140;
        shapeClasses = 'px-10 py-6 justify-center min-w-[160px] max-w-[280px] text-center';
        shapeStyle.clipPath = 'polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)';
        break;
      case 'triangle':
        fWidth = isMedia ? 360 : 300;
        fHeight = isMedia ? 300 : 200;
        shapeClasses = 'px-12 pt-24 pb-8 justify-end items-center min-w-[220px] max-w-[300px] text-center flex-col';
        shapeStyle.clipPath = 'polygon(50% 0%, 100% 100%, 0% 100%)';
        break;
      case 'diamond':
        fWidth = isMedia ? 360 : 280;
        fHeight = isMedia ? 360 : 240;
        shapeClasses = 'px-16 py-16 justify-center text-center items-center min-w-[240px] max-w-[280px] flex-col';
        shapeStyle.clipPath = 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)';
        break;
      case 'parallelogram':
        fWidth = isMedia ? 340 : 280;
        shapeClasses = 'px-12 py-3 min-w-[160px] max-w-[280px] text-center justify-center';
        shapeStyle.clipPath = 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)';
        break;
    }
  }

  fWidth *= nodeSize;
  fHeight *= nodeSize;

  return (
    <foreignObject
      ref={foreignRef}
      x={node.x - fWidth / 2}
      y={node.y - fHeight / 2}
      width={fWidth}
      height={fHeight}
      className={`transition-all duration-500 ease-out origin-center ${isDimmed ? 'opacity-30 grayscale scale-95' : 'opacity-100'} ${(isMatch || isSelected) ? 'z-20' : (isAncestor || isSelectedPath) ? 'z-10' : 'z-0'}`}
      style={{ overflow: 'visible' }}
    >
      <div className={`flex flex-col items-center justify-center w-full h-full transition-transform duration-300 ${(isMatch || isSelected) ? 'scale-105' : ''}`}>
        <div
          className={`pointer-events-auto select-none relative flex ${isMedia ? 'flex-col' : 'items-center'} border cursor-pointer hover:brightness-125 transition-all duration-300 flex-shrink-0 ${baseClasses} ${highlightClasses} ${shapeClasses}`}
          style={{ ...shapeStyle, transform: `scale(${nodeSize})`, transformOrigin: 'center', touchAction: 'none' }}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedNodeId(data.id);
          }}
          onContextMenu={(e) => {
            if (onContextMenu) {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu(e, data);
            }
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (hasChildren) toggleNodeCollapse(data.id);
          }}
        >
          <div className={`flex w-full ${isMedia ? 'items-start mb-2' : 'items-center'}`}>
            <div className="flex-shrink-0 mr-2 flex items-center">
              {hasChildren && (
                <div
                  className={`mr-1 -ml-1 ${mutedText} hover:text-slate-200 transition-colors p-1 -m-1 rounded z-10`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleNodeCollapse(data.id);
                  }}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </div>
              )}
              {getIcon(data.type)}
            </div>

            <div className="flex flex-col overflow-hidden w-full leading-tight py-0.5" style={isCustom ? { color: nodeTextColor } : {}}>
              <div className="flex items-baseline space-x-1.5">
                <span className={`pointer-events-none font-mono text-xs font-semibold truncate ${nodeTheme === 'cyberpunk' ? 'drop-shadow-md' : ''}`} title={data.name}>
                  {data.name}
                </span>
                {data.type !== 'object' && data.type !== 'array' && (
                  <span className={`pointer-events-none text-[10px] uppercase font-bold px-1 rounded-sm bg-black/10 tracking-widest ${mutedText}`} style={isCustom ? { color: nodeTextColor, opacity: 0.7 } : {}}>
                    {data.type}
                  </span>
                )}
              </div>
              {data.value !== undefined && !isMedia && (
                <span className={`pointer-events-none text-[11px] font-mono truncate mt-0.5 ${valText}`} title={String(data.value)} style={isCustom ? { color: nodeTextColor, opacity: 0.9 } : {}}>
                  {String(data.value)}
                </span>
              )}
              {hasChildren && isCollapsed && (
                <span className={`pointer-events-none text-[10px] mt-0.5 italic ${mutedText}`} style={isCustom ? { color: nodeTextColor, opacity: 0.6 } : {}}>
                  {data.children!.length} item{data.children!.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <div 
              className="ml-1 flex-shrink-0 flex items-center justify-center p-1 md:hidden rounded-full hover:bg-black/10 touch-manipulation z-10"
              onClick={(e) => {
                e.stopPropagation();
                if (onContextMenu) onContextMenu(e, data);
              }}
            >
              <MoreVertical size={14} className={mutedText} />
            </div>
          </div>

          {isMedia && (
            <div className={`w-full rounded bg-black/20 overflow-hidden border border-white/5 ${mediaType === 'smart' ? 'flex flex-1 items-stretch' : 'p-1 flex justify-center items-center'}`}>
              {mediaType === 'image' && <img src={strVal} alt={data.name} className="max-w-full max-h-[160px] object-contain rounded" />}
              {mediaType === 'audio' && <audio src={strVal} controls className="w-full h-8 outline-none" />}
              {mediaType === 'video' && <video src={strVal} controls className="max-w-full max-h-[160px] rounded focus:outline-none" />}
              {mediaType === 'smart' && <SmartMediaRenderer key={strVal} url={strVal} onMediaFailed={() => setSmartMediaFailed(true)} />}
            </div>
          )}
        </div>
      </div>
    </foreignObject>
  );
}
