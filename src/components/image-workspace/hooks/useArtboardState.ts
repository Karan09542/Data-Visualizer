import { useState } from "react";
import { Artboard } from "../types/artboards";

export const useArtboardState = () => {
const [artboards, setArtboards] = useState<Artboard[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeArtboardId, setActiveArtboardId] = useState<string>("artboard_default");

  return {
    artboards, setArtboards,
    isLoaded, setIsLoaded,
    activeArtboardId, setActiveArtboardId
  };
};