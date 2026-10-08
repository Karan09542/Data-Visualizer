import { formatFileSize } from "../lib/formatFileSize";
import React, { useEffect, useLayoutEffect, useRef } from "react";
import * as d3 from "d3";
import { HierarchyPointNode } from "d3";
import { TreeNode } from "../utils/transformer";
import { useStore, NodeTheme } from "../store/useStore";
import { PALETTE_THEMES } from "../constants/visualizer";
import { db } from "../lib/db";
import { liveQuery } from "dexie";
import {
  ChevronRight,
  ChevronDown,
  Type,
  Hash,
  Braces,
  AlignLeft,
  ToggleLeft,
  HelpCircle,
  MoreVertical,
  Maximize2,
  Minimize2,
  Eye,
  FileText,
  Sprout,
  TreeDeciduous,
  Wheat,
  Leaf,
  Flower2,
  Clover,
  Bean,
  TreePine,
  Trees,
  Sun,
  Droplet,
  Feather,
  FolderTree,
  ListTree,
  CircleDashed,
} from "lucide-react";
import SmartMediaRenderer from "./SmartMediaRenderer";
import { SmartFallbackMedia } from "./SmartFallbackMedia";
import { ApiNodeRenderer } from "./ApiNodeRenderer";
import { ApiResponseNodeRenderer } from "./ApiResponseNodeRenderer";
import { JsNodeRenderer } from "./JsNodeRenderer";
import { JsNodeCodeRenderer } from "./JsNodeCodeRenderer";
import { JsNodeTerminalRenderer } from "./JsNodeTerminalRenderer";
import { TsNodeRenderer } from "./TsNodeRenderer";
import { TsNodeCodeRenderer } from "./TsNodeCodeRenderer";
import { TsNodeTerminalRenderer } from "./TsNodeTerminalRenderer";
import { PyNodeRenderer } from "./PyNodeRenderer";
import { PyNodeCodeRenderer } from "./PyNodeCodeRenderer";
import { PyNodeTerminalRenderer } from "./PyNodeTerminalRenderer";
import { MathNodeRenderer } from "./MathNodeRenderer";
import { TransferNodeRenderer } from "./TransferNodeRenderer";
import { TodoNodeRenderer } from "./TodoNodeRenderer";
import { NodeOptionsMenu } from "./NodeOptionsMenu";

import { SafeModelViewer } from "./SafeModelViewer";

const MemoApiNodeRenderer = React.memo(ApiNodeRenderer);
const MemoApiResponseNodeRenderer = React.memo(ApiResponseNodeRenderer);
const MemoJsNodeRenderer = React.memo(JsNodeRenderer);
const MemoJsNodeCodeRenderer = React.memo(JsNodeCodeRenderer);
const MemoJsNodeTerminalRenderer = React.memo(JsNodeTerminalRenderer);
const MemoTsNodeRenderer = React.memo(TsNodeRenderer);
const MemoTsNodeCodeRenderer = React.memo(TsNodeCodeRenderer);
const MemoTsNodeTerminalRenderer = React.memo(TsNodeTerminalRenderer);
const MemoPyNodeRenderer = React.memo(PyNodeRenderer);
const MemoPyNodeCodeRenderer = React.memo(PyNodeCodeRenderer);
const MemoPyNodeTerminalRenderer = React.memo(PyNodeTerminalRenderer);
const MemoMathNodeRenderer = React.memo(MathNodeRenderer);
const MemoTransferNodeRenderer = React.memo(TransferNodeRenderer);
const MemoTodoNodeRenderer = React.memo(TodoNodeRenderer);

interface NodeProps {
  key?: React.Key;
  node: HierarchyPointNode<TreeNode>;
  layoutMode: string;
  isSelectedPath?: boolean;
  isSelected?: boolean;
  isIsolatedMode?: boolean;
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
}

export const getMediaType = (val: string) => {
  if (!val || typeof val !== "string") return null;
  val = val.trim();

  const isDataOrBlob = val.startsWith("data:") || val.startsWith("blob:");
  if (val.length > 5000 && !isDataOrBlob) {
    return null; // A standard URL or filename will never be this long. Avoid catastrophic regex backtracking on massive text nodes.
  }

  // Fast path for data/blob urls to avoid regex matching the end of massive strings
  if (isDataOrBlob) {
    if (val.startsWith("data:application/pdf") || (val.startsWith("blob:http") && val.includes("pdf"))) return "pdf";
    if (val.startsWith("data:image/") || (val.startsWith("blob:http") && val.includes("image"))) return "image";
    if (val.startsWith("data:audio/") || (val.startsWith("blob:http") && val.includes("audio"))) return "audio";
    if (val.startsWith("data:video/") || (val.startsWith("blob:http") && val.includes("video"))) return "video";
    if ((val.startsWith("blob:http") && (val.includes("model") || val.includes("3d-model")))) return "3d-model";
    return null;
  }

  if (val.match(/\.pdf(\?.*)?$/i))
    return "pdf";
  if (
    val.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i) ||
    val.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp|svg|bmp)/i)
  )
    return "image";
  if (
    val.match(/\.(mp3|wav|ogg|aac|flac|m4a)(\?.*)?$/i) ||
    val.match(/^https?:\/\/.*\.(mp3|wav|ogg|aac|flac|m4a)/i)
  )
    return "audio";
  if (
    val.match(/\.(mp4|webm|ogv|mov|mkv)(\?.*)?$/i) ||
    val.match(/^https?:\/\/.*\.(mp4|webm|ogv|mov|mkv)/i)
  )
    return "video";
  if (
    val.match(/\.(glb|gltf|obj)(\?.*)?$/i) ||
    val.match(/^https?:\/\/.*\.(glb|gltf|obj)/i) ||
    val.startsWith("model/")
  )
    return "3d-model";

  if (val.startsWith("img_") || val.startsWith("thumb_")) {
    const hasExtension = val.match(/\.[a-zA-Z0-9]+$/);
    if (!hasExtension) {
      return "image"; // Legacy fallback for IDs without extensions
    }
    return null; // Don't blindly assume 'image' if it has a non-image extension (like .csv, .txt)
  }

  // Use inspector for youtube, vimoe, spotfiy, or any http url
  // Just treat any http/https link as potential smart media if we didn't natively catch it
  if (val.startsWith("http://") || val.startsWith("https://")) {
    if (val.includes("{") || val.includes("}")) return null;
    return "smart";
  }
  return null;
};

function NodeRenderer({
  node,
  layoutMode,
  isSelectedPath,
  isSelected,
  isIsolatedMode,
  onContextMenu,
}: NodeProps) {
  const nodeTheme = useStore((state) => state.nodeTheme);
  const nodeShape = useStore((state) => state.nodeShape);
  const nodeSize = useStore((state) => state.nodeSize);
  const nodeColor = useStore((state) => state.nodeColor);
  const nodeTextColor = useStore((state) => state.nodeTextColor);
  const nodeGradientColor1 = useStore((state) => state.nodeGradientColor1);
  const nodeGradientColor2 = useStore((state) => state.nodeGradientColor2);
  const useNodeGradient = useStore((state) => state.useNodeGradient);
  const nodeGradientAngle = useStore((state) => state.nodeGradientAngle);
  const nodeGradientType = useStore((state) => state.nodeGradientType);
  const toggleNodeCollapse = useStore((state) => state.toggleNodeCollapse);
  const collapsedNodes = useStore((state) => state.collapsedNodes);
  const searchQuery = useStore((state) => state.searchQuery);
  const searchMatches = useStore((state) => state.searchMatches);
  const searchAncestors = useStore((state) => state.searchAncestors);
  const activeMatchId = useStore((state) => state.activeMatchId);
  const setSelectedNodeId = useStore((state) => state.setSelectedNodeId);
  const showMediaPreview = useStore((state) => state.showMediaPreview);
  const manuallyRenderedNodes = useStore(
    (state) => state.manuallyRenderedNodes,
  );
  const globalTextExpanded = useStore((state) => state.globalTextExpanded);
  const setActivePreviewText = useStore((state) => state.setActivePreviewText);
  const setActivePreviewMedia = useStore(
    (state) => state.setActivePreviewMedia,
  );
  const appTheme = useStore((state) => state.appTheme);
  const knownDataUrls = useStore((state) => state.knownDataUrls);
  const nodeSizes = useStore((state) => state.nodeSizes);

  const foreignRef = useRef<SVGForeignObjectElement>(null);
  const mediaContainerRef = useRef<HTMLDivElement>(null);

  const nodeRef = useRef(node);
  nodeRef.current = node;

  const [isDraggingLocally, setIsDraggingLocally] = React.useState(false);
  const isBeingDragged = useStore((state) => state.draggingNodeIds.has(node.data.id));

  /**
   * A node is placed by its centre, so growing it pushes every edge outward, including the one
   * the pointer is dragging. The browser measures a native resize from the element's left edge,
   * so that edge sliding away makes the resize chase itself and the node appears to wander.
   * Moving the centre by half the growth keeps the top-left corner still and the corner being
   * dragged under the pointer.
   *
   * It runs as a layout effect: done after paint, the browser shows the shifted position for a
   * frame and then the corrected one, which reads as the node vibrating while it is resized.
   */
  const [isResizing, setIsResizing] = React.useState(false);
  const lastSizeRef = useRef<{ width: number; height: number; custom: boolean } | null>(null);
  const resizeSettleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Set during render below: the size this node has when nobody has resized it.
  const defaultSizeRef = useRef<{ width: number; height: number } | null>(null);

  useLayoutEffect(() => {
    const custom = nodeSizes[node.data.id];
    // The first resize starts from the default size. Without it there was nothing to
    // compare against, so the first resize of a node kept its centre and it jumped.
    const size = custom ?? defaultSizeRef.current;
    // A default-sized node may have changed its default since (expanded, collapsed),
    // so the size it had just before this resize is its default right now.
    const previous =
      lastSizeRef.current && !lastSizeRef.current.custom && defaultSizeRef.current
        ? { ...defaultSizeRef.current, custom: false }
        : lastSizeRef.current;
    lastSizeRef.current = size ? { width: size.width, height: size.height, custom: !!custom } : null;
    if (!size || !previous) return;
    // Only a resize moves the corner; a node changing its own default size (expanding)
    // keeps the old behaviour.
    if (!custom && !previous.custom) return;

    const dx = (size.width - previous.width) / 2;
    const dy = (size.height - previous.height) / 2;
    if (dx === 0 && dy === 0) return;

    const store = useStore.getState();
    const current = store.dragOverrides[node.data.id] ?? {
      x: nodeRef.current.x,
      y: nodeRef.current.y,
    };
    store.setMultipleDragOverrides({
      [node.data.id]: { x: current.x + dx, y: current.y + dy },
    });

    // The move must not be eased while resizing, or it lags behind the pointer
    setIsResizing(true);
    if (resizeSettleRef.current) clearTimeout(resizeSettleRef.current);
    resizeSettleRef.current = setTimeout(() => setIsResizing(false), 200);
  }, [nodeSizes, node.data.id]);

  useEffect(() => () => {
    if (resizeSettleRef.current) clearTimeout(resizeSettleRef.current);
  }, []);

  useEffect(() => {
    if (!foreignRef.current) return;

    let animationFrameId: number;
    let dragPosUpdates: Record<string, { x: number; y: number } | null> = {};

    const dispatchDrag = () => {
      useStore.getState().setMultipleDragOverrides(dragPosUpdates);
    };

    let startPositions: Array<{ id: string; startX: number; startY: number }> =
      [];

    const drag = d3
      .drag<SVGForeignObjectElement, unknown>()
      .filter((event) => {
        const target = event.target as Element;
        if (target?.closest?.(".drag-handle")) {
          return !event.ctrlKey && !event.button;
        }
        return !event.ctrlKey && !event.button && !target?.closest?.(".nodrag");
      })
      .subject(function () {
        const store = useStore.getState();
        const pos = store.dragOverrides[nodeRef.current.data.id] || {
          x: nodeRef.current.x,
          y: nodeRef.current.y,
        };
        return { x: pos.x, y: pos.y };
      })
      .on("start", function (event) {
        event.sourceEvent?.stopPropagation();
        useStore.getState().bringNodeToFront(nodeRef.current.data.id);
        setIsDraggingLocally(true);

        const store = useStore.getState();
        startPositions = [];

        // Add the current node
        const currentId = nodeRef.current.data.id;
        const currentPos = store.dragOverrides[currentId] || {
          x: nodeRef.current.x,
          y: nodeRef.current.y,
        };
        startPositions.push({
          id: currentId,
          startX: currentPos.x,
          startY: currentPos.y,
        });

        // If shift is held, select descendants
        if (event.sourceEvent?.shiftKey) {
          const descendants = nodeRef.current.descendants().slice(1);
          for (const desc of descendants) {
            const id = desc.data.id;
            const pos = store.dragOverrides[id] || { x: desc.x, y: desc.y };
            startPositions.push({ id, startX: pos.x, startY: pos.y });
          }
        } else {
          const isCurrentApiNode =
            nodeRef.current.data.type === "string" &&
            nodeRef.current.data.name &&
            String(nodeRef.current.data.name).endsWith("_api_node");
          if (isCurrentApiNode) {
            const descendants = nodeRef.current.descendants().slice(1);
            for (const desc of descendants) {
              if (desc.data.type === "api_response" || desc.data.id.endsWith(".__response")) {
                const id = desc.data.id;
                const pos = store.dragOverrides[id] || { x: desc.x, y: desc.y };
                const correctedX = pos.x > currentPos.x ? pos.x : currentPos.x + 460;
                const correctedY = pos.x > currentPos.x ? pos.y : currentPos.y;
                startPositions.push({ id, startX: correctedX, startY: correctedY });
              }
            }
          }
        }

        // Apply immediately
        dragPosUpdates = {};
        for (const sp of startPositions) {
          dragPosUpdates[sp.id] = { x: sp.startX, y: sp.startY };
        }

        dragPosUpdates[currentId] = { x: event.x, y: event.y };
        useStore.getState().setMultipleDragOverrides(dragPosUpdates);

        // Track all dragged node IDs so their transitions are disabled
        useStore.getState().setDraggingNodeIds(new Set(startPositions.map(sp => sp.id)));
      })
      .on("drag", function (event) {
        const headNode = startPositions[0];
        const dx = event.x - headNode.startX;
        const dy = event.y - headNode.startY;

        dragPosUpdates = {};
        for (const sp of startPositions) {
          dragPosUpdates[sp.id] = { x: sp.startX + dx, y: sp.startY + dy };
        }

        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animationFrameId = requestAnimationFrame(dispatchDrag);
      })
      .on("end", function (event) {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        const headNode = startPositions[0];
        const dx = event.x - headNode.startX;
        const dy = event.y - headNode.startY;

        dragPosUpdates = {};
        for (const sp of startPositions) {
          dragPosUpdates[sp.id] = { x: sp.startX + dx, y: sp.startY + dy };
        }
        useStore.getState().setMultipleDragOverrides(dragPosUpdates);
        useStore.getState().setDraggingNodeIds(new Set());
        setIsDraggingLocally(false);
      });

    d3.select(foreignRef.current).call(drag);
  }, []);

  const [smartMediaFailed, setSmartMediaFailed] = React.useState(false);
  const handleSmartMediaFailed = React.useCallback(() => {
    setSmartMediaFailed(true);
  }, []);
  const [isExpanded, setIsExpanded] = React.useState(globalTextExpanded);

  // Synchronize local state with global master toggle
  React.useEffect(() => {
    setIsExpanded(globalTextExpanded);
  }, [globalTextExpanded]);

  const data = node.data;
  const isCollapsed = collapsedNodes.has(data.id);
  const hasChildren = !!data.children && data.children.length > 0;

  const hasQuery = !!searchQuery;
  const isMatch = searchMatches.has(data.id);
  const isActiveMatch = activeMatchId === data.id;
  const isAncestor = searchAncestors.has(data.id);
  const isDimmed =
    (hasQuery && !isMatch && !isAncestor) ||
    (!hasQuery &&
      !isSelected &&
      !isSelectedPath &&
      isIsolatedMode);

  const strVal = data.value !== undefined ? String(data.value) : "";

  const actualAssetId =
    data.rawValue && typeof data.rawValue === "object"
      ? data.rawValue.assetId ||
      data.rawValue.assetRef ||
      (data.rawValue._type === "media" ? data.rawValue.assetId : null)
      : typeof data.value === "string" &&
        (data.value.startsWith("img_") || data.value.startsWith("thumb_"))
        ? data.value
        : null;

  const [assetDetails, setAssetDetails] = React.useState<any>(null);

  React.useEffect(() => {
    if (!actualAssetId) {
      setAssetDetails(null);
      return;
    }

    let active = true;
    const subscription = liveQuery(async () => {
      let id = actualAssetId;
      if (id.startsWith("thumb_")) {
        const original = await db.assets
          .where("thumbnailId")
          .equals(id)
          .first();
        if (original) return original;
      }
      return await db.assets.get(id);
    }).subscribe({
      next: (result) => {
        if (!active) return;
        setTimeout(() => {
          if (active) setAssetDetails(result);
        }, 0);
      },
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [actualAssetId]);

  const isApiNode =
    data.type === "string" &&
    data.name &&
    String(data.name).endsWith("_api_node");
  // Fetched API response shown as a single file-style node
  const isApiResponse = data.type === "api_response";
  const isJsNode =
    data.type === "string" &&
    data.name &&
    String(data.name).endsWith("_js_node");
  const isJsCode = data.type === "js_code";
  const isJsTerminal = data.type === "js_terminal";

  const isTsNode =
    data.type === "string" &&
    data.name &&
    String(data.name).endsWith("_ts_node");
  const isTsCode = data.type === "ts_code";
  const isTsTerminal = data.type === "ts_terminal";

  const isPyNode =
    data.type === "string" &&
    data.name &&
    String(data.name).endsWith("_py_node");

  const isPyCode = data.type === "py_code";
  const isPyTerminal = data.type === "py_terminal";

  const isTodoNode =
    typeof data.name === "string" &&
    (data.name.endsWith("_todo_node") || data.name.endsWith(".todo"));
  const isTransferNode =
    typeof data.name === "string" &&
    (data.name.endsWith("_transfer_node") || data.name.endsWith(".transfer"));
  const isMathNode =
    typeof data.name === "string" &&
    (data.name.endsWith("_math_node") ||
      data.name.endsWith(".math") ||
      data.name.toLowerCase().endsWith("graph") ||
      data.name.toLowerCase().endsWith("math"));

  const isSpecialNode =
    isApiNode ||
    isApiResponse ||
    isJsCode ||
    isJsTerminal ||
    isTsCode ||
    isTsTerminal ||
    isJsNode ||
    isTsNode ||
    isPyCode ||
    isPyTerminal ||
    isPyNode ||
    isTodoNode ||
    isTransferNode ||
    isMathNode;
  const isManuallyRendered =
    manuallyRenderedNodes && manuallyRenderedNodes[data.id] !== undefined
      ? manuallyRenderedNodes[data.id]
      : showMediaPreview;
  const isKnownDataUrl = strVal.length < 5000 && !!knownDataUrls[strVal];

  const assetMimeType = assetDetails?.mimeType?.toLowerCase() || "";
  const assetName =
    typeof data.rawValue === "object" &&
      (data.rawValue?.name || data.rawValue?.filename || data.rawValue?.url)
      ? String(
        data.rawValue.name || data.rawValue.filename || data.rawValue.url,
      ).toLowerCase()
      : "";
  const fallbackStrVal =
    actualAssetId && (assetName || assetDetails?.filename)
      ? assetName || assetDetails?.filename
      : strVal;

  const mediaTypeByAsset = assetMimeType.startsWith("image/")
    ? "image"
    : assetMimeType.startsWith("video/")
      ? "video"
      : assetMimeType.startsWith("audio/")
        ? "audio"
        : assetMimeType.startsWith("application/pdf") || assetMimeType === "pdf"
          ? "pdf"
          : assetMimeType.startsWith("model/")
            ? "3d-model"
            : null;

  const resolvedMediaType =
    mediaTypeByAsset ||
    getMediaType(fallbackStrVal as string) ||
    getMediaType(strVal);

  const mediaType =
    isManuallyRendered &&
      data.type === "string" &&
      !smartMediaFailed &&
      !isApiNode &&
      !isJsNode &&
      !isTsNode &&
      !isKnownDataUrl
      ? resolvedMediaType
      : null;
  const isMedia = !!mediaType;

  const mediaSrc =
    resolvedMediaType === "image"
      ? assetDetails?.thumbnailId || actualAssetId || strVal
      : actualAssetId || strVal;

  useEffect(() => {
    const el = mediaContainerRef.current;
    if (!el) return;

    const stopPropagation = (e: Event) => {
      e.stopPropagation();
    };

    const events = [
      "mousedown",
      "mousemove",
      "mouseup",
      "pointerdown",
      "pointermove",
      "pointerup",
      "touchstart",
      "touchmove",
      "touchend",
      "wheel",
    ];

    events.forEach((event) => {
      el.addEventListener(event, stopPropagation, { capture: false });
    });

    return () => {
      events.forEach((event) => {
        el.removeEventListener(event, stopPropagation, { capture: false });
      });
    };
  }, [mediaType]);

  // reset smartMediaFailed if value changes
  React.useEffect(() => {
    setSmartMediaFailed(false);
  }, [strVal]);

  const getThemeClasses = (theme: NodeTheme) => {
    switch (theme) {
      // VS Code Dark+ / Light+: editor panels in the editor font, keys in the JSON key colour and
      // values coloured like syntax highlighting (see valText).
      case "vscode":
        return appTheme === "dark"
          ? "bg-[#252526] border-[#3c3c3c] text-[#9cdcfe] shadow-[0_4px_12px_-8px_rgba(0,0,0,0.8)] font-mono"
          : "bg-white border-[#e5e5e5] text-[#0451a5] shadow-[0_2px_8px_-6px_rgba(0,0,0,0.2)] font-mono";
      case "github":
        return appTheme === "dark"
          ? "bg-[#0d1117] border-[#30363d] text-[#c9d1d9] shadow-sm"
          : "bg-[#ffffff] border-[#d1d9e0] text-[#1f2328] shadow-sm";
      // Editor palettes, each with its own dark and light variant, and a calm neutral and paper look.
      // Nord: Polar Night / Snow Storm cards, Frost and Aurora accents on the type badges.
      case "nord":
        return appTheme === "dark"
          ? "bg-[#2e3440] border-[#3b4252] text-[#eceff4] shadow-[0_6px_16px_-10px_rgba(0,0,0,0.6)]"
          : "bg-[#f8f9fb] border-[#d8dee9] text-[#2e3440] shadow-[0_4px_14px_-10px_rgba(46,52,64,0.3)]";
      // Dracula / Alucard, with the purple accent as a left bar.
      case "dracula":
        return appTheme === "dark"
          ? "bg-[#282a36] border-[#44475a] border-l-4 border-l-[#bd93f9] text-[#f8f8f2] shadow-[0_4px_14px_rgba(189,147,249,0.12)]"
          : "bg-[#fffbeb] border-[#e2dfd0] border-l-4 border-l-[#644ac9] text-[#1f1f1f] shadow-sm";
      // Solarized dark / light.
      case "solarized":
        return appTheme === "dark"
          ? "bg-[#002b36] border-[#0b4352] text-[#c5d2d2] shadow-md"
          : "bg-[#fdf6e3] border-[#e8dfc4] text-[#3d4f55] shadow-sm";
      // Catppuccin Mocha / Latte.
      case "catppuccin":
        return appTheme === "dark"
          ? "bg-[#1e1e2e] border-[#45475a] text-[#cdd6f4] shadow-md"
          : "bg-[#eff1f5] border-[#ccd0da] text-[#4c4f69] shadow-sm";
      // Tokyo Night / Tokyo Night Day.
      case "tokyo-night":
        return appTheme === "dark"
          ? "bg-[#1a1b26] border-[#2f334d] text-[#c0caf5] shadow-md"
          : "bg-[#e9e9ed] border-[#c4c8da] text-[#343b58] shadow-sm";
      // Rosé Pine Moon / Dawn.
      case "rose-pine":
        return appTheme === "dark"
          ? "bg-[#232136] border-[#44415a] text-[#e0def4] shadow-md"
          : "bg-[#fffaf3] border-[#efe4d9] text-[#575279] shadow-sm";
      // Neutral zinc with a hairline border, like Linear or Vercel: quiet and professional.
      case "graphite":
        return appTheme === "dark"
          ? "bg-[#18181b] border-white/10 text-zinc-200 shadow-[0_1px_2px_rgba(0,0,0,0.4)]"
          : "bg-white border-zinc-200 text-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.06)]";
      // Editorial print: serif type, sharp corners, an ink rule across the top, stacked-paper shadow.
      case "paper":
        return appTheme === "dark"
          ? "bg-[#262624] border-[#3a3935] border-t-2 border-t-[#d8d4c8] text-[#ecebe6] shadow-[0_1px_0_rgba(255,255,255,0.03),0_8px_18px_-12px_rgba(0,0,0,0.8)] font-serif"
          : "bg-[#fffefb] border-[#e6e3db] border-t-2 border-t-[#2b2a27] text-[#2b2a27] shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_16px_-12px_rgba(60,50,30,0.35)] font-serif";
      // Quiet, document-like cards in the style of Notion or Linear: hairline borders, no colour.
      case "minimal":
        return appTheme === "dark"
          ? "bg-[#191919] border-white/[0.08] text-[#e6e6e6] shadow-none"
          : "bg-white border-[#e9e9e7] text-[#37352f] shadow-[0_1px_2px_rgba(0,0,0,0.04)]";
      // The root is a vivid indigo→violet→pink fill; the rest are clean cards with a thin gradient
      // border (both drawn by .gradient-root / .gradient-card, which follow the app theme).
      case "gradient":
        return data.id === "root"
          ? "gradient-root text-white"
          : appTheme === "dark"
            ? "gradient-card text-[#ececf4] shadow-[0_8px_24px_-14px_rgba(139,92,246,0.55)]"
            : "gradient-card text-[#1e1b3a] shadow-[0_6px_18px_-12px_rgba(139,92,246,0.4)]";
      // A modern terminal pane: neutral card, green top rule, green output text.
      // Dark: charcoal like the VS Code / GitHub terminals. Light: pale grey with GitHub's green.
      case "terminal":
        return appTheme === "dark"
          ? "bg-[#0d1117] border-[#30363d] border-t-2 border-t-[#3fb950] text-[#e6edf3] shadow-[0_6px_16px_-10px_rgba(0,0,0,0.8)] font-mono"
          : "bg-[#f6f8fa] border-[#d0d7de] border-t-2 border-t-[#1a7f37] text-[#1f2328] shadow-[0_4px_12px_-8px_rgba(31,35,40,0.25)] font-mono";
      // 80s retro. Dark: deep purple card, orange border, hard pink offset shadow.
      // Light: cream card, purple border, hard orange offset shadow. (Was purple text on orange: low contrast.)
      case "retro":
        return appTheme === "dark"
          ? "bg-[#1b1433] border-[#ff9e3d] text-[#ffd9a8] shadow-[4px_4px_0_#ff5fa2]"
          : "bg-[#fff3dc] border-[#7b3fe4] text-[#3b1f73] shadow-[4px_4px_0_#ff8a3d]";
      // Nature: a deep forest-green root with a thin sand-to-moss rim, and clean cards with a green
      // accent bar. Dark: moss cards on a green-black canvas. Light: white cards on pale sage.
      case "nature":
        if (data.id === "root") {
          return nodeShape === "default"
            ? "nature-root text-[#f2f7ec]"
            : "bg-gradient-to-br from-[#3c6a45] to-[#284a30] border-2 border-[#c9a46b]/60 text-[#f2f7ec] shadow-lg";
        }
        return appTheme === "dark"
          ? "bg-[#141d17] border-[#27382c] border-l-[3px] border-l-[#6f9a5c] text-[#dde9d6] shadow-[0_6px_16px_-10px_rgba(0,0,0,0.7)]"
          : "bg-white border-[#dbe6d4] border-l-[3px] border-l-[#5f8f4e] text-[#1f3322] shadow-[0_4px_14px_-8px_rgba(50,80,45,0.3)]";
      case "seed":
        if (data.id === "root") {
          return appTheme === "dark"
            ? "bg-gradient-to-br from-[#3d6b43] to-[#2a4d31] border-[#5b8a5f]/40 text-[#f4f8ee] shadow-[0_10px_28px_-8px_rgba(10,25,14,0.9)]"
            : "bg-gradient-to-br from-[#4a7c50] to-[#365f3c] border-[#2f5535]/30 text-white shadow-[0_10px_24px_-10px_rgba(54,95,60,0.6)]";
        }
        return appTheme === "dark"
          ? "bg-[#17241b] border-[#2d4433] text-[#e1ebd9] shadow-[0_4px_14px_-6px_rgba(0,0,0,0.6)]"
          : "bg-white border-[#dbe5d0] text-[#22351d] shadow-[0_4px_14px_-8px_rgba(60,90,50,0.35)]";
      // Frosted glass over the coloured glows on the canvas, with a light inner top edge.
      case "glass":
        return appTheme === "dark"
          ? "bg-white/[0.06] border-white/15 text-white/90 backdrop-blur-xl shadow-[0_8px_32px_-12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)]"
          : "bg-white/70 border-white text-slate-800 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-slate-900/[0.06]";
      // A clean card with a blue rule, on graph paper (drawn on the canvas, not in every node).
      case "math":
        return appTheme === "dark"
          ? "bg-[#0f1729] border-[#23324d] border-l-[#60a5fa] text-[#e2e8f0] shadow-[0_6px_18px_-10px_rgba(0,0,0,0.7)] font-serif"
          : "bg-white border-[#cfdcee] border-l-[#2563eb] text-[#0f172a] shadow-[0_4px_14px_-8px_rgba(37,99,235,0.25)] font-serif";
      // Walnut: warm wood-toned cards with a bark-brown accent bar and hierarchy icons.
      case "tree":
        return appTheme === "dark"
          ? "bg-[#1f1a15] border-[#3b3127] border-l-[3px] border-l-[#a07a52] text-[#efe6da] shadow-[0_8px_20px_-12px_rgba(0,0,0,0.8)]"
          : "bg-[#fffaf3] border-[#e8dccb] border-l-[3px] border-l-[#8b5e34] text-[#3b2f22] shadow-[0_6px_16px_-12px_rgba(110,80,45,0.35)]";
      // A heads-up display: targeting-bracket corners and a faint scan line (both drawn by .hacker-node).
      case "hacker":
        return appTheme === "dark"
          ? "hacker-node border-[#00ff41]/20 text-[#d7ffe1] shadow-[0_0_24px_-8px_rgba(0,255,65,0.25)] font-mono"
          : "hacker-node border-[#0a8f3c]/25 text-[#0b2e18] shadow-[0_4px_14px_-8px_rgba(10,143,60,0.3)] font-mono";
      // Deep sea: calm cards with a teal line along the bottom like a waterline.
      case "ocean":
        return appTheme === "dark"
          ? "bg-[#0a1f2b] border-[#14455a] border-b-2 border-b-[#22a5c4] text-[#d6eef5] shadow-[0_10px_24px_-14px_rgba(0,0,0,0.8)]"
          : "bg-white border-[#c7e3ec] border-b-2 border-b-[#0e7490] text-[#0b3a4a] shadow-[0_6px_18px_-12px_rgba(14,116,144,0.35)]";
      // Obsidian (or parchment) inside a fine double gold frame: an outer border and an inset hairline.
      case "rune":
        return appTheme === "dark"
          ? "bg-[#14120f] border-[#c9a24a]/55 text-[#efe3c2] shadow-[inset_0_0_0_3px_#14120f,inset_0_0_0_4px_rgba(201,162,74,0.28),0_10px_24px_-14px_rgba(0,0,0,0.9)] font-serif tracking-wide"
          : "bg-[#fbf6e9] border-[#b8913f]/70 text-[#3d2f14] shadow-[inset_0_0_0_3px_#fbf6e9,inset_0_0_0_4px_rgba(160,120,40,0.28),0_8px_18px_-12px_rgba(120,90,30,0.35)] font-serif tracking-wide";
      // Calm and airy: soft borderless stone (or rice-paper) cards with generous space.
      case "zen":
        return appTheme === "dark"
          ? "bg-[#1c1b19] border-transparent text-[#e8e4dc] shadow-[0_10px_30px_-18px_rgba(0,0,0,0.9)]"
          : "bg-[#fdfcf9] border-transparent text-[#3a3631] shadow-[0_10px_30px_-18px_rgba(90,80,60,0.35)]";
      // A drafting sheet: fine border, a dashed offset line like a dimension guide, blueprint grid canvas.
      case "architect":
        return appTheme === "dark"
          ? "bg-[#0e1a2a] border-[#7da7d6]/45 text-[#dbe7f3] shadow-none font-mono"
          : "bg-white border-[#94a3b8] text-[#1e293b] shadow-none font-mono";
      // A page of ruled notebook paper: faint blue rules, a thin red margin, paper-sharp corners,
      // lying on a kraft-paper desk (the canvas). Dark: dim paper with soft rules.
      case "notebook":
        return appTheme === "dark"
          ? "bg-[#1d1b17] bg-[linear-gradient(transparent_19px,rgba(148,163,184,0.10)_20px)] bg-[length:100%_20px] border-[#36312a] border-l-2 border-l-[#b85450] text-[#ebe3d2] shadow-[0_1px_0_rgba(255,255,255,0.03),0_8px_18px_-10px_rgba(0,0,0,0.8)] font-serif"
          : "bg-[#fffdf7] bg-[linear-gradient(transparent_19px,rgba(59,91,146,0.13)_20px)] bg-[length:100%_20px] border-[#e8e0cc] border-l-2 border-l-[#e06666] text-[#33302a] shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_16px_-10px_rgba(110,90,50,0.35)] font-serif";
      case "chalk":
        return appTheme === "dark"
          ? "chalk-node bg-[#182220] border-2 border-dashed border-slate-300/80 text-slate-100 shadow-[0_4px_16px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
          : "chalk-node bg-[#1e2a27] border-2 border-dashed border-white/90 text-slate-100 shadow-[0_4px_20px_rgba(0,0,0,0.25)] ring-2 ring-slate-800/80";
      case "custom":
        if (useNodeGradient) {
          return "border-white/20 shadow-xl backdrop-blur-sm ring-1 ring-white/10";
        }
        return "border-white/10 shadow-lg backdrop-blur-sm ring-1 ring-white/5";
      default:
        return "bg-[#1e293b] border-[#334155] text-slate-200 shadow-sm";
    }
  };

  const getIcon = (type: string) => {
    if (nodeTheme === "seed") {
      const isRoot = data.id === "root";
      const SeedIcon = isRoot
        ? Sprout
        : type === "object"
          ? TreeDeciduous
          : type === "array"
            ? Wheat
            : type === "string"
              ? Leaf
              : type === "number"
                ? Flower2
                : type === "boolean"
                  ? Clover
                  : Bean;
      const tone = isRoot
        ? "bg-white/15 text-[#e4f1d6] ring-1 ring-white/20"
        : appTheme === "dark"
          ? "bg-[#243a29] text-[#a6cf8a]"
          : "bg-[#e8f1de] text-[#4d7a37]";
      const size = isRoot ? 26 : 22;
      return (
        <div className={`flex shrink-0 items-center justify-center rounded-full ${tone}`} style={{ width: size, height: size }}>
          <SeedIcon size={isRoot ? 15 : 13} strokeWidth={2} />
        </div>
      );
    }
    if (nodeTheme === "nature") {
      const isRoot = data.id === "root";
      const NatureIcon = isRoot
        ? TreePine
        : type === "object"
          ? TreeDeciduous
          : type === "array"
            ? Trees
            : type === "string"
              ? Leaf
              : type === "number"
                ? Sun
                : type === "boolean"
                  ? Droplet
                  : Feather;
      const tone = isRoot
        ? "bg-white/15 text-[#e6f0dc] ring-1 ring-white/20"
        : appTheme === "dark"
          ? "bg-[#203026] text-[#9cc58a]"
          : "bg-[#eaf2e4] text-[#4c7a3c]";
      const size = isRoot ? 26 : 22;
      return (
        <div className={`flex shrink-0 items-center justify-center rounded-full ${tone}`} style={{ width: size, height: size }}>
          <NatureIcon size={isRoot ? 15 : 13} strokeWidth={2} />
        </div>
      );
    }
    if (nodeTheme === "minimal" || nodeTheme === "gradient" || nodeTheme === "ocean") {
      const TypeIcon =
        type === "object" ? Braces : type === "array" ? AlignLeft : type === "string" ? Type : type === "number" ? Hash : type === "boolean" ? ToggleLeft : HelpCircle;
      const dark = appTheme === "dark";
      const isRoot = data.id === "root";
      const tone =
        nodeTheme === "minimal"
          ? dark ? "text-[#8f8f8f]" : "text-[#91918e]"
          : nodeTheme === "gradient"
            ? isRoot
              ? "rounded-full bg-white/20 text-white ring-1 ring-white/30"
              : dark
                ? "rounded-full bg-gradient-to-br from-indigo-500/20 to-pink-500/20 text-[#c4b5fd]"
                : "rounded-full bg-gradient-to-br from-indigo-500/10 to-pink-500/10 text-[#7c3aed]"
            : dark
              ? "rounded-full bg-[#0f3a4a] text-[#67e8f9]"
              : "rounded-full bg-[#e0f4f8] text-[#0e7490]";
      return (
        <div className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center ${tone}`}>
          <TypeIcon size={nodeTheme === "minimal" ? 14 : 12} strokeWidth={2} />
        </div>
      );
    }
    if (nodeTheme === "vscode" || nodeTheme === "nord") {
      const dark = appTheme === "dark";
      const TypeIcon =
        type === "object" ? Braces : type === "array" ? AlignLeft : type === "string" ? Type : type === "number" ? Hash : type === "boolean" ? ToggleLeft : HelpCircle;
      const colors: Record<string, [string, string]> =
        nodeTheme === "vscode"
          ? {
              object: ["#ee9d28", "#d67e00"],
              array: ["#75beff", "#007acc"],
              string: ["#ce9178", "#a31515"],
              number: ["#b5cea8", "#098658"],
              boolean: ["#569cd6", "#0000ff"],
              null: ["#569cd6", "#0000ff"],
            }
          : {
              object: ["#88c0d0", "#3b7d8f"],
              array: ["#81a1c1", "#5e81ac"],
              string: ["#a3be8c", "#5f8046"],
              number: ["#b48ead", "#8a5f86"],
              boolean: ["#ebcb8b", "#9a7419"],
              null: ["#d08770", "#ad5c3f"],
            };
      const color = (colors[type] ?? ["#8a8a8a", "#6e6e6e"])[dark ? 0 : 1];
      return (
        <div
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center ${nodeTheme === "nord" ? "rounded-md" : ""}`}
          style={{ color, backgroundColor: nodeTheme === "nord" ? `${color}24` : undefined }}
        >
          <TypeIcon size={nodeTheme === "vscode" ? 14 : 12} strokeWidth={2} />
        </div>
      );
    }
    if (nodeTheme === "zen" || nodeTheme === "paper" || nodeTheme === "graphite" || nodeTheme === "solarized") {
      const dark = appTheme === "dark";
      const TypeIcon =
        type === "object" ? Braces : type === "array" ? AlignLeft : type === "string" ? Type : type === "number" ? Hash : type === "boolean" ? ToggleLeft : HelpCircle;
      // Solarized gives each type its own accent; the others stay monochrome
      const solarized: Record<string, string> = {
        object: "#268bd2",
        array: "#6c71c4",
        string: "#2aa198",
        number: "#cb4b16",
        boolean: "#d33682",
      };
      const accent = solarized[type] ?? (dark ? "#839496" : "#657b83");
      const tone =
        nodeTheme === "zen"
          ? dark ? "text-[#8a847a]" : "text-[#b3ab9c]"
          : nodeTheme === "paper"
            ? dark ? "text-[#a8a397]" : "text-[#6b665b]"
            : nodeTheme === "graphite"
              ? dark ? "rounded-md bg-zinc-800 text-zinc-400 ring-1 ring-white/5" : "rounded-md bg-zinc-100 text-zinc-500 ring-1 ring-zinc-900/5"
              : "rounded-md";
      return (
        <div
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center ${tone}`}
          style={nodeTheme === "solarized" ? { color: accent, backgroundColor: `${accent}1f` } : undefined}
        >
          <TypeIcon size={nodeTheme === "zen" ? 14 : 12} strokeWidth={nodeTheme === "zen" ? 1.5 : 2} />
        </div>
      );
    }
    if (nodeTheme === "tree" || nodeTheme === "notebook") {
      const dark = appTheme === "dark";
      const TypeIcon =
        nodeTheme === "tree"
          ? type === "object" ? FolderTree : type === "array" ? ListTree : type === "string" ? Type : type === "number" ? Hash : type === "boolean" ? ToggleLeft : CircleDashed
          : type === "object" ? Braces : type === "array" ? AlignLeft : type === "string" ? Type : type === "number" ? Hash : type === "boolean" ? ToggleLeft : HelpCircle;
      const tone =
        nodeTheme === "tree"
          ? dark ? "rounded-full bg-[#3a2e22] text-[#d7b48a]" : "rounded-full bg-[#f3e6d4] text-[#8b5e34]"
          // Notebook: ink on paper, no badge
          : dark ? "text-[#8fa7d4]" : "text-[#3b5b92]";
      return (
        <div className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center ${tone}`}>
          <TypeIcon size={nodeTheme === "notebook" ? 14 : 12} strokeWidth={2} />
        </div>
      );
    }
    if (nodeTheme === "rune") {
      const glyph =
        ({ object: "◈", array: "☰", string: "✦", number: "⬡", boolean: "◐", null: "∅" } as Record<string, string>)[type] ?? "◇";
      const dark = appTheme === "dark";
      return (
        <div
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full font-serif text-[12px] leading-none ${dark ? "bg-[#c9a24a]/10 text-[#e0bd66] ring-1 ring-[#c9a24a]/45" : "bg-[#b8913f]/10 text-[#8a6a22] ring-1 ring-[#b8913f]/50"}`}
        >
          {glyph}
        </div>
      );
    }
    if (nodeTheme === "glass") {
      const GlassIcon =
        type === "object" ? Braces : type === "array" ? AlignLeft : type === "string" ? Type : type === "number" ? Hash : type === "boolean" ? ToggleLeft : HelpCircle;
      const dark = appTheme === "dark";
      const color =
        type === "string"
          ? dark ? "text-[#6ee7b7]" : "text-[#059669]"
          : type === "number"
            ? dark ? "text-[#fdba74]" : "text-[#ea580c]"
            : type === "boolean"
              ? dark ? "text-[#93c5fd]" : "text-[#2563eb]"
              : dark ? "text-white/70" : "text-slate-500";
      return (
        <div
          className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ${dark ? "bg-white/10 ring-1 ring-white/15" : "bg-white/80 ring-1 ring-slate-900/[0.06]"} ${color}`}
        >
          <GlassIcon size={12} strokeWidth={2.2} />
        </div>
      );
    }
    if (nodeTheme === "math" || nodeTheme === "architect") {
      const glyphs: Record<string, Record<string, string>> = {
        // Mathematical notation, in serif
        math: { object: "{ }", array: "[ ]", string: "𝑎", number: "ℝ", boolean: "∧", null: "∅" },
        // Drafting symbols, in mono
        architect: { object: "□", array: "≡", string: "Aa", number: "#", boolean: "◐", null: "∅" },
      };
      const glyph = glyphs[nodeTheme][type] ?? "·";
      const dark = appTheme === "dark";
      const tone =
        nodeTheme === "math"
          ? `rounded-md font-serif text-[12px] ${dark ? "bg-[#60a5fa]/12 text-[#93c5fd] ring-1 ring-[#60a5fa]/25" : "bg-[#2563eb]/[0.08] text-[#1d4ed8] ring-1 ring-[#2563eb]/20"}`
          : `rounded-[2px] font-mono text-[11px] border ${dark ? "border-[#7da7d6]/50 text-[#9cc1e8]" : "border-[#64748b]/50 text-[#334155]"}`;
      return (
        <div className={`flex h-[22px] min-w-[22px] shrink-0 items-center justify-center px-1 font-semibold leading-none ${tone}`}>
          {glyph}
        </div>
      );
    }
    if (nodeTheme === "terminal" || nodeTheme === "hacker") {
      const glyph =
        ({ object: "{}", array: "[]", string: '""', number: "#", boolean: "01", null: "∅" } as Record<string, string>)[type] ?? "·";
      const dark = appTheme === "dark";
      const tone =
        nodeTheme === "terminal"
          ? dark
            ? "rounded bg-[#3fb950]/12 text-[#3fb950] ring-1 ring-[#3fb950]/25"
            : "rounded bg-[#1a7f37]/10 text-[#1a7f37] ring-1 ring-[#1a7f37]/20"
          : dark
            ? "rounded-[2px] bg-[#00ff41]/5 text-[#00ff41] ring-1 ring-[#00ff41]/40"
            : "rounded-[2px] bg-[#0a8f3c]/5 text-[#0a8f3c] ring-1 ring-[#0a8f3c]/35";
      return (
        <div className={`flex h-[22px] min-w-[22px] shrink-0 items-center justify-center px-1 font-mono text-[10px] font-bold leading-none ${tone}`}>
          {glyph}
        </div>
      );
    }
    const iconStyle = isCustom ? { color: nodeTextColor } : {};
    const iconOpacity = isCustom ? "opacity-80" : "opacity-70";

    switch (type) {
      case "object":
        return (
          <Braces
            size={14}
            className={isCustom ? "" : "opacity-70"}
            style={iconStyle}
          />
        );
      case "array":
        return (
          <AlignLeft
            size={14}
            className={isCustom ? "" : "opacity-70"}
            style={iconStyle}
          />
        );
      case "string":
        return (
          <Type
            size={14}
            className={isCustom ? "" : "text-green-400 opacity-80"}
            style={iconStyle}
          />
        );
      case "number":
        return (
          <Hash
            size={14}
            className={isCustom ? "" : "text-orange-400 opacity-80"}
            style={iconStyle}
          />
        );
      case "boolean":
        return (
          <ToggleLeft
            size={14}
            className={isCustom ? "" : "text-blue-400 opacity-80"}
            style={iconStyle}
          />
        );
      default:
        return (
          <HelpCircle
            size={14}
            className={isCustom ? "" : "opacity-50"}
            style={iconStyle}
          />
        );
    }
  };

  const baseClasses = isSpecialNode ? "" : getThemeClasses(nodeTheme);
  const isPaletteTheme = (PALETTE_THEMES as readonly string[]).includes(nodeTheme);

  // Custom tweaks per theme
  const isDarkBase =
    [
      "custom",
      "chalk",
    ].includes(nodeTheme) ||
    (nodeTheme === "glass" && appTheme === "dark") ||
    (nodeTheme === "notebook" && appTheme === "dark") ||
    (nodeTheme === "tree" && appTheme === "dark") ||
    (nodeTheme === "rune" && appTheme === "dark") ||
    (nodeTheme === "terminal" && appTheme === "dark") ||
    (nodeTheme === "hacker" && appTheme === "dark") ||
    (nodeTheme === "gradient" && (data.id === "root" || appTheme === "dark")) ||
    (nodeTheme === "minimal" && appTheme === "dark") ||
    (nodeTheme === "ocean" && appTheme === "dark") ||
    (isPaletteTheme && appTheme === "dark") ||
    (nodeTheme === "vscode" && appTheme === "dark") ||
    (nodeTheme === "github" && appTheme === "dark") ||
    (nodeTheme === "math" && appTheme === "dark") ||
    (nodeTheme === "zen" && appTheme === "dark") ||
    (nodeTheme === "architect" && appTheme === "dark") ||
    (nodeTheme === "nature" && (data.id === "root" || appTheme === "dark")) ||
    (nodeTheme === "seed" && (data.id === "root" || appTheme === "dark"));
  const isLightBase =
    (nodeTheme === "minimal" && appTheme !== "dark") ||
    (nodeTheme === "ocean" && appTheme !== "dark") ||
    (nodeTheme === "glass" && appTheme !== "dark") ||
    (nodeTheme === "notebook" && appTheme !== "dark") ||
    (nodeTheme === "tree" && appTheme !== "dark") ||
    (nodeTheme === "rune" && appTheme !== "dark") ||
    (nodeTheme === "terminal" && appTheme !== "dark") ||
    (nodeTheme === "hacker" && appTheme !== "dark") ||
    (nodeTheme === "gradient" && data.id !== "root" && appTheme !== "dark") ||
    (isPaletteTheme && appTheme !== "dark") ||
    (nodeTheme === "vscode" && appTheme !== "dark") ||
    (nodeTheme === "github" && appTheme !== "dark") ||
    (nodeTheme === "math" && appTheme !== "dark") ||
    (nodeTheme === "zen" && appTheme !== "dark") ||
    (nodeTheme === "architect" && appTheme !== "dark") ||
    (nodeTheme === "nature" && data.id !== "root" && appTheme !== "dark") ||
    (nodeTheme === "seed" && data.id !== "root" && appTheme !== "dark");

  // Text color logic
  const isCustom = nodeTheme === "custom";
  const mutedText = isCustom
    ? ""
    : nodeTheme === "vscode"
      ? appTheme === "dark" ? "text-[#858585]" : "text-[#6e6e6e]"
    : nodeTheme === "nord"
      ? appTheme === "dark" ? "text-[#7b88a1]" : "text-[#6b7891]"
    : nodeTheme === "zen"
      ? appTheme === "dark" ? "text-[#8a847a]" : "text-[#a39b8c]"
    : nodeTheme === "solarized"
      ? appTheme === "dark" ? "text-[#657b83]" : "text-[#93a1a1]"
    : nodeTheme === "terminal"
      ? appTheme === "dark" ? "text-[#7d8590]" : "text-[#59636e]"
    : nodeTheme === "hacker"
      ? appTheme === "dark" ? "text-[#3fae5a]" : "text-[#3d7a52]"
    : nodeTheme === "seed" && data.id !== "root"
      ? appTheme === "dark" ? "text-[#93ab86]" : "text-[#6b8a55]"
      : nodeTheme === "nature" && data.id !== "root"
        ? appTheme === "dark" ? "text-[#8fa886]" : "text-[#6a8560]"
        : isDarkBase
          ? "text-white/50"
          : isLightBase
            ? "text-slate-500"
            : nodeTheme === "retro"
              ? (appTheme === "dark" ? "text-[#ffb870]/80" : "text-[#6b3fc4]/80")
              : "text-black/50";
  const valText = isCustom
    ? ""
    : nodeTheme === "vscode"
      // Syntax colours: strings, numbers, and keywords (true/false/null)
      ? appTheme === "dark"
        ? data.type === "string" ? "text-[#ce9178]" : data.type === "number" ? "text-[#b5cea8]" : data.type === "boolean" || data.type === "null" ? "text-[#569cd6]" : "text-[#d4d4d4]"
        : data.type === "string" ? "text-[#a31515]" : data.type === "number" ? "text-[#098658]" : data.type === "boolean" || data.type === "null" ? "text-[#0000ff]" : "text-[#3b3b3b]"
    : nodeTheme === "nord"
      ? appTheme === "dark" ? "text-[#d8dee9]" : "text-[#3b4252]"
    : nodeTheme === "zen"
      ? appTheme === "dark" ? "text-[#c9c3b8]" : "text-[#5c564d]"
    : nodeTheme === "solarized"
      ? appTheme === "dark" ? "text-[#93a1a1]" : "text-[#586e75]"
    : nodeTheme === "rune"
      ? appTheme === "dark" ? "text-[#cdbf9c]" : "text-[#5c4a26]"
    : nodeTheme === "terminal"
      ? appTheme === "dark" ? "text-[#7ee787]" : "text-[#116329]"
    : nodeTheme === "hacker"
      ? appTheme === "dark" ? "text-[#86f7a6]" : "text-[#0b5d2a]"
    : nodeTheme === "seed" && data.id !== "root"
      ? appTheme === "dark" ? "text-[#e1ebd9]" : "text-[#1f3319]"
      : nodeTheme === "nature" && data.id !== "root"
        ? appTheme === "dark" ? "text-[#dde9d6]" : "text-[#1f3322]"
        : isDarkBase
          ? "text-white/90"
          : isLightBase
            ? "text-slate-900"
            : nodeTheme === "retro"
              ? (appTheme === "dark" ? "text-[#ffe7c7]" : "text-[#2e1760]")
              : "text-black/90";
  const labelText = isCustom ? "" : ""; // Label usually inherits or has own logic

  let highlightClasses = "";
  if (isActiveMatch) {
    highlightClasses =
      "!ring-4 !ring-emerald-400 !shadow-[0_0_20px_rgba(52,211,153,0.8)] !brightness-125 !z-[120] !border-emerald-400";
  } else if (isMatch) {
    highlightClasses =
      "!ring-2 !ring-yellow-400 !shadow-[0_0_15px_rgba(250,204,21,0.6)] !brightness-110 !z-[110] !border-yellow-400";
  } else if (isAncestor) {
    highlightClasses =
      "!ring-1 !ring-sky-400 !shadow-[0_0_10px_rgba(56,189,248,0.4)] !z-[105] !border-sky-400";
  } else if (isSelected) {
    highlightClasses =
      "!ring-2 !ring-purple-500 !shadow-[0_0_15px_rgba(168,85,247,0.6)] !brightness-110 !z-[100] !border-purple-500";
  } else if (isSelectedPath) {
    highlightClasses =
      "!ring-1 !ring-purple-400 !shadow-[0_0_10px_rgba(168,85,247,0.4)] !z-[90] !border-purple-400";
  }

  let dropShadowClass = "";
  if (isActiveMatch) {
    dropShadowClass = "drop-shadow-[0_0_15px_rgba(52,211,153,0.8)]";
  } else if (isMatch) {
    dropShadowClass = "drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]";
  } else if (isAncestor) {
    dropShadowClass = "drop-shadow-[0_0_5px_rgba(56,189,248,0.4)]";
  } else if (isSelected) {
    dropShadowClass = "drop-shadow-[0_0_10px_rgba(168,85,247,0.6)]";
  } else if (isSelectedPath) {
    dropShadowClass = "drop-shadow-[0_0_5px_rgba(168,85,247,0.4)]";
  }

  const customSize = nodeSizes[data.id];

  // The size a node has before anyone resizes it.
  const defaultWidth = isApiNode
      ? 340
      : isApiResponse
        ? 440
      : isTodoNode
        ? 385
        : isTransferNode
          ? 384
          : isMathNode
            ? isExpanded
              ? 520
              : 320
            : isJsNode || isTsNode || isPyNode
                ? 440
                : isJsCode || isTsCode || isPyCode
                  ? 420
                  : isJsTerminal || isTsTerminal || isPyTerminal
                    ? 420
                    : isMedia
                      ? 320
                      : 260;
  const defaultHeight = isTodoNode
      ? isExpanded
        ? 360
        : 140
      : isTransferNode
        ? isExpanded
          ? 360
          : 320
        : isMathNode
          ? isExpanded
            ? 350
            : 250
          : isMedia
              ? mediaType === "audio"
                ? 140
                : 240
              : isApiNode
                ? 140
                : isApiResponse
                  ? 360
                : isJsNode || isTsNode || isPyNode
                  ? 380
                  : isJsCode || isTsCode || isPyCode
                    ? 260
                    : isJsTerminal || isTsTerminal || isPyTerminal
                      ? 200
                      : isExpanded
                        ? 300
                        : 120;
  let fWidth = customSize ? customSize.width : defaultWidth;
  let fHeight = customSize ? customSize.height : defaultHeight;
  defaultSizeRef.current = { width: defaultWidth, height: defaultHeight };

  const isDefaultShape = nodeShape === "default";

  let shapeClasses = `rounded-md px-3 py-1.5 min-w-[120px] ${isApiNode ? "max-w-[340px]" : isSpecialNode ? "max-w-[440px]" : "max-w-[260px]"}`;
  let shapeStyle: React.CSSProperties = {};

  if (isSpecialNode) {
    shapeClasses = `p-0 !bg-transparent !border-transparent !shadow-none overflow-visible`;
  }

  // Apply Theme-Specific Shapes ONLY if shape is at 'default'
  if (isDefaultShape && !isSpecialNode) {
    switch (nodeTheme) {
      case "nature":
        shapeClasses = data.id === "root" ? "px-5 py-3 min-w-[150px]" : "px-4 py-2.5 min-w-[140px] rounded-xl";
        break;
      case "seed":
        shapeClasses =
          data.id === "root"
            ? "px-5 py-3 min-w-[150px] rounded-[18px_6px_18px_6px] overflow-visible"
            : "px-4 py-2.5 min-w-[140px] rounded-[14px_4px_14px_4px]";
        break;
      case "glass":
        shapeClasses = "px-4 py-2.5 min-w-[140px] rounded-2xl";
        break;
      case "math":
        shapeClasses = "px-4 py-2.5 min-w-[140px] rounded-md border-l-[3px]";
        break;
      case "tree":
        shapeClasses = "px-4 py-2.5 min-w-[140px] rounded-lg";
        break;
      case "notebook":
        shapeClasses = "px-4 py-2.5 min-w-[140px] rounded-[3px]";
        break;
      case "terminal":
        shapeClasses = "px-3.5 py-2 min-w-[140px] rounded-lg";
        break;
      case "hacker":
        shapeClasses = "px-4 py-2 min-w-[140px] rounded-none";
        break;
      case "ocean":
        shapeClasses = "px-4 py-2.5 min-w-[140px] rounded-2xl";
        break;
      case "minimal":
        shapeClasses = "px-3.5 py-2 min-w-[130px] rounded-lg";
        break;
      case "gradient":
        shapeClasses = "px-4 py-2.5 min-w-[140px] rounded-xl";
        break;
      case "rune":
        shapeClasses = "px-5 py-3 min-w-[150px] rounded-[4px]";
        break;
      case "chalk":
        shapeClasses = "px-5 py-3 min-w-[140px] chalk-node rounded-lg";
        break;
      case "zen":
        shapeClasses = "px-5 py-3 min-w-[150px] rounded-2xl";
        break;
      case "vscode":
        shapeClasses = "px-3.5 py-2 min-w-[140px] rounded-[5px]";
        break;
      case "nord":
        shapeClasses = "px-4 py-2.5 min-w-[140px] rounded-lg";
        break;
      case "paper":
        shapeClasses = "px-4 py-2.5 min-w-[140px] rounded-[2px]";
        break;
      case "graphite":
        shapeClasses = "px-3.5 py-2 min-w-[140px] rounded-lg";
        break;
      case "solarized":
        shapeClasses = "px-4 py-2.5 min-w-[140px] rounded-md";
        break;
      case "architect":
        shapeClasses = "px-4 py-2 min-w-[140px] rounded-[3px]";
        shapeStyle.outline = `1px dashed ${appTheme === "dark" ? "rgba(125, 167, 214, 0.35)" : "rgba(71, 85, 105, 0.3)"}`;
        shapeStyle.outlineOffset = "3px";
        break;
    }

    if (!shapeStyle.maxWidth) {
      shapeStyle.maxWidth = isApiNode ? "340px" : isMedia ? "320px" : "260px";
    }
    if (isMedia && !shapeStyle.minWidth) {
      shapeStyle.minWidth = mediaType === "audio" ? "300px" : "280px";
    }
  }

  if (nodeTheme === "custom") {
    shapeStyle.color = nodeTextColor;
    if (useNodeGradient) {
      shapeStyle.background =
        nodeGradientType === "linear"
          ? `linear-gradient(${nodeGradientAngle}deg, ${nodeGradientColor1}, ${nodeGradientColor2})`
          : `radial-gradient(circle at center, ${nodeGradientColor1}, ${nodeGradientColor2})`;
    } else {
      shapeStyle.backgroundColor = nodeColor;
    }
  }

  if (!isDefaultShape && !isSpecialNode) {
    switch (nodeShape) {
      case "circle":
        fWidth = isMedia ? 280 : 200;
        fHeight = isMedia ? 280 : 200;
        shapeClasses =
          `rounded-full justify-center text-center ${isMedia ? 'p-0' : 'p-6'} min-w-[160px] ${isMedia ? 'max-w-[280px]' : 'max-w-[200px]'} overflow-hidden`;
        shapeStyle.aspectRatio = "1";
        break;
      case "pill":
        shapeClasses =
          "rounded-[2rem] px-8 py-3 min-w-[140px] max-w-[260px] text-center justify-center";
        break;
      case "rectangle":
        shapeClasses = "rounded-none px-4 py-2 min-w-[120px] max-w-[260px]";
        break;
      case "hexagon":
        fWidth = isMedia ? 340 : 280;
        fHeight = isMedia ? 260 : 140;
        shapeClasses =
          "px-10 py-6 justify-center min-w-[160px] max-w-[280px] text-center";
        shapeStyle.clipPath =
          "polygon(15% 0%, 85% 0%, 100% 50%, 85% 100%, 15% 100%, 0% 50%)";
        break;
      case "triangle":
        fWidth = isMedia ? 360 : 300;
        fHeight = isMedia ? 300 : 200;
        shapeClasses =
          "px-12 pt-24 pb-8 justify-end items-center min-w-[220px] max-w-[300px] text-center flex-col";
        shapeStyle.clipPath = "polygon(50% 0%, 100% 100%, 0% 100%)";
        break;
      case "diamond":
        fWidth = isMedia ? 360 : 280;
        fHeight = isMedia ? 360 : 240;
        shapeClasses =
          "px-16 py-16 justify-center text-center items-center min-w-[240px] max-w-[280px] flex-col";
        shapeStyle.clipPath = "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)";
        break;
      case "parallelogram":
        fWidth = isMedia ? 340 : 280;
        shapeClasses =
          "px-12 py-3 min-w-[160px] max-w-[280px] text-center justify-center";
        shapeStyle.clipPath = "polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)";
        break;
    }
  }

  if (!isSpecialNode) {
    fWidth *= nodeSize;
    fHeight *= nodeSize;
  }

  let foWidth = fWidth + 100;
  let foHeight = fHeight + 100;
  if (isSpecialNode) {
    foWidth += 200;
    foHeight += 200;
  }

  return (
    <foreignObject
      ref={foreignRef}
      x={0}
      y={0}
      transform={`translate(${node.x - foWidth / 2}, ${node.y - foHeight / 2})`}
      width={foWidth}
      height={foHeight}
      className={`origin-center ${isDimmed ? "opacity-30 grayscale scale-95" : "opacity-100"} ${isMatch || isSelected ? "z-[100]" : isAncestor || isSelectedPath ? "z-[90]" : "z-[50]"}`}
      style={{
        overflow: "visible",
        touchAction: "none",
        pointerEvents: "none",
        transition: (isDraggingLocally || isBeingDragged || isResizing) ? "none" : "opacity 500ms ease-out, filter 500ms ease-out, transform 500ms ease-out",
      }}
    >
      <div className="w-full h-full flex items-center justify-center">
        <div
          className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${isMatch || isSelected ? "scale-105" : ""} ${dropShadowClass}`}
        >
          <div
            className={`pointer-events-auto select-none relative flex ${isMedia ? "flex-col" : "items-center"} ${!isSpecialNode ? "border" : ""} cursor-pointer ${!isSpecialNode ? "hover:brightness-125" : ""} transition-all duration-300 flex-shrink-0 ${baseClasses} ${highlightClasses} ${shapeClasses}`}
            style={{
              ...shapeStyle,
              transform: isSpecialNode ? undefined : `scale(${nodeSize})`,
              transformOrigin: "center",
              touchAction: "none",
            }}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedNodeId(data.id);
              useStore.getState().setIsolatedNodeId(null);
            }}
            onContextMenu={(e) => {
              const target = e.target as HTMLElement;
              if (
                target.closest("input") ||
                target.closest("textarea") ||
                target.closest("select")
              ) {
                e.stopPropagation();
                return;
              }
              if (onContextMenu) {
                e.preventDefault();
                e.stopPropagation();
                e.nativeEvent.stopImmediatePropagation();
                onContextMenu(e, data);
              }
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setSelectedNodeId(data.id);
              useStore.getState().setIsolatedNodeId(data.id);
              if (hasChildren) toggleNodeCollapse(data.id);
            }}
          >
            {nodeTheme === "seed" && data.id === "root" && !isSpecialNode && (
              <svg
                className="seed-sprout pointer-events-none absolute -top-[41px] left-1/2 -translate-x-1/2"
                width="60"
                height="44"
                viewBox="0 0 46 34"
                aria-hidden
              >
                <path d="M23 34 C23 27 22 21 23 13" stroke="#7fae5c" strokeWidth="2.4" fill="none" strokeLinecap="round" />
                <path d="M23 17 C17 7 7 6 3 11 C9 17 17 18 23 17 Z" fill="#8cbc66" />
                <path d="M23 17 C16 14 9 12 4 11.5" stroke="#5f8f40" strokeWidth="0.8" fill="none" opacity="0.7" />
                <path d="M23 13 C28 3 38 2 43 7 C37 13 29 14 23 13 Z" fill="#6fa24c" />
                <path d="M23 13 C30 10 36 8 42 7.5" stroke="#4f7f34" strokeWidth="0.8" fill="none" opacity="0.7" />
              </svg>
            )}
            <div
              className={`flex w-full h-full min-w-0 ${isMedia ? "items-start mb-2" : "items-center"} ${isSpecialNode ? "p-0" : ""}`}
            >
              {!isSpecialNode && (
                <div className="flex-shrink-0 mr-2 flex items-center">
                  {hasChildren && (
                    <div
                      className={`mr-1 -ml-1 ${mutedText} hover:text-slate-200 transition-colors p-1 -m-1 rounded z-10`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleNodeCollapse(data.id);
                      }}
                    >
                      {isCollapsed ? (
                        <ChevronRight size={14} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </div>
                  )}
                  {getIcon(data.type)}
                </div>
              )}

              <div
                className={`flex flex-col w-full max-w-full min-w-0 leading-tight h-full ${isSpecialNode ? "p-0" : "px-1 py-0.5 overflow-hidden"}`}
                style={{
                  ...(isCustom && !isSpecialNode
                    ? { color: nodeTextColor }
                    : {}),
                }}
              >
                {!isSpecialNode && (
                  <div className="flex items-baseline space-x-1.5 w-full max-w-full overflow-hidden">
                    <span
                      className={`pointer-events-none font-mono text-xs font-semibold truncate max-w-full`}
                      title={data.name}
                    >
                      {data.name}
                    </span>
                    {data.type !== "object" && data.type !== "array" && (
                      <span
                        className={`pointer-events-none text-[10px] uppercase font-bold px-1 rounded-sm ${isDarkBase ? "bg-white/10" : "bg-black/10"} tracking-widest ${mutedText}`}
                        style={{
                          ...(isCustom
                            ? { color: nodeTextColor, opacity: 0.7 }
                            : {}),
                        }}
                      >
                        {data.type}
                      </span>
                    )}
                  </div>
                )}
                {data.value !== undefined &&
                  !isMedia &&
                  !isApiNode &&
                  !isApiResponse &&
                  !isJsNode &&
                  !isJsCode &&
                  !isJsTerminal &&
                  !isTsNode &&
                  !isTsCode &&
                  !isTsTerminal &&
                  !isPyNode &&
                  !isPyCode &&
                  !isPyTerminal &&
                  !isTransferNode &&
                  !isTodoNode &&
                  !isMathNode && (
                    <div className="flex flex-col flex-1 min-w-0 mt-0.5 relative group/val w-full max-w-full h-full overflow-hidden">
                      <div
                        className={`flex-1 min-w-0 ${isExpanded ? `nodrag overflow-y-auto max-h-[180px] custom-scrollbar pr-1` : "overflow-hidden"}`}
                      >
                        {isKnownDataUrl && (
                          <span className="inline-block px-1 mr-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/20 align-middle">
                            {knownDataUrls[strVal]}
                          </span>
                        )}
                        <span
                          className={`text-[11px] font-mono leading-normal inline ${isExpanded
                            ? "whitespace-pre-wrap break-all"
                            : "truncate w-full max-w-full block"
                            } ${valText}`}
                          title={!isExpanded && strVal.length < 500 ? strVal : undefined}
                          style={{
                            ...(isCustom
                              ? { color: nodeTextColor, opacity: 0.9 }
                              : {}),
                          }}
                        >
                          {isExpanded ? (
                            strVal.length > 5000 ? (
                              <>
                                {strVal.substring(0, 5000)}...
                                <span
                                  className="inline-block ml-1.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 align-middle whitespace-nowrap shadow-sm backdrop-blur-sm cursor-pointer hover:bg-indigo-500/25 transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActivePreviewText(strVal, data.path);
                                  }}
                                >
                                  Open Preview to see all
                                </span>
                              </>
                            ) : (
                              strVal
                            )
                          ) : strVal.length > 500 ? (
                            strVal.substring(0, 500) + "..."
                          ) : (
                            strVal
                          )}
                        </span>
                      </div>
                      {strVal.length > 50 && (
                        <div className="flex items-center gap-1.5 mt-1 shrink-0">
                          <button
                            className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-tighter px-1.5 py-0.5 rounded transition-all bg-black/10 hover:bg-black/20 ${mutedText} z-20 cursor-pointer`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsExpanded(!isExpanded);
                            }}
                            title={isExpanded ? "Show Less" : "Show More"}
                          >
                            {isExpanded ? (
                              <>
                                <Minimize2 size={10} />
                                <span>LESS</span>
                              </>
                            ) : (
                              <>
                                <Maximize2 size={10} />
                                <span>MORE</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                {isApiNode && (
                  <MemoApiNodeRenderer
                    url={strVal}
                    path={data.path}
                    nodeId={data.id}
                    nodeX={node.x}
                    nodeY={node.y}
                    nodeWidth={fWidth}
                  />
                )}
                {isApiResponse && (
                  <MemoApiResponseNodeRenderer
                    path={data.id}
                    data={data.value}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {isJsNode && (
                  <MemoJsNodeRenderer
                    path={data.path}
                    code={strVal}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {isJsCode && (
                  <MemoJsNodeCodeRenderer
                    code={strVal}
                    path={data.path.replace(".__js_code", "")}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {isJsTerminal && (
                  <MemoJsNodeTerminalRenderer
                    path={data.path.replace(".__js_terminal", "")}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {isTsNode && (
                  <MemoTsNodeRenderer
                    path={data.path}
                    code={strVal}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {isPyNode && (
                  <MemoPyNodeRenderer
                    path={data.path}
                    code={strVal}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {isTsCode && (
                  <MemoTsNodeCodeRenderer
                    code={strVal}
                    path={data.path.replace(".__ts_code", "")}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {isTsTerminal && (
                  <MemoTsNodeTerminalRenderer
                    path={data.path.replace(".__ts_terminal", "")}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {isPyCode && (
                  <MemoPyNodeCodeRenderer
                    code={strVal}
                    path={data.path.replace(".__py_code", "")}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {isPyTerminal && (
                  <MemoPyNodeTerminalRenderer
                    path={data.path.replace(".__py_terminal", "")}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {isTodoNode && (
                  <MemoTodoNodeRenderer
                    nodeId={data.id}
                    data={data}
                    isExpanded={isExpanded}
                  />
                )}
                {isTransferNode && (
                  <MemoTransferNodeRenderer node={node} />
                )}
                {isMathNode && (
                  <MemoMathNodeRenderer
                    key={data.path}
                    nodeId={data.id}
                    data={data}
                    isExpanded={isExpanded}
                    width={fWidth}
                    height={fHeight}
                  />
                )}
                {hasChildren && isCollapsed && (
                  <span
                    className={`pointer-events-none text-[10px] mt-0.5 italic ${mutedText}`}
                    style={
                      isCustom ? { color: nodeTextColor, opacity: 0.6 } : {}
                    }
                  >
                    {data.children!.length} item
                    {data.children!.length !== 1 ? "s" : ""}
                  </span>
                )}
              </div>

              {!isSpecialNode && mediaType !== "image" && (
                <div
                  className="ml-1 flex-shrink-0 p-1 flex items-center justify-center md:hidden rounded-full hover:scale-110 active:scale-95 transition-all touch-manipulation z-[100]"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onContextMenu) onContextMenu(e, data);
                  }}
                >
                  <MoreVertical size={14} className={mutedText} />
                </div>
              )}
              {mediaType === "image" && (
                <div className="ml-1 flex-shrink-0 p-1 flex items-center justify-center z-[100]">
                  <NodeOptionsMenu
                    path={data.path}
                    iconSize={14}
                    customText="Open Editor in New Tab"
                    forceWorkspace={true}
                  />
                </div>
              )}
            </div>

            {isMedia && (
              <div
                ref={mediaContainerRef}
                className="flex flex-col w-full mt-2 relative group/media-container"
              >
                <div
                  className={`w-full rounded overflow-hidden border relative ${mediaType === "smart" ? "flex flex-1 items-stretch" : "p-1 flex justify-center items-center"} ${isDarkBase
                    ? "bg-black/20 border-white/5"
                    : "bg-slate-100 border-slate-200"
                    }`}
                  style={{ pointerEvents: isDraggingLocally ? "none" : "auto" }}
                >
                  {mediaType === "image" && (
                    <SmartFallbackMedia
                      type="image"
                      src={mediaSrc}
                      alt={data.name}
                      draggable={false}
                      className="max-w-full max-h-[160px] object-contain rounded select-none"
                    />
                  )}
                  {mediaType === "audio" && (
                    <SmartFallbackMedia
                      type="audio"
                      src={mediaSrc}
                      controls
                      isDark={isDarkBase}
                      className="w-full h-11 outline-none py-1"
                    />
                  )}
                  {mediaType === "video" && (
                    <SmartFallbackMedia
                      type="video"
                      src={mediaSrc}
                      controls
                      className="max-w-full max-h-[160px] rounded focus:outline-none"
                    />
                  )}
                  {mediaType === "3d-model" && (
                    <SafeModelViewer
                      src={mediaSrc}
                      alt={data.name || "3D Model"}
                      autoRotate
                      cameraControls
                      style={{
                        width: "100%",
                        height: "160px",
                        backgroundColor: "transparent",
                        pointerEvents: isDraggingLocally ? "none" : "auto",
                      }}
                    />
                  )}
                  {mediaType === "pdf" && (
                    <div className={`flex flex-col items-center justify-center p-4 w-full h-[160px] bg-gradient-to-br rounded border border-rose-500/20 text-center gap-1.5 cursor-pointer ${isDarkBase ? "from-rose-500/10 to-rose-600/20" : "from-rose-500/5 to-rose-600/10"}`}>
                      <div className="p-2 rounded-full bg-rose-500/10 text-rose-500 animate-pulse">
                        <FileText size={22} />
                      </div>
                      <div className={`text-xs font-semibold font-sans ${isDarkBase ? "text-rose-400" : "text-rose-700"}`}>
                        PDF Document
                      </div>
                      <div
                        className={`text-[10px] font-mono truncate max-w-full px-2 ${isDarkBase ? "text-slate-400" : "text-slate-500"}`}
                        title={strVal.split("/").pop()}
                      >
                        {strVal.split("/").pop() || "document.pdf"}
                      </div>
                      <span className="text-[9px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 font-mono">
                        Click Full Preview below
                      </span>
                    </div>
                  )}
                  {mediaType === "smart" && (
                    <SmartMediaRenderer
                      key={mediaSrc}
                      url={mediaSrc}
                      onMediaFailed={handleSmartMediaFailed}
                    />
                  )}
                </div>

                {assetDetails && (
                  <div className={`mt-1.5 px-1.5 py-1 rounded border text-[9px] font-mono space-y-0.5 select-none leading-normal font-sans ${isDarkBase ? "bg-black/40 border-white/5 text-slate-400" : "bg-slate-50 border-slate-200 text-slate-500"}`}>
                    <div className="flex justify-between gap-2 overflow-hidden">
                      <span className={`font-sans shrink-0 ${isDarkBase ? "text-slate-500" : "text-slate-400"}`}>
                        Name:
                      </span>
                      <span
                        className={`font-medium truncate shrink ${isDarkBase ? "text-white" : "text-slate-800"}`}
                        title={assetDetails.filename}
                      >
                        {assetDetails.filename || "Unnamed"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className={`font-sans ${isDarkBase ? "text-slate-500" : "text-slate-400"}`}>
                        Size:
                      </span>
                      <span className={`font-medium ${isDarkBase ? "text-slate-300" : "text-slate-700"}`}>
                        {formatFileSize(assetDetails.size, 'B')}
                      </span>
                    </div>
                    {typeof assetDetails.width === "number" &&
                      typeof assetDetails.height === "number" &&
                      assetDetails.width > 0 &&
                      assetDetails.height > 0 && (
                        <div className="flex justify-between">
                          <span className={`font-sans ${isDarkBase ? "text-slate-500" : "text-slate-400"}`}>
                            Dims:
                          </span>
                          <span className={`font-medium ${isDarkBase ? "text-slate-300" : "text-slate-700"}`}>
                            {assetDetails.width} × {assetDetails.height} px
                          </span>
                        </div>
                      )}
                  </div>
                )}

                <button
                  className={`absolute ${mediaType === "audio" ? "top-1 right-1" : "bottom-1.5 left-1/2 -translate-x-1/2"} flex items-center gap-1.5 px-2 py-1 hover:bg-indigo-600 backdrop-blur-md hover:text-white rounded-full text-[9px] font-bold tracking-tight transition-all opacity-100 md:opacity-0 group-hover/media-container:opacity-100 shadow-xl border z-20 whitespace-nowrap ${isDarkBase ? "bg-black/60 text-white border-white/10" : "bg-white/90 text-slate-800 border-slate-200"}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (mediaType === "audio") {
                      const url = actualAssetId || strVal;
                      const cleanUrl = url.split("?")[0].split("#")[0];
                      const fileName =
                        assetDetails?.name ||
                        cleanUrl.split("/").pop() ||
                        "Audio Track";
                      const finalSource = mediaSrc || url;

                      import("../lib/db").then(({ db }) => {
                        db.audio_tracks.get(url).then((existingTrack) => {
                          const track: any = existingTrack || {
                            id: url,
                            title: fileName,
                            artist: "Workspace Audio",
                            source: finalSource,
                            type: "audio/mpeg",
                            createdAt: Date.now(),
                          };
                          import("../audio/stores/audioStore").then((m) => {
                            m.useAudioStore.getState().playTrackNow(track);
                          });
                          import("../audio/services/audioEngine").then((m) => {
                            m.audioEngine.playTrack(track);
                          });
                        });
                      });
                      return;
                    }
                    setActivePreviewMedia({
                      url: actualAssetId || strVal,
                      type:
                        mediaType === "smart"
                          ? "smart"
                          : mediaType === "pdf" ||
                            strVal.match(/\.pdf(\?.*)?$/i)
                            ? "pdf"
                            : (mediaType as any),
                    });
                  }}
                >
                  <Eye size={10} />
                  FULL PREVIEW
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </foreignObject>
  );
}

export default React.memo(NodeRenderer, (prevProps, nextProps) => {
  return (
    prevProps.node.x === nextProps.node.x &&
    prevProps.node.y === nextProps.node.y &&
    prevProps.layoutMode === nextProps.layoutMode &&
    prevProps.isSelectedPath === nextProps.isSelectedPath &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isIsolatedMode === nextProps.isIsolatedMode &&
    prevProps.node.data.id === nextProps.node.data.id &&
    prevProps.node.data.name === nextProps.node.data.name &&
    prevProps.node.data.value === nextProps.node.data.value
  );
});
