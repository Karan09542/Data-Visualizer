import * as fabric from "fabric";

// Custom Fabric.Rect render override to support percentage and individual corner rounding
if (fabric && fabric.Rect && fabric.Rect.prototype) {
  const originalRectRender = fabric.Rect.prototype._render;
  (fabric.Rect.prototype as any)._render = function (ctx: CanvasRenderingContext2D) {
    const hasCustomRounding =
      this.cornerRoundingPercent !== undefined ||
      this.cornerTopLeftPercent !== undefined ||
      this.cornerTopRightPercent !== undefined ||
      this.cornerBottomRightPercent !== undefined ||
      this.cornerBottomLeftPercent !== undefined;

    if (!hasCustomRounding) {
      return originalRectRender.call(this, ctx);
    }

    const w = this.width || 0;
    const h = this.height || 0;
    const maxR = Math.min(w, h) / 2;

    const isIndiv = this.useIndividualCorners || false;
    const uniformPercent = this.cornerRoundingPercent ?? 0;

    const pTL = (isIndiv && this.cornerTopLeftPercent !== undefined) ? this.cornerTopLeftPercent : uniformPercent;
    const pTR = (isIndiv && this.cornerTopRightPercent !== undefined) ? this.cornerTopRightPercent : uniformPercent;
    const pBR = (isIndiv && this.cornerBottomRightPercent !== undefined) ? this.cornerBottomRightPercent : uniformPercent;
    const pBL = (isIndiv && this.cornerBottomLeftPercent !== undefined) ? this.cornerBottomLeftPercent : uniformPercent;

    const rTL = Math.max(0, Math.min(maxR, (pTL / 100) * maxR));
    const rTR = Math.max(0, Math.min(maxR, (pTR / 100) * maxR));
    const rBR = Math.max(0, Math.min(maxR, (pBR / 100) * maxR));
    const rBL = Math.max(0, Math.min(maxR, (pBL / 100) * maxR));

    const x = -w / 2;
    const y = -h / 2;

    ctx.beginPath();
    ctx.moveTo(x + rTL, y);

    ctx.lineTo(x + w - rTR, y);
    if (rTR > 0) {
      ctx.quadraticCurveTo(x + w, y, x + w, y + rTR);
    } else {
      ctx.lineTo(x + w, y);
    }

    ctx.lineTo(x + w, y + h - rBR);
    if (rBR > 0) {
      ctx.quadraticCurveTo(x + w, y + h, x + w - rBR, y + h);
    } else {
      ctx.lineTo(x + w, y + h);
    }

    ctx.lineTo(x + rBL, y + h);
    if (rBL > 0) {
      ctx.quadraticCurveTo(x, y + h, x, y + h - rBL);
    } else {
      ctx.lineTo(x, y + h);
    }

    ctx.lineTo(x, y + rTL);
    if (rTL > 0) {
      ctx.quadraticCurveTo(x, y, x + rTL, y);
    } else {
      ctx.lineTo(x, y);
    }

    ctx.closePath();
    this._renderPaintInOrder(ctx);
  };
}
