import * as fabric from 'fabric';

/**
 * Where an image's untouched pixels sit on the canvas.
 *
 * Crop mode lays a full, uncropped copy of the image under a crop rectangle. Getting that copy's
 * position right is the whole trick: if it is off, the crop box and the picture appear in different
 * places and every crop is taken from the wrong pixels.
 *
 * The subtlety is that `calcTransformMatrix()` maps from a local space whose origin is always the
 * object's **centre**, no matter what `originX`/`originY` say. Code that offsets by half the size
 * only for centre-origin objects lands exactly half the object's size away for every other origin -
 * which is why the misalignment appeared on some images and not others.
 *
 * A stroke does not disturb this: it expands symmetrically, so the content still spans
 * -width/2 .. +width/2 about the same centre.
 */

/** The image's full (pre-crop) top-left corner, in the object's own local coordinates. */
export const localFullImageTopLeft = (obj: {
  width?: number;
  height?: number;
  cropX?: number;
  cropY?: number;
}): fabric.Point => new fabric.Point(
  -(obj.width || 0) / 2 - (obj.cropX || 0),
  -(obj.height || 0) / 2 - (obj.cropY || 0)
);

/** The same corner in scene coordinates, correct through any origin, rotation, scale or group. */
export const sceneFullImageTopLeft = (obj: fabric.Object): fabric.Point =>
  fabric.util.transformPoint(localFullImageTopLeft(obj as any), obj.calcTransformMatrix());

/** The visible (already cropped) top-left corner in scene coordinates. */
export const sceneVisibleTopLeft = (obj: fabric.Object): fabric.Point =>
  fabric.util.transformPoint(
    new fabric.Point(-(obj.width || 0) / 2, -(obj.height || 0) / 2),
    obj.calcTransformMatrix()
  );
