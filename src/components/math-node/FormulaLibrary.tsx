import React, { useState, useEffect } from "react";
import {
  Bookmark,
  Search,
  X,
  Heart,
  GripVertical,
  Plus,
  Trash2,
  Edit2,
  Check,
  Copy,
  ChevronDown,
  ChevronUp,
  Sparkles,
  PenLine,
} from "lucide-react";
import { liveQuery } from "dexie";
import katex from "katex";
import * as mathjs from "mathjs";

import { db, CustomFormula } from "../../lib/db";
import { ConfirmModal } from "../ConfirmModal";

interface FormulaLibraryProps {
  onInsertFormula: (formula: {
    type: any;
    expr: string;
    operator?: string;
    expr2?: string;
  }) => void;
}

export const FormulaLibrary: React.FC<FormulaLibraryProps> = ({
  onInsertFormula,
}) => {
  const [savedFormulas, setSavedFormulas] = useState<CustomFormula[]>([]);
  const [libraryCollapsed, setLibraryCollapsed] = useState(false);
  const [formulaSearchQuery, setFormulaSearchQuery] = useState("");
  const [dragEnabledFormulaId, setDragEnabledFormulaId] = useState<number | null>(null);
  
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [draggedGroup, setDraggedGroup] = useState<"favorite" | "regular" | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [hoveredGroup, setHoveredGroup] = useState<"favorite" | "regular" | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<"top" | "bottom" | null>(null);

  const [copiedFormulaId, setCopiedFormulaId] = useState<number | null>(null);
  const [editingFormulaFieldId, setEditingFormulaFieldId] = useState<number | null>(null);
  const [editingFormulaExpr, setEditingFormulaExpr] = useState("");

  const [editingFormulaMetaId, setEditingFormulaMetaId] = useState<number | null>(null);
  const [editingFormulaName, setEditingFormulaName] = useState("");
  const [editingFormulaDesc, setEditingFormulaDesc] = useState("");

  const [deleteFormulaId, setDeleteFormulaId] = useState<number | null>(null);
  const [deleteFormulaName, setDeleteFormulaName] = useState<string>("");

  useEffect(() => {
    const subscription = liveQuery(() => db.customFormulas.toArray()).subscribe(
      (result) => {
        setSavedFormulas(result);
      }
    );
    return () => subscription.unsubscribe();
  }, []);

  const activeFormulas = savedFormulas;
  const filteredFormulas = activeFormulas.filter((f) =>
    f.name.toLowerCase().includes(formulaSearchQuery.toLowerCase()),
  );

  const favoriteFormulas = filteredFormulas
    .filter((f) => f.isFavorite)
    .sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : a.id || 0;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : b.id || 0;
      return orderA - orderB;
    });

  const nonFavoriteFormulas = filteredFormulas
    .filter((f) => !f.isFavorite)
    .sort((a, b) => {
      const orderA = a.sortOrder !== undefined ? a.sortOrder : a.id || 0;
      const orderB = b.sortOrder !== undefined ? b.sortOrder : b.id || 0;
      return orderA - orderB;
    });

  const renderDropIndicator = (insertIndex: number, currentGroup: "favorite" | "regular") => {
    let show = false;
    if (
      draggedIndex !== null &&
      hoveredIndex !== null &&
      hoveredGroup === currentGroup &&
      draggedGroup === currentGroup &&
      dragOverPosition !== null
    ) {
      let computedIndex = hoveredIndex;
      if (dragOverPosition === "bottom") {
        computedIndex = hoveredIndex + 1;
      }
      show = computedIndex === insertIndex;
    }

    const isFav = currentGroup === "favorite";

    return (
      <div
        className={`relative w-full transition-all duration-300 ease-out flex items-center pointer-events-none select-none z-30 ${
          show ? "h-6 my-1 opacity-100 scale-y-100" : "h-0 my-0 opacity-0 scale-y-0"
        }`}
      >
        <div className="absolute inset-x-0 h-1 flex items-center pr-1.5 pl-0.5">
          <div
            className={`h-0.5 w-full rounded-full relative ${
              isFav
                ? "bg-rose-500 shadow-[0_0_12px_#f43f5e] dark:shadow-[0_0_15px_#f43f5e]"
                : "bg-blue-500 shadow-[0_0_12px_#3b82f6] dark:shadow-[0_0_15px_#3b82f6]"
            }`}
          >
            <div
              className={`absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 rounded-full ring-[4px] transition-all duration-300 ${
                isFav ? "bg-rose-450 ring-rose-500/30" : "bg-blue-450 ring-blue-500/30"
              } ${show ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
            />
          </div>
        </div>
      </div>
    );
  };

  const handleDragStart = (e: React.DragEvent, index: number, group: "favorite" | "regular") => {
    setDraggedIndex(index);
    setDraggedGroup(group);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, hoverIndex: number, group: "favorite" | "regular") => {
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const isTopHalf = relativeY < rect.height / 2;
    setHoveredIndex(hoverIndex);
    setHoveredGroup(group);
    setDragOverPosition(isTopHalf ? "top" : "bottom");
  };

  const handleDragLeave = () => {
    setHoveredIndex(null);
    setHoveredGroup(null);
    setDragOverPosition(null);
  };

  const handleDragEnd = async () => {
    if (
      draggedIndex !== null &&
      hoveredIndex !== null &&
      draggedGroup !== null &&
      draggedGroup === hoveredGroup &&
      dragOverPosition !== null
    ) {
      const isFav = draggedGroup === "favorite";
      const groupItems = savedFormulas
        .filter((f) => (isFav ? f.isFavorite : !f.isFavorite))
        .sort((a, b) => {
          const orderA = a.sortOrder !== undefined ? a.sortOrder : a.id || 0;
          const orderB = b.sortOrder !== undefined ? b.sortOrder : b.id || 0;
          return orderA - orderB;
        });

      if (
        draggedIndex >= 0 &&
        draggedIndex < groupItems.length &&
        hoveredIndex >= 0 &&
        hoveredIndex < groupItems.length
      ) {
        const draggedItem = groupItems[draggedIndex];
        let targetIndex = hoveredIndex;
        if (dragOverPosition === "bottom") {
          targetIndex = hoveredIndex + 1;
        }
        if (targetIndex > draggedIndex) {
          targetIndex--;
        }
        groupItems.splice(draggedIndex, 1);
        groupItems.splice(targetIndex, 0, draggedItem);

        for (let i = 0; i < groupItems.length; i++) {
          if (groupItems[i].id) {
            await db.customFormulas.update(groupItems[i].id!, {
              sortOrder: i,
            });
          }
        }
      }
    }

    setDraggedIndex(null);
    setDraggedGroup(null);
    setHoveredIndex(null);
    setHoveredGroup(null);
    setDragOverPosition(null);
    setDragEnabledFormulaId(null);
  };

  const toggleFavorite = async (formula: CustomFormula) => {
    if (formula.id) {
      await db.customFormulas.update(formula.id, {
        isFavorite: !formula.isFavorite,
      });
    }
  };

  const handleSaveExpr = async (id: number) => {
    if (editingFormulaExpr.trim()) {
      await db.customFormulas.update(id, {
        expr: editingFormulaExpr.trim(),
      });
    }
    setEditingFormulaFieldId(null);
  };

  const handleSaveMeta = async (id: number) => {
    if (editingFormulaName.trim()) {
      await db.customFormulas.update(id, {
        name: editingFormulaName.trim(),
        description: editingFormulaDesc.trim(),
      });
    }
    setEditingFormulaMetaId(null);
  };

  const renderFormulaLaTeX = (expr: string, type: string) => {
    try {
      let fullTex = "";
      const eqIndex = expr.indexOf("=");
      if (
        eqIndex !== -1 &&
        !expr.includes("==") &&
        !expr.includes(">=") &&
        !expr.includes("<=") &&
        !expr.includes("!=")
      ) {
        const lhs = expr.slice(0, eqIndex).trim();
        const rhs = expr.slice(eqIndex + 1).trim();
        const lhsTex = mathjs.parse(lhs).toTex();
        const rhsTex = mathjs.parse(rhs).toTex();
        fullTex = `${lhsTex} = ${rhsTex}`;
      } else {
        const parsed = mathjs.parse(expr);
        const texStr = parsed.toTex();
        let prefix = "";
        if (type === "polar") prefix = "r = ";
        else if (type === "parametric") prefix = "[x,y] = ";
        else if (type === "implicit") prefix = "";
        else prefix = "y = ";
        fullTex = prefix + texStr;
      }

      const html = katex.renderToString(fullTex, {
        strict: "ignore",
        trust: true,
        throwOnError: true,
        displayMode: false,
      });
      return (
        <div
          className="text-blue-600 dark:text-blue-400 font-sans tracking-wide select-all text-xs"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      );
    } catch (err) {
      return <span className="font-mono text-xs">{expr}</span>;
    }
  };

  return (
    <div className="flex flex-col gap-3.5 pt-4.5 pb-2 border-t border-slate-200 dark:border-slate-800/80">
      <div
        onClick={() => setLibraryCollapsed(!libraryCollapsed)}
        className="flex items-center justify-between cursor-pointer select-none group/lib-header"
      >
        <div className="flex flex-col">
          <h3 className="font-bold text-xs text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-2 font-sans">
            <Bookmark
              size={15}
              className="text-amber-500 fill-amber-500 transition-transform group-hover/lib-header:scale-110"
            />
            <span>My Formulas Library</span>
          </h3>
          <p className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5 font-sans">
            All your saved formulas in one place
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-[#121B2D] border border-blue-200/50 dark:border-[#213554]/30 px-2.5 py-0.5 rounded-md shadow-xs font-bold transition-all">
            {savedFormulas.length} {savedFormulas.length === 1 ? "formula" : "formulas"}
          </span>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-200 transition-colors p-0.5 rounded"
          >
            {libraryCollapsed ? (
              <ChevronDown size={14} className="stroke-[2.5]" />
            ) : (
              <ChevronUp size={14} className="stroke-[2.5]" />
            )}
          </button>
        </div>
      </div>

      {!libraryCollapsed && (
        <div className="flex flex-col gap-3 animate-fadeIn">
          {/* Search Bar */}
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none">
              <Search size={13} className="text-blue-500 dark:text-blue-400" />
            </span>
            <input
              type="text"
              placeholder="Search saved formulas by name..."
              value={formulaSearchQuery}
              onChange={(e) => setFormulaSearchQuery(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-[#070b13] border border-slate-200 dark:border-[#1e293b]/70 hover:border-blue-300 dark:hover:border-blue-500/40 focus:border-blue-500 dark:focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-lg outline-none text-[11px] font-sans font-medium text-slate-800 dark:text-slate-100 transition-all placeholder:text-slate-450 dark:placeholder:text-slate-500 shadow-sm"
            />
            {formulaSearchQuery && (
              <button
                type="button"
                onClick={() => setFormulaSearchQuery("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X size={12} className="stroke-[2.5]" />
              </button>
            )}
          </div>

          {savedFormulas.length === 0 ? (
            <div className="text-[11px] text-slate-450 dark:text-slate-550 italic p-3 text-center rounded-xl bg-slate-50/50 dark:bg-slate-900/10 border border-slate-200/50 dark:border-slate-800/30 select-none">
              No custom formulas saved yet. Click the{" "}
              <Bookmark size={11} className="inline mx-0.5 text-slate-400" />{" "}
              icon on any function card to save it.
            </div>
          ) : filteredFormulas.length === 0 ? (
            <div className="text-[11px] text-slate-450 dark:text-slate-550 italic py-4 text-center rounded-xl bg-slate-50/50 dark:bg-slate-900/10 border border-slate-200/50 dark:border-slate-800/30 select-none">
              No formulas match "{formulaSearchQuery}"
            </div>
          ) : (
            <div
              className="flex flex-col gap-3.5 max-h-[380px] overflow-y-auto custom-scrollbar pr-1"
              style={{ scrollbarGutter: "stable" }}
            >
              {[
                { label: "Favorites", items: favoriteFormulas, group: "favorite" as const, color: "rose" },
                { label: "Other Formulas", items: nonFavoriteFormulas, group: "regular" as const, color: "slate" },
              ].map(({ label, items, group, color }) =>
                items.length > 0 ? (
                  <div key={group} className="flex flex-col gap-1.5 animate-fadeIn">
                    <div
                      className={`text-[9px] font-semibold tracking-wider uppercase flex items-center gap-1 mt-2 mb-0.5 px-0.5 font-sans ${
                        group === "favorite"
                          ? "text-rose-500 dark:text-rose-450"
                          : "text-slate-400 dark:text-slate-450 border-t border-slate-200/40 dark:border-slate-800/40 pt-2.5"
                      }`}
                    >
                      {group === "favorite" && (
                        <Heart size={10} className="fill-rose-500 text-rose-500 animate-pulse" />
                      )}
                      <span>
                        {label} ({items.length})
                      </span>
                    </div>

                    {items.map((formula, index) => (
                      <React.Fragment key={formula.id}>
                        {renderDropIndicator(index, group)}
                        <div
                          draggable={dragEnabledFormulaId === formula.id}
                          onDragStart={(e) => handleDragStart(e, index, group)}
                          onDragOver={(e) => handleDragOver(e, index, group)}
                          onDragLeave={handleDragLeave}
                          onDragEnd={handleDragEnd}
                          className={`p-3 border rounded-xl flex flex-col gap-2 group/formula transition-all duration-200 relative ${
                            group === "favorite"
                              ? "border-rose-200/40 dark:border-rose-500/15 bg-rose-50/15 dark:bg-[#0D1527]/90 hover:bg-rose-50/25 dark:hover:bg-[#131f3c] shadow-[0_0_15px_rgba(244,63,94,0.02)] lg:hover:shadow-[0_0_15px_rgba(244,63,94,0.05)]"
                              : "border-slate-200 dark:border-slate-800/40 bg-white dark:bg-[#0D1527]/30 hover:bg-slate-50/70 dark:hover:bg-[#0D1527]/60 shadow-xs"
                          } ${
                            draggedIndex === index && draggedGroup === group
                              ? group === "favorite"
                                ? "opacity-15 border-dashed border-rose-500 bg-rose-550/5 scale-[0.98] shadow-inner scale-y-95 transition-all duration-200"
                                : "opacity-15 border-dashed border-blue-500 bg-blue-500/5 scale-[0.98] shadow-inner scale-y-95 transition-all duration-200"
                              : ""
                          }`}
                        >
                          {/* Header Row */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div
                                onMouseDown={() => setDragEnabledFormulaId(formula.id || null)}
                                onMouseUp={() => setDragEnabledFormulaId(null)}
                                onMouseLeave={() => setDragEnabledFormulaId(null)}
                                className={`cursor-grab active:cursor-grabbing p-0.5 -ml-1 select-none flex items-center justify-center ${
                                  group === "favorite"
                                    ? "text-rose-450 hover:text-rose-500 animate-pulse"
                                    : "text-slate-400 hover:text-slate-300"
                                }`}
                              >
                                <GripVertical
                                  size={13}
                                  className={`opacity-${group === "favorite" ? "80" : "60"} group-hover/formula:opacity-100 transition-opacity`}
                                />
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleFavorite(formula)}
                                className={`hover:scale-115 transition-transform p-0.5 cursor-pointer flex items-center justify-center ${
                                  group === "favorite"
                                    ? "text-[#F43F5E]"
                                    : "text-slate-400 hover:text-[#F43F5E] dark:text-slate-500 dark:hover:text-[#F43F5E]"
                                }`}
                                title={group === "favorite" ? "Remove from favorites" : "Add to favorites"}
                              >
                                <Heart
                                  size={14}
                                  className={group === "favorite" ? "text-[#F43F5E] fill-[#F43F5E] stroke-[2.5]" : "fill-none stroke-[2.5]"}
                                />
                              </button>

                              <span
                                className={`font-bold text-xs truncate ${
                                  group === "favorite" ? "text-rose-950 dark:text-rose-100" : "text-slate-850 dark:text-slate-100"
                                }`}
                                title={formula.name}
                              >
                                {formula.name}
                              </span>

                              <span
                                className={`text-[8px] tracking-wider uppercase font-extrabold select-none border px-1.5 py-0.5 rounded font-sans leading-none ml-1 flex-shrink-0 ${
                                  group === "favorite"
                                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                                }`}
                              >
                                {formula.type === "polar"
                                  ? "POLAR"
                                  : formula.type === "parametric"
                                  ? "PARAMETRIC"
                                  : "FUNCTION"}
                              </span>
                            </div>

                            {/* Action row */}
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => {
                                  onInsertFormula({
                                    expr: formula.expr,
                                    type: formula.type || "function",
                                  });
                                }}
                                className={`h-7 w-7 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-xs ${
                                  group === "favorite"
                                    ? "bg-rose-500/10 hover:bg-rose-500/20 hover:scale-105 border border-rose-500/25 text-rose-500"
                                    : "bg-blue-600/10 hover:bg-blue-600/20 hover:scale-105 border border-blue-500/25 text-blue-500 dark:text-blue-400"
                                }`}
                                title="Insert Formula Into Graph"
                              >
                                <Plus size={14} className="stroke-[2.5]" />
                              </button>

                              <button
                                onClick={() => {
                                  setEditingFormulaMetaId(formula.id || null);
                                  setEditingFormulaName(formula.name);
                                  setEditingFormulaDesc(formula.description || "");
                                }}
                                className="h-7 w-7 bg-amber-500/10 hover:bg-amber-500/25 text-amber-600 rounded-md border border-amber-500/20 flex items-center justify-center transition-all opacity-40 group-hover/formula:opacity-100 hover:scale-105 cursor-pointer shadow-xs"
                                title="Edit Details"
                              >
                                <PenLine size={13} />
                              </button>

                              <button
                                onClick={() => {
                                  if (formula.id) {
                                    setDeleteFormulaId(formula.id);
                                    setDeleteFormulaName(formula.name);
                                  }
                                }}
                                className={`h-7 w-7 rounded-md border flex items-center justify-center transition-all opacity-40 group-hover/formula:opacity-100 hover:scale-105 cursor-pointer shadow-xs ${
                                  group === "favorite"
                                    ? "bg-red-500/10 hover:bg-red-500/25 text-red-550 border-red-555/20"
                                    : "bg-red-500/10 hover:bg-red-500/25 text-red-500 border-red-500/15"
                                }`}
                                title="Delete Formula"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Edit Meta Name/Desc Block */}
                          {editingFormulaMetaId === formula.id && (
                            <div className="flex flex-col gap-2 mt-1 mb-2 pl-5 pr-1 animate-fadeIn">
                              <input
                                type="text"
                                autoFocus
                                value={editingFormulaName}
                                onChange={(e) => setEditingFormulaName(e.target.value)}
                                placeholder="Formula Name"
                                className="w-full bg-[#070b13]/50 border border-amber-500/50 focus:border-amber-400 focus:ring-1 focus:ring-amber-450 rounded-lg h-7 px-2 outline-none font-sans text-xs text-amber-500 placeholder:text-amber-500/50 font-bold"
                              />
                              <input
                                type="text"
                                value={editingFormulaDesc}
                                onChange={(e) => setEditingFormulaDesc(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveMeta(formula.id!);
                                  if (e.key === "Escape") setEditingFormulaMetaId(null);
                                }}
                                placeholder="Description (Optional)"
                                className="w-full bg-[#070b13]/50 border border-slate-500/50 focus:border-slate-400 focus:ring-1 focus:ring-slate-450 rounded-lg h-7 px-2 outline-none font-sans text-xs text-slate-300 placeholder:text-slate-500/50"
                              />
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  onClick={() => setEditingFormulaMetaId(null)}
                                  className="text-[10px] px-2 py-1 bg-slate-500/20 hover:bg-slate-500/30 text-slate-300 rounded"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveMeta(formula.id!)}
                                  className="text-[10px] px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-500 font-bold rounded"
                                >
                                  Save Details
                                </button>
                              </div>
                            </div>
                          )}

                          {/* Formula Description (only if not editing meta) */}
                          {formula.description && editingFormulaMetaId !== formula.id && (
                            <p
                              className={`text-[10px] leading-normal pl-5 pr-2 ${
                                group === "favorite" ? "text-rose-700 dark:text-rose-300" : "text-slate-500 dark:text-slate-450"
                              }`}
                            >
                              {formula.description}
                            </p>
                          )}

                          {/* Click to Edit / Blur to LaTeX Block */}
                          {editingFormulaFieldId === formula.id ? (
                            <div className="pl-5 pr-1 mt-0.5">
                              <input
                                type="text"
                                value={editingFormulaExpr}
                                onChange={(e) => setEditingFormulaExpr(e.target.value)}
                                onBlur={() => handleSaveExpr(formula.id!)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleSaveExpr(formula.id!);
                                  if (e.key === "Escape") setEditingFormulaFieldId(null);
                                }}
                                className={`w-full bg-[#070b13] border focus:ring-1 rounded-lg h-8 px-2.5 outline-none font-mono text-xs font-bold ${
                                  group === "favorite"
                                    ? "border-blue-500 focus:border-blue-400 focus:ring-blue-450 text-blue-300"
                                    : "border-blue-500 hover:border-blue-400 focus:ring-blue-450 text-blue-300 bg-[#0D1527]"
                                }`}
                              />
                            </div>
                          ) : (
                            <div
                              onClick={() => {
                                setEditingFormulaFieldId(formula.id!);
                                setEditingFormulaExpr(formula.expr);
                              }}
                              className={`ml-5 flex items-center justify-between border rounded-lg p-2.5 min-h-[2.25rem] cursor-text transition-all select-none group/math-block relative ${
                                group === "favorite"
                                  ? "bg-white dark:bg-[#070b13]/60 border-rose-100/60 dark:border-rose-900/20 hover:border-rose-300 dark:hover:border-rose-500/30"
                                  : "bg-slate-50 dark:bg-[#0D1527]/20 border-slate-200 dark:border-slate-800 hover:border-blue-300 dark:hover:border-blue-500/30"
                              }`}
                              title="Click to Edit Formula"
                            >
                              <div className="flex-1 overflow-x-auto custom-scrollbar pr-6 pb-1">
                                {renderFormulaLaTeX(formula.expr, formula.type || "function")}
                              </div>
                              <div className="absolute right-2.5 top-2.5 flex items-center gap-1.5 opacity-0 group-hover/math-block:opacity-100 transition-opacity">
                                <Edit2 size={11} className={group === "favorite" ? "text-pink-400" : "text-blue-400"} />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigator.clipboard.writeText(formula.expr);
                                    setCopiedFormulaId(formula.id || null);
                                    setTimeout(() => setCopiedFormulaId(null), 2000);
                                  }}
                                  className={`p-0.5 rounded transition-all cursor-pointer flex items-center justify-center h-5 w-5 ${
                                    group === "favorite"
                                      ? "hover:bg-pink-500/10 dark:hover:bg-pink-500/20 text-pink-400"
                                      : "hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-300"
                                  }`}
                                  title="Copy Raw Expression String"
                                >
                                  {copiedFormulaId === formula.id ? (
                                    <Check size={11} className="text-emerald-450 stroke-[3]" />
                                  ) : (
                                    <Copy size={11} />
                                  )}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </React.Fragment>
                    ))}
                    {renderDropIndicator(items.length, group)}
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* Informative Footer */}
          <div className="flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-slate-400/90 dark:text-slate-500 font-sans tracking-wide select-none font-semibold text-center border-t border-slate-200/40 dark:border-slate-800/40 mt-1">
            <Sparkles size={11} className="text-blue-400 animate-pulse fill-blue-400/10" />
            <span>Drag to reorder • Click + to add a new formula</span>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={deleteFormulaId !== null}
        title="Delete Formula"
        message={
          <>
            Are you sure you want to delete the formula <span className="font-bold">"{deleteFormulaName}"</span>? This action cannot be undone.
          </>
        }
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onClose={() => setDeleteFormulaId(null)}
        onConfirm={async () => {
          if (deleteFormulaId) {
            await db.customFormulas.delete(deleteFormulaId);
            setDeleteFormulaId(null);
          }
        }}
      />
    </div>
  );
};
