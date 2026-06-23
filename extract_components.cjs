const fs = require('fs');

let code = fs.readFileSync('src/modify_ast.cjs', 'utf8');

// The Transform hierarchy starts at `<Transform translate={[tx, ty]}>` and ends at `</Transform>` 7 times.
// Let's find the content of the innermost `<Transform translate={[-px, -py]}>` and extract the non-point blocks.

const startMarker = '<Transform translate={[-px, -py]}>';
const startIdx = code.indexOf(startMarker);
if (startIdx === -1) {
    console.error("Start marker not found");
    process.exit(1);
}

// We know the end of the transform blocks is just before `{/* Advanced Transformation Gizmos over the transformed geometry */}`
const endMarker = '{/* Advanced Transformation Gizmos over the transformed geometry */}';
const endIdx = code.indexOf(endMarker);

const innermostStartIndex = startIdx + startMarker.length;
let innermostContent = code.slice(innermostStartIndex, endIdx);

// It closes with 7 `</Transform>` tags.
// Let's remove the 7 `</Transform>` tags from the bottom of innermostContent.
innermostContent = innermostContent.replace(/(<\/Transform>\s*){7}/, '');

// Now innermostContent contains ALL render nodes.
// We want to separate them.
// Point blocks: f.type === "point", "vector", "polygon", "line".
// Continuous blocks: "polar", "parametric", "function", "inequality".
// And SafeLabel: !isPointBased && f.showLabel

// Let's split using Regex.
// It's safer to just do string manipulation or keep them as is and wrap the `isPointBased` checks in the `<Transform>` tree, 
// and place the `!isPointBased` checks OUTSIDE the `<Transform>` tree!

const renderTree = `
                          {isPointBased && (
                            <Transform translate={[tx, ty]}>
                              <Transform translate={[px, py]}>
                                <Transform rotate={rot}>
                                  <Transform rotate={baseAngle}>
                                    <Transform scale={[sx, sy]}>
                                      <Transform rotate={-baseAngle}>
                                        <Transform translate={[-px, -py]}>
                                          {f.type === "point" &&
                                            points.map((p, i) => {
                                              const showLabel =
                                                f.showLabel && f.label;
                                              return (
                                                <React.Fragment key={i}>
                                                  {f.showPoint !== false && (
                                                    isBasicPointDraggable ? (
                                                      <MovablePoint
                                                        point={[p[0], p[1]]}
                                                        color={f.color}
                                                        onMove={(newPt) => {
                                                          let newExpr = \`[\${newPt[0].toFixed(2)}, \${newPt[1].toFixed(2)}]\`;
                                                          const match =
                                                            f.expr.match(
                                                              /^([^=]+=\\s*)/,
                                                            );
                                                          if (match) {
                                                            newExpr = \`\${match[1]}[\${newPt[0].toFixed(2)}, \${newPt[1].toFixed(2)}]\`;
                                                          }
                                                          setFunctions((prev) =>
                                                            prev.map((fn) =>
                                                              fn.id === f.id
                                                                ? {
                                                                    ...fn,
                                                                    expr: newExpr,
                                                                  }
                                                                : fn,
                                                            ),
                                                          );
                                                        }}
                                                      />
                                                    ) : (
                                                      <Point
                                                        x={p[0]}
                                                        y={p[1]}
                                                        color={f.color}
                                                      />
                                                    )
                                                  )}
                                                  {showLabel && (
                                                    <SafeLabel
                                                      at={[
                                                        p[0] + (f.labelPosition?.[0] ?? 0.3),
                                                        p[1] + (f.labelPosition?.[1] ?? 0.3),
                                                      ]}
                                                      tex={f.label}
                                                      color={f.color}
                                                    />
                                                  )}
                                                </React.Fragment>
                                              );
                                            })}
                                          {f.type === "vector" &&
                                            points.map((p, i) => (
                                              <Vector
                                                key={i}
                                                tail={[0, 0]}
                                                tip={p}
                                                color={f.color}
                                              />
                                            ))}
                                          {f.type === "polygon" &&
                                            points.length > 2 && (
                                              <Polygon
                                                points={points}
                                                color={f.color}
                                                fillOpacity={
                                                  f.fillOpacity !== undefined
                                                    ? f.fillOpacity
                                                    : 0.2
                                                }
                                                svgPolygonProps={{
                                                  style: {
                                                    strokeDasharray: getStrokeDasharray(f.lineStyle),
                                                  },
                                                }}
                                              />
                                            )}
                                          {f.type === "line" && points.length >= 2 && (
                                            <Line.Segment
                                              point1={points[0]}
                                              point2={points[1]}
                                              color={f.color}
                                              style="solid"
                                            />
                                          )}
                                        </Transform>
                                      </Transform>
                                    </Transform>
                                  </Transform>
                                </Transform>
                              </Transform>
                            </Transform>
                          )}

                          {!isPointBased && f.type === "parametric" && (
                                        <Plot.Parametric
                                          minSamplingDepth={samplingDepth}
                                          maxSamplingDepth={samplingDepth}
                                          xy={(t: number) => {
                                            try {
                                              const res = f.compiled.evaluate({
                                                ...baseScope,
                                                t,
                                              });
                                              const arr =
                                                res && res.toArray ? res.toArray() : res;
                                              if (Array.isArray(arr) && arr.length >= 2) {
                                                return applyForwardTransform([
                                                  Number(arr[0]),
                                                  Number(arr[1]),
                                                ]);
                                              }
                                              return [0, 0];
                                            } catch {
                                              return [0, 0];
                                            }
                                          }}
                                          t={[0, 2 * Math.PI]}
                                          color={f.color}
                                          weight={
                                            hoveredVar &&
                                            new RegExp(\`\\\\b\${hoveredVar}\\\\b\`).test(f.expr)
                                              ? 6
                                              : 3
                                          }
                                          opacity={
                                            hoveredVar
                                              ? new RegExp(\`\\\\b\${hoveredVar}\\\\b\`).test(f.expr)
                                                ? 1
                                                : 0.3
                                              : 1
                                          }
                                          style={
                                            f.lineStyle && f.lineStyle !== "solid"
                                              ? "dashed"
                                              : "solid"
                                          }
                                          svgPathProps={{
                                            style: {
                                              strokeDasharray: getStrokeDasharray(f.lineStyle),
                                            },
                                          }}
                                        />
                                      )}

                                      {!isPointBased && f.type === "inequality" && (
                                        <InequalityPlot
                                          compiledLHS={f.compiled}
                                          compiledRHS={f.compiled2}
                                          operator={f.operator || "<"}
                                          baseScope={baseScope}
                                          color={f.color}
                                          fillColor={f.fillColor}
                                          fillOpacity={f.fillOpacity !== undefined ? f.fillOpacity : 0.3}
                                          fillPattern={f.fillPattern}
                                          patternSpacing={f.patternSpacing}
                                          patternThickness={f.patternThickness}
                                          patternAngle={f.patternAngle}
                                          tx={tx}
                                          ty={ty}
                                          rot={rot}
                                          sx={sx}
                                          sy={sy}
                                          px={px}
                                          py={py}
                                          lineStyle={f.lineStyle}
                                          id={f.id}
                                        />
                                      )}

                                      {!isPointBased && f.type === "polar" && (
                                        <Plot.Parametric
                                          minSamplingDepth={samplingDepth}
                                          maxSamplingDepth={samplingDepth}
                                          xy={(tVal: number) => {
                                            try {
                                              const useThetaAsAngle = /\\btheta\\b/.test(f.expr);
                                              const scope = { ...baseScope };
                                              if (useThetaAsAngle) {
                                                scope.theta = tVal;
                                                scope.x = tVal;
                                              } else {
                                                scope.t = tVal;
                                                scope.x = tVal;
                                                scope.theta = tVal;
                                              }
                                              const r = Number(f.compiled.evaluate(scope));
                                              if (isNaN(r) || typeof r === "object")
                                                return [0, 0];
                                              return applyForwardTransform([
                                                r * Math.cos(tVal),
                                                r * Math.sin(tVal),
                                              ]);
                                            } catch {
                                              return [0, 0];
                                            }
                                          }}
                                          t={[0, 2 * Math.PI * 5]} // Up to 5 full rotations, can adjust if user wants varying domain
                                          color={f.color}
                                          weight={
                                            hoveredVar &&
                                            new RegExp(\`\\\\b\${hoveredVar}\\\\b\`).test(f.expr)
                                              ? 6
                                              : 3
                                          }
                                          opacity={
                                            hoveredVar
                                              ? new RegExp(\`\\\\b\${hoveredVar}\\\\b\`).test(f.expr)
                                                ? 1
                                                : 0.3
                                              : 1
                                          }
                                          style={
                                            f.lineStyle && f.lineStyle !== "solid"
                                              ? "dashed"
                                              : "solid"
                                          }
                                          svgPathProps={{
                                            style: {
                                              strokeDasharray: getStrokeDasharray(f.lineStyle),
                                            },
                                          }}
                                        />
                                      )}

                                      {!isPointBased && f.type === "function" && (
                                        <Plot.Parametric
                                          minSamplingDepth={samplingDepth}
                                          maxSamplingDepth={samplingDepth}
                                          t={[-50, 50]}
                                          xy={(t) => {
                                            try {
                                              const res = f.compiled.evaluate({
                                                ...baseScope,
                                                x: t,
                                              });
                                              if (typeof res === "object" && res.im !== undefined)
                                                return applyForwardTransform([t, NaN]);
                                              return applyForwardTransform([t, Number(res)]);
                                            } catch {
                                              return [t, NaN];
                                            }
                                          }}
                                          color={f.color}
                                          weight={
                                            hoveredVar &&
                                            new RegExp(\`\\\\b\${hoveredVar}\\\\b\`).test(f.expr)
                                              ? 6
                                              : 3
                                          }
                                          opacity={
                                            hoveredVar
                                              ? new RegExp(\`\\\\b\${hoveredVar}\\\\b\`).test(f.expr)
                                                ? 1
                                                : 0.3
                                              : 1
                                          }
                                          style={
                                            f.lineStyle && f.lineStyle !== "solid"
                                              ? "dashed"
                                              : "solid"
                                          }
                                          svgPathProps={{
                                            style: {
                                              strokeDasharray: getStrokeDasharray(f.lineStyle),
                                            },
                                          }}
                                        />
                                      )}

                                      {!isPointBased && f.showLabel && f.label && (
                                        <SafeLabel
                                          at={applyForwardTransform([px + (f.labelPosition?.[0] ?? 0.3), py + (f.labelPosition?.[1] ?? 0.3)])}
                                          tex={f.label}
                                          color={f.color}
                                        />
                                      )}

`;

const newCode = code.slice(0, startIdx) + renderTree + code.slice(endIdx);
fs.writeFileSync('src/components/MathNodeRenderer.tsx', newCode);
