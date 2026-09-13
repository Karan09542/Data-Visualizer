/**
 * The second editor group a split opens, beside or below the main one.
 *
 * It has tabs of its own and edits files the way the main group does: typing keeps a draft,
 * Ctrl+S saves it, Ctrl+Enter runs it. A file open in both groups is one file - both editors share
 * its model, so typing in one shows in the other at once. While this group is the one being worked
 * in, files opened from the explorer land here, and the Run button, the console and the coding
 * keys (one set, the workspace's) follow its tab.
 */
import React, { useMemo } from "react";
import { ChevronRight, Columns2, ExternalLink, Rows2, X } from "lucide-react";
import SafeEditor from "../SafeEditor";
import MediaFileViewer from "../MediaFileViewer";
import { TodoWorkspace } from "../TodoWorkspace";
import { SearchNodeWorkspace } from "../SearchNodeWorkspace";
import { useStore, type EditorGroupId, type EditorSplit } from "../../store/useStore";
import { mediaFileName } from "../../utils/mediaFiles";
import { executableKindFor } from "../../utils/editorLanguage";
import { registerWorkspaceIntelliSense } from "../../utils/workspaceIntelliSense";
import { EditorTabStrip } from "./EditorTabStrip";
import { useEditorFile } from "./useEditorFile";
import type { TabMenuEntry } from "./useTabContextMenu";

interface SplitEditorGroupProps {
  split: EditorSplit;
  focused: boolean;
  onFocus: () => void;
  getIcon: (path: string, isActive: boolean) => React.ReactNode;
  getName: (path: string) => string;
  menuFor: (path: string) => TabMenuEntry[];
  onMoveIn: (path: string, fromGroup: EditorGroupId, index: number) => void;
  editorOptions: any;
  editorTheme: string;
  /** How the groups are laid out on screen right now (a narrow screen may stack a right split). */
  shownDirection: "right" | "down";
  /** This group's Monaco editor, so the workspace's toolbar can act on it. */
  onEditorMount?: (editor: any) => void;
  /** Runs a file: Ctrl+Enter here. */
  onRun?: (path: string, code: string) => void;
  style?: React.CSSProperties;
}

const iconButton =
  "p-1 rounded-[4px] text-[var(--vsc-fg-muted)] hover:text-[var(--vsc-fg)] hover:bg-[var(--vsc-hover)] transition-colors cursor-pointer";

export function SplitEditorGroup({
  split,
  focused,
  onFocus,
  getIcon,
  getName,
  menuFor,
  onMoveIn,
  editorOptions,
  editorTheme,
  shownDirection,
  onEditorMount,
  onRun,
  style,
}: SplitEditorGroupProps) {
  const setJsNodeCodeOverride = useStore((s) => s.setJsNodeCodeOverride);
  const markWorkspaceTabDirty = useStore((s) => s.markWorkspaceTabDirty);
  const activateGroupTab = useStore((s) => s.activateGroupTab);
  const closeGroupTabs = useStore((s) => s.closeGroupTabs);
  const setGroupTabs = useStore((s) => s.setGroupTabs);
  const keepGroupTabOpen = useStore((s) => s.keepGroupTabOpen);
  const setEditorSplitLayout = useStore((s) => s.setEditorSplitLayout);
  const closeEditorSplit = useStore((s) => s.closeEditorSplit);
  const splitEditorTab = useStore((s) => s.splitEditorTab);
  const setMediaViewOnly = useStore((s) => s.setMediaViewOnly);

  const path = split.active;
  const file = useEditorFile(path);
  const key = path ? path.split(".").pop() || path : "";

  const crumbs = useMemo(() => {
    if (!path) return [];
    const parts = path.replace(/^root\.?/, "").split(".").filter(Boolean);
    return ["root", ...parts.slice(0, -1), getName(path)];
  }, [path, getName]);

  const openInMain = (p: string) => splitEditorTab(p, { from: "side" });

  let body: React.ReactNode;
  if (!path) {
    body = <div className="flex-1" />;
  } else if (file.isTodo) {
    body = <TodoWorkspace key={path} path={path} />;
  } else if (file.isSearch) {
    body = <SearchNodeWorkspace key={path} path={path} />;
  } else if (file.media) {
    body = (
      <MediaFileViewer
        key={path}
        name={mediaFileName(key, file.media)}
        media={file.media}
        onOpenEditor={
          file.media.kind === "image"
            ? () => {
              setMediaViewOnly(path, false);
              openInMain(path);
            }
            : undefined
        }
      />
    );
  } else if (file.isImg) {
    // The image editor needs the whole workspace; it opens in the main group.
    body = (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-[12px] text-[var(--vsc-fg-muted)]">
        <span>The image editor opens in the main group.</span>
        <button type="button" className={`${iconButton} flex items-center gap-1.5 px-2.5 py-1.5 border border-[var(--vsc-border-strong)]`} onClick={() => openInMain(path)}>
          <ExternalLink size={13} /> Open there
        </button>
      </div>
    );
  } else {
    body = (
      <SafeEditor
        path={path}
        height="100%"
        defaultLanguage={file.language}
        language={file.language}
        theme={editorTheme}
        value={file.text}
        options={editorOptions}
        onChange={(value) => {
          if (value === undefined) return;
          setJsNodeCodeOverride(path, value);
          const tab = split.tabs.find((t) => t.path === path);
          if (tab && !tab.isDirty) markWorkspaceTabDirty(path, true);
        }}
        onMount={(ed, m) => {
          onEditorMount?.(ed);
          registerWorkspaceIntelliSense(m, ed);
          ed.onDidFocusEditorText?.(onFocus);
          // Commands read the group's file when pressed, not when the editor mounted.
          const current = () => useStore.getState().editorSplit?.active ?? null;
          ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.KeyS, () => {
            const target = current();
            if (!target) return;
            const state = useStore.getState();
            state.updateNodeValue(target, ed.getValue(), { fromEditor: true });
            state.markWorkspaceTabDirty(target, false);
          });
          ed.addCommand(m.KeyMod.CtrlCmd | m.KeyCode.Enter, () => {
            const target = current();
            if (target && executableKindFor(target)) onRun?.(target, ed.getValue());
          });
        }}
      />
    );
  }

  const nextDirection = split.direction === "right" ? "down" : "right";

  return (
    <div
      data-editor-group="side"
      className="relative flex flex-col min-w-0 min-h-0 overflow-hidden bg-[var(--vsc-editor)]"
      style={style}
      onPointerDownCapture={onFocus}
      onFocusCapture={onFocus}
    >
      <EditorTabStrip
        group="side"
        tabs={split.tabs}
        activePath={path}
        focused={focused}
        getIcon={getIcon}
        getName={getName}
        onActivate={(tab) => activateGroupTab("side", tab.path)}
        onClose={(p) => closeGroupTabs("side", [p])}
        onReorder={(tabs) => setGroupTabs("side", tabs)}
        onKeepOpen={(p) => keepGroupTabOpen("side", p)}
        onMoveIn={onMoveIn}
        menuFor={menuFor}
        actions={
          <>
            <button
              type="button"
              className={iconButton}
              title={nextDirection === "down" ? "Put this group below" : "Put this group on the right"}
              aria-label={nextDirection === "down" ? "Put this group below" : "Put this group on the right"}
              onClick={() => setEditorSplitLayout({ direction: nextDirection })}
            >
              {shownDirection === "right" ? <Rows2 size={14} /> : <Columns2 size={14} />}
            </button>
            <button type="button" className={iconButton} title="Close group" aria-label="Close group" onClick={closeEditorSplit}>
              <X size={14} />
            </button>
          </>
        }
      />

      {path && (
        <div className="flex items-center h-[22px] px-3 shrink-0 bg-[var(--vsc-editor)] text-[11px] text-[var(--vsc-fg-muted)] overflow-x-auto scrollbar-none whitespace-nowrap">
          {crumbs.map((crumb, i) => (
            <span key={`${crumb}-${i}`} className="flex items-center gap-1 shrink-0">
              {i > 0 && <ChevronRight size={11} className="opacity-60 mx-0.5" />}
              <span className={`flex items-center gap-1 ${i === crumbs.length - 1 ? "text-[var(--vsc-fg)]" : ""}`}>
                {i === crumbs.length - 1 && getIcon(path, true)}
                {crumb}
              </span>
            </span>
          ))}
        </div>
      )}

      <div className="flex-1 relative flex flex-col min-h-0">{body}</div>
    </div>
  );
}
