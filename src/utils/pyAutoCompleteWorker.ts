import { loadPyodide } from "pyodide";
import { getInstalledPackages } from "./pyDb";

let pyodide: any = null;
let isInitializing = false;
let isReady = false;

// Queue of tasks received during cold boot
const pendingRequests: any[] = [];

async function initPyodide() {
  if (isInitializing || pyodide) return;
  isInitializing = true;
  
  try {
    // console.log("[PyIntelliSense Worker]: Booting Pyodide engine...");
    pyodide = await loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.29.4/full/"
    });
    
    // console.log("[PyIntelliSense Worker]: Loading Jedi and dependencies...");
    await pyodide.loadPackage(["jedi"]);
    
    // Register Jedi scripts in Python context
    pyodide.runPython(`
import jedi
import json

def get_completions(code, line, column, path="main.py"):
    try:
        script = jedi.Script(code, path=path)
        # column should be 0-indexed in Jedi, line is 1-indexed
        completions = script.complete(line=line, column=column)
        res = []
        for c in completions:
            res.append({
                "name": c.name,
                "complete": c.complete,
                "type": c.type,
                "description": c.description,
                "docstring": c.docstring() or ""
            })
        return json.dumps(res)
    except Exception as e:
        return json.dumps({"error": str(e)})

def get_hover(code, line, column, path="main.py"):
    try:
        script = jedi.Script(code, path=path)
        helps = []
        try:
            helps = script.help(line=line, column=column)
        except Exception:
            pass
        if not helps:
            try:
                helps = script.infer(line=line, column=column)
            except Exception:
                pass
        if not helps:
            try:
                helps = script.goto(line=line, column=column)
            except Exception:
                pass
                
        res = []
        for h in helps:
            res.append({
                "name": h.name,
                "full_name": h.full_name,
                "type": h.type,
                "description": h.description,
                "docstring": h.docstring() or ""
            })
        return json.dumps(res)
    except Exception as e:
        return json.dumps({"error": str(e)})

def get_signatures(code, line, column, path="main.py"):
    try:
        script = jedi.Script(code, path=path)
        signatures = script.get_signatures(line=line, column=column)
        res = []
        for s in signatures:
            params = [p.name for p in s.params]
            res.append({
                "name": s.name,
                "docstring": s.docstring() or "",
                "params": params,
                "signature_string": s.to_string()
            })
        return json.dumps(res)
    except Exception as e:
        return json.dumps({"error": str(e)})

def get_definition(code, line, column, path="main.py"):
    try:
        script = jedi.Script(code, path=path)
        definitions = script.goto(line=line, column=column)
        res = []
        for d in definitions:
            res.append({
                "name": d.name,
                "module_path": d.module_path or "",
                "line": d.line or 1,
                "column": d.column or 0,
                "description": d.description,
                "is_builtin": d.in_builtin_module()
            })
        return json.dumps(res)
    except Exception as e:
        return json.dumps({"error": str(e)})

def get_references(code, line, column, path="main.py"):
    try:
        script = jedi.Script(code, path=path)
        references = script.get_references(line=line, column=column)
        res = []
        for r in references:
            res.append({
                "name": r.name,
                "module_path": r.module_path or "",
                "line": r.line or 1,
                "column": r.column or 0,
                "description": r.description
            })
        return json.dumps(res)
    except Exception as e:
        return json.dumps({"error": str(e)})

def get_diagnostics(code, path="main.py"):
    try:
        import ast
        script = jedi.Script(code, path=path)
        errors = script.get_syntax_errors()
        res = []
        for err in errors:
            res.append({
                "line": err.line,
                "column": err.column,
                "message": err.message,
                "type": "error"
            })
            
        # Detect top-level side effects
        try:
            tree = ast.parse(code)
            for node in tree.body:
                # Safe top-level statements
                if isinstance(node, (ast.Import, ast.ImportFrom, ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Assign, ast.AnnAssign, ast.Pass)):
                    continue
                # Docstrings
                if isinstance(node, ast.Expr) and isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
                    continue
                # if __name__ == '__main__' patterns
                if isinstance(node, ast.If):
                    continue
                    
                # Other things are likely side effects (Expr, Print, calls, etc.)
                res.append({
                    "line": getattr(node, 'lineno', 1),
                    "column": getattr(node, 'col_offset', 0),
                    "message": 'Warning: This module contains top-level executable code. Importing it will execute the module. Consider moving it inside a function or if __name__ == "__main__": block.',
                    "type": "warning" # Changed to highlight in editor
                })
        except Exception:
            pass

        return json.dumps(res)
    except Exception as e:
        return json.dumps([])
    `);

    // Synchronize workspace packages
    try {
      // console.log("[PyIntelliSense Worker]: Synchronizing installed libraries...");
      const installedPkgs = await getInstalledPackages();
      const readyPkgs = installedPkgs.filter(p => p.status === "installed");
      if (readyPkgs.length > 0) {
        for (const pkg of readyPkgs) {
          try {
            // console.log(`[PyIntelliSense Worker]: Mapping package completions for "${pkg.name}"...`);
            await pyodide.loadPackage(pkg.name);
          } catch (pkgErr) {
            console.warn(`[PyIntelliSense Worker]: Optional preload of package ${pkg.name} failed:`, pkgErr);
          }
        }
      }
    } catch (gErr) {
      console.warn("[PyIntelliSense Worker]: Could not read local Dexie packages:", gErr);
    }

    // console.log("[PyIntelliSense Worker]: Python IntelliSense is now ONLINE!");
    isReady = true;
    isInitializing = false;
    
    // Self flush pending signals queue
    while (pendingRequests.length > 0) {
      const p = pendingRequests.shift();
      if (p) processRequest(p);
    }
  } catch (err) {
    console.error("[PyIntelliSense Worker]: Bootstrap failure:", err);
    isInitializing = false;
  }
}

// Kickstart pyodide loading early
initPyodide();

async function processRequest(e: MessageEvent) {
  const { type, code, line, column, path, id, packages } = e.data;
  const targetPath = path || "main.py";

  if (type === "sync_packages" && packages) {
    try {
      for (const p of packages) {
        // console.log(`[PyIntelliSense Worker]: Dynamically aligning package completions for "${p}"...`);
        await pyodide.loadPackage(p);
      }
    } catch (err) {
      console.warn("[PyIntelliSense Worker]: Dynamic load package error:", err);
    }
    self.postMessage({ id, type, success: true });
    return;
  }

  if (!pyodide) {
    self.postMessage({ id, type, error: "Pyodide was not bootstrapped successfully" });
    return;
  }

  try {
    if (type === "complete") {
      // Jedi expects 0-indexed column, 1-indexed line
      // Monaco uses 1-indexed column, 1-indexed line
      const col = Math.max(0, column - 1);
      
      // Store variables in Python context safely
      const pyVars = pyodide.globals;
      pyVars.set("_code", code);
      pyVars.set("_line", line);
      pyVars.set("_column", col);
      pyVars.set("_path", targetPath);

      const jsonResult = pyodide.runPython("get_completions(_code, _line, _column, _path)");
      const data = JSON.parse(jsonResult);
      self.postMessage({ id, type, data });
    } 
    else if (type === "hover") {
      const col = Math.max(0, column - 1);
      const pyVars = pyodide.globals;
      pyVars.set("_code", code);
      pyVars.set("_line", line);
      pyVars.set("_column", col);
      pyVars.set("_path", targetPath);

      const jsonResult = pyodide.runPython("get_hover(_code, _line, _column, _path)");
      const data = JSON.parse(jsonResult);
      self.postMessage({ id, type, data });
    }
    else if (type === "signature") {
      const col = Math.max(0, column - 1);
      const pyVars = pyodide.globals;
      pyVars.set("_code", code);
      pyVars.set("_line", line);
      pyVars.set("_column", col);
      pyVars.set("_path", targetPath);

      const jsonResult = pyodide.runPython("get_signatures(_code, _line, _column, _path)");
      const data = JSON.parse(jsonResult);
      self.postMessage({ id, type, data });
    }
    else if (type === "definition") {
      const col = Math.max(0, column - 1);
      const pyVars = pyodide.globals;
      pyVars.set("_code", code);
      pyVars.set("_line", line);
      pyVars.set("_column", col);
      pyVars.set("_path", targetPath);

      const jsonResult = pyodide.runPython("get_definition(_code, _line, _column, _path)");
      const data = JSON.parse(jsonResult);
      self.postMessage({ id, type, data });
    }
    else if (type === "references") {
      const col = Math.max(0, column - 1);
      const pyVars = pyodide.globals;
      pyVars.set("_code", code);
      pyVars.set("_line", line);
      pyVars.set("_column", col);
      pyVars.set("_path", targetPath);

      const jsonResult = pyodide.runPython("get_references(_code, _line, _column, _path)");
      const data = JSON.parse(jsonResult);
      self.postMessage({ id, type, data });
    }
    else if (type === "diagnostics") {
      const pyVars = pyodide.globals;
      pyVars.set("_code", code);
      pyVars.set("_path", targetPath);

      const jsonResult = pyodide.runPython("get_diagnostics(_code, _path)");
      const data = JSON.parse(jsonResult);
      self.postMessage({ id, type, data });
    }
  } catch (err: any) {
    self.postMessage({ id, type, error: err.message || "Interpreting error" });
  }
}

self.onmessage = (e: MessageEvent) => {
  if (!isReady) {
    pendingRequests.push(e);
    // Guarantee start initialization is activated
    initPyodide();
  } else {
    processRequest(e);
  }
};
