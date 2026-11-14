import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  Radio,
  Calculator,
  ListTodo,
  Layers,
  ArrowRight,
  ExternalLink,
  Code2,
  Check,
  Copy,
  PlusCircle,
  X,
  AlertCircle,
  FolderPlus,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { db } from '../lib/db';
import { isDocumentEmpty } from '../utils/documentUtils';

export interface StarterTemplate {
  id: string;
  title: string;
  badge: string;
  tagline: string;
  description: string;
  accentGradient: string;
  badgeColor: string;
  borderHoverColor: string;
  icon: React.ReactNode;
  tags: string[];
  keyFeatures: string[];
  code: string;
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'api-testing',
    title: 'API Testing & Inspection',
    badge: 'REST APIs & Chaining',
    tagline: 'Send live requests, inspect payloads, and chain variables across endpoints',
    description: 'Pre-configured with live public APIs (GitHub, CoinGecko, DummyJSON, JSONPlaceholder). Execute queries directly on canvas nodes, view formatted response cards, and interpolate variables with {{node.property}}.',
    accentGradient: 'from-blue-500/20 via-cyan-500/20 to-indigo-500/10 dark:from-blue-500/25 dark:via-cyan-500/20 dark:to-indigo-500/15',
    badgeColor: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
    borderHoverColor: 'hover:border-cyan-500/50 hover:shadow-cyan-500/10',
    icon: <Radio className="w-6 h-6 text-cyan-600 dark:text-cyan-400" />,
    tags: ['Live Fetch', 'Variable Chaining', 'JSON Inspect'],
    keyFeatures: [
      'Interactive "Send Request" buttons on nodes',
      'Variable chaining: {{github_profile.organizations_url}}',
      'Auto response formatting with copy & download'
    ],
    code: `{
  "api_testing_hub": {
    "title": "API Testing & Chaining Workspace",
    "environment": "Live Sandboxes",
    "github_profile_api_node": "https://api.github.com/users/octocat",
    "crypto_rates_api_node": "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=usd",
    "random_quote_api_node": "https://dummyjson.com/quotes/random",
    "sample_todo_api_node": "https://jsonplaceholder.typicode.com/todos/1",
    "settings": {
      "cors_proxy_mode": "browser_fallback",
      "auto_view_response": true,
      "timeout_ms": 5000
    }
  }
}`
  },
  {
    id: 'interactive-math',
    title: 'Interactive Math & Graphs',
    badge: 'Mafs 2D Plotting',
    tagline: 'Dynamic mathematical curves, Fourier harmonics, and real-time variable sliders',
    description: 'Pre-configured mathematical grapher nodes powered by Mafs. Explore harmonic wave superposition, parametric curves, and damped oscillations with live sliders modulating variables.',
    accentGradient: 'from-fuchsia-500/20 via-purple-500/20 to-pink-500/10 dark:from-fuchsia-500/25 dark:via-purple-500/20 dark:to-pink-500/15',
    badgeColor: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-500/30',
    borderHoverColor: 'hover:border-fuchsia-500/50 hover:shadow-fuchsia-500/10',
    icon: <Calculator className="w-6 h-6 text-fuchsia-600 dark:text-fuchsia-400" />,
    tags: ['Calculus', 'Waves', 'Live Sliders'],
    keyFeatures: [
      'Interactive coordinate plane with zoom & pan',
      'Fourier harmonics: sin(x * a) + 0.5 * sin(3 * x * a)',
      'Dynamic variable slider [a = 1.5] updating in real-time'
    ],
    code: `{
  "math_visualizer": {
    "title": "Fourier Harmonics & Damped Oscillation",
    "wave_harmonics_math_node": {
      "functions": [
        {
          "id": "f1",
          "expr": "sin(x * a) + 0.5 * sin(3 * x * a)",
          "color": "#6366f1",
          "visible": true,
          "type": "function"
        },
        {
          "id": "f2",
          "expr": "cos(x * 1.5) * exp(-0.15 * abs(x))",
          "color": "#06b6d4",
          "visible": true,
          "type": "function"
        },
        {
          "id": "f3",
          "expr": "0.2 * x^2 - 3",
          "color": "#ec4899",
          "visible": true,
          "type": "function"
        }
      ],
      "variables": [
        {
          "id": "v1",
          "name": "a",
          "value": 1.5,
          "min": 0.2,
          "max": 4,
          "step": 0.1
        }
      ]
    },
    "polar_flower_math_node": {
      "functions": [
        {
          "id": "f_polar",
          "expr": "sin(2 * x) * cos(x)",
          "color": "#10b981",
          "visible": true,
          "type": "function"
        }
      ],
      "variables": []
    },
    "instructions": "Interact with coordinate axes or drag the slider [a] to modulate frequencies live."
  }
}`
  },
  {
    id: 'project-management',
    title: 'Project Management',
    badge: 'Kanban & Roadmap',
    tagline: 'Interactive sprint backlog, milestone tracking, and architecture documentation',
    description: 'Embedded productivity workflow within the node graph. Features an interactive Kanban todo node with status columns (Todo, In Progress, Completed), task priorities, and tags alongside team milestones.',
    accentGradient: 'from-amber-500/20 via-orange-500/20 to-yellow-500/10 dark:from-amber-500/25 dark:via-orange-500/20 dark:to-yellow-500/15',
    badgeColor: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
    borderHoverColor: 'hover:border-amber-500/50 hover:shadow-amber-500/10',
    icon: <ListTodo className="w-6 h-6 text-amber-600 dark:text-amber-400" />,
    tags: ['Kanban Board', 'Roadmap', 'Sprint Backlog'],
    keyFeatures: [
      'Interactive Kanban task board with status switches',
      'Task priority pills (Critical, High, Normal) & tags',
      'Sprint milestones and team responsibility hierarchy'
    ],
    code: `{
  "project_management": {
    "workspace": "Product Launch Q4 Roadmap",
    "active_sprint": "Sprint 14 - Production Readiness",
    "sprint_backlog_todo_node": {
      "title": "Interactive Sprint Backlog",
      "tasks": [
        {
          "id": "task_1",
          "text": "Design sleek glassmorphic UI design tokens",
          "status": "Completed",
          "priority": "High",
          "tags": ["ui", "design"]
        },
        {
          "id": "task_2",
          "text": "Optimize WebAssembly Pyodide bundle caching",
          "status": "In Progress",
          "priority": "Critical",
          "tags": ["wasm", "performance"]
        },
        {
          "id": "task_3",
          "text": "Verify WebRTC peer-to-peer data channel encryption",
          "status": "In Progress",
          "priority": "Normal",
          "tags": ["webrtc", "networking"]
        },
        {
          "id": "task_4",
          "text": "Comprehensive cross-browser rendering QA audit",
          "status": "Todo",
          "priority": "High",
          "tags": ["qa", "testing"]
        }
      ]
    },
    "milestones": [
      { "name": "Alpha Preview", "completed": true, "target_date": "2026-09-15" },
      { "name": "Public Beta", "completed": true, "target_date": "2026-10-01" },
      { "name": "Global Launch", "completed": false, "target_date": "2026-11-15" }
    ],
    "team_leads": {
      "architect": "Elena Rostova",
      "frontend_lead": "Marcus Vance",
      "design_lead": "Aria Chen"
    }
  }
}`
  },
  {
    id: 'json-explorer',
    title: 'JSON Data Explorer',
    badge: 'Deep Data & Hierarchy',
    tagline: 'Multi-tiered enterprise catalog with telemetry metrics, inventories, and services',
    description: 'Designed to showcase the full power of the hierarchical layout engine. Drill down into deeply nested objects, arrays of entities, metrics, and cloud clusters with instant collapse/expand controls.',
    accentGradient: 'from-emerald-500/20 via-teal-500/20 to-sky-500/10 dark:from-emerald-500/25 dark:via-teal-500/20 dark:to-sky-500/15',
    badgeColor: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    borderHoverColor: 'hover:border-emerald-500/50 hover:shadow-emerald-500/10',
    icon: <Layers className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />,
    tags: ['Nested Data', 'Arrays', 'Collapsible'],
    keyFeatures: [
      'Multi-level enterprise catalog with technical specs',
      'Collapsible branches & table view inspection',
      'Seamless layout switching: Horizontal, Radial & Mind Map'
    ],
    code: `{
  "global_enterprise_explorer": {
    "organization": "Nexus Global Retail",
    "status": "operational",
    "regions": ["us-east", "eu-central", "ap-southeast"],
    "telemetry": {
      "active_users": 184520,
      "orders_per_minute": 620,
      "uptime_sla_pct": 99.99,
      "latency_p99_ms": 28
    },
    "catalog_products": [
      {
        "sku": "NX-990-PRO",
        "name": "Neural Acoustic Studio Headphones",
        "category": "Audio",
        "price_usd": 349.99,
        "rating": 4.9,
        "in_stock": true,
        "warehouses": { "virginia": 420, "frankfurt": 210, "tokyo": 180 },
        "specifications": {
          "driver_size_mm": 50,
          "battery_life_hours": 42,
          "active_anc": true,
          "codecs": ["LDAC", "aptX HD", "AAC"]
        }
      },
      {
        "sku": "NX-490-ULTRA",
        "name": "Curved OLED Cinematic Display 49\\"",
        "category": "Monitors",
        "price_usd": 1299.00,
        "rating": 4.8,
        "in_stock": true,
        "warehouses": { "virginia": 85, "frankfurt": 64, "tokyo": 30 },
        "specifications": {
          "resolution": "5120x1440",
          "refresh_rate_hz": 240,
          "panel": "QD-OLED",
          "hdr": "DisplayHDR 1000"
        }
      }
    ],
    "cloud_infrastructure": {
      "primary_cluster": "k8s-prod-us-east-1",
      "active_nodes": 32,
      "mesh_services": [
        { "name": "auth-service", "replicas": 4, "healthy": true },
        { "name": "catalog-indexer", "replicas": 6, "healthy": true },
        { "name": "payment-gateway", "replicas": 8, "healthy": true }
      ]
    }
  }
}`
  }
];

interface BlankCanvasTemplateGalleryProps {
  isModal?: boolean;
  onClose?: () => void;
}

export function BlankCanvasTemplateGallery({ isModal = false, onClose }: BlankCanvasTemplateGalleryProps) {
  const navigate = useNavigate();
  const code = useStore((state) => state.code);
  const activeDocumentId = useStore((state) => state.activeDocumentId);
  const activeDocumentName = useStore((state) => state.activeDocumentName);
  const setActiveDocumentId = useStore((state) => state.setActiveDocumentId);
  const setActiveDocumentName = useStore((state) => state.setActiveDocumentName);
  const setLastSavedCode = useStore((state) => state.setLastSavedCode);
  const setIsDirty = useStore((state) => state.setIsDirty);
  const setCode = useStore((state) => state.setCode);
  const setCodeFormat = useStore((state) => state.setCodeFormat);
  const setNotification = useStore((state) => state.setNotification);
  const setIsTemplateGalleryOpen = useStore((state) => state.setIsTemplateGalleryOpen);

  const [previewId, setPreviewId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<StarterTemplate | null>(null);
  const [templateDocName, setTemplateDocName] = useState<string>('');

  const isCurrentDocEmpty = isDocumentEmpty(code);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedTemplate) {
          setSelectedTemplate(null);
          return;
        }
        if (isModal) {
          setIsTemplateGalleryOpen(false);
          if (onClose) onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    let origOverflow = '';
    if (isModal) {
      origOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }

    return () => {
      if (isModal) {
        document.body.style.overflow = origOverflow;
      }
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isModal, onClose, setIsTemplateGalleryOpen, selectedTemplate]);

  const handleSelectTemplate = (template: StarterTemplate) => {
    setSelectedTemplate(template);
    setTemplateDocName(template.title);
  };

  const handleOverwriteCurrent = (template: StarterTemplate) => {
    setCodeFormat('json');
    setCode(template.code);
    if (activeDocumentId) {
      setIsDirty(true);
    }

    // Clear runtime states to prevent stale node executions
    useStore.setState({
      apiNodeResponses: {},
      apiNodeLoading: {},
      apiNodeErrors: {},
      jsNodeResponses: {},
      jsNodeLoading: {},
      jsNodeErrors: {},
      jsNodeDurations: {},
      jsNodeLastRuns: {},
      jsNodeLogs: {},
      activePreviewMedia: null,
      activePreviewText: null,
      globalTextExpanded: false,
      collapsedNodes: new Set(),
    });

    setSelectedTemplate(null);
    setIsTemplateGalleryOpen(false);
    if (onClose) onClose();

    setNotification({
      message: `Loaded template into current document: ${template.title}`,
      type: 'success',
    });

    // Automatically auto-fit the view to center the newly rendered nodes
    setTimeout(() => {
      const fitBtn = document.getElementById('fit-graph-btn');
      if (fitBtn) fitBtn.click();
    }, 250);
  };

  const handleCreateNewWithTemplate = async (template: StarterTemplate) => {
    const docTitle = templateDocName.trim() || template.title;
    try {
      const newId = await db.documents.add({
        name: docTitle,
        code: template.code,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isPinned: false,
      });

      setActiveDocumentId(newId as number);
      setActiveDocumentName(docTitle);
      setLastSavedCode(template.code);
      setIsDirty(false);
      setCodeFormat('json');
      setCode(template.code);

      // Clear runtime states
      useStore.setState({
        apiNodeResponses: {},
        apiNodeLoading: {},
        apiNodeErrors: {},
        jsNodeResponses: {},
        jsNodeLoading: {},
        jsNodeErrors: {},
        jsNodeDurations: {},
        jsNodeLastRuns: {},
        jsNodeLogs: {},
        activePreviewMedia: null,
        activePreviewText: null,
        globalTextExpanded: false,
        collapsedNodes: new Set(),
      });

      setSelectedTemplate(null);
      setIsTemplateGalleryOpen(false);
      if (onClose) onClose();

      setNotification({
        message: `Created new document: "${docTitle}"`,
        type: 'success',
      });

      setTimeout(() => {
        const fitBtn = document.getElementById('fit-graph-btn');
        if (fitBtn) fitBtn.click();
      }, 250);
    } catch (err) {
      console.error('Failed to create document from template:', err);
      setNotification({
        message: 'Failed to create document from template',
        type: 'error',
      });
    }
  };

  const handleStartBlank = () => {
    if (!isCurrentDocEmpty) {
      setSelectedTemplate({
        id: 'blank-workspace',
        title: 'Blank Workspace',
        badge: 'Blank',
        tagline: 'Start fresh with a clean slate',
        description: 'New blank workspace',
        accentGradient: 'from-slate-500/10 to-slate-500/20',
        badgeColor: 'border-slate-500/30 text-slate-500 bg-slate-500/10',
        borderHoverColor: 'hover:border-slate-400',
        icon: <PlusCircle size={20} className="text-slate-500" />,
        tags: ['blank', 'empty'],
        keyFeatures: ['Empty workspace', 'Clean root node'],
        code: '{\n  "workspace": "My Blank Workspace"\n}',
      });
      return;
    }

    setCodeFormat('json');
    setCode('{\n  "workspace": "My Blank Workspace"\n}');
    setIsTemplateGalleryOpen(false);
    if (onClose) onClose();

    setNotification({
      message: 'Started new blank project',
      type: 'info',
    });
  };

  const handleCopyCode = async (e: React.MouseEvent, template: StarterTemplate) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(template.code);
      setCopiedId(template.id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // Fallback
    }
  };

  const content = (
    <div className="w-full max-w-5xl mx-auto flex flex-col items-center">
      {/* Hero Header */}
      <div className="text-center mb-6 sm:mb-8 max-w-2xl px-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 mb-3.5 shadow-sm backdrop-blur-md">
          <Sparkles size={13} className="text-indigo-500 animate-pulse" />
          <span>Interactive Starter Templates</span>
        </div>
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white mb-2.5">
          Explore the Full Power of Data Visualizer
        </h1>
        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Launch pre-configured interactive nodes in one click. Experience live API execution,
          dynamic 2D math graphs, embedded Kanban boards, and deep hierarchical data.
        </p>
      </div>

      {/* 2x2 Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 w-full mb-6">
        {STARTER_TEMPLATES.map((template) => {
          const isPreviewing = previewId === template.id;

          return (
            <div
              key={template.id}
              onClick={() => handleSelectTemplate(template)}
              className={`group relative flex flex-col justify-between p-4 sm:p-5 rounded-2xl bg-white/70 dark:bg-[#0f172a]/75 backdrop-blur-xl border border-slate-200/90 dark:border-slate-800/80 shadow-md hover:shadow-xl transition-all duration-300 cursor-pointer overflow-hidden ${template.borderHoverColor}`}
            >
              {/* Subtle Ambient Gradient Glow */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${template.accentGradient} opacity-40 group-hover:opacity-80 transition-opacity pointer-events-none`}
              />

              <div className="relative z-10">
                {/* Header Row */}
                <div className="flex items-start justify-between gap-3 mb-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/90 dark:bg-slate-900/90 border border-slate-200/80 dark:border-slate-800 shadow-sm group-hover:scale-105 transition-transform">
                      {template.icon}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {template.title}
                      </h2>
                      <span className={`inline-block px-2 py-0.5 mt-0.5 rounded text-[10px] font-semibold border ${template.badgeColor}`}>
                        {template.badge}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => handleCopyCode(e, template)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors"
                      title="Copy JSON Payload"
                      aria-label="Copy JSON Payload"
                    >
                      {copiedId === template.id ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewId(isPreviewing ? null : template.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 transition-colors"
                      title={isPreviewing ? 'Hide Code' : 'Preview JSON'}
                      aria-label="Preview JSON"
                    >
                      <Code2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-slate-600 dark:text-slate-300 font-medium mb-3 leading-relaxed">
                  {template.tagline}
                </p>

                {/* Key features bullets */}
                <ul className="space-y-1 mb-3.5">
                  {template.keyFeatures.map((feat, idx) => (
                    <li key={idx} className="flex items-center text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500/70 mr-2 shrink-0" />
                      <span className="truncate">{feat}</span>
                    </li>
                  ))}
                </ul>

                {/* JSON Preview Drawer if toggled */}
                {isPreviewing && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mb-3.5 p-2.5 rounded-xl bg-slate-950 text-slate-300 font-mono text-[10px] leading-relaxed max-h-36 overflow-auto custom-scrollbar border border-slate-800"
                  >
                    <pre className="whitespace-pre-wrap">{template.code}</pre>
                  </div>
                )}
              </div>

              {/* Bottom Card Footer */}
              <div className="relative z-10 pt-2 border-t border-slate-200/60 dark:border-slate-800/60 flex items-center justify-between">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  {template.tags.map((t, idx) => (
                    <span
                      key={idx}
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 truncate"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-1 text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-1 transition-transform ml-2 shrink-0">
                  <span>Launch</span>
                  <ArrowRight size={13} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Action Footer */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 w-full pt-1">
        <button
          type="button"
          onClick={handleStartBlank}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700/80 border border-slate-300/80 dark:border-slate-700 transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <PlusCircle size={14} className="text-slate-500" />
          <span>Start with Blank Workspace</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsTemplateGalleryOpen(false);
            if (onClose) onClose();
            navigate('/examples');
          }}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:text-indigo-300 border border-indigo-500/25 transition-all cursor-pointer shadow-sm active:scale-95"
        >
          <ExternalLink size={14} />
          <span>Browse All 10+ Interactive Templates</span>
        </button>
      </div>

      <div className="mt-4 text-center">
        <p className="text-[11px] text-slate-600 dark:text-slate-400">
          Tip: You can also drop any JSON, YAML, CSV, PDF, or image file directly anywhere onto the canvas.
        </p>
      </div>
    </div>
  );

  const templateChoiceModal = selectedTemplate && createPortal(
    <div
      // A sheet from the bottom on a phone, a card in the middle on larger screens.
      className="fixed inset-0 z-[100005] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={() => setSelectedTemplate(null)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Use the ${selectedTemplate.title} template`}
        className="relative w-full sm:max-w-md max-h-[92dvh] overflow-y-auto bg-white dark:bg-[#11151f] border-t sm:border border-slate-200 dark:border-white/10 rounded-t-3xl sm:rounded-2xl shadow-2xl animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Grab bar: it's a sheet */}
        <div className="sm:hidden flex justify-center pt-2.5">
          <span className="h-1 w-10 rounded-full bg-slate-300 dark:bg-white/15" />
        </div>

        <div className="px-5 pt-4 sm:pt-5">
          {/* What it is */}
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10">
              {selectedTemplate.icon || <Sparkles size={20} />}
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-[15px] font-semibold leading-snug text-slate-900 dark:text-white">{selectedTemplate.title}</h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className="truncate">{selectedTemplate.badge || 'Template'}</span>
                <span aria-hidden>·</span>
                <span className="shrink-0">Starter template</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedTemplate(null)}
              className="-mr-1.5 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          {selectedTemplate.tagline && (
            <p className="mt-3 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{selectedTemplate.tagline}</p>
          )}

          <div className="my-4 h-px bg-slate-200 dark:bg-white/[0.08]" />

          {/* A new document */}
          <label htmlFor="template-doc-name" className="block text-[12px] font-medium text-slate-700 dark:text-slate-300">
            Name of the new document
          </label>
          <input
            id="template-doc-name"
            type="text"
            value={templateDocName}
            onChange={(e) => setTemplateDocName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateNewWithTemplate(selectedTemplate);
            }}
            placeholder={selectedTemplate.title}
            className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] px-3.5 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/25 transition"
          />
          <button
            type="button"
            onClick={() => handleCreateNewWithTemplate(selectedTemplate)}
            className="mt-2.5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-sm font-semibold text-white shadow-sm transition-colors"
          >
            <FolderPlus size={16} />
            Create new document
          </button>
          <p className="mt-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">Saved to your documents and opened.</p>

          {/* Or this workspace */}
          <div className="my-4 flex items-center gap-3 text-[11px] text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/[0.08]" />
            or
            <span className="h-px flex-1 bg-slate-200 dark:bg-white/[0.08]" />
          </div>
          <button
            type="button"
            onClick={() => handleOverwriteCurrent(selectedTemplate)}
            className={`inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border text-sm font-semibold transition-colors ${
              isCurrentDocEmpty
                ? 'border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.05]'
                : 'border-amber-300/70 dark:border-amber-500/30 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10'
            }`}
          >
            <RefreshCw size={15} />
            Use in this workspace
          </button>
          <p
            className={`mt-1.5 flex items-start justify-center gap-1.5 text-center text-[11px] leading-snug ${
              isCurrentDocEmpty ? 'text-slate-500 dark:text-slate-400' : 'text-amber-700 dark:text-amber-300/90'
            }`}
          >
            {!isCurrentDocEmpty && <AlertCircle size={12} className="mt-px shrink-0" />}
            <span>
              {isCurrentDocEmpty
                ? 'Your workspace is empty: the template loads straight into it.'
                : `Replaces what's in ${activeDocumentName ? `"${activeDocumentName}"` : 'the current document'}; unsaved changes are lost.`}
            </span>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );

  if (isModal) {
    return (
      <>
        {createPortal(
          <div
            className="fixed inset-0 z-[100000] flex items-center justify-center p-0 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
            onClick={() => {
              setIsTemplateGalleryOpen(false);
              if (onClose) onClose();
            }}
          >
            <div
              className="relative w-full h-[100dvh] sm:h-auto sm:max-h-[90vh] sm:max-w-5xl overflow-y-auto custom-scrollbar bg-slate-50 dark:bg-[#0b0f19] rounded-none sm:rounded-3xl border-0 sm:border border-slate-200/90 dark:border-slate-800 p-4 sm:p-8 shadow-2xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => {
                  setIsTemplateGalleryOpen(false);
                  if (onClose) onClose();
                }}
                className="absolute top-3.5 right-3.5 sm:top-5 sm:right-5 p-2 sm:p-2.5 rounded-full text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white bg-slate-200/80 hover:bg-slate-300 dark:bg-slate-800/80 dark:hover:bg-slate-700 transition-colors cursor-pointer z-30 shadow-sm"
                title="Close Gallery (Esc)"
                aria-label="Close"
              >
                <X size={18} />
              </button>
              {content}
            </div>
          </div>,
          document.body
        )}
        {templateChoiceModal}
      </>
    );
  }

  return (
    <>
      {/* nodrag: the canvas's zoom leaves wheel and touch alone here, so the page scrolls. */}
      <div className="nodrag absolute inset-0 z-20 overflow-y-auto overscroll-contain touch-pan-y custom-scrollbar pointer-events-auto p-4 sm:p-6 md:p-8">
        <div className="min-h-full flex flex-col justify-center items-center py-4">
          {content}
        </div>
      </div>
      {templateChoiceModal}
    </>
  );
}
