/**
 * A brush-size ring that follows the pointer.
 *
 * Deliberately a DOM element rather than a CSS cursor: browsers refuse cursor
 * images past roughly 128px, so a large brush would draw a ring smaller than
 * the area it affects - the one thing a size indicator must never do.
 *
 * Knows nothing about fabric, React or canvases; it needs a host element to sit
 * inside and a diameter in screen pixels, so any tool can use it.
 */
export class BrushCursor {
  private host: HTMLElement;
  private element: HTMLDivElement | null = null;

  /** Cached host box; reading it per pointer move forces a layout. */
  private hostRect: DOMRect | null = null;
  private frame = 0;
  private pending: { x: number; y: number; diameter: number } | null = null;
  private visible = false;

  private invalidateRect = () => {
    this.hostRect = null;
  };

  constructor(host: HTMLElement) {
    this.host = host;
    window.addEventListener('resize', this.invalidateRect);
    window.addEventListener('scroll', this.invalidateRect, true);
  }

  /** Moves the ring under the pointer at the given on-screen diameter. */
  show(clientX: number, clientY: number, diameter: number): void {
    this.pending = { x: clientX, y: clientY, diameter };
    this.visible = true;
    if (this.frame) return;

    // Pointer events outrun the display, and each update writes styles, so
    // coalescing to a frame keeps this off the input path.
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      this.paint();
    });
  }

  hide(): void {
    this.visible = false;
    if (this.element) this.element.style.display = 'none';
  }

  /** Ring colour, e.g. to distinguish erase from restore. */
  setColor(color: string): void {
    const element = this.ensureElement();
    if (element) element.style.borderColor = color;
  }

  /** Call after a zoom or layout change so the next paint re-measures. */
  refresh(): void {
    this.hostRect = null;
    if (this.visible) this.paint();
  }

  destroy(): void {
    window.removeEventListener('resize', this.invalidateRect);
    window.removeEventListener('scroll', this.invalidateRect, true);

    if (this.frame) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
    }
    this.element?.parentElement?.removeChild(this.element);
    this.element = null;
    this.pending = null;
    this.visible = false;
  }

  private ensureElement(): HTMLDivElement | null {
    if (this.element) return this.element;
    if (!this.host) return null;

    const element = document.createElement('div');
    element.setAttribute('data-brush-cursor', '');
    element.style.cssText = [
      'position:absolute',
      'left:0',
      'top:0',
      'display:none',
      'pointer-events:none',
      'border-radius:50%',
      'border:1.5px solid rgba(255,255,255,0.95)',
      'box-shadow:0 0 0 1px rgba(0,0,0,0.55), inset 0 0 0 1px rgba(0,0,0,0.35)',
      'transform:translate(-50%,-50%)',
      'will-change:left,top,width,height',
      'z-index:40',
    ].join(';');

    this.host.appendChild(element);
    this.element = element;
    return element;
  }

  private paint(): void {
    const point = this.pending;
    if (!point || !this.visible) return;

    const element = this.ensureElement();
    if (!element) return;

    if (!this.hostRect) this.hostRect = this.host.getBoundingClientRect();
    const bounds = this.hostRect;

    const diameter = Math.max(2, point.diameter);
    element.style.width = diameter + 'px';
    element.style.height = diameter + 'px';
    element.style.left = point.x - bounds.left + 'px';
    element.style.top = point.y - bounds.top + 'px';
    element.style.display = 'block';
  }
}
