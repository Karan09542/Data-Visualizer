import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ai } from '../../../../ai';
import { AITask, AIProgressState, DepthEstimationResult } from '../../../../ai/types';
import { aiEventBus } from '../../../../ai/events/AIEventBus';
import { useSelection } from '../../contexts/SelectionContext';
import { Sparkles, Scissors, Sun, Zap, Search, Settings2, Loader2, X, CheckCircle2, AlertCircle, Download, Briefcase, Layers, Palette, ScanSearch, CircleDot, Box, Droplet, Cloud } from 'lucide-react';
import * as fabric from 'fabric';
import { modelRegistry } from '../../../../ai/registry/ModelRegistry';
import { UpscaleCommand } from '../../commands/ai/UpscaleCommand';
import { EnhanceLowLightCommand } from '../../commands/ai/EnhanceLowLightCommand';
import { SegmentationCommand } from '../../commands/ai/SegmentationCommand';
import { AutoEnhanceCommand } from '../../commands/ai/AutoEnhanceCommand';
import { FaceUtilityCommand } from '../../commands/ai/FaceUtilityCommand';
import { DepthEstimationCommand, DepthMode } from '../../commands/ai/DepthEstimationCommand';
import { StyleTransferCommand } from '../../commands/ai/StyleTransferCommand';
import { AIModelManagerModal } from '../shared/AIModelManagerModal';
import { SegmentationPanel } from './SegmentationPanel';
import { OfficeUtilitiesPanel } from './OfficeUtilitiesPanel';
import { PassportPrintModal } from '../shared/PassportPrintModal';
import { Depth3DViewerModal } from '../shared/Depth3DViewerModal';
import { aiQueue } from '../../../../ai/manager/AIQueue';
import { ModelDownloadGate } from '../shared/ModelDownloadGate';
import { useModelDownload } from '../../../../ai/hooks/useModelDownload';

interface AIToolsPanelProps {
  selectionType: string | null;
  executeCommand: (cmd: any) => void;
}

const TASK_CONFIG: Record<string, { label: string, desc: string, icon: React.ReactNode, commandClass?: any, colorClass: string, accentHex: string }> = {
  'upscale': {
    label: 'Upscale Image',
    desc: 'Enhance resolution using AI',
    icon: <Search size={14} />,
    commandClass: UpscaleCommand,
    colorClass: 'text-blue-400 border-blue-500 bg-blue-500',
    accentHex: '#3b82f6'
  },
  'low-light': {
    label: 'Enhance Low Light',
    desc: 'Recover details in dark photos',
    icon: <Sun size={14} />,
    commandClass: EnhanceLowLightCommand,
    colorClass: 'text-amber-400 border-amber-500 bg-amber-500',
    accentHex: '#f59e0b'
  },
  'auto-enhance': {
    label: 'AI Auto Enhance',
    desc: 'One-click AI chained enhancement',
    icon: <Sparkles size={14} />,
    commandClass: AutoEnhanceCommand,
    colorClass: 'text-emerald-400 border-emerald-500 bg-emerald-500',
    accentHex: '#10b981'
  },
  'depth-estimation': {
    label: 'Depth Map',
    desc: 'Depth map, colored map, or interactive 3D',
    icon: <Layers size={14} />,
    colorClass: 'text-cyan-400 border-cyan-500 bg-cyan-500',
    accentHex: '#06b6d4'
  },
  'style-transfer': {
    label: 'Style Transfer',
    desc: 'Apply artistic style from another image',
    icon: <Palette size={14} />,
    colorClass: 'text-purple-400 border-purple-500 bg-purple-500',
    accentHex: '#a855f7'
  }
};

const STATE_LABELS: Partial<Record<AIProgressState, string>> = {
  'queued': 'Queued…',
  'downloading': 'Downloading model…',
  'loading-model': 'Loading model…',
  'preparing-image': 'Preparing image…',
  'inference': 'Running AI…',
  'post-processing': 'Post-processing…',
  'encoding': 'Encoding output…',
  'completed': 'Done!',
  'failed': 'Failed',
  'cancelled': 'Cancelled'
};

interface TaskJobInfo {
  jobId: string;
  state: AIProgressState;
  progress: number;
}

const AIToolButton = ({ task, jobInfo, selectedModel: chosenModel, onSelectModel, onClick, onCancel }: {
  task: AITask;
  jobInfo: TaskJobInfo | null;
  /** Which model runs this task. Held by the panel, so every control for the task agrees on it. */
  selectedModel?: string;
  onSelectModel: (modelId: string) => void;
  onClick: (modelId?: string) => void;
  onCancel: () => void;
}) => {
  const config = TASK_CONFIG[task];
  
  const models = modelRegistry.getForTask(task);
  const selectedModel = chosenModel && models.some(m => m.id === chosenModel) ? chosenModel : models[0]?.id;
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);


  // Availability of the model this button would run. Hooks must run before the early return.
  const { isReady } = useModelDownload(selectedModel);

  if (!config) return null;

  const isActive = jobInfo && !['completed', 'failed', 'cancelled'].includes(jobInfo.state);
  const isDone = jobInfo?.state === 'completed';
  const isFailed = jobInfo?.state === 'failed';
  const isDownloading = jobInfo?.state === 'downloading';
  const progress = jobInfo?.progress ?? 0;

  // The model has to be on the device before the task can run. Surfacing it here means the
  // download is explicit and interruptible, rather than happening silently on first use.
  if (!isReady && !isActive && models.length > 0) {
    return (
      <div className="relative rounded-xl z-10">
        <ModelDownloadGate modelId={selectedModel} label={config.label} />
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl ${isDropdownOpen ? 'z-50' : 'z-10'}`}>
      <button
        onClick={isActive ? undefined : () => onClick(selectedModel)}
        className={`w-full p-3 border rounded-xl text-left transition duration-150 group flex items-center gap-3 relative z-[1] ${
          isActive
            ? 'border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#1A1A1A] cursor-wait'
            : isDone
            ? 'border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10'
            : isFailed
            ? 'border-red-500/30 bg-red-500/5'
            : 'border-slate-200 dark:border-[#2D2D2D] bg-white dark:bg-[#1A1A1A] hover:bg-slate-50 dark:hover:bg-[#222] hover:border-slate-300 dark:hover:border-white/20 active:scale-[0.98]'
        }`}
      >
        {isActive && (
          <div
            className="absolute inset-0 z-0 transition-all duration-300 ease-out rounded-xl"
            style={{
              width: `${Math.max(progress, 2)}%`,
              background: `linear-gradient(90deg, ${config.accentHex}15, ${config.accentHex}25)`,
            }}
          />
        )}

        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 relative z-[1] ${
          isActive ? 'animate-pulse' : ''
        }`} style={{ backgroundColor: `${config.accentHex}15` }}>
          {isActive ? (
            <Loader2 size={14} className="animate-spin" style={{ color: config.accentHex }} />
          ) : isDone ? (
            <CheckCircle2 size={14} className="text-emerald-400" />
          ) : isFailed ? (
            <AlertCircle size={14} className="text-red-400" />
          ) : (
            <div className={config.colorClass.split(' ')[0]}>{config.icon}</div>
          )}
        </div>

        <div className="flex-1 min-w-0 relative z-[1]">
          <div className={`font-semibold text-sm transition-colors ${
            isActive ? 'text-slate-900 dark:text-white' : isDone ? 'text-emerald-300' : isFailed ? 'text-red-300' : 'text-slate-900 dark:text-white group-hover:text-blue-300'
          }`}>
            {config.label}
          </div>
          <div className="text-[10px] mt-0.5 flex items-center gap-1.5">
            {isActive ? (
              <>
                <span style={{ color: config.accentHex }} className="font-medium">
                  {STATE_LABELS[jobInfo!.state] || jobInfo!.state}
                </span>
                {isDownloading && progress > 0 && (
                  <span className="text-white/70 font-mono font-bold tabular-nums">
                    {Math.round(progress)}%
                  </span>
                )}
              </>
            ) : (
              <span className="text-slate-500 dark:text-[#8A8A8A]">{config.desc}</span>
            )}
            
            {models.length > 1 && !isActive && (
              <div 
                className="relative ml-auto"
                onClick={e => e.stopPropagation()}
                onMouseLeave={() => setIsDropdownOpen(false)}
              >
                <div 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`flex items-center gap-1.5 bg-slate-100 dark:bg-black/40 hover:bg-slate-200 dark:hover:bg-black/60 border ${isDropdownOpen ? 'border-slate-300 dark:border-white/30 bg-slate-200 dark:bg-black/60' : 'border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'} rounded-md px-2 py-0.5 cursor-pointer text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white transition-all group/pill`}
                  title="Click to select model"
                >
                  <Settings2 size={10} className={`opacity-50 group-hover/pill:opacity-100 transition-all ${isDropdownOpen ? 'opacity-100 rotate-90' : ''}`} />
                  <span className="text-[9px] font-bold uppercase tracking-widest mt-px">
                    {selectedModel}
                  </span>
                </div>

                {isDropdownOpen && (
                  <div className="absolute right-0 top-full pt-2 z-[100]">
                    <div className="w-56 bg-white dark:bg-[#1A1A1A] border border-slate-200 dark:border-[#333] rounded-lg shadow-2xl animate-in fade-in slide-in-from-top-2 duration-150 flex flex-col overflow-hidden">
                      <div className="px-3 py-2 border-b border-slate-200 dark:border-[#2D2D2D] bg-slate-50 dark:bg-[#111] rounded-t-lg">
                        <div className="text-[9px] font-bold text-slate-500 dark:text-white/50 uppercase tracking-widest">Select AI Model</div>
                      </div>
                      <div className="max-h-[220px] overflow-y-auto">
                        {models.map(m => (
                          <div 
                            key={m.id}
                            onClick={() => {
                              onSelectModel(m.id);
                              setIsDropdownOpen(false);
                            }}
                            className={`px-3 py-2.5 cursor-pointer transition-colors border-b border-slate-100 dark:border-[#222] last:border-0 ${m.id === selectedModel ? 'bg-blue-500/10' : 'hover:bg-slate-100 dark:hover:bg-[#252525]'}`}
                          >
                            <div className={`text-[10px] font-bold uppercase tracking-wider ${m.id === selectedModel ? 'text-blue-400' : 'text-slate-800 dark:text-white/90'}`}>
                              {m.id}
                            </div>
                            <div className={`text-[9px] mt-1 leading-snug ${m.id === selectedModel ? 'text-blue-600 dark:text-blue-300/70' : 'text-slate-500 dark:text-[#888]'}`}>
                              {m.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {isDownloading && progress > 0 && (
            <div className="mt-1.5 h-1 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-300 ease-out"
                style={{
                  width: `${progress}%`,
                  background: `linear-gradient(90deg, ${config.accentHex}, ${config.accentHex}cc)`,
                  boxShadow: `0 0 8px ${config.accentHex}66`
                }}
              />
            </div>
          )}
        </div>

        {isActive && (
          <div
            role="button"
            onClick={(e) => { e.stopPropagation(); onCancel(); }}
            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 bg-slate-100 dark:bg-white/5 hover:bg-red-500/20 text-[#666] hover:text-red-400 transition-colors relative z-[1] cursor-pointer"
            title="Cancel"
          >
            <X size={12} />
          </div>
        )}
      </button>
    </div>
  );
};

const globalTaskJobsStore = {
  taskJobs: {} as Record<string, TaskJobInfo>,
  activeJobs: {} as Record<string, { task: string; unsubscribe: () => void }>,
  listeners: new Set<(jobs: Record<string, TaskJobInfo>) => void>(),
  setTaskJobs(updater: (prev: Record<string, TaskJobInfo>) => Record<string, TaskJobInfo>) {
    this.taskJobs = updater(this.taskJobs);
    this.listeners.forEach(l => l(this.taskJobs));
  },
  subscribe(listener: (jobs: Record<string, TaskJobInfo>) => void) {
    this.listeners.add(listener);
    listener(this.taskJobs);
    return () => this.listeners.delete(listener);
  }
};

export const AIToolsPanel: React.FC<AIToolsPanelProps> = ({ selectionType, executeCommand }) => {
  const [showManager, setShowManager] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'tools' | 'segmentation' | 'office-utilities'>('tools');
  const { activeObj } = useSelection();
  const tasks = ai?.getAvailableTasks?.() || [];
  
  const [segModel, setSegModel] = useState<string>('ormbg');

  // The model chosen for each task. Kept here so a task's button and its extra buttons - the depth
  // modes below - all run the same one.
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>({});
  const modelFor = useCallback(
    (task: string) => selectedModels[task] || modelRegistry.getForTask(task)[0]?.id,
    [selectedModels]
  );
  const selectModel = useCallback(
    (task: string, modelId: string) => setSelectedModels(prev => ({ ...prev, [task]: modelId })),
    []
  );
  const depthModelId = modelFor('depth-estimation');
  // The depth modes need the model on the device, the same as the button above them.
  const { isReady: depthReady } = useModelDownload(depthModelId);

  // Depth 3D viewer state
  const [depth3DViewer, setDepth3DViewer] = useState<{
    depthResult: DepthEstimationResult;
    originalImage: ImageData;
    sourceObj: fabric.Image;
    canvas: fabric.Canvas;
    updateLayers: () => void;
  } | null>(null);

  const [taskJobs, setTaskJobsState] = useState<Record<string, TaskJobInfo>>(globalTaskJobsStore.taskJobs);

  useEffect(() => {
    return globalTaskJobsStore.subscribe(setTaskJobsState);
  }, []);

  const trackJob = useCallback((jobId: string, task: string, initialState: AIProgressState = 'queued') => {
    globalTaskJobsStore.setTaskJobs(prev => ({
      ...prev,
      [task]: { jobId, state: initialState, progress: 0 }
    }));

    const unsub = aiEventBus.subscribe(jobId, (event) => {
      globalTaskJobsStore.setTaskJobs(prev => ({
        ...prev,
        [task]: { jobId, state: event.state, progress: event.progress ?? prev[task]?.progress ?? 0 }
      }));

      if (['completed', 'failed', 'cancelled'].includes(event.state)) {
        setTimeout(() => {
          globalTaskJobsStore.setTaskJobs(prev => {
            const next = { ...prev };
            if (next[task]?.jobId === jobId) {
              delete next[task];
            }
            return next;
          });
          const activeJob = globalTaskJobsStore.activeJobs[jobId];
          if (activeJob) {
            activeJob.unsubscribe();
            delete globalTaskJobsStore.activeJobs[jobId];
          }
        }, 2500);
      }
    });

    globalTaskJobsStore.activeJobs[jobId] = { task, unsubscribe: unsub };
  }, []);

  useEffect(() => {
    // Restore active jobs from the background queue when panel mounts
    const activeJobs = aiQueue.getActiveJobs();
    activeJobs.forEach(job => {
      if (job.type === 'EXECUTE_TASK' && job.task && !job.isCancelled) {
        trackJob(job.id, job.task, 'inference'); 
      }
    });

  }, [trackJob]);

  const handleDepthEstimation = useCallback((depthMode: DepthMode, modelId?: string) => {
    if (!activeObj || (!(activeObj as any).isType?.('image') && activeObj.type !== 'image')) {
      alert("Please select an image to apply AI features.");
      return;
    }

    if (taskJobs['depth-estimation'] && !['completed', 'failed', 'cancelled'].includes(taskJobs['depth-estimation'].state)) {
      return;
    }

    const cmd = new DepthEstimationCommand(activeObj as fabric.Image, modelId, depthMode);

    if (depthMode === '3d') {
      cmd.on3DViewReady = (depthResult, originalImage, sourceObj, fabricCanvas, updateLayers) => {
        setDepth3DViewer({ depthResult, originalImage, sourceObj, canvas: fabricCanvas, updateLayers });
      };
    }

    if (cmd.lastJobId) {
      trackJob(cmd.lastJobId, 'depth-estimation');
    }
    executeCommand(cmd);
  }, [activeObj, taskJobs, trackJob, executeCommand]);

  const handleTaskClick = (task: AITask, modelId?: string) => {
    if (!activeObj || (!(activeObj as any).isType?.('image') && activeObj.type !== 'image')) {
      alert("Please select an image to apply AI features.");
      return;
    }

    if (taskJobs[task] && !['completed', 'failed', 'cancelled'].includes(taskJobs[task].state)) {
      return;
    }

    if (task === 'depth-estimation') {
      // Default depth mode is 'colored' when clicked from the main button
      handleDepthEstimation('colored', modelId);
      return;
    }

    if (task === 'style-transfer') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = async (e: any) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const img = new Image();
        img.src = URL.createObjectURL(file);
        await new Promise(r => img.onload = r);
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.drawImage(img, 0, 0);
        const styleImageData = tempCtx.getImageData(0, 0, img.width, img.height);
        
        const cmd = new StyleTransferCommand(activeObj as fabric.Image, styleImageData, modelId);
        if (cmd.lastJobId) {
          trackJob(cmd.lastJobId, task);
        }
        executeCommand(cmd);
      };
      input.click();
      return;
    }

    const config = TASK_CONFIG[task];
    if (config?.commandClass) {
      const cmd = new config.commandClass(activeObj, modelId);
      if (cmd.lastJobId) {
        trackJob(cmd.lastJobId, task);
      }
      executeCommand(cmd);
    } else {
      alert(`Task ${task} is not yet implemented or is a placeholder.`);
    }
  };

  const handleCancel = (task: string) => {
    const jobInfo = taskJobs[task];
    if (jobInfo) {
      ai.cancel(jobInfo.jobId);
      aiEventBus.emit(jobInfo.jobId, { state: 'cancelled' });
    }
  };

  const handleSegmentationExecute = (effectId: string, options?: any) => {
    if (!activeObj || (!(activeObj as any).isType?.('image') && activeObj.type !== 'image')) {
      alert("Please select an image to apply AI features.");
      return;
    }
    const cmd = new SegmentationCommand(activeObj as any, segModel, effectId, options);
    if (cmd.lastJobId) {
      trackJob(cmd.lastJobId, 'background-removal', 'preparing-image');
    }
    executeCommand(cmd);
  };

  const handleFaceUtilityExecute = (effectId: string, options?: any) => {
    if (!activeObj || (!(activeObj as any).isType?.('image') && activeObj.type !== 'image')) {
      alert("Please select an image to apply AI features.");
      return;
    }
    const cmd = new FaceUtilityCommand(activeObj as any, options.modelId, effectId, options);
    if (cmd.lastJobId) {
      trackJob(cmd.lastJobId, 'office-utilities', 'preparing-image');
    }
    executeCommand(cmd);
  };

  const TABS = [
    { id: 'tools', label: 'AI Powers', icon: <Zap size={16} /> },
    { id: 'segmentation', label: 'Magic Effects', icon: <Sparkles size={16} /> },
    { id: 'office-utilities', label: 'Office Suite', icon: <Briefcase size={16} /> },
  ];

  return (
    <div className="p-4 pb-24 md:pb-6 space-y-6 text-slate-700 dark:text-[#C0C0C0] font-sans h-full flex flex-col overflow-y-auto">
      <div className="space-y-3">
        {/* Tabs */}
        <div className="flex bg-slate-100 dark:bg-[#1C1C1C] rounded-lg p-1 border border-slate-200 dark:border-[#2D2D2D] mb-4">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 text-xs font-semibold rounded-md transition-all ${
                activeTab === tab.id 
                  ? 'bg-white dark:bg-[#2D2D2D] text-slate-900 dark:text-white shadow-sm' 
                  : 'text-slate-500 dark:text-[#8A8A8A] hover:text-slate-800 dark:hover:text-[#C0C0C0] hover:bg-slate-200/50 dark:hover:bg-[#252525]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        
        {selectionType !== 'image' && (
          <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl text-[11px] text-amber-700 dark:text-amber-300 text-center mb-4">
            Select an image layer to use AI tools.
          </div>
        )}

        <div className="grid grid-cols-1 gap-2">
          {activeTab === 'segmentation' && tasks.includes('background-removal') && (
            <SegmentationPanel
              isActive={!!taskJobs['background-removal'] && !['completed', 'failed', 'cancelled'].includes(taskJobs['background-removal'].state)}
              jobState={taskJobs['background-removal']?.state}
              progress={taskJobs['background-removal']?.progress}
              selectedModel={segModel}
              setSelectedModel={setSegModel}
              onExecute={handleSegmentationExecute}
              onCancel={() => handleCancel('background-removal')}
            />
          )}

          {activeTab === 'tools' && tasks.filter(t => t !== 'background-removal' && t !== 'face-detection').map(task => (
            <React.Fragment key={task}>
              <AIToolButton 
                task={task}
                jobInfo={taskJobs[task] || null}
                selectedModel={modelFor(task)}
                onSelectModel={(modelId) => selectModel(task, modelId)}
                onClick={(modelId) => handleTaskClick(task, modelId)} 
                onCancel={() => handleCancel(task)}
              />
              {task === 'depth-estimation' && depthReady && (
                <div className="flex flex-wrap gap-1.5 -mt-0.5 ml-12 mb-1 pr-2">
                  {([
                    { mode: 'portrait-blur' as DepthMode, label: 'Portrait Blur', icon: <Droplet size={11} className="text-blue-400" /> },
                    { mode: 'relighting' as DepthMode, label: 'Studio Light', icon: <Sun size={11} className="text-amber-400" /> },
                    { mode: 'fog' as DepthMode, label: 'Fog', icon: <Cloud size={11} className="text-slate-400" /> },
                    { mode: 'grayscale' as DepthMode, label: 'Grayscale', icon: <CircleDot size={11} className="text-slate-400" /> },
                    { mode: 'colored' as DepthMode, label: 'Colored', icon: <Palette size={11} className="text-cyan-400" /> },
                    { mode: '3d' as DepthMode, label: '3D View', icon: <Box size={11} className="text-indigo-400" /> },
                  ]).map(({ mode, label, icon }) => (
                    <button
                      key={mode}
                      onClick={() => handleDepthEstimation(mode, depthModelId)}
                      disabled={!!taskJobs['depth-estimation'] && !['completed', 'failed', 'cancelled'].includes(taskJobs['depth-estimation']?.state)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-semibold border transition-all
                        bg-white dark:bg-[#161616] border-slate-200 dark:border-[#2D2D2D] 
                        text-slate-600 dark:text-white/60
                        hover:bg-cyan-500/10 hover:border-cyan-500/30 hover:text-cyan-500 dark:hover:text-cyan-400
                        disabled:opacity-40 disabled:cursor-not-allowed
                        active:scale-95"
                    >
                      {icon}
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </React.Fragment>
          ))}

          {activeTab === 'office-utilities' && (
            <OfficeUtilitiesPanel 
              onExecute={handleFaceUtilityExecute}
              onPrintSheet={() => {
                if (!activeObj || (!(activeObj as any).isType?.('image') && activeObj.type !== 'image')) {
                  alert("Please select an image to create a print sheet.");
                  return;
                }
                setShowPrintModal(true);
              }}
              isActive={!!taskJobs['office-utilities'] && !['completed', 'failed', 'cancelled'].includes(taskJobs['office-utilities'].state)}
              jobState={taskJobs['office-utilities']?.state}
              progress={taskJobs['office-utilities']?.progress}
              onCancel={() => handleCancel('office-utilities')}
              disabled={!!taskJobs['office-utilities'] && !['completed', 'failed', 'cancelled'].includes(taskJobs['office-utilities'].state)}
            />
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[16px]" />

      <button 
        onClick={() => setShowManager(true)}
        className="w-full flex items-center justify-center gap-2 p-2.5 bg-white dark:bg-[#1C1C1C] hover:bg-slate-100 dark:hover:bg-[#252525] border border-slate-200 dark:border-[#2D2D2D] hover:border-slate-300 dark:hover:border-[#444] rounded-xl text-slate-900 dark:text-white text-[11px] font-semibold transition-all active:scale-[0.98] shrink-0 mb-6 md:mb-0 shadow-sm"
      >
        <Settings2 size={14} /> Manage AI Models
      </button>

      {showManager && <AIModelManagerModal onClose={() => setShowManager(false)} />}
      
      {showPrintModal && activeObj && activeObj.type === 'image' && (
        <PassportPrintModal 
          sourceImage={(activeObj as fabric.Image).toDataURL({})} 
          onClose={() => setShowPrintModal(false)} 
        />
      )}

      {depth3DViewer && (
        <Depth3DViewerModal
          depthResult={depth3DViewer.depthResult}
          originalImage={depth3DViewer.originalImage}
          sourceObj={depth3DViewer.sourceObj}
          canvas={depth3DViewer.canvas}
          updateLayers={depth3DViewer.updateLayers}
          onClose={() => setDepth3DViewer(null)}
        />
      )}
    </div>
  );
};
