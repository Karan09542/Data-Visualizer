import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
   SquareDashed, Plus, Copy, Trash2, ChevronDown, MoreVertical, Edit2,
   RectangleVertical, RectangleHorizontal, ArrowUp, ArrowDown, Check, Settings2, ZoomIn
} from 'lucide-react';
import { useWorkspaceUI } from '../../contexts/WorkspaceUIContext';
import { useCanvas } from '../../contexts/CanvasContext';
import { useHistory } from '../../contexts/HistoryContext';
import { PRESET_REGISTRY, getDimensionsInPixels } from '../../../../lib/imagePresets';
import { ColorPickerTrigger } from '../shared/ColorPickers';

const CHECKER = 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYNgGwEg9AMRAGQzUQJDw/wP9h2IIMhqwYYwGKDAaINBQgAHTyMAwwAEAnpIEB3aIfjIAAAAASUVQRVGGIII=")';

/**
 * Whether a gesture started on something that has its own meaning for it - a text field, a button,
 * the settings panel. Card gestures stand aside there: a double-click in a width field is selecting
 * a number, and a right-click in one should still get the browser's copy/paste menu.
 */
const isOwnGestureTarget = (target: EventTarget | null): boolean =>
   target instanceof Element && !!target.closest('input, textarea, select, button, a, [data-card-ignore]');

const LONG_PRESS_MS = 500;
const DOUBLE_TAP_MS = 320;
const TOUCH_SLOP_PX = 10;

/** Field label at the one size used across the inspector. */
const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
   <span className="text-[9px] uppercase font-bold tracking-wider text-slate-500 dark:text-zinc-500 block mb-1">{children}</span>
);

/**
 * Guide toggle. A full-width row rather than a bare 16px checkbox: on touch the old control gave
 * a ~16px hit area, which is well under the 44px a finger needs.
 */
const ToggleChip: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void }> = ({ label, checked, onChange }) => (
   <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className={`h-9 px-2.5 rounded-lg border text-[10px] font-semibold flex items-center gap-2 transition-colors text-left ${checked
         ? 'bg-blue-50 dark:bg-blue-500/15 border-blue-200 dark:border-blue-500/40 text-blue-700 dark:text-blue-300'
         : 'bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 dark:text-zinc-400 hover:border-slate-300 dark:hover:border-white/25'}`}
   >
      <span className={`w-4 h-4 shrink-0 rounded-[4px] border-2 flex items-center justify-center transition-colors ${checked
         ? 'bg-blue-500 border-blue-500 text-white'
         : 'border-slate-300 dark:border-slate-600'}`}
      >
         {checked && <Check size={10} strokeWidth={4} />}
      </span>
      <span className="truncate">{label}</span>
   </button>
);

const MenuItem: React.FC<{
   icon: React.ReactNode; label: string; danger?: boolean; disabled?: boolean; onClick: (e: React.MouseEvent) => void;
}> = ({ icon, label, danger, disabled, onClick }) => (
   <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`w-full px-3 h-9 text-left text-[11px] font-semibold transition-colors flex items-center gap-2.5 disabled:opacity-40 disabled:cursor-not-allowed ${danger
         ? 'text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20'
         : 'text-slate-600 dark:text-zinc-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'}`}
   >
      {icon} {label}
   </button>
);

export const ArtboardsTab: React.FC = () => {
   const {
      artboards, setArtboards, activeArtboardId, setActiveArtboardId,
      createArtboard, createArtboardFromPreset, duplicateArtboard, deleteArtboard,
      updateArtboardProp, onArtboardPropStart, onArtboardPropCommit
   } = useWorkspaceUI();

   const { updateArtboardPropDirect, fabricRef, setZoomPercent } = useCanvas();
   const { executeCommand } = useHistory();

   const [draggedArtboardIdx, setDraggedArtboardIdx] = useState<number | null>(null);
   const [dragOverArtboardIdx, setDragOverArtboardIdx] = useState<number | null>(null);

   const [openMenuId, setOpenMenuId] = useState<string | null>(null);
   // Set when the menu is opened by right-click or long-press, so it appears where the pointer is;
   // null means it hangs off the card's own menu button.
   const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

   // Touch has no dblclick or contextmenu worth relying on (iOS sends neither), so both are
   // recognised from the raw touches.
   const lastTapRef = useRef<{ id: string; time: number } | null>(null);
   const suppressDblClickUntilRef = useRef(0);
   const longPressTimerRef = useRef<number | null>(null);
   const longPressFiredRef = useRef(false);
   const touchStartRef = useRef<{ x: number; y: number } | null>(null);
   const [expandedSettingsId, setExpandedSettingsId] = useState<string | null>(null);
   const [editingNameId, setEditingNameId] = useState<string | null>(null);
   const menuRef = useRef<HTMLDivElement>(null);

   const [showPresetsMenu, setShowPresetsMenu] = useState(false);
   const [presetCategoryFilter, setPresetCategoryFilter] = useState<string>("all");
   const presetsMenuRef = useRef<HTMLDivElement>(null);

   useEffect(() => {
      const handleClickOutside = (e: MouseEvent | TouchEvent) => {
         if (presetsMenuRef.current && !presetsMenuRef.current.contains(e.target as Node)) {
            setShowPresetsMenu(false);
         }
         if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
            setOpenMenuId(null);
         }
      };
      if (showPresetsMenu || openMenuId) {
         document.addEventListener('mousedown', handleClickOutside);
         document.addEventListener('touchstart', handleClickOutside);
      }
      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
         document.removeEventListener('touchstart', handleClickOutside);
      };
   }, [showPresetsMenu, openMenuId]);

   const moveArtboard = (sourceIndex: number, destIndex: number) => {
      if (sourceIndex === destIndex) return;
      if (destIndex < 0 || destIndex >= artboards.length) return;
      const newArtboards = [...artboards];
      const [removed] = newArtboards.splice(sourceIndex, 1);
      newArtboards.splice(destIndex, 0, removed);

      // Command history integration
      const cmd = {
         name: "Reorder Artboards",
         execute: () => { setArtboards(newArtboards); },
         undo: () => {
            const revertArtboards = [...newArtboards];
            const [popped] = revertArtboards.splice(destIndex, 1);
            revertArtboards.splice(sourceIndex, 0, popped);
            setArtboards(revertArtboards);
         }
      };
      executeCommand(cmd as any);
   };

   const toggleSettings = (boardId: string) => {
      setExpandedSettingsId(prev => (prev === boardId ? null : boardId));
      setActiveArtboardId(boardId);
   };

   const openMenuAt = (boardId: string, x: number, y: number) => {
      // Kept inside the window so a click near the edge does not open a menu half off-screen.
      const width = 184;
      const height = 300;
      setMenuPos({
         x: Math.max(8, Math.min(x, window.innerWidth - width)),
         y: Math.max(8, Math.min(y, window.innerHeight - height))
      });
      setOpenMenuId(boardId);
      setActiveArtboardId(boardId);
   };

   const clearLongPress = () => {
      if (longPressTimerRef.current !== null) {
         window.clearTimeout(longPressTimerRef.current);
         longPressTimerRef.current = null;
      }
   };

   const zoomToBoard = (board: any) => {
      if (!fabricRef.current) return;
      const cw = fabricRef.current.width!;
      const ch = fabricRef.current.height!;
      const zoom = Math.min(cw / (board.width + 100), ch / (board.height + 100), 2);
      fabricRef.current.setZoom(zoom);
      const vpt = fabricRef.current.viewportTransform!;
      const newVpt = vpt.slice() as any;
      newVpt[4] = cw / 2 - (board.x + board.width / 2) * zoom;
      newVpt[5] = ch / 2 - (board.y + board.height / 2) * zoom;
      fabricRef.current.setViewportTransform(newVpt);
      setZoomPercent(Math.round(zoom * 100));
   };

   return (
      <div className="flex flex-col h-full overflow-hidden text-slate-900 dark:text-white font-sans selection:bg-blue-500/30">
         {/* Header & Create */}
         <div className="p-3 md:p-4 shrink-0 border-b border-slate-200 dark:border-[#2C2C2C] bg-white dark:bg-[#1A1A1A] z-10 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-2">
                  <SquareDashed size={15} className="text-blue-500 dark:text-blue-400" />
                  <span className="text-sm font-semibold tracking-tight">Artboards</span>
               </div>
               <span className="text-[10px] bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-zinc-400 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-full font-medium">
                  {artboards.length}
               </span>
            </div>

            <div className="flex gap-2 relative">
               <div className="flex-1 relative min-w-0">
                  <button
                     type="button"
                     onClick={(e) => { e.stopPropagation(); setShowPresetsMenu(!showPresetsMenu); }}
                     aria-expanded={showPresetsMenu}
                     className="w-full h-10 bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-zinc-300 rounded-lg text-[11px] font-semibold transition-colors border border-slate-200 dark:border-white/10 flex items-center justify-between px-3 touch-manipulation"
                  >
                     <span className="truncate">Presets ({PRESET_REGISTRY.length})</span>
                     <ChevronDown size={14} className={`shrink-0 opacity-70 transition-transform ${showPresetsMenu ? 'rotate-180 text-blue-500 dark:text-blue-400' : ''}`} />
                  </button>

                  {showPresetsMenu && (
                     <div
                        ref={presetsMenuRef}
                        className="absolute top-full left-0 w-full md:w-[300px] mt-1.5 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#3A3A3A] rounded-xl shadow-2xl z-[99999] flex flex-col max-h-[380px] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
                     >
                        <div className="p-1.5 bg-slate-50 dark:bg-[#222] border-b border-slate-200 dark:border-[#333] flex gap-1 overflow-x-auto no-scrollbar shrink-0">
                           {['all', 'screens', 'social', 'document', 'print', 'ecommerce'].map(cat => (
                              <button
                                 key={cat}
                                 type="button"
                                 onClick={() => setPresetCategoryFilter(cat)}
                                 className={`px-2.5 h-8 rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors shrink-0 touch-manipulation ${presetCategoryFilter === cat
                                    ? 'bg-blue-600 text-white shadow-sm'
                                    : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white bg-white dark:bg-[#181818]'}`}
                              >
                                 {cat}
                              </button>
                           ))}
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar p-1">
                           {PRESET_REGISTRY
                              .filter(p => presetCategoryFilter === 'all' || p.category === presetCategoryFilter)
                              .map((preset) => {
                                 const dims = getDimensionsInPixels(preset);
                                 return (
                                    <div
                                       key={preset.id}
                                       className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg transition-colors flex items-center justify-between gap-2 group min-h-[44px]"
                                    >
                                       <button
                                          type="button"
                                          onClick={() => { createArtboardFromPreset(preset.id); setShowPresetsMenu(false); }}
                                          className="flex-1 text-left min-w-0 touch-manipulation"
                                          title={`Resize the active artboard to ${preset.name} (${dims.width}x${dims.height})`}
                                       >
                                          <div className="text-[11px] font-semibold text-slate-800 dark:text-zinc-200 group-hover:text-blue-600 dark:group-hover:text-blue-300 truncate">{preset.name}</div>
                                          <div className="text-[9px] font-mono text-slate-400 dark:text-zinc-500 mt-0.5 truncate">
                                             {dims.width} x {dims.height} px · {preset.category}
                                          </div>
                                       </button>

                                       <button
                                          type="button"
                                          onClick={(e) => {
                                             e.stopPropagation();
                                             createArtboard(preset.name, dims.width, dims.height);
                                             setShowPresetsMenu(false);
                                          }}
                                          className="h-8 px-2.5 bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-600 border border-blue-200 dark:border-blue-500/30 text-blue-600 dark:text-blue-300 hover:text-white rounded-md text-[9px] font-bold uppercase tracking-wider transition-colors shrink-0 touch-manipulation flex items-center gap-1"
                                          title="Create a new artboard with this preset"
                                       >
                                          <Plus size={11} /> New
                                       </button>
                                    </div>
                                 );
                              })}
                        </div>
                     </div>
                  )}
               </div>

               <button
                  onClick={() => createArtboard()}
                  className="h-10 px-4 shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-[11px] font-semibold transition-colors shadow-sm active:scale-[0.98] touch-manipulation flex items-center gap-1.5"
               >
                  <Plus size={14} /> Custom
               </button>
            </div>
         </div>

         {/* List existing artboards */}
         <div className="flex-1 overflow-y-auto w-full no-scrollbar px-2 py-3 bg-slate-50 dark:bg-[#111]">
            {artboards.length === 0 && (
               <div className="text-center px-6 py-10 text-[11px] text-slate-400 dark:text-zinc-500">
                  No artboards yet. Start from a preset or add a custom size.
               </div>
            )}
            <div className="space-y-2 pb-24">
               {artboards.map((board, idx) => {
                  const isActive = board.id === activeArtboardId;
                  const isExpanded = expandedSettingsId === board.id;
                  const objCount = fabricRef.current ? fabricRef.current.getObjects().filter(o => (o as any).artboardId === board.id).length : 0;
                  const isDragOver = dragOverArtboardIdx === idx;
                  const isDragging = draggedArtboardIdx === idx;

                  // Aspect-accurate mini preview, so orientation reads at a glance.
                  const ratio = board.height ? board.width / board.height : 1;
                  const thumbW = ratio >= 1 ? 26 : Math.max(6, Math.round(26 * ratio));
                  const thumbH = ratio >= 1 ? Math.max(6, Math.round(26 / ratio)) : 26;

                  return (
                     <div
                        key={board.id}
                        data-board-card
                        // Only a drop target now. The whole card used to be draggable, so pressing
                        // in the name or size fields and dragging to select text reordered the list.
                        onDragOver={(e) => { e.preventDefault(); setDragOverArtboardIdx(idx); }}
                        onDrop={(e) => {
                           e.preventDefault();
                           if (draggedArtboardIdx !== null && dragOverArtboardIdx !== null) {
                              moveArtboard(draggedArtboardIdx, dragOverArtboardIdx);
                           }
                           setDraggedArtboardIdx(null);
                           setDragOverArtboardIdx(null);
                        }}
                        onClick={() => setActiveArtboardId(board.id)}
                        onDoubleClick={(e) => {
                           if (isOwnGestureTarget(e.target)) return;
                           // A double-tap was already handled from the touches themselves.
                           if (Date.now() < suppressDblClickUntilRef.current) return;
                           toggleSettings(board.id);
                        }}
                        onContextMenu={(e) => {
                           if (isOwnGestureTarget(e.target)) return;
                           e.preventDefault();
                           openMenuAt(board.id, e.clientX, e.clientY);
                        }}
                        onTouchStart={(e) => {
                           if (e.touches.length !== 1 || isOwnGestureTarget(e.target)) return;
                           // A long-press on the handle starts a native drag on Android; opening the
                           // menu as well would put two gestures on one finger.
                           if (e.target instanceof Element && e.target.closest('[data-drag-handle]')) return;
                           const t = e.touches[0];
                           touchStartRef.current = { x: t.clientX, y: t.clientY };
                           longPressFiredRef.current = false;
                           clearLongPress();
                           longPressTimerRef.current = window.setTimeout(() => {
                              longPressFiredRef.current = true;
                              lastTapRef.current = null;
                              openMenuAt(board.id, t.clientX, t.clientY);
                           }, LONG_PRESS_MS);
                        }}
                        onTouchMove={(e) => {
                           const start = touchStartRef.current;
                           const t = e.touches[0];
                           // Scrolling the list is not a long-press.
                           if (start && t && Math.hypot(t.clientX - start.x, t.clientY - start.y) > TOUCH_SLOP_PX) {
                              clearLongPress();
                              touchStartRef.current = null;
                           }
                        }}
                        onTouchEnd={(e) => {
                           clearLongPress();
                           // After a long-press some browsers (iOS Safari especially) still send the
                           // compatibility mousedown/click. That mousedown lands outside the menu
                           // that just opened and the outside-click handler shut it straight away.
                           if (longPressFiredRef.current) e.preventDefault();
                           const wasTap = !!touchStartRef.current && !longPressFiredRef.current;
                           touchStartRef.current = null;
                           if (!wasTap || isOwnGestureTarget(e.target)) return;

                           const now = Date.now();
                           const last = lastTapRef.current;
                           if (last && last.id === board.id && now - last.time < DOUBLE_TAP_MS) {
                              lastTapRef.current = null;
                              suppressDblClickUntilRef.current = now + 600;
                              toggleSettings(board.id);
                           } else {
                              lastTapRef.current = { id: board.id, time: now };
                           }
                        }}
                        onTouchCancel={() => { clearLongPress(); touchStartRef.current = null; }}
                        className={`relative rounded-xl cursor-pointer border select-none transition-colors touch-manipulation ${isActive
                           ? 'bg-blue-50/60 dark:bg-blue-600/10 border-blue-400 dark:border-blue-500/80'
                           : 'bg-white dark:bg-[#1C1C1C] border-slate-200 dark:border-[#2C2C2C] hover:border-slate-300 dark:hover:border-[#4A4A4A]'}
                           ${isDragging ? 'opacity-30 border-dashed' : 'opacity-100'}
                           ${isDragOver && draggedArtboardIdx !== null && draggedArtboardIdx > idx ? 'border-t-2 border-t-blue-400' : ''}
                           ${isDragOver && draggedArtboardIdx !== null && draggedArtboardIdx < idx ? 'border-b-2 border-b-blue-400' : ''}`}
                     >
                        <div className="flex gap-3 items-center p-2.5">
                           <div
                              draggable
                              onDragStart={(e) => {
                                 e.stopPropagation();
                                 e.dataTransfer.effectAllowed = 'move';
                                 // Show the whole card under the pointer, not just the small thumbnail.
                                 const card = (e.currentTarget as HTMLElement).closest('[data-board-card]') as HTMLElement | null;
                                 if (card) e.dataTransfer.setDragImage(card, 24, 24);
                                 setDraggedArtboardIdx(idx);
                              }}
                              onDragEnd={() => { setDraggedArtboardIdx(null); setDragOverArtboardIdx(null); }}
                              title="Drag to reorder"
                              data-drag-handle
                              className="w-10 h-10 shrink-0 rounded-lg border border-slate-200 dark:border-[#3A3A3A] bg-slate-100 dark:bg-[#151515] flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing hover:border-blue-400 dark:hover:border-blue-500/60 transition-colors"
                              style={board.transparent ? { backgroundImage: CHECKER } : undefined}
                           >
                              <div
                                 className="rounded-[2px] border border-black/10 dark:border-white/15"
                                 style={{
                                    width: thumbW,
                                    height: thumbH,
                                    backgroundColor: board.transparent ? 'transparent' : (board.backgroundColor || '#ffffff')
                                 }}
                              />
                           </div>

                           <div className="flex-1 w-0 min-w-0">
                              {editingNameId === board.id ? (
                                 <input
                                    type="text"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-full h-9 bg-slate-50 dark:bg-[#111] border border-slate-300 dark:border-[#444] rounded-lg px-2 text-[11px] font-semibold text-slate-900 dark:text-white outline-none focus:border-blue-500 transition-colors"
                                    value={board.name}
                                    onFocus={() => onArtboardPropStart(board.name)}
                                    onChange={(e) => updateArtboardProp(board.id, "name", e.target.value)}
                                    onBlur={(e) => { onArtboardPropCommit(board.id, "name", e.target.value); setEditingNameId(null); }}
                                    onKeyDown={(e) => {
                                       if (e.key === 'Enter' || e.key === 'Escape') {
                                          onArtboardPropCommit(board.id, "name", board.name);
                                          setEditingNameId(null);
                                       }
                                    }}
                                 />
                              ) : (
                                 <>
                                    <div className={`text-[11px] font-semibold truncate ${isActive ? 'text-blue-700 dark:text-blue-300' : 'text-slate-800 dark:text-zinc-200'}`}>
                                       {board.name}
                                    </div>
                                    <div className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono flex items-center gap-1.5 mt-0.5">
                                       <span>{board.width}<span className="opacity-40">x</span>{board.height}</span>
                                       <span className="opacity-30">|</span>
                                       <span className="uppercase">{board.orientation === 'landscape' ? 'LND' : 'PRT'}</span>
                                       <span className="opacity-30">|</span>
                                       <span>{objCount} {objCount === 1 ? 'item' : 'items'}</span>
                                    </div>
                                 </>
                              )}
                           </div>

                           {/* Settings sits on the card itself. It used to be buried one level deep
                               in the overflow menu, which made it near-undiscoverable. */}
                           <button
                              onClick={(e) => {
                                 e.stopPropagation();
                                 setExpandedSettingsId(isExpanded ? null : board.id);
                                 if (!isActive) setActiveArtboardId(board.id);
                              }}
                              aria-expanded={isExpanded}
                              title={isExpanded ? 'Hide settings' : 'Artboard settings'}
                              className={`w-9 h-9 shrink-0 flex items-center justify-center rounded-lg transition-colors touch-manipulation ${isExpanded
                                 ? 'bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300'
                                 : 'text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white'}`}
                           >
                              <Settings2 size={15} />
                           </button>

                           <div className="shrink-0 relative">
                              <button
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuPos(null);
                                    setOpenMenuId(openMenuId === board.id ? null : board.id);
                                 }}
                                 title="More actions (or right-click the card)"
                                 className="w-9 h-9 flex items-center justify-center rounded-lg text-slate-400 dark:text-zinc-500 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-700 dark:hover:text-white transition-colors touch-manipulation"
                              >
                                 <MoreVertical size={16} />
                              </button>

                              {openMenuId === board.id && (() => {
                                 const menu = (
                                 <div
                                    ref={menuRef}
                                    data-card-ignore
                                    onClick={(e) => e.stopPropagation()}
                                    onContextMenu={(e) => e.preventDefault()}
                                    style={menuPos ? { position: 'fixed', left: menuPos.x, top: menuPos.y } : undefined}
                                    className={`${menuPos ? '' : 'absolute right-0 top-full mt-1'} w-44 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#3A3A3A] rounded-xl shadow-2xl z-[99999] flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100`}
                                 >
                                    <MenuItem
                                       icon={<Settings2 size={13} />} label={isExpanded ? 'Hide Settings' : 'Settings'}
                                       onClick={() => { toggleSettings(board.id); setOpenMenuId(null); }}
                                    />
                                    <MenuItem
                                       icon={<ZoomIn size={13} />} label="Zoom to Board"
                                       onClick={() => { setActiveArtboardId(board.id); zoomToBoard(board); setOpenMenuId(null); }}
                                    />
                                    <div className="h-px bg-slate-200 dark:bg-[#333] my-1 mx-2" />
                                    <MenuItem
                                       icon={<Edit2 size={13} />} label="Rename"
                                       onClick={() => { setEditingNameId(board.id); setOpenMenuId(null); }}
                                    />
                                    <MenuItem
                                       icon={<Copy size={13} />} label="Duplicate"
                                       onClick={() => { duplicateArtboard(board); setOpenMenuId(null); }}
                                    />
                                    <div className="h-px bg-slate-200 dark:bg-[#333] my-1 mx-2" />
                                    {/* Drag-to-reorder is mouse only, so touch needs these. */}
                                    <MenuItem
                                       icon={<ArrowUp size={13} />} label="Move Up" disabled={idx === 0}
                                       onClick={() => { moveArtboard(idx, idx - 1); setOpenMenuId(null); }}
                                    />
                                    <MenuItem
                                       icon={<ArrowDown size={13} />} label="Move Down" disabled={idx === artboards.length - 1}
                                       onClick={() => { moveArtboard(idx, idx + 1); setOpenMenuId(null); }}
                                    />
                                    <div className="h-px bg-slate-200 dark:bg-[#333] my-1 mx-2" />
                                    <MenuItem
                                       icon={<Trash2 size={13} />} label="Delete" danger
                                       onClick={() => { deleteArtboard(board.id); setOpenMenuId(null); }}
                                    />
                                 </div>
                                 );
                                 // Opened at the pointer: rendered on the page itself, so a transformed
                                 // panel ancestor cannot drag the "fixed" position away from the pointer.
                                 return menuPos ? createPortal(menu, document.body) : menu;
                              })()}
                           </div>
                        </div>

                        {isExpanded && (
                           <div
                              data-card-ignore
                              className="px-2.5 pb-2.5 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200"
                              onClick={e => e.stopPropagation()}
                              onDoubleClick={e => e.stopPropagation()}
                           >
                              <div className="pt-3 border-t border-slate-200 dark:border-white/5">
                                 <div className="grid grid-cols-2 gap-2">
                                    <div>
                                       <FieldLabel>Width</FieldLabel>
                                       <input
                                          type="number"
                                          className="w-full h-9 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 text-[11px] font-mono text-slate-700 dark:text-zinc-200 outline-none focus:border-blue-500 transition-colors"
                                          value={board.width}
                                          onFocus={() => onArtboardPropStart(board.width)}
                                          onChange={(e) => updateArtboardProp(board.id, "width", Math.max(10, Number(e.target.value)))}
                                          onBlur={(e) => onArtboardPropCommit(board.id, "width", Math.max(10, Number(e.target.value)))}
                                       />
                                    </div>
                                    <div>
                                       <FieldLabel>Height</FieldLabel>
                                       <input
                                          type="number"
                                          className="w-full h-9 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-2.5 text-[11px] font-mono text-slate-700 dark:text-zinc-200 outline-none focus:border-blue-500 transition-colors"
                                          value={board.height}
                                          onFocus={() => onArtboardPropStart(board.height)}
                                          onChange={(e) => updateArtboardProp(board.id, "height", Math.max(10, Number(e.target.value)))}
                                          onBlur={(e) => onArtboardPropCommit(board.id, "height", Math.max(10, Number(e.target.value)))}
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div>
                                 <FieldLabel>Orientation</FieldLabel>
                                 <div className="grid grid-cols-2 gap-1 bg-slate-100 dark:bg-[#0A0A0A] border border-slate-200 dark:border-white/5 rounded-lg p-1">
                                    {([
                                       { id: 'portrait', label: 'Portrait', icon: <RectangleVertical size={13} /> },
                                       { id: 'landscape', label: 'Landscape', icon: <RectangleHorizontal size={13} /> },
                                    ] as const).map(o => (
                                       <button
                                          key={o.id}
                                          type="button"
                                          onClick={() => updateArtboardPropDirect(board.id, "orientation", o.id, true)}
                                          aria-pressed={board.orientation === o.id}
                                          className={`h-8 rounded-md text-[10px] font-semibold flex items-center justify-center gap-1.5 transition-colors touch-manipulation ${board.orientation === o.id
                                             ? 'bg-blue-600 text-white shadow-sm'
                                             : 'text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/10'}`}
                                       >
                                          {o.icon} {o.label}
                                       </button>
                                    ))}
                                 </div>
                              </div>

                              <div>
                                 <FieldLabel>Background</FieldLabel>
                                 <div className="flex items-center gap-2">
                                    <div className="flex items-center flex-1 min-w-0 h-9 pl-1 pr-2 gap-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 focus-within:border-blue-500 transition-colors">
                                       <div
                                          className="w-7 h-7 shrink-0 rounded-md border border-black/10 dark:border-white/20 relative overflow-hidden"
                                          style={board.transparent ? { backgroundImage: CHECKER } : { backgroundColor: board.backgroundColor || '#ffffff' }}
                                       >
                                          <ColorPickerTrigger
                                             color={board.backgroundColor || "#ffffff"}
                                             onChange={(newColor) => updateArtboardProp(board.id, "backgroundColor", newColor)}
                                             onStart={(initialColor) => onArtboardPropStart(initialColor)}
                                             onCommit={(initialColor, finalColor) => {
                                                onArtboardPropStart(initialColor);
                                                onArtboardPropCommit(board.id, "backgroundColor", finalColor);
                                             }}
                                             label="Background"
                                             className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                          />
                                       </div>
                                       <input
                                          type="text"
                                          className="flex-1 min-w-0 bg-transparent text-[10px] uppercase font-mono text-slate-600 dark:text-zinc-300 outline-none"
                                          value={board.backgroundColor || "#FFFFFF"}
                                          onFocus={() => onArtboardPropStart(board.backgroundColor || "#ffffff")}
                                          onChange={(e) => updateArtboardProp(board.id, "backgroundColor", e.target.value)}
                                          onBlur={(e) => onArtboardPropCommit(board.id, "backgroundColor", e.target.value)}
                                       />
                                    </div>
                                    <div className="w-[46%] shrink-0">
                                       <ToggleChip
                                          label="Transparent"
                                          checked={!!board.transparent}
                                          onChange={(val) => updateArtboardPropDirect(board.id, "transparent", val, true)}
                                       />
                                    </div>
                                 </div>
                              </div>

                              <div className="pt-3 border-t border-slate-200 dark:border-white/5">
                                 <FieldLabel>Guides</FieldLabel>
                                 <div className="grid grid-cols-2 gap-1.5">
                                    <ToggleChip label="Grid" checked={!!board.showGrid} onChange={val => updateArtboardPropDirect(board.id, "showGrid", val, true)} />
                                    <ToggleChip label="Safe Area" checked={!!board.showSafeArea} onChange={val => updateArtboardPropDirect(board.id, "showSafeArea", val, true)} />
                                    <ToggleChip label="Margins" checked={!!board.showMargins} onChange={val => updateArtboardPropDirect(board.id, "showMargins", val, true)} />
                                    <ToggleChip label="Center Guide" checked={!!board.showCenter} onChange={val => updateArtboardPropDirect(board.id, "showCenter", val, true)} />
                                 </div>
                              </div>
                           </div>
                        )}
                     </div>
                  )
               })}
            </div>
         </div>
      </div>
   );
};
