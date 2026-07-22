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

    // Draw collage image if assigned
    const isColBlock = this.isCollageBlock;

    if (isColBlock && this.collageImage) {
      ctx.save();
      // Clip to the rect's path (which includes the rounded corners)
      ctx.clip();

      // Use filtered image if available, otherwise original
      const img = this._filteredCollageImage || this.collageImage;
      const fit = this.collageImageFit || 'cover';
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;
      const zoom = this.collageImageZoom || 1;
      const panX = this.collageImagePanX || 0;
      const panY = this.collageImagePanY || 0;

      let scaleX = w / imgW;
      let scaleY = h / imgH;
      let scale = 1;

      if (fit === 'cover') {
         scale = Math.max(scaleX, scaleY);
      } else if (fit === 'contain') {
         scale = Math.min(scaleX, scaleY);
      } else if (fit === 'stretch') {
         // stretch doesn't use uniform scale
      } else if (fit === 'original') {
         scale = 1;
      }

      let drawW = imgW * scale;
      let drawH = imgH * scale;

      if (fit === 'stretch') {
         drawW = w;
         drawH = h;
      }

      // Center the image by default
      const dx = x + (w - drawW) / 2 + panX;
      const dy = y + (h - drawH) / 2 + panY;

      // Apply transforms
      const flipX = this.collageImageFlipX ? -1 : 1;
      const flipY = this.collageImageFlipY ? -1 : 1;
      const rot = this.collageImageRotation || 0;

      // Translate to center of image for rotation/flip
      ctx.translate(dx + drawW/2, dy + drawH/2);
      if (rot !== 0) ctx.rotate((rot * Math.PI) / 180);
      ctx.scale(flipX, flipY);
      
      // Draw image from -width/2, -height/2
      ctx.globalAlpha *= this.collageImageOpacity !== undefined ? this.collageImageOpacity : 1;
      ctx.drawImage(img, -drawW * zoom / 2, -drawH * zoom / 2, drawW * zoom, drawH * zoom);

      ctx.restore();
    }
  };

  // Add a setter for collageImageSrc that automatically loads the HTMLImageElement
  Object.defineProperty(fabric.Rect.prototype, 'collageImageSrc', {
    get: function() {
      return this._collageImageSrc;
    },
    set: function(src) {
      if (this._collageImageSrc === src) return;
      this._collageImageSrc = src;
      
      if (!src) {
        this.collageImage = null;
        this.dirty = true;
        if (this.canvas) this.canvas.requestRenderAll();
        return;
      }

      const img = new Image();
      img.onload = () => {
        this.collageImage = img;
        this.dirty = true;
        if (this.canvas) this.canvas.requestRenderAll();
      };
      img.src = src;
    },
    enumerable: true,
    configurable: true
  });

  // Polyfill applyFilters for collage blocks to support Filter Studio pipeline
  (fabric.Rect.prototype as any).applyFilters = function() {
    if (!this.isCollageBlock || !this.collageImage) return;
    
    try {
      // Create a temporary fabric.Image to run the filter pipeline
      if (!this._tempImageForFilters) {
        this._tempImageForFilters = new fabric.Image(this.collageImage);
      } else {
        this._tempImageForFilters.setElement(this.collageImage);
      }
      
      this._tempImageForFilters.filters = this.filters || [];
      this._tempImageForFilters.applyFilters();
      
      // Stash the filtered result for _render
      this._filteredCollageImage = this._tempImageForFilters._element || this._tempImageForFilters._filteredEl || this.collageImage;
    } catch (err) {
      console.error("Error applying filters to collage block:", err);
      this._filteredCollageImage = this.collageImage;
    }
    
    this.dirty = true;
    if (this.canvas) this.canvas.requestRenderAll();
  };

  // Ensure all custom properties are serialized
  const originalRectToObject = fabric.Rect.prototype.toObject;
  (fabric.Rect.prototype as any).toObject = function (propertiesToInclude: string[] = []) {
    return originalRectToObject.call(this, [
      'cornerRoundingPercent',
      'useIndividualCorners',
      'cornerTopLeftPercent',
      'cornerTopRightPercent',
      'cornerBottomRightPercent',
      'cornerBottomLeftPercent',
      'isCollageBlock',
      'artboardId',
      'collageImageSrc',
      'collageImageFit',
      'collageImageZoom',
      'collageImagePanX',
      'collageImagePanY',
      'collageImageRotation',
      'collageImageFlipX',
      'collageImageFlipY',
      'collageImageOpacity',
      ...propertiesToInclude
    ]);
  };
}

