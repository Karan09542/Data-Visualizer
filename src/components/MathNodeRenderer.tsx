import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { FormulaLibrary } from "./math-node/FormulaLibrary";
import { createPortal } from "react-dom";
import {
  Maximize2,
  Minimize2,
  Play,
  Pause,
  SkipBack,
  Layers,
  Plus,
  Trash2,
  Settings,
  Crosshair,
  HelpCircle,
  X,
  Search,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit2,
  Copy,
  CopyPlus,
  RotateCcw,
  GripVertical,
  Folder,
  Menu,
  MoreVertical,
  Bookmark,
  Save,
  Check,
  Eye,
  Heart,
  Sparkles,
  Type,
  List,
  Calculator,
  FunctionSquare,
} from "lucide-react";

import {
  Mafs,
  Plot,
  Transform,
  Point,
  Vector,
  Polygon,
  MovablePoint,
  Text,
  Line,
  usePaneContext,
} from "mafs";
import "mafs/core.css";
import "mafs/font.css";
import "katex/dist/katex.min.css";
import katex from "katex";
import * as mathjs from "mathjs";
import { useStore } from "../store/useStore";
import { useMathWorker } from "../hooks/useMathWorker";
import { liveQuery } from "dexie";
import { db } from "../lib/db";
import MathHelpPopup from "./MathHelpPopup";

import {
  MathFunction,
  MathVariable,
  VariableGroup,
  COLORS,
  getVarColor,
  getHexWithAlpha,
  getStrokeDasharray,
  formatMathError,
  generateSafeId,
  computePCA,
  decoupleGeometry,
  parseAndAdjustForCompile,
  indexHelper,
  normalizeGeometryValue,
  resolveGeometryPoints,
  InsertAboveIcon,
  InsertBelowIcon,
  ReadableColorBadge,
  PortalColorPicker,
  VariableEditorModal,
  EquationInput,
  LabelInput,
  SafeLabel,
  CurvePatternDefs,
  InequalityPlot,
  AdaptiveGrid,
  createAxisLabelFormatter,
  MATH_EXAMPLES,
  TraceOverlay
} from "./math-node";


export const MathNodeRenderer: React.FC<MathNodeRendererProps> = ({
  nodeId,
  data,
  isExpanded,
  width,
  height,
}) => {
  const { compileFunctions, expressionToLatexWithEval, batchEvaluate, evaluateCompiled } = useMathWorker();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPanelVisible, setIsPanelVisible] = useState(true);
  const [isShiftPressed, setIsShiftPressed] = useState(false);

  const [activeGizmo, setActiveGizmo] = useState<{
    id: string;
    type: "drag" | "rotate" | "scale" | "pivot" | "label";
  } | null>(null);
  const gizmoTimeout = useRef<any>(null);

  const handleGizmoMove = (
    id: string,
    type: "drag" | "rotate" | "scale" | "pivot" | "label",
  ) => {
    setActiveGizmo({ id, type });
    if (gizmoTimeout.current) clearTimeout(gizmoTimeout.current);
    gizmoTimeout.current = setTimeout(() => {
      setActiveGizmo(null);
    }, 500);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftPressed(true);

      // Keyboard shortcuts for Math Graph Help Center
      if (
        e.key === "F1" ||
        (e.altKey && (e.key === "h" || e.key === "H")) ||
        (e.ctrlKey && e.key === "/")
      ) {
        e.preventDefault();
        setShowHelp(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Shift") setIsShiftPressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const [viewResetKey, setViewResetKey] = useState(0);
  const [showGridControls, setShowGridControls] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(
    null,
  );
  const [activeVisualEditorId, setActiveVisualEditorId] = useState<
    string | null
  >(null);
  const [activeExample, setActiveExample] = useState<string | null>(null);
  const [activeColorPickerFnId, setActiveColorPickerFnId] = useState<
    string | null
  >(null);
  const [activeColorPickerType, setActiveColorPickerType] = useState<
    "outline" | "fill" | null
  >(null);
  const [activeColorPickerTriggerEl, setActiveColorPickerTriggerEl] =
    useState<HTMLElement | null>(null);
  const [expandedSettingsFnId, setExpandedSettingsFnId] = useState<
    string | null
  >(null);

  const [savingFormulaFnId, setSavingFormulaFnId] = useState<string | null>(
    null,
  );
  const [formulaName, setFormulaName] = useState("");
  const [formulaDesc, setFormulaDesc] = useState("");
  const [previewCopied, setPreviewCopied] = useState(false);
  const [showPreviewLatex, setShowPreviewLatex] = useState(true);

  const [copiedAction, setCopiedAction] = useState<{
    id: string;
    type: string;
  } | null>(null);
  const [copiedVarId, setCopiedVarId] = useState<string | null>(null);


  const geomCacheRef = useRef<Record<string, [number, number][]>>({});
  const latestContextRef = useRef<any>(null);
  const MathNodesLayerRef = useRef<any>(null);
  const [functions, setFunctions] = useState<MathFunction[]>(() => {
    if (typeof data.value === "string") {
      try {
        const parsed = JSON.parse(data.value);
        if (parsed && Array.isArray(parsed.functions)) return parsed.functions;
      } catch (e) { }
    } else if (
      data.value &&
      typeof data.value === "object" &&
      Array.isArray(data.value.functions)
    ) {
      return data.value.functions;
    }
    return [
      {
        id: "f1",
        expr: "sin(x + t)",
        color: COLORS[0],
        visible: true,
        type: "function",
      },
      {
        id: "f2",
        expr: "a * x^2 + b * x + c",
        color: COLORS[1],
        visible: true,
        type: "function",
      },
    ];
  });

  const [variables, setVariables] = useState<MathVariable[]>(() => {
    if (typeof data.value === "string") {
      try {
        const parsed = JSON.parse(data.value);
        if (parsed && Array.isArray(parsed.variables)) return parsed.variables;
      } catch (e) { }
    } else if (
      data.value &&
      typeof data.value === "object" &&
      Array.isArray(data.value.variables)
    ) {
      return data.value.variables;
    }
    return [
      {
        id: "v1",
        name: "a",
        displayName: "Amplitude",
        description: "Controls wave height",
        value: 1,
        defaultValue: 1,
        min: -5,
        max: 5,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v2",
        name: "b",
        displayName: "Frequency",
        description: "",
        value: 0,
        defaultValue: 0,
        min: -5,
        max: 5,
        step: 0.1,
        groupId: "default",
      },
      {
        id: "v3",
        name: "c",
        displayName: "Phase Offset",
        description: "",
        value: 0,
        defaultValue: 0,
        min: -5,
        max: 5,
        step: 0.1,
        groupId: "default",
      },
    ];
  });

  const [groups, setGroups] = useState<VariableGroup[]>(() => {
    if (typeof data.value === "string") {
      try {
        const parsed = JSON.parse(data.value);
        if (parsed && Array.isArray(parsed.groups)) return parsed.groups;
      } catch (e) { }
    } else if (
      data.value &&
      typeof data.value === "object" &&
      Array.isArray(data.value.groups)
    ) {
      return data.value.groups;
    }
    return [
      { id: "default", name: "Mathematical Parameters", isCollapsed: false },
    ];
  });

  const [searchVar, setSearchVar] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [hoveredVar, setHoveredVar] = useState<string | null>(null);
  const [editingVar, setEditingVar] = useState<MathVariable | null>(null);
  const [showVarEditor, setShowVarEditor] = useState(false);
  const [missingVars, setMissingVars] = useState<string[]>([]);
  const [noSolutionMap, setNoSolutionMap] = useState<Record<string, boolean>>({});

  const handleNoSolution = useCallback((id: string, hasNoSolution: boolean) => {
    setNoSolutionMap((prev) => {
      if (prev[id] === hasNoSolution) return prev;
      return { ...prev, [id]: hasNoSolution };
    });
  }, []);

  // Drag and Drop States for Functions & Variables
  const [draggedFunctionId, setDraggedFunctionId] = useState<string | null>(
    null,
  );
  const [dragOverFunctionId, setDragOverFunctionId] = useState<string | null>(
    null,
  );
  const [dragOverFunctionPosition, setDragOverFunctionPosition] = useState<
    "top" | "bottom" | null
  >(null);
  const [canDragFunctionId, setCanDragFunctionId] = useState<string | null>(
    null,
  );

  const [draggedVariableId, setDraggedVariableId] = useState<string | null>(
    null,
  );
  const [dragOverVariableId, setDragOverVariableId] = useState<string | null>(
    null,
  );
  const [dragOverVariablePosition, setDragOverVariablePosition] = useState<
    "top" | "bottom" | null
  >(null);
  const [canDragVariableId, setCanDragVariableId] = useState<string | null>(
    null,
  );

  const reorderList = <T extends { id: string }>(
    list: T[],
    draggedId: string,
    targetId: string,
    position: "top" | "bottom",
  ): T[] => {
    if (draggedId === targetId) return list;
    const draggedIndex = list.findIndex((item) => item.id === draggedId);
    if (draggedIndex === -1) return list;

    const newList = [...list];
    const [draggedItem] = newList.splice(draggedIndex, 1);

    const targetIndex = newList.findIndex((item) => item.id === targetId);
    if (targetIndex === -1) return list;

    const insertIndex = position === "bottom" ? targetIndex + 1 : targetIndex;
    newList.splice(insertIndex, 0, draggedItem);
    return newList;
  };

  const handleDropFunction = (targetId: string, position: "top" | "bottom") => {
    if (!draggedFunctionId || draggedFunctionId === targetId) return;
    setFunctions((prev) =>
      reorderList(prev, draggedFunctionId, targetId, position),
    );
    setDraggedFunctionId(null);
    setDragOverFunctionId(null);
    setDragOverFunctionPosition(null);
  };

  const handleDropVariable = (
    targetId: string,
    targetGroupId: string,
    position: "top" | "bottom",
  ) => {
    if (!draggedVariableId || draggedVariableId === targetId) return;
    setVariables((prev) => {
      const updatedGroupId = prev.map((v) =>
        v.id === draggedVariableId ? { ...v, groupId: targetGroupId } : v,
      );
      return reorderList(updatedGroupId, draggedVariableId, targetId, position);
    });
    setDraggedVariableId(null);
    setDragOverVariableId(null);
    setDragOverVariablePosition(null);
  };

  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isResizingSidebar) return;

    // Prevent selection and selection styling by setting dynamic styles on body
    document.body.style.userSelect = "none";
    document.body.style.webkitUserSelect = "none";

    // Clear any active selection immediately
    window.getSelection()?.removeAllRanges();

    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarRef.current) {
        const rect = sidebarRef.current.getBoundingClientRect();
        const newWidth = Math.max(250, Math.min(e.clientX - rect.left, 800));
        setSidebarWidth(newWidth);
      }
    };
    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.webkitUserSelect = "";
    };
  }, [isResizingSidebar]);

  const [time, setTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [timeMode, setTimeMode] = useState<"loop" | "bounce" | "continuous">(
    "loop",
  );
  const [timeBounds, setTimeBounds] = useState({
    min: 0,
    max: 10,
    speed: 1,
    direction: 1,
  });
  const [showTimeSettings, setShowTimeSettings] = useState(false);
  const [tracePoints, setTracePoints] = useState(false);
  const initialGridSettings = useMemo(() => {
    let settings: any = {};
    if (typeof data?.value === "string") {
      try {
        const parsed = JSON.parse(data.value);
        if (parsed && parsed.gridSettings) {
          settings = parsed.gridSettings;
        }
      } catch (e) { }
    } else if (
      data?.value &&
      typeof data.value === "object" &&
      data.value.gridSettings
    ) {
      settings = data.value.gridSettings;
    }
    return {
      gridType:
        settings.gridType !== undefined
          ? settings.gridType
          : ("cartesian" as any),
      axisFilter:
        settings.axisFilter !== undefined
          ? settings.axisFilter
          : ("numeric" as any),
      axisStepStr:
        settings.axisStepStr !== undefined ? settings.axisStepStr : "1",
      customAxisFilter:
        settings.customAxisFilter !== undefined
          ? settings.customAxisFilter
          : "n % 3 == 0",
      customAxisMapping:
        settings.customAxisMapping !== undefined
          ? settings.customAxisMapping
          : "0: Origin\n1: Start\n2: A\n3: B\n4: End",
      axisPrefix: settings.axisPrefix !== undefined ? settings.axisPrefix : "",
      axisSuffix: settings.axisSuffix !== undefined ? settings.axisSuffix : "",
      axisDecimals:
        settings.axisDecimals !== undefined ? settings.axisDecimals : 2,
      axisThousandsSep:
        settings.axisThousandsSep !== undefined
          ? settings.axisThousandsSep
          : false,
      samplingDepth:
        settings.samplingDepth !== undefined ? settings.samplingDepth : 14,
      gridSubdivisions:
        settings.gridSubdivisions !== undefined ? settings.gridSubdivisions : 4,
    };
  }, []);

  const [gridType, setGridType] = useState<"cartesian" | "polar" | "none">(
    initialGridSettings.gridType,
  );
  const [axisFilter, setAxisFilter] = useState<
    | "all"
    | "even"
    | "odd"
    | "numeric"
    | "pi"
    | "euler"
    | "complex"
    | "degrees"
    | "radians"
    | "fractions"
    | "scientific"
    | "custom_mapping"
    | "custom"
  >(initialGridSettings.axisFilter);
  const [axisStepStr, setAxisStepStr] = useState<string>(
    initialGridSettings.axisStepStr,
  );
  const parsedAxisStep = useMemo(() => {
    try {
      const val = mathjs.evaluate(axisStepStr);
      return typeof val === "number" && val > 0 ? val : 1;
    } catch {
      return 1;
    }
  }, [axisStepStr]);
  const [customAxisFilter, setCustomAxisFilter] = useState(
    initialGridSettings.customAxisFilter,
  );
  const [customAxisMapping, setCustomAxisMapping] = useState(
    initialGridSettings.customAxisMapping,
  );
  const [axisPrefix, setAxisPrefix] = useState(initialGridSettings.axisPrefix);
  const [axisSuffix, setAxisSuffix] = useState(initialGridSettings.axisSuffix);
  const [axisDecimals, setAxisDecimals] = useState(
    initialGridSettings.axisDecimals,
  );
  const [axisThousandsSep, setAxisThousandsSep] = useState(
    initialGridSettings.axisThousandsSep,
  );
  const [showAdvancedAxisControls, setShowAdvancedAxisControls] =
    useState(false);
  const [graphSize, setGraphSize] = useState({ width: 800, height: 600 });
  const [samplingDepth, setSamplingDepth] = useState(
    initialGridSettings.samplingDepth,
  );
  const [gridSubdivisions, setGridSubdivisions] = useState(
    initialGridSettings.gridSubdivisions,
  );
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const appTheme = useStore((state) => state.appTheme);
  const updateNodeValue = useStore((state) => state.updateNodeValue);

  // Debounced auto-save of state to node data
  const lastSavedValue = useRef<string | null>(null);

  // Maintain actual latest state references to ensure instant event/onBlur handlers and unmount cleanups are never stale
  const functionsRef = useRef(functions);
  const variablesRef = useRef(variables);
  const groupsRef = useRef(groups);
  const gridSettingsRef = useRef({
    gridType,
    axisFilter,
    axisStepStr,
    customAxisFilter,
    customAxisMapping,
    axisPrefix,
    axisSuffix,
    axisDecimals,
    axisThousandsSep,
    samplingDepth,
    gridSubdivisions,
  });

  useEffect(() => {
    functionsRef.current = functions;
  }, [functions]);
  useEffect(() => {
    variablesRef.current = variables;
  }, [variables]);
  useEffect(() => {
    groupsRef.current = groups;
  }, [groups]);
  useEffect(() => {
    gridSettingsRef.current = {
      gridType,
      axisFilter,
      axisStepStr,
      customAxisFilter,
      customAxisMapping,
      axisPrefix,
      axisSuffix,
      axisDecimals,
      axisThousandsSep,
      samplingDepth,
      gridSubdivisions,
    };
  }, [
    gridType,
    axisFilter,
    axisStepStr,
    customAxisFilter,
    customAxisMapping,
    axisPrefix,
    axisSuffix,
    axisDecimals,
    axisThousandsSep,
    samplingDepth,
    gridSubdivisions,
  ]);

  const stripFunctions = (fns: MathFunction[]) =>
    fns.map(({ compiled, compiled2, error, ...f }) => f);

  const saveImmediately = useCallback(
    (
      fns = functionsRef.current,
      vars = variablesRef.current,
      grps = groupsRef.current,
      gridSettings = gridSettingsRef.current,
    ) => {
      if (!data || !data.path) return;
      const stateToSave = {
        functions: stripFunctions(fns),
        variables: vars,
        groups: grps,
        gridSettings: gridSettings,
      };
      const newVal = JSON.stringify(stateToSave, null, 2);
      lastSavedValue.current = newVal;
      updateNodeValue(data.path, newVal);
    },
    [data, updateNodeValue],
  );

  const serializedValue =
    typeof data?.value === "object" && data?.value !== null
      ? JSON.stringify(data.value)
      : data?.value || "";

  useEffect(() => {
    if (data && data.value) {
      try {
        let parsed = null;
        if (typeof data.value === "string" && data.value.trim() !== "") {
          parsed = JSON.parse(data.value);
        } else if (typeof data.value === "object" && data.value !== null) {
          parsed = data.value;
        }

        if (parsed) {
          const newValStr = JSON.stringify(
            {
              functions: parsed.functions || [],
              variables: parsed.variables || [],
              groups: parsed.groups || [],
              gridSettings: parsed.gridSettings || {},
            },
            null,
            2,
          );
          if (newValStr !== lastSavedValue.current) {
            lastSavedValue.current = newValStr;
            if (Array.isArray(parsed.functions)) setFunctions(parsed.functions);
            if (Array.isArray(parsed.variables)) setVariables(parsed.variables);
            if (Array.isArray(parsed.groups)) setGroups(parsed.groups);
            if (parsed.gridSettings) {
              if (parsed.gridSettings.gridType !== undefined)
                setGridType(parsed.gridSettings.gridType);
              if (parsed.gridSettings.axisFilter !== undefined)
                setAxisFilter(parsed.gridSettings.axisFilter);
              if (parsed.gridSettings.axisStepStr !== undefined)
                setAxisStepStr(parsed.gridSettings.axisStepStr);
              if (parsed.gridSettings.customAxisMapping !== undefined)
                setCustomAxisMapping(parsed.gridSettings.customAxisMapping);
              if (parsed.gridSettings.customAxisFilter !== undefined)
                setCustomAxisFilter(parsed.gridSettings.customAxisFilter);
              if (parsed.gridSettings.axisPrefix !== undefined)
                setAxisPrefix(parsed.gridSettings.axisPrefix);
              if (parsed.gridSettings.axisSuffix !== undefined)
                setAxisSuffix(parsed.gridSettings.axisSuffix);
              if (parsed.gridSettings.axisDecimals !== undefined)
                setAxisDecimals(parsed.gridSettings.axisDecimals);
              if (parsed.gridSettings.axisThousandsSep !== undefined)
                setAxisThousandsSep(parsed.gridSettings.axisThousandsSep);
              if (parsed.gridSettings.samplingDepth !== undefined)
                setSamplingDepth(parsed.gridSettings.samplingDepth);
              if (parsed.gridSettings.gridSubdivisions !== undefined)
                setGridSubdivisions(parsed.gridSettings.gridSubdivisions);
            }
          }
        }
      } catch (e) { }
    }
  }, [serializedValue]);

  useEffect(() => {
    if (!data || !data.path) return;

    // Save to the graph every time there's a state change
    const stateToSave = {
      functions: stripFunctions(functions),
      variables,
      groups,
      gridSettings: {
        gridType,
        axisFilter,
        axisStepStr,
        customAxisMapping,
        customAxisFilter,
        axisPrefix,
        axisSuffix,
        axisDecimals,
        axisThousandsSep,
        samplingDepth,
        gridSubdivisions,
      },
    };

    const newVal = JSON.stringify(stateToSave, null, 2);

    if (lastSavedValue.current === null) {
      // Initialize if null to avoid overriding valid external data immediately on load
      lastSavedValue.current = newVal;
      return;
    }

    if (newVal !== lastSavedValue.current) {
      lastSavedValue.current = newVal;
      const timeoutId = setTimeout(() => {
        updateNodeValue(data.path, newVal);
      }, 500); // 500ms debounce

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, [
    functions,
    variables,
    groups,
    data.path,
    updateNodeValue,
    gridType,
    axisFilter,
    axisStepStr,
    customAxisMapping,
    customAxisFilter,
    axisPrefix,
    axisSuffix,
    axisDecimals,
    axisThousandsSep,
    samplingDepth,
    gridSubdivisions,
  ]);

  useEffect(() => {
    return () => {
      // On unmount/path-change, flush any pending unsaved changes safely:
      const latestFns = functionsRef.current;
      const latestVars = variablesRef.current;
      const latestGrps = groupsRef.current;
      const latestGridSettings = gridSettingsRef.current;

      const stateToSave = {
        functions: stripFunctions(latestFns),
        variables: latestVars,
        groups: latestGrps,
        gridSettings: latestGridSettings,
      };
      const newValStr = JSON.stringify(stateToSave, null, 2);
      if (newValStr !== lastSavedValue.current) {
        lastSavedValue.current = newValStr;
        // Defer to next tick to avoid React "cannot update while rendering" warning
        setTimeout(() => {
          if (data && data.path) {
            // Verify path existence in parsedData before performing unmount auto-save
            const parsedData = useStore.getState().parsedData;
            if (!parsedData) return;

            const parts = data.path
              .replace(/^root\.?/, "")
              .split(/\.|(?=\[)/)
              .filter(Boolean);

            let current = parsedData;
            let exists = true;
            for (let i = 0; i < parts.length; i++) {
              let part = parts[i];
              if (part.startsWith("[")) {
                part = part.slice(1, -1);
                if (
                  (part.startsWith('"') && part.endsWith('"')) ||
                  (part.startsWith("'") && part.endsWith("'"))
                ) {
                  part = part.slice(1, -1);
                }
              }
              if (
                current === null ||
                current === undefined ||
                typeof current !== "object" ||
                !(part in current)
              ) {
                exists = false;
                break;
              }
              current = (current as any)[part];
            }

            if (exists) {
              useStore.getState().updateNodeValue(data.path, newValStr);
            } else {
              console.log(
                "MathNodeRenderer: Path",
                data.path,
                "no longer exists in store parsedData. Skipping unmount auto-save.",
              );
            }
          }
        }, 0);
      }
    };
  }, [data?.path]);

  const getAxisLabel = useMemo(() => createAxisLabelFormatter({
    axisFilter,
    axisDecimals,
    axisThousandsSep,
    axisPrefix,
    axisSuffix,
    customAxisFilter,
    customAxisMapping,
  }), [axisFilter, axisDecimals, axisThousandsSep, axisPrefix, axisSuffix, customAxisFilter, customAxisMapping]);

  useEffect(() => {
    if (!graphContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setGraphSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });
    observer.observe(graphContainerRef.current);
    return () => observer.disconnect();
  }, [isFullscreen, isExpanded]);

  const timeRef = useRef(0);

  const reqRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);

  // Compile functions & extract variables
  useEffect(() => {
    let cancelled = false;

    const runCompile = async () => {
      try {
        const safeFunctions = functions || [];
        const safeVariables = variables || [];
        const serializableFunctions = safeFunctions.map((f) => ({
          id: f.id,
          expr: f.expr,
          type: f.type,
          name: f.name,
          label: f.label,
          hasCustomTimeline: f.hasCustomTimeline,
          time: f.time,
          operator: f.operator,
        }));
        const result = await compileFunctions({
          functions: serializableFunctions,
          variableNames: safeVariables.map((v) => v.name),
          variableValues: safeVariables.map((v) => v.value),
          time,
          functionTimelines: safeFunctions.map((f) => ({ time: f.time || 0 })),
        });

        if (cancelled) return;

        // Thin synchronous shim for plotting
        const newFunctions = safeFunctions.map((f, i) => {
          const res = result.results[i] || {};
          if (res.error) return { ...f, error: res.error };
          try {
            let compiled, compiled2;
            let inferredOperator = f.operator;
            if (f.type === "implicit" || f.type === "inequality") {
              let op = f.operator || "=";
              let parts = f.expr.split(op);

              if (f.type === "inequality") {
                const match = f.expr.match(/(<=|>=|<|>)/);
                if (match) {
                  op = match[1];
                  parts = f.expr.split(op);
                  inferredOperator = op;
                } else if (!f.operator) {
                  op = "<=";
                  parts = [f.expr, "0"];
                  inferredOperator = op;
                }
              }

              const lhsStr = parts[0] ? parts[0].trim() : "0";
              const rhsStr = parts[1] ? parts[1].trim() : "0";

              const lhsNode = parseAndAdjustForCompile(lhsStr || "0");
              const rhsNode = parseAndAdjustForCompile(rhsStr || "0");
              compiled = lhsNode.compile();
              compiled2 = rhsNode.compile();
            } else {
              const node = parseAndAdjustForCompile(f.expr);
              compiled = node.compile();
            }
            return { ...f, compiled, compiled2, compiledKey: res.compiledKey, operator: inferredOperator, error: undefined };
          } catch (e: any) {
            return { ...f, error: formatMathError(e.message || String(e)) };
          }
        });

        setFunctions(newFunctions);
        setMissingVars(result.missingVars);
      } catch (e) {
        console.error("Worker compile failed", e);
      }
    };

    const timer = setTimeout(runCompile, 100);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    functions.map((f) => f.expr).join(","),
    functions.map((f) => [f.type, f.name || "", f.label || "", f.operator || ""].join(":")).join(","),
    variables.map((v) => v.name).join(","),
    functions.some((f) => !("compiledKey" in f) && !("error" in f)),
  ]);

  // Create a serialized key to watch changes to individual function timeline settings without re-running on general expression edits
  const functionsSerializedKey = functions
    .map((f) =>
      [
        f.id,
        !!f.hasCustomTimeline,
        !!f.isPlaying,
        f.timeSpeed !== undefined ? f.timeSpeed : 1,
        f.timeMin !== undefined ? f.timeMin : 0,
        f.timeMax !== undefined ? f.timeMax : 10,
        f.timeMode || "loop",
        f.direction !== undefined ? f.direction : 1,
      ].join(","),
    )
    .join("|");

  // Animation loop
  useEffect(() => {
    const hasAnyAnimation =
      isPlaying || functions.some((f) => f.hasCustomTimeline && f.isPlaying);
    if (!hasAnyAnimation) {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
      lastTimeRef.current = 0;
      return;
    }

    const loop = (timestamp: number) => {
      if (!lastTimeRef.current) lastTimeRef.current = timestamp;
      const dt = (timestamp - lastTimeRef.current) / 1000;
      lastTimeRef.current = timestamp;

      if (isPlaying) {
        setTime((prevTime) => {
          let newTime = prevTime + dt * timeBounds.speed * timeBounds.direction;

          if (timeMode !== "continuous") {
            if (newTime >= timeBounds.max) {
              if (timeMode === "loop") newTime = timeBounds.min;
              else if (timeMode === "bounce") {
                newTime = timeBounds.max;
                setTimeBounds((b) => ({ ...b, direction: -1 }));
              }
            } else if (newTime <= timeBounds.min) {
              if (timeMode === "loop") newTime = timeBounds.max;
              else if (timeMode === "bounce") {
                newTime = timeBounds.min;
                setTimeBounds((b) => ({ ...b, direction: 1 }));
              }
            }
          }

          timeRef.current = newTime;
          return newTime;
        });
      }

      // Also update any individual custom timelines!
      setFunctions((prevFunctions) => {
        let changed = false;
        const updated = prevFunctions.map((f) => {
          if (f.hasCustomTimeline && f.isPlaying) {
            changed = true;
            const speed = f.timeSpeed !== undefined ? f.timeSpeed : 1;
            const min = f.timeMin !== undefined ? f.timeMin : 0;
            const max = f.timeMax !== undefined ? f.timeMax : 10;
            const mode = f.timeMode || "loop";
            const dir = f.direction !== undefined ? f.direction : 1;

            let currentVal = f.time !== undefined ? f.time : 0;
            let nextVal = currentVal + dt * speed * dir;
            let nextDir = dir;

            if (mode !== "continuous") {
              if (nextVal >= max) {
                if (mode === "loop") {
                  nextVal = min;
                } else if (mode === "bounce") {
                  nextVal = max;
                  nextDir = -1;
                }
              } else if (nextVal <= min) {
                if (mode === "loop") {
                  nextVal = max;
                } else if (mode === "bounce") {
                  nextVal = min;
                  nextDir = 1;
                }
              }
            }
            return {
              ...f,
              time: nextVal,
              direction: nextDir,
            };
          }
          return f;
        });
        return changed ? updated : prevFunctions;
      });

      reqRef.current = requestAnimationFrame(loop);
    };

    reqRef.current = requestAnimationFrame(loop);
    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current);
    };
  }, [
    isPlaying,
    timeBounds.speed,
    timeBounds.direction,
    timeBounds.min,
    timeBounds.max,
    timeMode,
    functionsSerializedKey,
  ]);

  const baseScope = variables.reduce(
    (acc, v) => ({ ...acc, [v.name]: v.value }),
    {} as any,
  );
  baseScope.t = time;
  baseScope.time = time;
  baseScope.ln = mathjs.log;
  baseScope.log10 = mathjs.log10;
  baseScope.theta = 0;
  baseScope.indexHelper = indexHelper;

  // Expose geometry functions in baseScope
  baseScope.Line = (...args: any[]) => args;
  baseScope.Vector = (...args: any[]) => args;
  baseScope.Polygon = (...args: any[]) => args;
  baseScope.Point = (...args: any[]) => args;

  // Expose individual timelines as pre-defined variables in the base scope (e.g., t_1, t_2, t_f)
  functions.forEach((f, idx) => {
    const fTime = f.hasCustomTimeline
      ? f.time !== undefined
        ? f.time
        : 0
      : time;
    // By index
    baseScope[`t_${idx + 1}`] = fTime;

    // By function name if available
    if (f.name) {
      const match = f.name.match(/^([a-zA-Z0-9_]+)/);
      const fnId = match ? match[1] : f.name;
      if (fnId && fnId !== "t" && fnId !== "time") {
        baseScope[`t_${fnId}`] = fTime;
      }
    }
  });

  // Pre-evaluate functions so definitions or matrices are available sequentially
  functions.forEach((f) => {
    if (f.compiled) {
      try {
        const fTime = f.hasCustomTimeline
          ? f.time !== undefined
            ? f.time
            : 0
          : time;
        const fScope = Object.create(baseScope);
        fScope.t = fTime;
        fScope.time = time;

        const val = f.compiled.evaluate(fScope);

        // Propagate variables defined in fScope to baseScope
        for (const key of Object.keys(fScope)) {
          if (key !== "t" && key !== "time" && key !== "theta" && key !== "x" && key !== "y") {
            baseScope[key] = fScope[key];
          }
        }

        const refName = f.label || f.name;
        if (refName) {
          baseScope[refName] = ["point", "line", "vector", "polygon"].includes(f.type)
            ? normalizeGeometryValue(val)
            : val;
        }
      } catch (e) { }
    }
  });

  const handleUpdateVar = (id: string, updates: Partial<MathVariable>) => {
    setVariables((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    );
  };

  const handleAutoAddVar = (name: string) => {
    const newVar: MathVariable = {
      id: generateSafeId(),
      name,
      displayName: "",
      description: "",
      value: 1,
      defaultValue: 1,
      min: -10,
      max: 10,
      step: 0.1,
      groupId: "default",
    };
    setVariables((prev) => [...prev, newVar]);
  };

  const handleDeleteVar = (id: string) => {
    const next = variables.filter((v) => v.id !== id);
    setVariables(next);
    saveImmediately(undefined, next);
  };

  const handleUpdateExpr = (id: string, expr: string) => {
    setFunctions((prev) => prev.map((f) => (f.id === id ? { ...f, expr } : f)));
  };

  const handleAddFunction = () => {
    setFunctions((prev) => [
      ...prev,
      {
        id: generateSafeId(),
        expr: "x",
        color: COLORS[prev.length % COLORS.length],
        visible: true,
        type: "function",
      },
    ]);
  };

  const handleInsertFunctionFromHelp = (formula: {
    type:
    | "function"
    | "parametric"
    | "point"
    | "implicit"
    | "polar"
    | "vector"
    | "polygon"
    | "inequality"
    | "line";
    expr: string;
    expr2?: string;
    name?: string;
  }) => {
    setFunctions((prev) => [
      ...prev,
      {
        id: generateSafeId(),
        expr: formula.expr,
        expr2: formula.expr2,
        name: formula.name || "",
        color: COLORS[prev.length % COLORS.length],
        visible: true,
        type: formula.type,
      },
    ]);
  };

  const handleAddFunctionAt = (
    targetFnId: string,
    position: "above" | "below",
  ) => {
    setFunctions((prev) => {
      const targetIndex = prev.findIndex((f) => f.id === targetFnId);
      if (targetIndex === -1) return prev;

      const newFn = {
        id: generateSafeId(),
        expr: "x",
        color: COLORS[prev.length % COLORS.length],
        visible: true,
        type: "function" as const,
      };

      const insertIndex = position === "above" ? targetIndex : targetIndex + 1;
      const next = [...prev];
      next.splice(insertIndex, 0, newFn);
      return next;
    });
  };

  const handleDuplicateFunction = (targetFnId: string) => {
    setFunctions((prev) => {
      const targetIndex = prev.findIndex((f) => f.id === targetFnId);
      if (targetIndex === -1) return prev;

      const targetFn = prev[targetIndex];
      const newFn = {
        ...targetFn,
        id: generateSafeId(),
        color: COLORS[prev.length % COLORS.length],
      };

      const next = [...prev];
      next.splice(targetIndex + 1, 0, newFn);
      return next;
    });
  };

  const handleAddVariableAt = (
    targetVarId: string,
    position: "above" | "below",
  ) => {
    setVariables((prev) => {
      const targetIndex = prev.findIndex((v) => v.id === targetVarId);
      if (targetIndex === -1) return prev;

      const targetVar = prev[targetIndex];

      // Let's generate a unique variable name
      const alphabets = "abcdefghijklmnopqrstuvwxyzkmnpqrstuvw";
      let chosenName = "k";
      const existingNames = new Set(prev.map((v) => v.name.toLowerCase()));
      for (const char of alphabets) {
        if (!existingNames.has(char)) {
          chosenName = char;
          break;
        }
      }
      if (existingNames.has(chosenName)) {
        let suffix = 1;
        while (existingNames.has(`k_${suffix}`)) {
          suffix++;
        }
        chosenName = `k_${suffix}`;
      }

      const newVar: MathVariable = {
        id: generateSafeId(),
        name: chosenName,
        displayName: `${chosenName.toUpperCase()} Parameter`,
        description: "",
        value: 1,
        defaultValue: 1,
        min: -10,
        max: 10,
        step: 0.1,
        groupId: targetVar.groupId,
        showSlider: true,
      };

      const insertIndex = position === "above" ? targetIndex : targetIndex + 1;
      const next = [...prev];
      next.splice(insertIndex, 0, newVar);
      return next;
    });
  };

  const handleRemoveFunction = (id: string) => {
    const next = functions.filter((f) => f.id !== id);
    setFunctions(next);
    saveImmediately(next);
    setActiveExample(null);
  };

  const handleLoadExample = (exampleName: string) => {
    if (activeExample === exampleName) {
      setFunctions([]);
      setVariables([]);
      setActiveExample(null);
      return;
    }
    setActiveExample(exampleName);

    const exampleData = MATH_EXAMPLES[exampleName];
    if (exampleData) {
      setFunctions(exampleData.functions);
      setVariables(exampleData.variables);
    }
  };

  const content = (
    <div
      className={`${appTheme} flex flex-col bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 text-slate-800 dark:text-slate-200 shadow-2xl overflow-hidden transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-[9999] rounded-none" : "w-full h-full rounded-xl"}`}
      style={{
        width: isFullscreen ? undefined : width,
        height: isFullscreen ? undefined : height,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 cursor-move drag-handle">
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => {
              if (window.innerWidth < 768) {
                setIsMobileSidebarOpen((prev) => !prev);
                setIsPanelVisible(true);
              } else {
                setIsPanelVisible((prev) => !prev);
              }
            }}
            className={`p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 flex items-center justify-center shrink-0`}
            title="Toggle Function Input Panel"
          >
            <Menu size={16} />
          </button>
          <Layers
            size={16}
            className="hidden md:block shrink-0 text-blue-500 dark:text-blue-400"
          />
          <span className="font-semibold text-sm text-slate-800 dark:text-slate-300 truncate">
            Advanced Math Graph
          </span>
        </div>
        <div className="flex items-center gap-1 nodrag shrink-0">
          <button
            onClick={() => setShowGridControls((prev) => !prev)}
            className={`p-1 rounded transition-colors md:hidden ${showGridControls
              ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400"
              : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            title="Grid & Axis Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => setViewResetKey((k) => k + 1)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
            title="Reset Origin (Center Graph)"
          >
            <Crosshair size={16} />
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="p-1 sm:px-1.5 sm:py-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-transparent hover:border-indigo-100 dark:hover:border-indigo-900 rounded transition-all text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1 text-xs"
            title="Help & Documentation (F1 / Alt+H)"
          >
            <HelpCircle size={14} />
            <span className="hidden sm:inline">Help</span>
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 shrink-0"
            title={isFullscreen ? "Minimize" : "Maximize Node"}
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Mobile Overlay */}
        {isMobileSidebarOpen && (
          <div
            className="absolute inset-0 bg-slate-900/20 dark:bg-slate-900/40 z-[45] md:hidden nodrag"
            onClick={() => {
              setIsMobileSidebarOpen(false);
            }}
          />
        )}

        {/* Sidebar */}
        {(isExpanded || isFullscreen || isMobileSidebarOpen) &&
          isPanelVisible && (
            <div
              ref={sidebarRef}
              className={`bg-slate-50 dark:bg-slate-800 flex flex-col border-r border-slate-200 dark:border-slate-700 nodrag z-[50] absolute inset-y-0 left-0 md:relative transition-transform duration-300 md:translate-x-0 w-full sm:w-[85vw] md:w-[var(--sidebar-width)] md:max-w-none ${isMobileSidebarOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}
              style={
                {
                  "--sidebar-width": `${sidebarWidth}px`,
                } as React.CSSProperties
              }
              onClick={() => setActiveActionMenuId(null)}
            >
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
                {/* Functions */}
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Functions & Equations
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setFunctions([])}
                        className="p-1 hover:bg-red-200 dark:hover:bg-red-900/50 rounded text-slate-400 hover:text-red-500 transition-colors"
                        title="Clear All Functions"
                      >
                        <Trash2 size={14} />
                      </button>
                      <button
                        onClick={handleAddFunction}
                        className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded text-slate-550 dark:text-slate-300 transition-colors"
                        title="Add Function"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 px-1 pb-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        Curve Resolution (Depth Sampling)
                        <span className="text-[10px] normal-case font-medium text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded ml-1">
                          {samplingDepth <= 8
                            ? "⚡ Fast"
                            : samplingDepth <= 14
                              ? "⚡ Balanced"
                              : samplingDepth <= 20
                                ? "⚡ High Quality"
                                : "⚡ Ultra Detail"}
                        </span>
                      </label>
                      <span className="text-[10px] font-mono p-0.5 bg-slate-200 dark:bg-slate-800 rounded px-1.5 text-slate-600 dark:text-slate-300">
                        {samplingDepth}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      step={1}
                      value={samplingDepth}
                      onChange={(e) => setSamplingDepth(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700/50 rounded-lg appearance-none cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 hover:[&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5 px-1 pb-4 border-b border-slate-200 dark:border-slate-800">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        Grid Subdivisions
                      </label>
                      <span className="text-[10px] font-mono p-0.5 bg-slate-200 dark:bg-slate-800 rounded px-1.5 text-slate-600 dark:text-slate-300">
                        {gridSubdivisions}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={gridSubdivisions}
                      onChange={(e) =>
                        setGridSubdivisions(Number(e.target.value))
                      }
                      className="w-full h-1.5 bg-slate-200 dark:bg-slate-700/50 rounded-lg appearance-none cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:bg-blue-500 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:shadow-md hover:[&::-webkit-slider-thumb]:scale-110 hover:[&::-webkit-slider-thumb]:bg-blue-400 [&::-webkit-slider-thumb]:transition-all"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    {functions.map((f, index) => (
                      <div
                        key={f.id}
                        draggable={canDragFunctionId === f.id}
                        onDragStart={(e) => {
                          setDraggedFunctionId(f.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggedFunctionId(null);
                          setDragOverFunctionId(null);
                          setDragOverFunctionPosition(null);
                          setCanDragFunctionId(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          const rect = e.currentTarget.getBoundingClientRect();
                          const relativeY = e.clientY - rect.top;
                          const isTop = relativeY < rect.height / 2;
                          setDragOverFunctionId(f.id);
                          setDragOverFunctionPosition(isTop ? "top" : "bottom");
                        }}
                        onDragLeave={() => {
                          if (dragOverFunctionId === f.id) {
                            setDragOverFunctionId(null);
                            setDragOverFunctionPosition(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (dragOverFunctionId && dragOverFunctionPosition) {
                            handleDropFunction(f.id, dragOverFunctionPosition);
                          }
                        }}
                        className={`flex flex-col md:flex-row md:items-center gap-2 bg-white dark:bg-slate-900/50 p-2 md:pr-10 border-l-[3px] rounded bg-gradient-to-r from-transparent to-slate-100 dark:to-slate-900/20 shadow-sm dark:shadow-inner group transition-all hover:border-slate-400 dark:hover:border-slate-500 relative
                      ${draggedFunctionId === f.id ? "opacity-40" : ""} ${draggedFunctionId !== null ? "[&>*]:pointer-events-none" : ""} ${activeActionMenuId === f.id ? "z-[100]" : activeVisualEditorId === f.id ? "z-40" : "z-10"}
                    `}
                        style={{ borderLeftColor: f.color }}
                      >
                        {/* Real-time drop insertion line boundary indicator */}
                        {dragOverFunctionId === f.id &&
                          dragOverFunctionPosition && (
                            <div
                              className={`absolute left-0 right-0 h-0.5 bg-blue-500 dark:bg-blue-400 z-50 rounded-full transition-all ${dragOverFunctionPosition === "top"
                                ? "-top-[1px]"
                                : "-bottom-[1px]"
                                }`}
                            />
                          )}

                        {/* Mobile Header Row / Desktop Left Elements */}
                        <div className="flex items-center gap-2 w-full md:w-auto flex-shrink-0">
                          {/* Grip Handle */}
                          <div
                            onMouseDown={() => setCanDragFunctionId(f.id)}
                            onMouseUp={() => setCanDragFunctionId(null)}
                            onTouchStart={() => setCanDragFunctionId(f.id)}
                            onTouchEnd={() => setCanDragFunctionId(null)}
                            className="cursor-grab active:cursor-grabbing text-slate-450 dark:text-slate-500 hover:text-slate-650 dark:hover:text-slate-350 p-0.5 rounded md:opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                            title="Drag to reorder"
                          >
                            <GripVertical size={14} />
                          </div>
                          <div
                            className="w-4 h-4 rounded-full flex-shrink-0 cursor-pointer transition-transform hover:scale-110"
                            style={{
                              backgroundColor: f.visible
                                ? f.color
                                : "transparent",
                              border: `2px solid ${f.color}`,
                            }}
                            title={"Toggle visibility\nAlt + Click: Solo mode! This instantly hides all other shapes on the graph and makes sure only the shape you clicked on is visible.\nShift + Click: This makes all the equations from the top of the list down to the one you clicked visible, while immediately hiding every equation below it."}
                            onClick={(e) => {
                              if (e.altKey) {
                                setFunctions((prev) =>
                                  prev.map((fn) => ({
                                    ...fn,
                                    visible: fn.id === f.id,
                                  }))
                                );
                              } else if (e.shiftKey) {
                                setFunctions((prev) =>
                                  prev.map((fn, i) => ({
                                    ...fn,
                                    visible: i <= index,
                                  }))
                                );
                              } else {
                                setFunctions((prev) =>
                                  prev.map((fn) =>
                                    fn.id === f.id
                                      ? { ...fn, visible: !fn.visible }
                                      : fn,
                                  ),
                                );
                              }
                            }}
                          />
                          <select
                            value={f.type}
                            onChange={(e) =>
                              setFunctions((prev) =>
                                prev.map((fn) =>
                                  fn.id === f.id
                                    ? { ...fn, type: e.target.value as any }
                                    : fn,
                                ),
                              )
                            }
                            className="bg-slate-100 dark:bg-transparent text-slate-550 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400 border border-slate-200 dark:border-slate-700/50 rounded outline-none p-1 mr-2 text-xs font-semibold cursor-pointer appearance-none text-center"
                            style={{
                              WebkitAppearance: "none",
                              MozAppearance: "none",
                            }}
                            title={
                              f.type === "function"
                                ? "Function (y = f(x))"
                                : f.type === "polar"
                                  ? "Polar equation (r = f(t))"
                                  : f.type === "parametric"
                                    ? "Parametric equation ([x(t), y(t)])"
                                    : f.type === "implicit"
                                      ? "Implicit equation (f(x,y) = 0)"
                                      : f.type === "vector"
                                        ? "Vector"
                                        : f.type === "point"
                                          ? "Point"
                                          : f.type === "line"
                                            ? "Line Segment"
                                            : f.type === "inequality"
                                              ? "Inequality"
                                              : f.type === "polygon"
                                                ? "Polygon"
                                                : "Select function type"
                            }
                          >
                            <option
                              value="function"
                              title="Function"
                              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            >
                              y =
                            </option>
                            <option
                              value="polar"
                              title="Polar equation"
                              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            >
                              r =
                            </option>
                            <option
                              value="parametric"
                              title="Parametric equation"
                              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            >
                              [x,y] =
                            </option>
                            <option
                              value="implicit"
                              title="Implicit equation"
                              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            >
                              XY =
                            </option>
                            <option
                              value="vector"
                              title="Vector"
                              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            >
                              V =
                            </option>
                            <option
                              value="point"
                              title="Point"
                              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            >
                              P =
                            </option>
                            <option
                              value="line"
                              title="Line Segment"
                              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            >
                              Line =
                            </option>
                            <option
                              value="inequality"
                              title="Inequality Region"
                              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            >
                              Ineq =
                            </option>
                            <option
                              value="polygon"
                              title="Polygon"
                              className="bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200"
                            >
                              Poly =
                            </option>
                          </select>

                          <div className="flex-1 md:hidden"></div>
                          {/* Mobile Toggle Button inside Header Row */}
                          <div
                            className="md:hidden flex items-center shrink-0 nodrag cursor-default"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              className={`p-1.5 opacity-60 hover:opacity-100 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded transition-all ${activeActionMenuId === f.id ? "bg-slate-100 dark:bg-slate-700" : ""}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenuId(
                                  activeActionMenuId === f.id ? null : f.id,
                                );
                              }}
                            >
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </div>

                        {/* Equation Input / Desktop Right side */}
                        <div className="flex flex-col flex-1 min-w-0 w-full md:w-auto relative">
                          <div className="flex items-center font-mono text-sm w-full gap-1 relative group/input">
                            <div className="flex-1 min-w-0">
                              <EquationInput
                                value={f.expr}
                                onChange={(val: string) =>
                                  handleUpdateExpr(f.id, val)
                                }
                                onBlur={() => saveImmediately()}
                                variables={variables}
                                hoveredVar={hoveredVar}
                                setHoveredVar={setHoveredVar}
                                error={f.error}
                                warning={noSolutionMap[f.id] ? "This particular equation has no zero or solutions in the current view" : undefined}
                                onAddEnter={handleAddFunction}
                                globalTime={time}
                                forceEditMode={activeVisualEditorId === f.id}
                                showKeyboard={activeVisualEditorId === f.id}
                                onToggleKeyboard={() =>
                                  setActiveVisualEditorId(
                                    activeVisualEditorId === f.id ? null : f.id,
                                  )
                                }
                                onCloseKeyboard={() =>
                                  setActiveVisualEditorId(null)
                                }
                              />
                            </div>

                            {/* Desktop Inline Actions */}
                            <div
                              className={`absolute right-2 top-5 -translate-y-1/2 hidden md:opacity-0 md:group-hover/input:opacity-100 md:flex items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-md p-0.5 transition-opacity z-[1000] hover:opacity-100`}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveVisualEditorId(
                                    activeVisualEditorId === f.id ? null : f.id,
                                  );
                                }}
                                className={`p-1 rounded transition-all flex flex-col justify-center ${activeVisualEditorId === f.id
                                  ? "opacity-100 bg-blue-500/10 text-blue-500 dark:text-blue-400"
                                  : "opacity-60 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400"
                                  }`}
                                title="Visual Math Composer"
                              >
                                <Calculator size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setExpandedSettingsFnId((prev) =>
                                    prev === f.id ? null : f.id,
                                  );
                                }}
                                className={`p-1 rounded transition-all hover:bg-slate-100 dark:hover:bg-slate-700 flex flex-col justify-center ${expandedSettingsFnId === f.id
                                  ? "opacity-100 bg-blue-500/10 text-blue-500 dark:text-blue-400"
                                  : "opacity-60 text-slate-500 dark:text-slate-400"
                                  }`}
                                title="Settings"
                              >
                                <Settings
                                  size={14}
                                  className={`transform transition-transform duration-300 ${expandedSettingsFnId === f.id ? "rotate-90 text-blue-500 dark:text-blue-400" : "hover:rotate-45"}`}
                                />
                              </button>
                              <button
                                onClick={() =>
                                  handleAddFunctionAt(f.id, "above")
                                }
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 rounded transition-all flex items-center justify-center"
                                title="Insert Function Above"
                              >
                                <InsertAboveIcon size={14} />
                              </button>
                              <button
                                onClick={() =>
                                  handleAddFunctionAt(f.id, "below")
                                }
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 rounded transition-all flex items-center justify-center"
                                title="Insert Function Below"
                              >
                                <InsertBelowIcon size={14} />
                              </button>
                              <button
                                onClick={() => {
                                  try {
                                    let finalTex = "";
                                    const eqIndex = f.expr.indexOf("=");
                                    if (
                                      eqIndex !== -1 &&
                                      !f.expr.includes("==") &&
                                      !f.expr.includes(">=") &&
                                      !f.expr.includes("<=") &&
                                      !f.expr.includes("!=")
                                    ) {
                                      const lhs = f.expr
                                        .slice(0, eqIndex)
                                        .trim();
                                      const rhs = f.expr
                                        .slice(eqIndex + 1)
                                        .trim();
                                      const lhsTex = mathjs.parse(lhs).toTex();
                                      const rhsTex = mathjs.parse(rhs).toTex();
                                      finalTex = `${lhsTex} = ${rhsTex}`;
                                    } else {
                                      const node = mathjs.parse(f.expr);
                                      finalTex = node.toTex({});
                                    }
                                    navigator.clipboard.writeText(finalTex);
                                    setCopiedAction({
                                      id: f.id,
                                      type: "latex",
                                    });
                                    setTimeout(
                                      () => setCopiedAction(null),
                                      2000,
                                    );
                                  } catch (e) { }
                                }}
                                className={`p-1 font-serif text-[11px] font-bold rounded transition-all flex items-center justify-center ${copiedAction?.id === f.id &&
                                  copiedAction?.type === "latex"
                                  ? "bg-green-500/10 text-green-500"
                                  : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400"
                                  }`}
                                title="Copy LaTeX"
                              >
                                TeX
                              </button>
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(f.expr);
                                  setCopiedAction({ id: f.id, type: "expr" });
                                  setTimeout(() => setCopiedAction(null), 2000);
                                }}
                                className={`p-1 rounded transition-all flex items-center justify-center ${copiedAction?.id === f.id &&
                                  copiedAction?.type === "expr"
                                  ? "bg-green-500/10 text-green-500"
                                  : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400"
                                  }`}
                                title="Copy Formula"
                              >
                                <Copy size={14} />
                              </button>
                              <button
                                onClick={() => handleDuplicateFunction(f.id)}
                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 rounded transition-all flex items-center justify-center"
                                title="Duplicate Function"
                              >
                                <CopyPlus size={14} strokeWidth={2} />
                              </button>
                              <button
                                onClick={() => {
                                  setFormulaName(f.name || "");
                                  setFormulaDesc("");
                                  setSavingFormulaFnId(
                                    savingFormulaFnId === f.id ? null : f.id,
                                  );
                                }}
                                className={`p-1 rounded transition-all flex items-center justify-center ${savingFormulaFnId === f.id
                                  ? "opacity-100 bg-amber-500/10 text-amber-500 dark:text-amber-400"
                                  : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 animate-pulse-subtle"
                                  }`}
                                title="Save to My Formula Library (IndexedDB)"
                              >
                                <Bookmark
                                  size={14}
                                  fill={
                                    savingFormulaFnId === f.id
                                      ? "currentColor"
                                      : "none"
                                  }
                                />
                              </button>
                              <div className="w-[1px] h-3 bg-slate-200 dark:bg-slate-700 mx-0.5 transition-opacity"></div>
                              <button
                                onClick={() => handleRemoveFunction(f.id)}
                                className="p-1 hover:bg-red-500/20 hover:text-red-400 text-slate-400 dark:text-slate-500 rounded transition-all"
                                title="Remove"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {savingFormulaFnId === f.id &&
                            createPortal(
                              <div className="fixed inset-0 z-[100000] bg-[#070b13]/85 backdrop-blur-md flex items-center justify-center p-4">
                                <div className="bg-[#090e18] border border-[#1e2e4e]/40 w-full max-w-[340px] rounded-xl flex flex-col gap-3 p-4 shadow-2xl text-slate-200 animate-fadeIn cursor-default nodrag">
                                  {/* Header Row */}
                                  <div className="flex items-center justify-between pb-1.5 border-b border-[#1e293b]/50">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <Bookmark
                                        size={15}
                                        className="text-amber-500 fill-amber-500"
                                      />
                                      <h2 className="text-xs font-bold text-slate-100 font-sans tracking-wide truncate">
                                        Save Formula
                                      </h2>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="bg-[#132A4A]/60 text-[#7bb4ec] font-mono text-[9px] font-semibold px-2 py-0.5 rounded border border-[#214374]/30 max-w-[110px] truncate"
                                        title={f.expr}
                                      >
                                        {f.type === "polar"
                                          ? "r = "
                                          : f.type === "parametric"
                                            ? "[x,y] = "
                                            : "y = "}
                                        {f.expr}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setSavingFormulaFnId(null)
                                        }
                                        className="text-slate-400 hover:text-slate-105 transition-colors p-0.5 rounded"
                                      >
                                        <X size={13} className="stroke-[2.5]" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Inputs */}
                                  <div className="flex flex-col gap-3">
                                    {/* Formula Name */}
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                                        Formula Name
                                      </label>
                                      <div className="flex items-stretch bg-[#0D1527]/75 border border-[#1E2E4E]/40 focus-within:border-blue-500 rounded-lg overflow-hidden h-8 px-2 transition-all relative">
                                        <input
                                          type="text"
                                          maxLength={60}
                                          value={formulaName}
                                          onChange={(e) =>
                                            setFormulaName(e.target.value)
                                          }
                                          placeholder="e.g., Polar Rose"
                                          className="flex-1 bg-transparent border-none text-slate-100 placeholder:text-slate-500 text-[11px] h-full w-full outline-none focus:outline-none focus:ring-0 font-sans font-medium"
                                          required
                                        />
                                        <div className="flex items-center gap-1 select-none pointer-events-none pl-1">
                                          <span className="text-[8px] font-mono text-slate-500">
                                            {formulaName.length}/60
                                          </span>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Description */}
                                    <div className="flex flex-col gap-1">
                                      <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                                        Description (optional)
                                      </label>
                                      <div className="flex bg-[#0D1527]/75 border border-[#1E2E4E]/40 focus-within:border-blue-500 rounded-lg overflow-hidden transition-all relative p-1.5">
                                        <textarea
                                          maxLength={200}
                                          value={formulaDesc}
                                          onChange={(e) =>
                                            setFormulaDesc(e.target.value)
                                          }
                                          placeholder="A curve resembling a rose with petals..."
                                          className="flex-1 bg-transparent border-none text-slate-100 placeholder:text-slate-500 text-[10.5px] h-10 w-full outline-none resize-none focus:outline-none focus:ring-0 leading-normal font-sans font-medium"
                                          rows={1}
                                        />
                                      </div>
                                    </div>

                                    {/* Formula Preview with actions at top right */}
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center justify-between">
                                        <label className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest font-sans">
                                          Formula Preview
                                        </label>
                                        <div className="flex items-center gap-1.5 select-none">
                                          {/* Small Eye button to toggle raw / rendered */}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setShowPreviewLatex(
                                                !showPreviewLatex,
                                              );
                                            }}
                                            className={`p-0.5 rounded border flex items-center justify-center h-5 w-5 cursor-pointer transition-colors ${showPreviewLatex
                                              ? "bg-blue-600/10 text-blue-405 border-blue-500/20 hover:bg-blue-600/20"
                                              : "bg-slate-800/40 text-slate-400 border-slate-700/50 hover:bg-slate-700/45"
                                              }`}
                                            title={
                                              showPreviewLatex
                                                ? "Show Raw Text Code"
                                                : "Show LaTeX Math Layout"
                                            }
                                          >
                                            <Eye
                                              size={11}
                                              className="stroke-[2]"
                                            />
                                          </button>

                                          {/* Compact Copy action */}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              navigator.clipboard.writeText(
                                                f.expr,
                                              );
                                              setPreviewCopied(true);
                                              setTimeout(
                                                () => setPreviewCopied(false),
                                                2000,
                                              );
                                            }}
                                            className="h-5 px-1.5 bg-[#16273e] hover:bg-slate-850 text-blue-450 hover:text-blue-300 font-semibold rounded border border-[#2b4260] cursor-pointer transition-colors shadow-xs text-[9px] flex items-center gap-1"
                                          >
                                            <Copy size={9} />
                                            <span>
                                              {previewCopied
                                                ? "Saved!"
                                                : "Copy"}
                                            </span>
                                          </button>
                                        </div>
                                      </div>

                                      <div className="bg-[#0B101D]/75 border border-[#1e293b]/50 rounded-lg p-2.5 flex flex-col shadow-inner">
                                        <div className="bg-[#111A2E] border border-[#1E2E4E]/30 rounded-lg p-2 min-h-[3rem] flex flex-col justify-center items-center overflow-x-auto">
                                          <div className="w-full flex items-center justify-center select-all">
                                            {showPreviewLatex ? (
                                              (() => {
                                                try {
                                                  let fullTex = "";
                                                  const eqIndex =
                                                    f.expr.indexOf("=");
                                                  if (
                                                    eqIndex !== -1 &&
                                                    !f.expr.includes("==") &&
                                                    !f.expr.includes(">=") &&
                                                    !f.expr.includes("<=") &&
                                                    !f.expr.includes("!=")
                                                  ) {
                                                    const lhs = f.expr
                                                      .slice(0, eqIndex)
                                                      .trim();
                                                    const rhs = f.expr
                                                      .slice(eqIndex + 1)
                                                      .trim();
                                                    const lhsTex = mathjs
                                                      .parse(lhs)
                                                      .toTex();
                                                    const rhsTex = mathjs
                                                      .parse(rhs)
                                                      .toTex();
                                                    fullTex = `${lhsTex} = ${rhsTex}`;
                                                  } else {
                                                    const parsed = mathjs.parse(
                                                      f.expr,
                                                    );
                                                    const texStr =
                                                      parsed.toTex();
                                                    let prefix = "";
                                                    if (f.type === "polar")
                                                      prefix = "r = ";
                                                    else if (
                                                      f.type === "parametric"
                                                    )
                                                      prefix = "[x,y] = ";
                                                    else if (
                                                      f.type === "implicit"
                                                    )
                                                      prefix = "";
                                                    else prefix = "y = ";

                                                    fullTex = prefix + texStr;
                                                  }

                                                  const html =
                                                    katex.renderToString(
                                                      fullTex,
                                                      {
                                                        throwOnError: true,
                                                        displayMode: false,
                                                        strict: "ignore",
                                                        trust: true,
                                                      },
                                                    );
                                                  return (
                                                    <div
                                                      className="text-slate-100 [&_.katex]:text-xs font-sans tracking-normal text-center"
                                                      dangerouslySetInnerHTML={{
                                                        __html: html,
                                                      }}
                                                    />
                                                  );
                                                } catch (err) {
                                                  return (
                                                    <div className="font-mono text-[10px] text-blue-400 font-bold">
                                                      {f.type === "polar"
                                                        ? "r = "
                                                        : f.type ===
                                                          "parametric"
                                                          ? "[x,y] = "
                                                          : "y = "}
                                                      {f.expr}
                                                    </div>
                                                  );
                                                }
                                              })()
                                            ) : (
                                              <div className="font-mono text-[10px] text-slate-300 bg-[#090e18]/80 px-2 py-1 rounded border border-[#1e2e4e]/30 select-all max-w-full overflow-x-auto break-all tracking-wide text-center">
                                                {f.type === "polar"
                                                  ? "r = "
                                                  : f.type === "parametric"
                                                    ? "[x,y] = "
                                                    : "y = "}
                                                {f.expr}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Footer Actions */}
                                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e293b]/50">
                                    <button
                                      type="button"
                                      onClick={() => setSavingFormulaFnId(null)}
                                      className="text-slate-400 hover:text-slate-205 transition-colors font-semibold text-[10px] font-sans px-3 py-1 rounded-md cursor-pointer"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (!formulaName.trim()) return;
                                        try {
                                          await db.customFormulas.add({
                                            name: formulaName.trim(),
                                            description:
                                              formulaDesc.trim() || undefined,
                                            expr: f.expr,
                                            type: f.type,
                                            createdAt: Date.now(),
                                          });
                                          setSavingFormulaFnId(null);
                                        } catch (err) {
                                          console.error(
                                            "Error saving formula: ",
                                            err,
                                          );
                                        }
                                      }}
                                      disabled={!formulaName.trim()}
                                      className="bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-40 disabled:cursor-not-allowed text-white text-[10px] font-bold font-sans rounded-lg px-3.5 h-7.5 flex items-center justify-center gap-1 cursor-pointer transition-all active:scale-[0.98] select-none shadow-md"
                                    >
                                      <Save
                                        size={11}
                                        className="text-white fill-none"
                                      />
                                      <span>Save</span>
                                    </button>
                                  </div>
                                </div>
                              </div>,
                              document.body,
                            )}
                          {expandedSettingsFnId === f.id && (
                            <div className="flex flex-col mt-2 pl-[48px] gap-2.5 text-[11px] pb-1 animate-fadeIn">
                              {/* General Behaviors */}
                              <div className="flex flex-col gap-2 mb-2">
                                <span className="text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700 pb-1">
                                  Behaviors & Properties
                                </span>
                                <div className="grid grid-cols-2 gap-2">
                                  {/* Draggable */}
                                  <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                                    <div
                                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.isDraggable ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400"}`}
                                    >
                                      {f.isDraggable && (
                                        <svg
                                          className="w-2.5 h-2.5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={3}
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      )}
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={!!f.isDraggable}
                                      onChange={(e) =>
                                        setFunctions((prev) =>
                                          prev.map((fn) =>
                                            fn.id === f.id
                                              ? {
                                                ...fn,
                                                isDraggable: e.target.checked,
                                                isTransformable: e.target
                                                  .checked
                                                  ? false
                                                  : fn.isTransformable,
                                              }
                                              : fn,
                                          ),
                                        )
                                      }
                                      className="hidden"
                                    />
                                    <span className="text-slate-600 dark:text-slate-300">
                                      Draggable
                                    </span>
                                  </label>

                                  {/* Transformable */}
                                  {f.type !== "point" && (
                                    <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                                      <div
                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.isTransformable ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400"}`}
                                      >
                                        {f.isTransformable && (
                                          <svg
                                            className="w-2.5 h-2.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={3}
                                              d="M5 13l4 4L19 7"
                                            />
                                          </svg>
                                        )}
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={!!f.isTransformable}
                                        onChange={(e) =>
                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  isTransformable:
                                                    e.target.checked,
                                                  isDraggable: e.target
                                                    .checked
                                                    ? false
                                                    : fn.isDraggable,
                                                }
                                                : fn,
                                            ),
                                          )
                                        }
                                        className="hidden"
                                      />
                                      <span className="text-slate-600 dark:text-slate-300">
                                        Transformable
                                      </span>
                                    </label>
                                  )}

                                  {/* Rotatable (Only if Transformable) */}
                                  {f.isTransformable && (
                                    <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                                      <div
                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.isRotatable ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400"}`}
                                      >
                                        {f.isRotatable && (
                                          <svg
                                            className="w-2.5 h-2.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={3}
                                              d="M5 13l4 4L19 7"
                                            />
                                          </svg>
                                        )}
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={!!f.isRotatable}
                                        onChange={(e) =>
                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  isRotatable:
                                                    e.target.checked,
                                                }
                                                : fn,
                                            ),
                                          )
                                        }
                                        className="hidden"
                                      />
                                      <span className="text-slate-600 dark:text-slate-300">
                                        Rotatable
                                      </span>
                                    </label>
                                  )}

                                  {/* Resizable (Only if Transformable) */}
                                  {f.isTransformable && (
                                    <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                                      <div
                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.isResizable ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400"}`}
                                      >
                                        {f.isResizable && (
                                          <svg
                                            className="w-2.5 h-2.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={3}
                                              d="M5 13l4 4L19 7"
                                            />
                                          </svg>
                                        )}
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={!!f.isResizable}
                                        onChange={(e) =>
                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  isResizable:
                                                    e.target.checked,
                                                }
                                                : fn,
                                            ),
                                          )
                                        }
                                        className="hidden"
                                      />
                                      <span className="text-slate-600 dark:text-slate-300">
                                        Resizable
                                      </span>
                                    </label>
                                  )}

                                  {/* Pivot Enabled (Only if Transformable) */}
                                  {f.isTransformable && (
                                    <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                                      <div
                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.isPivotEnabled ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400"}`}
                                      >
                                        {f.isPivotEnabled && (
                                          <svg
                                            className="w-2.5 h-2.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={3}
                                              d="M5 13l4 4L19 7"
                                            />
                                          </svg>
                                        )}
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={!!f.isPivotEnabled}
                                        onChange={(e) =>
                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  isPivotEnabled:
                                                    e.target.checked,
                                                }
                                                : fn,
                                            ),
                                          )
                                        }
                                        className="hidden"
                                      />
                                      <span className="text-slate-600 dark:text-slate-300">
                                        Pivot Enabled
                                      </span>
                                    </label>
                                  )}

                                  {f.type === "point" && (
                                    <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                                      <div
                                        className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.showPoint !== false ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400"}`}
                                      >
                                        {f.showPoint !== false && (
                                          <svg
                                            className="w-2.5 h-2.5"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={3}
                                              d="M5 13l4 4L19 7"
                                            />
                                          </svg>
                                        )}
                                      </div>
                                      <input
                                        type="checkbox"
                                        checked={f.showPoint !== false}
                                        onChange={(e) =>
                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  showPoint: e.target.checked,
                                                }
                                                : fn,
                                            ),
                                          )
                                        }
                                        className="hidden"
                                      />
                                      <span className="text-slate-600 dark:text-slate-300">
                                        Show Point
                                      </span>
                                    </label>
                                  )}

                                  {/* Show Label */}
                                  <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                                    <div
                                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.showLabel ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400"}`}
                                    >
                                      {f.showLabel && (
                                        <svg
                                          className="w-2.5 h-2.5"
                                          fill="none"
                                          viewBox="0 0 24 24"
                                          stroke="currentColor"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={3}
                                            d="M5 13l4 4L19 7"
                                          />
                                        </svg>
                                      )}
                                    </div>
                                    <input
                                      type="checkbox"
                                      checked={!!f.showLabel}
                                      onChange={(e) =>
                                        setFunctions((prev) =>
                                          prev.map((fn) =>
                                            fn.id === f.id
                                              ? {
                                                ...fn,
                                                showLabel: e.target.checked,
                                                label: e.target.checked && !fn.label ? (fn.latex || fn.expr || "") : fn.label,
                                              }
                                              : fn,
                                          ),
                                        )
                                      }
                                      className="hidden"
                                    />
                                    <span className="text-slate-600 dark:text-slate-300">
                                      Show Label
                                    </span>
                                  </label>
                                </div>

                                {f.showLabel && (
                                  <>
                                    <div className="flex w-full mt-2 mb-1 gap-1.5 items-stretch group/label">
                                      <div className="flex-1 min-w-0">
                                        <LabelInput
                                          value={f.label || ""}
                                          onChange={(val) =>
                                            setFunctions((prev) =>
                                              prev.map((fn) =>
                                                fn.id === f.id
                                                  ? { ...fn, label: val }
                                                  : fn,
                                              ),
                                            )
                                          }
                                          placeholder="Text or LaTeX (e.g. A_1)"
                                        />
                                      </div>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  label: fn.latex || fn.expr || "",
                                                }
                                                : fn,
                                            ),
                                          );
                                        }}
                                        title="Inject current equation"
                                        className="shrink-0 flex items-center justify-center w-8 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md border border-slate-200 dark:border-transparent transition-colors opacity-70 hover:opacity-100"
                                      >
                                        <FunctionSquare className="w-4 h-4" strokeWidth={2} />
                                      </button>
                                    </div>

                                    {/* Label Settings Panel */}
                                    <div className="flex flex-col gap-2 mt-2 p-2 rounded-lg bg-slate-100/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800/80">
                                      <div className="text-[10px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500 mb-0.5 flex justify-between items-center">
                                        <span>Label Settings</span>
                                        <label className="flex items-center gap-1.5 cursor-pointer group/cb lowercase" title="Show a point at the label anchor">
                                          <div className="relative flex items-center justify-center">
                                            <input
                                              type="checkbox"
                                              checked={!!f.showLabelPoint}
                                              onChange={(e) =>
                                                setFunctions((prev) =>
                                                  prev.map((fn) =>
                                                    fn.id === f.id
                                                      ? { ...fn, showLabelPoint: e.target.checked }
                                                      : fn
                                                  )
                                                )
                                              }
                                              className="peer sr-only"
                                            />
                                            <div
                                              className={`w-3 h-3 rounded-[3px] border flex items-center justify-center transition-colors ${f.showLabelPoint ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400 dark:group-hover/cb:border-slate-500"}`}
                                            >
                                              {f.showLabelPoint && (
                                                <svg className="w-2 h-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3.5}>
                                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                                </svg>
                                              )}
                                            </div>
                                          </div>
                                          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium normal-case group-hover/cb:text-slate-700 dark:group-hover/cb:text-slate-300 transition-colors">
                                            Show Point
                                          </span>
                                        </label>
                                      </div>

                                      {/* Rotation Slider */}
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Rotation: {f.labelRotation ?? 0}°</span>
                                        <div className="flex items-center gap-1.5 flex-1 max-w-[130px]">
                                          <input
                                            type="range"
                                            min="0"
                                            max="360"
                                            value={f.labelRotation ?? 0}
                                            onChange={(e) => {
                                              const r = parseInt(e.target.value, 10);
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelRotation: r } : fn
                                                )
                                              );
                                            }}
                                            className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                          />
                                        </div>
                                      </div>

                                      {/* Scale Slider */}
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Scale: {(f.labelScale ?? 1.0).toFixed(1)}x</span>
                                        <div className="flex items-center gap-1.5 flex-1 max-w-[130px]">
                                          <input
                                            type="range"
                                            min="0.5"
                                            max="3.0"
                                            step="0.1"
                                            value={f.labelScale ?? 1.0}
                                            onChange={(e) => {
                                              const s = parseFloat(e.target.value);
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelScale: s } : fn
                                                )
                                              );
                                            }}
                                            className="w-full h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
                                          />
                                        </div>
                                      </div>

                                      {/* Flips */}
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[11px] text-slate-500 dark:text-slate-400">Flip:</span>
                                        <div className="flex gap-1.5">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelFlipX: !fn.labelFlipX } : fn
                                                )
                                              );
                                            }}
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${f.labelFlipX
                                              ? "bg-blue-100 border-blue-300 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
                                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                                              }`}
                                          >
                                            Flip X
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelFlipY: !fn.labelFlipY } : fn
                                                )
                                              );
                                            }}
                                            className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors border ${f.labelFlipY
                                              ? "bg-blue-100 border-blue-300 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
                                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50"
                                              }`}
                                          >
                                            Flip Y
                                          </button>
                                        </div>
                                      </div>

                                      {/* Quick Presets */}
                                      <div className="flex flex-col gap-1 mt-1 pt-1.5 border-t border-slate-200/50 dark:border-slate-700/50">
                                        <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-0.5">Quick Presets</span>

                                        <div className="flex flex-wrap gap-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id
                                                    ? {
                                                      ...fn,
                                                      labelRotation: 0,
                                                      labelScale: 1.0,
                                                      labelFlipX: false,
                                                      labelFlipY: false,
                                                      labelPosition: [0.3, 0.3],
                                                      labelAlignment: undefined,
                                                    }
                                                    : fn
                                                )
                                              );
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-500 hover:border-red-200 dark:hover:bg-red-950/20 dark:hover:text-red-400 transition-colors"
                                            title="Reset label settings and position"
                                          >
                                            Reset
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelRotation: 90 } : fn
                                                )
                                              );
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                          >
                                            90°
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelRotation: 180 } : fn
                                                )
                                              );
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                          >
                                            180°
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelRotation: 270 } : fn
                                                )
                                              );
                                            }}
                                            className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                                          >
                                            270°
                                          </button>
                                        </div>

                                        <div className="flex flex-wrap gap-1 mt-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelAlignment: "center" } : fn
                                                )
                                              );
                                            }}
                                            className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${f.labelAlignment === "center"
                                              ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
                                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                              }`}
                                            title="Center label exactly on shape"
                                          >
                                            Center
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelAlignment: "above" } : fn
                                                )
                                              );
                                            }}
                                            className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${f.labelAlignment === "above"
                                              ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
                                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                              }`}
                                            title="Snap label above shape"
                                          >
                                            Above
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelAlignment: "below" } : fn
                                                )
                                              );
                                            }}
                                            className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${f.labelAlignment === "below"
                                              ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
                                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                              }`}
                                            title="Snap label below shape"
                                          >
                                            Below
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelAlignment: "left" } : fn
                                                )
                                              );
                                            }}
                                            className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${f.labelAlignment === "left"
                                              ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
                                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                              }`}
                                            title="Snap label to left"
                                          >
                                            Left
                                          </button>

                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id ? { ...fn, labelAlignment: "right" } : fn
                                                )
                                              );
                                            }}
                                            className={`px-1.5 py-0.5 rounded border text-[10px] transition-colors ${f.labelAlignment === "right"
                                              ? "bg-blue-50 border-blue-200 text-blue-600 dark:bg-blue-900/30 dark:border-blue-800 dark:text-blue-400"
                                              : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50"
                                              }`}
                                            title="Snap label to right"
                                          >
                                            Right
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </>
                                )}

                                {/* Custom Timeline Settings */}
                                <div className="flex flex-col gap-2.5 mt-1 pb-1.5 border-t border-slate-200 dark:border-slate-800/80 pt-2.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold tracking-wider uppercase text-slate-400 dark:text-slate-500">
                                      Individual Timeline
                                    </span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs text-slate-600 dark:text-slate-300 font-medium select-none">
                                        Enable
                                      </span>
                                      <button
                                        type="button"
                                        role="switch"
                                        aria-checked={!!f.hasCustomTimeline}
                                        onClick={() => {
                                          const checked = !f.hasCustomTimeline;
                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  hasCustomTimeline: checked,
                                                  time: checked
                                                    ? fn.time !== undefined
                                                      ? fn.time
                                                      : 0
                                                    : undefined,
                                                  isPlaying: checked
                                                    ? fn.isPlaying !==
                                                      undefined
                                                      ? fn.isPlaying
                                                      : true
                                                    : undefined,
                                                  timeMin: checked
                                                    ? fn.timeMin !== undefined
                                                      ? fn.timeMin
                                                      : 0
                                                    : undefined,
                                                  timeMax: checked
                                                    ? fn.timeMax !== undefined
                                                      ? fn.timeMax
                                                      : 10
                                                    : undefined,
                                                  timeSpeed: checked
                                                    ? fn.timeSpeed !==
                                                      undefined
                                                      ? fn.timeSpeed
                                                      : 1
                                                    : undefined,
                                                  timeMode: checked
                                                    ? fn.timeMode || "loop"
                                                    : undefined,
                                                  direction: checked
                                                    ? fn.direction !==
                                                      undefined
                                                      ? fn.direction
                                                      : 1
                                                    : undefined,
                                                }
                                                : fn,
                                            ),
                                          );
                                        }}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${f.hasCustomTimeline
                                          ? "bg-blue-500"
                                          : "bg-slate-200 dark:bg-slate-700"
                                          }`}
                                      >
                                        <span
                                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${f.hasCustomTimeline
                                            ? "translate-x-4"
                                            : "translate-x-0"
                                            }`}
                                        />
                                      </button>
                                    </div>
                                  </div>

                                  {f.hasCustomTimeline &&
                                    (() => {
                                      const fnIndex =
                                        functions.findIndex(
                                          (fn) => fn.id === f.id,
                                        ) + 1;
                                      const fnNameMatch =
                                        f.name?.match(/^([a-zA-Z0-9_]+)/);
                                      const fnCleanName = fnNameMatch
                                        ? fnNameMatch[1]
                                        : null;

                                      return (
                                        <div className="flex flex-col gap-3 bg-slate-50 dark:bg-slate-900/40 p-3 rounded-lg border border-slate-200 dark:border-slate-800 animate-fadeIn shadow-xs">
                                          {/* Playback Controls & Time Display */}
                                          <div className="flex items-center justify-between gap-2 bg-white dark:bg-slate-850 p-2 rounded-md border border-slate-200 dark:border-slate-750/50">
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setFunctions((prev) =>
                                                  prev.map((fn) =>
                                                    fn.id === f.id
                                                      ? {
                                                        ...fn,
                                                        isPlaying:
                                                          !fn.isPlaying,
                                                      }
                                                      : fn,
                                                  ),
                                                );
                                              }}
                                              className={`p-1.5 rounded text-white font-medium transition-all flex items-center justify-center active:scale-95 ${f.isPlaying
                                                ? "bg-amber-500 hover:bg-amber-600 shadow-xs shadow-amber-500/10"
                                                : "bg-emerald-500 hover:bg-emerald-600 shadow-xs shadow-emerald-500/10"
                                                }`}
                                              title={
                                                f.isPlaying
                                                  ? "Pause Timeline"
                                                  : "Play Timeline"
                                              }
                                            >
                                              {f.isPlaying ? (
                                                <Pause
                                                  size={12}
                                                  fill="currentColor"
                                                />
                                              ) : (
                                                <Play
                                                  size={12}
                                                  fill="currentColor"
                                                />
                                              )}
                                            </button>

                                            <div className="flex items-center gap-1.5">
                                              <span className="text-slate-400 dark:text-slate-500 font-mono text-[11px] font-medium">
                                                t =
                                              </span>
                                              <input
                                                type="number"
                                                step="0.01"
                                                value={
                                                  f.time !== undefined
                                                    ? Number(f.time.toFixed(3))
                                                    : 0
                                                }
                                                onChange={(e) => {
                                                  const val =
                                                    parseFloat(
                                                      e.target.value,
                                                    ) || 0;
                                                  setFunctions((prev) =>
                                                    prev.map((fn) =>
                                                      fn.id === f.id
                                                        ? { ...fn, time: val }
                                                        : fn,
                                                    ),
                                                  );
                                                }}
                                                className="w-16 bg-slate-50 dark:bg-slate-800 text-center px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-800 dark:text-slate-100 outline-none focus:border-blue-500"
                                              />
                                            </div>

                                            <button
                                              type="button"
                                              onClick={() => {
                                                setFunctions((prev) =>
                                                  prev.map((fn) =>
                                                    fn.id === f.id
                                                      ? {
                                                        ...fn,
                                                        time:
                                                          fn.timeMin !==
                                                            undefined
                                                            ? fn.timeMin
                                                            : 0,
                                                        direction: 1,
                                                      }
                                                      : fn,
                                                  ),
                                                );
                                              }}
                                              className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors flex items-center justify-center"
                                              title="Reset to Min"
                                            >
                                              <RotateCcw size={12} />
                                            </button>
                                          </div>

                                          {/* Min & Max Limits */}
                                          <div className="grid grid-cols-2 gap-2.5">
                                            <div className="flex flex-col gap-1">
                                              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                Min
                                              </span>
                                              <input
                                                type="number"
                                                step="0.1"
                                                value={
                                                  f.timeMin !== undefined
                                                    ? f.timeMin
                                                    : 0
                                                }
                                                onChange={(e) => {
                                                  const val =
                                                    parseFloat(
                                                      e.target.value,
                                                    ) || 0;
                                                  setFunctions((prev) =>
                                                    prev.map((fn) =>
                                                      fn.id === f.id
                                                        ? {
                                                          ...fn,
                                                          timeMin: val,
                                                        }
                                                        : fn,
                                                    ),
                                                  );
                                                }}
                                                className="w-full bg-white dark:bg-slate-800 text-center px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-850 dark:text-slate-100 outline-none focus:border-blue-500"
                                              />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                Max
                                              </span>
                                              <input
                                                type="number"
                                                step="0.1"
                                                value={
                                                  f.timeMax !== undefined
                                                    ? f.timeMax
                                                    : 10
                                                }
                                                onChange={(e) => {
                                                  const val =
                                                    parseFloat(
                                                      e.target.value,
                                                    ) || 0;
                                                  setFunctions((prev) =>
                                                    prev.map((fn) =>
                                                      fn.id === f.id
                                                        ? {
                                                          ...fn,
                                                          timeMax: val,
                                                        }
                                                        : fn,
                                                    ),
                                                  );
                                                }}
                                                className="w-full bg-white dark:bg-slate-800 text-center px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-850 dark:text-slate-100 outline-none focus:border-blue-500"
                                              />
                                            </div>
                                          </div>

                                          {/* Speed & Mode */}
                                          <div className="grid grid-cols-2 gap-2.5">
                                            <div className="flex flex-col gap-1">
                                              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                Speed
                                              </span>
                                              <input
                                                type="number"
                                                step="0.1"
                                                value={
                                                  f.timeSpeed !== undefined
                                                    ? f.timeSpeed
                                                    : 1
                                                }
                                                onChange={(e) => {
                                                  const val =
                                                    parseFloat(
                                                      e.target.value,
                                                    ) || 0;
                                                  setFunctions((prev) =>
                                                    prev.map((fn) =>
                                                      fn.id === f.id
                                                        ? {
                                                          ...fn,
                                                          timeSpeed: val,
                                                        }
                                                        : fn,
                                                    ),
                                                  );
                                                }}
                                                className="w-full bg-white dark:bg-slate-800 text-center px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-850 dark:text-slate-100 outline-none focus:border-blue-500"
                                              />
                                            </div>
                                            <div className="flex flex-col gap-1">
                                              <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                Mode
                                              </span>
                                              <select
                                                value={f.timeMode || "loop"}
                                                onChange={(e) => {
                                                  const val = e.target
                                                    .value as any;
                                                  setFunctions((prev) =>
                                                    prev.map((fn) =>
                                                      fn.id === f.id
                                                        ? {
                                                          ...fn,
                                                          timeMode: val,
                                                        }
                                                        : fn,
                                                    ),
                                                  );
                                                }}
                                                className="w-full bg-white dark:bg-slate-800 text-center px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-xs text-slate-850 dark:text-slate-100 outline-none focus:border-blue-500 cursor-pointer"
                                              >
                                                <option value="loop">
                                                  Loop
                                                </option>
                                                <option value="bounce">
                                                  Bounce
                                                </option>
                                                <option value="continuous">
                                                  Continuous
                                                </option>
                                              </select>
                                            </div>
                                          </div>

                                          {/* Predefined Variables Copy Box */}
                                          <div className="mt-1.5 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100/80 dark:border-blue-900/40 p-2.5 rounded-lg flex flex-col gap-1.5">
                                            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 flex items-center gap-1">
                                              <Sparkles
                                                size={11}
                                                className="text-blue-500 dark:text-blue-400"
                                              />{" "}
                                              Referencing this Timeline
                                            </span>
                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                              Type these variables into math
                                              formulas to read this specific
                                              timeline:
                                            </p>
                                            <div className="flex flex-col gap-1.5 mt-0.5">
                                              {(() => {
                                                const copyId = `${f.id}-t`;
                                                const isCopied =
                                                  copiedVarId === copyId;
                                                return (
                                                  <div
                                                    className={`flex items-center justify-between px-2 py-1 rounded border shadow-2xs cursor-pointer transition-all ${isCopied
                                                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                                                      : "bg-white dark:bg-slate-800/80 border-blue-100 dark:border-blue-900 hover:border-blue-300 dark:hover:border-blue-700"
                                                      }`}
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(
                                                        "t",
                                                      );
                                                      setCopiedVarId(copyId);
                                                      setTimeout(
                                                        () =>
                                                          setCopiedVarId(null),
                                                        1500,
                                                      );
                                                    }}
                                                    title="Click to copy 't'"
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <code
                                                        className={`text-[10px] font-mono px-1 py-0.5 rounded font-bold transition-colors ${isCopied
                                                          ? "bg-emerald-100/50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                                                          : "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                                                          }`}
                                                      >
                                                        t
                                                      </code>
                                                      <span className="text-[9px] text-slate-500 dark:text-slate-400">
                                                        Inside this function
                                                      </span>
                                                      {isCopied && (
                                                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium animate-fadeIn">
                                                          Copied!
                                                        </span>
                                                      )}
                                                    </div>
                                                    {isCopied ? (
                                                      <Check
                                                        size={11}
                                                        className="text-emerald-500 dark:text-emerald-400"
                                                      />
                                                    ) : (
                                                      <Copy
                                                        size={10}
                                                        className="text-blue-500 dark:text-blue-400"
                                                      />
                                                    )}
                                                  </div>
                                                );
                                              })()}

                                              {(() => {
                                                const copyId = `${f.id}-t_${fnIndex}`;
                                                const isCopied =
                                                  copiedVarId === copyId;
                                                return (
                                                  <div
                                                    className={`flex items-center justify-between px-2 py-1 rounded border shadow-2xs cursor-pointer transition-all ${isCopied
                                                      ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                                                      : "bg-white dark:bg-slate-800/80 border-blue-100 dark:border-blue-900 hover:border-blue-300 dark:hover:border-blue-700"
                                                      }`}
                                                    onClick={() => {
                                                      navigator.clipboard.writeText(
                                                        `t_${fnIndex}`,
                                                      );
                                                      setCopiedVarId(copyId);
                                                      setTimeout(
                                                        () =>
                                                          setCopiedVarId(null),
                                                        1500,
                                                      );
                                                    }}
                                                    title={`Click to copy 't_${fnIndex}'`}
                                                  >
                                                    <div className="flex items-center gap-1.5">
                                                      <code
                                                        className={`text-[10px] font-mono px-1 py-0.5 rounded font-bold transition-colors ${isCopied
                                                          ? "bg-emerald-100/50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                                                          : "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                                                          }`}
                                                      >{`t_${fnIndex}`}</code>
                                                      <span className="text-[9px] text-slate-500 dark:text-slate-400">
                                                        Any function in
                                                        workspace
                                                      </span>
                                                      {isCopied && (
                                                        <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium animate-fadeIn">
                                                          Copied!
                                                        </span>
                                                      )}
                                                    </div>
                                                    {isCopied ? (
                                                      <Check
                                                        size={11}
                                                        className="text-emerald-500 dark:text-emerald-400"
                                                      />
                                                    ) : (
                                                      <Copy
                                                        size={10}
                                                        className="text-blue-500 dark:text-blue-400"
                                                      />
                                                    )}
                                                  </div>
                                                );
                                              })()}

                                              {fnCleanName &&
                                                fnCleanName !== "t" &&
                                                fnCleanName !== "time" &&
                                                (() => {
                                                  const copyId = `${f.id}-t_${fnCleanName}`;
                                                  const isCopied =
                                                    copiedVarId === copyId;
                                                  return (
                                                    <div
                                                      className={`flex items-center justify-between px-2 py-1 rounded border shadow-2xs cursor-pointer transition-all ${isCopied
                                                        ? "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800"
                                                        : "bg-white dark:bg-slate-800/80 border-blue-100 dark:border-blue-900 hover:border-blue-300 dark:hover:border-blue-700"
                                                        }`}
                                                      onClick={() => {
                                                        navigator.clipboard.writeText(
                                                          `t_${fnCleanName}`,
                                                        );
                                                        setCopiedVarId(copyId);
                                                        setTimeout(
                                                          () =>
                                                            setCopiedVarId(
                                                              null,
                                                            ),
                                                          1500,
                                                        );
                                                      }}
                                                      title={`Click to copy 't_${fnCleanName}'`}
                                                    >
                                                      <div className="flex items-center gap-1.5">
                                                        <code
                                                          className={`text-[10px] font-mono px-1 py-0.5 rounded font-bold transition-colors ${isCopied
                                                            ? "bg-emerald-100/50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400"
                                                            : "bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400"
                                                            }`}
                                                        >{`t_${fnCleanName}`}</code>
                                                        <span className="text-[9px] text-slate-500 dark:text-slate-400">
                                                          Any function in
                                                          workspace
                                                        </span>
                                                        {isCopied && (
                                                          <span className="text-[9px] text-emerald-600 dark:text-emerald-400 font-medium animate-fadeIn">
                                                            Copied!
                                                          </span>
                                                        )}
                                                      </div>
                                                      {isCopied ? (
                                                        <Check
                                                          size={11}
                                                          className="text-emerald-500 dark:text-emerald-400"
                                                        />
                                                      ) : (
                                                        <Copy
                                                          size={10}
                                                          className="text-blue-500 dark:text-blue-400"
                                                        />
                                                      )}
                                                    </div>
                                                  );
                                                })()}
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                </div>

                                <div className="flex items-center justify-between mt-1 p-2 border border-blue-500/10 bg-blue-500/5 dark:bg-blue-500/5 rounded">
                                  <span className="text-slate-600 dark:text-slate-400 text-[10px] font-semibold tracking-wide">
                                    Change Origin [h, k]
                                  </span>
                                  <div className="flex gap-1.5 flex-1 max-w-[100px]">
                                    <input
                                      title="h (shift for x-axis)"
                                      type="number"
                                      step="1"
                                      value={f.transformTranslate?.[0] || 0}
                                      onChange={(e) =>
                                        setFunctions((prev) =>
                                          prev.map((fn) =>
                                            fn.id === f.id
                                              ? {
                                                ...fn,
                                                transformTranslate: [
                                                  parseFloat(
                                                    e.target.value,
                                                  ) || 0,
                                                  fn
                                                    .transformTranslate?.[1] ||
                                                  0,
                                                ],
                                              }
                                              : fn,
                                          ),
                                        )
                                      }
                                      className="w-full bg-white dark:bg-slate-800 text-center px-1 py-0.5 rounded outline-none border border-slate-300 dark:border-slate-600 focus:border-blue-500 transition-colors text-[10px] text-slate-700 dark:text-slate-200 font-mono"
                                      placeholder="h"
                                    />
                                    <input
                                      title="k (shift for y-axis)"
                                      type="number"
                                      step="1"
                                      value={f.transformTranslate?.[1] || 0}
                                      onChange={(e) =>
                                        setFunctions((prev) =>
                                          prev.map((fn) =>
                                            fn.id === f.id
                                              ? {
                                                ...fn,
                                                transformTranslate: [
                                                  fn
                                                    .transformTranslate?.[0] ||
                                                  0,
                                                  parseFloat(
                                                    e.target.value,
                                                  ) || 0,
                                                ],
                                              }
                                              : fn,
                                          ),
                                        )
                                      }
                                      className="w-full bg-white dark:bg-slate-800 text-center px-1 py-0.5 rounded outline-none border border-slate-300 dark:border-slate-600 focus:border-blue-500 transition-colors text-[10px] text-slate-700 dark:text-slate-200 font-mono"
                                      placeholder="k"
                                    />
                                  </div>
                                </div>

                                {/* Numeric Transform Inputs */}
                                {f.isTransformable && (
                                  <div className="flex flex-col gap-1.5 mt-3 p-2 border border-blue-500/20 bg-blue-500/5 dark:bg-blue-500/10 rounded">
                                    <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1 flex items-center justify-between">
                                      <span className="text-xs">
                                        Transform Data
                                      </span>
                                      <button
                                        onClick={() =>
                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  transformScale: [1, 1],
                                                  transformRotate: 0,
                                                  transformTranslate: [0, 0],
                                                }
                                                : fn,
                                            ),
                                          )
                                        }
                                        className="text-[9px] hover:text-blue-500 bg-white/50 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 hover:border-blue-400 transition-colors"
                                      >
                                        Reset
                                      </button>
                                    </div>

                                    {f.isRotatable && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-600 dark:text-slate-400 text-xs">
                                          Rotation (deg)
                                        </span>
                                        <input
                                          type="number"
                                          value={Math.round(
                                            ((f.transformRotate || 0) * 180) /
                                            Math.PI,
                                          )}
                                          onChange={(e) =>
                                            setFunctions((prev) =>
                                              prev.map((fn) =>
                                                fn.id === f.id
                                                  ? {
                                                    ...fn,
                                                    transformRotate:
                                                      ((parseFloat(
                                                        e.target.value,
                                                      ) || 0) *
                                                        Math.PI) /
                                                      180,
                                                  }
                                                  : fn,
                                              ),
                                            )
                                          }
                                          className="w-16 bg-white dark:bg-slate-800 text-right px-1.5 py-0.5 rounded outline-none border border-slate-300 dark:border-slate-600 focus:border-blue-500 transition-colors text-xs text-slate-700 dark:text-slate-200"
                                        />
                                      </div>
                                    )}

                                    {f.isResizable && (
                                      <div className="flex items-center justify-between">
                                        <span className="text-slate-600 dark:text-slate-400 text-xs">
                                          Scale
                                        </span>
                                        <input
                                          type="number"
                                          step="0.1"
                                          value={(
                                            f.transformScale?.[0] || 1
                                          ).toFixed(2)}
                                          onChange={(e) =>
                                            setFunctions((prev) =>
                                              prev.map((fn) =>
                                                fn.id === f.id
                                                  ? {
                                                    ...fn,
                                                    transformScale: [
                                                      parseFloat(
                                                        e.target.value,
                                                      ) || 1,
                                                      parseFloat(
                                                        e.target.value,
                                                      ) || 1,
                                                    ],
                                                  }
                                                  : fn,
                                              ),
                                            )
                                          }
                                          className="w-16 bg-white dark:bg-slate-800 text-right px-1.5 py-0.5 rounded outline-none border border-slate-300 dark:border-slate-600 focus:border-blue-500 transition-colors text-xs text-slate-700 dark:text-slate-200"
                                        />
                                      </div>
                                    )}

                                    {f.isPivotEnabled && (
                                      <div className="flex items-center justify-between pt-1 mt-0.5 border-t border-blue-500/10">
                                        <span className="text-slate-600 dark:text-slate-400 text-xs">
                                          Pivot [X, Y]
                                        </span>
                                        <div className="flex gap-1.5">
                                          <input
                                            type="number"
                                            step="0.5"
                                            value={(
                                              f.transformPivot?.[0] || 0
                                            ).toFixed(1)}
                                            onChange={(e) =>
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id
                                                    ? {
                                                      ...fn,
                                                      transformPivot: [
                                                        parseFloat(
                                                          e.target.value,
                                                        ) || 0,
                                                        fn
                                                          .transformPivot?.[1] ||
                                                        0,
                                                      ],
                                                    }
                                                    : fn,
                                                ),
                                              )
                                            }
                                            className="w-[38px] bg-white dark:bg-slate-800 text-center px-1 py-0.5 rounded outline-none border border-slate-300 dark:border-slate-600 focus:border-blue-500 transition-colors text-[10px] text-slate-700 dark:text-slate-200 font-mono"
                                          />
                                          <input
                                            type="number"
                                            step="0.5"
                                            value={(
                                              f.transformPivot?.[1] || 0
                                            ).toFixed(1)}
                                            onChange={(e) =>
                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id
                                                    ? {
                                                      ...fn,
                                                      transformPivot: [
                                                        fn
                                                          .transformPivot?.[0] ||
                                                        0,
                                                        parseFloat(
                                                          e.target.value,
                                                        ) || 0,
                                                      ],
                                                    }
                                                    : fn,
                                                ),
                                              )
                                            }
                                            className="w-[38px] bg-white dark:bg-slate-800 text-center px-1 py-0.5 rounded outline-none border border-slate-300 dark:border-slate-600 focus:border-blue-500 transition-colors text-[10px] text-slate-700 dark:text-slate-200 font-mono"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              {/* Inequality Operator Control */}
                              {f.type === "inequality" && (
                                <div className="flex flex-col gap-1 pb-1">
                                  <span className="text-slate-500 dark:text-slate-400 font-semibold mb-0.5">
                                    Inequality Type:
                                  </span>
                                  <div className="flex border border-slate-200 dark:border-slate-700/60 rounded overflow-hidden">
                                    {["<", "<=", ">", ">="].map((op) => (
                                      <button
                                        key={op}
                                        onClick={() => {
                                          let currentOp = f.expr2 || "<=";
                                          let newExpr = f.expr;
                                          if (f.expr.includes(currentOp)) {
                                            const parts =
                                              f.expr.split(currentOp);
                                            newExpr = parts.join(op);
                                          } else if (
                                            f.expr.match(/(<=|>=|<|>)/)
                                          ) {
                                            newExpr = f.expr.replace(
                                              /(<=|>=|<|>)/,
                                              op,
                                            );
                                          }
                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  expr: newExpr,
                                                  expr2: op,
                                                  operator: op,
                                                }
                                                : fn,
                                            ),
                                          );
                                        }}
                                        className={`flex-1 py-1 px-2 font-mono text-[11px] font-bold transition-colors ${(f.expr2 || "<=") === op
                                          ? "bg-blue-500 text-white"
                                          : "bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                          } border-r border-slate-200 dark:border-slate-700/60 last:border-r-0`}
                                      >
                                        {op}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Outline/Stroke Color */}
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-slate-500 dark:text-slate-400 font-semibold">
                                    Outline Color:
                                  </span>
                                  <ReadableColorBadge color={f.color} />
                                </div>
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  {COLORS.map((c) => (
                                    <button
                                      key={c}
                                      type="button"
                                      onClick={() => {
                                        setFunctions((prev) =>
                                          prev.map((fn) =>
                                            fn.id === f.id
                                              ? { ...fn, color: c }
                                              : fn,
                                          ),
                                        );
                                        if (
                                          activeColorPickerFnId === f.id &&
                                          activeColorPickerType === "outline"
                                        ) {
                                          setActiveColorPickerFnId(null);
                                          setActiveColorPickerType(null);
                                          setActiveColorPickerTriggerEl(null);
                                        }
                                      }}
                                      className={`w-3.5 h-3.5 rounded-full border transition-transform ${f.color === c ? "scale-125 border-slate-700 dark:border-white shadow-sm" : "border-transparent hover:scale-110"}`}
                                      style={{ backgroundColor: c }}
                                      title={c}
                                    />
                                  ))}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      if (
                                        activeColorPickerFnId === f.id &&
                                        activeColorPickerType === "outline"
                                      ) {
                                        setActiveColorPickerFnId(null);
                                        setActiveColorPickerType(null);
                                        setActiveColorPickerTriggerEl(null);
                                      } else {
                                        setActiveColorPickerFnId(f.id);
                                        setActiveColorPickerType("outline");
                                        setActiveColorPickerTriggerEl(
                                          e.currentTarget,
                                        );
                                      }
                                    }}
                                    className={`w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer transition-all duration-200 ${activeColorPickerFnId === f.id &&
                                      activeColorPickerType === "outline"
                                      ? "ring-2 ring-blue-500 scale-115"
                                      : "hover:scale-110"
                                      }`}
                                    style={{
                                      background:
                                        "linear-gradient(45deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899)",
                                    }}
                                    title="Spectrum Color Picker"
                                  />
                                </div>

                                <PortalColorPicker
                                  isOpen={
                                    activeColorPickerFnId === f.id &&
                                    activeColorPickerType === "outline"
                                  }
                                  onClose={() => {
                                    setActiveColorPickerFnId(null);
                                    setActiveColorPickerType(null);
                                    setActiveColorPickerTriggerEl(null);
                                  }}
                                  color={f.color}
                                  onChange={(newColor) => {
                                    setFunctions((prev) =>
                                      prev.map((fn) =>
                                        fn.id === f.id
                                          ? { ...fn, color: newColor }
                                          : fn,
                                      ),
                                    );
                                  }}
                                  title="Custom Outline Color"
                                  triggerEl={activeColorPickerTriggerEl}
                                />
                              </div>

                              {f.type !== "point" && f.type !== "line" && (
                                <React.Fragment>
                                  <div className="border-t border-slate-200 dark:border-slate-800/60 my-0.5" />

                                  {/* Is Custom Fill Active */}
                                  <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500 dark:text-slate-400 font-semibold font-semibold">
                                        Fill Customization
                                      </span>
                                      <label className="flex items-center gap-1.5 cursor-pointer group/cb">
                                        <div
                                          className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-colors ${f.fillColor !== undefined ? "bg-blue-500 border-blue-500 text-white" : "border-slate-300 dark:border-slate-500 bg-slate-100 dark:bg-slate-800 group-hover/cb:border-slate-400"}`}
                                        >
                                          {f.fillColor !== undefined && (
                                            <svg
                                              className="w-2.5 h-2.5"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={3}
                                                d="M5 13l4 4L19 7"
                                              />
                                            </svg>
                                          )}
                                        </div>
                                        <input
                                          type="checkbox"
                                          checked={f.fillColor !== undefined}
                                          onChange={(e) => {
                                            setFunctions((prev) =>
                                              prev.map((fn) =>
                                                fn.id === f.id
                                                  ? {
                                                    ...fn,
                                                    fillColor: e.target
                                                      .checked
                                                      ? getHexWithAlpha(
                                                        f.color,
                                                        f.fillOpacity !==
                                                          undefined
                                                          ? f.fillOpacity
                                                          : 0.3,
                                                      )
                                                      : undefined,
                                                  }
                                                  : fn,
                                              ),
                                            );
                                            if (
                                              !e.target.checked &&
                                              activeColorPickerFnId === f.id &&
                                              activeColorPickerType === "fill"
                                            ) {
                                              setActiveColorPickerFnId(null);
                                              setActiveColorPickerType(null);
                                              setActiveColorPickerTriggerEl(
                                                null,
                                              );
                                            }
                                          }}
                                          className="hidden"
                                        />
                                        <span className="text-slate-550 dark:text-slate-400 pl-1 group-hover/cb:text-blue-500 dark:group-hover/cb:text-blue-400 select-none font-medium">
                                          Different Fill
                                        </span>
                                      </label>
                                    </div>

                                    {f.fillColor === undefined ? (
                                      <div className="text-[10px] text-slate-400 italic pl-1">
                                        {["inequality", "polygon"].includes(
                                          f.type,
                                        )
                                          ? "Using outline color for fill."
                                          : "Fill is disabled. Check 'Different Fill' to enable."}
                                      </div>
                                    ) : (
                                      <div className="flex flex-col gap-1.5 p-1.5 bg-slate-100/50 dark:bg-slate-900/30 rounded border border-slate-200 dark:border-slate-800">
                                        <div className="flex items-center justify-between">
                                          <span className="text-slate-400 font-medium">
                                            Fill Color Palette:
                                          </span>
                                          <ReadableColorBadge
                                            color={f.fillColor || f.color}
                                          />
                                        </div>
                                        <div className="flex flex-wrap gap-1.5 items-center">
                                          {COLORS.map((c) => (
                                            <button
                                              key={c}
                                              type="button"
                                              onClick={() => {
                                                const currentAlpha =
                                                  f.fillOpacity !== undefined
                                                    ? f.fillOpacity
                                                    : 0.3;
                                                const colorWithAlpha =
                                                  getHexWithAlpha(
                                                    c,
                                                    currentAlpha,
                                                  );
                                                setFunctions((prev) =>
                                                  prev.map((fn) =>
                                                    fn.id === f.id
                                                      ? {
                                                        ...fn,
                                                        fillColor:
                                                          colorWithAlpha,
                                                      }
                                                      : fn,
                                                  ),
                                                );
                                                if (
                                                  activeColorPickerFnId ===
                                                  f.id &&
                                                  activeColorPickerType ===
                                                  "fill"
                                                ) {
                                                  setActiveColorPickerFnId(
                                                    null,
                                                  );
                                                  setActiveColorPickerType(
                                                    null,
                                                  );
                                                  setActiveColorPickerTriggerEl(
                                                    null,
                                                  );
                                                }
                                              }}
                                              className={`w-3.5 h-3.5 rounded-full border transition-transform ${f.fillColor === c ? "scale-125 border-slate-700 dark:border-white shadow-sm" : "border-transparent hover:scale-110"}`}
                                              style={{ backgroundColor: c }}
                                              title={c}
                                            />
                                          ))}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              if (
                                                activeColorPickerFnId ===
                                                f.id &&
                                                activeColorPickerType === "fill"
                                              ) {
                                                setActiveColorPickerFnId(null);
                                                setActiveColorPickerType(null);
                                                setActiveColorPickerTriggerEl(
                                                  null,
                                                );
                                              } else {
                                                setActiveColorPickerFnId(f.id);
                                                setActiveColorPickerType(
                                                  "fill",
                                                );
                                                setActiveColorPickerTriggerEl(
                                                  e.currentTarget,
                                                );
                                              }
                                            }}
                                            className={`w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center cursor-pointer transition-all duration-200 ${activeColorPickerFnId === f.id &&
                                              activeColorPickerType === "fill"
                                              ? "ring-2 ring-blue-500 scale-115"
                                              : "hover:scale-110"
                                              }`}
                                            style={{
                                              background:
                                                "linear-gradient(45deg, #ef4444, #f97316, #eab308, #22c55e, #3b82f6, #a855f7, #ec4899)",
                                            }}
                                            title="Spectrum Fill Picker"
                                          />
                                        </div>

                                        <PortalColorPicker
                                          isOpen={
                                            activeColorPickerFnId === f.id &&
                                            activeColorPickerType === "fill"
                                          }
                                          onClose={() => {
                                            setActiveColorPickerFnId(null);
                                            setActiveColorPickerType(null);
                                            setActiveColorPickerTriggerEl(null);
                                          }}
                                          color={getHexWithAlpha(
                                            f.fillColor || f.color,
                                            f.fillOpacity !== undefined
                                              ? f.fillOpacity
                                              : 0.3,
                                          )}
                                          onChange={(newColor) => {
                                            let parsedAlpha =
                                              f.fillOpacity !== undefined
                                                ? f.fillOpacity
                                                : 0.3;
                                            if (
                                              newColor.startsWith("#") &&
                                              newColor.length === 9
                                            ) {
                                              const alphaHex = newColor.slice(
                                                7,
                                                9,
                                              );
                                              parsedAlpha =
                                                Math.round(
                                                  (parseInt(alphaHex, 16) /
                                                    255) *
                                                  100,
                                                ) / 100;
                                            } else if (
                                              newColor.startsWith("#") &&
                                              newColor.length === 7
                                            ) {
                                              parsedAlpha = 1.0;
                                            }
                                            setFunctions((prev) =>
                                              prev.map((fn) =>
                                                fn.id === f.id
                                                  ? {
                                                    ...fn,
                                                    fillColor: newColor,
                                                    fillOpacity: parsedAlpha,
                                                  }
                                                  : fn,
                                              ),
                                            );
                                          }}
                                          title="Custom Fill Color"
                                          triggerEl={activeColorPickerTriggerEl}
                                        />
                                      </div>
                                    )}
                                  </div>

                                  {/* Fill Opacity Slider */}
                                  <div className="flex flex-col gap-1 mt-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="text-slate-500 dark:text-slate-400 font-semibold">
                                        Fill Alpha (Transparency)
                                      </span>
                                      <span className="font-mono text-slate-500 dark:text-slate-400 text-[10px] font-semibold">
                                        {Math.round(
                                          (f.fillOpacity !== undefined
                                            ? f.fillOpacity
                                            : 0.3) * 100,
                                        )}
                                        %
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[9px] text-slate-400 font-mono">
                                        0.0
                                      </span>
                                      <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={
                                          f.fillOpacity !== undefined
                                            ? f.fillOpacity
                                            : 0.3
                                        }
                                        onChange={(e) => {
                                          const val = parseFloat(
                                            e.target.value,
                                          );
                                          setFunctions((prev) =>
                                            prev.map((fn) => {
                                              if (fn.id === f.id) {
                                                const baseColor =
                                                  fn.fillColor || fn.color;
                                                const updatedColor =
                                                  getHexWithAlpha(
                                                    baseColor,
                                                    val,
                                                  );
                                                return {
                                                  ...fn,
                                                  fillOpacity: val,
                                                  fillColor: updatedColor,
                                                };
                                              }
                                              return fn;
                                            }),
                                          );
                                        }}
                                        className="h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 flex-1 outline-none text-blue-500 dark:text-blue-400"
                                      />
                                      <span className="text-[9px] text-slate-400 font-mono">
                                        1.0
                                      </span>
                                    </div>
                                  </div>

                                  {/* Pattern Style Selection (For Regions) */}
                                  {(f.type === "inequality" ||
                                    f.type === "implicit" ||
                                    f.type === "function" ||
                                    f.type === "parametric" ||
                                    f.type === "polar" ||
                                    f.type === "polygon") && (
                                      <div className="flex flex-col gap-2 mt-2 pt-2 border-t border-slate-200 dark:border-slate-800/60">
                                        <span className="text-slate-550 dark:text-slate-400 font-semibold mb-0.5">
                                          Region Style
                                        </span>
                                        <div className="grid grid-cols-4 gap-1.5">
                                          {(
                                            [
                                              { value: "solid", label: "Solid" },
                                              {
                                                value: "hatch-diagonal",
                                                label: "Diagonal",
                                              },
                                              {
                                                value: "hatch-reverse",
                                                label: "Reverse",
                                              },
                                              {
                                                value: "hatch-cross",
                                                label: "Cross",
                                              },
                                              {
                                                value: "dotted",
                                                label: "Dotted",
                                              },
                                              { value: "grid", label: "Grid" },
                                              {
                                                value: "dashed",
                                                label: "Dashed",
                                              },
                                              {
                                                value: "math-region",
                                                label: "Math",
                                              },
                                            ] as const
                                          ).map((style) => {
                                            const isSelected =
                                              (f.fillPattern ||
                                                "hatch-diagonal") === style.value;
                                            const pCol =
                                              f.fillColor || f.color || "#3b82f6";
                                            const op = f.fillOpacity ?? 0.65;
                                            const pId = `preview-${f.id}-${style.value}`;
                                            const pt = f.patternThickness || 2;
                                            const ps = f.patternSpacing || 15;

                                            // Scale down the preview pattern to fit nicely in the button
                                            // Default pSize is 15. We can render standard 15 size and let it tile in the 24x24 box.
                                            const previewScale =
                                              style.value === "math-region"
                                                ? 0.75
                                                : 0.6;
                                            const pSize = ps;

                                            return (
                                              <button
                                                key={style.value}
                                                type="button"
                                                onClick={() => {
                                                  setFunctions((prev) =>
                                                    prev.map((fn) =>
                                                      fn.id === f.id
                                                        ? {
                                                          ...fn,
                                                          fillPattern:
                                                            style.value,
                                                        }
                                                        : fn,
                                                    ),
                                                  );
                                                }}
                                                className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded transition-all select-none border ${isSelected
                                                  ? "bg-blue-500/10 border-blue-500/50 text-blue-600 dark:text-blue-400"
                                                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-blue-400/50 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                                                  }`}
                                                title={style.label}
                                              >
                                                <div className="h-6 w-10 mt-0.5 mb-1 rounded-[3px] border border-slate-200/50 dark:border-slate-700/50 overflow-hidden flex items-center justify-center bg-white dark:bg-slate-900/50">
                                                  <svg
                                                    width="100%"
                                                    height="100%"
                                                    xmlns="http://www.w3.org/2000/svg"
                                                  >
                                                    <defs>
                                                      {style.value !==
                                                        "solid" && (
                                                          <pattern
                                                            id={pId}
                                                            width={pSize}
                                                            height={pSize}
                                                            patternUnits="userSpaceOnUse"
                                                            patternTransform={`scale(${previewScale})`}
                                                          >
                                                            {style.value ===
                                                              "hatch-diagonal" && (
                                                                <React.Fragment>
                                                                  <line
                                                                    x1={0}
                                                                    y1={pSize}
                                                                    x2={pSize}
                                                                    y2={0}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                  <line
                                                                    x1={-1}
                                                                    y1={1}
                                                                    x2={1}
                                                                    y2={-1}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                  <line
                                                                    x1={pSize - 1}
                                                                    y1={pSize + 1}
                                                                    x2={pSize + 1}
                                                                    y2={pSize - 1}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                </React.Fragment>
                                                              )}
                                                            {style.value ===
                                                              "hatch-reverse" && (
                                                                <React.Fragment>
                                                                  <line
                                                                    x1={0}
                                                                    y1={0}
                                                                    x2={pSize}
                                                                    y2={pSize}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                  <line
                                                                    x1={-1}
                                                                    y1={pSize - 1}
                                                                    x2={1}
                                                                    y2={pSize + 1}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                  <line
                                                                    x1={pSize - 1}
                                                                    y1={-1}
                                                                    x2={pSize + 1}
                                                                    y2={1}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                </React.Fragment>
                                                              )}
                                                            {style.value ===
                                                              "hatch-cross" && (
                                                                <React.Fragment>
                                                                  <line
                                                                    x1={0}
                                                                    y1={pSize}
                                                                    x2={pSize}
                                                                    y2={0}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                  <line
                                                                    x1={0}
                                                                    y1={0}
                                                                    x2={pSize}
                                                                    y2={pSize}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                  <line
                                                                    x1={-1}
                                                                    y1={1}
                                                                    x2={1}
                                                                    y2={-1}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                  <line
                                                                    x1={pSize - 1}
                                                                    y1={pSize + 1}
                                                                    x2={pSize + 1}
                                                                    y2={pSize - 1}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                  <line
                                                                    x1={-1}
                                                                    y1={pSize - 1}
                                                                    x2={1}
                                                                    y2={pSize + 1}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                  <line
                                                                    x1={pSize - 1}
                                                                    y1={-1}
                                                                    x2={pSize + 1}
                                                                    y2={1}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                </React.Fragment>
                                                              )}
                                                            {style.value ===
                                                              "dotted" && (
                                                                <circle
                                                                  cx={pSize / 2}
                                                                  cy={pSize / 2}
                                                                  r={pt}
                                                                  fill={pCol}
                                                                  fillOpacity={op}
                                                                />
                                                              )}
                                                            {style.value ===
                                                              "grid" && (
                                                                <React.Fragment>
                                                                  <line
                                                                    x1={0}
                                                                    y1={0}
                                                                    x2={pSize}
                                                                    y2={0}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                  <line
                                                                    x1={0}
                                                                    y1={0}
                                                                    x2={0}
                                                                    y2={pSize}
                                                                    stroke={pCol}
                                                                    strokeWidth={pt}
                                                                    strokeOpacity={op}
                                                                  />
                                                                </React.Fragment>
                                                              )}
                                                            {style.value ===
                                                              "dashed" && (
                                                                <line
                                                                  x1={0}
                                                                  y1={pSize / 2}
                                                                  x2={pSize}
                                                                  y2={pSize / 2}
                                                                  stroke={pCol}
                                                                  strokeWidth={pt}
                                                                  strokeOpacity={op}
                                                                  strokeDasharray={`${Math.max(1, pSize / 2)},${Math.max(1, pSize / 2)}`}
                                                                />
                                                              )}
                                                            {style.value ===
                                                              "math-region" && (
                                                                <line
                                                                  x1={0}
                                                                  y1={pSize}
                                                                  x2={pSize}
                                                                  y2={0}
                                                                  stroke={pCol}
                                                                  strokeWidth={Math.max(
                                                                    1,
                                                                    pt * 0.5,
                                                                  )}
                                                                  strokeOpacity={Math.min(
                                                                    1,
                                                                    op * 1.5,
                                                                  )}
                                                                />
                                                              )}
                                                          </pattern>
                                                        )}
                                                    </defs>

                                                    {style.value === "solid" ? (
                                                      <rect
                                                        width="100%"
                                                        height="100%"
                                                        fill={pCol}
                                                        fillOpacity={op}
                                                      />
                                                    ) : (
                                                      <rect
                                                        width="100%"
                                                        height="100%"
                                                        fill={`url(#${pId})`}
                                                      />
                                                    )}
                                                  </svg>
                                                </div>
                                                <div className="text-[9px] font-semibold opacity-90">
                                                  {style.label}
                                                </div>
                                              </button>
                                            );
                                          })}
                                        </div>

                                        {/* Pattern Advanced Controls */}
                                        {(f.fillPattern || "hatch-diagonal") !==
                                          "solid" && (
                                            <div className="grid grid-cols-2 gap-3 mt-1.5 p-2 bg-slate-50 dark:bg-slate-900/40 rounded border border-slate-200 dark:border-slate-800">
                                              {/* Spacing */}
                                              <div className="flex flex-col gap-1">
                                                <div className="flex justify-between items-center text-[10px]">
                                                  <span className="text-slate-500 dark:text-slate-400">
                                                    Spacing
                                                  </span>
                                                  <span className="font-mono text-slate-400">
                                                    {f.patternSpacing || 15}
                                                  </span>
                                                </div>
                                                <input
                                                  type="range"
                                                  min="4"
                                                  max="40"
                                                  step="1"
                                                  value={f.patternSpacing || 15}
                                                  onChange={(e) =>
                                                    setFunctions((prev) =>
                                                      prev.map((fn) =>
                                                        fn.id === f.id
                                                          ? {
                                                            ...fn,
                                                            patternSpacing:
                                                              parseInt(
                                                                e.target.value,
                                                              ),
                                                          }
                                                          : fn,
                                                      ),
                                                    )
                                                  }
                                                  className="h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 outline-none"
                                                />
                                              </div>
                                              {/* Thickness */}
                                              <div className="flex flex-col gap-1">
                                                <div className="flex justify-between items-center text-[10px]">
                                                  <span className="text-slate-500 dark:text-slate-400">
                                                    Thickness
                                                  </span>
                                                  <span className="font-mono text-slate-400">
                                                    {f.patternThickness || 2}
                                                  </span>
                                                </div>
                                                <input
                                                  type="range"
                                                  min="1"
                                                  max="10"
                                                  step="0.5"
                                                  value={f.patternThickness || 2}
                                                  onChange={(e) =>
                                                    setFunctions((prev) =>
                                                      prev.map((fn) =>
                                                        fn.id === f.id
                                                          ? {
                                                            ...fn,
                                                            patternThickness:
                                                              parseFloat(
                                                                e.target.value,
                                                              ),
                                                          }
                                                          : fn,
                                                      ),
                                                    )
                                                  }
                                                  className="h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 outline-none"
                                                />
                                              </div>
                                            </div>
                                          )}
                                      </div>
                                    )}
                                </React.Fragment>
                              )}

                              {/* Line Style Selection */}
                              {f.type !== "point" && (
                                <div className="flex flex-col gap-1 mt-1 pb-1 border-t border-slate-200 dark:border-slate-800/60 pt-2">
                                  <span className="text-slate-550 dark:text-slate-400 font-semibold mb-1">
                                    Line Style
                                  </span>
                                  <div className="grid grid-cols-4 gap-1.5 mt-0.5">
                                    {(
                                      [
                                        {
                                          value: "solid",
                                          label: "Solid",
                                          dash: "none",
                                        },
                                        {
                                          value: "dashed",
                                          label: "Dashed",
                                          dash: "5,3",
                                        },
                                        {
                                          value: "dotted",
                                          label: "Dotted",
                                          dash: "1,2",
                                        },
                                        {
                                          value: "dashdot",
                                          label: "Dash-Dot",
                                          dash: "8,3,1,3",
                                        },
                                      ] as const
                                    ).map((style) => (
                                      <button
                                        key={style.value}
                                        type="button"
                                        onClick={() => {
                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  lineStyle: style.value,
                                                }
                                                : fn,
                                            ),
                                          );
                                        }}
                                        className={`px-1 rounded-md h-9 flex flex-col items-center justify-center gap-1 transition-all w-full select-none cursor-pointer border ${(f.lineStyle || "solid") ===
                                          style.value
                                          ? "bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 font-bold shadow-sm"
                                          : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 bg-slate-50/50 dark:bg-slate-900/30"
                                          }`}
                                      >
                                        <span className="text-[10px] truncate leading-none">
                                          {style.label}
                                        </span>
                                        {/* Visual Line pattern representation */}
                                        <svg
                                          width="24"
                                          height="4"
                                          className="text-current opacity-85 overflow-visible"
                                        >
                                          <line
                                            x1="0"
                                            y1="2"
                                            x2="24"
                                            y2="2"
                                            stroke="currentColor"
                                            strokeWidth="1.5"
                                            strokeDasharray={
                                              style.dash === "none"
                                                ? undefined
                                                : style.dash
                                            }
                                            strokeLinecap="round"
                                          />
                                        </svg>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Outline Width Slider */}
                              <div className="flex flex-col gap-1 mt-2.5 pb-1 border-t border-slate-200 dark:border-slate-800/60 pt-2">
                                <div className="flex justify-between items-center">
                                  <span className="text-slate-550 dark:text-slate-400 font-semibold text-[11px]">
                                    Outline Width
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-450 dark:text-slate-500">
                                    {(f.outlineWidth !== undefined
                                      ? f.outlineWidth
                                      : 3.0
                                    ).toFixed(1)}{" "}
                                    px
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] text-slate-450 dark:text-slate-500 font-mono">
                                    1.0
                                  </span>
                                  <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="0.5"
                                    value={
                                      f.outlineWidth !== undefined
                                        ? f.outlineWidth
                                        : 3
                                    }
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setFunctions((prev) =>
                                        prev.map((fn) =>
                                          fn.id === f.id
                                            ? { ...fn, outlineWidth: val }
                                            : fn,
                                        ),
                                      );
                                    }}
                                    className="h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500 flex-1 outline-none text-blue-500 dark:text-blue-400"
                                  />
                                  <span className="text-[9px] text-slate-450 dark:text-slate-500 font-mono">
                                    10.0
                                  </span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                        {/* Action Buttons Block */}
                        <div className="absolute right-2 top-2 nodrag shrink-0 z-[1000] flex flex-col md:flex-row items-end md:items-center">
                          {/* Mobile Dropdown Actions Block */}
                          {activeActionMenuId === f.id && (
                            <div
                              className="md:hidden mt-[36px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-md p-1 min-w-[150px] z-[100] flex flex-col gap-0.5 nodrag cursor-default animate-in fade-in zoom-in-95"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setActiveVisualEditorId(f.id);
                                }}
                                className="w-full flex items-center gap-2.5 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-650 dark:text-slate-200 text-xs font-semibold transition-colors"
                              >
                                <Calculator
                                  size={14}
                                  className="text-blue-500 dark:text-blue-400"
                                />{" "}
                                Visual Math Composer
                              </button>
                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setExpandedSettingsFnId(
                                    expandedSettingsFnId === f.id ? null : f.id,
                                  );
                                }}
                                className="w-full flex items-center gap-2.5 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-650 dark:text-slate-200 text-xs font-semibold transition-colors"
                              >
                                <Settings
                                  size={14}
                                  className="text-blue-500 dark:text-blue-400"
                                />{" "}
                                Settings & Properties
                              </button>
                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  handleAddFunctionAt(f.id, "above");
                                }}
                                className="w-full flex items-center gap-2.5 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors"
                              >
                                <ChevronUp
                                  size={14}
                                  className="text-slate-500"
                                />{" "}
                                Insert above
                              </button>
                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  handleAddFunctionAt(f.id, "below");
                                }}
                                className="w-full flex items-center gap-2.5 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors"
                              >
                                <ChevronDown
                                  size={14}
                                  className="text-slate-500"
                                />{" "}
                                Insert below
                              </button>
                              <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-1" />
                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  try {
                                    const node = mathjs.parse(f.expr);
                                    const scope: any = {
                                      x: 1,
                                      y: 1,
                                      t: time,
                                      time: time,
                                      theta: 1,
                                    };
                                    variables.forEach(
                                      (v) => (scope[v.name] = v.value),
                                    );
                                    const res = node.evaluate(scope);
                                    navigator.clipboard.writeText(
                                      mathjs.format(res, { precision: 5 }),
                                    );
                                  } catch (e) { }
                                }}
                                className="w-full flex items-center gap-2.5 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors"
                              >
                                <Check size={14} className="text-slate-500" />{" "}
                                Copy Result
                              </button>
                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  try {
                                    let finalTex = "";
                                    const eqIndex = f.expr.indexOf("=");
                                    if (
                                      eqIndex !== -1 &&
                                      !f.expr.includes("==") &&
                                      !f.expr.includes(">=") &&
                                      !f.expr.includes("<=") &&
                                      !f.expr.includes("!=")
                                    ) {
                                      const lhs = f.expr
                                        .slice(0, eqIndex)
                                        .trim();
                                      const rhs = f.expr
                                        .slice(eqIndex + 1)
                                        .trim();
                                      const lhsTex = mathjs.parse(lhs).toTex();
                                      const rhsTex = mathjs.parse(rhs).toTex();
                                      finalTex = `${lhsTex} = ${rhsTex}`;
                                    } else {
                                      const node = mathjs.parse(f.expr);
                                      finalTex = node.toTex({});
                                    }
                                    navigator.clipboard.writeText(finalTex);
                                  } catch (e) { }
                                }}
                                className="w-full flex items-center gap-2.5 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors"
                              >
                                <svg
                                  className="w-3.5 h-3.5 text-slate-500"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                >
                                  <path d="M12 2L2 22h20L12 2z" />
                                </svg>{" "}
                                Copy LaTeX
                              </button>
                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  navigator.clipboard.writeText(f.expr);
                                }}
                                className="w-full flex items-center gap-2.5 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 text-xs font-medium transition-colors"
                              >
                                <Copy size={14} className="text-slate-500" />{" "}
                                Copy Formula
                              </button>
                              <div className="h-px bg-slate-100 dark:bg-slate-700/50 my-1" />
                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  handleDuplicateFunction(f.id);
                                }}
                                className="w-full flex items-center gap-2.5 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 text-xs transition-colors"
                              >
                                <CopyPlus
                                  size={14}
                                  className="text-slate-500"
                                />{" "}
                                Duplicate
                              </button>
                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  setSavingFormulaFnId(f.id);
                                  setFormulaName(f.name || "");
                                  setFormulaDesc("");
                                }}
                                className="w-full flex items-center gap-2.5 p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-600 dark:text-slate-300 text-xs transition-colors"
                              >
                                <Bookmark
                                  size={14}
                                  className="text-amber-500"
                                />{" "}
                                Save Formula
                              </button>
                              <button
                                onClick={() => {
                                  setActiveActionMenuId(null);
                                  handleRemoveFunction(f.id);
                                }}
                                className="w-full flex items-center gap-2.5 p-2 hover:bg-red-500/10 rounded text-red-500 dark:text-red-400 text-xs transition-colors group"
                              >
                                <Trash2
                                  size={14}
                                  className="group-hover:stroke-red-500"
                                />{" "}
                                Remove
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <FormulaLibrary onInsertFormula={handleInsertFunctionFromHelp} />
                  {/* Popular & Examples */}
                  <div className="flex flex-col gap-4 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                    <div className="flex flex-col gap-2">
                      <h4 className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                        Quick Inserts & Templates
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          { label: "Linear", fn: "m*x + b", type: "function" },
                          {
                            label: "Quadratic",
                            fn: "a*x^2 + b*x + c",
                            type: "function",
                          },
                          {
                            label: "Polynomial",
                            fn: "a*x^3 + b*x^2 + c*x + d",
                            type: "function",
                          },
                          {
                            label: "Exponential",
                            fn: "a * e^(k*x)",
                            type: "function",
                          },
                          {
                            label: "Logarithmic",
                            fn: "a * ln(x) + b",
                            type: "function",
                          },
                          { label: "Circle", fn: "1", type: "polar" },
                          { label: "Spiral", fn: "a * theta", type: "polar" },
                          {
                            label: "Animated Rose",
                            fn: "sin(3 * theta + t)",
                            type: "polar",
                          },
                          {
                            label: "Ellipse (Implicit)",
                            fn: "x^2/a^2 + y^2/b^2 = 1",
                            type: "implicit",
                          },
                          {
                            label: "Matrix Eq. (Line)",
                            fn: "[[x, y, 1], [2, 3, 1], [-1, -3, 1]] = 0",
                            type: "implicit",
                          },
                          {
                            label: "Region (Inequality)",
                            fn: "x^2 + y^2 <= 16",
                            type: "inequality",
                          },
                        ].map((tmpl) => (
                          <button
                            key={tmpl.label}
                            onClick={() => {
                              setActiveExample(null); // Clear example highlight when custom item is inserted
                              setFunctions((prev) => [
                                ...prev,
                                {
                                  id: generateSafeId(),
                                  expr: tmpl.fn,
                                  color: COLORS[prev.length % COLORS.length],
                                  type: (tmpl.type as any) || "function",
                                  visible: true,
                                },
                              ]);
                            }}
                            className="px-2 py-1 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono text-[10px] rounded border border-slate-200 dark:border-slate-700 transition-colors shadow-sm"
                            title={
                              tmpl.type === "polar"
                                ? `r = ${tmpl.fn}`
                                : tmpl.type === "implicit"
                                  ? `${tmpl.fn}`
                                  : `y = ${tmpl.fn}`
                            }
                          >
                            {tmpl.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <h4 className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                        Popular Functions
                      </h4>
                      <div className="flex flex-wrap gap-1.5">
                        {[
                          "sin(x)",
                          "cos(x)",
                          "x^2",
                          "x^3",
                          "e^x",
                          "ln(x)",
                          "sin(x)+cos(x)",
                        ].map((fn) => (
                          <button
                            key={fn}
                            onClick={() => {
                              setActiveExample(null); // Clear example highlight when custom equation is inserted
                              setFunctions((prev) => [
                                ...prev,
                                {
                                  id: generateSafeId(),
                                  expr: fn,
                                  color: COLORS[prev.length % COLORS.length],
                                  type: "function",
                                  visible: true,
                                },
                              ]);
                            }}
                            className="px-2 py-1 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-800/40 text-blue-600 dark:text-blue-300 font-mono text-[10px] rounded border border-blue-200 dark:border-blue-800/50 transition-colors shadow-sm"
                          >
                            y={fn}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 pt-1 border-t border-slate-250 dark:border-slate-700/50">
                      <h4 className="text-[10px] text-slate-500 uppercase font-semibold tracking-wider">
                        Examples Gallery
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => handleLoadExample("Lissajous")}
                          className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${activeExample === "Lissajous"
                            ? "bg-blue-500/10 border-blue-400 dark:border-blue-500 ring-1 ring-blue-400/50"
                            : "bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700"
                            }`}
                        >
                          <span className="text-[10px] text-blue-500 font-semibold dark:text-blue-400 group-hover:text-blue-600 dark:group-hover:text-blue-300">
                            Animation
                          </span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                            Lissajous Curves
                          </span>
                        </button>

                        <button
                          onClick={() => handleLoadExample("Fourier")}
                          className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${activeExample === "Fourier"
                            ? "bg-emerald-500/10 border-emerald-400 dark:border-emerald-500 ring-1 ring-emerald-400/50"
                            : "bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700"
                            }`}
                        >
                          <span className="text-[10px] text-emerald-600 font-semibold dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300">
                            Mathematics
                          </span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                            Fourier Series
                          </span>
                        </button>

                        <button
                          onClick={() => handleLoadExample("Wave")}
                          className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${activeExample === "Wave"
                            ? "bg-amber-500/10 border-amber-400 dark:border-amber-500 ring-1 ring-amber-400/50"
                            : "bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700"
                            }`}
                        >
                          <span className="text-[10px] text-amber-600 font-semibold dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300">
                            Physics
                          </span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                            Traveling Wave
                          </span>
                        </button>

                        <button
                          onClick={() => handleLoadExample("Statistics")}
                          className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${activeExample === "Statistics"
                            ? "bg-purple-500/10 border-purple-400 dark:border-purple-500 ring-1 ring-purple-400/50"
                            : "bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700"
                            }`}
                        >
                          <span className="text-[10px] text-purple-600 font-semibold dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300">
                            Statistics
                          </span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                            Normal Dist.
                          </span>
                        </button>

                        <button
                          onClick={() => handleLoadExample("Geometry")}
                          className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${activeExample === "Geometry"
                            ? "bg-pink-500/10 border-pink-400 dark:border-pink-500 ring-1 ring-pink-400/50"
                            : "bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700"
                            }`}
                        >
                          <span className="text-[10px] text-pink-600 font-semibold dark:text-pink-400 group-hover:text-pink-700 dark:group-hover:text-pink-300">
                            Geometry
                          </span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                            Vectors & Polygons
                          </span>
                        </button>

                        <button
                          onClick={() => handleLoadExample("Matrix")}
                          className={`text-left p-2 rounded transition-all group shadow-sm flex flex-col gap-0.5 border ${activeExample === "Matrix"
                            ? "bg-indigo-500/10 border-indigo-400 dark:border-indigo-500 ring-1 ring-indigo-400/50"
                            : "bg-white dark:bg-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-700/80 border-slate-200 dark:border-slate-700"
                            }`}
                        >
                          <span className="text-[10px] text-indigo-600 font-semibold dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300">
                            Matrices
                          </span>
                          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                            Matrix & Det. Eq.
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Variables */}
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
                          (v.name
                            .toLowerCase()
                            .includes(searchVar.toLowerCase()) ||
                            (v.displayName &&
                              v.displayName
                                .toLowerCase()
                                .includes(searchVar.toLowerCase()))),
                      );

                      // Hide empty groups ONLY when there is an active search query
                      if (groupVars.length === 0 && searchVar) return null;
                      const isEmpty = groupVars.length === 0;

                      return (
                        <div key={group.id} className="flex flex-col gap-2">
                          <div className="flex items-center justify-between group/header text-[10px] font-semibold text-slate-500 uppercase select-none">
                            <div
                              className="flex items-center gap-1 cursor-pointer hover:text-slate-705 dark:hover:text-slate-350"
                              onClick={() =>
                                setGroups(
                                  groups.map((g) =>
                                    g.id === group.id
                                      ? { ...g, isCollapsed: !g.isCollapsed }
                                      : g,
                                  ),
                                )
                              }
                            >
                              {group.isCollapsed ? (
                                <ChevronRight size={12} />
                              ) : (
                                <ChevronDown size={12} />
                              )}
                              <span>{group.name}</span>
                            </div>

                            {/* Allow deletion of empty custom groups */}
                            {group.id !== "default" && isEmpty && (
                              <button
                                onClick={() => {
                                  setGroups((prev) =>
                                    prev.filter((g) => g.id !== group.id),
                                  );
                                }}
                                className="text-slate-400 hover:text-red-500 opacity-0 group-hover/header:opacity-100 transition-opacity p-0.5"
                                title="Delete empty group"
                              >
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>

                          {!group.isCollapsed && isEmpty && (
                            <div
                              onDragOver={(e) => {
                                e.preventDefault();
                                // Set drop indicator for this group
                                setDragOverVariableId(`empty_${group.id}`);
                              }}
                              onDragLeave={() => {
                                if (
                                  dragOverVariableId === `empty_${group.id}`
                                ) {
                                  setDragOverVariableId(null);
                                }
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                if (draggedVariableId) {
                                  // Drop into this group
                                  setVariables((prev) =>
                                    prev.map((v) =>
                                      v.id === draggedVariableId
                                        ? { ...v, groupId: group.id }
                                        : v,
                                    ),
                                  );
                                }
                                setDragOverVariableId(null);
                                setDraggedVariableId(null);
                              }}
                              className={`border-2 border-dashed rounded-lg p-3 text-center text-xs transition-all flex flex-col items-center justify-center gap-1 min-h-[64px] ${dragOverVariableId === `empty_${group.id}`
                                ? "border-blue-500 bg-blue-500/10 text-blue-500"
                                : "border-slate-200 dark:border-slate-800/60 text-slate-400 dark:text-slate-500 hover:border-slate-350 dark:hover:border-slate-700"
                                }`}
                            >
                              <Folder className="opacity-30" size={14} />
                              <span>Empty. Drag variables here.</span>
                            </div>
                          )}

                          {!group.isCollapsed &&
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
                                  } ${draggedVariableId === v.id ? "opacity-40" : ""} ${draggedVariableId !== null ? "[&>*]:pointer-events-none" : ""} ${""} ${""}`}
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
                                          activeActionMenuId === v.id
                                            ? null
                                            : v.id,
                                        );
                                      }}
                                    >
                                      <MoreVertical size={16} />
                                    </button>

                                    {/* Button group */}
                                    <div
                                      className={`items-center gap-0.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-md p-0.5 ${activeActionMenuId === v.id ? "flex absolute right-8 top-0" : "hidden md:opacity-0 md:group-hover:opacity-100 md:flex"} transition-opacity`}
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

                {/* Timeline & Controls */}
                <div className="flex flex-col gap-3 mt-auto pt-4 border-t border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Timeline (t)
                    </h3>
                    <button
                      onClick={() => setTracePoints(!tracePoints)}
                      className={`p-1.5 rounded transition-colors text-xs flex items-center gap-1 ${tracePoints ? "bg-emerald-500/20 dark:bg-emerald-500/25 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30" : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"}`}
                      title="Trace Points"
                    >
                      <Crosshair size={12} /> Trace
                    </button>
                  </div>

                  <div className="flex items-center gap-2 justify-center bg-slate-50 dark:bg-slate-900/50 py-2 rounded-lg border border-slate-200 dark:border-slate-800/50 shadow-xs">
                    <button
                      onClick={() => {
                        setTime(timeBounds.min);
                        timeRef.current = timeBounds.min;
                      }}
                      className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded text-slate-500 dark:text-slate-400 hover:text-slate-905 dark:hover:text-white transition-colors"
                      title="Reset Time"
                    >
                      <SkipBack size={16} />
                    </button>
                    <button
                      onClick={() => setIsPlaying(!isPlaying)}
                      className={`p-2.5 rounded-full text-white shadow-md transition-transform hover:scale-105 ${isPlaying ? "bg-slate-600 hover:bg-slate-500" : "bg-blue-600 hover:bg-blue-500"}`}
                    >
                      {isPlaying ? (
                        <Pause size={16} />
                      ) : (
                        <Play size={16} fill="currentColor" />
                      )}
                    </button>
                    <button
                      onClick={() => setShowTimeSettings(!showTimeSettings)}
                      className={`p-1.5 rounded transition-colors ${showTimeSettings ? "bg-slate-200 dark:bg-slate-700 text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"}`}
                      title="Timeline Settings"
                    >
                      <Settings size={16} />
                    </button>
                  </div>

                  {showTimeSettings && (
                    <div className="flex flex-col gap-2 p-2 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded text-xs text-slate-705 dark:text-slate-300">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          Range
                        </span>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            value={timeBounds.min}
                            onChange={(e) =>
                              setTimeBounds((prev) => ({
                                ...prev,
                                min: Number(e.target.value),
                              }))
                            }
                            className="w-12 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 outline-none focus:border-blue-500"
                            title="Start Time"
                          />
                          <span className="text-slate-500 text-[10px]">to</span>
                          <input
                            type="number"
                            value={timeBounds.max}
                            onChange={(e) =>
                              setTimeBounds((prev) => ({
                                ...prev,
                                max: Number(e.target.value),
                              }))
                            }
                            className="w-12 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 outline-none focus:border-blue-500"
                            title="End Time"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          Mode
                        </span>
                        <div className="flex gap-1 bg-slate-200 dark:bg-slate-800 p-0.5 rounded border border-slate-300 dark:border-slate-700">
                          {(["continuous", "loop", "bounce"] as const).map(
                            (m) => (
                              <button
                                key={m}
                                onClick={() => setTimeMode(m)}
                                className={`px-2 py-0.5 rounded capitalize ${timeMode === m ? "bg-blue-600 text-white shadow-xs" : "hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"}`}
                              >
                                {m}
                              </button>
                            ),
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-500 dark:text-slate-400">
                          Speed
                        </span>
                        <input
                          type="number"
                          step="0.1"
                          value={timeBounds.speed}
                          onChange={(e) =>
                            setTimeBounds((prev) => ({
                              ...prev,
                              speed: Number(e.target.value),
                            }))
                          }
                          className="w-16 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-750 text-slate-800 dark:text-slate-100 rounded px-1 py-0.5 outline-none focus:border-blue-500"
                          title="Playback Speed"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-col gap-2 bg-slate-50 dark:bg-slate-900/50 py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-800/50 shadow-xs">
                    <div className="flex items-center justify-between text-sm text-slate-700 dark:text-slate-300 font-mono">
                      <span className="text-slate-500 font-semibold uppercase text-[10px] tracking-wider">
                        time
                      </span>
                      <span>{time.toFixed(2)}</span>
                    </div>

                    {timeMode !== "continuous" && (
                      <div className="w-full flex items-center justify-center">
                        <input
                          type="range"
                          min={timeBounds.min}
                          max={timeBounds.max}
                          step={(timeBounds.max - timeBounds.min) / 1000}
                          value={time}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setTime(val);
                            timeRef.current = val;
                          }}
                          onMouseDown={() => setIsPlaying(false)}
                          className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer outline-none hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors accent-blue-500"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

        {/* Splitter */}
        {(isExpanded || isFullscreen) && isPanelVisible && (
          <div
            className="hidden md:flex w-1 bg-slate-700/50 hover:bg-blue-500 cursor-col-resize z-20 flex-col justify-center transition-colors relative group"
            onMouseDown={() => setIsResizingSidebar(true)}
          >
            <div className="absolute inset-y-0 -left-1 -right-1 cursor-col-resize z-20"></div>
            <div className="w-1 h-8 bg-slate-500 rounded-full mx-auto group-hover:bg-white transition-colors" />
          </div>
        )}

        <style>
          {`
              .group\\/graph .MafsView {
                --mafs-bg: ${appTheme === "dark" ? "#020617" : "#ffffff"} !important;
                --mafs-fg: ${appTheme === "dark" ? "#f8fafc" : "#0f172a"} !important;
                --mafs-line-color: ${appTheme === "dark" ? "#334155" : "#e2e8f0"} !important;
                --grid-line-subdivision-color: ${appTheme === "dark" ? "#1e293b" : "#f1f5f9"} !important;
              }
            `}
        </style>

        {/* Graph Canvas */}
        <div
          ref={graphContainerRef}
          className={`flex-1 relative ${appTheme === "dark" ? "bg-slate-950" : "bg-white"} overflow-hidden select-none nodrag cursor-crosshair group/graph`}
          style={
            {
              "--mafs-bg": appTheme === "dark" ? "#020617" : "#ffffff",
              "--mafs-fg": appTheme === "dark" ? "#f8fafc" : "#0f172a",
              "--mafs-line-color": appTheme === "dark" ? "#334155" : "#e2e8f0",
              "--grid-line-subdivision-color":
                appTheme === "dark" ? "#1e293b" : "#f1f5f9",
            } as React.CSSProperties
          }
        >
          {/* Graph Controls */}
          {(isExpanded || isFullscreen) && (
            <div
              className={`absolute top-2 left-2 right-2 md:top-4 md:left-4 md:right-auto z-40 flex flex-wrap md:flex-nowrap items-center bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-lg pointer-events-auto p-1 shadow-2xl transition-all duration-300 ${showGridControls
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 pointer-events-none md:pointer-events-auto md:translate-y-0 md:opacity-0 md:group-hover/graph:opacity-100"
                }`}
            >
              <button
                onClick={() => setGridType("none")}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${gridType === "none" ? "bg-slate-700 text-slate-200 shadow" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800"}`}
                title="No Grid"
              >
                None
              </button>
              <button
                onClick={() => setGridType("cartesian")}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${gridType === "cartesian" ? "bg-slate-700 text-slate-200 shadow" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800"}`}
                title="Cartesian Grid"
              >
                Cartesian
              </button>
              <button
                onClick={() => setGridType("polar")}
                className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors ${gridType === "polar" ? "bg-slate-700 text-slate-200 shadow" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800"}`}
                title="Polar Grid"
              >
                Polar
              </button>
              <div className="hidden md:block w-px bg-slate-700 my-1 mx-1 h-4"></div>
              <div className="relative flex items-center">
                <button
                  onClick={() =>
                    setShowAdvancedAxisControls(!showAdvancedAxisControls)
                  }
                  className={`px-3 py-1.5 text-xs font-mono rounded-md transition-colors flex items-center gap-1.5 ${showAdvancedAxisControls ? "bg-slate-700 text-slate-200 shadow" : "text-slate-400 hover:text-slate-300 hover:bg-slate-800"}`}
                  title="Axis Labels Setup"
                >
                  <List size={14} />
                  <span>Axis Labels</span>
                  <Settings size={12} />
                </button>

                {showAdvancedAxisControls && (
                  <div
                    className="absolute top-[calc(100%+8px)] right-0 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl p-5 z-[100] w-[340px] flex flex-col gap-5 overflow-visible cursor-default"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <h3 className="text-sm font-medium text-slate-200 flex items-center gap-2 tracking-wide">
                        <Type size={16} className="text-blue-500" /> Axis Labels
                        Setup
                      </h3>
                      <button
                        onClick={() => setShowAdvancedAxisControls(false)}
                        className="text-slate-500 hover:text-slate-300 transition-colors p-1 rounded-md hover:bg-slate-800"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                      <div className="flex flex-col gap-2 col-span-2">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 ml-0.5">
                          Label Mode
                        </label>
                        <select
                          value={axisFilter}
                          onChange={(e) => setAxisFilter(e.target.value as any)}
                          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500/50 hover:border-slate-700 transition-colors"
                        >
                          <optgroup label="Basic">
                            <option value="all">All Subdivisions</option>
                            <option value="even">Even Numbers</option>
                            <option value="odd">Odd Numbers</option>
                          </optgroup>
                          <optgroup label="Mathematical Presets">
                            <option value="numeric">Numeric (Default)</option>
                            <option value="pi">π Multiples</option>
                            <option value="euler">Euler (e)</option>
                            <option value="complex">Complex (i)</option>
                            <option value="degrees">Degrees</option>
                            <option value="radians">Radians</option>
                            <option value="fractions">Fractions</option>
                            <option value="scientific">Scientific</option>
                          </optgroup>
                          <optgroup label="Custom">
                            <option value="custom_mapping">
                              Custom Mapping
                            </option>
                            <option value="custom">
                              Logic Rule (e.g. n%2==0)
                            </option>
                          </optgroup>
                        </select>
                      </div>

                      <div className="flex flex-col gap-2 col-span-2">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 ml-0.5">
                          Axis Step Size (lines)
                        </label>
                        <input
                          type="text"
                          value={axisStepStr}
                          onChange={(e) => setAxisStepStr(e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono rounded-lg px-3 py-2 outline-none focus:border-blue-500/50 transition-colors placeholder:text-slate-600"
                          placeholder="e.g. 1, 0.5, pi/2"
                        />
                      </div>

                      {axisFilter === "custom_mapping" && (
                        <div className="flex flex-col gap-2 col-span-2">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 ml-0.5">
                            Value → Label Map
                          </label>
                          <textarea
                            value={customAxisMapping}
                            onChange={(e) =>
                              setCustomAxisMapping(e.target.value)
                            }
                            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono rounded-lg px-3 py-2 outline-none focus:border-blue-500/50 h-28 whitespace-pre custom-scrollbar resize-none placeholder:text-slate-600"
                            placeholder="0 → Origin&#10;1 → Start&#10;2 → End"
                          />
                        </div>
                      )}

                      {axisFilter === "custom" && (
                        <div className="flex flex-col gap-2 col-span-2">
                          <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 ml-0.5">
                            Logic Rule (Returns Boolean)
                          </label>
                          <input
                            type="text"
                            value={customAxisFilter}
                            onChange={(e) =>
                              setCustomAxisFilter(e.target.value)
                            }
                            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-mono rounded-lg px-3 py-2 outline-none focus:border-blue-500/50 placeholder:text-slate-600"
                            placeholder="e.g. abs(n) > 2"
                          />
                        </div>
                      )}

                      {["numeric", "scientific"].includes(axisFilter) && (
                        <React.Fragment>
                          <div className="flex flex-col gap-2 col-span-2 sm:col-span-1">
                            <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 ml-0.5">
                              Decimals
                            </label>
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={axisDecimals}
                              onChange={(e) =>
                                setAxisDecimals(Number(e.target.value))
                              }
                              className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500/50"
                            />
                          </div>
                          <div className="flex items-center gap-2 col-span-2 sm:col-span-1 pb-2 self-end">
                            <input
                              type="checkbox"
                              id="thousandsSep"
                              checked={axisThousandsSep}
                              onChange={(e) =>
                                setAxisThousandsSep(e.target.checked)
                              }
                              className="rounded border-slate-700 bg-slate-950 focus:ring-blue-500/50 focus:ring-offset-slate-900 focus:border-slate-600 size-4 cursor-pointer"
                            />
                            <label
                              htmlFor="thousandsSep"
                              className="text-xs text-slate-300 select-none cursor-pointer"
                            >
                              Thousands Separator
                            </label>
                          </div>
                        </React.Fragment>
                      )}

                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 ml-0.5">
                          Prefix
                        </label>
                        <input
                          type="text"
                          value={axisPrefix}
                          onChange={(e) => setAxisPrefix(e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500/50 placeholder:text-slate-600"
                          placeholder="e.g. $"
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <label className="text-[10px] uppercase font-bold tracking-wider text-slate-500 ml-0.5">
                          Suffix
                        </label>
                        <input
                          type="text"
                          value={axisSuffix}
                          onChange={(e) => setAxisSuffix(e.target.value)}
                          className="bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg px-3 py-2 outline-none focus:border-blue-500/50 placeholder:text-slate-600"
                          placeholder="s"
                        />
                      </div>

                      <div className="col-span-2 mt-2 bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 text-slate-300 flex flex-col gap-3 relative">
                        <h4 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">
                          Live Preview
                        </h4>
                        <div className="flex items-center font-mono text-xs overflow-x-auto custom-scrollbar pb-1 text-slate-200">
                          {[
                            0,
                            parsedAxisStep,
                            parsedAxisStep * 2,
                            parsedAxisStep * 3,
                          ].map((val, idx) => {
                            const lbl = getAxisLabel(val);
                            return (
                              <React.Fragment key={val}>
                                {idx > 0 && (
                                  <span className="text-slate-700 font-sans mx-3">
                                    |
                                  </span>
                                )}
                                <span className="shrink-0">
                                  {lbl === "" ? "—" : lbl}
                                </span>
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <Mafs
            key={viewResetKey}
            width={graphSize.width}
            height={graphSize.height}
            zoom={{ min: 0.1, max: 20 }}
            viewBox={{ x: [-5, 5], y: [-5, 5] }}
            preserveAspectRatio="contain"
            pan={true}
          >
            <AdaptiveGrid
              gridType={gridType}
              gridSubdivisions={gridSubdivisions}
              parsedAxisStep={parsedAxisStep}
              axisStepStr={axisStepStr}
              axisFilter={axisFilter}
              axisDecimals={axisDecimals}
              axisThousandsSep={axisThousandsSep}
              axisPrefix={axisPrefix}
              axisSuffix={axisSuffix}
              customAxisFilter={customAxisFilter}
              customAxisMapping={customAxisMapping}
            />

            <TraceOverlay
              functions={functions}
              baseScope={baseScope}
              time={time}
              containerRef={graphContainerRef}
            />

            {(() => {
              latestContextRef.current = {
                functions,
                setFunctions,
                baseScope,
                activeGizmo,
                handleGizmoMove,
                hoveredVar,
                isShiftPressed,
                time,
                geomCacheRef,
                samplingDepth,
              };

              if (!MathNodesLayerRef.current) {
                MathNodesLayerRef.current = ({
                  isInteractionLayer,
                }: {
                  isInteractionLayer: boolean;
                }) => {
                  const pane = usePaneContext();
                  const xRange =
                    pane && pane.xPaneRange ? pane.xPaneRange : [-10, 10];
                  const yRange =
                    pane && pane.yPaneRange ? pane.yPaneRange : [-10, 10];

                  const ctx = latestContextRef.current!;
                  const {
                    functions,
                    setFunctions,
                    baseScope,
                    activeGizmo,
                    handleGizmoMove,
                    hoveredVar,
                    isShiftPressed,
                    time,
                    geomCacheRef,
                    samplingDepth,
                  } = ctx;

                  return functions
                    .filter((f) => f.visible)
                    .map((f) => {
                      if (f.compiled) {
                        const fTime = f.hasCustomTimeline
                          ? f.time !== undefined
                            ? f.time
                            : 0
                          : time;
                        const baseScope = {
                          ...ctx.baseScope,
                          t: fTime,
                          time: time,
                        };
                        const tx = f.transformTranslate?.[0] || 0;
                        const ty = f.transformTranslate?.[1] || 0;
                        const rot = f.transformRotate || 0;
                        const sx = f.transformScale?.[0] || 1;
                        const sy = f.transformScale?.[1] || 1;

                        const isPointBased =
                          f.type === "point" ||
                          f.type === "vector" ||
                          f.type === "polygon" ||
                          f.type === "line";
                        let points: [number, number][] = [];

                        if (isPointBased) {
                          const res = resolveGeometryPoints(f, baseScope);
                          points = res.points.filter(
                            (p) =>
                              !isNaN(p[0]) &&
                              !isNaN(p[1]) &&
                              isFinite(p[0]) &&
                              isFinite(p[1]),
                          );
                          if (points.length === 0) return null;
                        } else if (f.isDraggable || f.isTransformable) {
                          const cacheId = f.id + f.expr;
                          if (geomCacheRef.current[cacheId]) {
                            points = geomCacheRef.current[cacheId];
                          } else {
                            let pt: [number, number] = [0, 0];
                            if (f.type === "function") {
                              for (let x of [0, 1, -1, 2, -2, 3, -3]) {
                                try {
                                  let y = Number(
                                    f.compiled.evaluate({ ...baseScope, x }),
                                  );
                                  if (isFinite(y)) {
                                    pt = [x, y];
                                    break;
                                  }
                                } catch { }
                              }
                            } else if (f.type === "parametric") {
                              for (let t of [
                                0,
                                Math.PI / 4,
                                Math.PI / 2,
                                Math.PI,
                              ]) {
                                try {
                                  let res = f.compiled.evaluate({
                                    ...baseScope,
                                    t,
                                    x: t,
                                    theta: t,
                                  });
                                  let arr = res.toArray ? res.toArray() : res;
                                  pt = [Number(arr[0]), Number(arr[1])];
                                  break;
                                } catch { }
                              }
                            } else if (f.type === "polar") {
                              for (let t of [
                                0,
                                Math.PI / 4,
                                Math.PI / 2,
                                Math.PI,
                              ]) {
                                try {
                                  let r = Number(
                                    f.compiled.evaluate({
                                      ...baseScope,
                                      theta: t,
                                      x: t,
                                      t,
                                    }),
                                  );
                                  if (isFinite(r)) {
                                    pt = [r * Math.cos(t), r * Math.sin(t)];
                                    break;
                                  }
                                } catch { }
                              }
                            } else if (
                              f.type === "implicit" ||
                              f.type === "inequality"
                            ) {
                              let found = false;
                              for (let i = -3; i <= 3 && !found; i += 0.5) {
                                for (let j = -3; j <= 3 && !found; j += 0.5) {
                                  try {
                                    let l = f.compiled.evaluate({
                                      ...baseScope,
                                      x: i,
                                      y: j,
                                    });
                                    if (l && (l.isMatrix || Array.isArray(l))) {
                                      try {
                                        l = mathjs.det(l);
                                      } catch {
                                        l = NaN;
                                      }
                                    }
                                    let r = f.compiled2
                                      ? f.compiled2.evaluate({
                                        ...baseScope,
                                        x: i,
                                        y: j,
                                      })
                                      : 0;
                                    if (r && (r.isMatrix || Array.isArray(r))) {
                                      try {
                                        r = mathjs.det(r);
                                      } catch {
                                        r = NaN;
                                      }
                                    }
                                    if (
                                      f.type === "implicit" &&
                                      Math.abs(Number(l) - Number(r)) < 2
                                    ) {
                                      pt = [i, j];
                                      found = true;
                                    } else if (
                                      f.type === "inequality" &&
                                      Number(l) - Number(r) <= 0
                                    ) {
                                      pt = [i, j];
                                      found = true;
                                    }
                                  } catch { }
                                }
                              }
                            }
                            points = pt ? [pt] : [];
                            geomCacheRef.current[cacheId] = points;
                          }
                        }

                        try {
                          let cx = 0,
                            cy = 0;
                          if (points.length > 0) {
                            cx =
                              points.reduce((s, p) => s + p[0], 0) /
                              points.length;
                            cy =
                              points.reduce((s, p) => s + p[1], 0) /
                              points.length;
                          }

                          const isBasicPointDraggable =
                            f.type === "point" &&
                            points.length === 1 &&
                            f.isDraggable &&
                            !f.isTransformable;

                          // Use PCA to compute natural axes for resizing
                          const pca = computePCA(points);
                          // Let pca angle be the base orientaion of the shape when rotation is 0
                          const baseAngle = !f.isTransformable
                            ? 0
                            : Math.atan2(pca.u[1], pca.u[0]);

                          const px = !f.isTransformable
                            ? 0
                            : f.isPivotEnabled && f.transformPivot
                              ? f.transformPivot[0]
                              : pca.center[0];
                          const py = !f.isTransformable
                            ? 0
                            : f.isPivotEnabled && f.transformPivot
                              ? f.transformPivot[1]
                              : pca.center[1];

                          // Determine handle radius based on shape size
                          let baseRadius = 2.0;
                          if (points.length > 0) {
                            let maxDist = 0;
                            for (let p of points) {
                              let dx = p[0] - px;
                              let dy = p[1] - py;
                              maxDist = Math.max(
                                maxDist,
                                Math.sqrt(dx * dx + dy * dy),
                              );
                            }
                            baseRadius = Math.max(2.0, maxDist + 0.5);
                          }

                          // Combine PCA rotation with user transformation
                          const totalRot = rot;

                          // Helper for handles (from local relative geometry to global)
                          const localToGlobal = (lx: number, ly: number) => {
                            const x1 = lx - px;
                            const y1 = ly - py;

                            // Rotate by -baseAngle to align with local PCA axes
                            const cB = Math.cos(-baseAngle);
                            const sB = Math.sin(-baseAngle);
                            const x2 = x1 * cB - y1 * sB;
                            const y2 = x1 * sB + y1 * cB;

                            // Scale along local PCA axes
                            const x3 = x2 * sx;
                            const y3 = y2 * sy;

                            // Rotate back by baseAngle, then apply user rotation (combined into baseAngle + rot)
                            const cR = Math.cos(baseAngle + rot);
                            const sR = Math.sin(baseAngle + rot);
                            const x4 = x3 * cR - y3 * sR;
                            const y4 = x3 * sR + y3 * cR;

                            return [x4 + px + tx, y4 + py + ty] as [
                              number,
                              number,
                            ];
                          };

                          const applyForwardTransform = (
                            pt: [number, number],
                          ): [number, number] => {
                            const xRangeWidth = xRange[1] - xRange[0];
                            const yRangeHeight = yRange[1] - yRange[0];

                            const safeMinX = xRange[0] - Math.max(100, xRangeWidth * 10);
                            const safeMaxX = xRange[1] + Math.max(100, xRangeWidth * 10);
                            const safeMinY = yRange[0] - Math.max(100, yRangeHeight * 10);
                            const safeMaxY = yRange[1] + Math.max(100, yRangeHeight * 10);

                            let inX = pt[0];
                            let inY = pt[1];

                            if (!Number.isFinite(inX) || isNaN(inX)) {
                              inX = safeMinX;
                            }
                            if (!Number.isFinite(inY) || isNaN(inY)) {
                              inY = safeMinY;
                            }

                            inX = Math.max(safeMinX, Math.min(safeMaxX, inX));
                            inY = Math.max(safeMinY, Math.min(safeMaxY, inY));

                            let lx = inX - px;
                            let ly = inY - py;

                            let x1 =
                              lx * Math.cos(-baseAngle) -
                              ly * Math.sin(-baseAngle);
                            let y1 =
                              lx * Math.sin(-baseAngle) +
                              ly * Math.cos(-baseAngle);

                            x1 *= sx;
                            y1 *= sy;

                            let x2 =
                              x1 * Math.cos(rot + baseAngle) -
                              y1 * Math.sin(rot + baseAngle);
                            let y2 =
                              x1 * Math.sin(rot + baseAngle) +
                              y1 * Math.cos(rot + baseAngle);

                            let outX = x2 + px + tx;
                            let outY = y2 + py + ty;

                            if (!Number.isFinite(outX) || isNaN(outX)) {
                              outX = safeMinX;
                            }
                            if (!Number.isFinite(outY) || isNaN(outY)) {
                              outY = safeMinY;
                            }

                            outX = Math.max(safeMinX, Math.min(safeMaxX, outX));
                            outY = Math.max(safeMinY, Math.min(safeMaxY, outY));

                            return [outX, outY];
                          };

                          return (
                            <React.Fragment key={f.id}>
                              {isPointBased && (
                                <Transform translate={[tx, ty]}>
                                  <Transform translate={[px, py]}>
                                    <Transform rotate={rot}>
                                      <Transform rotate={baseAngle}>
                                        <Transform scale={[sx, sy]}>
                                          <Transform rotate={-baseAngle}>
                                            <Transform translate={[-px, -py]}>
                                              {f.type === "point" &&
                                                points.map((p, i) => {
                                                  const showLabel =
                                                    f.showLabel && f.label;
                                                  return (
                                                    <React.Fragment key={i}>
                                                      {f.showPoint !== false &&
                                                        (isBasicPointDraggable ? (
                                                          isInteractionLayer ? (
                                                            <MovablePoint
                                                              point={(() => {
                                                                const m =
                                                                  f.expr.match(
                                                                    /\[([-\d.]+),\s*([-\d.]+)\]/,
                                                                  );
                                                                if (
                                                                  m &&
                                                                  !isNaN(
                                                                    Number(
                                                                      m[1],
                                                                    ),
                                                                  ) &&
                                                                  !isNaN(
                                                                    Number(
                                                                      m[2],
                                                                    ),
                                                                  )
                                                                ) {
                                                                  return [
                                                                    Number(
                                                                      m[1],
                                                                    ),
                                                                    Number(
                                                                      m[2],
                                                                    ),
                                                                  ];
                                                                }
                                                                const m2 =
                                                                  f.expr.match(
                                                                    /\(([-\d.]+),\s*([-\d.]+)\)/,
                                                                  );
                                                                if (
                                                                  m2 &&
                                                                  !isNaN(
                                                                    Number(
                                                                      m2[1],
                                                                    ),
                                                                  ) &&
                                                                  !isNaN(
                                                                    Number(
                                                                      m2[2],
                                                                    ),
                                                                  )
                                                                ) {
                                                                  return [
                                                                    Number(
                                                                      m2[1],
                                                                    ),
                                                                    Number(
                                                                      m2[2],
                                                                    ),
                                                                  ];
                                                                }
                                                                return [
                                                                  p[0],
                                                                  p[1],
                                                                ];
                                                              })()}
                                                              color={f.color}
                                                              onMove={(
                                                                newPt,
                                                              ) => {
                                                                let newExpr = `[${newPt[0].toFixed(2)}, ${newPt[1].toFixed(2)}]`;
                                                                const match =
                                                                  f.expr.match(
                                                                    /^([^=]+=\s*)/,
                                                                  );
                                                                if (match) {
                                                                  newExpr = `${match[1]}[${newPt[0].toFixed(2)}, ${newPt[1].toFixed(2)}]`;
                                                                }
                                                                setFunctions(
                                                                  (prev) =>
                                                                    prev.map(
                                                                      (fn) =>
                                                                        fn.id ===
                                                                          f.id
                                                                          ? {
                                                                            ...fn,
                                                                            expr: newExpr,
                                                                          }
                                                                          : fn,
                                                                    ),
                                                                );
                                                              }}
                                                            />
                                                          ) : null
                                                        ) : !isInteractionLayer ? (
                                                          <Point
                                                            x={p[0]}
                                                            y={p[1]}
                                                            color={f.color}
                                                          />
                                                        ) : null)}
                                                      {showLabel &&
                                                        !isInteractionLayer && (() => {
                                                          let dx = f.labelPosition?.[0] ?? 0.3;
                                                          let dy = f.labelPosition?.[1] ?? 0.3;
                                                          if (f.labelAlignment && f.labelAlignment !== "custom") {
                                                            const r = 0.5;
                                                            if (f.labelAlignment === "center") { dx = 0; dy = 0; }
                                                            else if (f.labelAlignment === "above") { dx = 0; dy = r; }
                                                            else if (f.labelAlignment === "below") { dx = 0; dy = -r; }
                                                            else if (f.labelAlignment === "left") { dx = -r; dy = 0; }
                                                            else if (f.labelAlignment === "right") { dx = r; dy = 0; }
                                                          }
                                                          return (
                                                            <React.Fragment>
                                                              {f.showLabelPoint && (
                                                                <Point x={p[0] + dx} y={p[1] + dy} color={f.color} />
                                                              )}
                                                              <SafeLabel
                                                                at={[p[0] + dx, p[1] + dy]}
                                                                tex={f.label}
                                                                color={f.color}
                                                                rotation={f.labelRotation}
                                                                scale={f.labelScale}
                                                                flipX={f.labelFlipX}
                                                                flipY={f.labelFlipY}
                                                              />
                                                            </React.Fragment>
                                                          );
                                                        })()}
                                                    </React.Fragment>
                                                  );
                                                })}
                                              {!isInteractionLayer &&
                                                f.type === "vector" &&
                                                points.map((p, i) => {
                                                  const customDash = getStrokeDasharray(f.lineStyle);
                                                  const isDashed = f.lineStyle && f.lineStyle !== "solid";
                                                  const vectorEl = (
                                                    <Vector
                                                      key={i}
                                                      tail={[0, 0]}
                                                      tip={p}
                                                      color={f.color}
                                                      style={isDashed ? "dashed" : "solid"}
                                                      weight={
                                                        f.outlineWidth !==
                                                          undefined
                                                          ? f.outlineWidth
                                                          : 3
                                                      }
                                                    />
                                                  );
                                                  return isDashed ? (
                                                    <g
                                                      key={i}
                                                      style={
                                                        {
                                                          "--mafs-line-stroke-dash-style": customDash,
                                                        } as React.CSSProperties
                                                      }
                                                    >
                                                      {vectorEl}
                                                    </g>
                                                  ) : (
                                                    vectorEl
                                                  );
                                                })}
                                              {!isInteractionLayer &&
                                                f.type === "polygon" &&
                                                points.length > 2 && (
                                                  <React.Fragment>
                                                    {f.fillColor !==
                                                      undefined && (
                                                        <CurvePatternDefs
                                                          id={f.id}
                                                          color={f.color}
                                                          fillColor={f.fillColor}
                                                          fillOpacity={
                                                            f.fillOpacity !==
                                                              undefined
                                                              ? f.fillOpacity
                                                              : 0.2
                                                          }
                                                          fillPattern={
                                                            f.fillPattern
                                                          }
                                                          patternSpacing={
                                                            f.patternSpacing
                                                          }
                                                          patternThickness={
                                                            f.patternThickness
                                                          }
                                                          patternAngle={
                                                            f.patternAngle
                                                          }
                                                        />
                                                      )}
                                                    <Polygon
                                                      points={points}
                                                      color={
                                                        f.fillColor !==
                                                          undefined
                                                          ? f.fillColor ||
                                                          f.color
                                                          : f.color
                                                      }
                                                      fillOpacity={
                                                        f.fillColor !==
                                                          undefined
                                                          ? f.fillPattern ===
                                                            "solid"
                                                            ? f.fillOpacity !==
                                                              undefined
                                                              ? f.fillOpacity
                                                              : 0.2
                                                            : 1
                                                          : f.fillOpacity !==
                                                            undefined
                                                            ? f.fillOpacity
                                                            : 0.2
                                                      }
                                                      svgPolygonProps={{
                                                        style: {
                                                          strokeDasharray:
                                                            getStrokeDasharray(
                                                              f.lineStyle,
                                                            ),
                                                          strokeWidth:
                                                            f.outlineWidth !==
                                                              undefined
                                                              ? f.outlineWidth
                                                              : undefined,
                                                          stroke: f.color,
                                                          fill:
                                                            f.fillPattern === "solid"
                                                              ? (f.fillColor || f.color)
                                                              : `url(#curve-pattern-${f.id})`,
                                                        },
                                                      }}
                                                    />
                                                  </React.Fragment>
                                                )}
                                              {!isInteractionLayer &&
                                                f.type === "line" &&
                                                points.length >= 2 && (() => {
                                                  const customDash = getStrokeDasharray(f.lineStyle);
                                                  const isDashed = f.lineStyle && f.lineStyle !== "solid";
                                                  const lineEl = (
                                                    <Line.Segment
                                                      point1={points[0]}
                                                      point2={points[1]}
                                                      color={f.color}
                                                      style={isDashed ? "dashed" : "solid"}
                                                      weight={
                                                        f.outlineWidth !==
                                                          undefined
                                                          ? f.outlineWidth
                                                          : 3
                                                      }
                                                    />
                                                  );
                                                  return isDashed ? (
                                                    <g
                                                      style={
                                                        {
                                                          "--mafs-line-stroke-dash-style": customDash,
                                                        } as React.CSSProperties
                                                      }
                                                    >
                                                      {lineEl}
                                                    </g>
                                                  ) : (
                                                    lineEl
                                                  );
                                                })()}
                                            </Transform>
                                          </Transform>
                                        </Transform>
                                      </Transform>
                                    </Transform>
                                  </Transform>
                                </Transform>
                              )}

                              {!isInteractionLayer &&
                                !isPointBased &&
                                f.type === "parametric" && (
                                  <React.Fragment>
                                    {f.fillColor !== undefined &&
                                      (() => {
                                        const fillPoints: [number, number][] =
                                          [];
                                        const steps = 150;
                                        for (let i = 0; i <= steps; i++) {
                                          const tVal =
                                            (2 * Math.PI * i) / steps;
                                          try {
                                            const scope = Object.create(baseScope);
                                            scope.t = tVal;
                                            const res = f.compiled.evaluate(scope);
                                            const arr =
                                              res && res.toArray
                                                ? res.toArray()
                                                : res;
                                            if (
                                              Array.isArray(arr) &&
                                              arr.length >= 2
                                            ) {
                                              fillPoints.push(
                                                applyForwardTransform([
                                                  Number(arr[0]),
                                                  Number(arr[1]),
                                                ]),
                                              );
                                            }
                                          } catch { }
                                        }
                                        if (fillPoints.length < 2) return null;
                                        return (
                                          <React.Fragment>
                                            <CurvePatternDefs
                                              id={f.id}
                                              color={f.color}
                                              fillColor={f.fillColor}
                                              fillOpacity={
                                                f.fillOpacity !== undefined
                                                  ? f.fillOpacity
                                                  : 0.3
                                              }
                                              fillPattern={f.fillPattern}
                                              patternSpacing={f.patternSpacing}
                                              patternThickness={
                                                f.patternThickness
                                              }
                                              patternAngle={f.patternAngle}
                                            />
                                            <Polygon
                                              points={fillPoints}
                                              color={f.fillColor || f.color}
                                              fillOpacity={
                                                f.fillPattern === "solid"
                                                  ? f.fillOpacity !== undefined
                                                    ? f.fillOpacity
                                                    : 0.3
                                                  : 1
                                              }
                                              svgPolygonProps={{
                                                style: {
                                                  fill:
                                                    f.fillPattern === "solid"
                                                      ? f.fillColor || f.color
                                                      : `url(#curve-pattern-${f.id})`,
                                                  stroke: "none",
                                                },
                                              }}
                                            />
                                          </React.Fragment>
                                        );
                                      })()}
                                    <Plot.Parametric
                                      minSamplingDepth={Math.max(
                                        8,
                                        Math.min(10, samplingDepth),
                                      )}
                                      maxSamplingDepth={Math.max(
                                        8,
                                        Math.min(14, samplingDepth),
                                      )}
                                      xy={(t: number) => {
                                        try {
                                          const scope = Object.create(baseScope);
                                          scope.t = t;
                                          const res = f.compiled.evaluate(scope);
                                          const arr =
                                            res && res.toArray
                                              ? res.toArray()
                                              : res;
                                          if (
                                            Array.isArray(arr) &&
                                            arr.length >= 2
                                          ) {
                                            return applyForwardTransform([
                                              Number(arr[0]),
                                              Number(arr[1]),
                                            ]);
                                          }
                                          return [0, 0];
                                        } catch {
                                          return [0, 0];
                                        }
                                      }}
                                      t={[0, 2 * Math.PI]}
                                      color={f.color}
                                      weight={
                                        hoveredVar &&
                                          new RegExp(`\\b${hoveredVar}\\b`).test(
                                            f.expr,
                                          )
                                          ? 6
                                          : f.outlineWidth !== undefined
                                            ? f.outlineWidth
                                            : 3
                                      }
                                      opacity={
                                        hoveredVar
                                          ? new RegExp(
                                            `\\b${hoveredVar}\\b`,
                                          ).test(f.expr)
                                            ? 1
                                            : 0.3
                                          : 1
                                      }
                                      style={
                                        f.lineStyle && f.lineStyle !== "solid"
                                          ? "dashed"
                                          : "solid"
                                      }
                                      svgPathProps={{
                                        style: {
                                          strokeDasharray: getStrokeDasharray(
                                            f.lineStyle,
                                          ),
                                        },
                                      }}
                                    />
                                  </React.Fragment>
                                )}

                              {!isInteractionLayer &&
                                !isPointBased &&
                                (f.type === "inequality" ||
                                  f.type === "implicit") && (
                                  <InequalityPlot
                                    compiledLHS={f.compiled}
                                    compiledRHS={f.compiled2}
                                    operator={
                                      f.operator ||
                                      f.expr2 ||
                                      (f.type === "implicit" ? "=" : "<")
                                    }
                                    baseScope={baseScope}
                                    dependenciesHash={`${functions.map(fn => fn.expr).join("__")}__${variables.map((v) => `${v.name}:${v.value}`).join(",")}__${/\b(t|time|t_[a-zA-Z0-9_]+)\b/.test(f.expr || "") ||
                                      (f.expr2 && /\b(t|time|t_[a-zA-Z0-9_]+)\b/.test(f.expr2)) ||
                                      (f.operator && /\b(t|time|t_[a-zA-Z0-9_]+)\b/.test(f.operator))
                                      ? `time:${time}_fTime:${fTime}`
                                      : "static"
                                      }`}
                                    color={f.color}
                                    fillColor={f.fillColor}
                                    fillOpacity={
                                      f.fillOpacity !== undefined
                                        ? f.fillOpacity
                                        : 0.3
                                    }
                                    fillPattern={f.fillPattern}
                                    patternSpacing={f.patternSpacing}
                                    patternThickness={f.patternThickness}
                                    patternAngle={f.patternAngle}
                                    tx={tx}
                                    ty={ty}
                                    rot={rot}
                                    scaleX={sx}
                                    scaleY={sy}
                                    px={px}
                                    py={py}
                                    lineStyle={f.lineStyle}
                                    id={f.id}
                                    onNoSolution={handleNoSolution}
                                    weight={
                                      hoveredVar &&
                                        new RegExp(`\\b${hoveredVar}\\b`).test(
                                          f.expr,
                                        )
                                        ? 6
                                        : f.outlineWidth !== undefined
                                          ? f.outlineWidth
                                          : 3
                                    }
                                    id={f.id}
                                    samplingDepth={samplingDepth}
                                  />
                                )}

                              {!isInteractionLayer &&
                                !isPointBased &&
                                f.type === "polar" && (
                                  <React.Fragment>
                                    {f.fillColor !== undefined &&
                                      (() => {
                                        const fillPoints: [number, number][] =
                                          [];
                                        const steps = 300;
                                        const maxT = 2 * Math.PI * 5;
                                        for (let i = 0; i <= steps; i++) {
                                          const tVal = (maxT * i) / steps;
                                          try {
                                            const useThetaAsAngle =
                                              /\btheta\b/.test(f.expr);
                                            const scope = Object.create(baseScope);
                                            if (useThetaAsAngle) {
                                              scope.theta = tVal;
                                              scope.x = tVal;
                                            } else {
                                              scope.t = tVal;
                                              scope.x = tVal;
                                              scope.theta = tVal;
                                            }
                                            const r = Number(
                                              f.compiled.evaluate(scope),
                                            );
                                            if (
                                              !isNaN(r) &&
                                              typeof r !== "object" &&
                                              isFinite(r)
                                            ) {
                                              fillPoints.push(
                                                applyForwardTransform([
                                                  r * Math.cos(tVal),
                                                  r * Math.sin(tVal),
                                                ]),
                                              );
                                            }
                                          } catch { }
                                        }
                                        if (fillPoints.length < 2) return null;
                                        return (
                                          <React.Fragment>
                                            <CurvePatternDefs
                                              id={f.id}
                                              color={f.color}
                                              fillColor={f.fillColor}
                                              fillOpacity={
                                                f.fillOpacity !== undefined
                                                  ? f.fillOpacity
                                                  : 0.3
                                              }
                                              fillPattern={f.fillPattern}
                                              patternSpacing={f.patternSpacing}
                                              patternThickness={
                                                f.patternThickness
                                              }
                                              patternAngle={f.patternAngle}
                                            />
                                            <Polygon
                                              points={fillPoints}
                                              color={f.fillColor || f.color}
                                              fillOpacity={
                                                f.fillPattern === "solid"
                                                  ? f.fillOpacity !== undefined
                                                    ? f.fillOpacity
                                                    : 0.3
                                                  : 1
                                              }
                                              svgPolygonProps={{
                                                style: {
                                                  fill:
                                                    f.fillPattern === "solid"
                                                      ? f.fillColor || f.color
                                                      : `url(#curve-pattern-${f.id})`,
                                                  stroke: "none",
                                                },
                                              }}
                                            />
                                          </React.Fragment>
                                        );
                                      })()}
                                    <Plot.Parametric
                                      minSamplingDepth={Math.max(
                                        8,
                                        Math.min(10, samplingDepth),
                                      )}
                                      maxSamplingDepth={Math.max(
                                        8,
                                        Math.min(14, samplingDepth),
                                      )}
                                      xy={(tVal: number) => {
                                        try {
                                          const useThetaAsAngle =
                                            /\btheta\b/.test(f.expr);
                                          const scope = Object.create(baseScope);
                                          if (useThetaAsAngle) {
                                            scope.theta = tVal;
                                            scope.x = tVal;
                                          } else {
                                            scope.t = tVal;
                                            scope.x = tVal;
                                            scope.theta = tVal;
                                          }
                                          const r = Number(
                                            f.compiled.evaluate(scope),
                                          );
                                          if (isNaN(r) || typeof r === "object")
                                            return [0, 0];
                                          return applyForwardTransform([
                                            r * Math.cos(tVal),
                                            r * Math.sin(tVal),
                                          ]);
                                        } catch {
                                          return [0, 0];
                                        }
                                      }}
                                      t={[0, 2 * Math.PI * 5]} // Up to 5 full rotations, can adjust if user wants varying domain
                                      color={f.color}
                                      weight={
                                        hoveredVar &&
                                          new RegExp(`\\b${hoveredVar}\\b`).test(
                                            f.expr,
                                          )
                                          ? 6
                                          : f.outlineWidth !== undefined
                                            ? f.outlineWidth
                                            : 3
                                      }
                                      opacity={
                                        hoveredVar
                                          ? new RegExp(
                                            `\\b${hoveredVar}\\b`,
                                          ).test(f.expr)
                                            ? 1
                                            : 0.3
                                          : 1
                                      }
                                      style={
                                        f.lineStyle && f.lineStyle !== "solid"
                                          ? "dashed"
                                          : "solid"
                                      }
                                      svgPathProps={{
                                        style: {
                                          strokeDasharray: getStrokeDasharray(
                                            f.lineStyle,
                                          ),
                                        },
                                      }}
                                    />
                                  </React.Fragment>
                                )}

                              {!isInteractionLayer &&
                                !isPointBased &&
                                f.type === "function" && (
                                  <React.Fragment>
                                    {f.fillColor !== undefined &&
                                      (() => {
                                        const fillPoints: [number, number][] =
                                          [];
                                        const xMin = xRange[0] - 2;
                                        const xMax = xRange[1] + 2;
                                        const steps = 200;
                                        for (let i = 0; i <= steps; i++) {
                                          const xVal =
                                            xMin + ((xMax - xMin) * i) / steps;
                                          try {
                                            const scope = Object.create(baseScope);
                                            scope.x = xVal;
                                            const res = f.compiled.evaluate(scope);
                                            const y = Number(res);
                                            if (!isNaN(y) && isFinite(y)) {
                                              fillPoints.push(
                                                applyForwardTransform([
                                                  xVal,
                                                  y,
                                                ]),
                                              );
                                            }
                                          } catch { }
                                        }
                                        if (fillPoints.length < 2) return null;
                                        return (
                                          <React.Fragment>
                                            <CurvePatternDefs
                                              id={f.id}
                                              color={f.color}
                                              fillColor={f.fillColor}
                                              fillOpacity={
                                                f.fillOpacity !== undefined
                                                  ? f.fillOpacity
                                                  : 0.3
                                              }
                                              fillPattern={f.fillPattern}
                                              patternSpacing={f.patternSpacing}
                                              patternThickness={
                                                f.patternThickness
                                              }
                                              patternAngle={f.patternAngle}
                                            />
                                            <Polygon
                                              points={fillPoints}
                                              color={f.fillColor || f.color}
                                              fillOpacity={
                                                f.fillPattern === "solid"
                                                  ? f.fillOpacity !== undefined
                                                    ? f.fillOpacity
                                                    : 0.3
                                                  : 1
                                              }
                                              svgPolygonProps={{
                                                style: {
                                                  fill:
                                                    f.fillPattern === "solid"
                                                      ? f.fillColor || f.color
                                                      : `url(#curve-pattern-${f.id})`,
                                                  stroke: "none",
                                                },
                                              }}
                                            />
                                          </React.Fragment>
                                        );
                                      })()}
                                    <Plot.Parametric
                                      minSamplingDepth={Math.max(
                                        8,
                                        Math.min(10, samplingDepth),
                                      )}
                                      maxSamplingDepth={Math.max(
                                        8,
                                        Math.min(14, samplingDepth),
                                      )}
                                      t={[
                                        xRange[0] - Math.max(50, (xRange[1] - xRange[0]) * 2),
                                        xRange[1] + Math.max(50, (xRange[1] - xRange[0]) * 2),
                                      ]}
                                      xy={(t) => {
                                        try {
                                          const scope = Object.create(baseScope);
                                          scope.x = t;
                                          const res = f.compiled.evaluate(scope);
                                          if (
                                            res &&
                                            typeof res === "object" &&
                                            res.im !== undefined
                                          ) {
                                            if (Math.abs(res.im) < 1e-9) {
                                              return applyForwardTransform([
                                                t,
                                                Number(res.re),
                                              ]);
                                            } else {
                                              return applyForwardTransform([
                                                t,
                                                NaN,
                                              ]);
                                            }
                                          }
                                          return applyForwardTransform([
                                            t,
                                            Number(res),
                                          ]);
                                        } catch {
                                          return [t, NaN];
                                        }
                                      }}
                                      color={f.color}
                                      weight={
                                        hoveredVar &&
                                          new RegExp(`\\b${hoveredVar}\\b`).test(
                                            f.expr,
                                          )
                                          ? 6
                                          : f.outlineWidth !== undefined
                                            ? f.outlineWidth
                                            : 3
                                      }
                                      opacity={
                                        hoveredVar
                                          ? new RegExp(
                                            `\\b${hoveredVar}\\b`,
                                          ).test(f.expr)
                                            ? 1
                                            : 0.3
                                          : 1
                                      }
                                      style={
                                        f.lineStyle && f.lineStyle !== "solid"
                                          ? "dashed"
                                          : "solid"
                                      }
                                      svgPathProps={{
                                        style: {
                                          strokeDasharray: getStrokeDasharray(
                                            f.lineStyle,
                                          ),
                                        },
                                      }}
                                    />
                                  </React.Fragment>
                                )}

                              {!isInteractionLayer &&
                                f.showLabel &&
                                f.label &&
                                f.type !== "point" && (() => {
                                  let bx = px;
                                  let by = py;
                                  if (f.type === "vector" && points && points.length > 0) {
                                    bx = points[0][0] / 2;
                                    by = points[0][1] / 2;
                                  } else if ((f.type === "line" || f.type === "polygon") && pca?.center) {
                                    bx = pca.center[0];
                                    by = pca.center[1];
                                  }

                                  let dx = f.labelPosition?.[0] ?? 0.3;
                                  let dy = f.labelPosition?.[1] ?? 0.3;
                                  if (f.labelAlignment && f.labelAlignment !== "custom") {
                                    const r = Math.max(1.0, baseRadius * 0.8 + 0.3);
                                    if (f.labelAlignment === "center") { dx = 0; dy = 0; }
                                    else if (f.labelAlignment === "above") { dx = 0; dy = r; }
                                    else if (f.labelAlignment === "below") { dx = 0; dy = -r; }
                                    else if (f.labelAlignment === "left") { dx = -r; dy = 0; }
                                    else if (f.labelAlignment === "right") { dx = r; dy = 0; }
                                  }

                                  const labelPosLocal = [
                                    bx + dx,
                                    by + dy
                                  ] as [number, number];

                                  return (
                                    <React.Fragment>
                                      {f.showLabelPoint && (
                                        <Point x={applyForwardTransform(labelPosLocal)[0]} y={applyForwardTransform(labelPosLocal)[1]} color={f.color} />
                                      )}
                                      <SafeLabel
                                        at={applyForwardTransform(labelPosLocal)}
                                        tex={f.label}
                                        color={f.color}
                                        rotation={f.labelRotation}
                                        scale={f.labelScale}
                                        flipX={f.labelFlipX}
                                        flipY={f.labelFlipY}
                                      />
                                    </React.Fragment>
                                  );
                                })()}

                              {/* Advanced Transformation Gizmos over the transformed geometry */}

                              {/* General Draggable handle for shapes, lines, or multiple points */}
                              {isInteractionLayer &&
                                f.isDraggable &&
                                !isBasicPointDraggable &&
                                (!activeGizmo ||
                                  activeGizmo.id !== f.id ||
                                  activeGizmo.type === "drag") && (
                                  <React.Fragment>
                                    <MovablePoint
                                      point={localToGlobal(
                                        pca.center[0],
                                        pca.center[1],
                                      )}
                                      color={f.color}
                                      onMove={(pt) => {
                                        handleGizmoMove(f.id, "drag");
                                        const cGlobal = localToGlobal(
                                          pca.center[0],
                                          pca.center[1],
                                        );
                                        const dX = pt[0] - cGlobal[0];
                                        const dY = pt[1] - cGlobal[1];

                                        if (
                                          f.type === "line" ||
                                          f.type === "point"
                                        ) {
                                          const match =
                                            f.expr.match(/^([^=]+=\s*)/);
                                          const prefix = match ? match[1] : "";

                                          const ptStrs = points
                                            .map((p: any) => {
                                              const gPt = localToGlobal(
                                                p[0],
                                                p[1],
                                              );
                                              return `[${(gPt[0] + dX).toFixed(2)}, ${(gPt[1] + dY).toFixed(2)}]`;
                                            })
                                            .join(", ");

                                          // If it was a single point that somehow ended up here, preserve brackets.
                                          const isSingle =
                                            points.length === 1 &&
                                            f.expr.includes("[[");

                                          let newExpr = "";
                                          if (isSingle) {
                                            const gPt = localToGlobal(
                                              points[0][0],
                                              points[0][1],
                                            );
                                            newExpr = `${prefix}[[${(gPt[0] + dX).toFixed(2)}], [${(gPt[1] + dY).toFixed(2)}]]`;
                                          } else {
                                            newExpr = `${prefix}[${ptStrs}]`;
                                          }

                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  expr: newExpr,
                                                  transformTranslate:
                                                    undefined,
                                                  transformRotate: undefined,
                                                  transformScale: undefined,
                                                  transformPivot: undefined,
                                                }
                                                : fn,
                                            ),
                                          );
                                          return;
                                        }

                                        const { newExpr } = decoupleGeometry(
                                          f,
                                          baseScope,
                                        );

                                        setFunctions((prev) =>
                                          prev.map((fn) =>
                                            fn.id === f.id
                                              ? {
                                                ...fn,
                                                expr: newExpr,
                                                transformTranslate: [
                                                  (fn
                                                    .transformTranslate?.[0] ||
                                                    0) + dX,
                                                  (fn
                                                    .transformTranslate?.[1] ||
                                                    0) + dY,
                                                ],
                                              }
                                              : fn,
                                          ),
                                        );
                                      }}
                                    />
                                    {activeGizmo?.id === f.id &&
                                      activeGizmo.type === "drag" && (
                                        <Text
                                          x={tx + px}
                                          y={ty + py + baseRadius + 1}
                                          size={14}
                                          color={f.color}
                                        >
                                          {`X: ${tx.toFixed(1)} Y: ${ty.toFixed(1)}`}
                                        </Text>
                                      )}
                                  </React.Fragment>
                                )}

                              {isInteractionLayer && f.isTransformable && (
                                <React.Fragment>
                                  {/* Rotation Handle (Yellowish) - placed along rotated bounding box right edge */}
                                  {f.isRotatable &&
                                    (!activeGizmo ||
                                      activeGizmo.id !== f.id ||
                                      activeGizmo.type === "rotate") && (
                                      <React.Fragment>
                                        <MovablePoint
                                          point={localToGlobal(
                                            px +
                                            Math.cos(baseAngle) * baseRadius,
                                            py +
                                            Math.sin(baseAngle) * baseRadius,
                                          )}
                                          color="#eab308"
                                          onMove={(pt) => {
                                            handleGizmoMove(f.id, "rotate");
                                            const globalPivotX = px + tx;
                                            const globalPivotY = py + ty;
                                            const dragAngle = Math.atan2(
                                              pt[1] - globalPivotY,
                                              pt[0] - globalPivotX,
                                            );
                                            const newRot =
                                              dragAngle - baseAngle;

                                            const { newExpr } =
                                              decoupleGeometry(f, baseScope);

                                            setFunctions((prev) =>
                                              prev.map((fn) =>
                                                fn.id === f.id
                                                  ? {
                                                    ...fn,
                                                    expr: newExpr,
                                                    transformRotate: newRot,
                                                  }
                                                  : fn,
                                              ),
                                            );
                                          }}
                                        />
                                        {activeGizmo?.id === f.id &&
                                          activeGizmo.type === "rotate" && (
                                            <Text
                                              x={tx + px}
                                              y={ty + py + baseRadius + 1}
                                              size={14}
                                              color="#eab308"
                                            >
                                              {`Angle: ${((rot * 180) / Math.PI).toFixed(0)}°`}
                                            </Text>
                                          )}
                                      </React.Fragment>
                                    )}

                                  {/* Resizable/Scale Handle (Greenish) - placed at rotated bounding box corner */}
                                  {f.isResizable &&
                                    (!activeGizmo ||
                                      activeGizmo.id !== f.id ||
                                      activeGizmo.type === "scale") && (
                                      <React.Fragment>
                                        <MovablePoint
                                          point={localToGlobal(
                                            px +
                                            Math.cos(
                                              baseAngle - Math.PI / 4,
                                            ) *
                                            baseRadius *
                                            1.2,
                                            py +
                                            Math.sin(
                                              baseAngle - Math.PI / 4,
                                            ) *
                                            baseRadius *
                                            1.2,
                                          )}
                                          color="#10b981"
                                          onMove={(pt) => {
                                            handleGizmoMove(f.id, "scale");
                                            const globalPivotX = px + tx;
                                            const globalPivotY = py + ty;
                                            const dxHandle =
                                              pt[0] - globalPivotX;
                                            const dyHandle =
                                              pt[1] - globalPivotY;

                                            const startDxHandle =
                                              Math.cos(
                                                baseAngle - Math.PI / 4,
                                              ) *
                                              baseRadius *
                                              1.2;
                                            const startDyHandle =
                                              Math.sin(
                                                baseAngle - Math.PI / 4,
                                              ) *
                                              baseRadius *
                                              1.2;

                                            let localDx =
                                              dxHandle * Math.cos(-rot) -
                                              dyHandle * Math.sin(-rot);
                                            let localDy =
                                              dxHandle * Math.sin(-rot) +
                                              dyHandle * Math.cos(-rot);

                                            let scaleX = Math.max(
                                              0.01,
                                              Math.abs(
                                                localDx /
                                                (startDxHandle || 0.001),
                                              ),
                                            );
                                            let scaleY = Math.max(
                                              0.01,
                                              Math.abs(
                                                localDy /
                                                (startDyHandle || 0.001),
                                              ),
                                            );

                                            if (isShiftPressed) {
                                              const dist = Math.sqrt(
                                                dxHandle * dxHandle +
                                                dyHandle * dyHandle,
                                              );
                                              const startDist =
                                                baseRadius * 1.2;
                                              const uniform = Math.max(
                                                0.01,
                                                dist / startDist,
                                              );
                                              scaleX = uniform;
                                              scaleY = uniform;
                                            }

                                            const { newExpr } =
                                              decoupleGeometry(f, baseScope);

                                            setFunctions((prev) =>
                                              prev.map((fn) =>
                                                fn.id === f.id
                                                  ? {
                                                    ...fn,
                                                    expr: newExpr,
                                                    transformScale: [
                                                      scaleX,
                                                      scaleY,
                                                    ],
                                                  }
                                                  : fn,
                                              ),
                                            );
                                          }}
                                        />
                                        {activeGizmo?.id === f.id &&
                                          activeGizmo.type === "scale" && (
                                            <Text
                                              x={tx + px}
                                              y={ty + py + baseRadius + 1}
                                              size={14}
                                              color="#10b981"
                                            >
                                              {isShiftPressed
                                                ? `Scale: ${sx.toFixed(2)}x`
                                                : `Sx: ${sx.toFixed(2)} Sy: ${sy.toFixed(2)}`}
                                            </Text>
                                          )}
                                      </React.Fragment>
                                    )}

                                  {/* Pivot Editor/Handle (Blueish) */}
                                  {f.isPivotEnabled &&
                                    (!activeGizmo ||
                                      activeGizmo.id !== f.id ||
                                      activeGizmo.type === "pivot") && (
                                      <MovablePoint
                                        point={[px + tx, py + ty]}
                                        color="#3b82f6"
                                        onMove={(pt) => {
                                          handleGizmoMove(f.id, "pivot");

                                          // Math for keeping the object physically stationary:
                                          // old pivot global = px + tx
                                          const ptOld = [px + tx, py + ty];
                                          const dGlobal = [
                                            pt[0] - ptOld[0],
                                            pt[1] - ptOld[1],
                                          ];

                                          // A = R(rot) * R(base) * S(sx,sy) * R(-base)
                                          const c1 = Math.cos(rot + baseAngle);
                                          const s1 = Math.sin(rot + baseAngle);
                                          const c2 = Math.cos(-baseAngle);
                                          const s2 = Math.sin(-baseAngle);

                                          // For A^-1, we invert them backwards: R(base) * S(1/sx, 1/sy) * R(-base - rot)
                                          const invRot = -rot - baseAngle;
                                          const ic1 = Math.cos(invRot);
                                          const is1 = Math.sin(invRot);

                                          let vX =
                                            dGlobal[0] * ic1 - dGlobal[1] * is1;
                                          let vY =
                                            dGlobal[0] * is1 + dGlobal[1] * ic1;

                                          vX /= sx || 1;
                                          vY /= sy || 1;

                                          const bc1 = Math.cos(baseAngle);
                                          const bs1 = Math.sin(baseAngle);

                                          const dLocalX = vX * bc1 - vY * bs1;
                                          const dLocalY = vX * bs1 + vY * bc1;

                                          const pNewX = px + dLocalX;
                                          const pNewY = py + dLocalY;

                                          const tNewX = pt[0] - pNewX;
                                          const tNewY = pt[1] - pNewY;

                                          setFunctions((prev) =>
                                            prev.map((fn) =>
                                              fn.id === f.id
                                                ? {
                                                  ...fn,
                                                  transformPivot: [
                                                    pNewX,
                                                    pNewY,
                                                  ],
                                                  transformTranslate: [
                                                    tNewX,
                                                    tNewY,
                                                  ],
                                                }
                                                : fn,
                                            ),
                                          );
                                        }}
                                      />
                                    )}
                                </React.Fragment>
                              )}

                              {isInteractionLayer && f.showLabel && f.label && f.showLabelPoint && (
                                <React.Fragment>
                                  {/* Label Position Handle */}
                                  {f.type !== "point" &&
                                    (!activeGizmo ||
                                      activeGizmo.id !== f.id ||
                                      activeGizmo.type === "label") && (() => {
                                        let bx = px;
                                        let by = py;
                                        if (f.type === "vector" && points && points.length > 0) {
                                          bx = points[0][0] / 2;
                                          by = points[0][1] / 2;
                                        } else if ((f.type === "line" || f.type === "polygon") && pca?.center) {
                                          bx = pca.center[0];
                                          by = pca.center[1];
                                        }

                                        let dx = f.labelPosition?.[0] ?? 0.3;
                                        let dy = f.labelPosition?.[1] ?? 0.3;
                                        if (f.labelAlignment && f.labelAlignment !== "custom") {
                                          const r = Math.max(1.0, baseRadius * 0.8 + 0.3);
                                          if (f.labelAlignment === "center") { dx = 0; dy = 0; }
                                          else if (f.labelAlignment === "above") { dx = 0; dy = r; }
                                          else if (f.labelAlignment === "below") { dx = 0; dy = -r; }
                                          else if (f.labelAlignment === "left") { dx = -r; dy = 0; }
                                          else if (f.labelAlignment === "right") { dx = r; dy = 0; }
                                        }

                                        const handlePt = localToGlobal(
                                          bx + dx,
                                          by + dy,
                                        );

                                        return (
                                          <MovablePoint
                                            point={handlePt}
                                            color="#a855f7" // Purple color for Label Handle
                                            onMove={(pt) => {
                                              handleGizmoMove(f.id, "label");
                                              const baseGlobal = localToGlobal(bx, by);
                                              const dGlobalX = pt[0] - baseGlobal[0];
                                              const dGlobalY = pt[1] - baseGlobal[1];

                                              // Invert: local to global
                                              const theta1 = -(baseAngle + rot);
                                              const cos1 = Math.cos(theta1);
                                              const sin1 = Math.sin(theta1);
                                              let x1 = dGlobalX * cos1 - dGlobalY * sin1;
                                              let y1 = dGlobalX * sin1 + dGlobalY * cos1;

                                              x1 /= sx || 1;
                                              y1 /= sy || 1;

                                              const theta2 = baseAngle;
                                              const cos2 = Math.cos(theta2);
                                              const sin2 = Math.sin(theta2);
                                              const localDx = x1 * cos2 - y1 * sin2;
                                              const localDy = x1 * sin2 + y1 * cos2;

                                              setFunctions((prev) =>
                                                prev.map((fn) =>
                                                  fn.id === f.id
                                                    ? {
                                                      ...fn,
                                                      labelPosition: [
                                                        localDx,
                                                        localDy,
                                                      ],
                                                      labelAlignment: "custom",
                                                    }
                                                    : fn,
                                                ),
                                              );
                                            }}
                                          />
                                        );
                                      })()}

                                  {f.type === "point" &&
                                    (!activeGizmo ||
                                      activeGizmo.id !== f.id ||
                                      activeGizmo.type === "label") &&
                                    points.map((p, i) => {
                                      let dx = f.labelPosition?.[0] ?? 0.3;
                                      let dy = f.labelPosition?.[1] ?? 0.3;
                                      if (f.labelAlignment && f.labelAlignment !== "custom") {
                                        const r = 0.5;
                                        if (f.labelAlignment === "center") { dx = 0; dy = 0; }
                                        else if (f.labelAlignment === "above") { dx = 0; dy = r; }
                                        else if (f.labelAlignment === "below") { dx = 0; dy = -r; }
                                        else if (f.labelAlignment === "left") { dx = -r; dy = 0; }
                                        else if (f.labelAlignment === "right") { dx = r; dy = 0; }
                                      }

                                      const handlePt = localToGlobal(
                                        p[0] + dx,
                                        p[1] + dy,
                                      );
                                      return (
                                        <MovablePoint
                                          key={`lbl-point-${i}`}
                                          point={handlePt}
                                          color="#a855f7"
                                          onMove={(pt) => {
                                            handleGizmoMove(f.id, "label");
                                            const baseGlobal = localToGlobal(p[0], p[1]);
                                            const dGlobalX = pt[0] - baseGlobal[0];
                                            const dGlobalY = pt[1] - baseGlobal[1];

                                            const theta1 = -(baseAngle + rot);
                                            const cos1 = Math.cos(theta1);
                                            const sin1 = Math.sin(theta1);
                                            let x1 = dGlobalX * cos1 - dGlobalY * sin1;
                                            let y1 = dGlobalX * sin1 + dGlobalY * cos1;

                                            x1 /= sx || 1;
                                            y1 /= sy || 1;

                                            const theta2 = baseAngle;
                                            const cos2 = Math.cos(theta2);
                                            const sin2 = Math.sin(theta2);
                                            const localDx = x1 * cos2 - y1 * sin2;
                                            const localDy = x1 * sin2 + y1 * cos2;

                                            setFunctions((prev) =>
                                              prev.map((fn) =>
                                                fn.id === f.id
                                                  ? {
                                                    ...fn,
                                                    labelPosition: [
                                                      localDx,
                                                      localDy,
                                                    ],
                                                    labelAlignment: "custom",
                                                  }
                                                  : fn,
                                              ),
                                            );
                                          }}
                                        />
                                      );
                                    })}
                                </React.Fragment>
                              )}
                            </React.Fragment>
                          );
                        } catch {
                          return null;
                        }

                        // Handled under <Transform> blocks
                        return null;
                      }
                      return null;
                    });
                };
              }

              const MathNodesLayer = MathNodesLayerRef.current;

              return (
                <React.Fragment>
                  <MathNodesLayer isInteractionLayer={false} />
                  <MathNodesLayer isInteractionLayer={true} />
                </React.Fragment>
              );
            })()}
          </Mafs>

          {isFullscreen && (
            <div className="absolute bottom-4 right-4 md:bottom-auto md:top-4 z-30 bg-white/90 dark:bg-slate-900/80 backdrop-blur border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono p-3 rounded-lg shadow-2xl">
              <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1 border-b border-slate-200 dark:border-slate-700 pb-1">
                Inspector
              </div>
              <div className="flex flex-col gap-1 mt-2">
                {functions
                  .filter((f) => f.visible && f.compiled)
                  .map((f) => {
                    const fTime = f.hasCustomTimeline
                      ? f.time !== undefined
                        ? f.time
                        : 0
                      : time;
                    const fScope = { ...baseScope, t: fTime, time: time };
                    const baseScopeShadow = fScope;
                    try {
                      if (f.type === "function") {
                        const val = f.compiled.evaluate({
                          ...baseScopeShadow,
                          x: (fTime % 10) - 5,
                        });
                        if (
                          val == null ||
                          typeof val === "object" ||
                          typeof val === "function" ||
                          isNaN(Number(val))
                        )
                          return null;
                        const y = Number(val).toFixed(2);
                        return (
                          <div key={f.id} className="flex gap-2">
                            <span style={{ color: f.color }}>
                              f({((fTime % 10) - 5).toFixed(1)})
                            </span>
                            : {y}
                          </div>
                        );
                      } else if (
                        f.type === "parametric" ||
                        f.type === "polar"
                      ) {
                        const tVal = (fTime / 2) % (2 * Math.PI);
                        if (f.type === "polar") {
                          const useThetaAsAngle = /\btheta\b/.test(f.expr);
                          const scope = { ...baseScopeShadow };
                          if (useThetaAsAngle) {
                            scope.theta = tVal;
                            scope.x = tVal;
                          } else {
                            scope.t = tVal;
                            scope.x = tVal;
                            scope.theta = tVal;
                          }
                          const r = Number(f.compiled.evaluate(scope));
                          if (isNaN(r)) return null;
                          return (
                            <div key={f.id} className="flex gap-2">
                              <span style={{ color: f.color }}>
                                r({tVal.toFixed(1)})
                              </span>
                              : {r.toFixed(2)}
                            </div>
                          );
                        } else {
                          const res = f.compiled.evaluate({
                            ...baseScopeShadow,
                            t: tVal,
                          });
                          const arr = res && res.toArray ? res.toArray() : res;
                          if (
                            Array.isArray(arr) &&
                            arr.length >= 2 &&
                            !isNaN(Number(arr[0])) &&
                            !isNaN(Number(arr[1]))
                          ) {
                            return (
                              <div key={f.id} className="flex gap-2">
                                <span style={{ color: f.color }}>
                                  [x,y]({tVal.toFixed(1)})
                                </span>
                                : [{Number(arr[0]).toFixed(2)},{" "}
                                {Number(arr[1]).toFixed(2)}]
                              </div>
                            );
                          }
                        }
                      } else if (f.type === "point" || f.type === "vector") {
                        const res = resolveGeometryPoints(f, baseScopeShadow);
                        if (res.points && res.points.length > 0) {
                          const pt = res.points[0];
                          return (
                            <div key={f.id} className="flex gap-2">
                              <span style={{ color: f.color }}>
                                {f.type === "point" ? "P" : "V"}
                              </span>
                              : [{pt[0].toFixed(2)}, {pt[1].toFixed(2)}]
                            </div>
                          );
                        }
                      }
                      return null;
                    } catch {
                      return null;
                    }
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Help Modal Overlay */}
        {showHelp &&
          createPortal(
            <MathHelpPopup
              isOpen={showHelp}
              onClose={() => setShowHelp(false)}
              onInsertFormula={handleInsertFunctionFromHelp}
            />,
            document.body,
          )}

        {/* Editor Modal Overlay */}
        {showVarEditor &&
          createPortal(
            <VariableEditorModal
              variable={editingVar}
              groups={groups}
              existingVariables={variables}
              onSave={(newVar: any, newGroup?: any) => {
                if (newGroup) {
                  setGroups((prev) => {
                    if (
                      prev.some(
                        (g) =>
                          g.id === newGroup.id ||
                          g.name.toLowerCase() === newGroup.name.toLowerCase(),
                      )
                    ) {
                      return prev;
                    }
                    return [...prev, newGroup];
                  });
                }
                if (variables.some((v: any) => v.id === newVar.id)) {
                  handleUpdateVar(newVar.id, newVar);
                } else {
                  setVariables((prev) => [...prev, newVar]);
                }
                setShowVarEditor(false);
                setEditingVar(null);
              }}
              onClose={() => {
                setShowVarEditor(false);
                setEditingVar(null);
              }}
            />,
            document.body,
          )}
      </div>
    </div>
  );

  return isFullscreen ? (
    <React.Fragment>
      <div className="w-full h-full flex items-center justify-center bg-slate-900 border border-slate-700 rounded-xl relative overflow-hidden group">
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <svg width="100%" height="100%">
            <pattern
              id="math-grid"
              width="20"
              height="20"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 20 0 L 0 0 0 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                className="text-slate-500"
              />
            </pattern>
            <rect width="100%" height="100%" fill="url(#math-grid)" />
          </svg>
        </div>
        <div className="flex flex-col items-center gap-3 z-10">
          <Layers className="text-blue-500 w-12 h-12 opacity-80" />
          <span className="text-sm font-semibold text-slate-300">
            Math Graph Maximized
          </span>
          <button
            onClick={() => setIsFullscreen(false)}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors shadow-lg"
          >
            Restore View
          </button>
        </div>
      </div>
      {createPortal(content, document.body)}
    </React.Fragment>
  ) : (
    content
  );
};
