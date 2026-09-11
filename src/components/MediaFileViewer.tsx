/**
 * A media file, shown as itself.
 *
 * The file's value is an id in the asset store or a URL, so an editor would only ever show that
 * id as text. This resolves it and plays or draws the thing: pictures on a chequerboard with a
 * fit/actual-size switch, video and sound with their controls, PDFs in a frame.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Download, ExternalLink, FileQuestion, Maximize2, Minimize2, Pencil } from "lucide-react";
import CustomAudioPlayer from "./CustomAudioPlayer";
import { resolveAssetUrl } from "../utils/assetManager";
import { mediaKindLabel, type MediaFile } from "../utils/mediaFiles";

export interface MediaFileViewerProps {
  /** The file's name, with its extension. */
  name: string;
  media: MediaFile;
  /** Offered for images: leave the preview and open the editor. */
  onOpenEditor?: () => void;
}

const toolbarButton =
  "inline-flex items-center gap-1.5 px-2 py-1 rounded-[4px] text-[11px] font-medium text-[var(--vsc-fg-muted,#616161)] hover:text-[var(--vsc-fg,#3b3b3b)] hover:bg-[var(--vsc-hover,rgba(0,0,0,0.06))] transition-colors cursor-pointer";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function MediaFileViewer({ name, media, onOpenEditor }: MediaFileViewerProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [size, setSize] = useState<number | null>(null);
  const [actualSize, setActualSize] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState("loading");
    setUrl(null);
    setDimensions(null);
    setSize(null);

    const load = async () => {
      if (!media.isAsset) {
        if (!cancelled) {
          setUrl(media.source);
          setState("ready");
        }
        return;
      }
      const resolved = await resolveAssetUrl(media.source).catch(() => "");
      if (cancelled) return;
      if (!resolved) {
        setState("missing");
        return;
      }
      setUrl(resolved);
      setState("ready");
      // Only for the footer; a failure here does not stop the file being shown.
      try {
        const response = await fetch(resolved);
        const blob = await response.blob();
        if (!cancelled) setSize(blob.size);
      } catch {
        // Size stays unknown.
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [media.source, media.isAsset]);

  const details = useMemo(() => {
    const parts = [mediaKindLabel(media.kind)];
    if (dimensions) parts.push(`${dimensions.width} × ${dimensions.height}`);
    if (size !== null) parts.push(formatBytes(size));
    return parts.join(" · ");
  }, [media.kind, dimensions, size]);

  return (
    <div className="flex flex-col h-full w-full bg-[var(--vsc-editor,#ffffff)] text-[var(--vsc-fg,#3b3b3b)] overflow-hidden">
      {/* What it is, and what can be done with it */}
      <div className="flex items-center justify-between gap-2 px-3 h-8 shrink-0 border-b border-[var(--vsc-border,#e5e5e5)] bg-[var(--vsc-panel,#f8f8f8)]">
        <span className="text-[11px] text-[var(--vsc-fg-muted,#616161)] truncate" title={name}>
          {details}
        </span>
        <div className="flex items-center gap-0.5 shrink-0">
          {media.kind === "image" && state === "ready" && (
            <button type="button" className={toolbarButton} onClick={() => setActualSize(!actualSize)}>
              {actualSize ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
              {actualSize ? "Fit" : "Actual size"}
            </button>
          )}
          {onOpenEditor && (
            <button type="button" className={toolbarButton} onClick={onOpenEditor} title="Open this image in the editor">
              <Pencil size={12} />
              Edit
            </button>
          )}
          {url && (
            <>
              <a className={toolbarButton} href={url} target="_blank" rel="noreferrer">
                <ExternalLink size={12} />
                Open
              </a>
              <a className={toolbarButton} href={url} download={name}>
                <Download size={12} />
                Download
              </a>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto custom-scrollbar flex items-center justify-center p-4">
        {state === "loading" && (
          <p className="text-xs text-[var(--vsc-fg-muted,#616161)]">Loading {mediaKindLabel(media.kind).toLowerCase()}...</p>
        )}

        {state === "missing" && (
          <div className="flex flex-col items-center gap-2 text-center max-w-sm">
            <FileQuestion size={28} className="text-[var(--vsc-fg-muted,#616161)]" />
            <p className="text-xs font-medium">This file's contents are not on this device</p>
            <p className="text-[11px] text-[var(--vsc-fg-muted,#616161)] leading-relaxed">
              The file points at <code className="font-mono">{media.source}</code>, which is not in this workspace's
              storage. It may have been imported on another device, or cleared.
            </p>
          </div>
        )}

        {state === "ready" && url && media.kind === "image" && (
          <div
            className="max-w-full max-h-full rounded-[3px]"
            style={{
              backgroundImage:
                "linear-gradient(45deg, rgba(128,128,128,0.18) 25%, transparent 25%), linear-gradient(-45deg, rgba(128,128,128,0.18) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, rgba(128,128,128,0.18) 75%), linear-gradient(-45deg, transparent 75%, rgba(128,128,128,0.18) 75%)",
              backgroundSize: "16px 16px",
              backgroundPosition: "0 0, 0 8px, 8px -8px, -8px 0px",
            }}
          >
            <img
              src={url}
              alt={name}
              onLoad={(e) => {
                const img = e.currentTarget;
                setDimensions({ width: img.naturalWidth, height: img.naturalHeight });
              }}
              className={actualSize ? "max-w-none" : "max-w-full max-h-[calc(100vh-14rem)] object-contain"}
            />
          </div>
        )}

        {state === "ready" && url && media.kind === "video" && (
          <video
            src={url}
            controls
            playsInline
            onLoadedMetadata={(e) =>
              setDimensions({ width: e.currentTarget.videoWidth, height: e.currentTarget.videoHeight })
            }
            className="max-w-full max-h-full rounded-[3px] bg-black"
          />
        )}

        {state === "ready" && url && media.kind === "audio" && (
          <div className="w-full max-w-md">
            <CustomAudioPlayer src={url} />
          </div>
        )}

        {state === "ready" && url && media.kind === "pdf" && (
          <iframe src={url} title={name} className="w-full h-full min-h-[60vh] border-0 rounded-[3px] bg-white" />
        )}
      </div>
    </div>
  );
}
