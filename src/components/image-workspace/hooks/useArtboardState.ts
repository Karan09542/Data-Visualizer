import { useState, useEffect } from "react";
import { Artboard } from "../types/artboards";

export const useArtboardState = (path?: string) => {
  const [artboards, setArtboards] = useState<Artboard[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeArtboardId, setActiveArtboardId] = useState<string>(() => {
    if (path) {
      try {
        const stored = localStorage.getItem(`activeArtboard_${path}`);
        if (stored) return stored;
      } catch (e) {}
    }
    return "artboard_default";
  });

  useEffect(() => {
    if (path && activeArtboardId) {
      try {
        localStorage.setItem(`activeArtboard_${path}`, activeArtboardId);
      } catch (e) {}
    }
  }, [activeArtboardId, path]);

  return {
    artboards, setArtboards,
    isLoaded, setIsLoaded,
    activeArtboardId, setActiveArtboardId
  };
};