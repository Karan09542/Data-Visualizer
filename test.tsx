export default function Test() { return <>              {!group.isCollapsed &&
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
                          className="cursor-grab active:cursor-grabbing text-slate-450 dark:text-slate-605 hover:text-slate-650 dark:hover:text-slate-350 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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
</>; }