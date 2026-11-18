/**
 * The waveform, drawn by wavesurfer.js: real detail from the decoded sound (stereo shown as top
 * and bottom halves), the played part in the tool's colour, a time ruler, hover time, zoom
 * (Ctrl/⌘ + wheel or the buttons) with scrolling, a draggable trim region and split markers.
 *
 * It only draws: playback is the editor's live preview, which drives the progress via `playhead`.
 */
import React, { useEffect, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin, { type Region } from "wavesurfer.js/dist/plugins/regions.esm.js";
import TimelinePlugin from "wavesurfer.js/dist/plugins/timeline.esm.js";
import HoverPlugin from "wavesurfer.js/dist/plugins/hover.esm.js";
import { Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { formatTime } from "./commands";
import { useAccent } from "./palette";
import { useDark } from "./ui";

/** The colour `amount` of the way from `bg` to `fg`, solid (wavesurfer draws the played part
 * by masking the wave, so a see-through wave colour would make the played part see-through too). */
const mix = (fg: string, bg: string, amount: number) => {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [f, b] = [p(fg), p(bg)];
  return `rgb(${f.map((v, i) => Math.round(b[i] + (v - b[i]) * amount)).join(",")})`;
};

const rgba = (hex: string, a: number) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
};

export interface WaveformProps {
  /** Loudness per slice (0–1): used when the full sound isn't decoded */
  peaks: Float32Array | null;
  /** The decoded sound, for full detail when zoomed in */
  buffer?: AudioBuffer | null;
  duration: number;
  /** The kept part (trim tools) */
  start?: number;
  end?: number;
  onTrim?: (start: number, end: number) => void;
  /** Where playback is (seconds), or null when it can't play */
  playhead?: number | null;
  onSeek?: (t: number) => void;
  /** Split points */
  markers?: number[];
  height?: number;
  ruler?: boolean;
  zoomable?: boolean;
  /** Scale the loudest moment to full height (off: true levels, so volume changes show) */
  normalize?: boolean;
}

export const Waveform: React.FC<WaveformProps> = ({ peaks, buffer, duration, start = 0, end = duration, onTrim, playhead, onSeek, markers, height = 104, ruler = true, zoomable = true, normalize = true }) => {
  const a = useAccent();
  const dark = useDark();
  const box = useRef<HTMLDivElement>(null);
  const ws = useRef<WaveSurfer | null>(null);
  const regions = useRef<RegionsPlugin | null>(null);
  const trim = useRef<Region | null>(null);
  const marks = useRef<Region[]>([]);
  /** Shade over the parts being cut away */
  const cuts = useRef<Region[]>([]);
  const dragging = useRef(false);
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(0); // px per second; 0 = whole file fits
  const live = useRef({ onTrim, onSeek, duration, playhead });
  live.current = { onTrim, onSeek, duration, playhead };

  const accent = a.hex[dark ? 1 : 0];
  const colors = {
    waveColor: mix(accent, dark ? "#0d1117" : "#f8fafc", dark ? 0.4 : 0.38),
    progressColor: accent,
    cursorColor: playhead == null ? "transparent" : dark ? "#f8fafc" : "#0f172a",
  };

  const shade = dark ? "rgba(13,17,23,0.72)" : "rgba(248,250,252,0.72)";
  const shadeRef = useRef(shade);
  shadeRef.current = shade;
  /** Dims [0, start] and [end, duration]: what Trim will remove. */
  function shadeCuts(s: number, e: number) {
    const r = regions.current;
    const d = live.current.duration;
    if (!r) return;
    const parts: [number, number][] = [
      [0, s],
      [e, d],
    ];
    parts.forEach(([a0, a1], i) => {
      let reg = cuts.current[i];
      if (!reg) {
        reg = r.addRegion({ id: `cut${i}`, start: a0, end: Math.max(a0, a1), color: shadeRef.current, drag: false, resize: false });
        if (reg.element) reg.element.style.pointerEvents = "none";
        cuts.current[i] = reg;
      } else reg.setOptions({ start: a0, end: Math.max(a0, a1), color: shadeRef.current });
    });
  }

  // ------------------------------------------------ create once
  useEffect(() => {
    const w = WaveSurfer.create({
      container: box.current!,
      height,
      ...colors,
      cursorWidth: 2,
      barWidth: 2,
      barGap: 1,
      barRadius: 2,
      normalize,
      interact: true,
      dragToSeek: true,
      hideScrollbar: false,
      autoScroll: true,
      autoCenter: true,
      fillParent: true,
    });
    const r = w.registerPlugin(RegionsPlugin.create());
    if (ruler)
      w.registerPlugin(
        TimelinePlugin.create({
          height: 18,
          formatTimeCallback: (s) => formatTime(s, s % 1 ? 1 : 0),
          style: { fontSize: "10px", color: "#94a3b8" },
          secondaryLabelOpacity: 0.6,
        }),
      );
    w.registerPlugin(HoverPlugin.create({ lineColor: rgba(accent, 0.7), lineWidth: 1, labelBackground: accent, labelColor: "#fff", labelSize: 10, formatTimeCallback: (s) => formatTime(s) }));

    w.on("interaction", (t) => live.current.onSeek?.(t));
    w.on("zoom", (px) => setZoom(px));
    // a new selection dragged on the waveform becomes the kept part
    r.on("region-created", (reg) => {
      if (reg.id === "trim" || reg.id.startsWith("mark") || reg.id.startsWith("cut")) return;
      live.current.onTrim?.(reg.start, reg.end);
      reg.remove();
    });
    r.on("region-update", (reg) => {
      if (reg.id !== "trim") return;
      dragging.current = true;
      shadeCuts(reg.start, reg.end);
    });
    r.on("region-updated", (reg) => {
      if (reg.id !== "trim") return;
      dragging.current = false;
      live.current.onTrim?.(+reg.start.toFixed(2), +reg.end.toFixed(2));
    });
    r.on("region-clicked", (reg, e) => {
      if (reg.id !== "trim") return;
      e.stopPropagation();
      const rect = w.getWrapper().getBoundingClientRect();
      live.current.onSeek?.(Math.max(0, Math.min(live.current.duration, ((e.clientX - rect.left) / rect.width) * live.current.duration)));
    });

    ws.current = w;
    regions.current = r;
    return () => {
      w.destroy();
      ws.current = null;
      regions.current = null;
      trim.current = null;
      marks.current = [];
      cuts.current = [];
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------ the sound
  useEffect(() => {
    const w = ws.current;
    if (!w) return;
    setReady(false);
    const data = buffer ? Array.from({ length: Math.min(2, buffer.numberOfChannels) }, (_, c) => buffer.getChannelData(c)) : peaks ? [peaks] : null;
    if (!data || !duration) {
      w.empty();
      return;
    }
    trim.current = null;
    marks.current = [];
    cuts.current = [];
    regions.current?.clearRegions();
    w.setTime(0); // forget the previous sound's position
    w.load("", data, duration)
      .catch(() => {})
      .finally(() => {
        // wavesurfer restores its own (stale) time on load: put the playhead where it really is
        requestAnimationFrame(() => {
          const ph = live.current.playhead;
          if (ws.current === w) w.setTime(ph == null ? 0 : Math.max(0, Math.min(duration, ph)));
          setReady(true);
        });
      });
  }, [peaks, buffer, duration]);

  // ------------------------------------------------ look
  useEffect(() => {
    ws.current?.setOptions({ ...colors, height, normalize });
    const col = rgba(accent, dark ? 0.16 : 0.12);
    trim.current?.setOptions({ color: col });
    styleTrim(trim.current, accent);
    cuts.current.forEach((c) => c.setOptions({ color: shade }));
  }, [accent, dark, height, normalize, playhead == null]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------ progress follows the live preview
  useEffect(() => {
    const w = ws.current;
    if (w && ready && playhead != null) w.setTime(Math.max(0, Math.min(duration, playhead)));
  }, [playhead, ready, duration]);

  // ------------------------------------------------ trim region
  useEffect(() => {
    const r = regions.current;
    if (!r || !ready) return;
    if (!onTrim) {
      trim.current?.remove();
      trim.current = null;
      cuts.current.forEach((c) => c.remove());
      cuts.current = [];
      return;
    }
    if (!dragging.current) shadeCuts(start, end);
    if (!trim.current) {
      trim.current = r.addRegion({ id: "trim", start, end, color: rgba(accent, dark ? 0.16 : 0.12), drag: true, resize: true, minLength: 0.05 });
      styleTrim(trim.current, accent);
    } else if (!dragging.current && (Math.abs(trim.current.start - start) > 0.005 || Math.abs(trim.current.end - end) > 0.005)) {
      trim.current.setOptions({ start, end });
    }
  }, [ready, !!onTrim, start, end]); // eslint-disable-line react-hooks/exhaustive-deps

  // a drag on empty waveform selects a new part (trim tools only)
  useEffect(() => {
    const r = regions.current;
    if (!r || !onTrim) return;
    return r.enableDragSelection({ color: rgba(accent, 0.2) });
  }, [!!onTrim, accent]); // eslint-disable-line react-hooks/exhaustive-deps

  // ------------------------------------------------ split markers
  useEffect(() => {
    const r = regions.current;
    if (!r || !ready) return;
    marks.current.forEach((m) => m.remove());
    marks.current = (markers ?? []).map((t, i) => {
      const label = document.createElement("span");
      label.textContent = String(i + 2);
      Object.assign(label.style, { background: accent, color: "#fff", fontSize: "10px", fontWeight: "700", padding: "0 4px", borderRadius: "3px", marginLeft: "3px", marginTop: "3px", display: "inline-block" });
      return r.addRegion({ id: `mark${i}`, start: t, color: accent, content: label, drag: false });
    });
  }, [markers, ready, accent]);

  // ------------------------------------------------ zoom
  const fit = () => ws.current?.zoom(0);
  const zoomBy = (k: number) => {
    const w = ws.current;
    const box_ = box.current;
    if (!w || !box_ || !duration) return;
    const base = zoom || box_.clientWidth / duration;
    const next = Math.max(box_.clientWidth / duration, Math.min(2000, base * k));
    w.zoom(next <= box_.clientWidth / duration + 0.01 ? 0 : next);
  };
  useEffect(() => {
    const el = box.current;
    if (!el || !zoomable) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return; // plain wheel keeps scrolling the page
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.25 : 0.8);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const hasData = !!(buffer || peaks) && duration > 0;
  const zoomed = zoom > 0;

  return (
    <div className="group relative rounded-lg bg-slate-50 border border-slate-100 dark:bg-[#0d1117] dark:border-slate-800 px-2 pt-1 pb-1 select-none">
      <div ref={box} className={hasData ? "" : "invisible"} style={{ minHeight: height + (ruler ? 18 : 0) }} />
      {!hasData && <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-400">Reading the sound…</span>}
      {zoomable && hasData && (
        <div className={`absolute top-1 right-1.5 z-10 flex items-center gap-0.5 p-0.5 rounded-lg bg-white/90 dark:bg-[#161b22]/90 border border-slate-200 dark:border-slate-700 shadow-sm transition-opacity ${zoomed ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"}`}>
          {[
            { label: "Zoom out", icon: ZoomOut, on: () => zoomBy(0.5), off: !zoomed },
            { label: "Zoom in (Ctrl + scroll)", icon: ZoomIn, on: () => zoomBy(2), off: false },
            { label: "Show the whole file", icon: Maximize2, on: fit, off: !zoomed },
          ].map((b) => (
            <button key={b.label} type="button" title={b.label} aria-label={b.label} disabled={b.off} onClick={b.on} className="w-6 h-6 rounded-md flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:text-white dark:hover:bg-slate-800 disabled:opacity-30">
              <b.icon size={13} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

/** Wider, coloured handles on the trim region (it lives in wavesurfer's shadow DOM). */
function styleTrim(r: Region | null, color: string) {
  r?.element?.querySelectorAll<HTMLElement>('[part~="region-handle"]').forEach((h) => {
    Object.assign(h.style, { width: "6px", background: color, borderRadius: "3px", border: "none", opacity: "1" });
  });
}
