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
  const componentId = React.useId().replace(/:/g, "-");
  const lang = props.language || props.defaultLanguage || "javascript";
  let ext = "js";
  if (lang === "typescript") ext = "ts";
  else if (lang === "python") ext = "py";
  else if (lang === "json") ext = "json";
  else if (lang === "markdown") ext = "md";
  else if (lang === "html") ext = "html";
  else if (lang === "css") ext = "css";

  const resolvedPath = props.path || `inmemory://model-${componentId}.${ext}`;

  const activeKey = props.path 
    ? `path-${props.path}` 
    : `lang-${lang}-${componentId}`;

  const mergedOptions = React.useMemo(() => {
    return {
      fixedOverflowWidgets: true,
      ...(props.options || {}),
    };
  }, [props.options]);

  return (
    <EditorErrorBoundary 
      resetTrigger={activeKey} 
      fallback={<TextareaFallback {...props} />}
    >
      <MonacoEditor 
        {...props} 
        path={resolvedPath} 
        options={mergedOptions} 
      />
    </EditorErrorBoundary>
  );
}

export default SafeEditor;
