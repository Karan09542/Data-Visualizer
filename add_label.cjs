const fs = require('fs');

let code = fs.readFileSync('src/components/MathNodeRenderer.tsx', 'utf8');

code = code.replace(/                                          svgPathProps=\{\{\n                                            style: \{\n                                              strokeDasharray: getStrokeDasharray\(f\.lineStyle\),\n                                            \},\n                                          \}\}\n                                        \/>\n                                      \)\}\n                                      <\/Transform>/, (match) => {
    return `                                          svgPathProps={{
                                            style: {
                                              strokeDasharray: getStrokeDasharray(f.lineStyle),
                                            },
                                          }}
                                        />
                                      )}

                                      {!isPointBased && f.showLabel && f.label && (
                                        <Text
                                          x={px}
                                          y={py}
                                          attach="ne"
                                          attachDistance={15}
                                          color={f.color}
                                          weight="bold"
                                          size={16}
                                        >
                                          {f.label}
                                        </Text>
                                      )}
                                      </Transform>`;
});

fs.writeFileSync('src/components/MathNodeRenderer.tsx', code);
