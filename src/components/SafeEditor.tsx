import React, { Component, ErrorInfo, ReactNode } from "react";
import MonacoEditor, { EditorProps } from "@monaco-editor/react";
import {
  registerPyIntelliSense,
  runDiagnostics,
} from "../utils/pyIntelliSense";

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
    if (
      resolvedPath.startsWith("file:///") ||
      resolvedPath.startsWith("inmemory://")
    ) {
      // Keep it as is
    } else {
      const parts = resolvedPath
        .replace(/^root\.?/, "")
        .split(/\.|(?=\[)/)
        .filter(Boolean);

      const cleanParts = parts.map((part) => {
        let p = part;
        if (p.startsWith("[")) p = p.slice(1, -1);
        if (p.endsWith("_py_node")) return p.replace(/_py_node$/, ".py");
        if (p.endsWith("_ts_node")) return p.replace(/_ts_node$/, ".ts");
        if (p.endsWith("_js_node")) return p.replace(/_js_node$/, ".js");
        if (p.endsWith("_api_node")) return p.replace(/_api_node$/, ".api");
        if (p.endsWith("_json_node")) return p.replace(/_json_node$/, ".json");
        if (p.endsWith("_json")) return p.replace(/_json$/, ".json");
        if (p.endsWith("_yaml")) return p.replace(/_yaml$/, ".yaml");
        if (p.endsWith("_yml")) return p.replace(/_yml$/, ".yml");
        if (p.endsWith("_csv")) return p.replace(/_csv$/, ".csv");
        if (p.endsWith("_xml")) return p.replace(/_xml$/, ".xml");
        if (p.endsWith("_md")) return p.replace(/_md$/, ".md");
        if (p.endsWith("_txt")) return p.replace(/_txt$/, ".txt");
        return p;
      });

      let cleanPath = cleanParts.join("/");

      const lowerPath = cleanPath.toLowerCase();
      const hasExtension =
        lowerPath.endsWith(".js") ||
        lowerPath.endsWith(".ts") ||
        lowerPath.endsWith(".py") ||
        lowerPath.endsWith(".json") ||
        lowerPath.endsWith(".md") ||
        lowerPath.endsWith(".html") ||
        lowerPath.endsWith(".css") ||
        lowerPath.endsWith(".api");

      if (!hasExtension) {
        if (lang === "python") cleanPath += ".py";
        else if (lang === "typescript") cleanPath += ".ts";
        else if (lang === "javascript") cleanPath += ".js";
        else if (lang === "json") cleanPath += ".json";
        else if (lang === "markdown") cleanPath += ".md";
        else cleanPath += `.${ext}`;
      }
      resolvedPath = `file:///${cleanPath}`;
    }
  } else {
    resolvedPath = `inmemory://model-${componentId}.${ext}`;
  }

  const activeKey = props.path
    ? `path-${resolvedPath}`
    : `lang-${lang}-${componentId}`;

  const mergedOptions = React.useMemo(() => {
    const isMobile = typeof window !== 'undefined' && (window.innerWidth < 768 || 'ontouchstart' in window);
    const options: any = {
      fixedOverflowWidgets: true,
      automaticLayout: true,
      scrollBeyondLastLine: false,
      wordWrap: "on",
      ...(isMobile ? {
        selectionClipboard: false,
        domReadOnly: false,
        mouseWheelZoom: false,
        links: true,
        contextmenu: true,
        selectOnLineNumbers: true,
      } : {}),
      ...(props.options || {}),
    };
    return options;
  }, [props.options]);

  const handleOnMount = (editor: any, monaco: any) => {
    const model = editor.getModel();
    if (model && lang && model.getLanguageId?.() !== lang) {
      try {
        monaco.editor.setModelLanguage(model, lang);
      } catch (err) {
        console.warn("Error setting Monaco model language", err);
      }
    }
    if (lang === "python") {
      try {
        registerPyIntelliSense(monaco);
        if (model) {
          runDiagnostics(model, monaco);
        }
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
