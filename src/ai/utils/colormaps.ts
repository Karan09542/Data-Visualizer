// Generates a Turbo colormap lookup table
export function createTurboColormap(): number[][] {
  const colormap = [];
  for (let i = 0; i < 256; i++) {
    const x = i / 255.0;
    const r = Math.sin((x * 3.0 - 0.5) * Math.PI) * 0.5 + 0.5;
    const g = Math.sin((x * 3.0 - 1.5) * Math.PI) * 0.5 + 0.5;
    const b = Math.sin((x * 3.0 - 2.5) * Math.PI) * 0.5 + 0.5;
    
    // Smooth the edges and clamp
    colormap.push([
      Math.max(0, Math.min(255, Math.floor(r * 255))),
      Math.max(0, Math.min(255, Math.floor(g * 255))),
      Math.max(0, Math.min(255, Math.floor(b * 255)))
    ]);
  }
  return colormap;
}
