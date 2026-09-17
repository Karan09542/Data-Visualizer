import { useEffect, useRef, type RefObject } from 'react';

/**
 * Steadies the browser's native corner resize on a canvas node.
 *
 * Writing the size to the store on every frame of a resize sets off a fight the user sees as
 * vibration:
 *
 *  - the browser writes a fractional `style.width` as the corner is dragged
 *  - the observer reads `offsetWidth`, which is rounded to a whole pixel
 *  - that rounded value goes to the store, React re-renders and writes `style.width` back,
 *    overwriting the browser's value and nudging the element by a fraction of a pixel
 *  - a node is placed by its centre, so each nudge also moves it on screen
 *
 * So nothing is committed while the corner is held. The element is left to the browser, and a
 * transform keeps its top-left corner still, since a node grows from its centre. The final size
 * is stored once on release, in a single render.
 */
export function useNodeResize(
  ref: RefObject<HTMLElement | null>,
  commit: (width: number, height: number) => void,
) {
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let startSize: { width: number; height: number } | null = null;
    let observer: ResizeObserver | null = null;

    const stop = () => {
      observer?.disconnect();
      observer = null;
      window.removeEventListener('pointerup', finish);
      window.removeEventListener('pointercancel', finish);
    };

    function finish() {
      if (!startSize) {
        stop();
        return;
      }

      const began = startSize;
      startSize = null;
      stop();

      element!.style.transform = '';
      const width = Math.round(element!.offsetWidth);
      const height = Math.round(element!.offsetHeight);
      if (width !== Math.round(began.width) || height !== Math.round(began.height)) {
        commitRef.current(width, height);
      }
    }

    const onPointerDown = (e: PointerEvent) => {
      if (startSize) return;

      // The native gripper sits in the bottom-right corner of the element
      const rect = element.getBoundingClientRect();
      const onGripper = rect.right - e.clientX <= 20 && rect.bottom - e.clientY <= 20;
      if (!onGripper) return;

      startSize = { width: element.offsetWidth, height: element.offsetHeight };

      // Pinning from the observer, which reports after the size settles but before the paint
      observer = new ResizeObserver(() => {
        if (!startSize) return;
        const dx = (element.offsetWidth - startSize.width) / 2;
        const dy = (element.offsetHeight - startSize.height) / 2;
        element.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      observer.observe(element);

      window.addEventListener('pointerup', finish);
      window.addEventListener('pointercancel', finish);
    };

    element.addEventListener('pointerdown', onPointerDown);
    return () => {
      element.removeEventListener('pointerdown', onPointerDown);
      stop();
      element.style.transform = '';
    };
  }, [ref]);
}
