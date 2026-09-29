import React, { useEffect, useRef, useState } from "react";
import { Check, ImagePlus, Loader2 } from "lucide-react";
import { useStore } from "../../store/useStore";
import { importFile } from "../../utils/assetManager";
import { insertNodes, toNodeKey } from "../../hooks/useInsertNode";

export interface CanvasImage {
  blob: Blob;
  /** Becomes the node's key (cleaned up, and made unique). */
  name: string;
}

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/bmp": "bmp",
};

/** A canvas as an image blob (PNG unless told otherwise). */
export const canvasToBlob = (canvas: HTMLCanvasElement, type = "image/png", quality?: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/** name → asset id, with each key cleaned and made unique like any node key. */
function groupValue(stored: { name: string; assetId: string }[]) {
  const value: Record<string, string> = {};
  for (const { name, assetId } of stored) {
    let key = toNodeKey(name);
    for (let n = 2; key in value; n++) key = `${toNodeKey(name)}_${n}`;
    value[key] = assetId;
  }
  return value;
}

/**
 * Puts edited images on the canvas as image nodes. Each image is stored in the
 * local asset library (like a camera capture), so the document holds a short
 * id such as img_ab12cd.png rather than the picture itself. Returns the new
 * node paths; the first is selected.
 */
export async function addImagesToCanvas(images: CanvasImage[], group?: string): Promise<string[]> {
  const stored: { name: string; assetId: string }[] = [];
  for (const { blob, name } of images) {
    const type = blob.type || "image/png";
    const ext = EXTENSIONS[type] ?? "png";
    const file = new File([blob], `${toNodeKey(name)}.${ext}`, { type });
    const { assetId } = await importFile(file);
    stored.push({ name, assetId });
  }
  // Many images (a sliced photo, say) go under one parent node instead of crowding the top level.
  const requests = group
    ? [{ name: group, value: groupValue(stored), kind: "asset" as const }]
    : stored.map(({ name, assetId }) => ({ name, value: assetId, kind: "asset" as const }));
  const paths = await insertNodes(requests);
  const store = useStore.getState();
  if (paths[0]) store.setSelectedNodeId(paths[0]);
  store.setNotification({
    type: "success",
    message:
      stored.length === 1 ? "Added to the canvas as an image node" : `Added ${stored.length} image nodes to the canvas`,
  });
  return paths;
}

interface AddToCanvasButtonProps {
  /** The image(s) to add, made when clicked. Null or empty: nothing to add yet. */
  getImages: () => Promise<CanvasImage | CanvasImage[] | null> | CanvasImage | CanvasImage[] | null;
  /** Put several images under one parent node with this name. */
  group?: string;
  disabled?: boolean;
  label?: string;
  title?: string;
  /** Replaces the default look, to match the buttons around it. */
  className?: string;
  iconSize?: number;
  /** Hide the text on narrow screens, like the buttons it sits beside. */
  compactLabel?: boolean;
}

/** "Add to canvas": the edited image becomes an image node. */
export const AddToCanvasButton: React.FC<AddToCanvasButtonProps> = ({
  getImages,
  group,
  disabled,
  label = "Add to canvas",
  title = "Add the result to the canvas as an image node",
  className,
  iconSize = 14,
  compactLabel = false,
}) => {
  const [state, setState] = useState<"idle" | "adding" | "added">("idle");
  const reset = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(reset.current), []);

  const onClick = async () => {
    if (state === "adding") return;
    setState("adding");
    try {
      const got = await getImages();
      const images = (Array.isArray(got) ? got : got ? [got] : []).filter((i) => i.blob && i.blob.size > 0);
      if (images.length === 0) {
        setState("idle");
        return;
      }
      await addImagesToCanvas(images, images.length > 1 ? group : undefined);
      setState("added");
      clearTimeout(reset.current);
      reset.current = setTimeout(() => setState("idle"), 2000);
    } catch (err) {
      console.error("Add to canvas failed", err);
      useStore.getState().setNotification({ type: "error", message: "Couldn't add the image to the canvas." });
      setState("idle");
    }
  };

  const Icon = state === "adding" ? Loader2 : state === "added" ? Check : ImagePlus;
  const text = state === "adding" ? "Adding…" : state === "added" ? "Added" : label;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || state === "adding"}
      title={title}
      aria-label={label}
      className={
        className ??
        "inline-flex items-center justify-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      }
    >
      <Icon size={iconSize} className={state === "adding" ? "animate-spin" : ""} />
      <span className={compactLabel ? "hidden sm:inline" : ""}>{text}</span>
    </button>
  );
};
