import React, { useEffect, useRef, useState } from "react";
import { useTransformContext, vec } from "mafs";
import katex from "katex";
import { useMathWorker } from "../../hooks/useMathWorker";

interface SafeLabelProps {
  at: [number, number];
  tex: string;
  color: string;
  rotation?: number;
  scale?: number;
  flipX?: boolean;
  flipY?: boolean;
  /** `tex` is already LaTeX (e.g. a multi-line ODE system); render it as-is. */
  rawLatex?: boolean;
  /**
   * Plain text, e.g. a live readout "t = 0.42 s" that changes every frame. Shown in
   * KaTeX's font so it matches the other labels, without a LaTeX pass per frame.
   */
  plain?: boolean;
}

export const SafeLabel: React.FC<SafeLabelProps> = ({
  at,
  tex,
  color,
  rotation = 0,
  scale = 1,
  flipX = false,
  flipY = false,
  rawLatex = false,
  plain = false,
}) => {
  const { viewTransform, userTransform } = useTransformContext();
  const ref = useRef<HTMLSpanElement>(null);
  const { expressionToLatex } = useMathWorker();
  const [finalTex, setFinalTex] = useState(tex);

  if (!tex) return null;

  // Compute LaTeX async
  useEffect(() => {
    let cancelled = false;

    // Plain text is written straight to the DOM below: a readout changes every frame
    // and must not go through state.
    if (plain) return;
    if (rawLatex) {
      setFinalTex(tex);
      return;
    }

    (async () => {
      try {
        const eqIndex = tex.indexOf("=");
        if (
          eqIndex !== -1 &&
          !tex.includes("==") &&
          !tex.includes(">=") &&
          !tex.includes("<=") &&
          !tex.includes("!=")
        ) {
          const lhs = tex.slice(0, eqIndex).trim();
          const rhs = tex.slice(eqIndex + 1).trim();
          const [lhsRes, rhsRes] = await Promise.all([
            expressionToLatex(lhs),
            expressionToLatex(rhs),
          ]);
          if (!cancelled && lhsRes.latex && rhsRes.latex) {
            setFinalTex(`${lhsRes.latex} = ${rhsRes.latex}`);
            return;
          }
        } else {
          const res = await expressionToLatex(tex);
          if (!cancelled && res.latex) {
            setFinalTex(res.latex);
            return;
          }
        }
      } catch (e) {
        // Stick to raw tex
      }
      if (!cancelled) setFinalTex(tex);
    })();

    return () => {
      cancelled = true;
    };
  }, [tex, expressionToLatex, rawLatex, plain]);

  useEffect(() => {
    if (!ref.current) return;
    if (plain) {
      ref.current.textContent = tex;
      return;
    }
    try {
      katex.render(finalTex, ref.current, {
        throwOnError: true,
        strict: "ignore",
        trust: true,
        displayMode: rawLatex, // multi-line blocks need display mode to stack
      });
    } catch (e) {
      ref.current.innerText = finalTex;
    }
  }, [finalTex, plain, plain ? tex : ""]);

  const combinedTransform = vec.matrixMult(viewTransform, userTransform);
  const width = 99999;
  const height = 99999;
  const pixelCenter = vec.add(vec.transform(at, combinedTransform), [-width / 2, -height / 2]);

  const sx = flipX ? -scale : scale;
  const sy = flipY ? -scale : scale;

  return (
    <foreignObject
      x={pixelCenter[0]}
      y={pixelCenter[1]}
      width={width}
      height={height}
      style={{ pointerEvents: "none", overflow: "visible" }}
    >
      <span
        ref={ref}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
          color: color || "var(--mafs-fg)",
          // Shrinks with a small graph (the node's canvas card); see --math-label-scale.
          fontSize: `calc(var(--math-label-scale, 1) * ${plain ? 1.15 : 1}em)`,
          ...(plain ? { fontFamily: "KaTeX_Main, 'Times New Roman', serif", whiteSpace: "pre" } : {}),
          transform: `rotate(${rotation}deg) scale(${sx}, ${sy})`,
          transformOrigin: "center",
        }}
      />
    </foreignObject>
  );
};
