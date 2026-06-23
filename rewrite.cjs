const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

// The closing of the translate={[-px, -py]} is around line 7669.
// We want to extract lines 7972 to 8263 (approx) and put them inside the transform block.
// Let's do it cleanly!

const beforeBlock = `                                        {f.type === "line" &&
                                          points.length >= 2 &&
                                          (f.lineStyle &&
                                          f.lineStyle !== "solid" ? (
                                            <g
                                              style={
                                                {
                                                  "--mafs-line-stroke-dash-style":
                                                    getStrokeDasharray(
                                                      f.lineStyle,
                                                    ),
                                                } as React.CSSProperties
                                              }
                                            >
                                              <Line.Segment
                                                point1={points[0]}
                                                point2={points[1]}
                                                color={f.color}
                                                style="dashed"
                                              />
                                            </g>
                                          ) : (
                                            <Line.Segment
                                              point1={points[0]}
                                              point2={points[1]}
                                              color={f.color}
                                              style="solid"
                                            />
                                          ))}
                                      </Transform>`;

const blockEndPos = code.indexOf(beforeBlock) + beforeBlock.length;

let newContent = `
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
                                                return [
                                                  Number(arr[0]),
                                                  Number(arr[1]),
                                                ];
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
                                          id={f.id}
                                          compiledLHS={f.compiled}
                                          compiledRHS={f.compiled2}
                                          operator={f.expr2 || "<="}
                                          baseScope={baseScope}
                                          color={f.color}
                                          fillColor={f.fillColor}
                                          fillOpacity={
                                            f.fillOpacity !== undefined ? f.fillOpacity : 0.3
                                          }
                                          fillPattern={f.fillPattern}
                                          patternSpacing={f.patternSpacing}
                                          patternThickness={f.patternThickness}
                                          patternAngle={f.patternAngle}
                                          samplingDepth={samplingDepth}
                                          weight={
                                            hoveredVar &&
                                            new RegExp(\`\\\\b\${hoveredVar}\\\\b\`).test(f.expr)
                                              ? 6
                                              : 3
                                          }
                                          tx={0}
                                          ty={0}
                                          lineStyle={f.lineStyle}
                                        />
                                      )}

                                      {!isPointBased && f.type === "implicit" && (
                                        <ImplicitPlot
                                          key={f.id}
                                          compiledLHS={f.compiled}
                                          compiledRHS={f.compiled2}
                                          baseScope={baseScope}
                                          color={f.color}
                                          samplingDepth={samplingDepth}
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
                                          tx={0}
                                          ty={0}
                                          lineStyle={f.lineStyle}
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
                                              return [
                                                r * Math.cos(tVal),
                                                r * Math.sin(tVal),
                                              ];
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

                                      {!isPointBased && f.type === "explicit" && (
                                        <Plot.OfX
                                          minSamplingDepth={samplingDepth}
                                          maxSamplingDepth={samplingDepth}
                                          y={(x) => {
                                            try {
                                              const res = f.compiled.evaluate({
                                                ...baseScope,
                                                x: x,
                                              });
                                              if (typeof res === "object" && res.im !== undefined)
                                                return NaN;
                                              return Number(res);
                                            } catch {
                                              return NaN;
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
`;

code = code.substring(0, blockEndPos) + newContent + code.substring(blockEndPos);

const toRemoveMatch = code.match(/                  if \(f.type === "parametric"\) \{[\s\S]*?                  \/\/ Cartesian default[\s\S]*?                  \);[\s\S]*?                }[\s\S]*?                return null;/);

if (toRemoveMatch) {
   let replacing = `                  // Handled under <Transform> blocks
                  return null;
                }
                return null;`;
   code = code.replace(toRemoveMatch[0], replacing);
}

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
