const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

const labelGizmoSource = `                              {/* Label Position Handle */}
                              {f.showLabel && f.label && f.isDraggable &&
                                (!activeGizmo ||
                                  activeGizmo.id !== f.id ||
                                  activeGizmo.type === "label") && (
                                  <MovablePoint
                                    point={localToGlobal(
                                      px + (f.labelPosition?.[0] ?? 0.3),
                                      py + (f.labelPosition?.[1] ?? 0.3)
                                    )}
                                    color="rgba(150, 150, 150, 0.5)"
                                    onMove={(pt) => {
                                      handleGizmoMove(f.id, "label");
                                      const baseGlobal = localToGlobal(px, py);
                                      const dX = pt[0] - baseGlobal[0];
                                      const dY = pt[1] - baseGlobal[1];
                                      
                                      // We need to un-rotate and un-scale to get local offset.
                                      // Actually, the label follows transforms, but we just store its local offset.
                                      // If the graph is scaled or rotated, the offset visually scales!
                                      // Let's compute local offset:
                                      const cos = Math.cos(-(rot));
                                      const sin = Math.sin(-(rot));
                                      
                                      let localDx = dX * cos - dY * sin;
                                      let localDy = dX * sin + dY * cos;
                                      
                                      const scaleX = sx || 1;
                                      const scaleY = sy || 1;
                                      localDx /= scaleX;
                                      localDy /= scaleY;
                                      
                                      setFunctions((prev) =>
                                        prev.map((fn) =>
                                          fn.id === f.id
                                            ? {
                                                ...fn,
                                                labelPosition: [localDx, localDy],
                                              }
                                            : fn,
                                        ),
                                      );
                                    }}
                                  />
                                )}`;

// Wait, the gizmos container is down around line 8050. Let's just append labelGizmoSource before "f.isPivotEnabled && ("
const pivotRegex = /                              \{\/\* Pivot Editor\/Handle/;
code = code.replace(pivotRegex, labelGizmoSource + '\n\n                              {/* Pivot Editor/Handle');

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
