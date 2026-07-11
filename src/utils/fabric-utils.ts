import * as fabric from 'fabric';

export const getAbsoluteBoundingRect = (obj: fabric.Object) => {
   if (!obj.group) {
      return (obj as any).getBoundingRect();
   }
   const halfWidth = (obj.width || 0) / 2;
   const halfHeight = (obj.height || 0) / 2;
   const localCorners = [
      new fabric.Point(-halfWidth, -halfHeight),
      new fabric.Point(halfWidth, -halfHeight),
      new fabric.Point(halfWidth, halfHeight),
      new fabric.Point(-halfWidth, halfHeight)
   ];
   const matrix = obj.calcTransformMatrix();
   const worldCorners = localCorners.map(corner =>
      fabric.util.transformPoint(corner, matrix)
   );
   const xs = worldCorners.map(p => p.x);
   const ys = worldCorners.map(p => p.y);
   const minX = Math.min(...xs);
   const maxX = Math.max(...xs);
   const minY = Math.min(...ys);
   const maxY = Math.max(...ys);
   return {
      left: minX,
      top: minY,
      width: maxX - minX,
      height: maxY - minY
   };
};
