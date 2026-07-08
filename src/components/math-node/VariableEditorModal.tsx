import React, { useState } from "react";
import { FolderPlus, X } from "lucide-react";
import { MathVariable, VariableGroup, generateSafeId } from "./mathTypes";

interface VariableEditorModalProps {
  variable: MathVariable | null;
  groups: VariableGroup[];
  existingVariables: MathVariable[];
  onSave: (variable: MathVariable, newGroup?: VariableGroup) => void;
  onClose: () => void;
}

export const VariableEditorModal: React.FC<VariableEditorModalProps> = ({
  variable,
  groups,
  existingVariables,
  onSave,
  onClose,
}) => {
  const isNew = !variable || variable.name.endsWith("_copy");
  const [formData, setFormData] = useState<MathVariable>(() => {
    if (variable) {
      return { showSlider: variable.showSlider !== false, ...variable };
    }
    return {
      id: generateSafeId(),
      name: "",
      displayName: "",
      description: "",
      value: 1,
      defaultValue: 1,
      min: -10,
      max: 10,
      step: 0.1,
      groupId: groups[0]?.id || "default",
      showSlider: true,
    };
  });

  const [groupMode, setGroupMode] = useState<"select" | "new">("select");
  const [newGroupName, setNewGroupName] = useState("");
  const [error, setError] = useState("");

  const handleSave = () => {
    setError("");
    const trimmedSymbol = formData.name.trim();
    if (!trimmedSymbol) return setError("Symbol is required.");
    if (!/^[a-zA-Z_]\w*$/.test(trimmedSymbol))
      return setError(
        "Invalid symbol format (must start with letter/underscore, e.g. k, a_1).",
      );
    if (
      existingVariables.some(
        (v: any) => v.name === trimmedSymbol && v.id !== formData.id,
      )
    )
      return setError(`Symbol '${trimmedSymbol}' already exists.`);

    // Validate bounds only if slider is enabled
    const isSliderEnabled = formData.showSlider !== false;
    const minVal = isNaN(formData.min) ? -10 : formData.min;
    const maxVal = isNaN(formData.max) ? 10 : formData.max;
    if (isSliderEnabled && minVal >= maxVal)
      return setError("Min must be less than Max.");

    const finalVar = {
      ...formData,
      name: trimmedSymbol,
      min: minVal,
      max: maxVal,
      step: isNaN(formData.step) || formData.step <= 0 ? 0.1 : formData.step,
      defaultValue: isNaN(formData.defaultValue) ? 1 : formData.defaultValue,
      value: isNaN(formData.value)
        ? isNaN(formData.defaultValue)
          ? 1
          : formData.defaultValue
        : formData.value,
      showSlider: isSliderEnabled,
    };

    if (groupMode === "new") {
      const trimmedGroup = newGroupName.trim();
      if (!trimmedGroup) {
        return setError("Please enter a custom group name.");
      }
      const existingGroup = groups.find(
        (g: any) => g.name.toLowerCase() === trimmedGroup.toLowerCase(),
      );
      if (existingGroup) {
        onSave({ ...finalVar, groupId: existingGroup.id });
      } else {
        const newGroupId = `group_${generateSafeId()}`;
        const newGroup = {
          id: newGroupId,
          name: trimmedGroup,
          isCollapsed: false,
        };
        onSave({ ...finalVar, groupId: newGroupId }, newGroup);
      }
    } else {
      onSave(finalVar);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-900/60 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl w-full max-w-sm flex flex-col nodrag cursor-default text-slate-800 dark:text-slate-100 overflow-hidden transform transition-all">
        {/* Modal Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 rounded-lg">
              <FolderPlus size={16} />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-50 text-sm leading-none">
                {isNew ? "Add Variable" : "Edit Variable"}
              </h3>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                Define properties for your variable
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-350 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 flex flex-col gap-4 overflow-y-auto max-h-[60vh] custom-scrollbar">
          {error && (
            <div className="text-red-600 dark:text-red-400 text-xs font-semibold bg-red-500/10 dark:bg-red-950/20 p-2.5 rounded-lg border border-red-200 dark:border-red-900/30">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">
                Symbol *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition-all"
                placeholder="e.g. a"
                disabled={!isNew}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">
                Display Name
              </label>
              <input
                type="text"
                value={formData.displayName}
                onChange={(e) =>
                  setFormData({ ...formData, displayName: e.target.value })
                }
                className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none transition-all"
                placeholder="e.g. Amplitude"
              />
            </div>
          </div>

          {/* Range Slider Toggle */}
          <div className="flex items-center justify-between p-2.5 bg-slate-50/50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex-shrink-0">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                Show Range Slider
              </span>
              <span className="text-[9px] text-slate-400 dark:text-slate-500">
                Provide an interactive slider for quick tuning
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  showSlider: !prev.showSlider,
                }))
              }
              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                formData.showSlider !== false
                  ? "bg-blue-600 dark:bg-blue-500"
                  : "bg-slate-200 dark:bg-slate-800"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  formData.showSlider !== false
                    ? "translate-x-4"
                    : "translate-x-0"
                }`}
              />
            </button>
          </div>

          <div
            className={`grid grid-cols-3 gap-2 flex-shrink-0 transition-opacity duration-200 ${
              formData.showSlider !== false
                ? "opacity-100"
                : "opacity-45 pointer-events-none"
            }`}
          >
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">
                Min
              </label>
              <input
                type="number"
                value={isNaN(formData.min) ? "" : formData.min}
                onChange={(e) =>
                  setFormData({ ...formData, min: parseFloat(e.target.value) })
                }
                className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none"
                disabled={formData.showSlider === false}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">
                Max
              </label>
              <input
                type="number"
                value={isNaN(formData.max) ? "" : formData.max}
                onChange={(e) =>
                  setFormData({ ...formData, max: parseFloat(e.target.value) })
                }
                className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none"
                disabled={formData.showSlider === false}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">
                Step
              </label>
              <input
                type="number"
                value={isNaN(formData.step) ? "" : formData.step}
                onChange={(e) =>
                  setFormData({ ...formData, step: parseFloat(e.target.value) })
                }
                className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none"
                disabled={formData.showSlider === false}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-shrink-0">
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">
                Default Value
              </label>
              <input
                type="number"
                value={
                  isNaN(formData.defaultValue) ? "" : formData.defaultValue
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    defaultValue: parseFloat(e.target.value),
                  })
                }
                className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-slate-100 font-mono focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">
                Group
              </label>
              <div className="flex bg-slate-100 dark:bg-slate-950 rounded-lg p-0.5 border border-slate-200 dark:border-slate-800 text-[11px] h-[38px] items-center">
                <button
                  type="button"
                  onClick={() => setGroupMode("select")}
                  className={`flex-1 text-center py-1 rounded-md transition-all font-medium ${
                    groupMode === "select"
                      ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-50 border border-slate-200/55 dark:border-slate-700/60"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-900/40"
                  }`}
                >
                  Select
                </button>
                <button
                  type="button"
                  onClick={() => setGroupMode("new")}
                  className={`flex-1 text-center py-1 rounded-md transition-all font-medium ${
                    groupMode === "new"
                      ? "bg-white dark:bg-slate-800 shadow-sm text-slate-900 dark:text-slate-50 border border-slate-200/55 dark:border-slate-700/60"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 hover:bg-white/40 dark:hover:bg-slate-900/40"
                  }`}
                >
                  + New
                </button>
              </div>
            </div>
          </div>

          {/* Conditional Group Area */}
          <div className="flex flex-col gap-1.5 p-2.5 bg-slate-50/50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800">
            {groupMode === "select" ? (
              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 block uppercase tracking-wider">
                  Select Group Name
                </label>
                <select
                  value={formData.groupId}
                  onChange={(e) =>
                    setFormData({ ...formData, groupId: e.target.value })
                  }
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                >
                  {groups.map((g: any) => (
                    <option
                      key={g.id}
                      value={g.id}
                      className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200"
                    >
                      {g.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mb-1 block uppercase tracking-wider">
                  Custom Group Name
                </label>
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-xs text-slate-900 dark:text-slate-100 outline-none focus:border-blue-500"
                  placeholder="e.g. Physics Constants"
                />
              </div>
            )}
          </div>

          <div className="flex-shrink-0">
            <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mb-1 block uppercase tracking-wider">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full bg-slate-50/50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-sm text-slate-900 dark:text-slate-100 resize-none h-14 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 outline-none"
              placeholder="What does this variable do?"
            />
          </div>
        </div>
        <div className="p-3 border-t border-slate-150 dark:border-slate-800 flex justify-end gap-2 bg-slate-50 dark:bg-slate-900/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg font-medium text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium text-xs transition-colors shadow"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
