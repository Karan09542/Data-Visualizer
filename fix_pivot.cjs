const fs = require('fs');

let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

const pivotSection = `                                  <MovablePoint
                                    point={[px + tx, py + ty]}
                                    color="#3b82f6"
                                    onMove={(pt) => {
                                      handleGizmoMove(f.id, "pivot");
                                      setFunctions((prev) =>
                                        prev.map((fn) =>
                                          fn.id === f.id
                                            ? {
                                                ...fn,
                                                transformPivot: [
                                                  pt[0] - tx,
                                                  pt[1] - ty,
                                                ],
                                              }
                                            : fn,
                                        ),
                                      );
                                    }}
                                  />`;

const newPivotSection = `                                  <MovablePoint
                                    point={[px + tx, py + ty]}
                                    color="#3b82f6"
                                    onMove={(pt) => {
                                      handleGizmoMove(f.id, "pivot");
                                      
                                      // Math for keeping the object physically stationary:
                                      // old pivot global = px + tx
                                      const ptOld = [px + tx, py + ty];
                                      const dGlobal = [pt[0] - ptOld[0], pt[1] - ptOld[1]];
                                      
                                      // A = R(rot) * R(base) * S(sx,sy) * R(-base)
                                      const c1 = Math.cos(rot + baseAngle);
                                      const s1 = Math.sin(rot + baseAngle);
                                      const c2 = Math.cos(-baseAngle);
                                      const s2 = Math.sin(-baseAngle);
                                      
                                      // For A^-1, we invert them backwards: R(base) * S(1/sx, 1/sy) * R(-base - rot)
                                      const invRot = -rot - baseAngle;
                                      const ic1 = Math.cos(invRot);
                                      const is1 = Math.sin(invRot);
                                      
                                      let vX = dGlobal[0] * ic1 - dGlobal[1] * is1;
                                      let vY = dGlobal[0] * is1 + dGlobal[1] * ic1;
                                      
                                      vX /= (sx || 1);
                                      vY /= (sy || 1);
                                      
                                      const bc1 = Math.cos(baseAngle);
                                      const bs1 = Math.sin(baseAngle);
                                      
                                      const dLocalX = vX * bc1 - vY * bs1;
                                      const dLocalY = vX * bs1 + vY * bc1;
                                      
                                      const pNewX = px + dLocalX;
                                      const pNewY = py + dLocalY;
                                      
                                      const tNewX = pt[0] - pNewX;
                                      const tNewY = pt[1] - pNewY;

                                      setFunctions((prev) =>
                                        prev.map((fn) =>
                                          fn.id === f.id
                                            ? {
                                                ...fn,
                                                transformPivot: [pNewX, pNewY],
                                                transformTranslate: [tNewX, tNewY]
                                              }
                                            : fn,
                                        ),
                                      );
                                    }}
                                  />`;

code = code.replace(pivotSection, newPivotSection);

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
