import React from 'react';
import { createPortal } from 'react-dom';
import { Edit2, X } from 'lucide-react';
import { useStore } from '../store/useStore';
import CustomSelect from './CustomSelect';

export interface NodeEditingModalProps {
  editingNode: any;
  setEditingNode: (nodeInfo: any) => void;
  applyJsonChange: (path: string, action: string, value: string, newKey?: string, typeOverride?: string) => void;
}

export function NodeEditingModal({
  editingNode,
  setEditingNode,
  applyJsonChange,
}: NodeEditingModalProps) {
  const appTheme = useStore((s) => s.appTheme);

  if (!editingNode) return null;

  return createPortal(
    <div className={appTheme}>
      <div
        className="fixed inset-0 z-[1000] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
        onClick={() => setEditingNode(null)}
      >
        <div
          className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/50 rounded-2xl p-6 w-full max-w-md shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex justify-between items-center pb-2 border-b border-slate-200 dark:border-slate-800">
            <h3 className="text-slate-800 dark:text-slate-100 font-semibold text-base flex items-center gap-2">
              <div className={`p-1.5 rounded-lg ${editingNode.action === 'add' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-indigo-500/10 text-indigo-500'}`}>
                <Edit2 size={16} />
              </div>
              {editingNode.action === "add" ? "Add to Node" : "Edit Node Value"}
            </h3>
            <button
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              onClick={() => setEditingNode(null)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Node Path */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Node Path
            </label>
            <div
              className="text-xs font-mono text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-lg max-w-full overflow-x-auto custom-scrollbar border border-indigo-100 dark:border-indigo-500/20 truncate"
              title={editingNode.node.path}
            >
              {editingNode.node.path}
            </div>
          </div>

          <div className="flex gap-4">
            {(editingNode.action === "add" && editingNode.node.type === "object") ||
              (editingNode.action === "edit" && editingNode.node.path !== "root" && !editingNode.node.path.endsWith("]")) ? (
              <div className="flex flex-col gap-1.5 flex-1">
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  {editingNode.action === "add" ? "New Key" : "Key Name"}
                </label>
                <input
                  type="text"
                  value={editingNode.newKey || ""}
                  onChange={(e) => setEditingNode({ ...editingNode, newKey: e.target.value })}
                  className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 font-mono text-xs focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all"
                  placeholder={editingNode.action === "add" ? "e.g. keyName" : "Key name"}
                />
              </div>
            ) : null}

            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Data Type
              </label>
              <CustomSelect
                value={editingNode.typeOverride || "auto"}
                onChange={(val) => setEditingNode({ ...editingNode, typeOverride: val })}
                options={[
                  { value: "auto", label: "Auto Parse" },
                  { value: "string", label: "String" },
                  { value: "number", label: "Number" },
                  { value: "boolean", label: "Boolean" },
                  { value: "object", label: "Object { }" },
                  { value: "array", label: "Array []" },
                  { value: "null", label: "Null" },
                ]}
                className="w-full"
              />
            </div>
          </div>

          {!["object", "array", "null"].includes(editingNode.typeOverride || "auto") && (
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                Content
              </label>
              <textarea
                value={editingNode.value}
                onChange={(e) => setEditingNode({ ...editingNode, value: e.target.value })}
                className="bg-slate-50 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 font-mono text-xs h-36 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none resize-y shadow-inner custom-scrollbar transition-all leading-relaxed"
                placeholder={
                  editingNode.typeOverride === "boolean"
                    ? "true or false"
                    : editingNode.typeOverride === "number"
                      ? "123.45"
                      : "Enter value..."
                }
              />
              <span className="text-[10px] text-slate-400 font-medium">
                {editingNode.typeOverride === "auto" ? "Valid JSON parsed automatically." : `Forced type: ${editingNode.typeOverride}`}
              </span>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-all text-xs font-semibold"
              onClick={() => setEditingNode(null)}
            >
              Cancel
            </button>
            <button
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/25 text-xs font-semibold"
              onClick={() => {
                applyJsonChange(
                  editingNode.node.path,
                  editingNode.action,
                  editingNode.value,
                  editingNode.newKey,
                  editingNode.typeOverride,
                );
                setEditingNode(null);
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
