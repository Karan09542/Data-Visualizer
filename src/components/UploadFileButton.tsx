import React, { useEffect, useRef, useState } from "react";
import {
  Upload,
  Image as ImageIcon,
  Music,
  Film,
  Box,
  FileText,
  Braces,
  Sheet,
  Type,
} from "lucide-react";
import CustomSelect from "./CustomSelect";

/**
 * The upload button. A click opens the file picker for every supported type; right-click on a
 * desktop, or press and hold on a touch screen, offers one kind of file at a time, so the picker
 * opens already filtered to it.
 */

/** File kinds the importer (utils/fileProcessor.ts) can handle, and the picker filter for each */
const FILE_KINDS = [
  { value: "image", label: "Image", description: "PNG, JPG, GIF, WebP, SVG", icon: <ImageIcon size={15} />, accept: "image/*" },
  { value: "audio", label: "Audio", description: "MP3, WAV, OGG, M4A, FLAC", icon: <Music size={15} />, accept: "audio/*" },
  { value: "video", label: "Video", description: "MP4, WebM, MOV", icon: <Film size={15} />, accept: "video/*" },
  { value: "model", label: "3D model", description: "GLB, GLTF, OBJ, STL, FBX", icon: <Box size={15} />, accept: ".glb,.gltf,.obj,.stl,.fbx,model/*" },
  { value: "pdf", label: "PDF", description: "PDF documents", icon: <FileText size={15} />, accept: "application/pdf,.pdf" },
  { value: "data", label: "Data", description: "JSON, YAML, CSV, TSV, XML", icon: <Braces size={15} />, accept: ".json,.yaml,.yml,.csv,.tsv,.xml,application/json" },
  { value: "sheet", label: "Spreadsheet", description: "Excel XLSX, XLS", icon: <Sheet size={15} />, accept: ".xlsx,.xls" },
  { value: "text", label: "Text", description: "TXT, Markdown", icon: <Type size={15} />, accept: ".txt,.md,text/plain,text/markdown" },
];

const ACCEPT_ALL = FILE_KINDS.map((kind) => kind.accept).join(",");

const MENU_OPTIONS = [
  { value: "all", label: "Any supported file", description: "Data, documents and media", icon: <Upload size={15} /> },
  ...FILE_KINDS.map(({ accept: _accept, ...option }) => option),
];

/** How long a press has to last to open the menu on a touch screen */
const LONG_PRESS_MS = 500;
/** A finger that moves further than this is scrolling, not pressing */
const LONG_PRESS_SLOP = 10;

interface UploadFileButtonProps {
  onFiles: (files: File[]) => void;
  className?: string;
  /** Classes for the wrapper, for example to fill a grid cell */
  wrapperClassName?: string;
  title?: string;
  /** id for the hidden file input; voice commands find the main one by id */
  inputId?: string;
  children: React.ReactNode;
}

export default function UploadFileButton({
  onFiles,
  className = "",
  wrapperClassName = "",
  title = "Upload a file (right-click or hold to pick a type)",
  inputId,
  children,
}: UploadFileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  // The tap that ends a long press must not also open the picker
  const swallowClick = useRef(false);

  const cancelPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  useEffect(() => cancelPress, []);

  const openPicker = (accept: string) => {
    const input = inputRef.current;
    if (!input) return;
    input.accept = accept;
    input.click();
  };

  const handleKind = (value: string) => {
    openPicker(FILE_KINDS.find((kind) => kind.value === value)?.accept ?? ACCEPT_ALL);
  };

  return (
    <>
      <CustomSelect
        value=""
        options={MENU_OPTIONS}
        onChange={handleKind}
        open={menuOpen}
        onOpenChange={setMenuOpen}
        menuTitle="Upload a specific type"
        className={wrapperClassName}
        renderTrigger={({ ref, props }) => (
          <button
            ref={ref}
            type="button"
            title={title}
            {...props}
            onKeyDown={(e) => {
              // Enter and Space open the picker like a click; the arrow keys open the type menu
              if (!menuOpen && (e.key === "Enter" || e.key === " ")) return;
              props.onKeyDown(e);
            }}
            onClick={() => {
              if (swallowClick.current) {
                swallowClick.current = false;
                return;
              }
              if (menuOpen) {
                setMenuOpen(false);
                return;
              }
              openPicker(ACCEPT_ALL);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              cancelPress();
              setMenuOpen(true);
            }}
            onPointerDown={(e) => {
              // A new press starts fresh, even if Android's own long-press menu ate the last tap
              swallowClick.current = false;
              if (e.pointerType === "mouse") return;
              cancelPress();
              const timer = window.setTimeout(() => {
                press.current = null;
                swallowClick.current = true;
                navigator.vibrate?.(10);
                setMenuOpen(true);
              }, LONG_PRESS_MS);
              press.current = { timer, x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
              const p = press.current;
              if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_SLOP) cancelPress();
            }}
            onPointerUp={cancelPress}
            onPointerCancel={cancelPress}
            onPointerLeave={cancelPress}
            // No iOS callout or text selection while holding
            style={{ WebkitTouchCallout: "none", userSelect: "none" }}
            className={className}
          >
            {children}
          </button>
        )}
      />
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        hidden
        accept={ACCEPT_ALL}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Cleared so choosing the same file again still fires
          e.target.value = "";
          if (files.length) onFiles(files);
        }}
      />
    </>
  );
}
