import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ai } from '../../../../ai';
import { AITask, AIProgressState } from '../../../../ai/types';
import { aiEventBus } from '../../../../ai/events/AIEventBus';
import { useSelection } from '../../contexts/SelectionContext';
import { Sparkles, Scissors, Sun, Zap, Search, Settings2, Loader2, X, CheckCircle2, AlertCircle, Download, Briefcase } from 'lucide-react';
import * as fabric from 'fabric';
import { modelRegistry } from '../../../../ai/registry/ModelRegistry';
import { UpscaleCommand } from '../../commands/ai/UpscaleCommand';
import { EnhanceLowLightCommand } from '../../commands/ai/EnhanceLowLightCommand';
import { SegmentationCommand } from '../../commands/ai/SegmentationCommand';
import { FaceUtilityCommand } from '../../commands/ai/FaceUtilityCommand';
import { AIModelManagerModal } from '../shared/AIModelManagerModal';
import { SegmentationPanel } from './SegmentationPanel';
import { OfficeUtilitiesPanel } from './OfficeUtilitiesPanel';
import { PassportPrintModal } from '../shared/PassportPrintModal';
import { aiQueue } from '../../../../ai/manager/AIQueue';

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
    colorClass: 'text-emerald-400 border-emerald-500 bg-emerald-500',
    accentHex: '#10b981'
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

const AIToolButton = ({ task, jobInfo, onClick, onCancel }: {
  task: AITask;
  jobInfo: TaskJobInfo | null;
  onClick: (modelId?: string) => void;
  onCancel: () => void;
}) => {
  const config = TASK_CONFIG[task];
  
  const models = modelRegistry.getAll().filter(m => m.task === task);
  const [selectedModel, setSelectedModel] = useState(models.length > 0 ? models[0].id : undefined);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (models.length > 0 && (!selectedModel || !models.find(m => m.id === selectedModel))) {
      setSelectedModel(models[0].id);
    }
  }, [models, selectedModel]);

  if (!config) return null;

  const isActive = jobInfo && !['completed', 'failed', 'cancelled'].includes(jobInfo.state);
  const isDone = jobInfo?.state === 'completed';
  const isFailed = jobInfo?.state === 'failed';
  const isDownloading = jobInfo?.state === 'downloading';
  const progress = jobInfo?.progress ?? 0;

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
                              setSelectedModel(m.id);
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

  const handleTaskClick = (task: AITask, modelId?: string) => {
    if (!activeObj || (!(activeObj as any).isType?.('image') && activeObj.type !== 'image')) {
      alert("Please select an image to apply AI features.");
      return;
    }

    if (taskJobs[task] && !['completed', 'failed', 'cancelled'].includes(taskJobs[task].state)) {
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
            <AIToolButton 
              key={task} 
              task={task}
              jobInfo={taskJobs[task] || null}
              onClick={(modelId) => handleTaskClick(task, modelId)} 
              onCancel={() => handleCancel(task)}
            />
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
    </div>
  );
};
