import { formatFileSize } from "../lib/formatFileSize";
import {
  useEffect,
  useRef,
  useMemo,
  useState,
  useDeferredValue,
} from "react";
import { createPortal } from "react-dom";
import * as d3 from "d3";
import { useStore } from "../store/useStore";
import { useAnnotationStore } from "../store/useAnnotationStore";
import { computeLayout, getEdgePath } from "../utils/layout";
import { TreeNode } from "../utils/transformer";
import NodeRenderer from "./NodeRenderer";
import EdgeRenderer from "./EdgeRenderer";
import AnnotationRenderer from "./AnnotationRenderer";
import { useDrawingSystem } from "../hooks/useDrawingSystem";
import {
  X,
  TableProperties,
  Info,
  Maximize2,
  Minimize2,
} from "lucide-react";
import { InlineApiEditor } from "./InlineApiEditor";

import { TableView } from "./TableView";

import NodeQueryEngine from "./NodeQueryEngine";
import { NodeContextMenu } from "./NodeContextMenu";
import { NodeEditingModal } from "./NodeEditingModal";
import { BlankCanvasTemplateGallery } from "./BlankCanvasTemplateGallery";

/**
 * Canvas backdrops for themes that bring their own, as [dark, light]; other themes use the canvas
 * settings. Each image is CSS background layers; `size` lines up with them.
 */
const THEME_CANVAS: Record<string, { color: [string, string]; image: [string, string]; size?: string }> = {
  // Forest floor (soft light through the canopy) / parchment with a hint of green and soil
  seed: {
    color: ["#0f1913", "#f6f4ec"],
    image: [
      "radial-gradient(ellipse at 20% 0%, rgba(163, 201, 138, 0.10) 0%, transparent 55%), radial-gradient(ellipse at 85% 90%, rgba(96, 140, 80, 0.08) 0%, transparent 50%), radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.35) 100%)",
      "radial-gradient(ellipse at 15% 0%, rgba(143, 177, 116, 0.16) 0%, transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(214, 190, 150, 0.22) 0%, transparent 55%)",
    ],
  },
  nature: {
    color: ["#0d1410", "#f3f6f0"],
    image: [
      "radial-gradient(ellipse at 15% 0%, rgba(110, 160, 100, 0.10) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.3) 100%)",
      "radial-gradient(ellipse at 20% 0%, rgba(190, 215, 180, 0.35) 0%, transparent 55%), radial-gradient(ellipse at 85% 100%, rgba(175, 200, 160, 0.25) 0%, transparent 55%)",
    ],
  },
  // A faint dot grid, like a terminal's character cells
  terminal: {
    color: ["#090c10", "#fbfcfd"],
    image: [
      "radial-gradient(rgba(125, 133, 144, 0.16) 1px, transparent 1.2px)",
      "radial-gradient(rgba(89, 99, 110, 0.14) 1px, transparent 1.2px)",
    ],
    size: "18px 18px",
  },
  // Very faint scan lines and a soft vignette
  hacker: {
    color: ["#030805", "#f5faf6"],
    image: [
      "repeating-linear-gradient(0deg, rgba(0, 255, 65, 0.035) 0 1px, transparent 1px 4px), radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.45) 100%)",
      "repeating-linear-gradient(0deg, rgba(10, 143, 60, 0.04) 0 1px, transparent 1px 4px), radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(10, 60, 30, 0.06) 100%)",
    ],
  },
  // Soft colour glows for the frosted cards to blur
  glass: {
    color: ["#0a0c14", "#eef1f7"],
    image: [
      "radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.28) 0%, transparent 40%), radial-gradient(circle at 85% 25%, rgba(20, 184, 166, 0.20) 0%, transparent 40%), radial-gradient(circle at 60% 90%, rgba(236, 72, 153, 0.18) 0%, transparent 45%)",
      "radial-gradient(circle at 15% 20%, rgba(99, 102, 241, 0.22) 0%, transparent 40%), radial-gradient(circle at 85% 25%, rgba(20, 184, 166, 0.18) 0%, transparent 40%), radial-gradient(circle at 60% 90%, rgba(236, 72, 153, 0.16) 0%, transparent 45%)",
    ],
  },
  // Graph paper: fine squares with a heavier line every five
  math: {
    color: ["#0b1220", "#fcfdff"],
    image: [
      "linear-gradient(rgba(96, 165, 250, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(96, 165, 250, 0.06) 1px, transparent 1px), linear-gradient(rgba(96, 165, 250, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(96, 165, 250, 0.12) 1px, transparent 1px)",
      "linear-gradient(rgba(37, 99, 235, 0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(37, 99, 235, 0.06) 1px, transparent 1px), linear-gradient(rgba(37, 99, 235, 0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(37, 99, 235, 0.12) 1px, transparent 1px)",
    ],
    size: "24px 24px, 24px 24px, 120px 120px, 120px 120px",
  },
  // Plain, like a page
  minimal: {
    color: ["#111111", "#fbfbfa"],
    image: ["none", "none"],
  },
  // A faint violet and pink glow
  gradient: {
    color: ["#0b0b12", "#fafaff"],
    image: [
      "radial-gradient(circle at 20% 15%, rgba(99, 102, 241, 0.16) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(236, 72, 153, 0.10) 0%, transparent 45%)",
      "radial-gradient(circle at 20% 15%, rgba(99, 102, 241, 0.10) 0%, transparent 45%), radial-gradient(circle at 85% 85%, rgba(236, 72, 153, 0.08) 0%, transparent 45%)",
    ],
  },
  // Light from the surface, deepening toward the edges
  ocean: {
    color: ["#04121a", "#f2f9fb"],
    image: [
      "radial-gradient(ellipse at 50% -10%, rgba(34, 165, 196, 0.16) 0%, transparent 60%), radial-gradient(ellipse at 50% 50%, transparent 55%, rgba(0, 0, 0, 0.4) 100%)",
      "radial-gradient(ellipse at 50% -10%, rgba(34, 165, 196, 0.14) 0%, transparent 60%), radial-gradient(ellipse at 90% 100%, rgba(14, 116, 144, 0.08) 0%, transparent 50%)",
    ],
  },
  // Warm light over dark wood / a pale oak floor
  tree: {
    color: ["#14110d", "#f8f4ec"],
    image: [
      "radial-gradient(ellipse at 20% 0%, rgba(160, 122, 82, 0.12) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.35) 100%)",
      "radial-gradient(ellipse at 20% 0%, rgba(214, 180, 138, 0.25) 0%, transparent 55%), radial-gradient(ellipse at 90% 100%, rgba(194, 162, 126, 0.15) 0%, transparent 50%)",
    ],
  },
  // A kraft-paper desk with a faint dot grid
  notebook: {
    color: ["#16140f", "#efe9dd"],
    image: [
      "radial-gradient(rgba(235, 227, 210, 0.07) 1px, transparent 1.2px)",
      "radial-gradient(rgba(110, 90, 50, 0.12) 1px, transparent 1.2px)",
    ],
    size: "22px 22px",
  },
  // A soft golden glow in the middle of a dark (or parchment) field
  rune: {
    color: ["#0d0c0a", "#f6f0e0"],
    image: [
      "radial-gradient(ellipse at 50% 45%, rgba(201, 162, 74, 0.10) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(0, 0, 0, 0.45) 100%)",
      "radial-gradient(ellipse at 50% 45%, rgba(201, 162, 74, 0.14) 0%, transparent 55%), radial-gradient(ellipse at 50% 50%, transparent 65%, rgba(120, 90, 30, 0.08) 100%)",
    ],
  },
  // The editor background
  vscode: {
    color: ["#1e1e1e", "#f3f3f3"],
    image: ["none", "none"],
  },
  // Polar Night / Snow Storm with a faint frost glow
  nord: {
    color: ["#242933", "#e5e9f0"],
    image: [
      "radial-gradient(ellipse at 20% 0%, rgba(136, 192, 208, 0.07) 0%, transparent 55%)",
      "radial-gradient(ellipse at 20% 0%, rgba(136, 192, 208, 0.18) 0%, transparent 55%)",
    ],
  },
  // Still and warm, with the faintest light
  zen: {
    color: ["#121110", "#f3f0ea"],
    image: [
      "radial-gradient(ellipse at 30% 20%, rgba(232, 228, 220, 0.04) 0%, transparent 60%)",
      "radial-gradient(ellipse at 30% 20%, rgba(255, 255, 255, 0.7) 0%, transparent 60%)",
    ],
  },
  // A page with a fine paper grain
  paper: {
    color: ["#1b1b19", "#f1efe9"],
    image: [
      "radial-gradient(rgba(236, 235, 230, 0.035) 1px, transparent 1px)",
      "radial-gradient(rgba(43, 42, 39, 0.05) 1px, transparent 1px)",
    ],
    size: "4px 4px",
  },
  // A fine dot grid, like Vercel's canvas
  graphite: {
    color: ["#09090b", "#fafafa"],
    image: [
      "radial-gradient(rgba(161, 161, 170, 0.14) 1px, transparent 1.2px)",
      "radial-gradient(rgba(113, 113, 122, 0.16) 1px, transparent 1.2px)",
    ],
    size: "20px 20px",
  },
  // Solarized base03 / base3, a shade beyond the cards
  solarized: {
    color: ["#00212b", "#f5efdc"],
    image: ["none", "none"],
  },
  // Blueprint grid
  architect: {
    color: ["#0b1522", "#f7f9fc"],
    image: [
      "linear-gradient(rgba(125, 167, 214, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(125, 167, 214, 0.07) 1px, transparent 1px), linear-gradient(rgba(125, 167, 214, 0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(125, 167, 214, 0.15) 1px, transparent 1px)",
      "linear-gradient(rgba(71, 85, 105, 0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(71, 85, 105, 0.07) 1px, transparent 1px), linear-gradient(rgba(71, 85, 105, 0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(71, 85, 105, 0.14) 1px, transparent 1px)",
    ],
    size: "20px 20px, 20px 20px, 100px 100px, 100px 100px",
  },
};

export default function GraphVisualizer() {
  const treeData = useStore((s) => s.treeData);
  const rawCollapsedNodes = useStore((s) => s.collapsedNodes);
  const layoutMode = useStore((s) => s.layoutMode);
  const edgeStyle = useStore((s) => s.edgeStyle);
  const nodeTheme = useStore((s) => s.nodeTheme);
  const searchQuery = useStore((s) => s.searchQuery);
  const rawSearchMatches = useStore((s) => s.searchMatches);
  const rawSearchAncestors = useStore((s) => s.searchAncestors);
  const activeMatchIndex = useStore((s) => s.activeMatchIndex);
  const activeMatchId = useStore((s) => s.activeMatchId);
  const selectedNodeId = useStore((s) => s.selectedNodeId);
  const setSelectedNodeId = useStore((s) => s.setSelectedNodeId);
  const isolatedNodeId = useStore((s) => s.isolatedNodeId);
  const setIsolatedNodeId = useStore((s) => s.setIsolatedNodeId);
  const dragOverrides = useStore((s) => s.dragOverrides);
  const activeNodes = useStore((s) => s.activeNodes);
  const nodeShape = useStore((s) => s.nodeShape);
  const nodeSpread = useStore((s) => s.nodeSpread);
  const nodeSize = useStore((s) => s.nodeSize);
  const canvasTheme = useStore((s) => s.canvasTheme);
  const canvasBackgroundColor = useStore((s) => s.canvasBackgroundColor);
  const canvasPatternColor = useStore((s) => s.canvasPatternColor);
  const canvasBackgroundImage = useStore((s) => s.canvasBackgroundImage);
  const canvasBackgroundBlur = useStore((s) => s.canvasBackgroundBlur);
  const appTheme = useStore((s) => s.appTheme);
  const inlineApiEditor = useStore((s) => s.inlineApiEditor);
  const setInlineApiEditor = useStore((s) => s.setInlineApiEditor);
  const autoOrganizeTrigger = useStore((s) => s.autoOrganizeTrigger);
  const nodeLayoutOverrides = useStore((s) => s.nodeLayoutOverrides);

  const collapsedNodes = useDeferredValue(rawCollapsedNodes);
  const searchMatches = useDeferredValue(rawSearchMatches);
  const searchAncestors = useDeferredValue(rawSearchAncestors);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const svgGRef = useRef<SVGGElement>(null);

  useDrawingSystem(wrapperRef);

  const { nodes: originalNodes, links: originalLinks } = useMemo(() => {
    return computeLayout(
      treeData,
      collapsedNodes,
      layoutMode,
      nodeShape,
      nodeSpread,
      nodeSize,
      nodeLayoutOverrides,
    );
  }, [treeData, collapsedNodes, layoutMode, nodeShape, nodeSpread, nodeSize, nodeLayoutOverrides, autoOrganizeTrigger]);

  // Sync computed positions to permanent store (dragOverrides/dexie)
  useEffect(() => {
    const missingOverrides: Record<string, { x: number, y: number }> = {};
    let hasMissing = false;

    for (const node of originalNodes) {
      const isApiResponse = node.data.type === 'api_response' || node.data.id.endsWith('.__response') || node.data.id.endsWith('.__fetched');
      if (isApiResponse && node.parent) {
        const parentId = node.parent.data.id;
        const parentPos = dragOverrides[parentId] || { x: node.parent.x, y: node.parent.y };
        const currentOverride = dragOverrides[node.data.id];
        if (!currentOverride || currentOverride.x <= parentPos.x || Math.abs(currentOverride.y - parentPos.y) > 500 || Math.abs(currentOverride.x - (parentPos.x + 460)) > 600) {
          missingOverrides[node.data.id] = { x: parentPos.x + 460, y: parentPos.y };
          hasMissing = true;
        }
      } else if (!dragOverrides[node.data.id]) {
        missingOverrides[node.data.id] = { x: node.x, y: node.y };
        hasMissing = true;
      }
    }

    if (hasMissing) {
      useStore.getState().setMultipleDragOverrides(missingOverrides);
    }
  }, [originalNodes, dragOverrides]);

  const { nodes, links } = useMemo(() => {
    // Check if we have overrides at all
    if (Object.keys(dragOverrides).length === 0) {
      return { nodes: originalNodes, links: originalLinks };
    }

    // Apply drag overrides
    const overridenNodes = originalNodes.map((n) => {
      const isApiResponse = n.data.type === 'api_response' || n.data.id.endsWith('.__response') || n.data.id.endsWith('.__fetched');
      const parentId = n.parent?.data.id || (isApiResponse ? (n.data.id.endsWith('.__fetched') ? n.data.id.replace(/\.__fetched$/, '') : n.data.id.replace(/\.__response$/, '')) : null);
      const parentPos = parentId ? (dragOverrides[parentId] || (n.parent ? { x: n.parent.x, y: n.parent.y } : null)) : null;

      const override = dragOverrides[n.data.id];
      if (isApiResponse && parentPos) {
        if (!override || override.x <= parentPos.x || Math.abs(override.y - parentPos.y) > 500 || Math.abs(override.x - (parentPos.x + 460)) > 600) {
          const copy = Object.assign(Object.create(Object.getPrototypeOf(n)), n);
          copy.x = parentPos.x + 460;
          copy.y = parentPos.y;
          return copy;
        }
      }

      if (override) {
        // Create a shallow copy keeping prototype functions like .ancestors() working
        const copy = Object.assign(Object.create(Object.getPrototypeOf(n)), n);
        copy.x = override.x;
        copy.y = override.y;
        return copy;
      }
      return n;
    });

    const nodeById = new Map(overridenNodes.map((n) => [n.data.id, n]));

    const overridenLinks = originalLinks
      .map((l) => {
        if (!l.source?.data?.id || !l.target?.data?.id) return null;
        const newSource = nodeById.get(l.source.data.id);
        const newTarget = nodeById.get(l.target.data.id);
        if (!newSource || !newTarget) return null;
        if (newSource === l.source && newTarget === l.target) {
          return l;
        }
        return {
          source: newSource,
          target: newTarget,
        };
      })
      .filter((l): l is typeof originalLinks[0] => l !== null);

    return { nodes: overridenNodes, links: overridenLinks };
  }, [originalNodes, originalLinks, dragOverrides]);

  const selectedPathNodes = useMemo(() => {
    const set = new Set<string>();
    if (selectedNodeId) {
      const selected = nodes.find((n) => n.data.id === selectedNodeId);
      if (selected) {
        let current: any = selected;
        while (current) {
          if (current.data?.id) {
            set.add(current.data.id);
          }
          current = current.parent;
        }
      }
    }
    return set;
  }, [nodes, selectedNodeId]);

  const selectedPathEdges = useMemo(() => {
    const set = new Set<string>();
    if (selectedNodeId) {
      const selected = nodes.find((n) => n.data.id === selectedNodeId);
      if (selected) {
        const ancestorsList: any[] = [];
        let current: any = selected;
        while (current) {
          ancestorsList.push(current);
          current = current.parent;
        }
        for (let i = 0; i < ancestorsList.length - 1; i++) {
          const childNode = ancestorsList[i];
          const parentNode = ancestorsList[i + 1];
          if (childNode?.data?.id && parentNode?.data?.id) {
            set.add(`${parentNode.data.id}->${childNode.data.id}`);
          }
        }
      }
    }
    return set;
  }, [nodes, selectedNodeId]);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    node: TreeNode;
  } | null>(null);

  const [tableViewData, setTableViewData] = useState<{
    data: any[];
    title: string;
    path?: string;
  } | null>(null);
  const [isTableMaximized, setIsTableMaximized] = useState<boolean>(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && tableViewData) {
        setTableViewData(null);
        setIsTableMaximized(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tableViewData]);
  const [mediaInfoModal, setMediaInfoModal] = useState<{
    filename: string;
    mimeType: string;
    size: number;
  } | null>(null);

  const [editingNode, setEditingNode] = useState<{
    node: TreeNode;
    value: string;
    action: "edit" | "add";
    newKey?: string;
    typeOverride?: string;
  } | null>(null);

  const lastTwoFingerTap = useRef<number>(0);
  const twoFingerTapTimeout = useRef<NodeJS.Timeout | null>(null);

  const processUndoRedoGesture = () => {
    const now = Date.now();
    const isDrawingMode = useAnnotationStore.getState().isToolbarVisible;

    if (now - lastTwoFingerTap.current < 300) {
      // Double tap => redo
      if (twoFingerTapTimeout.current) {
        clearTimeout(twoFingerTapTimeout.current);
        twoFingerTapTimeout.current = null;
      }
      if (isDrawingMode) {
        useAnnotationStore.getState().redo();
      } else {
        useStore.getState().redo();
      }
      lastTwoFingerTap.current = 0; // reset
    } else {
      // Single tap => maybe undo
      lastTwoFingerTap.current = now;
      twoFingerTapTimeout.current = setTimeout(() => {
        if (isDrawingMode) {
          useAnnotationStore.getState().undo();
        } else {
          useStore.getState().undo();
        }
        twoFingerTapTimeout.current = null;
      }, 300);
    }
  };

  const twoFingerTouchInfo = useRef<{
    startX1: number;
    startY1: number;
    startX2: number;
    startY2: number;
    time: number;
  } | null>(null);
  const isTwoFingerDragging = useRef(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const onNativeTouchStart = (e: TouchEvent) => {
      // Use capture mode to run before d3 intercepts the event
      if (e.touches.length === 2) {
        const rect = el.getBoundingClientRect();
        twoFingerTouchInfo.current = {
          startX1: e.touches[0].clientX - rect.left,
          startY1: e.touches[0].clientY - rect.top,
          startX2: e.touches[1].clientX - rect.left,
          startY2: e.touches[1].clientY - rect.top,
          time: Date.now(),
        };
        isTwoFingerDragging.current = false;
        window.dispatchEvent(new CustomEvent("cancel-drawing"));
      } else {
        twoFingerTouchInfo.current = null;
      }
    };

    const onNativeTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && twoFingerTouchInfo.current) {
        const rect = el.getBoundingClientRect();
        const x1 = e.touches[0].clientX - rect.left;
        const y1 = e.touches[0].clientY - rect.top;
        const x2 = e.touches[1].clientX - rect.left;
        const y2 = e.touches[1].clientY - rect.top;

        const info = twoFingerTouchInfo.current;
        const dx1 = x1 - info.startX1;
        const dy1 = y1 - info.startY1;
        const dx2 = x2 - info.startX2;
        const dy2 = y2 - info.startY2;

        // If movement is > 10px, it's a drag/zoom
        if (Math.hypot(dx1, dy1) > 10 || Math.hypot(dx2, dy2) > 10) {
          isTwoFingerDragging.current = true;
        }
      }
    };

    const onNativeTouchEnd = (e: TouchEvent) => {
      if (twoFingerTouchInfo.current && e.touches.length < 2) {
        const duration = Date.now() - twoFingerTouchInfo.current.time;

        if (!isTwoFingerDragging.current && duration < 300) {
          processUndoRedoGesture();
        }

        twoFingerTouchInfo.current = null;
        isTwoFingerDragging.current = false;
      }
    };

    el.addEventListener("touchstart", onNativeTouchStart, {
      capture: true,
      passive: false,
    });
    el.addEventListener("touchmove", onNativeTouchMove, {
      capture: true,
      passive: false,
    });
    el.addEventListener("touchend", onNativeTouchEnd, {
      capture: true,
      passive: false,
    });
    return () => {
      el.removeEventListener("touchstart", onNativeTouchStart, {
        capture: true,
      });
      el.removeEventListener("touchmove", onNativeTouchMove, { capture: true });
      el.removeEventListener("touchend", onNativeTouchEnd, { capture: true });
    };
  }, []);

  const handleBackgroundContextMenu = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    processUndoRedoGesture();
  };

  const hasCentered = useRef(false);
  const zoomRef = useRef<d3.ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  const lastSearchQuery = useRef<string>("");

  const nodesRef = useRef(nodes);
  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    if (!wrapperRef.current || !svgGRef.current) return;

    const zoom = d3
      .zoom<HTMLDivElement, unknown>()
      .filter((e) => {
        // Always allow zoom/pan if it's a multi-touch scenario (fingers >= 2)
        if (e.touches && e.touches.length >= 2) {
          return true;
        }

        const { activeTool, isToolbarVisible } = useAnnotationStore.getState();

        // If clicking on transform handles or no-drag areas, block zoom
        if (
          e.target &&
          (e.target as Element).closest(
            ".transform-box, .nodrag, .node-query-engine",
          )
        ) {
          return false;
        }

        // If toolbar is visible, standard behavior: don't zoom if tool is active
        if (isToolbarVisible) {
          if (activeTool !== "select" && e.type !== "wheel") {
            return false;
          }
        } else {
          // If toolbar is hidden, only prevent zoom if Ctrl is held (drawing mode)
          if (e.ctrlKey && e.type !== "wheel") {
            return false;
          }
        }

        return (!e.ctrlKey || e.type === "wheel") && !e.button;
      })
      .scaleExtent([0.1, 4])
      .on("zoom", (e) => {
        if (svgGRef.current) {
          const transform = e.transform;
          svgGRef.current.setAttribute("transform", transform.toString());
        }
      });

    zoomRef.current = zoom;

    const selection = d3.select(wrapperRef.current);
    selection.call(zoom);

    // Initial centering only once
    if (nodesRef.current.length > 0 && !hasCentered.current) {
      if (wrapperRef.current) {
        const xExtent = d3.extent(nodesRef.current, (d) => (d as any).x) as [
          number,
          number,
        ];
        const yExtent = d3.extent(nodesRef.current, (d) => (d as any).y) as [
          number,
          number,
        ];
        const width = xExtent[1] - xExtent[0] || 1;
        const height = yExtent[1] - yExtent[0] || 1;
        const cw = wrapperRef.current!.clientWidth;
        const ch = wrapperRef.current!.clientHeight;
        const scale = Math.min(cw / (width + 300), ch / (height + 300), 2);
        const tx = cw / 2 - ((xExtent[0] + xExtent[1]) / 2) * scale;
        const ty = ch / 2 - ((yExtent[0] + yExtent[1]) / 2) * scale;

        const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
        selection.call(zoom.transform, transform);
      }
      hasCentered.current = true;
    }

    // Bind fit trigger
    const fitBtn = document.getElementById("fit-graph-btn");
    const onFit = () => {
      const currentNodes = nodesRef.current;
      if (currentNodes.length === 0) return;
      const xExtent = d3.extent(currentNodes, (d) => (d as any).x) as [
        number,
        number,
      ];
      const yExtent = d3.extent(currentNodes, (d) => (d as any).y) as [
        number,
        number,
      ];
      const width = xExtent[1] - xExtent[0];
      const height = yExtent[1] - yExtent[0];
      const cw = wrapperRef.current!.clientWidth;
      const ch = wrapperRef.current!.clientHeight;
      const scale = Math.min(cw / (width + 300), ch / (height + 300), 2);
      const tx = cw / 2 - ((xExtent[0] + xExtent[1]) / 2) * scale;
      const ty = ch / 2 - ((yExtent[0] + yExtent[1]) / 2) * scale;
      selection
        .transition()
        .duration(750)
        .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
    };
    if (fitBtn) fitBtn.addEventListener("click", onFit);

    const onVoiceZoom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      let factor = detail.factor || 1.5;
      if (detail.op === 'out') factor = 1 / factor;

      if (detail.direction) {
        let dx = 0; let dy = 0;
        const panAmount = 300; // pixels to pan
        if (detail.direction.includes('left')) dx = panAmount;
        if (detail.direction.includes('right')) dx = -panAmount;
        if (detail.direction.includes('top')) dy = panAmount;
        if (detail.direction.includes('bottom')) dy = -panAmount;

        // Pan first, then scale
        selection.transition().duration(300).call(zoom.translateBy, dx, dy)
          .transition().duration(300).call(zoom.scaleBy, factor);
      } else {
        selection.transition().duration(300).call(zoom.scaleBy, factor);
      }
    };
    window.addEventListener("voice-zoom", onVoiceZoom);

    const onVoiceMove = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      let dx = 0; let dy = 0;
      const panAmount = 300 * (detail.factor || 1); // scale pan amount by factor

      if (detail.direction.includes('left')) dx = panAmount;
      if (detail.direction.includes('right')) dx = -panAmount;
      if (detail.direction.includes('top')) dy = panAmount;
      if (detail.direction.includes('bottom')) dy = -panAmount;

      selection.transition().duration(300).call(zoom.translateBy, dx, dy);
    };
    window.addEventListener("voice-move", onVoiceMove);

    return () => {
      selection.on(".zoom", null);
      if (fitBtn) fitBtn.removeEventListener("click", onFit);
      window.removeEventListener("voice-zoom", onVoiceZoom);
      window.removeEventListener("voice-move", onVoiceMove);
    };
  }, [nodes.length > 0]); // only re-run effect if we transition from 0 to N nodes (or just keep zoom behavior stable)

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);

    const handleCanvasClick = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Check if clicking inside dynamic forms, toolbar, buttons etc.
      if (
        target.closest("button") ||
        target.closest("input") ||
        target.closest("select") ||
        target.closest("textarea") ||
        target.closest(".no-export") ||
        target.closest('[role="dialog"]') ||
        target.closest(".context-menu") ||
        target.closest(".advanced-panel") ||
        target.closest(".drawing-toolbar") ||
        target.closest(".toolbar-container") ||
        target.closest(".editor-panel")
      ) {
        return;
      }

      // Check if clicked inside our wrapper (empty canvas space)
      if (wrapperRef.current && wrapperRef.current.contains(target)) {
        // If clicking on or inside a node, do not clear selection
        const clickedInsideNode =
          target.closest(".nodes-layer") ||
          target.closest('[class*="node" i]');

        if (!clickedInsideNode) {
          setSelectedNodeId(null);
        }
      }
    };

    // Use standard bubbling phase so we don't interfere with React 19's context or capture phases of other components (e.g. Monaco editor)
    document.addEventListener("pointerdown", handleCanvasClick);

    return () => {
      window.removeEventListener("click", handleClick);
      document.removeEventListener("pointerdown", handleCanvasClick);
    };
  }, [setSelectedNodeId]);

  const applyJsonChange = async (
    nodePath: string,
    action: "edit" | "add" | "delete",
    newValueStr: string,
    newKeyStr?: string,
    typeOverride?: string,
  ) => {
    try {
      const {
        code,
        setCode,
        codeFormat,
        parsedData,
        apiNodeResponses,
        setApiNodeResponse,
        removeApiNode,
      } = useStore.getState();

      if (nodePath.includes(".__fetched")) {
        const fetchedMarker = ".__fetched";
        const idx = nodePath.indexOf(fetchedMarker);
        const apiNodePath = nodePath.substring(0, idx);
        const relativePath = nodePath.substring(idx + fetchedMarker.length);

        let finalValue: any = newValueStr;
        if (action === "edit" || action === "add") {
          if (typeOverride && typeOverride !== "auto") {
            if (typeOverride === "object") {
              try {
                finalValue = newValueStr ? JSON.parse(newValueStr) : {};
                if (typeof finalValue !== "object" || Array.isArray(finalValue) || finalValue === null) {
                  finalValue = {};
                }
              } catch {
                finalValue = {};
              }
            } else if (typeOverride === "array") {
              try {
                finalValue = newValueStr ? JSON.parse(newValueStr) : [];
                if (!Array.isArray(finalValue)) {
                  finalValue = [];
                }
              } catch {
                finalValue = [];
              }
            } else if (typeOverride === "null") finalValue = null;
            else if (typeOverride === "boolean")
              finalValue = newValueStr === "true";
            else if (typeOverride === "number") {
              const num = Number(newValueStr);
              finalValue = isNaN(num) ? 0 : num;
            } else if (typeOverride === "string") finalValue = newValueStr;
          } else {
            try {
              finalValue = JSON.parse(newValueStr || '""');
            } catch (e) {
              finalValue = newValueStr;
            }
          }
        }

        const originalResponse = apiNodeResponses[apiNodePath];
        if (relativePath === "") {
          if (action === "edit") {
            setApiNodeResponse(apiNodePath, finalValue);
          } else if (action === "delete") {
            removeApiNode(apiNodePath);
          } else if (action === "add") {
            let cloned =
              originalResponse !== undefined
                ? JSON.parse(JSON.stringify(originalResponse))
                : {};
            if (Array.isArray(cloned)) {
              cloned.push(finalValue);
            } else if (cloned && typeof cloned === "object") {
              if (newKeyStr) cloned[newKeyStr] = finalValue;
            }
            setApiNodeResponse(apiNodePath, cloned);
          }
          return;
        }

        // Relative path modification inside API response
        const parts = relativePath
          .split(/(?=\[)|(?=\.)/)
          .filter(Boolean)
          .map((p) =>
            p.startsWith(".") ? p.substring(1) : p.replace(/[\[\]]/g, ""),
          );

        // Deep copy original response
        const cloned = JSON.parse(JSON.stringify(originalResponse));
        let current = cloned;
        for (let i = 0; i < parts.length - 1; i++) {
          if (current === undefined || current === null || typeof current !== 'object') break;
          current = current[parts[i]];
        }

        if (current === undefined || current === null || typeof current !== 'object') {
          console.warn("Invalid path for changes relative to api node", relativePath);
          return;
        }

        const lastKey = parts[parts.length - 1];

        if (action === "edit") {
          if (newKeyStr && newKeyStr !== lastKey && !Array.isArray(current)) {
            delete current[lastKey];
            current[newKeyStr] = finalValue;
          } else {
            current[lastKey] = finalValue;
          }
        } else if (action === "delete") {
          if (Array.isArray(current)) {
            const numIndex = Number(lastKey);
            if (!isNaN(numIndex)) {
              current.splice(numIndex, 1);
            }
          } else if (typeof current === "object" && current !== null) {
            delete current[lastKey];
          }
        } else if (action === "add") {
          const target = current[lastKey];
          if (Array.isArray(target)) {
            target.push(finalValue);
          } else if (typeof target === "object" && target !== null) {
            if (newKeyStr) target[newKeyStr] = finalValue;
          }
        }

        setApiNodeResponse(apiNodePath, cloned);
        return;
      }

      const parsed = parsedData
        ? JSON.parse(JSON.stringify(parsedData))
        : codeFormat === "yaml"
          ? {}
          : JSON.parse(code);

      let finalValue: any = newValueStr;

      if (action === "edit" || action === "add") {
        if (typeOverride && typeOverride !== "auto") {
          if (typeOverride === "object") {
            try {
              finalValue = newValueStr ? JSON.parse(newValueStr) : {};
              if (typeof finalValue !== "object" || Array.isArray(finalValue) || finalValue === null) {
                finalValue = {};
              }
            } catch {
              finalValue = {};
            }
          } else if (typeOverride === "array") {
            try {
              finalValue = newValueStr ? JSON.parse(newValueStr) : [];
              if (!Array.isArray(finalValue)) {
                finalValue = [];
              }
            } catch {
              finalValue = [];
            }
          } else if (typeOverride === "null") finalValue = null;
          else if (typeOverride === "boolean")
            finalValue = newValueStr === "true";
          else if (typeOverride === "number") {
            const num = Number(newValueStr);
            finalValue = isNaN(num) ? 0 : num;
          } else if (typeOverride === "string") finalValue = newValueStr;
        } else {
          try {
            finalValue = JSON.parse(newValueStr || '""');
          } catch (e) {
            finalValue = newValueStr;
          }
        }
      }

      if (nodePath === "root") {
        if (action === "edit") {
          if (codeFormat === "yaml") {
            try {
              const yaml = (await import("js-yaml")).default;
              setCode(yaml.dump(finalValue));
            } catch (err) {
              console.error("js-yaml import failed", err);
            }
          } else {
            setCode(JSON.stringify(finalValue, null, 2));
          }
        } else if (action === "delete") {
          if (codeFormat === "yaml") {
            setCode("");
          } else {
            setCode("{}");
          }
        } else if (action === "add") {
          if (Array.isArray(parsed)) parsed.push(finalValue);
          else if (typeof parsed === "object" && parsed !== null) {
            if (newKeyStr) parsed[newKeyStr] = finalValue;
          }
          if (codeFormat === "yaml") {
            try {
              const yaml = (await import("js-yaml")).default;
              setCode(yaml.dump(parsed));
            } catch (err) {
              console.error("js-yaml import failed", err);
            }
          } else {
            setCode(JSON.stringify(parsed, null, 2));
          }
        }
        return;
      }

      const parts = nodePath
        .replace(/^root/, "")
        .split(/(?=\[)|(?=\.)/)
        .filter(Boolean)
        .map((p) =>
          p.startsWith(".") ? p.substring(1) : p.replace(/[\[\]]/g, ""),
        );

      let current = parsed;
      for (let i = 0; i < parts.length - 1; i++) {
        if (current === undefined || current === null || typeof current !== 'object') break;
        current = current[parts[i]];
      }

      if (current === undefined || current === null || typeof current !== 'object') {
        console.warn("Invalid path for changes, current is not an object", nodePath);
        return;
      }

      const lastKey = parts[parts.length - 1];

      if (action === "edit") {
        // Handle Key Renaming for Objects
        if (newKeyStr && newKeyStr !== lastKey && !Array.isArray(current)) {
          // Delete old key, set new key
          delete current[lastKey];
          current[newKeyStr] = finalValue;
        } else {
          current[lastKey] = finalValue;
        }
      } else if (action === "delete") {
        if (Array.isArray(current)) {
          current.splice(Number(lastKey), 1);
        } else {
          delete current[lastKey];
        }
      } else if (action === "add") {
        const target = current[lastKey];
        if (Array.isArray(target)) {
          target.push(finalValue);
        } else if (typeof target === "object" && target !== null) {
          if (newKeyStr) target[newKeyStr] = finalValue;
        }
      }

      if (codeFormat === "yaml") {
        const yaml = (await import("js-yaml")).default;
        setCode(yaml.dump(parsed));
      } else {
        setCode(JSON.stringify(parsed, null, 2));
      }
    } catch (e) {
      console.error("Failed to update JSON/YAML/CSV", e);
      useStore
        .getState()
        .setNotification({
          message:
            "Invalid format or edit failure. Check if key is empty for object insertions.",
          type: "error",
        });
    }
  };

  const preSearchTransformRef = useRef<any>(null);

  // Zoom to search matches
  useEffect(() => {
    if (!wrapperRef.current || !zoomRef.current) return;

    // Save current transform if starting a new search
    if (!lastSearchQuery.current && searchQuery) {
      preSearchTransformRef.current = d3.zoomTransform(wrapperRef.current);
    }

    if (searchQuery === lastSearchQuery.current) return; // only zoom on new query
    lastSearchQuery.current = searchQuery;

    if (!searchQuery) {
      if (preSearchTransformRef.current) {
        d3.select(wrapperRef.current)
          .transition()
          .duration(750)
          .call(zoomRef.current.transform, preSearchTransformRef.current);
        preSearchTransformRef.current = null;
      }
      return;
    }

    if (searchMatches.size === 0) return;

    // Filter node coordinates
    const matchedNodes = nodes.filter((n) => searchMatches.has(n.data.id));
    if (matchedNodes.length === 0) return;

    const xValues = matchedNodes.map((d) => d.x);
    const yValues = matchedNodes.map((d) => d.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const width = maxX - minX;
    const height = maxY - minY;

    const cw = wrapperRef.current.clientWidth;
    const ch = wrapperRef.current.clientHeight;

    // Target scale (capped)
    const scale = Math.min(
      cw / (width + 400),
      ch / (height + 400),
      cw < 768 ? 0.85 : 1.2,
    );
    const tx = cw / 2 - ((minX + maxX) / 2) * scale;
    const ty = ch / 2 - ((minY + maxY) / 2) * scale;

    d3.select(wrapperRef.current)
      .transition()
      .duration(750)
      .call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale),
      );
  }, [searchQuery, searchMatches, nodes]);

  // Zoom to specific active match
  const lastActiveMatchIndex = useRef<number | null>(null);
  const zoomQueryRef = useRef<string | null>(null);

  useEffect(() => {
    if (!wrapperRef.current || !zoomRef.current || activeMatchId === null) {
      lastActiveMatchIndex.current = null;
      zoomQueryRef.current = searchQuery;
      return;
    }

    const isNewQuery = zoomQueryRef.current !== searchQuery;
    zoomQueryRef.current = searchQuery;

    if (activeMatchIndex === lastActiveMatchIndex.current) return;
    lastActiveMatchIndex.current = activeMatchIndex;

    // Do not zoom to individual match if it's the very first match of a new query,
    // because the main search effect handles group zooming.
    if (isNewQuery) return;

    const matchedNode = nodes.find((n) => n.data.id === activeMatchId);
    if (!matchedNode) return;

    const width = wrapperRef.current.clientWidth;
    const height = wrapperRef.current.clientHeight;

    // Slightly higher zoom, as requested ("bit more zoom but not too much")
    const scale = width < 768 ? 1.0 : 1.8;
    const tx = width / 2 - matchedNode.x * scale;
    // Offset ty downwards to perfectly center the node within the VISIBLE area beneath the search bar
    const ty = height / 2 + (width < 768 ? 40 : 60) - matchedNode.y * scale;

    d3.select(wrapperRef.current)
      .transition()
      .duration(750)
      .call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(tx, ty).scale(scale),
      );
  }, [activeMatchIndex, activeMatchId, searchQuery, nodes]);

  const isToolbarVisible = useAnnotationStore((state) => state.isToolbarVisible);
  const activeTool = useAnnotationStore((state) => state.activeTool);
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
    // Also reset if window loses focus
    const handleBlur = () => setIsCtrlPressed(false);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const getCursorClass = () => {
    // If toolbar is visible, use tool cursor
    // If toolbar is hidden, use grab cursor UNLESS Ctrl is pressed
    const isDrawingActive =
      isToolbarVisible || (isCtrlPressed && activeTool !== "select");

    if (!isDrawingActive) return "cursor-grab active:cursor-grabbing";

    switch (activeTool) {
      case "select":
        return "cursor-move";
      case "eraser":
        return "cursor-cell";
      case "pen":
      case "highlighter":
      case "rectangle":
      case "circle":
      case "ellipse":
      case "triangle":
      case "square":
      case "rounded-rectangle":
      case "pentagon":
      case "hexagon":
      case "heptagon":
      case "octagon":
      case "polygon":
      case "star":
      case "diamond":
      case "function-brush":
        return "cursor-crosshair";
      default:
        return "cursor-crosshair";
    }
  };

  return (
    <div
      id="graph-export-wrapper"
      ref={wrapperRef}
      onClick={() => {
        setSelectedNodeId(null);
        setIsolatedNodeId(null);
      }}
      onContextMenu={handleBackgroundContextMenu}
      className={`relative w-full h-full overflow-hidden outline-none touch-none ${getCursorClass()}`}
    >
      <div
        id="graph-background-layer"
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundColor:
            THEME_CANVAS[nodeTheme]?.color[appTheme === "dark" ? 0 : 1] ?? (canvasBackgroundColor || "transparent"),
          backgroundImage:
            THEME_CANVAS[nodeTheme]?.image[appTheme === "dark" ? 0 : 1] ??
            (canvasBackgroundImage ? `url(${canvasBackgroundImage})` : "none"),
          backgroundSize: THEME_CANVAS[nodeTheme]?.size ?? "cover",
          backgroundPosition: "center",
          filter:
            canvasBackgroundBlur > 0
              ? `blur(${canvasBackgroundBlur}px)`
              : "none",
          transform: canvasBackgroundBlur > 0 ? "scale(1.1)" : "none",
        }}
      />
      <svg className="absolute inset-0 z-10 w-full h-full pointer-events-none graph-svg">
        <defs>
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>

          <pattern
            id="theme-dots"
            x="0"
            y="0"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="2" cy="2" r="1" fill={canvasPatternColor} />
          </pattern>

          <pattern
            id="theme-grid"
            x="0"
            y="0"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 40 0 L 0 0 0 40"
              fill="none"
              stroke={canvasPatternColor}
              strokeWidth="1"
            />
            <path
              d="M 200 0 L 0 0 0 200"
              fill="none"
              stroke={canvasPatternColor}
              strokeWidth="2"
            />
          </pattern>

          <pattern
            id="theme-lines"
            x="0"
            y="0"
            width="40"
            height="40"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 0 40 L 40 0"
              fill="none"
              stroke={canvasPatternColor}
              strokeWidth="1"
            />
          </pattern>

        </defs>

        <g ref={svgGRef} className="pointer-events-auto graph-g">
          {/* Background Rect inside zoom group to scale with content */}
          {canvasTheme !== "none" && (
            <rect
              x="-100000"
              y="-100000"
              width="200000"
              height="200000"
              fill={`url(#theme-${canvasTheme})`}
              className="canvas-theme-rect pointer-events-none"
            />
          )}

          <g className="nodes-layer" style={{ zIndex: 20 }}>
            {(() => {
              const elements: any[] = [];
              const nodeMaxEdgeZ = new Map<string, number>();
              
              links.forEach((link) => {
                if (!link || !link.source?.data?.id || !link.target?.data?.id) return;
                const isSelectedPath = selectedPathEdges.has(`${link.source.data.id}->${link.target.data.id}`);
                const sourceActive = activeNodes.indexOf(link.source.data.id);
                const targetActive = activeNodes.indexOf(link.target.data.id);
                const maxActive = Math.max(sourceActive, targetActive);
                
                let z = 0;
                if (maxActive !== -1) z = 10000 + maxActive * 10 - 2;
                else if (isSelectedPath) z = 1000 - 2;
                else z = -2;

                const currentSourceZ = nodeMaxEdgeZ.get(link.source.data.id) ?? -Infinity;
                if (z > currentSourceZ) nodeMaxEdgeZ.set(link.source.data.id, z);

                const currentTargetZ = nodeMaxEdgeZ.get(link.target.data.id) ?? -Infinity;
                if (z > currentTargetZ) nodeMaxEdgeZ.set(link.target.data.id, z);

                elements.push({ type: 'link', data: link, isSelectedPath, z });
              });

              nodes.forEach((node) => {
                const isSelectedPath = selectedPathNodes.has(node.data.id);
                const activeIndex = activeNodes.indexOf(node.data.id);
                
                let intrinsicZ = 0;
                if (activeIndex !== -1) intrinsicZ = 10000 + activeIndex * 10;
                else if (isSelectedPath) intrinsicZ = 1000;
                else intrinsicZ = 0;

                const maxEdgeZ = nodeMaxEdgeZ.get(node.data.id) ?? -Infinity;
                const finalZ = Math.max(intrinsicZ, maxEdgeZ + 1);

                elements.push({ type: 'node', data: node, isSelectedPath, z: finalZ });
              });

              elements.sort((a, b) => a.z - b.z);

              return elements.map((el) => {
                if (el.type === 'link') {
                  const link = el.data;
                  const isMatchPath = !!searchQuery && (searchMatches.has(link.target.data.id) || searchAncestors.has(link.target.data.id));
                  const isDimmedPath = !!searchQuery && !isMatchPath;
                  const effectiveLinkLayout = (nodeLayoutOverrides && nodeLayoutOverrides[link.source.data.id]) || layoutMode;
                  const d = getEdgePath(link.source as any, link.target as any, edgeStyle, effectiveLinkLayout);
                  return (
                    <EdgeRenderer
                      key={`link-${link.source.data.id}-${link.target.data.id}`}
                      d={d}
                      style={edgeStyle}
                      nodeTheme={nodeTheme}
                      isHighlighted={isMatchPath}
                      isDimmed={isDimmedPath}
                      isSelected={el.isSelectedPath}
                      source={link.source as any}
                      target={link.target as any}
                      layoutMode={effectiveLinkLayout}
                      targetData={link.target.data}
                    />
                  );
                } else {
                  const node = el.data;
                  const isSelected = selectedNodeId === node.data.id;
                  const effectiveNodeLayout = (nodeLayoutOverrides && nodeLayoutOverrides[node.data.id]) || layoutMode;
                  return (
                    <NodeRenderer
                      key={`node-${node.data.id}`}
                      node={node}
                      layoutMode={effectiveNodeLayout}
                      isSelectedPath={el.isSelectedPath}
                      isSelected={isSelected}
                      isIsolatedMode={isolatedNodeId !== null}
                      onContextMenu={(e, treeNode) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setContextMenu({ x: e.clientX, y: e.clientY, node: treeNode });
                      }}
                    />
                  );
                }
              });
            })()}
          </g>
          <g className="annotations-layer">
            <AnnotationRenderer />
          </g>
          <g className="popups-layer">
            {inlineApiEditor && (
              <InlineApiEditor
                key={inlineApiEditor.nodeId}
                initialUrl={inlineApiEditor.url}
                path={inlineApiEditor.path}
                nodeX={inlineApiEditor.x}
                nodeY={inlineApiEditor.y}
                nodeWidth={inlineApiEditor.width}
                nodeHeight={inlineApiEditor.height}
                initialTab={inlineApiEditor.initialTab}
                onClose={() => setInlineApiEditor(null)}
              />
            )}
          </g>
        </g>
      </svg>

      {nodes.length === 0 && (
        <BlankCanvasTemplateGallery />
      )}

      {/* Floating Search & Settings */}
      {nodes.length > 0 && <NodeQueryEngine />}

      {/* Context Menu */}
      {contextMenu && (
        <NodeContextMenu
          contextMenu={contextMenu}
          setContextMenu={setContextMenu}
          setTableViewData={setTableViewData}
          setEditingNode={setEditingNode}
          applyJsonChange={applyJsonChange}
          setMediaInfoModal={setMediaInfoModal}
        />
      )}

      {/* Table View Modal */}
      {tableViewData &&
        createPortal(
          <div
            className={`fixed inset-0 z-[10000] flex items-center justify-center ${
              isTableMaximized ? "p-0" : "p-0 sm:p-4 md:p-6"
            } ${appTheme}`}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => {
                setTableViewData(null);
                setIsTableMaximized(false);
              }}
            />
            <div
              className={`relative transition-all duration-200 ${
                isTableMaximized
                  ? "w-screen h-screen max-w-none max-h-none rounded-none border-none p-0"
                  : "w-full h-full sm:h-[90vh] sm:max-h-[920px] max-w-7xl sm:rounded-2xl border border-slate-200/90 dark:border-emerald-950/60 shadow-2xl shadow-emerald-950/10 dark:shadow-emerald-950/40"
              } bg-[#fafcfb] dark:bg-[#0a0f0d] flex flex-col overflow-hidden`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-slate-200/90 dark:border-emerald-950/70 bg-white/95 dark:bg-[#0d1613]/95 backdrop-blur-md shrink-0">
                <h2 className="text-sm sm:text-base md:text-lg font-semibold flex items-center gap-2 text-slate-800 dark:text-emerald-50 truncate pr-2">
                  <TableProperties className="text-emerald-500 shrink-0" size={19} />
                  <span className="truncate">Table View: {tableViewData.title}</span>
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setIsTableMaximized(!isTableMaximized)}
                    className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border shadow-xs ${
                      isTableMaximized
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600 shadow-sm shadow-emerald-500/20"
                        : "bg-white hover:bg-emerald-50/70 text-slate-700 hover:text-emerald-700 border-slate-200 dark:bg-[#121c18] dark:hover:bg-emerald-950/50 dark:text-slate-200 dark:hover:text-emerald-300 dark:border-emerald-900/50"
                    }`}
                    title={isTableMaximized ? "Return to Normal View (Esc)" : "Expand to Fullscreen"}
                    aria-label={isTableMaximized ? "Normal View" : "Fullscreen"}
                  >
                    {isTableMaximized ? (
                      <>
                        <Minimize2 size={14} />
                        <span>Normal View</span>
                      </>
                    ) : (
                      <>
                        <Maximize2 size={14} />
                        <span>Fullscreen</span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      setTableViewData(null);
                      setIsTableMaximized(false);
                    }}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-transparent hover:border-red-200 dark:hover:border-red-900/40 transition-colors"
                    title="Close (Esc)"
                    aria-label="Close"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="flex-1 bg-[#fafcfb] dark:bg-[#0a0f0d] overflow-hidden min-h-0">
                <TableView
                  data={tableViewData.data}
                  title={tableViewData.title}
                  isMaximized={isTableMaximized}
                  onToggleMaximize={() => setIsTableMaximized(!isTableMaximized)}
                  onClose={() => {
                    setTableViewData(null);
                    setIsTableMaximized(false);
                  }}
                  onSaveData={(updatedData) => {
                    if (tableViewData.path) {
                      applyJsonChange(
                        tableViewData.path,
                        "edit",
                        JSON.stringify(updatedData),
                        undefined,
                        "array"
                      );
                    }
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Editing Modal */}
      <NodeEditingModal
        editingNode={editingNode}
        setEditingNode={setEditingNode}
        applyJsonChange={applyJsonChange}
      />

      {mediaInfoModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMediaInfoModal(null)}
          >
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl p-6 w-full max-w-sm flex flex-col gap-4 animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Info size={18} className="text-pink-500" />
                  Media Info
                </h3>
                <button
                  onClick={() => setMediaInfoModal(null)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    File Name
                  </span>
                  <span
                    className="text-sm font-medium text-slate-800 dark:text-slate-300 truncate"
                    title={mediaInfoModal.filename}
                  >
                    {mediaInfoModal.filename}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    MIME Type
                  </span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-300 truncate">
                    {mediaInfoModal.mimeType}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">
                    Size
                  </span>
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-300">
                    {formatFileSize(mediaInfoModal.size, 'B')}
                  </span>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
