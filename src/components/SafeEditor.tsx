import React, { Component, ErrorInfo, ReactNode } from "react";
import MonacoEditor, { EditorProps } from "@monaco-editor/react";

class EditorErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode; resetTrigger?: any },
  { hasError: boolean; lastTrigger?: any }
> {
  state = { hasError: false, lastTrigger: this.props.resetTrigger };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  static getDerivedStateFromProps(nextProps: any, state: any) {
    if (nextProps.resetTrigger !== state.lastTrigger) {
      return { hasError: false, lastTrigger: nextProps.resetTrigger };
    }
    return null;
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.warn("Caught Monaco Editor error safely:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

function TextareaFallback(props: EditorProps) {
  const { value, onChange, theme, height } = props;
  const isDark =
    !theme ||
    theme.includes("dark") ||
    theme.includes("Dark") ||
    theme === "vs-dark";
  
  return (
    <textarea
      value={value}
      onChange={(e) => onChange?.(e.target.value, {} as any)}
      className="w-full h-full p-4 font-mono text-[13px] leading-relaxed border-0 outline-none resize-none"
      style={{
        height: height || "100%",
        backgroundColor: isDark ? "#0d1218" : "#ffffff",
        color: isDark ? "#c9d1d9" : "#24292f",
      }}
    />
  );
}

export function SafeEditor(props: EditorProps) {
  // Calculate a key that stays constant during typing but changes when changing file / context / language.
  // This ensures Monaco does not attempt to hot-swap models/themes across unrelated contexts,
  // which is what causes the "InstantiationService has been disposed" error.
  const activeKey = props.path 
    ? `path-${props.path}` 
    : `lang-${props.defaultLanguage || props.language || "default"}`;

  return (
    <EditorErrorBoundary 
      resetTrigger={activeKey} 
      fallback={<TextareaFallback {...props} />}
    >
      <MonacoEditor key={activeKey} {...props} />
    </EditorErrorBoundary>
  );
}

export default SafeEditor;
