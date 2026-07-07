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
}

export const SafeLabel: React.FC<SafeLabelProps> = ({
  at,
  tex,
  color,
  rotation = 0,
  scale = 1,
  flipX = false,
  flipY = false,
}) => {
  const { viewTransform, userTransform } = useTransformContext();
  const ref = useRef<HTMLSpanElement>(null);
  const { expressionToLatex } = useMathWorker();
  const [finalTex, setFinalTex] = useState(tex);

  if (!tex) return null;

  // Compute LaTeX async
  useEffect(() => {
    let cancelled = false;

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
  }, [tex, expressionToLatex]);

  useEffect(() => {
    if (!ref.current) return;
    try {
      katex.render(finalTex, ref.current, {
        throwOnError: true,
        strict: "ignore",
        trust: true,
      });
    } catch (e) {
      ref.current.innerText = finalTex;
    }
  }, [finalTex]);

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
          transform: `rotate(${rotation}deg) scale(${sx}, ${sy})`,
          transformOrigin: "center",
        }}
      />
    </foreignObject>
  );
};
