import { useEffect, useRef, type RefObject } from "react";

/**
 * Pasting inside Quick Utilities.
 *
 * The app has window-level paste listeners (the global import modal, the image workspace) that
 * would grab a pasted image. While the Quick Utilities popup is open, `useQuickUtilsPasteGuard`
 * catches the paste first, stops it from reaching those listeners, and hands any images to the
 * open tool through `useClipboardImages`.
 */

const PASTE_EVENT = "quick-utils:paste-images";

interface PastePayload {
  images: File[];
}

const filesFromClipboard = (data: DataTransfer): File[] => {
  const files = Array.from(data.files);
  if (files.length > 0) return files;

  // Some browsers only expose a copied image through items
  return Array.from(data.items)
    .filter((item) => item.kind === "file")
    .map((item) => item.getAsFile())
    .filter((file): file is File => !!file);
};

const isEditable = (target: EventTarget | null) =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLTextAreaElement ||
  (target instanceof HTMLElement && (target.isContentEditable || !!target.closest(".monaco-editor")));

/** Keeps every paste inside the popup while it is open. Mount once, in the Quick Utilities modal. */
export function useQuickUtilsPasteGuard(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    const onPaste = (e: ClipboardEvent) => {
      const data = e.clipboardData;
      if (!data) return;

      const files = filesFromClipboard(data);

      // Plain text going into a text box is an ordinary paste, leave it alone
      if (files.length === 0 && isEditable(e.target)) return;

      // Nothing behind the popup gets to see this paste
      e.stopPropagation();
      if (files.length === 0) return;

      e.preventDefault();
      const images = files.filter((file) => file.type.startsWith("image/"));
      window.dispatchEvent(new CustomEvent<PastePayload>(PASTE_EVENT, { detail: { images } }));
    };

    // Capture phase on window runs before every other paste listener in the app
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
  }, [isOpen]);
}

interface ClipboardImageOptions {
  /** Turn off while something else owns the screen, like the camera */
  enabled?: boolean;
  /** For tools that stay mounted while hidden: only react while this element is on screen */
  rootRef?: RefObject<HTMLElement | null>;
}

/** Calls `onImages` with the images pasted while this Quick Utilities tool is showing */
export function useClipboardImages(onImages: (images: File[]) => void, { enabled = true, rootRef }: ClipboardImageOptions = {}) {
  const onImagesRef = useRef(onImages);
  useEffect(() => {
    onImagesRef.current = onImages;
  });

  useEffect(() => {
    if (!enabled) return;

    const onPasteImages = (e: Event) => {
      const { images } = (e as CustomEvent<PastePayload>).detail;
      if (images.length === 0) return;
      if (rootRef) {
        const root = rootRef.current;
        if (!root || root.getClientRects().length === 0) return;
      }
      onImagesRef.current(images);
    };

    window.addEventListener(PASTE_EVENT, onPasteImages);
    return () => window.removeEventListener(PASTE_EVENT, onPasteImages);
  }, [enabled, rootRef]);
}
