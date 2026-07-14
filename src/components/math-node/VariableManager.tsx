import React, { useState, useRef, useLayoutEffect, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, Plus, MoreVertical, RotateCcw, Edit2, Copy, Trash2, Sliders, GripVertical, ChevronDown, ChevronRight, Folder } from "lucide-react";
import {
  MathVariable,
  VariableGroup,
  getVarColor,
  generateSafeId,
  InsertAboveIcon,
  InsertBelowIcon
} from "./index";

interface VariableManagerProps {
  variables: MathVariable[];
  groups: VariableGroup[];
  missingVars: string[];
  hoveredVar: string | null;
  setHoveredVar: (v: string | null) => void;
  activeActionMenuId: string | null;
  setActiveActionMenuId: (id: string | null) => void;
  handleAutoAddVar: (name: string) => void;
  handleAddVariableAt: (id: string, pos: "above" | "below") => void;
  handleUpdateVar: (id: string, updates: Partial<MathVariable>) => void;
  handleDeleteVar: (id: string) => void;
  setEditingVar: (v: MathVariable | null) => void;
  setShowVarEditor: (show: boolean) => void;
  setGroups: React.Dispatch<React.SetStateAction<VariableGroup[]>>;
  setVariables: React.Dispatch<React.SetStateAction<MathVariable[]>>;
  draggedVariableId: string | null;
  setDraggedVariableId: (id: string | null) => void;
  canDragVariableId: string | null;
  setCanDragVariableId: (id: string | null) => void;
  dragOverVariableId: string | null;
  setDragOverVariableId: (id: string | null) => void;
  dragOverVariablePosition: "top" | "bottom" | null;
  setDragOverVariablePosition: (pos: "top" | "bottom" | null) => void;
  handleDropVariable: (targetId: string, groupId: string, position: "top" | "bottom") => void;
}

const RangePopup = ({
  variable,
  anchorEl,
  onClose,
  onUpdate
}: {
  variable: MathVariable;
  anchorEl: HTMLElement;
  onClose: () => void;
  onUpdate: (id: string, updates: Partial<MathVariable>) => void;
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [min, setMin] = useState(variable.min);
  const [max, setMax] = useState(variable.max);
  const [step, setStep] = useState(variable.step);

  useLayoutEffect(() => {
    if (!anchorEl || !popupRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    const popupRect = popupRef.current.getBoundingClientRect();

    let top = rect.top + rect.height + window.scrollY + 8;
    let left = rect.left + window.scrollX - popupRect.width / 2 + rect.width / 2;

    if (top + popupRect.height > window.innerHeight + window.scrollY) {
      top = rect.top + window.scrollY - popupRect.height - 8;
    }
    if (left + popupRect.width > window.innerWidth + window.scrollX) {
      left = window.innerWidth + window.scrollX - popupRect.width - 10;
    }

    popupRef.current.style.top = `${top}px`;
    popupRef.current.style.left = `${left}px`;
  }, [anchorEl]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) && !anchorEl.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorEl, onClose]);

  const handleApply = () => {
    onUpdate(variable.id, { min, max, step });
    onClose();
  };

  return createPortal(
    <div
      ref={popupRef}
      className="absolute z-[9999] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg p-3 flex flex-col gap-2 w-48"
      onClick={e => e.stopPropagation()}
    >
      <div className="text-xs font-semibold text-slate-500 mb-1">Slider Range</div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-400 w-8">Min</span>
        <input type="number" value={min} onChange={e => setMin(Number(e.target.value))} className="flex-1 w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors" />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-400 w-8">Max</span>
        <input type="number" value={max} onChange={e => setMax(Number(e.target.value))} className="flex-1 w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors" />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-slate-400 w-8">Step</span>
        <input type="number" value={step} onChange={e => setStep(Number(e.target.value))} className="flex-1 w-0 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 transition-colors" />
      </div>
      <button onClick={handleApply} className="mt-2 bg-blue-600 hover:bg-blue-500 text-white rounded py-1.5 text-xs font-semibold w-full transition-colors shadow-sm">Apply</button>
    </div>,
    document.body
  );
};

export const VariableManager: React.FC<VariableManagerProps> = ({
  variables,
  groups,
  missingVars,
  hoveredVar,
  setHoveredVar,
  activeActionMenuId,
  setActiveActionMenuId,
  handleAutoAddVar,
  handleAddVariableAt,
  handleUpdateVar,
  handleDeleteVar,
  setEditingVar,
  setShowVarEditor,
  setGroups,
  setVariables,
  draggedVariableId,
  setDraggedVariableId,
  canDragVariableId,
  setCanDragVariableId,
  dragOverVariableId,
  setDragOverVariableId,
  dragOverVariablePosition,
  setDragOverVariablePosition,
  handleDropVariable,
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchVar, setSearchVar] = useState("");
  const [rangePopupVarId, setRangePopupVarId] = useState<string | null>(null);
  const [popupAnchorEl, setPopupAnchorEl] = useState<HTMLElement | null>(null);

  return (
    <div className="flex flex-col gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-xs text-slate-400 uppercase tracking-wider">
          Variables Manager
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={`p-1 rounded text-slate-500 dark:text-slate-300 transition-colors ${showSearch ? "bg-slate-200 dark:bg-slate-700" : "hover:bg-slate-200 dark:hover:bg-slate-700"}`}
            title="Search Variables"
          >
            <Search size={14} />
          </button>
          <button
            onClick={() => {
              setEditingVar(null);
              setShowVarEditor(true);
            }}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-300 transition-colors"
            title="Add Variable"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {showSearch && (
        <input
          type="text"
          className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-800 dark:text-slate-200 mt-[-8px] outline-none focus:border-blue-500 transition-all"
          placeholder="Search variables..."
          value={searchVar}
          onChange={(e) => setSearchVar(e.target.value)}
        />
      )}

      {missingVars.length > 0 && (
        <div className="bg-blue-900/20 border border-blue-500/30 p-2.5 rounded-lg flex flex-col gap-2">
          <div className="text-[10px] uppercase tracking-wider font-semibold text-blue-400">
            Detected missing variables
          </div>
          <div className="flex flex-wrap gap-1.5">
            {missingVars.map((mv) => (
              <button
                key={mv}
                className="bg-blue-600/80 hover:bg-blue-500 text-white px-2 py-0.5 rounded text-xs transition-colors flex items-center gap-1 shadow-sm"
                onClick={() => handleAutoAddVar(mv)}
              >
                <Plus size={10} /> {mv}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {groups.map((group) => {
          const groupVars = variables.filter(
            (v) =>
              v.groupId === group.id &&
              (v.name.toLowerCase().includes(searchVar.toLowerCase()) ||
                (v.displayName &&
                  v.displayName.toLowerCase().includes(searchVar.toLowerCase()))),
          );

          // Hide empty groups ONLY when there is an active search query
          if (groupVars.length === 0 && searchVar) return null;
          const isEmpty = groupVars.length === 0;

          return (
            <div key={group.id} className="flex flex-col gap-2">
              <div className="flex items-center justify-between group/header text-[10px] font-semibold text-slate-500 uppercase select-none">
                <div
                  className="flex items-center gap-1 cursor-pointer hover:text-slate-705 dark:hover:text-slate-350"
                  onClick={() =>
                    setGroups(
                      groups.map((g) =>
                        g.id === group.id
                          ? { ...g, isCollapsed: !g.isCollapsed }
                          : g,
                      ),
                    )
                  }
                >
                  {group.isCollapsed ? (
                    <ChevronRight size={12} />
                  ) : (
                    <ChevronDown size={12} />
                  )}
                  <span>{group.name}</span>
                </div>

                {/* Allow deletion of empty custom groups */}
                {group.id !== "default" && isEmpty && (
                  <button
                    onClick={() => {
                      setGroups((prev) =>
                        prev.filter((g) => g.id !== group.id),
                      );
                    }}
                    className="text-slate-400 hover:text-red-500 opacity-0 group-hover/header:opacity-100 transition-opacity p-0.5"
                    title="Delete empty group"
                  >
                    <Trash2 size={10} />
                  </button>
                )}
              </div>

              {!group.isCollapsed && isEmpty && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    // Set drop indicator for this group
                    setDragOverVariableId(`empty_${group.id}`);
                  }}
                  onDragLeave={() => {
                    if (
                      dragOverVariableId === `empty_${group.id}`
                    ) {
                      setDragOverVariableId(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (draggedVariableId) {
                      // Drop into this group
                      setVariables((prev) =>
                        prev.map((v) =>
                          v.id === draggedVariableId
                            ? { ...v, groupId: group.id }
                            : v,
                        ),
                      );
                    }
                    setDragOverVariableId(null);
                    setDraggedVariableId(null);
                  }}
                  className={`border-2 border-dashed rounded-lg p-3 text-center text-xs transition-all flex flex-col items-center justify-center gap-1 min-h-[64px] ${dragOverVariableId === `empty_${group.id}`
                    ? "border-blue-500 bg-blue-500/10 text-blue-500"
                    : "border-slate-200 dark:border-slate-800/60 text-slate-400 dark:text-slate-500 hover:border-slate-350 dark:hover:border-slate-700"
                    }`}
                >
                  <Folder className="opacity-30" size={14} />
                  <span>Empty. Drag variables here.</span>
                </div>
              )}

              {!group.isCollapsed &&
                groupVars.map((v) => (
                  <div
                    key={v.id}
                    draggable={canDragVariableId === v.id}
                    onDragStart={(e) => {
                      setDraggedVariableId(v.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      setDraggedVariableId(null);
                      setDragOverVariableId(null);
                      setDragOverVariablePosition(null);
                      setCanDragVariableId(null);
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      const rect =
                        e.currentTarget.getBoundingClientRect();
                      const relativeY = e.clientY - rect.top;
                      const isTop = relativeY < rect.height / 2;
                      setDragOverVariableId(v.id);
                      setDragOverVariablePosition(
                        isTop ? "top" : "bottom",
                      );
                    }}
                    onDragLeave={() => {
                      if (dragOverVariableId === v.id) {
                        setDragOverVariableId(null);
                        setDragOverVariablePosition(null);
                      }
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (
                        dragOverVariableId &&
                        dragOverVariablePosition
                      ) {
                        handleDropVariable(
                          v.id,
                          group.id,
                          dragOverVariablePosition,
                        );
                      }
                    }}
                    className={`flex flex-col gap-2 bg-white dark:bg-slate-900/50 p-3 rounded-lg border group transition-all relative ${hoveredVar === v.name
                      ? "border-blue-500/50"
                      : "border-slate-200 dark:border-slate-700/50 hover:border-slate-300 dark:hover:border-slate-600"
                      } ${draggedVariableId === v.id ? "opacity-40" : ""} ${draggedVariableId !== null ? "[&>*]:pointer-events-none" : ""}`}
                    onMouseEnter={() => setHoveredVar(v.name)}
                    onMouseLeave={() => setHoveredVar(null)}
                  >
                    {/* Real-time drop insertion line boundary indicator */}
                    {dragOverVariableId === v.id &&
                      dragOverVariablePosition && (
                        <div
                          className={`absolute left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 z-50 rounded-full transition-all ${dragOverVariablePosition === "top"
                            ? "-top-[1px]"
                            : "-bottom-[1px]"
                            }`}
                        />
                      )}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1.5">
                        {/* Grip Handle */}
                        <div
                          onMouseDown={() =>
                            setCanDragVariableId(v.id)
                          }
                          onMouseUp={() =>
                            setCanDragVariableId(null)
                          }
                          onTouchStart={() =>
                            setCanDragVariableId(v.id)
                          }
                          onTouchEnd={() =>
                            setCanDragVariableId(null)
                          }
                          className="cursor-grab active:cursor-grabbing text-slate-450 dark:text-slate-605 hover:text-slate-650 dark:hover:text-slate-350 p-0.5 rounded opacity-0 max-sm:opacity-100 group-hover:opacity-100 transition-opacity flex-shrink-0"
                          title="Drag to reorder"
                        >
                          <GripVertical size={12} />
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-baseline gap-2">
                            <span
                              className="text-sm font-mono font-semibold"
                              style={{ color: getVarColor(v.name) }}
                            >
                              {v.name}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              =
                            </span>
                            <input
                              type="number"
                              value={v.value}
                              onChange={(e) =>
                                handleUpdateVar(v.id, {
                                  value:
                                    parseFloat(e.target.value) || 0,
                                })
                              }
                              className="w-16 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 text-xs font-mono px-1.5 py-0.5 rounded outline-none border border-slate-200 dark:border-transparent focus:border-blue-500"
                            />
                          </div>
                          {v.displayName && (
                            <span className="text-xs text-slate-400 mt-0.5">
                              {v.displayName}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="absolute right-2 top-2 nodrag shrink-0 z-20 flex items-center">
                        {/* Mobile toggle button */}
                        <button
                          className={`md:hidden p-1.5 opacity-60 hover:opacity-100 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-all flex items-center justify-center ${activeActionMenuId === v.id ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveActionMenuId(
                              activeActionMenuId === v.id ? null : v.id,
                            );
                          }}
                        >
                          <MoreVertical size={16} />
                        </button>

                        {/* Button group */}
                        <div
                          className={`items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-md p-0.5 ${activeActionMenuId === v.id ? "flex absolute right-8 top-0 z-[100]" : "hidden md:opacity-0 md:group-hover:opacity-100 md:flex"} transition-opacity`}
                        >
                          <button
                            className="p-1.5 md:p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-455 hover:text-blue-500 dark:hover:text-blue-400 rounded flex items-center justify-center transition-all opacity-100"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              handleAddVariableAt(v.id, "above");
                            }}
                            title="Insert Variable Above"
                          >
                            <InsertAboveIcon size={14} />
                          </button>
                          <button
                            className="p-1.5 md:p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-455 hover:text-blue-500 dark:hover:text-blue-400 rounded flex items-center justify-center transition-all opacity-100"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              handleAddVariableAt(v.id, "below");
                            }}
                            title="Insert Variable Below"
                          >
                            <InsertBelowIcon size={14} />
                          </button>
                          <button
                            className="p-1.5 md:p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded flex items-center justify-center transition-all opacity-100"
                            onClick={(e) => {
                              setActiveActionMenuId(null);
                              setPopupAnchorEl(e.currentTarget);
                              setRangePopupVarId(v.id);
                            }}
                            title="Slider Range"
                          >
                            <Sliders size={12} />
                          </button>
                          <button
                            className="p-1.5 md:p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded flex items-center justify-center transition-all opacity-100"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              handleUpdateVar(v.id, {
                                value: v.defaultValue,
                              });
                            }}
                            title="Reset"
                          >
                            <RotateCcw size={12} />
                          </button>
                          <button
                            className="p-1.5 md:p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded flex items-center justify-center transition-all opacity-100"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              setEditingVar(v);
                              setShowVarEditor(true);
                            }}
                            title="Edit"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            className="p-1.5 md:p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-200 rounded flex items-center justify-center transition-all opacity-100"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              setEditingVar({
                                ...v,
                                id: generateSafeId(),
                                name: v.name + "_copy",
                              });
                              setShowVarEditor(true);
                            }}
                            title="Duplicate"
                          >
                            <Copy size={12} />
                          </button>
                          <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700 mx-0.5 transition-opacity hidden md:block"></div>
                          <button
                            className="p-1.5 md:p-1 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded flex items-center justify-center transition-all opacity-100"
                            onClick={() => {
                              setActiveActionMenuId(null);
                              handleDeleteVar(v.id);
                            }}
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>

                    {v.description && (
                      <div className="text-[10px] text-slate-500 italic leading-tight">
                        {v.description}
                      </div>
                    )}

                    {v.showSlider !== false && (
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-slate-500 font-mono w-6 text-right select-none">
                          {v.min}
                        </span>
                        <input
                          type="range"
                          min={v.min}
                          max={v.max}
                          step={v.step}
                          value={v.value}
                          onChange={(e) =>
                            handleUpdateVar(v.id, {
                              value: parseFloat(e.target.value),
                            })
                          }
                          className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer hover:bg-slate-305 dark:hover:bg-slate-600 transition-colors flex-1"
                          style={{
                            accentColor: getVarColor(v.name),
                          }}
                        />
                        <span className="text-[10px] text-slate-500 font-mono w-6 text-left select-none">
                          {v.max}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
            </div>
          );
        })}
      </div>

      {rangePopupVarId && popupAnchorEl && (
        <RangePopup
          variable={variables.find(v => v.id === rangePopupVarId)!}
          anchorEl={popupAnchorEl}
          onClose={() => {
            setRangePopupVarId(null);
            setPopupAnchorEl(null);
          }}
          onUpdate={handleUpdateVar}
        />
      )}
    </div>
  );
};
