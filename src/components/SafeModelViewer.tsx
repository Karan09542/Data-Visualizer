import React, { useEffect, useState } from "react";

interface SafeModelViewerProps {
  src: string;
  alt?: string;
  autoRotate?: boolean;
  cameraControls?: boolean;
  style?: React.CSSProperties;
}

export function SafeModelViewer({ src, alt, autoRotate, cameraControls, style }: SafeModelViewerProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    import("@google/model-viewer")
      .then(() => {
        if (active) setLoaded(true);
      })
      .catch((err) => {
        console.error("Failed to load @google/model-viewer", err);
        if (active) setError(err.message || "Failed to load 3D viewer package");
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-4 w-full h-full bg-slate-800 text-slate-400 rounded-lg border border-slate-700 text-center text-xs">
        <p className="font-semibold text-slate-300">Could not initialize 3D Viewer</p>
        <p className="text-[10px] text-slate-500 mt-1">{error}</p>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full text-slate-400 text-xs gap-2 py-8 bg-slate-950/20 rounded">
        <div className="w-5 h-5 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Loading 3D engine...</span>
      </div>
    );
  }

  const ModelViewer = "model-viewer" as any;
  return (
    <ModelViewer
      id="safe-model-viewer-element"
      src={src}
      alt={alt}
      auto-rotate={autoRotate ? "true" : undefined}
      camera-controls={cameraControls ? "true" : undefined}
      style={style}
    />
  );
}
