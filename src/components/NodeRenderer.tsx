import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { HierarchyPointNode } from "d3";
import { TreeNode } from "../utils/transformer";
import { useStore, NodeTheme } from "../store/useStore";
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
  FileText
} from "lucide-react";
import SmartMediaRenderer from "./SmartMediaRenderer";
import { SmartFallbackMedia } from "./SmartFallbackMedia";
import SafeIframe from "./SafeIframe";
import { ApiNodeRenderer } from "./ApiNodeRenderer";
import "@google/model-viewer";

interface NodeProps {
  key?: React.Key;
  node: HierarchyPointNode<TreeNode>;
  layoutMode: string;
  isSelectedPath?: boolean;
  isSelected?: boolean;
  onContextMenu?: (e: React.MouseEvent, node: TreeNode) => void;
}

export const getMediaType = (val: string) => {
  if (!val || typeof val !== "string") return null;
  val = val.trim();
  if (
    val.match(/\.pdf(\?.*)?$/i) || 
    val.startsWith("data:application/pdf") ||
    (val.startsWith("blob:http") && val.includes("pdf"))
  ) 
    return "pdf";
  if (
    val.startsWith("data:image/") ||
    val.startsWith("blob:http") && val.includes("image") ||
    val.match(/\.(jpeg|jpg|gif|png|webp|svg|bmp)(\?.*)?$/i) ||
    val.match(/^https?:\/\/.*\.(jpeg|jpg|gif|png|webp|svg|bmp)/i)
  )
    return "image";
  if (
    val.startsWith("data:audio/") ||
    val.startsWith("blob:http") && val.includes("audio") ||
    val.match(/\.(mp3|wav|ogg|aac|flac)(\?.*)?$/i) ||
    val.match(/^https?:\/\/.*\.(mp3|wav|ogg|aac|flac)/i)
  )
    return "audio";
  if (
    val.startsWith("data:video/") ||
    val.startsWith("blob:http") && val.includes("video") ||
    val.match(/\.(mp4|webm|ogv|mov)(\?.*)?$/i) ||
    val.match(/^https?:\/\/.*\.(mp4|webm|ogv|mov)/i)
  )
    return "video";
  if (
    val.startsWith("blob:http") && (val.includes("model") || val.includes("3d-model")) ||
    val.match(/\.(glb|gltf|obj)(\?.*)?$/i) ||
    val.match(/^https?:\/\/.*\.(glb|gltf|obj)/i) ||
    val.startsWith("model/")
  )
    return "3d-model";
  // Use inspector for youtube, vimoe, spotfiy, or any http url
  // Just treat any http/https link as potential smart media if we didn't natively catch it
  if (val.startsWith("http://") || val.startsWith("https://")) return "smart";
  return null;
};

export default function NodeRenderer({
  node,
  layoutMode,
  isSelectedPath,
  isSelected,
  onContextMenu,
}: NodeProps) {
  const {
    nodeTheme,
    nodeShape,
    nodeSize,
    nodeColor,
    nodeTextColor,
    nodeGradientColor1,
    nodeGradientColor2,
    useNodeGradient,
    nodeGradientAngle,
    nodeGradientType,
    toggleNodeCollapse,
    collapsedNodes,
    searchQuery,
    searchMatches,
    searchAncestors,
    activeMatchId,
    setSelectedNodeId,
    showMediaPreview,
    manuallyRenderedNodes,
    setDragOverride,
    globalTextExpanded,
    setActivePreviewText,
    setActivePreviewMedia,
    appTheme,
  } = useStore();
  const foreignRef = useRef<SVGForeignObjectElement>(null);

  const nodeRef = useRef(node);
  nodeRef.current = node;

  useEffect(() => {
    if (!foreignRef.current) return;

    const drag = d3
      .drag<SVGForeignObjectElement, unknown>()
      .subject(() => ({ x: nodeRef.current.x, y: nodeRef.current.y }))
      .on("start", function (event) {
        event.sourceEvent?.stopPropagation();
        d3.select(this).raise();
      })
      .on("drag", function (event) {
        setDragOverride(nodeRef.current.data.id, { x: event.x, y: event.y });
      });

    d3.select(foreignRef.current).call(drag);
  }, [setDragOverride]);

  const [smartMediaFailed, setSmartMediaFailed] = React.useState(false);
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
      useStore.getState().selectedNodeId != null);

  const strVal = data.value !== undefined ? String(data.value) : "";
  const isApiNode = data.type === 'string' && data.name && String(data.name).endsWith('_api_node');
  
  const isManuallyRendered = manuallyRenderedNodes && !!manuallyRenderedNodes[data.id];
  const mediaType =
    (showMediaPreview || isManuallyRendered) && data.type === "string" && !smartMediaFailed && !isApiNode
      ? getMediaType(strVal)
      : null;
  const isMedia = !!mediaType;

  // reset smartMediaFailed if value changes
  React.useEffect(() => {
    setSmartMediaFailed(false);
  }, [strVal]);

  const getThemeClasses = (theme: NodeTheme) => {
    switch (theme) {
      case "vscode":
        return "bg-[#1e1e1e] border-[#3c3c3c] text-[#d4d4d4] shadow-md";
      case "github":
        return "bg-[#0d1117] border-[#30363d] text-[#c9d1d9] shadow-sm";
      case "glassmorphism":
        return "bg-white/10 border-white/20 text-white backdrop-blur-md shadow-[0_8px_32px_0_rgba(31,38,135,0.37)]";
      case "cyberpunk":
        return "bg-[#000000] border-[#00ff2a] text-[#00ff2a] shadow-[0_0_10px_#00ff2a]";
      case "minimal":
        return "bg-white border-transparent text-slate-800 shadow-sm";
      case "gradient":
        return "bg-gradient-to-br from-indigo-500 to-purple-600 border-transparent text-white shadow-lg";
      case "pastel":
        return "bg-[#fdfcdc] border-[#f0ead2] text-[#6d6875] shadow-sm";
      case "terminal":
        return "bg-black border-[#33ff00] text-[#33ff00] shadow-none font-mono";
      case "material":
        return "bg-[#212121] border-transparent text-white shadow-[0_3px_6px_rgba(0,0,0,0.16),0_3px_6px_rgba(0,0,0,0.23)]";
      case "blueprint":
        return "bg-[#003366] border-[#4fa8fb] text-[#4fa8fb] shadow-none";
      case "retro":
        return "bg-[#ff9900] border-[#8a2be2] text-[#8a2be2] shadow-[4px_4px_0_#8a2be2]";
      case "nature":
        return "bg-gradient-to-br from-[#2d6a4f] to-[#1b4332] border-[#4a7c44] text-white shadow-xl backdrop-blur-md ring-1 ring-white/20 font-bold";
      case "banyan":
        return "bg-gradient-to-br from-[#1a4d2e] via-[#2d6a4f] to-[#1a4d2e] border-white/20 text-white shadow-2xl backdrop-blur-md ring-1 ring-emerald-400/30 font-bold";
      case "peepal":
        return "bg-gradient-to-br from-[#124219] via-[#1a5b28] to-[#0b2911] border-white/15 text-white shadow-[0_20px_45px_rgba(0,0,0,0.5)] backdrop-blur-md ring-1 ring-emerald-300/20 font-bold";
      case "nature2":
        return data.id === "root"
          ? "bg-[#36573c] border border-[#2b4c30] text-white shadow-xl"
          : "bg-[#eaf1e2] border border-[#d2e0c6] text-[#1c3821] shadow-sm";
      case "seed":
        return data.id === "root"
          ? "bg-[#3b5336] text-white shadow-[0_10px_20px_rgba(59,83,54,0.4)] border-none"
          : "bg-[#f4f7f0]/90 backdrop-blur border border-[#d6e0cc] text-[#294025] shadow-sm";
      case "hydrogen":
        return appTheme === "dark"
          ? "bg-[#0a192f]/70 border border-[#3b82f6]/40 text-[#bfdbfe] shadow-[0_4px_24px_rgba(59,130,246,0.15),_inset_0_0_15px_rgba(59,130,246,0.1)] backdrop-blur-xl ring-1 ring-white/5"
          : "bg-white/60 border border-blue-200/60 text-[#1e3a8a] shadow-[0_8px_32px_rgba(59,130,246,0.1),_inset_0_0_20px_rgba(255,255,255,0.7)] backdrop-blur-xl ring-1 ring-blue-100/50";
      case "circuit":
        return "bg-[#0b0e14] border-[#00f3ff] text-[#00f3ff] shadow-[0_0_15px_rgba(0,243,255,0.3)] font-mono border-2";
      case "galaxy":
        return "bg-gradient-to-br from-[#0b0014] to-[#1a0033] border-purple-500/50 text-purple-100 shadow-[0_0_20px_rgba(168,85,247,0.4)]";
      case "glass":
        return "bg-white/5 border-white/30 text-white backdrop-blur-xl shadow-2xl ring-1 ring-white/10";
      case "neon":
        return "bg-black border-[#ff00ff] text-[#ff00ff] shadow-[0_0_20px_#ff00ff] font-bold tracking-wider";
      case "math":
        return "bg-[#f8f9fa] border-slate-300 text-slate-800 shadow-none font-mono border-dashed";
      case "neural":
        return "bg-[#0a192f] border-blue-400/50 text-blue-200 shadow-[0_0_15px_rgba(96,165,250,0.2)] rounded-full animate-pulse-subtle";
      case "river":
        return "bg-gradient-to-r from-blue-600/80 to-cyan-500/80 border-transparent text-white shadow-lg rounded-3xl";
      case "tree":
        return "bg-[#2d3a3a] border-[#6b8e23] text-[#f5f5dc] border-b-4 border-r-2";
      case "pixel":
        return "bg-[#3a4466] border-[#1a1c2c] text-[#f4f4f4] shadow-[4px_4px_0_#1a1c2c] rounded-none";
      case "hacker":
        return "bg-black border-[#00ff41] text-[#00ff41] shadow-[0_0_5px_#00ff41] font-mono lowercase animate-scanline";
      case "cloud":
        return "bg-white border-sky-200 text-sky-900 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] rounded-xl";
      case "dna":
        return "bg-[#1a1a2e] border-fuchsia-500/60 text-fuchsia-200 shadow-[inset_0_0_10px_rgba(217,70,239,0.2)]";
      case "lava":
        return "bg-[#2a0800] border-[#ff4500] text-[#ff4500] shadow-[0_0_25px_#ff4500] border-t-2";
      case "ocean":
        return "bg-[#001219]/80 border-[#005f73] text-[#94d2bd] shadow-[0_0_20px_rgba(0,18,25,0.8)] backdrop-blur-lg";
      case "rhythm":
        return "bg-[#1a1a1a] border-[#ff0055] text-white shadow-[0_0_30px_rgba(255,0,85,0.4)] animate-pulse-subtle";
      case "rune":
        return "bg-[#1c1c1c] border-[#d4af37]/40 text-[#d4af37] shadow-inner font-serif italic";
      case "zen":
        return "bg-[#fafafa] border-transparent text-slate-400 shadow-none hover:text-slate-900 transition-all";
      case "abstract":
        return "bg-gradient-to-tr from-[#6366f1] via-[#d946ef] to-[#f43f5e] border-transparent text-white shadow-2xl";
      case "architect":
        return "bg-slate-50 border-slate-400 text-slate-800 shadow-none font-mono";
      case "ludo":
        return "bg-white/80 border-2 text-slate-900 shadow-xl backdrop-blur-md";
      case "chess":
        return "bg-[#151b29] border border-[#bfa76f]/40 text-[#e2d8c3] shadow-lg font-serif";
      case "octopus":
        return "bg-[#0f172a]/80 backdrop-blur-md border border-[#38bdf8]/50 text-[#e0f2fe] shadow-[0_0_15px_rgba(56,189,248,0.3)] rounded-full";
      case "holographic":
        return "bg-gradient-to-tr from-fuchsia-500/30 via-cyan-500/30 to-violet-500/30 border-cyan-400/50 text-cyan-100 backdrop-blur-xl shadow-[0_0_15px_rgba(34,211,238,0.5)]";
      case "notebook":
        return "bg-[#fff9e6] border-[#e0d6b8] text-[#4a4a4a] border-l-4 border-l-red-400 shadow-md font-serif";
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
      const bgColor = isRoot
        ? "bg-[#8c6742] text-white shadow-inner"
        : "bg-[#739257] text-white";
      const iconStr = isRoot
        ? "🌱"
        : type === "object"
          ? "🍃"
          : type === "array"
            ? "🌿"
            : type === "string"
              ? "🍂"
              : type === "number"
                ? "🌾"
                : type === "boolean"
                  ? "🍀"
                  : "🪴";

      return (
        <div className="relative flex items-center justify-center">
          {isRoot && (
            <div className="absolute inset-0 rounded-full border-2 border-[#5a3a1f]/30 scale-125 pointer-events-none" />
          )}
          <div
            className={`rounded-full flex items-center justify-center ${bgColor} relative z-10`}
            style={{
              width: isRoot ? "28px" : "24px",
              height: isRoot ? "28px" : "24px",
              fontSize: isRoot ? "14px" : "12px",
            }}
          >
            {iconStr}
          </div>
        </div>
      );
    }
    if (nodeTheme === "hydrogen") {
      const isRoot = data.id === "root";
      const innerColor =
        appTheme === "dark"
          ? "bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-[0_0_15px_rgba(59,130,246,0.8)] border border-blue-300"
          : "bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-[0_0_12px_rgba(59,130,246,0.4)] border border-blue-200";
      const initial = isRoot
        ? "H"
        : type === "object"
          ? "O"
          : type === "array"
            ? "A"
            : type === "string"
              ? "S"
              : type === "number"
                ? "N"
                : type === "boolean"
                  ? "B"
                  : type === "null"
                    ? "∅"
                    : "H";

      return (
        <div className="relative flex items-center justify-center">
          {/* Orbital rings */}
          {isRoot && (
            <>
              <div
                className="absolute rounded-full border border-blue-400/20"
                style={{ width: "56px", height: "56px" }}
              />
              <div
                className="absolute rounded-full border border-blue-400/10"
                style={{ width: "70px", height: "70px" }}
              />
            </>
          )}
          <div
            className={`absolute rounded-full border ${appTheme === "dark" ? "border-blue-400/30" : "border-blue-400/40"}`}
            style={{
              width: isRoot ? "44px" : "32px",
              height: isRoot ? "44px" : "32px",
            }}
          />
          {/* Inner core */}
          <div
            className={`rounded-full flex items-center justify-center font-bold ${innerColor} relative z-10`}
            style={{
              width: isRoot ? "28px" : "20px",
              height: isRoot ? "28px" : "20px",
              fontSize: isRoot ? "14px" : "10px",
            }}
          >
            {initial}
          </div>
          {/* Electron dots */}
          <div
            className={`absolute rounded-full shadow-[0_0_4px_#93c5fd] bg-blue-300`}
            style={{
              width: isRoot ? "5px" : "3px",
              height: isRoot ? "5px" : "3px",
              top: "5%",
              right: "15%",
            }}
          />
          {isRoot && (
            <div
              className={`absolute rounded-full shadow-[0_0_4px_#93c5fd] bg-blue-200`}
              style={{
                width: "4px",
                height: "4px",
                bottom: "10%",
                left: "10%",
              }}
            />
          )}
        </div>
      );
    }
    if (nodeTheme === "nature2") {
      const isRoot = data.id === "root";
      const bgColor = isRoot
        ? "bg-[#f0f4ea] text-[#36573c]"
        : "bg-[#36573c] text-white";
      // Use different leaf / plant icons for types
      const iconMap: Record<string, string> = {
        object: "🌿",
        array: "🍃",
        string: "🌱",
        number: "🪴",
        boolean: "🍀",
        null: "🍂",
      };
      const iconStr = iconMap[type] || "🌱";
      return (
        <div
          className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-sm ${bgColor}`}
        >
          {iconStr}
        </div>
      );
    }
    if (nodeTheme === "chess") {
      const typeIcon =
        type === "object"
          ? "♔"
          : type === "array"
            ? "♖"
            : type === "string"
              ? "♘"
              : type === "number"
                ? "♗"
                : type === "boolean"
                  ? "♙"
                  : "♙";
      return (
        <div className="w-5 h-5 flex items-center justify-center text-[#d4af37] text-lg font-serif opacity-90 drop-shadow-sm">
          {typeIcon}
        </div>
      );
    }
    if (nodeTheme === "octopus") {
      const typeColorText: Record<string, string> = {
        object: "text-[#3b82f6]",
        array: "text-[#a855f7]",
        string: "text-[#06b6d4]",
        number: "text-[#2dd4bf]",
        boolean: "text-[#3b82f6]",
        null: "text-[#ec4899]",
      };
      const tColor = typeColorText[type] || "text-[#94a3b8]";

      return (
        <div
          className={`w-7 h-7 flex items-center justify-center text-[22px] drop-shadow-[0_0_5px_currentColor] ${tColor} opacity-90`}
        >
          🪼
        </div>
      );
    }
    if (nodeTheme === "ludo") {
      const ludoColors = [
        "bg-[#ff4d4d]",
        "bg-[#2ecc71]",
        "bg-[#f1c40f]",
        "bg-[#3498db]",
      ];
      const colorClass =
        ludoColors[
          Math.abs(data.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) %
            4
        ];
      const initial =
        type === "object"
          ? "O"
          : type === "array"
            ? "A"
            : type === "string"
              ? "T"
              : type === "number"
                ? "#"
                : type === "boolean"
                  ? "B"
                  : "?";
      return (
        <div
          className={`${colorClass} w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm ring-2 ${appTheme === "dark" ? "ring-white/10" : "ring-black/5"} shadow-md`}
        >
          {initial}
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

  const baseClasses = getThemeClasses(nodeTheme);

  // Custom tweaks per theme
  const isDarkBase =
    [
      "vscode",
      "github",
      "cyberpunk",
      "terminal",
      "material",
      "blueprint",
      "glassmorphism",
      "gradient",
      "holographic",
      "custom",
      "nature",
      "banyan",
      "peepal",
      "circuit",
      "galaxy",
      "glass",
      "neon",
      "neural",
      "river",
      "tree",
      "pixel",
      "hacker",
      "dna",
      "lava",
      "ocean",
      "rhythm",
      "rune",
      "abstract",
      "chess",
      "octopus",
    ].includes(nodeTheme) ||
    (nodeTheme === "nature2" && data.id === "root") ||
    (nodeTheme === "hydrogen" && appTheme === "dark") ||
    (nodeTheme === "seed" && data.id === "root");
  const isLightBase =
    ["minimal", "pastel", "math", "cloud", "zen", "architect", "ludo"].includes(
      nodeTheme,
    ) ||
    (nodeTheme === "nature2" && data.id !== "root") ||
    (nodeTheme === "hydrogen" && appTheme !== "dark") ||
    (nodeTheme === "seed" && data.id !== "root");

  // Text color logic
  const isCustom = nodeTheme === "custom";
  const mutedText = isCustom
    ? ""
    : nodeTheme === "hydrogen"
      ? appTheme === "dark"
        ? "text-blue-300"
        : "text-blue-500"
      : nodeTheme === "seed" && data.id !== "root"
        ? "text-[#5d8048]"
        : nodeTheme === "nature2" && data.id !== "root"
          ? "text-[#385c40]"
          : isDarkBase
            ? "text-white/50"
            : isLightBase
              ? "text-slate-500"
              : nodeTheme === "retro"
                ? "text-[#8a2be2]/70"
                : "text-black/50";
  const valText = isCustom
    ? ""
    : nodeTheme === "hydrogen"
      ? appTheme === "dark"
        ? "text-blue-200"
        : "text-blue-700"
      : nodeTheme === "ludo"
        ? "text-black"
        : nodeTheme === "seed" && data.id !== "root"
          ? "text-[#1c2e19]"
          : nodeTheme === "nature2" && data.id !== "root"
            ? "text-[#1a3821]"
            : isDarkBase
              ? "text-white/90"
              : isLightBase
                ? "text-slate-900"
                : nodeTheme === "retro"
                  ? "text-[#8a2be2]/90"
                  : "text-black/90";
  const labelText = isCustom ? "" : ""; // Label usually inherits or has own logic

  let highlightClasses = "";
  if (isActiveMatch) {
    highlightClasses = "!ring-4 !ring-emerald-400 !shadow-[0_0_20px_rgba(52,211,153,0.8)] !brightness-125 !z-[120] !border-emerald-400";
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

  let fWidth = isApiNode ? 340 : isMedia ? 320 : (nodeTheme === "peepal" || nodeTheme === "banyan" ? 220 : 260);
  let fHeight = isMedia
    ? mediaType === "audio"
      ? 140
      : 240
    : isApiNode
      ? 140
      : isExpanded
        ? (nodeTheme === "peepal" || nodeTheme === "banyan" ? 440 : 300)
        : (nodeTheme === "peepal" || nodeTheme === "banyan" ? 310 : 120);

  const isDefaultShape = nodeShape === "default";

  let shapeClasses = `rounded-md px-3 py-1.5 min-w-[120px] ${isApiNode ? "max-w-[340px]" : "max-w-[260px]"}`;
  let shapeStyle: React.CSSProperties = {};

  // Apply Theme-Specific Shapes ONLY if shape is at 'default'
  if (isDefaultShape) {
    switch (nodeTheme) {
      case "nature":
        shapeClasses = "px-6 py-4 min-w-[150px] flex items-center justify-center";
        // A much smoother 12-point leaf polygon
        shapeStyle.clipPath =
          "polygon(50% 0%, 75% 5%, 95% 20%, 100% 45%, 95% 75%, 75% 92%, 50% 100%, 25% 92%, 5% 75%, 0% 45%, 5% 20%, 25% 5%)";
        break;
      case "banyan":
        shapeClasses = "w-full h-full flex flex-col items-center justify-center text-center overflow-hidden";
        shapeStyle.width = "100%";
        shapeStyle.height = "100%";
        shapeStyle.paddingTop = "25%";
        shapeStyle.paddingBottom = "30%";
        shapeStyle.paddingLeft = "15%";
        shapeStyle.paddingRight = "15%";
        // Beautiful 20-point elliptical Banyan leaf clipPath with slight pointed top apex and elegant stalk base
        shapeStyle.clipPath =
          "polygon(50% 3%, 64% 7%, 78% 16%, 88% 30%, 94% 48%, 93% 66%, 84% 81%, 70% 92%, 55% 96%, 52% 100%, 48% 100%, 45% 96%, 30% 92%, 16% 81%, 7% 66%, 6% 48%, 12% 30%, 22% 16%, 36% 7%)";
        break;
      case "peepal":
        shapeClasses = "w-full h-full flex flex-col items-center justify-center text-center overflow-hidden";
        shapeStyle.width = "100%";
        shapeStyle.height = "100%";
        shapeStyle.paddingTop = "22%";
        shapeStyle.paddingBottom = "36%";
        shapeStyle.paddingLeft = "14%";
        shapeStyle.paddingRight = "14%";
        // Masterpiece calculated 25-point Peepal leaf polygon: smooth shoulders, top cleft, and organic S-curving long tail
        shapeStyle.clipPath =
          "polygon(50% 16%, 38% 6%, 24% 4%, 10% 12%, 3% 26%, 1% 42%, 6% 56%, 18% 68%, 32% 76%, 42% 82%, 45% 88%, 43% 94%, 39% 100%, 41% 100%, 46% 94%, 48% 88%, 50% 82%, 60% 76%, 74% 68%, 88% 56%, 97% 42%, 99% 26%, 90% 12%, 76% 4%, 62% 6%)";
        break;
      case "nature2":
        shapeClasses = "px-5 py-2.5 min-w-[140px] rounded-full";
        break;
      case "seed":
        shapeClasses =
          data.id === "root"
            ? "px-6 py-3 min-w-[150px] rounded-full"
            : "px-5 py-2.5 min-w-[140px] rounded-full";
        break;
      case "hydrogen":
        shapeClasses =
          data.id === "root"
            ? "px-8 py-4 min-w-[180px] rounded-[2rem]"
            : "px-5 py-2.5 min-w-[140px] rounded-full";
        break;
      case "circuit":
        shapeClasses = "px-4 py-2 min-w-[140px]";
        shapeStyle.clipPath =
          "polygon(0% 15%, 15% 0%, 85% 0%, 100% 15%, 100% 85%, 85% 100%, 15% 100%, 0% 85%)";
        break;
      case "galaxy":
        shapeClasses =
          "px-5 py-5 min-w-[150px] aspect-square justify-center text-center";
        shapeStyle.borderRadius = "50%";
        break;
      case "glass":
        shapeClasses = "px-4 py-2 min-w-[130px]";
        shapeStyle.borderRadius = "12px";
        shapeStyle.transform = "skewX(-5deg)";
        break;
      case "neon":
        shapeClasses = "px-4 py-2 min-w-[130px] border-2";
        shapeStyle.borderRadius = "0px";
        break;
      case "math":
        shapeClasses = "px-5 py-1.5 min-w-[120px]";
        shapeStyle.borderRadius = "4px 20px 4px 20px";
        break;
      case "neural":
        shapeClasses =
          "px-6 py-6 min-w-[160px] aspect-square rounded-full flex-col";
        break;
      case "river":
        shapeClasses = "px-5 py-3 min-w-[140px]";
        shapeStyle.borderRadius = "40px 10px 40px 10px";
        break;
      case "tree":
        shapeClasses = "px-4 py-2 min-w-[130px]";
        shapeStyle.clipPath =
          "polygon(5% 0%, 95% 0%, 100% 20%, 100% 80%, 95% 100%, 5% 100%, 0% 80%, 0% 20%)";
        break;
      case "pixel":
        shapeClasses = "px-4 py-2 min-w-[120px]";
        shapeStyle.boxShadow =
          "calc(-1 * 4px) 0 0 #1a1c2c, 4px 0 0 #1a1c2c, 0 calc(-1 * 4px) 0 #1a1c2c, 0 4px 0 #1a1c2c";
        break;
      case "hacker":
        shapeClasses = "px-4 py-2 min-w-[130px] border-x-2 border-y-0";
        break;
      case "cloud":
        shapeClasses = "px-6 py-4 min-w-[150px]";
        shapeStyle.borderRadius = "50px 50px 10px 10px";
        break;
      case "dna":
        shapeClasses = "px-3 py-6 min-w-[100px] flex-col";
        shapeStyle.borderRadius = "100px";
        break;
      case "lava":
        shapeClasses = "px-5 py-3 min-w-[140px]";
        shapeStyle.clipPath =
          "polygon(0% 20%, 20% 0%, 100% 10%, 90% 90%, 10% 100%)";
        break;
      case "ocean":
        shapeClasses = "px-4 py-4 min-w-[150px]";
        shapeStyle.borderRadius = "30% 70% 70% 30% / 30% 30% 70% 70%";
        break;
      case "rhythm":
        shapeClasses = "px-4 py-2 min-w-[130px] border-l-4";
        break;
      case "rune":
        shapeClasses = "px-6 py-3 min-w-[140px]";
        shapeStyle.clipPath =
          "polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)";
        break;
      case "zen":
        shapeClasses = "px-8 py-2 min-w-[140px] border-b";
        shapeStyle.borderRadius = "0px";
        break;
      case "abstract":
        shapeClasses = "px-4 py-3 min-w-[150px]";
        shapeStyle.clipPath = "polygon(10% 0%, 100% 20%, 90% 100%, 0% 80%)";
        break;
      case "ludo": {
        const ludoColors = [
          "border-[#ff4d4d]",
          "border-[#2ecc71]",
          "border-[#f1c40f]",
          "border-[#3498db]",
        ];
        const borderColor =
          ludoColors[
            Math.abs(
              data.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0),
            ) % 4
          ];
        const isLudoNodeDark = appTheme === "dark";
        shapeClasses = `px-4 py-3 min-w-[150px] rounded-xl border-4 ${borderColor} ${isLudoNodeDark ? "bg-[#f8fafc] shadow-[0_10px_20px_-5px_rgba(0,0,0,0.5)]" : "bg-white/95 shadow-[0_10px_20px_-5px_rgba(0,0,0,0.3)]"} backdrop-blur-md transition-transform overflow-visible`;
        break;
      }
      case "chess": {
        shapeClasses =
          "px-4 py-3 min-w-[150px] rounded-sm bg-[#151b29] border border-[#d4af37]/40 shadow-[0_4px_15px_-3px_rgba(0,0,0,0.5),_inset_0_0_8px_rgba(212,175,55,0.1)] transition-transform overflow-visible font-serif";
        break;
      }
      case "octopus": {
        const typeColors: Record<string, string> = {
          object:
            "border-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.3),_inset_0_0_10px_rgba(59,130,246,0.2)]",
          array:
            "border-[#a855f7] shadow-[0_0_15px_rgba(168,85,247,0.3),_inset_0_0_10px_rgba(168,85,247,0.2)]",
          string:
            "border-[#06b6d4] shadow-[0_0_15px_rgba(6,182,212,0.3),_inset_0_0_10px_rgba(6,182,212,0.2)]",
          number:
            "border-[#2dd4bf] shadow-[0_0_15px_rgba(45,212,191,0.3),_inset_0_0_10px_rgba(45,212,191,0.2)]",
          boolean:
            "border-[#3b82f6] shadow-[0_0_15px_rgba(59,130,246,0.3),_inset_0_0_10px_rgba(59,130,246,0.2)]",
          null: "border-[#ec4899] shadow-[0_0_15px_rgba(236,72,153,0.3),_inset_0_0_10px_rgba(236,72,153,0.2)]",
        };
        const nodeColorClass =
          typeColors[data.type] ||
          "border-[#94a3b8] shadow-[0_0_15px_rgba(148,163,184,0.3),_inset_0_0_10px_rgba(148,163,184,0.2)]";
        shapeClasses = `px-5 py-3 pr-8 min-w-[150px] rounded-[24px] bg-[#050a1f]/80 backdrop-blur-xl border ${nodeColorClass} transition-transform overflow-visible relative`;
        break;
      }
      case "architect":
        shapeClasses = "px-4 py-2 min-w-[140px] border-slate-400 border-2";
        shapeStyle.outline = "1px solid #94a3b8";
        shapeStyle.outlineOffset = "4px";
        break;
    }
    
    if (!shapeStyle.maxWidth) {
      shapeStyle.maxWidth = isApiNode ? "340px" : isMedia ? "320px" : "260px";
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

  if (!isDefaultShape) {
    switch (nodeShape) {
      case "circle":
        fWidth = isMedia ? 320 : 200;
        fHeight = isMedia ? 240 : 200;
        shapeClasses =
          "rounded-full justify-center text-center p-6 min-w-[160px] max-w-[200px]";
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

  fWidth *= nodeSize;
  fHeight *= nodeSize;

  return (
    <foreignObject
      ref={foreignRef}
      x={node.x - fWidth / 2}
      y={node.y - fHeight / 2}
      width={fWidth}
      height={fHeight}
      className={`transition-all duration-500 ease-out origin-center ${isDimmed ? "opacity-30 grayscale scale-95" : "opacity-100"} ${isMatch || isSelected ? "z-[100]" : isAncestor || isSelectedPath ? "z-[90]" : "z-[50]"}`}
      style={{ overflow: "visible", touchAction: "none" }}
    >
      {nodeTheme === "seed" && data.id === "root" && (
        <div
          className="absolute left-1/2 -translate-x-1/2 top-4 w-[240px] h-[350px] pointer-events-none"
          style={{ zIndex: -10 }}
        >
          <svg viewBox="0 0 240 350" width="100%" height="100%">
            <defs>
              <radialGradient id="soilGrad" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#4a2e1b" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#5d3921" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#8c5836" stopOpacity="0" />
              </radialGradient>
              <linearGradient
                id="seedColor"
                x1="0%"
                y1="0%"
                x2="100%"
                y2="100%"
              >
                <stop offset="0%" stopColor="#a36e3c" />
                <stop offset="100%" stopColor="#3d2110" />
              </linearGradient>
            </defs>

            <ellipse cx="120" cy="200" rx="110" ry="80" fill="url(#soilGrad)" />

            {/* Roots */}
            <path
              d="M 120 190 C 100 230, 50 280, 20 320 M 120 190 C 140 240, 200 300, 220 330 M 120 190 C 110 250, 90 290, 100 340 M 130 200 C 150 230, 140 280, 160 320 M 110 220 C 80 250, 70 270, 60 300"
              stroke="#362312"
              strokeWidth="2.5"
              fill="none"
              opacity="0.8"
            />

            {/* Seed */}
            <g transform="translate(120, 170)">
              <ellipse
                cx="-15"
                cy="0"
                rx="28"
                ry="42"
                fill="url(#seedColor)"
                transform="rotate(-15)"
              />
              <ellipse
                cx="15"
                cy="0"
                rx="28"
                ry="42"
                fill="url(#seedColor)"
                transform="rotate(15)"
              />
              <path
                d="M 0 -35 C -10 -15, -10 25, 0 40 C 10 25, 10 -15, 0 -35"
                fill="#f0d5a8"
                opacity="0.9"
              />
            </g>

            {/* Stem */}
            <path
              d="M 120 140 C 115 100, 90 80, 120 20"
              stroke="#7eaa54"
              strokeWidth="6"
              fill="none"
              strokeLinecap="round"
            />

            {/* Leaves on stem */}
            <path d="M 112 100 C 70 100, 50 60, 102 90" fill="#5c8a38" />
            <path d="M 126 60 C 170 50, 190 90, 115 70" fill="#5c8a38" />
          </svg>
        </div>
      )}
      <div
        className={`flex flex-col items-center justify-center w-full h-full transition-all duration-300 ${isMatch || isSelected ? "scale-105" : ""} ${dropShadowClass}`}
      >
        <div
          className={`pointer-events-auto select-none relative flex ${isMedia ? "flex-col" : "items-center"} border cursor-pointer hover:brightness-125 transition-all duration-300 flex-shrink-0 ${baseClasses} ${highlightClasses} ${shapeClasses}`}
          style={{
            ...shapeStyle,
            transform: `scale(${nodeSize})`,
            transformOrigin: "center",
            touchAction: "none",
          }}
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
          {nodeTheme === "nature" && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-20">
              <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-white -translate-x-1/2" />
              <div className="absolute top-[30%] left-[55%] w-[40%] h-0.5 bg-white -rotate-[30deg]" />
              <div className="absolute top-[30%] right-[55%] w-[40%] h-0.5 bg-white rotate-[30deg]" />
              <div className="absolute top-[60%] left-[52%] w-[45%] h-0.5 bg-white -rotate-[20deg]" />
              <div className="absolute top-[60%] right-[52%] w-[45%] h-0.5 bg-white rotate-[20deg]" />
            </div>
          )}
          {nodeTheme === "banyan" && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-60">
                {/* Organic, straight-ish thick golden central midrib with strong vascular definition */}
                <path d="M 50 4 Q 50 50 50 96" fill="none" stroke="#ffeaa7" strokeWidth="1.3" strokeLinecap="round" />
                
                {/* Beautifully spaced golden secondary veins arching up and out at ~40 degree angles */}
                {/* Pair 1 - top */}
                <path d="M 50 15 Q 68 18 84 22" fill="none" stroke="#ffeaa7" strokeWidth="0.55" opacity="0.8" strokeLinecap="round" />
                <path d="M 50 15 Q 32 18 16 22" fill="none" stroke="#ffeaa7" strokeWidth="0.55" opacity="0.8" strokeLinecap="round" />

                {/* Pair 2 */}
                <path d="M 50 28 Q 72 31 88 38" fill="none" stroke="#ffeaa7" strokeWidth="0.55" opacity="0.8" strokeLinecap="round" />
                <path d="M 50 28 Q 28 31 12 38" fill="none" stroke="#ffeaa7" strokeWidth="0.55" opacity="0.8" strokeLinecap="round" />

                {/* Pair 3 */}
                <path d="M 50 42 Q 74 46 90 54" fill="none" stroke="#ffeaa7" strokeWidth="0.55" opacity="0.8" strokeLinecap="round" />
                <path d="M 50 42 Q 26 46 10 54" fill="none" stroke="#ffeaa7" strokeWidth="0.55" opacity="0.8" strokeLinecap="round" />

                {/* Pair 4 */}
                <path d="M 50 56 Q 74 61 88 71" fill="none" stroke="#ffeaa7" strokeWidth="0.55" opacity="0.8" strokeLinecap="round" />
                <path d="M 50 56 Q 26 61 12 71" fill="none" stroke="#ffeaa7" strokeWidth="0.55" opacity="0.8" strokeLinecap="round" />

                {/* Pair 5 */}
                <path d="M 50 70 Q 72 75 84 83" fill="none" stroke="#ffeaa7" strokeWidth="0.5" opacity="0.7" strokeLinecap="round" />
                <path d="M 50 70 Q 28 75 16 83" fill="none" stroke="#ffeaa7" strokeWidth="0.5" opacity="0.7" strokeLinecap="round" />

                {/* Pair 6 - bottom */}
                <path d="M 50 83 Q 66 87 74 91" fill="none" stroke="#ffeaa7" strokeWidth="0.45" opacity="0.6" strokeLinecap="round" />
                <path d="M 50 83 Q 34 87 26 91" fill="none" stroke="#ffeaa7" strokeWidth="0.45" opacity="0.6" strokeLinecap="round" />
                
                {/* Tertiary intricate vein net highlights (subtle web patterns to feel incredibly rich and premium) */}
                <path d="M 68 18 Q 74 24 88 38 M 32 18 Q 26 24 12 38" fill="none" stroke="#ffeaa7" strokeWidth="0.25" opacity="0.3" strokeLinecap="round" />
                <path d="M 72 31 Q 78 38 90 54 M 28 31 Q 22 38 10 54" fill="none" stroke="#ffeaa7" strokeWidth="0.25" opacity="0.3" strokeLinecap="round" />
                <path d="M 74 46 Q 80 54 88 71 M 26 46 Q 20 54 12 71" fill="none" stroke="#ffeaa7" strokeWidth="0.25" opacity="0.3" strokeLinecap="round" />
              </svg>
              {/* Glossy highlight to represent the heavy, polished, photorealistic shine of banyan leaf rubbery surface */}
              <div className="absolute top-0 left-0 w-full h-[150%] bg-gradient-to-br from-white/25 via-transparent to-transparent -rotate-12 translate-x-1/8 -translate-y-1/2 opacity-90" />
            </div>
          )}
          {nodeTheme === "peepal" && (
            <div className="absolute inset-0 pointer-events-none overflow-hidden">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full opacity-80">
                {/* Organic, naturally curved Midrib (S-shaped to match the tail) */}
                <path d="M 50 16 Q 50 40 50 70 T 40 100" fill="none" stroke="#daf379" strokeWidth="1.2" strokeLinecap="round" />
                
                {/* Symmetric but organic lateral veins branching out at angles */}
                <path d="M 50 25 Q 65 20 85 18" fill="none" stroke="#daf379" strokeWidth="0.5" opacity="0.6" strokeLinecap="round" />
                <path d="M 50 25 Q 35 20 15 18" fill="none" stroke="#daf379" strokeWidth="0.5" opacity="0.6" strokeLinecap="round" />

                <path d="M 50 38 Q 63 34 88 32" fill="none" stroke="#daf379" strokeWidth="0.5" opacity="0.6" strokeLinecap="round" />
                <path d="M 50 38 Q 37 34 12 32" fill="none" stroke="#daf379" strokeWidth="0.5" opacity="0.6" strokeLinecap="round" />

                <path d="M 50 51 Q 65 47 88 47" fill="none" stroke="#daf379" strokeWidth="0.5" opacity="0.6" strokeLinecap="round" />
                <path d="M 50 51 Q 35 47 12 47" fill="none" stroke="#daf379" strokeWidth="0.5" opacity="0.6" strokeLinecap="round" />

                <path d="M 50 64 Q 63 61 80 64" fill="none" stroke="#daf379" strokeWidth="0.5" opacity="0.6" strokeLinecap="round" />
                <path d="M 50 64 Q 37 61 20 64" fill="none" stroke="#daf379" strokeWidth="0.5" opacity="0.6" strokeLinecap="round" />

                <path d="M 49 76 Q 58 74 68 78" fill="none" stroke="#daf379" strokeWidth="0.4" opacity="0.5" strokeLinecap="round" />
                <path d="M 49 76 Q 40 74 30 78" fill="none" stroke="#daf379" strokeWidth="0.4" opacity="0.5" strokeLinecap="round" />

                <path d="M 46 87 Q 52 86 58 90" fill="none" stroke="#daf379" strokeWidth="0.3" opacity="0.4" strokeLinecap="round" />
                <path d="M 46 87 Q 40 86 34 90" fill="none" stroke="#daf379" strokeWidth="0.3" opacity="0.4" strokeLinecap="round" />
              </svg>
              {/* Glossy top-right sun highlight simulation */}
              <div className="absolute top-0 right-0 w-[90%] h-[130%] bg-gradient-to-bl from-white/20 via-transparent to-transparent -rotate-[15deg] translate-x-1/4 -translate-y-1/2" />
            </div>
          )}
          {nodeTheme === "ludo" && (
            <>
              <div
                className={`absolute -top-1.5 -left-1.5 w-3 h-3 rounded-full shadow-inner ${["bg-[#ff4d4d]", "bg-[#2ecc71]", "bg-[#f1c40f]", "bg-[#3498db]"][Math.abs(data.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % 4]}`}
              />
              <div
                className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full shadow-inner ${["bg-[#ff4d4d]", "bg-[#2ecc71]", "bg-[#f1c40f]", "bg-[#3498db]"][Math.abs(data.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % 4]}`}
              />
              <div
                className={`absolute -bottom-1.5 -left-1.5 w-3 h-3 rounded-full shadow-inner ${["bg-[#ff4d4d]", "bg-[#2ecc71]", "bg-[#f1c40f]", "bg-[#3498db]"][Math.abs(data.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % 4]}`}
              />
              <div
                className={`absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full shadow-inner ${["bg-[#ff4d4d]", "bg-[#2ecc71]", "bg-[#f1c40f]", "bg-[#3498db]"][Math.abs(data.id.split("").reduce((a, b) => a + b.charCodeAt(0), 0)) % 4]}`}
              />
            </>
          )}
          {nodeTheme === "octopus" && (
            <div className="absolute right-3 top-1/2 flex flex-col gap-1.5 -translate-y-1/2 opacity-70">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#67e8f9]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#67e8f9]"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_6px_#67e8f9]"></div>
            </div>
          )}
          <div
            className={`flex w-full min-w-0 ${isMedia ? "items-start mb-2" : "items-center"}`}
          >
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

            <div
              className="flex flex-col overflow-hidden w-full max-w-full px-1 min-w-0 leading-tight py-0.5"
              style={{
                ...(isCustom ? { color: nodeTextColor } : {}),
                ...(nodeTheme === "peepal" || nodeTheme === "banyan" || nodeTheme === "nature" ? { textShadow: "0 2px 5px rgba(0,0,0,0.95)" } : {})
              }}
            >
              <div className="flex items-baseline space-x-1.5 w-full max-w-full overflow-hidden">
                <span
                  className={`pointer-events-none font-mono text-xs font-semibold ${nodeTheme === "peepal" || nodeTheme === "banyan" ? "whitespace-normal break-all line-clamp-2" : "truncate"} max-w-full ${nodeTheme === "cyberpunk" ? "drop-shadow-md" : ""}`}
                  title={data.name}
                >
                  {data.name}
                </span>
                {data.type !== "object" && data.type !== "array" && (
                  <span
                    className={`pointer-events-none text-[10px] uppercase font-bold px-1 rounded-sm ${nodeTheme === "hydrogen" ? "bg-transparent" : "bg-black/10"} tracking-widest ${mutedText}`}
                    style={{
                      ...(isCustom ? { color: nodeTextColor, opacity: 0.7 } : {}),
                      ...(nodeTheme === "peepal" || nodeTheme === "banyan" || nodeTheme === "nature" ? { textShadow: "0 2px 5px rgba(0,0,0,0.95)" } : {})
                    }}
                  >
                    {data.type}
                  </span>
                )}
              </div>
              {data.value !== undefined && !isMedia && !isApiNode && (
                <div className="flex flex-col flex-1 min-w-0 mt-0.5 relative group/val w-full max-w-full h-full overflow-hidden">
                  <div className={`flex-1 min-w-0 ${isExpanded ? `overflow-y-auto ${nodeTheme === "peepal" || nodeTheme === "banyan" ? "max-h-[140px]" : "max-h-[180px]"} custom-scrollbar pr-1` : "overflow-hidden"}`}>
                    <span
                      className={`text-[11px] font-mono leading-normal ${
                        isExpanded
                          ? "whitespace-pre-wrap break-all"
                          : nodeTheme === "peepal" || nodeTheme === "banyan"
                            ? "line-clamp-3 whitespace-normal break-all block"
                            : "truncate w-full max-w-full block"
                      } ${valText}`}
                      title={!isExpanded ? String(data.value) : undefined}
                      style={{
                        ...(isCustom ? { color: nodeTextColor, opacity: 0.9 } : {}),
                        ...(nodeTheme === "peepal" || nodeTheme === "banyan" || nodeTheme === "nature" ? { textShadow: "0 2px 5px rgba(0,0,0,0.95)" } : {})
                      }}
                    >
                      {String(data.value)}
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
                <ApiNodeRenderer 
                  url={strVal} 
                  path={data.path} 
                  nodeId={data.id}
                  nodeX={node.x}
                  nodeY={node.y}
                  nodeWidth={fWidth}
                />
              )}
              {hasChildren && isCollapsed && (
                <span
                  className={`pointer-events-none text-[10px] mt-0.5 italic ${mutedText}`}
                  style={isCustom ? { color: nodeTextColor, opacity: 0.6 } : {}}
                >
                  {data.children!.length} item
                  {data.children!.length !== 1 ? "s" : ""}
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
            <div className="flex flex-col w-full mt-2 relative group/media-container">
              <div
                className={`w-full rounded bg-black/20 overflow-hidden border border-white/5 ${mediaType === "smart" ? "flex flex-1 items-stretch" : "p-1 flex justify-center items-center"}`}
              >
                {mediaType === "image" && (
                  <SmartFallbackMedia
                    type="image"
                    src={strVal}
                    alt={data.name}
                    className="max-w-full max-h-[160px] object-contain rounded"
                  />
                )}
                {mediaType === "audio" && (
                  <SmartFallbackMedia
                    type="audio"
                    src={strVal}
                    controls
                    className="w-full h-11 outline-none py-1"
                  />
                )}
                {mediaType === "video" && (
                  <video
                    src={strVal}
                    controls
                    className="max-w-full max-h-[160px] rounded focus:outline-none"
                  />
                )}
                {mediaType === "3d-model" && (() => {
                  const ModelViewer = 'model-viewer' as any;
                  return (
                    <ModelViewer
                      src={strVal}
                      alt={data.name || "3D Model"}
                      auto-rotate
                      camera-controls
                      style={{ width: "100%", height: "160px", backgroundColor: "transparent" }}
                    />
                  );
                })()}
                {mediaType === "pdf" && (
                  <div className="flex flex-col items-center justify-center p-4 w-full h-[160px] bg-gradient-to-br from-rose-500/5 to-rose-600/10 dark:from-rose-500/10 dark:to-rose-600/20 rounded border border-rose-500/20 text-center gap-1.5 cursor-pointer">
                    <div className="p-2 rounded-full bg-rose-500/10 text-rose-500 animate-pulse">
                      <FileText size={22} />
                    </div>
                    <div className="text-xs font-semibold text-rose-700 dark:text-rose-400 font-sans">
                      PDF Document
                    </div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono truncate max-w-full px-2" title={strVal.split('/').pop()}>
                      {strVal.split('/').pop() || "document.pdf"}
                    </div>
                    <span className="text-[9px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 font-mono">
                      Click Full Preview below
                    </span>
                  </div>
                )}
                {mediaType === "smart" && (
                  <SmartMediaRenderer
                    key={strVal}
                    url={strVal}
                    onMediaFailed={() => setSmartMediaFailed(true)}
                  />
                )}
              </div>

              <button
                className={`absolute ${mediaType === "audio" ? "top-1 right-1" : "bottom-1.5 left-1/2 -translate-x-1/2"} flex items-center gap-1.5 px-2 py-1 bg-black/60 hover:bg-indigo-600 backdrop-blur-md text-white rounded-full text-[9px] font-bold tracking-tight transition-all opacity-0 group-hover/media-container:opacity-100 shadow-xl border border-white/10 z-20 whitespace-nowrap`}
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePreviewMedia({
                    url: strVal,
                    type:
                      mediaType === "smart"
                        ? "smart"
                        : (mediaType === "pdf" || strVal.match(/\.pdf(\?.*)?$/i))
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
    </foreignObject>
  );
}
