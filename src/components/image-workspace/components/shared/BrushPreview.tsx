
import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Plus, Minus, Move, Layers, Square, Circle, Triangle, Trash2, Edit2, Check, X, Sliders, Play, SquareDashed } from 'lucide-react';
import { RgbaStringColorPicker } from 'react-colorful';

export const BrushPreview = ({ type, color, size, opacity, hardness, flow, smoothing }: any) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const r = size / 2;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    let rVal = 0, gVal = 0, bVal = 0;
    if (color.startsWith('rgb')) {
      const parts = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([0-9.]+))?\)/);
      if (parts) {
        rVal = parseInt(parts[1]) || 0;
        gVal = parseInt(parts[2]) || 0;
        bVal = parseInt(parts[3]) || 0;
      }
    } else {
      const cleaned = (color || "#000000").replace("#", "");
      if (cleaned.length === 3) {
        rVal = parseInt(cleaned[0] + cleaned[0], 16) || 0;
        gVal = parseInt(cleaned[1] + cleaned[1], 16) || 0;
        bVal = parseInt(cleaned[2] + cleaned[2], 16) || 0;
      } else {
        rVal = parseInt(cleaned.substring(0, 2), 16) || 0;
        gVal = parseInt(cleaned.substring(2, 4), 16) || 0;
        bVal = parseInt(cleaned.substring(4, 6), 16) || 0;
      }
    }
    
    // Final safety against NaN
    rVal = Number.isNaN(rVal) ? 0 : rVal;
    gVal = Number.isNaN(gVal) ? 0 : gVal;
    bVal = Number.isNaN(bVal) ? 0 : bVal;

    // applyBrushSettings paints at (opacity/100) * (flow/100); the preview has
    // to use the same figure or the two disagree.
    const alpha = ((opacity || 100) / 100) * ((flow ?? 100) / 100);

    ctx.save();

    if (type.startsWith('pattern_')) {
      const designColor = `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha})`;
      const patType = type.replace("pattern_", "");
      ctx.beginPath();
      ctx.arc(centerX, centerY, Math.min(25, r), 0, Math.PI * 2);
      ctx.clip();
      
      ctx.fillStyle = designColor;
      for (let x = 0; x < canvas.width; x += 10) {
        for (let y = 0; y < canvas.height; y += 10) {
          if (patType === 'dots') {
            ctx.beginPath();
            ctx.arc(x + 5, y + 5, 2, 0, Math.PI * 2);
            ctx.fill();
          } else if (patType === 'dashed') {
            ctx.beginPath();
            ctx.moveTo(x, y + 10);
            ctx.lineTo(x + 10, y);
            ctx.strokeStyle = designColor;
            ctx.stroke();
          } else if (patType === 'texture') {
            ctx.fillRect(x + 1, y + 1, 8, 1);
            ctx.fillRect(x + 1, y + 1, 1, 8);
          } else {
            ctx.fillRect(x + 3, y + 3, 4, 4);
          }
        }
      }
    } else if (type === 'airbrush' || type === 'spray') {
      ctx.fillStyle = `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha})`;
      const clusterRadius = Math.min(25, r);
      const density = type === 'airbrush' ? 120 : 50;
      for (let i = 0; i < density; i++) {
        const radius = Math.random() * clusterRadius;
        const angle = Math.random() * Math.PI * 2;
        const dotX = centerX + radius * Math.cos(angle);
        const dotY = centerY + radius * Math.sin(angle);
        ctx.fillRect(dotX, dotY, Math.max(1, size / 12), Math.max(1, size / 12));
      }
    } else if (type === 'chalk') {
       ctx.fillStyle = `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha})`;
       const w = Math.min(45, size);
       for (let i = 0; i < 60; i++) {
         const dx = (Math.random() - 0.5) * w;
         const dy = (Math.random() - 0.5) * w;
         if (dx * dx + dy * dy < (w / 2) * (w / 2)) {
           ctx.fillRect(centerX + dx, centerY + dy, 1.5, 1.5);
         }
       }
    } else if (type === 'highlighter') {
       ctx.fillStyle = `rgba(${rVal}, ${gVal}, ${bVal}, ${0.4 * ((flow ?? 100) / 100)})`;
       const hSize = Math.min(30, size * 1.5);
       ctx.fillRect(centerX - 25, centerY - hSize / 2, 50, hSize);
    } else if (type === 'watercolor') {
       const gradient = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, Math.min(30, r * 1.5));
       gradient.addColorStop(0, `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha * 0.4})`);
       gradient.addColorStop(0.5, `rgba(${rVal}, ${gVal}, ${bVal}, ${alpha * 0.15})`);
       gradient.addColorStop(1, `rgba(${rVal}, ${gVal}, ${bVal}, 0)`);
       ctx.fillStyle = gradient;
       ctx.beginPath();
       ctx.arc(centerX, centerY, Math.min(30, r * 1.5), 0, Math.PI * 2);
       ctx.fill();
    } else {
       const dabRadius = Math.max(1, Math.min(18, r));
       const hardnessFactor = Math.max(0, Math.min(100, hardness ?? 100)) / 100;
       const smoothFactor = Math.max(0, Math.min(100, smoothing ?? 0)) / 100;

       // Smoothing irons the wobble out of a stroke, so the sample path goes
       // from shaky at 0% to near straight at 100%.
       const amplitude = (1 - smoothFactor) * 10;
       const halfSpan = Math.max(18, Math.min(44, canvas.width / 2 - dabRadius - 4));
       const steps = 64;

       // Stamped dabs overlap heavily, so they are laid down at full alpha on
       // their own layer and composited once - otherwise a 20% brush previews
       // as solid wherever the dabs pile up.
       const layer = document.createElement('canvas');
       layer.width = canvas.width;
       layer.height = canvas.height;
       const layerCtx = layer.getContext('2d');

       if (layerCtx) {
          for (let i = 0; i <= steps; i++) {
             const t = i / steps;
             const x = centerX - halfSpan + halfSpan * 2 * t;
             // Taper the wobble at both ends so the stroke reads as one gesture.
             const y = centerY + Math.sin(t * Math.PI * 4) * amplitude * Math.sin(t * Math.PI);

             if (hardnessFactor >= 0.999) {
                layerCtx.fillStyle = `rgb(${rVal}, ${gVal}, ${bVal})`;
             } else {
                const g = layerCtx.createRadialGradient(x, y, dabRadius * hardnessFactor, x, y, dabRadius);
                g.addColorStop(0, `rgb(${rVal}, ${gVal}, ${bVal})`);
                g.addColorStop(1, `rgba(${rVal}, ${gVal}, ${bVal}, 0)`);
                layerCtx.fillStyle = g;
             }

             layerCtx.beginPath();
             layerCtx.arc(x, y, dabRadius, 0, Math.PI * 2);
             layerCtx.fill();
          }

          ctx.globalAlpha = alpha;
          ctx.drawImage(layer, 0, 0);
          ctx.globalAlpha = 1;
       }
    }

    ctx.restore();
  }, [type, color, size, opacity, hardness, flow, smoothing]);

  return (
    <div className="flex flex-col items-center bg-slate-50 dark:bg-[#151515] p-3 rounded-xl border border-slate-200 dark:border-[#2C2C2C] space-y-1.5 w-full shadow-sm">
      <div className="w-full h-16 bg-white dark:bg-[#1a1a1a] rounded-lg border border-slate-200 dark:border-[#2a2a2a] flex items-center justify-center overflow-hidden relative shadow-inner">
        <canvas ref={canvasRef} width={120} height={60} className="block" />
        <span className="absolute bottom-1 right-2 text-[9px] text-slate-400 dark:text-[#555] font-mono font-semibold">{size}px • {opacity}%</span>
      </div>
    </div>
  );
};
