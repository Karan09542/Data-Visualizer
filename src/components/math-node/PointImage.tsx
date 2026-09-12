import React from "react";

interface PointImageProps {
  src: string;
  /** Where the image is centred, in graph coordinates. */
  at: [number, number];
  /** Size in graph units, so it scales with zoom like anything else on the plane. */
  width: number;
  height: number;
  opacity?: number;
  rotation?: number;
}

/** Default width in graph units for a newly added image. */
export const DEFAULT_IMAGE_WIDTH = 2;
/** Uploaded images are downscaled to this, so documents don't balloon. */
export const MAX_UPLOAD_PIXELS = 512;

/** An image drawn in place of a point. */
export const PointImage: React.FC<PointImageProps> = ({
  src,
  at,
  width,
  height,
  opacity = 1,
  rotation = 0,
}) => {
  const [cx, cy] = at;
  if (!src || !(width > 0) || !(height > 0)) return null;

  return (
    <image
      href={src}
      x={cx - width / 2}
      y={cy - height / 2}
      width={width}
      height={height}
      preserveAspectRatio="none"
      style={{
        // The view transform flips y (maths is y-up, SVG is y-down), which would show
        // the picture upside down, so flip it back about its own centre.
        transform: `var(--mafs-view-transform) translate(${cx}px, ${cy}px) scale(1, -1) rotate(${-rotation}deg) translate(${-cx}px, ${-cy}px)`,
        opacity,
        pointerEvents: "none",
      }}
    />
  );
};

/**
 * Reads a picked file into a data URL, downscaled so the saved document stays small.
 * Returns the source and its aspect ratio (width / height).
 */
export function readImageFile(
  file: File,
  maxPixels = MAX_UPLOAD_PIXELS,
): Promise<{ src: string; aspect: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.onload = () => {
      const original = String(reader.result || "");
      const img = new Image();
      img.onerror = () => reject(new Error("That file isn't an image the browser can read."));
      img.onload = () => {
        const { naturalWidth: w, naturalHeight: h } = img;
        if (!w || !h) {
          reject(new Error("That image has no size."));
          return;
        }
        const aspect = w / h;
        const scale = Math.min(1, maxPixels / Math.max(w, h));
        if (scale >= 1) {
          resolve({ src: original, aspect });
          return;
        }
        try {
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(w * scale));
          canvas.height = Math.max(1, Math.round(h * scale));
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({ src: original, aspect });
            return;
          }
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // PNG keeps transparency, which matters for marker-style images.
          resolve({ src: canvas.toDataURL("image/png"), aspect });
        } catch {
          resolve({ src: original, aspect });
        }
      };
      img.src = original;
    };
    reader.readAsDataURL(file);
  });
}

/** Aspect ratio (width / height) of an image URL, for sizing it sensibly. */
export function imageAspect(src: string): Promise<number> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1);
    img.onerror = () => resolve(1);
    img.src = src;
  });
}
