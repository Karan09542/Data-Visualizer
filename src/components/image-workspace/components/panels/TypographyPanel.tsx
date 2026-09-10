import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as fabric from 'fabric';
import {
   Type, RotateCw, Bold, Italic, Underline, Strikethrough,
   AlignLeft, AlignCenter, AlignRight, AlignJustify,
   Minus, Plus, RotateCcw, Sun, Wand2, Eraser
} from 'lucide-react';
import { useTool } from '../../contexts/ToolContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { useHistory } from '../../contexts/HistoryContext';
import { useSelection } from '../../contexts/SelectionContext';
import { PanelSection, Label, RangeSlider, ToggleSwitch } from '../shared/PanelPrimitives';
import { FontPicker } from '../../../FontPicker';
import { TypographyPresets } from '../../../TypographyPresets';
import CustomSelect from '../../../CustomSelect';
import { ColorPickerTrigger as ShadowColorTrigger } from '../shared/ColorPickers';
import { splitColor, joinColor } from '../../../../utils/shadowColor';
import {
   WORD_ART_STYLES, WORD_ART_CATEGORIES, WordArtStyle, resolveWordArt, gradientCoords, wordArtCss
} from '../../../../utils/wordArt';
import { loadGoogleFont } from '../../../../utils/fontRegistry';
import { usePreviewHold } from '../../hooks/usePreviewHold';

const WEIGHTS = [
   { value: '300', label: 'Light' },
   { value: 'normal', label: 'Regular' },
   { value: '500', label: 'Medium' },
   { value: '700', label: 'Semibold' },
   { value: 'bold', label: 'Bold' },
   { value: '900', label: 'Black' }
];

const ALIGNMENTS = [
   { id: 'left', icon: <AlignLeft size={14} strokeWidth={2.5} />, title: 'Align left' },
   { id: 'center', icon: <AlignCenter size={14} strokeWidth={2.5} />, title: 'Align centre' },
   { id: 'right', icon: <AlignRight size={14} strokeWidth={2.5} />, title: 'Align right' },
   { id: 'justify', icon: <AlignJustify size={14} strokeWidth={2.5} />, title: 'Justify' }
];

interface ShadowState {
   enabled: boolean;
   /** Solid swatch; the opacity is kept apart so a picker without alpha still works. */
   color: string;
   opacity: number;
   blur: number;
   offsetX: number;
   offsetY: number;
}

const NO_SHADOW: ShadowState = { enabled: false, color: '#000000', opacity: 50, blur: 8, offsetX: 2, offsetY: 4 };

/** Named starting points, because a shadow needs four numbers before it looks like anything. */
const SHADOW_STYLES: { id: string; label: string; value: Omit<ShadowState, 'enabled'> }[] = [
   { id: 'soft', label: 'Soft', value: { color: '#000000', opacity: 45, blur: 12, offsetX: 0, offsetY: 4 } },
   { id: 'hard', label: 'Hard', value: { color: '#000000', opacity: 90, blur: 0, offsetX: 4, offsetY: 4 } },
   { id: 'glow', label: 'Glow', value: { color: '#ffb703', opacity: 70, blur: 24, offsetX: 0, offsetY: 0 } },
   { id: 'long', label: 'Long', value: { color: '#000000', opacity: 35, blur: 2, offsetX: 12, offsetY: 12 } }
];

/** Reads a fabric shadow back into the two-part form the controls use. */
const shadowToState = (shadow: any): ShadowState => {
   if (!shadow) return { ...NO_SHADOW };
   const { hex, alpha } = splitColor(shadow.color);
   return {
      enabled: true,
      color: hex,
      opacity: Math.round(alpha * 100),
      blur: Number(shadow.blur) || 0,
      offsetX: Number(shadow.offsetX) || 0,
      offsetY: Number(shadow.offsetY) || 0
   };
};

/**
 * Every property a word art style writes.
 *
 * Snapshotting exactly this list is what makes applying one style over another a replacement: the
 * gradient, outline, glow and slant of the previous style are all captured and all overwritten,
 * so nothing from the last choice survives into the next.
 */
const WORD_ART_KEYS = [
   'fill', 'stroke', 'strokeWidth', 'strokeLineJoin', 'paintFirst',
   'shadow', 'charSpacing', 'skewX', 'fontFamily', 'fontWeight'
] as const;

const ORIENTATIONS = [
   { angle: 0, label: 'Horizontal', title: 'Read left to right' },
   { angle: 90, label: '90°', title: 'Rotate a quarter turn clockwise' },
   { angle: 270, label: '270°', title: 'Rotate a quarter turn anticlockwise' }
];

/** Bold covers several numeric weights, so the toggle has to recognise all of them. */
const isBoldWeight = (weight: unknown): boolean =>
   weight === 'bold' || weight === '700' || weight === '900' || weight === 700 || weight === 900;

/** Segmented tray shared by the alignment, style and orientation rows. */
const Tray: React.FC<{ children: React.ReactNode }> = ({ children }) => (
   <div className="flex gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5">
      {children}
   </div>
);

const TrayButton: React.FC<{
   active: boolean;
   onClick: () => void;
   title: string;
   children: React.ReactNode;
   className?: string;
}> = ({ active, onClick, title, children, className = '' }) => (
   <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      className={`flex-1 h-8 flex items-center justify-center rounded-md transition-all active:scale-95 touch-manipulation ${active
         ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25'
         : 'text-slate-500 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'} ${className}`}
   >
      {children}
   </button>
);

export const TypographyPanel: React.FC = () => {
   const { textProps, setTextProps } = useTool();
   const { fabricRef, changeTextProp } = useCanvas();
   const { executeCommand } = useHistory();
   const { textObj, textContent, activeObjs } = useSelection();

   const [shadow, setShadow] = useState<ShadowState>(NO_SHADOW);
   // Captured when a shadow gesture starts, so a drag across a slider is one undo entry and not one
   // per pixel of travel.
   const shadowBaselineRef = useRef<{ obj: any; shadow: any }[] | null>(null);

   // Editing text is a stream of keystrokes, not a single change, so the draft lives here and only
   // reaches the history once - on blur - rather than pushing an undo entry per character.
   const [draft, setDraft] = useState(textContent || '');
   const baselineRef = useRef(textContent || '');
   const focusedRef = useRef(false);

   useEffect(() => {
      // Never overwrite what is being typed; the canvas is already showing it live.
      if (focusedRef.current) return;
      setDraft(textContent || '');
      baselineRef.current = textContent || '';
   }, [textContent, textObj]);

   const singleText = (activeObjs?.length ?? 0) <= 1 && !!textObj;

   // Re-read the shadow whenever the selection changes or history moves under us.
   useEffect(() => {
      setShadow(shadowToState((textObj as any)?.shadow));
   }, [textObj, textProps.textContent, activeObjs?.length]);

   /**
    * Hover/hold preview for a single property.
    *
    * Written straight to the objects and undone from this snapshot, so scrubbing a menu never
    * reaches the undo history - the same rule the preset preview follows.
    */
   const propPreviewRef = useRef<{ obj: any; key: string; value: any }[]>([]);

   const previewProp = (key: string, value: string | null) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      if (value === null) {
         propPreviewRef.current.forEach(({ obj, key: k, value: v }) => obj.set(k, v));
         propPreviewRef.current = [];
         canvas.requestRenderAll();
         return;
      }

      const objs = canvas.getActiveObjects();
      if (!objs.length) return;
      if (!propPreviewRef.current.length) {
         propPreviewRef.current = objs.map(o => ({ obj: o, key, value: (o as any).get(key) }));
      }
      objs.forEach(o => o.set(key as any, value));
      canvas.requestRenderAll();
   };

   const textTargets = (): any[] =>
      (fabricRef.current?.getActiveObjects() ?? []).filter(o => ['i-text', 'text', 'textbox'].includes(o.type as string));

   const writeShadow = (objs: any[], state: ShadowState) => {
      objs.forEach(o => {
         o.shadow = state.enabled
            ? new fabric.Shadow({
               color: joinColor(state.color, state.opacity / 100),
               blur: state.blur,
               offsetX: state.offsetX,
               offsetY: state.offsetY
            })
            : null;
         o.dirty = true;
      });
   };

   /** Live, uncommitted: the canvas follows the slider while the undo stack stays quiet. */
   const applyShadow = (next: ShadowState) => {
      setShadow(next);
      const objs = textTargets();
      if (!objs.length) return;
      if (!shadowBaselineRef.current) {
         shadowBaselineRef.current = objs.map(o => ({ obj: o, shadow: o.shadow ?? null }));
      }
      writeShadow(objs, next);
      fabricRef.current?.requestRenderAll();
   };

   /** One history entry for the whole gesture, pushed when the slider or picker is let go. */
   const commitShadow = (next: ShadowState) => {
      const before = shadowBaselineRef.current;
      shadowBaselineRef.current = null;
      if (!before || !before.length) return;

      const after = before.map(({ obj }) => ({ obj, shadow: obj.shadow ?? null }));
      const unchanged = before.every((b, i) => b.shadow === after[i].shadow);
      if (unchanged) return;

      const restore = (canvas: fabric.Canvas, snapshot: { obj: any; shadow: any }[]) => {
         snapshot.forEach(({ obj, shadow: value }) => { obj.shadow = value; obj.dirty = true; });
         canvas.requestRenderAll();
      };

      executeCommand({
         name: next.enabled ? 'Text Shadow' : 'Remove Text Shadow',
         execute: (canvas: fabric.Canvas) => restore(canvas, after),
         undo: (canvas: fabric.Canvas) => restore(canvas, before),
         redo: (canvas: fabric.Canvas) => restore(canvas, after)
      } as any);
   };

   const setShadowAnd = (next: ShadowState) => { applyShadow(next); commitShadow(next); };

   // ---------------------------------------------------------------- word art
   const [artCategory, setArtCategory] = useState(WORD_ART_CATEGORIES[0]);
   const [keepFont, setKeepFont] = useState(false);
   const artPreviewRef = useRef<{ obj: any; values: Record<string, any> }[] | null>(null);

   const visibleStyles = useMemo(
      () => WORD_ART_STYLES.filter(a => a.category === artCategory),
      [artCategory]
   );

   // The tiles are set in each style's own face, so the faces have to be here before they mean
   // anything. Only the open category is fetched rather than all twelve at once.
   useEffect(() => {
      visibleStyles.forEach(style => loadGoogleFont(style.fontFamily));
   }, [visibleStyles]);

   const snapshotArt = (objs: any[]) => objs.map(o => ({
      obj: o,
      values: Object.fromEntries(WORD_ART_KEYS.map(k => [k, o.get(k)])) as Record<string, any>
   }));

   const restoreArt = (snap: { obj: any; values: Record<string, any> }[]) => {
      snap.forEach(({ obj, values }) => {
         obj.set(values);
         obj.dirty = true;
      });
   };

   const writeWordArt = (objs: any[], style: WordArtStyle) => {
      objs.forEach(o => {
         // Resolved per object: the em-based geometry has to be sized against *this* object's font
         // size, so two selected layers at different sizes both get an outline that looks right.
         const art = resolveWordArt(style, Number(o.fontSize) || 40);
         const props: any = {
            stroke: art.stroke,
            strokeWidth: art.strokeWidth,
            strokeLineJoin: art.strokeLineJoin,
            paintFirst: art.paintFirst,
            charSpacing: art.charSpacing,
            skewX: art.skewX,
            fill: typeof art.fill === 'string'
               ? art.fill
               // A fresh gradient per object; sharing one instance across layers ties their fills
               // together in ways that surface later, on save and on clone.
               : new fabric.Gradient({
                  type: art.fill.type,
                  gradientUnits: 'percentage',
                  coords: gradientCoords(art.fill) as any,
                  colorStops: art.fill.stops
               }),
            shadow: art.shadow ? new fabric.Shadow(art.shadow) : null
         };
         if (!keepFont) {
            props.fontFamily = art.fontFamily;
            props.fontWeight = art.fontWeight;
         }
         o.set(props);
         o.dirty = true;
      });
   };

   const previewWordArt = (style: WordArtStyle | null) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      if (!style) {
         if (artPreviewRef.current) restoreArt(artPreviewRef.current);
         artPreviewRef.current = null;
         canvas.requestRenderAll();
         return;
      }

      const objs = textTargets();
      if (!objs.length) return;
      if (!artPreviewRef.current) artPreviewRef.current = snapshotArt(objs);
      loadGoogleFont(style.fontFamily);
      writeWordArt(objs, style);
      canvas.requestRenderAll();
      (document as any).fonts?.ready?.then(() => canvas.requestRenderAll()).catch(() => { });
   };

   const { bind: bindArt, stop: stopArt, consumeHoldClick: consumeArtHold } =
      usePreviewHold<WordArtStyle>({ preview: previewWordArt, revert: () => previewWordArt(null) });

   const commitArt = (name: string, mutate: (objs: any[]) => void) => {
      const canvas = fabricRef.current;
      const objs = textTargets();
      if (!canvas || !objs.length) return;

      const before = snapshotArt(objs);
      mutate(objs);
      const after = snapshotArt(objs);

      const applyState = (c: fabric.Canvas, snap: typeof before) => { restoreArt(snap); c.requestRenderAll(); };
      executeCommand({
         name,
         execute: (c: fabric.Canvas) => applyState(c, after),
         undo: (c: fabric.Canvas) => applyState(c, before),
         redo: (c: fabric.Canvas) => applyState(c, after)
      } as any);

      // The panel's own controls read from state, so pull the new values back out of the object.
      const first: any = objs[0];
      setTextProps((prev: any) => ({
         ...prev,
         fontFamily: first.fontFamily ?? prev.fontFamily,
         fontWeight: first.fontWeight ?? prev.fontWeight,
         charSpacing: first.charSpacing ?? prev.charSpacing
      }));
      setShadow(shadowToState(first.shadow));
   };

   const applyWordArt = (style: WordArtStyle) => {
      if (consumeArtHold()) return;
      stopArt();
      loadGoogleFont(style.fontFamily);
      commitArt(`Word Art: ${style.name}`, (objs) => writeWordArt(objs, style));
   };

   const clearWordArt = () => {
      stopArt();
      commitArt('Remove Word Art', (objs) => {
         objs.forEach(o => {
            // Keep a usable colour: the top gradient stop is the closest solid to what was showing.
            const current = o.fill;
            const solid = typeof current === 'string' && current !== 'transparent'
               ? current
               : current?.colorStops?.[0]?.color || '#000000';
            o.set({
               fill: solid, stroke: null, strokeWidth: 0,
               paintFirst: 'fill', skewX: 0, shadow: null
            });
            o.dirty = true;
         });
      });
   };

   const typeText = (value: string) => {
      setDraft(value);
      const obj = textObj as any;
      if (!obj) return;
      // Live, uncommitted: the canvas keeps up with the caret while the undo stack stays quiet.
      obj.set('text', value);
      obj.dirty = true;
      obj.setCoords?.();
      fabricRef.current?.requestRenderAll();
   };

   const commitText = () => {
      focusedRef.current = false;
      const obj = textObj as any;
      const before = baselineRef.current;
      const after = draft;
      if (!obj || before === after) return;

      const write = (canvas: fabric.Canvas, value: string) => {
         obj.set('text', value);
         obj.dirty = true;
         obj.setCoords?.();
         canvas.requestRenderAll();
      };

      executeCommand({
         name: 'Edit Text',
         execute: (canvas: fabric.Canvas) => write(canvas, after),
         undo: (canvas: fabric.Canvas) => write(canvas, before),
         redo: (canvas: fabric.Canvas) => write(canvas, after)
      } as any);

      baselineRef.current = after;
      setTextProps((prev: any) => ({ ...prev, textContent: after }));
   };

   // A preset rewrites font, weight, size, colour, spacing, line height and shadow at once. The
   // snapshot is taken from the objects themselves rather than from the preset, so reverting puts
   // back exactly what was there - including a shadow the preset does not mention.
   const presetPreviewRef = useRef<{ obj: any; values: any; shadow: any }[]>([]);

   const previewPreset = (props: any | null) => {
      const canvas = fabricRef.current;
      if (!canvas) return;

      if (!props) {
         presetPreviewRef.current.forEach(({ obj, values, shadow }) => {
            obj.set(values);
            obj.shadow = shadow;
         });
         presetPreviewRef.current = [];
         canvas.requestRenderAll();
         return;
      }

      const objs = canvas.getActiveObjects();
      if (!objs.length) return;

      if (!presetPreviewRef.current.length) {
         presetPreviewRef.current = objs.map(o => {
            const values: any = {};
            Object.keys(props).forEach(key => {
               if (key !== 'shadow') values[key] = (o as any).get(key);
            });
            return { obj: o, values, shadow: (o as any).shadow ?? null };
         });
      }

      // Mirrors what applying the preset does, so the preview cannot differ from the result.
      objs.forEach(o => {
         if (props.shadow) o.shadow = new fabric.Shadow(props.shadow);
         else if (props.shadow === null) o.shadow = null;
         o.set(props);
      });
      canvas.requestRenderAll();

      // The webfont arrives after the render above; redraw once it is actually available.
      (document as any).fonts?.ready?.then(() => canvas.requestRenderAll()).catch(() => { });
   };

   const nudgeSize = (delta: number) =>
      changeTextProp('fontSize', Math.max(1, Math.round((textProps.fontSize || 1) + delta)), 'Change Font Size');

   return (
      <PanelSection
         icon={<Type size={14} className="text-sky-500 dark:text-sky-400" />}
         title={
            <div className="flex items-center justify-between w-full gap-2">
               <span>Typography</span>
               <TypographyPresets onPreviewPreset={previewPreset} onApplyPreset={(props) => {
                  // Any preview is already reverted by now, so the command's "before" is the real
                  // pre-preset state rather than the last thing hovered.
                  presetPreviewRef.current = [];
                  const activeObjs = fabricRef.current?.getActiveObjects();
                  if (!activeObjs || activeObjs.length === 0) return;

                  const beforeStates = activeObjs.map(o => {
                     const before: any = {};
                     Object.keys(props).forEach(key => {
                        before[key] = (o as any).get(key);
                     });
                     return { obj: o, before, after: { ...props } };
                  });

                  executeCommand({
                     name: "Apply Preset",
                     execute: (canvas) => {
                        activeObjs.forEach(o => {
                           if (props.shadow) o.shadow = new fabric.Shadow(props.shadow);
                           else if (props.shadow === null) o.shadow = null;
                           o.set(props);
                        });
                        canvas.requestRenderAll();
                     },
                     undo: (canvas) => {
                        beforeStates.forEach(s => {
                           if (s.before.shadow) s.obj.shadow = new fabric.Shadow(s.before.shadow);
                           else if (s.before.shadow === null) s.obj.shadow = null;
                           s.obj.set(s.before);
                        });
                        canvas.requestRenderAll();
                     },
                     redo: (canvas) => {
                        beforeStates.forEach(s => {
                           if (s.after.shadow) s.obj.shadow = new fabric.Shadow(s.after.shadow);
                           else if (s.after.shadow === null) s.obj.shadow = null;
                           s.obj.set(s.after);
                        });
                        canvas.requestRenderAll();
                     }
                  });

                  setTextProps((prev: any) => ({ ...prev, ...props }));
               }} />
            </div>
         }
      >
         {/* Editing the words themselves, without having to double-click into the canvas - which is
             awkward on touch and impossible while the object is small or rotated. */}
         <div>
            <div className="flex items-center justify-between mb-1.5">
               <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500">Content</span>
               <span className="text-[9px] font-mono text-slate-400 dark:text-zinc-600">
                  {draft.length} {draft.length === 1 ? 'char' : 'chars'}
               </span>
            </div>
            <textarea
               rows={3}
               value={draft}
               disabled={!singleText}
               onFocus={() => { focusedRef.current = true; baselineRef.current = draft; }}
               onBlur={commitText}
               onChange={(e) => typeText(e.target.value)}
               onKeyDown={(e) => {
                  // Enter inserts a line break, so a deliberate "done" gesture is needed to commit.
                  if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                     e.preventDefault();
                     (e.target as HTMLTextAreaElement).blur();
                  }
               }}
               placeholder={singleText ? 'Type your text…' : 'Select a single text layer to edit its content'}
               className="w-full px-2.5 py-2 rounded-lg text-xs leading-relaxed resize-y min-h-[64px] bg-slate-50 dark:bg-[#121212] border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-zinc-600 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-[9px] text-slate-400 dark:text-zinc-600">
               Enter adds a line ·{' '}
               <kbd className="px-1 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono">Ctrl</kbd>
               +
               <kbd className="px-1 rounded bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 font-mono">Enter</kbd>
               {' '}or clicking away saves one undo step
            </p>
         </div>

         <div>
            <Label>Font Family</Label>
            <FontPicker
               className="w-full text-xs"
               value={textProps.fontFamily}
               selectedText={textProps.textContent}
               onHover={(val) => {
                  const activeObjs = fabricRef.current?.getActiveObjects();
                  if (!activeObjs) return;
                  activeObjs.forEach(o => {
                     if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
                        const target = o as any;
                        target.set('fontFamily', val || textProps.fontFamily);
                     }
                  });
                  fabricRef.current?.requestRenderAll();
               }}
               onChange={(val) => changeTextProp("fontFamily", val, "Change Font Family")}
            />
         </div>

         <div className="grid grid-cols-2 gap-3">
            <div>
               <Label>Size</Label>
               <div className="flex items-center h-9 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#121212] overflow-hidden focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/40 transition-all">
                  <button
                     type="button"
                     onClick={() => nudgeSize(-1)}
                     title="Smaller"
                     className="w-7 h-full shrink-0 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                  >
                     <Minus size={11} />
                  </button>
                  <input
                     type="number"
                     min={1}
                     value={textProps.fontSize}
                     onChange={(e) => changeTextProp("fontSize", Math.max(1, Number(e.target.value)), "Change Font Size")}
                     aria-label="Font size in pixels"
                     className="w-full min-w-0 h-full bg-transparent text-center text-xs font-mono text-slate-900 dark:text-white outline-none"
                  />
                  <span className="pr-1 text-[9px] font-mono text-slate-400 dark:text-zinc-600">px</span>
                  <button
                     type="button"
                     onClick={() => nudgeSize(1)}
                     title="Larger"
                     className="w-7 h-full shrink-0 flex items-center justify-center text-slate-500 dark:text-zinc-400 hover:bg-slate-200 dark:hover:bg-white/10 transition-colors"
                  >
                     <Plus size={11} />
                  </button>
               </div>
            </div>

            <div>
               <Label>Weight</Label>
               <CustomSelect
                  value={String(textProps.fontWeight ?? 'normal')}
                  options={WEIGHTS}
                  onPreview={(val) => previewProp('fontWeight', val)}
                  onChange={(val) => changeTextProp("fontWeight", val, "Change Font Weight")}
                  className="w-full normal-case"
               />
            </div>
         </div>

         <div>
            <Label>Style</Label>
            <Tray>
               <TrayButton
                  active={isBoldWeight(textProps.fontWeight)}
                  onClick={() => changeTextProp("fontWeight", isBoldWeight(textProps.fontWeight) ? 'normal' : 'bold', "Toggle Bold")}
                  title="Bold"
               >
                  <Bold size={14} strokeWidth={3} />
               </TrayButton>
               <TrayButton
                  active={textProps.fontStyle === 'italic'}
                  onClick={() => changeTextProp("fontStyle", textProps.fontStyle === 'italic' ? 'normal' : 'italic', "Toggle Italic")}
                  title="Italic"
               >
                  <Italic size={14} strokeWidth={3} />
               </TrayButton>
               <TrayButton
                  active={!!textProps.underline}
                  onClick={() => changeTextProp("underline", !textProps.underline, "Toggle Underline")}
                  title="Underline"
               >
                  <Underline size={14} strokeWidth={2.5} />
               </TrayButton>
               <TrayButton
                  active={!!textProps.overline}
                  onClick={() => changeTextProp("overline", !textProps.overline, "Toggle Overline")}
                  title="Overline"
               >
                  {/* No lucide glyph for overline, so it is drawn: a letter with a rule above it. */}
                  <span className="text-[11px] font-bold leading-none border-t-2 border-current pt-0.5 px-0.5">A</span>
               </TrayButton>
               <TrayButton
                  active={!!textProps.linethrough}
                  onClick={() => changeTextProp("linethrough", !textProps.linethrough, "Toggle Strikethrough")}
                  title="Strikethrough"
               >
                  <Strikethrough size={14} strokeWidth={2.5} />
               </TrayButton>
            </Tray>
         </div>

         <div>
            <Label>Alignment</Label>
            <Tray>
               {ALIGNMENTS.map(a => (
                  <TrayButton
                     key={a.id}
                     active={textProps.textAlign === a.id}
                     onClick={() => changeTextProp("textAlign", a.id, `Align ${a.id}`)}
                     title={a.title}
                  >
                     {a.icon}
                  </TrayButton>
               ))}
            </Tray>
         </div>

         <div>
            <Label>Orientation</Label>
            <Tray>
               {ORIENTATIONS.map(o => (
                  <TrayButton
                     key={o.angle}
                     active={Math.round(textProps.angle || 0) === o.angle}
                     onClick={() => changeTextProp("angle", o.angle, "Rotate Text")}
                     title={o.title}
                     className="text-[10px] font-bold"
                  >
                     {o.label}
                  </TrayButton>
               ))}
            </Tray>
         </div>

         <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-white/5">
            <div>
               <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500">
                     <RotateCw size={11} /> Angle
                  </span>
                  <div className="flex items-center gap-1">
                     <span className="font-mono text-[10px] text-slate-800 dark:text-white/90 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded border border-slate-200 dark:border-white/10">
                        {Math.round(textProps.angle || 0)}°
                     </span>
                     <button
                        type="button"
                        onClick={() => changeTextProp("angle", 0, "Reset Angle")}
                        title="Reset to 0°"
                        className="w-6 h-6 flex items-center justify-center rounded text-slate-400 dark:text-zinc-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
                     >
                        <RotateCcw size={11} />
                     </button>
                  </div>
               </div>
               <input
                  type="range"
                  min={0}
                  max={360}
                  step={1}
                  value={textProps.angle || 0}
                  onChange={(e) => changeTextProp("angle", Number(e.target.value), "Rotate Text")}
                  className="w-full accent-blue-500 hover:accent-blue-400 h-1.5 bg-slate-200 dark:bg-[#2C2C2C] rounded-full appearance-none outline-none cursor-pointer"
               />
            </div>

            <RangeSlider
               label="Letter Spacing"
               valueDisplay={textProps.charSpacing ?? 0}
               min={-100}
               max={800}
               step={5}
               value={textProps.charSpacing ?? 0}
               onChange={(e) => changeTextProp("charSpacing", Number(e.target.value), "Change Letter Spacing")}
            />

            <RangeSlider
               label="Line Height"
               valueDisplay={(textProps.lineHeight ?? 1.16).toFixed(2)}
               min={0.5}
               max={3}
               step={0.01}
               value={textProps.lineHeight ?? 1.16}
               onChange={(e) => changeTextProp("lineHeight", Number(e.target.value), "Change Line Height")}
            />
         </div>

         <div className="pt-1 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
               <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500">
                  <Wand2 size={11} /> Word Art
               </span>
               <label className="flex items-center gap-1.5 cursor-pointer">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-zinc-500">Keep font</span>
                  <ToggleSwitch checked={keepFont} onChange={setKeepFont} showState={false} title="Apply the effect but leave the typeface alone" />
               </label>
            </div>

            <div className="grid grid-cols-4 gap-1 p-1 mb-2 rounded-lg bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5">
               {WORD_ART_CATEGORIES.map(cat => (
                  <button
                     key={cat}
                     type="button"
                     aria-pressed={artCategory === cat}
                     onClick={() => setArtCategory(cat)}
                     className={`h-7 rounded-md text-[10px] font-semibold transition-all active:scale-95 ${artCategory === cat
                        ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                        : 'text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'}`}
                  >
                     {cat}
                  </button>
               ))}
            </div>

            <div className="grid grid-cols-3 gap-1.5">
               {visibleStyles.map(style => (
                  <button
                     key={style.id}
                     type="button"
                     title={`${style.name} - hover to preview`}
                     {...bindArt(style)}
                     onClick={() => applyWordArt(style)}
                     className="group rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#101010] hover:border-blue-400 dark:hover:border-blue-500/60 overflow-hidden transition-all active:scale-[0.97] touch-manipulation"
                  >
                     {/* A checkerboard shows through the hollow styles, which are otherwise blank. */}
                     <span
                        className="flex items-center justify-center h-11 bg-[linear-gradient(45deg,rgba(120,120,120,0.12)_25%,transparent_25%,transparent_75%,rgba(120,120,120,0.12)_75%),linear-gradient(45deg,rgba(120,120,120,0.12)_25%,transparent_25%,transparent_75%,rgba(120,120,120,0.12)_75%)] bg-[length:8px_8px] bg-[position:0_0,4px_4px]"
                     >
                        <span className="text-[26px] leading-none select-none" style={wordArtCss(style) as any}>
                           {style.sample}
                        </span>
                     </span>
                     <span className="block px-1 py-1 text-[8px] font-semibold uppercase tracking-wide truncate text-slate-500 dark:text-zinc-500 group-hover:text-slate-800 dark:group-hover:text-zinc-200 border-t border-slate-200 dark:border-white/5">
                        {style.name}
                     </span>
                  </button>
               ))}
            </div>

            <button
               type="button"
               onClick={clearWordArt}
               title="Strip the gradient, outline, glow and slant back to plain type"
               className="mt-2 w-full h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[10px] font-semibold text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] touch-manipulation"
            >
               <Eraser size={12} /> Remove Word Art
            </button>
         </div>

         <div className="pt-1 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center justify-between mb-2">
               <span className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500">
                  <Sun size={11} /> Shadow
               </span>
               <ToggleSwitch
                  checked={shadow.enabled}
                  onChange={(next) => setShadowAnd({ ...shadow, enabled: next })}
                  title={shadow.enabled ? 'Turn the shadow off' : 'Turn the shadow on'}
               />
            </div>

            {shadow.enabled && (
               <div className="space-y-3">
                  <div className="grid grid-cols-4 gap-1">
                     {SHADOW_STYLES.map(style => (
                        <button
                           key={style.id}
                           type="button"
                           title={`${style.label} shadow`}
                           onClick={() => setShadowAnd({ enabled: true, ...style.value })}
                           className="h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-[10px] font-semibold text-slate-600 dark:text-zinc-400 hover:bg-white dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/20 transition-all active:scale-[0.97] touch-manipulation"
                        >
                           {style.label}
                        </button>
                     ))}
                  </div>

                  <div className="flex items-center gap-2 h-9 pl-1.5 pr-2 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                     <div
                        className="w-6 h-6 rounded-md shrink-0 border border-black/10 dark:border-white/20 shadow-inner relative overflow-hidden"
                        style={{ backgroundColor: shadow.color }}
                     >
                        <ShadowColorTrigger
                           color={shadow.color}
                           onChange={(c) => setShadowAnd({ ...shadow, color: splitColor(c).hex })}
                           className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                           label="Shadow colour"
                        />
                     </div>
                     <span className="font-mono text-[10px] uppercase text-slate-600 dark:text-zinc-400 truncate">{shadow.color}</span>
                     <span className="ml-auto font-mono text-[10px] text-slate-400 dark:text-zinc-500">{shadow.opacity}%</span>
                  </div>

                  <RangeSlider
                     label="Opacity"
                     valueDisplay={shadow.opacity}
                     displayUnit="%"
                     min={0} max={100} step={1}
                     value={shadow.opacity}
                     onChange={(e) => applyShadow({ ...shadow, opacity: Number(e.target.value) })}
                     onPointerUp={() => commitShadow(shadow)}
                     onKeyUp={() => commitShadow(shadow)}
                  />

                  <RangeSlider
                     label="Blur"
                     valueDisplay={shadow.blur}
                     min={0} max={60} step={1}
                     value={shadow.blur}
                     onChange={(e) => applyShadow({ ...shadow, blur: Number(e.target.value) })}
                     onPointerUp={() => commitShadow(shadow)}
                     onKeyUp={() => commitShadow(shadow)}
                  />

                  <div className="grid grid-cols-2 gap-3">
                     <RangeSlider
                        label="Offset X"
                        valueDisplay={shadow.offsetX}
                        min={-50} max={50} step={1}
                        value={shadow.offsetX}
                        onChange={(e) => applyShadow({ ...shadow, offsetX: Number(e.target.value) })}
                        onPointerUp={() => commitShadow(shadow)}
                        onKeyUp={() => commitShadow(shadow)}
                     />
                     <RangeSlider
                        label="Offset Y"
                        valueDisplay={shadow.offsetY}
                        min={-50} max={50} step={1}
                        value={shadow.offsetY}
                        onChange={(e) => applyShadow({ ...shadow, offsetY: Number(e.target.value) })}
                        onPointerUp={() => commitShadow(shadow)}
                        onKeyUp={() => commitShadow(shadow)}
                     />
                  </div>
               </div>
            )}
         </div>
      </PanelSection>
   );
};
