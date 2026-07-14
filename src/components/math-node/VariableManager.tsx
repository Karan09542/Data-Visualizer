import React, { useState } from "react";
import { Search, Plus, MoreVertical, RotateCcw, Edit2, Copy, Trash2 } from "lucide-react";
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
}

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
}) => {
  const [showSearch, setShowSearch] = useState(false);
  const [searchVar, setSearchVar] = useState("");

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

          if (groupVars.length === 0 && searchVar) return null;
          if (groupVars.length === 0 && group.id !== "default") return null;

          return (
            <div key={group.id} className="flex flex-col gap-2">
              {groups.length > 1 && groupVars.length > 0 && (
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: group.color }}
                  ></div>
                  {group.name}
                  <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800"></div>
                </div>
              )}

              {groupVars.map((v) => (
                <div
                  key={v.id}
                  className="flex flex-col gap-1 group relative"
                  onMouseEnter={() => setHoveredVar(v.name)}
                  onMouseLeave={() => setHoveredVar(null)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full shadow-sm"
                        style={{ backgroundColor: getVarColor(v.name) }}
                      ></div>
                      <span
                        className="font-medium text-sm text-slate-800 dark:text-slate-200"
                        title={v.description}
                      >
                        {v.displayName || v.name}
                      </span>
                      {v.displayName && (
                        <span className="text-[10px] text-slate-400 font-mono">
                          ({v.name})
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 relative">
                      <span
                        className={`text-xs font-mono transition-colors ${hoveredVar === v.name ? "text-blue-500 font-bold" : "text-slate-500"}`}
                      >
                        {v.value.toFixed(2)}
                      </span>

                      <button
                        className={`md:hidden p-1.5 opacity-60 hover:opacity-100 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-all flex items-center justify-center ${activeActionMenuId === v.id ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                        onClick={() => {
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
    </div>
  );
};
