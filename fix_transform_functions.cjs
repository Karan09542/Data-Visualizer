const fs = require('fs');
let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

// replace f.type === "function" plot
const ofXPattern = /\{!isPointBased && f\.type === "function" && \(\s*<Plot\.OfX[\s\S]*?svgPathProps=\{\{\s*style: \{\s*strokeDasharray: getStrokeDasharray\(f\.lineStyle\),\s*\},\s*\}\}\s*\/>\s*\)\}/;

const parametricFunction = `{!isPointBased && f.type === "function" && (
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
                                                return [t, NaN];
                                              return [t, Number(res)];
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
                                      )}`;

code = code.replace(ofXPattern, parametricFunction);

// For inequality: inverse transform happens inside InequalityPlot.
// Let's modify InequalityPlot to accept transform matrices!
fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
