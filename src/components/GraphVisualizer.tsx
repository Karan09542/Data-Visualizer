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
} from "lucide-react";
import { InlineApiEditor } from "./InlineApiEditor";

import { TableView } from "./TableView";

import NodeQueryEngine from "./NodeQueryEngine";
import { NodeContextMenu } from "./NodeContextMenu";
import { NodeEditingModal } from "./NodeEditingModal";

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
    );
  }, [treeData, collapsedNodes, layoutMode, nodeShape, nodeSpread, nodeSize, autoOrganizeTrigger]);

  // Sync computed positions to permanent store (dragOverrides/dexie)
  useEffect(() => {
    const missingOverrides: Record<string, { x: number, y: number }> = {};
    let hasMissing = false;

    for (const node of originalNodes) {
      if (!dragOverrides[node.data.id]) {
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
      const override = dragOverrides[n.data.id];
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
  } | null>(null);
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
            if (typeOverride === "object") finalValue = {};
            else if (typeOverride === "array") finalValue = [];
            else if (typeOverride === "null") finalValue = null;
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
          if (typeOverride === "object") finalValue = {};
          else if (typeOverride === "array") finalValue = [];
          else if (typeOverride === "null") finalValue = null;
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
      {nodeTheme === "hydrogen" && (
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{ zIndex: 0 }}
        >
          <svg width="100%" height="100%">
            <defs>
              <radialGradient id="h-bg-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
              </radialGradient>
            </defs>
            {/* Core ambient glows */}
            <circle cx="20%" cy="80%" r="200" fill="url(#h-bg-glow)" />
            <circle cx="85%" cy="15%" r="300" fill="url(#h-bg-glow)" />
            <circle
              cx="50%"
              cy="50%"
              r="400"
              fill="url(#h-bg-glow)"
              opacity="0.5"
            />

            {/* Grid layout */}
            <g
              stroke={
                appTheme === "dark"
                  ? "rgba(255,255,255,0.03)"
                  : "rgba(0,0,0,0.03)"
              }
              strokeWidth="1"
            >
              <path d="M 0 0 L 100 100" strokeDasharray="5,5" />
              <pattern
                id="dotGrid"
                width="40"
                height="40"
                patternUnits="userSpaceOnUse"
              >
                <circle
                  cx="2"
                  cy="2"
                  r="1.5"
                  fill={
                    appTheme === "dark"
                      ? "rgba(147,197,253,0.15)"
                      : "rgba(59,130,246,0.15)"
                  }
                />
              </pattern>
              <rect width="100%" height="100%" fill="url(#dotGrid)" />
            </g>

            {/* Atomic structures */}
            <g
              stroke={
                appTheme === "dark"
                  ? "rgba(147,197,253,0.15)"
                  : "rgba(59,130,246,0.15)"
              }
              strokeWidth="1"
              fill="none"
            >
              {/* Bottom left atom */}
              <g transform="translate(200, 800)">
                <ellipse
                  cx="0"
                  cy="0"
                  rx="100"
                  ry="40"
                  transform="rotate(30)"
                />
                <ellipse
                  cx="0"
                  cy="0"
                  rx="100"
                  ry="40"
                  transform="rotate(-30)"
                />
                <ellipse
                  cx="0"
                  cy="0"
                  rx="100"
                  ry="40"
                  transform="rotate(90)"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="25"
                  fill={
                    appTheme === "dark"
                      ? "rgba(147,197,253,0.2)"
                      : "rgba(59,130,246,0.1)"
                  }
                />
                <circle
                  cx="60"
                  cy="-60"
                  r="4"
                  fill={appTheme === "dark" ? "#93c5fd" : "#3b82f6"}
                />
                <circle
                  cx="-30"
                  cy="90"
                  r="3"
                  fill={appTheme === "dark" ? "#93c5fd" : "#3b82f6"}
                />
              </g>

              {/* Top right atom */}
              <g transform="translate(1400, 200)">
                <ellipse
                  cx="0"
                  cy="0"
                  rx="150"
                  ry="60"
                  transform="rotate(45)"
                />
                <ellipse
                  cx="0"
                  cy="0"
                  rx="150"
                  ry="60"
                  transform="rotate(-45)"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="40"
                  fill={
                    appTheme === "dark"
                      ? "rgba(147,197,253,0.2)"
                      : "rgba(59,130,246,0.1)"
                  }
                />
                <circle
                  cx="106"
                  cy="106"
                  r="5"
                  fill={appTheme === "dark" ? "#93c5fd" : "#3b82f6"}
                />
              </g>

              {/* Water molecule shape loosely */}
              <g transform="translate(800, 600)">
                <line
                  x1="0"
                  y1="0"
                  x2="-60"
                  y2="50"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />
                <line
                  x1="0"
                  y1="0"
                  x2="60"
                  y2="50"
                  strokeWidth="2"
                  strokeDasharray="4,4"
                />
                <circle
                  cx="0"
                  cy="0"
                  r="30"
                  fill={
                    appTheme === "dark"
                      ? "rgba(147,197,253,0.15)"
                      : "rgba(59,130,246,0.15)"
                  }
                />
                <circle
                  cx="-60"
                  cy="50"
                  r="15"
                  fill={
                    appTheme === "dark"
                      ? "rgba(147,197,253,0.1)"
                      : "rgba(59,130,246,0.1)"
                  }
                />
                <circle
                  cx="60"
                  cy="50"
                  r="15"
                  fill={
                    appTheme === "dark"
                      ? "rgba(147,197,253,0.1)"
                      : "rgba(59,130,246,0.1)"
                  }
                />
              </g>
            </g>
          </svg>
        </div>
      )}
      <div
        id="graph-background-layer"
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundColor:
            nodeTheme === "seed"
              ? appTheme === "dark"
                ? "#1c2419"
                : "#f8f9f4"
              : nodeTheme === "hydrogen"
                ? appTheme === "dark"
                  ? "#0f172a"
                  : "#eef6fe"
                : nodeTheme === "ludo"
                  ? appTheme === "dark"
                    ? "#0f172a"
                    : "#fdfbf7"
                  : nodeTheme === "nature2" && appTheme !== "dark"
                    ? "#f4f7f0"
                    : nodeTheme === "chess"
                      ? "#0b101e"
                      : nodeTheme === "octopus"
                        ? "#050a1f"
                        : canvasBackgroundColor || "transparent",
          backgroundImage:
            nodeTheme === "seed"
              ? `radial-gradient(circle at 70% 30%, rgba(250, 240, 210, 0.4) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(120, 160, 110, 0.15) 0%, transparent 50%), radial-gradient(circle at 0% 100%, rgba(139, 105, 80, 0.2) 0%, transparent 60%)`
              : nodeTheme === "hydrogen"
                ? `radial-gradient(circle at 10% 20%, rgba(99, 179, 237, 0.15) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(99, 179, 237, 0.1) 0%, transparent 40%), radial-gradient(circle at 50% 50%, transparent 49%, rgba(99, 179, 237, 0.05) 50%, transparent 51%), radial-gradient(circle at 50% 50%, transparent 69%, rgba(99, 179, 237, 0.03) 70%, transparent 71%)`
                : nodeTheme === "ludo"
                  ? `linear-gradient(${appTheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} 2px, transparent 2px), linear-gradient(90deg, ${appTheme === "dark" ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"} 2px, transparent 2px), radial-gradient(circle at 0% 0%, rgba(239, 68, 68, 0.15) 0%, transparent 50%), radial-gradient(circle at 100% 0%, rgba(34, 197, 94, 0.15) 0%, transparent 50%), radial-gradient(circle at 100% 100%, rgba(234, 179, 8, 0.15) 0%, transparent 50%), radial-gradient(circle at 0% 100%, rgba(59, 130, 246, 0.15) 0%, transparent 50%)`
                  : nodeTheme === "nature2" && appTheme !== "dark"
                    ? `radial-gradient(circle at 20% 0%, rgba(200, 220, 190, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 100%, rgba(180, 200, 160, 0.3) 0%, transparent 50%)`
                    : nodeTheme === "chess"
                      ? `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`
                      : nodeTheme === "octopus"
                        ? `radial-gradient(circle at 30% 20%, rgba(10,30,80,0.9) 0%, rgba(4,8,25,1) 70%)`
                        : canvasBackgroundImage
                          ? `url(${canvasBackgroundImage})`
                          : "none",
          backgroundSize:
            nodeTheme === "ludo"
              ? "80px 80px, 80px 80px, 100% 100%, 100% 100%, 100% 100%, 100% 100%"
              : nodeTheme === "chess"
                ? "100px 100px"
                : nodeTheme === "hydrogen"
                  ? "100% 100%, 100% 100%, 400px 400px, 600px 600px"
                  : "cover",
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

          <linearGradient
            id="abstract-gradient"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#d946ef" />
            <stop offset="100%" stopColor="#f43f5e" />
          </linearGradient>
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

          <g className="edges-layer" style={{ zIndex: 0 }}>
            {links
              .filter((link) => {
                if (!link || !link.source?.data?.id || !link.target?.data?.id) return false;
                return !selectedPathEdges.has(`${link.source.data.id}->${link.target.data.id}`);
              })
              .map((link) => {
                const isMatchPath = !!searchQuery && (searchMatches.has(link.target.data.id) || searchAncestors.has(link.target.data.id));
                const isSelectedEdge = false;
                const isDimmedPath = !!searchQuery && !isMatchPath;

                const d = getEdgePath(link.source as any, link.target as any, edgeStyle, layoutMode);
                return (
                  <EdgeRenderer
                    key={`link-${link.source.data.id}-${link.target.data.id}`}
                    d={d}
                    style={edgeStyle}
                    nodeTheme={nodeTheme}
                    isHighlighted={isMatchPath}
                    isDimmed={isDimmedPath}
                    isSelected={isSelectedEdge}
                    source={link.source as any}
                    target={link.target as any}
                    layoutMode={layoutMode}
                    targetData={link.target.data}
                  />
                );
              })}
          </g>

          <g className="nodes-layer" style={{ zIndex: 10 }}>
            {nodes
              .filter((node) => !selectedPathNodes.has(node.data.id) && selectedNodeId !== node.data.id)
              .map((node) => {
                return (
                  <NodeRenderer
                    key={`node-${node.data.id}`}
                    node={node}
                    layoutMode={layoutMode}
                    isSelectedPath={false}
                    isSelected={false}
                    isIsolatedMode={isolatedNodeId !== null}
                    onContextMenu={(e, treeNode) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, node: treeNode });
                    }}
                  />
                );
              })}
          </g>

          <g className="selected-edges-layer" style={{ zIndex: 15 }}>
            {links
              .filter((link) => {
                if (!link || !link.source?.data?.id || !link.target?.data?.id) return false;
                return selectedPathEdges.has(`${link.source.data.id}->${link.target.data.id}`);
              })
              .map((link) => {
                const isMatchPath = !!searchQuery && (searchMatches.has(link.target.data.id) || searchAncestors.has(link.target.data.id));
                const isSelectedEdge = true;
                const isDimmedPath = !!searchQuery && !isMatchPath;

                const d = getEdgePath(link.source as any, link.target as any, edgeStyle, layoutMode);
                return (
                  <EdgeRenderer
                    key={`link-selected-${link.source.data.id}-${link.target.data.id}`}
                    d={d}
                    style={edgeStyle}
                    nodeTheme={nodeTheme}
                    isHighlighted={isMatchPath}
                    isDimmed={isDimmedPath}
                    isSelected={isSelectedEdge}
                    source={link.source as any}
                    target={link.target as any}
                    layoutMode={layoutMode}
                    targetData={link.target.data}
                  />
                );
              })}
          </g>

          <g className="selected-nodes-layer" style={{ zIndex: 20 }}>
            {nodes
              .filter((node) => selectedPathNodes.has(node.data.id) || selectedNodeId === node.data.id)
              .map((node) => {
                return (
                  <NodeRenderer
                    key={`node-selected-${node.data.id}`}
                    node={node}
                    layoutMode={layoutMode}
                    isSelectedPath={selectedPathNodes.has(node.data.id)}
                    isSelected={selectedNodeId === node.data.id}
                    isIsolatedMode={isolatedNodeId !== null}
                    onContextMenu={(e, treeNode) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ x: e.clientX, y: e.clientY, node: treeNode });
                    }}
                  />
                );
              })}
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
                onClose={() => setInlineApiEditor(null)}
              />
            )}
          </g>
        </g>
      </svg>

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-600 font-mono text-sm pointer-events-none">
          Awaiting input...
        </div>
      )}

      {/* Floating Search & Settings */}
      <NodeQueryEngine />

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
            className={`fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 ${appTheme}`}
          >
            <div
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setTableViewData(null)}
            />
            <div
              className="relative w-full max-w-6xl max-h-[85vh] h-full bg-slate-50 dark:bg-slate-900 rounded-xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                  <TableProperties className="text-blue-500" size={20} />
                  Table View: {tableViewData.title}
                </h2>
                <button
                  onClick={() => setTableViewData(null)}
                  className="text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 p-4 bg-slate-50 dark:bg-slate-900 overflow-hidden">
                <TableView
                  data={tableViewData.data}
                  title={tableViewData.title}
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
