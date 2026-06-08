import React, { Component, ErrorInfo, ReactNode } from "react";
import MonacoEditor, { EditorProps } from "@monaco-editor/react";
import { registerPyIntelliSense } from "../utils/pyIntelliSense";

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

function SafeEditor(props: EditorProps) {
  const componentId = React.useId().replace(/:/g, "-");
  const lang = props.language || props.defaultLanguage || "javascript";
  let ext = "js";
  if (lang === "typescript") ext = "ts";
  else if (lang === "python") ext = "py";
  else if (lang === "json") ext = "json";
  else if (lang === "markdown") ext = "md";
  else if (lang === "html") ext = "html";
  else if (lang === "css") ext = "css";

  let resolvedPath = props.path;
  if (resolvedPath) {
    if (resolvedPath.endsWith("_py_node")) {
      resolvedPath = resolvedPath.replace(/_py_node$/, ".py");
    } else if (resolvedPath.endsWith("_ts_node")) {
      resolvedPath = resolvedPath.replace(/_ts_node$/, ".ts");
    } else if (resolvedPath.endsWith("_js_node")) {
      resolvedPath = resolvedPath.replace(/_js_node$/, ".js");
    } else if (resolvedPath.endsWith("_api_node")) {
      resolvedPath = resolvedPath.replace(/_api_node$/, ".api");
    } else {
      const lowerPath = resolvedPath.toLowerCase();
      const hasExtension = lowerPath.endsWith(".js") || 
                            lowerPath.endsWith(".ts") || 
                            lowerPath.endsWith(".py") || 
                            lowerPath.endsWith(".json") || 
                            lowerPath.endsWith(".md") || 
                            lowerPath.endsWith(".html") || 
                            lowerPath.endsWith(".css") || 
                            lowerPath.endsWith(".api");
      if (!hasExtension) {
        let cleanPath = resolvedPath.replace(/\./g, "/");
        if (lang === "python") cleanPath += ".py";
        else if (lang === "typescript") cleanPath += ".ts";
        else if (lang === "javascript") cleanPath += ".js";
        else if (lang === "json") cleanPath += ".json";
        else if (lang === "markdown") cleanPath += ".md";
        else {
          cleanPath += `.${ext}`;
        }
        resolvedPath = `file:///${cleanPath}`;
      }
    }
  } else {
    resolvedPath = `inmemory://model-${componentId}.${ext}`;
  }

  const activeKey = props.path 
    ? `path-${resolvedPath}` 
    : `lang-${lang}-${componentId}`;

  const mergedOptions = React.useMemo(() => {
    return {
      fixedOverflowWidgets: true,
      ...(props.options || {}),
    };
  }, [props.options]);

  const handleOnMount = (editor: any, monaco: any) => {
    const model = editor.getModel();
    if (model && lang) {
      try {
        monaco.editor.setModelLanguage(model, lang);
      } catch (err) {
        console.warn("Error setting model language on mount", err);
      }
    }
    if (lang === "python") {
      try {
        registerPyIntelliSense(monaco);
      } catch (err) {
        console.warn("Error registering Python IntelliSense on mount", err);
      }
    }
    if (props.onMount) {
      props.onMount(editor, monaco);
    }
  };

  return (
    <EditorErrorBoundary 
      resetTrigger={activeKey} 
      fallback={<TextareaFallback {...props} />}
    >
      <MonacoEditor 
        key={activeKey}
        {...props} 
        path={resolvedPath} 
        options={mergedOptions} 
        onMount={handleOnMount}
      />
    </EditorErrorBoundary>
  );
}

export default SafeEditor;
