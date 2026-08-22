import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  ReactFlow, 
  Background, 
  MiniMap,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  NodeProps,
  Node,
  Edge,
  useReactFlow,
  BaseEdge,
  EdgeProps,
  useViewport,
  ReactFlowProvider
} from '@xyflow/react';
import { useDrawingSystem } from '../hooks/useDrawingSystem';
import { useAnnotationStore } from '../store/useAnnotationStore';
import AnnotationRenderer from './AnnotationRenderer';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import * as d3 from 'd3';
import { useStore } from '../store/useStore';
import { extractSchema, SchemaNodeData, SchemaField } from '../utils/schemaEngine';
import { ChevronRight, ChevronDown, Eye, EyeOff, Focus } from 'lucide-react';
import { getEdgePath } from '../utils/layout';
import NodeQueryEngine from './NodeQueryEngine';

const getLayoutedElements = (nodes: Node[], edges: Edge[], layoutMode: string) => {
  const nodeMap = new Map<string, Node>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const childrenMap = new Map<string, string[]>();
  const isTarget = new Set<string>();
  edges.forEach(e => {
    const arr = childrenMap.get(e.source) || [];
    arr.push(e.target);
    childrenMap.set(e.source, arr);
    isTarget.add(e.target);
  });

  const rootIds = nodes.filter(n => !isTarget.has(n.id)).map(n => n.id);
  const rootId = nodeMap.has('root-node') ? 'root-node' : (rootIds.length > 0 ? rootIds[0] : nodes[0]?.id);

  // 1. DIRECTED LAYOUTS (vertical, horizontal, compact)
  if (['vertical', 'horizontal', 'compact'].includes(layoutMode)) {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    let direction = layoutMode === 'vertical' ? 'TB' : 'LR';
    let ranksep = 100;
    let nodesep = 45;

    if (layoutMode === 'compact') {
      direction = 'TB';
      ranksep = 45;
      nodesep = 20;
    }

    dagreGraph.setGraph({ rankdir: direction, align: 'UL', ranksep, nodesep });

    nodes.forEach((node) => {
      if (node.hidden) return;
      const data = node.data as SchemaNodeData;
      const schemaExportActive = useStore.getState().schemaExportActive;
      const getFieldsHeightCount = (fieldsList: any[]): number => {
        let count = 0;
        fieldsList.forEach(f => {
          count++;
          if (schemaExportActive && f.fields && f.fields.length > 0) {
            count += getFieldsHeightCount(f.fields);
          }
        });
        return count;
      };
      const fieldCount = Math.max(1, getFieldsHeightCount(data.fields || []));
      const height = 65 + fieldCount * 30;
      dagreGraph.setNode(node.id, { width: 340, height });
    });

    edges.forEach((edge) => {
      if (edge.hidden) return;
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const layoutedNodes = nodes.map((node) => {
      if (node.hidden) return node;
      const nodeWithPosition = dagreGraph.node(node.id);
      if (!nodeWithPosition) return node;
      return {
        ...node,
        targetPosition: direction === 'TB' ? Position.Top : Position.Left,
        sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
        position: {
          x: nodeWithPosition.x - 170,
          y: nodeWithPosition.y - nodeWithPosition.height / 2,
        },
      };
    });

    return { nodes: layoutedNodes, edges };
  }

  // 2. CONCENTRIC RADIAL LAYOUT
  if (layoutMode === 'radial') {
    if (rootIds.length > 0) {
      const levels: string[][] = [];
      const visited = new Set<string>();
      
      let startNodes;
      if (rootIds.length > 1) {
         startNodes = rootIds.map(id => ({ id, depth: 1 }));
         levels[0] = ['VIRTUAL_ROOT']; // Add padding for depth 0 to push items into a circle
      } else {
         startNodes = [{ id: rootIds[0], depth: 0 }];
      }

      const q: { id: string, depth: number }[] = [...startNodes];
      startNodes.forEach(sn => visited.add(sn.id));

      while (q.length > 0) {
        const { id, depth } = q.shift()!;
        if (!levels[depth]) levels[depth] = [];
        levels[depth].push(id);

        const children = childrenMap.get(id) || [];
        children.forEach(cid => {
          if (!visited.has(cid)) {
            visited.add(cid);
            q.push({ id: cid, depth: depth + 1 });
          }
        });
      }

      levels.forEach((nodeIds, depth) => {
        const radius = depth * 460;
        const count = nodeIds.length;
        nodeIds.forEach((id, idx) => {
          if (id === 'VIRTUAL_ROOT') return;
          const angle = (idx / count) * 2 * Math.PI - Math.PI / 2;
          const n = nodeMap.get(id);
          if (n) {
            n.position = {
              x: radius * Math.cos(angle) - 170,
              y: radius * Math.sin(angle)
            };
            n.targetPosition = Position.Left;
            n.sourcePosition = Position.Right;
          }
        });
      });
    }
  }

  // 3. FORCE DIRECTED PHYSICS LAYOUT
  else if (layoutMode === 'force') {
    if (nodes.length > 0) {
      const forceNodes = nodes.map((n, i) => ({ 
        id: n.id, 
        x: Math.cos(i) * 50, 
        y: Math.sin(i) * 50, 
        node: n 
      }));
      const forceLinks = edges.map(e => ({ source: e.source, target: e.target }));
      
      const simulation = d3.forceSimulation(forceNodes)
        .force("link", d3.forceLink(forceLinks).id((d: any) => d.id).distance(480))
        .force("charge", d3.forceManyBody().strength(-1400))
        .force("center", d3.forceCenter(0, 0))
        .force("collide", d3.forceCollide().radius(240));

      for (let i = 0; i < 150; i++) simulation.tick();

      forceNodes.forEach(fNode => {
        fNode.node.position = { x: fNode.x - 170, y: fNode.y };
        fNode.node.targetPosition = Position.Left;
        fNode.node.sourcePosition = Position.Right;
      });
    }
  }

  // 4. BI-DIRECTIONAL MINDMAP LAYOUT
  else if (layoutMode === 'mindmap') {
    if (rootIds.length > 0) {
      const isMultiRoot = rootIds.length > 1;

      if (!isMultiRoot && rootId) {
        const rootNode = nodeMap.get(rootId);
        if (rootNode) {
          rootNode.position = { x: 0, y: 0 };
          rootNode.targetPosition = Position.Left;
          rootNode.sourcePosition = Position.Right;
        }
      }

      const firstLevelChildren = isMultiRoot ? rootIds : (childrenMap.get(rootId) || []);
      const leftChildren = firstLevelChildren.filter((_, i) => i % 2 === 0);
      const rightChildren = firstLevelChildren.filter((_, i) => i % 2 === 1);

      leftChildren.forEach((childId, idx) => {
        const n = nodeMap.get(childId);
        if (n) {
          const yPos = (idx - (leftChildren.length - 1) / 2) * 360;
          n.position = { x: isMultiRoot && rightChildren.length === 0 ? 0 : -480, y: yPos };
          n.targetPosition = isMultiRoot && rightChildren.length === 0 ? Position.Left : Position.Right;
          n.sourcePosition = isMultiRoot && rightChildren.length === 0 ? Position.Right : Position.Left;

          const cascadeLeft = (parentId: string, currentX: number, parentY: number) => {
            const children = childrenMap.get(parentId) || [];
            children.forEach((cid, cidx) => {
              const childNode = nodeMap.get(cid);
              if (childNode) {
                const childY = parentY + (cidx - (children.length - 1) / 2) * 320;
                childNode.position = { x: currentX - 480, y: childY };
                childNode.targetPosition = Position.Right;
                childNode.sourcePosition = Position.Left;
                cascadeLeft(cid, currentX - 480, childY);
              }
            });
          };
          cascadeLeft(childId, isMultiRoot && rightChildren.length === 0 ? 0 : -480, yPos);
        }
      });

      rightChildren.forEach((childId, idx) => {
        const n = nodeMap.get(childId);
        if (n) {
          const yPos = (idx - (rightChildren.length - 1) / 2) * 360;
          n.position = { x: isMultiRoot && leftChildren.length === 0 ? 0 : 480, y: yPos };
          n.targetPosition = Position.Left;
          n.sourcePosition = Position.Right;

          const cascadeRight = (parentId: string, currentX: number, parentY: number) => {
            const children = childrenMap.get(parentId) || [];
            children.forEach((cid, cidx) => {
              const childNode = nodeMap.get(cid);
              if (childNode) {
                const childY = parentY + (cidx - (children.length - 1) / 2) * 320;
                childNode.position = { x: currentX + 480, y: childY };
                childNode.targetPosition = Position.Left;
                childNode.sourcePosition = Position.Right;
                cascadeRight(cid, currentX + 480, childY);
              }
            });
          };
          cascadeRight(childId, isMultiRoot && leftChildren.length === 0 ? 0 : 480, yPos);
        }
      });
    }
  }

  // 5. GRID / MATRIX LAYOUT
  else if (layoutMode === 'grid') {
    const cols = Math.ceil(Math.sqrt(nodes.length));
    nodes.forEach((n, idx) => {
      const r = Math.floor(idx / cols);
      const c = idx % cols;
      n.position = {
        x: c * 520 - (cols * 520) / 2,
        y: r * 420 - (cols * 420) / 2
      };
      n.targetPosition = Position.Left;
      n.sourcePosition = Position.Right;
    });
  }

  // 6. ORGANIC SPIRAL LAYOUT
  else if (layoutMode === 'organic') {
    nodes.forEach((n, idx) => {
      const theta = idx * 0.75;
      const radius = 240 + idx * 140;
      n.position = {
        x: radius * Math.cos(theta) - 170,
        y: radius * Math.sin(theta)
      };
      n.targetPosition = Position.Left;
      n.sourcePosition = Position.Right;
    });
  }

  return { nodes, edges };
};

// HIGH-FIDELITY CUSTOM REACT FLOW EDGE COMPONENT
const CustomSchemaEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  type,
}: EdgeProps) => {
  const edgeStyle = useStore((s) => s.edgeStyle);
  const layoutMode = useStore((s) => s.layoutMode);
  const appTheme = useStore((s) => s.appTheme);
  const nodeTheme = useStore((s) => s.nodeTheme);
  const edgeWidth = useStore((s) => s.edgeWidth ?? 1.0);
  
  const styleKey = type || edgeStyle;

  if (
    sourceX === undefined ||
    sourceX === null ||
    isNaN(sourceX) ||
    sourceY === undefined ||
    sourceY === null ||
    isNaN(sourceY) ||
    targetX === undefined ||
    targetX === null ||
    isNaN(targetX) ||
    targetY === undefined ||
    targetY === null ||
    isNaN(targetY)
  ) {
    return null;
  }

  const path = getEdgePath(
    { x: sourceX, y: sourceY },
    { x: targetX, y: targetY },
    styleKey,
    layoutMode
  );

  let stroke = appTheme === 'dark' ? "#475569" : "#94a3b8";
  let strokeWidth = 1.8;
  let strokeDasharray: string | undefined = undefined;
  let filter: string | undefined = undefined;
  let animation: string | undefined = undefined;

  if (styleKey === 'dashed') {
    strokeDasharray = "5,5";
  } else if (styleKey === 'neon') {
    stroke = "#0ea5e9";
    filter = "drop-shadow(0 0 5px rgba(14,165,233,0.85))";
  } else if (styleKey === 'glow') {
    stroke = "#f59e0b";
    strokeWidth = 2.6;
    filter = "drop-shadow(0 0 6px rgba(245,158,11,0.9)) drop-shadow(0 0 10px rgba(245,158,11,0.5))";
  } else if (styleKey === 'pulse') {
    stroke = "#10b981";
    strokeDasharray = "5,5";
    strokeWidth = 2.2;
    filter = "drop-shadow(0 0 4px #10b981)";
    animation = "flow 1.5s linear infinite, pulse 1.5s ease-in-out infinite";
  } else if (styleKey === 'circuit') {
    stroke = "#06b6d4";
    strokeWidth = 1.6;
    filter = "drop-shadow(1px 1px 0 rgba(0,0,0,0.5))";
    strokeDasharray = "35,10,5,10";
  } else if (styleKey === 'zigzag' || styleKey === 'metro' || styleKey === 'angled-step') {
    stroke = "#ec4899";
    strokeWidth = 2.2;
    filter = "drop-shadow(0 0 3px rgba(236,72,153,0.5))";
  } else if (styleKey === 'double') {
    strokeWidth = 4.5;
    strokeDasharray = "3,3";
  } else if (styleKey === 'thin') {
    strokeWidth = 0.65;
  } else if (styleKey === 'animated') {
    strokeDasharray = "8,8";
    animation = "flow 15s linear infinite"; 
  } else if (styleKey === 'hydrogen') {
    stroke = '#93c5fd';
    strokeWidth = 1.8;
    strokeDasharray = "3,8";
    animation = "flow 3s linear infinite";
    filter = "drop-shadow(0 0 4px rgba(147,197,253,0.6))";
  } else if (styleKey === 'seed') {
    stroke = "#84cc16";
    strokeWidth = 2.4;
    filter = "drop-shadow(0 2px 3px rgba(132,204,22,0.25))";
  } else if (styleKey === 'octopus') {
    stroke = '#6366f1';
    strokeWidth = 5.5;
    filter = "drop-shadow(0 0 6px rgba(99,102,241,0.6))";
  } else if (styleKey === 'chalk' || nodeTheme === 'chalk') {
    stroke = appTheme === 'dark' ? "#cbd5e1" : "#334155";
    strokeWidth = 2;
    strokeDasharray = "5,4";
    filter = "none";
  }

  strokeWidth = strokeWidth * edgeWidth;

  const mergedStyle = {
    ...style,
    stroke,
    strokeWidth,
    strokeDasharray,
    filter,
    animation,
    transition: 'stroke 0.3s, stroke-width 0.3s, filter 0.3s'
  };

  return (
    <g className="react-flow__edge-container pointer-events-none">
      <BaseEdge 
        id={id} 
        path={path} 
        style={mergedStyle} 
        markerEnd={markerEnd} 
      />
    </g>
  );
};


const typeColors: Record<string, string> = {
  string: 'text-amber-700 dark:text-amber-200/70',
  number: 'text-sky-700 dark:text-sky-300/70',
  boolean: 'text-rose-700 dark:text-rose-300/70',
  null: 'text-slate-500 dark:text-slate-500/70',
  object: 'text-violet-700 dark:text-violet-300/70',
  array: 'text-teal-700 dark:text-teal-300/70',
  any: 'text-slate-500 dark:text-slate-500/70'
};

const isPathMatch = (schemaPath: string | undefined, searchMatches: Set<string>): boolean => {
  if (!schemaPath || searchMatches.size === 0) return false;
  
  const normalize = (p: string) => p.replace(/\[\d*\]/g, '[]');
  const normSchema = normalize(schemaPath);
  
  for (const match of searchMatches) {
    const normMatch = normalize(match);
    if (normMatch === normSchema) {
      return true;
    }
  }
  return false;
};

const isActivePathMatch = (schemaPath: string | undefined, activeMatchId: string | null): boolean => {
  if (!schemaPath || !activeMatchId) return false;
  const normalize = (p: string) => p.replace(/\[\d*\]/g, '[]');
  return normalize(schemaPath) === normalize(activeMatchId);
};

const isFieldMatchingQuery = (field: SchemaField, searchMatches: Set<string>, searchQuery: string): boolean => {
  if (!searchQuery) return false;
  
  if (isPathMatch(field.jsonPath, searchMatches)) return true;
  
  const lowerQuery = searchQuery.toLowerCase();
  if (field.name.toLowerCase().includes(lowerQuery) || field.type.toLowerCase().includes(lowerQuery)) return true;
  
  return false;
};

const hasMatchingChildField = (fields: SchemaField[], searchMatches: Set<string>, searchQuery: string): boolean => {
  for (const f of fields) {
    if (isFieldMatchingQuery(f, searchMatches, searchQuery)) return true;
    if (f.fields && hasMatchingChildField(f.fields, searchMatches, searchQuery)) return true;
  }
  return false;
};

const isNodeMatchingQuery = (nodeData: SchemaNodeData, searchMatches: Set<string>, searchQuery: string): boolean => {
  if (!searchQuery) return false;
  
  if (isPathMatch(nodeData.jsonPath, searchMatches)) return true;
  
  const checkFields = (fields: SchemaField[]): boolean => {
    for (const f of fields) {
      if (isPathMatch(f.jsonPath, searchMatches)) return true;
      if (f.fields && checkFields(f.fields)) return true;
    }
    return false;
  };
  
  if (checkFields(nodeData.fields || [])) return true;

  if (nodeData.label.toLowerCase().includes(searchQuery.toLowerCase())) return true;
  
  const hasTextMatch = (fields: SchemaField[]): boolean => {
    const lowerQuery = searchQuery.toLowerCase();
    for (const f of fields) {
      if (f.name.toLowerCase().includes(lowerQuery) || f.type.toLowerCase().includes(lowerQuery)) return true;
      if (f.fields && hasTextMatch(f.fields)) return true;
    }
    return false;
  };
  return hasTextMatch(nodeData.fields || []);
};

const doesNodeContainActiveMatch = (nodeData: SchemaNodeData, activeMatchId: string | null): boolean => {
  if (!activeMatchId) return false;
  if (isActivePathMatch(nodeData.jsonPath, activeMatchId)) return true;
  
  const checkFields = (fields: SchemaField[]): boolean => {
    for (const f of fields) {
      if (isActivePathMatch(f.jsonPath, activeMatchId)) return true;
      if (f.fields && checkFields(f.fields)) return true;
    }
    return false;
  };
  return checkFields(nodeData.fields || []);
};

const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query) return text;
  const parts = text.split(new RegExp(`(${query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, index) => 
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={index} className="bg-amber-200 dark:bg-amber-500/50 text-slate-950 dark:text-amber-100 font-semibold px-0.5 rounded-sm shadow-[0_0_8px_rgba(245,158,11,0.25)]">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
};

const FieldRow = ({ field, searchQuery, layoutMode = 'vertical' }: { field: SchemaField; searchQuery: string; layoutMode?: string }) => {
  const [expanded, setExpanded] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const { getEdges, getNodes, setNodes, setEdges, fitView } = useReactFlow();
  const schemaExportActive = useStore(state => state.schemaExportActive);
  const searchMatches = useStore(state => state.searchMatches);
  const activeMatchId = useStore(state => state.activeMatchId);
  
  const hasChildren = field.fields && field.fields.length > 0;

  useEffect(() => {
    const handleExpandAll = () => {
      if (hasChildren) setExpanded(true);
    };
    const handleCollapseAll = () => {
      if (hasChildren) setExpanded(false);
    };

    window.addEventListener('schema-expand-all', handleExpandAll);
    window.addEventListener('schema-collapse-all', handleCollapseAll);

    return () => {
      window.removeEventListener('schema-expand-all', handleExpandAll);
      window.removeEventListener('schema-collapse-all', handleCollapseAll);
    };
  }, [hasChildren]);

  const isExpanded = expanded || schemaExportActive || (searchQuery ? (hasChildren && hasMatchingChildField(field.fields || [], searchMatches, searchQuery)) : false);
  
  const toggleVisibility = (e: React.MouseEvent, targetNodeId: string) => {
    e.stopPropagation();
    
    const willHide = !isHidden;
    setIsHidden(willHide);
    
    const edges = getEdges();
    const descendantIds = new Set<string>();
    const stack = [targetNodeId];
    
    while(stack.length > 0) {
      const current = stack.pop()!;
      descendantIds.add(current);
      const outgoingEdges = edges.filter(e => e.source === current);
      for (const oe of outgoingEdges) {
        if (!descendantIds.has(oe.target)) {
          stack.push(oe.target);
        }
      }
    }
    
    const nodes = getNodes();
    const newNodes = nodes.map(n => descendantIds.has(n.id) ? { ...n, hidden: willHide } : n);
    const newEdges = edges.map(e => descendantIds.has(e.target) ? { ...e, hidden: willHide } : e);
    
    const layouted = getLayoutedElements(newNodes, newEdges, layoutMode);
    
    setNodes(layouted.nodes);
    setEdges(layouted.edges);
    
    setTimeout(() => {
      fitView({ duration: 800, padding: 0.2 });
    }, 50);
  };
  
  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) setExpanded(!expanded);
  };

  const isMatch = isFieldMatchingQuery(field, searchMatches, searchQuery);
  const isActiveMatch = isActivePathMatch(field.jsonPath, activeMatchId);

  const highlightClass = isActiveMatch
    ? 'bg-amber-100 dark:bg-amber-500/20 border-l-[3px] border-l-amber-500 border-y border-y-amber-500/20 pl-[13px] pr-4 shadow-[0_0_12px_rgba(245,158,11,0.2)] font-semibold'
    : isMatch
      ? 'bg-sky-50 dark:bg-sky-950/20 border-l-[3px] border-l-sky-500 border-y border-y-sky-500/10 pl-[13px] pr-4'
      : 'hover:bg-slate-50 dark:hover:bg-white/[0.02] pl-4 pr-4';

  let typeDisplay: string = field.type;
  if (field.isArray) {
    if (field.type === 'object') {
      typeDisplay = `${field.itemBaseType || 'Item'}[]`;
    } else {
      typeDisplay = `${field.itemBaseType || field.type}[]`;
    }
  } else if (field.type === 'object') {
    typeDisplay = '{}';
  }

  return (
    <div className="flex flex-col font-mono text-[13px] leading-relaxed">
      <div 
        className={`relative flex items-center py-[2px] px-4 group transition-all ${hasChildren ? 'cursor-pointer' : ''} ${highlightClass}`}
        onClick={toggle}
      >
        <div className="flex items-center justify-center w-5 h-5 mr-1.5 shrink-0 transition-transform">
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-slate-400/80" /> : <ChevronRight className="w-3.5 h-3.5 text-slate-400/80" />
          ) : <span className="w-3.5 h-3.5" />}
        </div>
        
        <span className="font-medium text-slate-700 dark:text-slate-300 z-10 bg-transparent shrink-0">
          {highlightText(field.name, searchQuery)}
        </span>
        
        <div className="flex-1 min-w-[2rem] border-b border-dotted border-slate-300/80 dark:border-slate-700/60 mx-3 opacity-20 group-hover:opacity-100 transition-opacity"></div>
        
        <span className={`z-10 bg-transparent flex items-center gap-1.5 shrink-0 w-28 pl-2 text-left whitespace-nowrap ${typeColors[field.type] || 'text-slate-400'}`}>
          {highlightText(typeDisplay, searchQuery)}
          {field.isRef && (
            <div className="flex items-center gap-1 group/ref ml-0.5">
              <span className={`text-[9px] font-sans ${isHidden ? 'text-slate-400/50 dark:text-slate-500/50 border-slate-300/10 bg-slate-100/50 dark:bg-slate-800/50' : 'text-indigo-600/60 dark:text-indigo-400/60 border-indigo-500/10 bg-indigo-50/50 dark:bg-indigo-500/10'} border px-1 rounded tracking-widest uppercase`}>Ref</span>
              <button 
                onClick={(e) => toggleVisibility(e, field.refNodeId!)}
                className={`${isHidden ? 'opacity-100 text-slate-400 hover:text-indigo-500' : 'opacity-0 group-hover/ref:opacity-100 text-slate-400 hover:text-rose-500'} transition-opacity p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800`}
                title={isHidden ? "Show Subtree" : "Hide Subtree"}
              >
                {isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          )}
        </span>
        {field.isRef && (
          <Handle 
            type="source" 
            position={['vertical', 'compact'].includes(layoutMode || '') ? Position.Bottom : Position.Right} 
            id={field.id} 
            className="w-2 h-2 opacity-0"
            isConnectable={false}
          />
        )}
      </div>

      {isExpanded && hasChildren && (
        <div className="flex flex-col mt-0.5 mb-1.5 ml-7 mr-2 bg-slate-50/60 dark:bg-slate-800/20 border border-slate-200/40 dark:border-slate-800/40 rounded-md overflow-hidden relative shadow-[inset_0_1px_3px_rgba(0,0,0,0.015)]">
          <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-slate-300/30 dark:bg-slate-700/30 group-hover:bg-indigo-500/30 transition-colors"></div>
          {field.isArray && field.type === 'object' && (
            <div className="text-[10px] italic font-medium tracking-wide text-slate-400/80 dark:text-slate-500/80 px-3 pt-1.5 pb-0.5 flex items-center gap-1.5">
              <div className="w-3 h-[1px] bg-slate-300 dark:bg-slate-700"></div>
              Structure
            </div>
          )}
          <div className="py-1">
            {field.fields!.map(child => (
              <FieldRow key={child.id} field={child} searchQuery={searchQuery} layoutMode={layoutMode} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export type CustomNode = Node<SchemaNodeData, 'schemaNode'>;

const CustomSchemaNode = ({ data, selected, id }: NodeProps<CustomNode>) => {
  const searchQuery = useStore((state) => state.searchQuery);
  const searchMatches = useStore(state => state.searchMatches);
  const activeMatchId = useStore(state => state.activeMatchId);
  const { fitView } = useReactFlow();
  
  const isVertical = ['vertical', 'compact'].includes(data.layoutMode);
  const targetPosition = isVertical ? Position.Top : Position.Left;
  const sourcePosition = isVertical ? Position.Bottom : Position.Right;
  
  const handleFocus = (e: React.MouseEvent) => {
    e.stopPropagation();
    fitView({ nodes: [{ id }], duration: 800, padding: 0.2 });
  };

  const isNodeMatch = useMemo(() => {
    return isNodeMatchingQuery(data, searchMatches, searchQuery);
  }, [data, searchMatches, searchQuery]);

  const isContainingActiveNode = useMemo(() => {
    return doesNodeContainActiveMatch(data, activeMatchId);
  }, [data, activeMatchId]);

  const borderClass = selected 
    ? 'border-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.15)] ring-1 ring-indigo-400/50' 
    : isContainingActiveNode
      ? 'border-amber-500 dark:border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.35)] ring-2 ring-amber-500/40 z-[110]'
      : isNodeMatch
        ? 'border-sky-500 dark:border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.2)] ring-1 ring-sky-500/30 z-[100]'
        : 'border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700';

  return (
    <div className={`bg-white dark:bg-[#0b0d13] border shadow-xl rounded-xl w-[340px] overflow-hidden font-sans transition-all duration-300 ${borderClass}`}>
      <Handle type="target" position={targetPosition} className="w-2 h-2 opacity-0" />
      
      <div className="bg-slate-50/60 dark:bg-slate-800/10 px-4 py-3 border-b border-slate-200/80 dark:border-slate-800/80 flex items-center justify-between group">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2.5">
            <div className={`w-2 h-2 rounded-full transition-all ${
              selected 
                ? 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]' 
                : isContainingActiveNode 
                  ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse' 
                  : isNodeMatch 
                    ? 'bg-sky-500 shadow-[0_0_8px_rgba(56,189,248,0.8)]' 
                    : 'bg-slate-300 dark:bg-slate-600'
            }`}></div>
            <span className="tracking-tight text-[15px] font-semibold text-slate-800 dark:text-slate-100">
              {highlightText(data.label === 'Root' ? 'Root Schema' : data.label, searchQuery)}
            </span>
          </div>
          <div className="text-[10px] text-slate-500 font-mono ml-[18px]">
             {data.fields.length} {data.fields.length === 1 ? 'field' : 'fields'}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleFocus}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md"
            title="Focus Area"
          >
            <Focus className="w-3.5 h-3.5" />
          </button>
          <div className="text-[9px] flex items-center gap-1 shadow-none uppercase tracking-widest font-semibold text-slate-400 dark:text-slate-500">
            <div className="w-[3px] h-[3px] rounded-sm bg-slate-300 dark:bg-slate-600"></div>
            Schema
          </div>
        </div>
      </div>
      
      <div className="flex flex-col py-2">
        {data.fields.length === 0 ? (
          <div className="text-sm text-slate-400 p-4 italic text-center">Empty structure</div>
        ) : (
          data.fields.map((field) => (
            <FieldRow key={field.id} field={field} searchQuery={searchQuery} layoutMode={data.layoutMode} />
          ))
        )}
      </div>

      <Handle type="source" position={sourcePosition} className="w-2 h-2 !bg-blue-500 border-none opacity-0" />
    </div>
  );
};

const nodeTypes = {
  schemaNode: CustomSchemaNode,
};

const edgeTypes = {
  curved: CustomSchemaEdge,
  bezier: CustomSchemaEdge,
  straight: CustomSchemaEdge,
  step: CustomSchemaEdge,
  animated: CustomSchemaEdge,
  dashed: CustomSchemaEdge,
  neon: CustomSchemaEdge,
  double: CustomSchemaEdge,
  pipe: CustomSchemaEdge,
  thin: CustomSchemaEdge,
  orgChart: CustomSchemaEdge,
  circuit: CustomSchemaEdge,
  glow: CustomSchemaEdge,
  zigzag: CustomSchemaEdge,
  pulse: CustomSchemaEdge,
  ludo: CustomSchemaEdge,
  chess: CustomSchemaEdge,
  octopus: CustomSchemaEdge,
  nature2: CustomSchemaEdge,
  hydrogen: CustomSchemaEdge,
  seed: CustomSchemaEdge,
  metro: CustomSchemaEdge,
  'angled-step': CustomSchemaEdge,
  chalk: CustomSchemaEdge,
};

function SchemaVisualizerInner() {
  const parsedData = useStore((s) => s.parsedData);
  const appTheme = useStore((s) => s.appTheme);
  const layoutMode = useStore((s) => s.layoutMode);
  const edgeStyle = useStore((s) => s.edgeStyle);
  const schemaExportActive = useStore((s) => s.schemaExportActive);
  const searchQuery = useStore((s) => s.searchQuery);
  const searchMatches = useStore((s) => s.searchMatches);
  const activeMatchId = useStore((s) => s.activeMatchId);
  const { setViewport, getViewport } = useReactFlow();



  useEffect(() => {
    const onVoiceZoom = (e: Event) => {
      if (useStore.getState().visualizerMode !== 'schema') return;
      
      const detail = (e as CustomEvent).detail;
      const currentViewport = getViewport();
      
      let newZoom = currentViewport.zoom;
      if (detail.op === 'in') {
         newZoom *= (detail.factor || 1.5);
      } else {
         newZoom /= (detail.factor || 1.5);
      }
      
      let dx = 0; let dy = 0;
      const panAmount = 300;
      if (detail.direction) {
        if (detail.direction.includes('left')) dx = panAmount;
        if (detail.direction.includes('right')) dx = -panAmount;
        if (detail.direction.includes('top')) dy = panAmount;
        if (detail.direction.includes('bottom')) dy = -panAmount;
      }
      
      setViewport({ 
         x: currentViewport.x + dx, 
         y: currentViewport.y + dy, 
         zoom: newZoom 
      }, { duration: 400 });
    };
    
    window.addEventListener('voice-zoom', onVoiceZoom);

    const onVoiceMove = (e: Event) => {
      if (useStore.getState().visualizerMode !== 'schema') return;
      
      const detail = (e as CustomEvent).detail;
      const currentViewport = getViewport();
      
      let dx = 0; let dy = 0;
      const panAmount = 300 * (detail.factor || 1);
      
      if (detail.direction.includes('left')) dx = panAmount;
      if (detail.direction.includes('right')) dx = -panAmount;
      if (detail.direction.includes('top')) dy = panAmount;
      if (detail.direction.includes('bottom')) dy = -panAmount;
      
      setViewport({ 
         x: currentViewport.x + dx, 
         y: currentViewport.y + dy, 
         zoom: currentViewport.zoom 
      }, { duration: 400 });
    };

    window.addEventListener('voice-move', onVoiceMove);
    
    return () => {
        window.removeEventListener('voice-zoom', onVoiceZoom);
        window.removeEventListener('voice-move', onVoiceMove);
    };
  }, [getViewport, setViewport]);

  const [hasSelection, setHasSelection] = useState(false);
  const { fitView } = useReactFlow();

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!parsedData) return { nodes: [], edges: [] };
    const { nodes: rawNodes, edges: rawEdges } = extractSchema(parsedData, 'Root', layoutMode, edgeStyle);
    return getLayoutedElements(rawNodes, rawEdges, layoutMode);
  }, [parsedData, layoutMode, edgeStyle]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const lastSearchQueryRef = useRef<string>("");
  const lastActiveIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (searchQuery === lastSearchQueryRef.current) return;
    lastSearchQueryRef.current = searchQuery;
    
    if (!searchQuery) return;
    
    const matchedNodes = nodes.filter(node => {
      const data = node.data as SchemaNodeData;
      return isNodeMatchingQuery(data, searchMatches, searchQuery);
    });
    
    if (matchedNodes.length > 0) {
      setTimeout(() => {
        fitView({
          nodes: matchedNodes,
          duration: 800,
          padding: 0.25
        });
      }, 50);
    }
  }, [searchQuery, searchMatches, nodes, fitView]);

  useEffect(() => {
    if (!activeMatchId || activeMatchId === lastActiveIdRef.current) return;
    lastActiveIdRef.current = activeMatchId;

    const matchedNode = nodes.find(node => {
      const data = node.data as SchemaNodeData;
      return doesNodeContainActiveMatch(data, activeMatchId);
    });

    if (matchedNode) {
      setTimeout(() => {
        fitView({
          nodes: [matchedNode],
          duration: 800,
          padding: 0.4
        });
      }, 50);
    }
  }, [activeMatchId, nodes, fitView]);

  useEffect(() => {
    const fitBtn = document.getElementById("fit-graph-btn");
    const onFit = () => {
      fitView({ duration: 800, padding: 0.15 });
    };
    if (fitBtn) fitBtn.addEventListener("click", onFit);
    return () => {
      if (fitBtn) fitBtn.removeEventListener("click", onFit);
    };
  }, [nodes, fitView]);

  const isToolbarVisible = useAnnotationStore((state) => state.isToolbarVisible);
  const activeTool = useAnnotationStore((state) => state.activeTool);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { x, y, zoom } = useViewport();
  const viewportRef = useRef({ x, y, zoom });
  viewportRef.current = { x, y, zoom };

  const [isCtrlPressed, setIsCtrlPressed] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Control") setIsCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Control") setIsCtrlPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    const handleBlur = () => setIsCtrlPressed(false);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const isDrawingActive =
    isToolbarVisible || (isCtrlPressed && activeTool !== "select");

  useDrawingSystem(wrapperRef, true, viewportRef);

  const getCursorClass = () => {
    if (!isDrawingActive) return "cursor-grab active:cursor-grabbing";

    switch (activeTool) {
      case "select":
        return "cursor-move";
      case "eraser":
        return "cursor-cell";
      default:
        return "cursor-crosshair";
    }
  };

  if (!parsedData) {
    return (
      <div className="flex items-center justify-center w-full h-full text-slate-400">
        No schema to visualize
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes flow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulse {
          0% { opacity: 0.45; }
          50% { opacity: 1; }
          100% { opacity: 0.45; }
        }
        .schema-viewer .react-flow__node {
          transition: transform 0.65s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease, filter 0.4s ease, box-shadow 0.3s ease;
        }
        .schema-viewer.has-selection .react-flow__node:not(.selected):not(.connected-node) {
          opacity: 0.25 !important;
          filter: grayscale(60%);
        }
        .schema-viewer.has-selection .react-flow__node.connected-node {
          opacity: 0.8 !important;
          filter: none;
        }
        .schema-viewer.has-selection .react-flow__edge {
          transition: opacity 0.3s ease, stroke-width 0.3s ease;
        }
        .schema-viewer .react-flow__edge-path {
          transition: opacity 0.3s ease;
        }
      `}</style>
      <div id="schema-export-wrapper" ref={wrapperRef} className={`w-full h-full bg-slate-50 dark:bg-[#07090e] schema-viewer ${hasSelection ? 'has-selection' : ''} ${getCursorClass()}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          panOnDrag={!isDrawingActive}
          nodesDraggable={!isDrawingActive}
          elementsSelectable={!isDrawingActive}
          panOnScroll={isDrawingActive}
          onSelectionChange={({ nodes: selectedNodes }) => {
            const hasSel = selectedNodes.length > 0;
            if (hasSelection !== hasSel) setHasSelection(hasSel);
            
            const selectedIds = new Set(selectedNodes.map(n => n.id));
            
            if (selectedIds.size === 0) {
               let eChanged = false;
               const newEdges = edges.map(e => {
                 if (e.style?.opacity !== 0.2 || e.style?.strokeWidth !== 1.5) {
                   eChanged = true;
                   return { ...e, style: { ...e.style, opacity: 0.2, strokeWidth: 1.5 } };
                 }
                 return e;
               });
               if (eChanged) setEdges(newEdges);
               
               let nChanged = false;
               const newNodes = nodes.map(n => {
                 if (n.className) {
                   nChanged = true;
                   return { ...n, className: '' };
                 }
                 return n;
               });
               if (nChanged) setNodes(newNodes);
               return;
             }
            
            // Find connected edges
            const connectedEdges = new Set<string>();
            const connectedNodes = new Set<string>();
            
            edges.forEach(e => {
              if (selectedIds.has(e.source) || selectedIds.has(e.target)) {
                connectedEdges.add(e.id);
                connectedNodes.add(e.source);
                connectedNodes.add(e.target);
              }
            });
            
            let evChanged = false;
            const updatedEdges = edges.map(e => {
                const isConn = connectedEdges.has(e.id);
                const tgtOpacity = isConn ? 0.8 : 0.05;
                const tgtWidth = isConn ? 2.5 : 1;
                
                if (e.style?.opacity !== tgtOpacity || e.style?.strokeWidth !== tgtWidth) {
                   evChanged = true;
                   return {
                      ...e,
                      style: {
                         ...e.style,
                         opacity: tgtOpacity,
                         strokeWidth: tgtWidth
                      }
                   };
                }
                return e;
            });
            if (evChanged) setEdges(updatedEdges);
            
            let nvChanged = false;
            const updatedNodes = nodes.map(n => {
                const cls = (connectedNodes.has(n.id) && !selectedIds.has(n.id)) ? 'connected-node' : '';
                if (n.className !== cls) {
                   nvChanged = true;
                   return { ...n, className: cls };
                }
                return n;
            });
            if (nvChanged) setNodes(updatedNodes);
          }}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          colorMode={appTheme}
          minZoom={0.1}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={24} size={1} color={appTheme === 'dark' ? 'rgba(148, 163, 184, 0.08)' : 'rgba(100, 116, 139, 0.08)'} />
          <MiniMap 
            nodeColor={(node) => {
               if (node.id === 'root-node' || node.id.startsWith('root-')) return appTheme === 'dark' ? '#6366f1' : '#4f46e5';
               return appTheme === 'dark' ? '#334155' : '#cbd5e1';
            }}
            nodeStrokeColor={appTheme === 'dark' ? '#1e293b' : '#f8fafc'}
            nodeBorderRadius={4}
            maskColor={appTheme === 'dark' ? 'rgba(7, 9, 14, 0.85)' : 'rgba(255, 255, 255, 0.85)'}
            maskStrokeColor={appTheme === 'dark' ? '#6366f1' : '#4f46e5'}
            maskStrokeWidth={2}
            className="shadow-2xl rounded-xl overflow-hidden border border-slate-200/80 dark:border-slate-800/80 m-6 !bg-white dark:!bg-[#0a0c10]" 
            style={{ width: 220, height: 140 }}
            pannable
            zoomable
          />
          
          {/* Custom drawing overlays transformed to align with the viewport */}
          <svg className="absolute inset-0 pointer-events-none z-[5] w-full h-full overflow-visible">
            <g id="schema-drawing-g" transform={`translate(${x}, ${y}) scale(${zoom})`} className="pointer-events-auto">
              <AnnotationRenderer />
            </g>
          </svg>
        </ReactFlow>
        <NodeQueryEngine />
      </div>
    </>
  );
}

export default function SchemaVisualizer() {
  return (
    <ReactFlowProvider>
      <SchemaVisualizerInner />
    </ReactFlowProvider>
  );
}
