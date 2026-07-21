import React from 'react';
import { createPortal } from 'react-dom';
import { useAIContext } from '../../contexts/AIContext';
import { X, Loader2, Cpu, Activity, DownloadCloud, Image as ImageIcon } from 'lucide-react';

export const AIProgressModal: React.FC = () => {
  const { activeJobs, cancelJob } = useAIContext();
  
  const jobs = Object.values(activeJobs);
  if (jobs.length === 0) return null;

  const getStateDisplay = (state: string) => {
    switch (state) {
      case 'queued': return { text: 'Waiting in queue...', icon: <Activity className="animate-pulse" size={16} /> };
      case 'downloading': return { text: 'Downloading model...', icon: <DownloadCloud size={16} /> };
      case 'loading-model': return { text: 'Loading AI model...', icon: <Cpu size={16} /> };
      case 'preparing-image': return { text: 'Preparing image...', icon: <ImageIcon size={16} /> };
      case 'inference': return { text: 'Running inference...', icon: <Loader2 className="animate-spin" size={16} /> };
      case 'post-processing': return { text: 'Finalizing...', icon: <Loader2 className="animate-spin" size={16} /> };
      case 'completed': return { text: 'Completed', icon: <Activity size={16} /> };
      default: return { text: state, icon: <Loader2 className="animate-spin" size={16} /> };
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 font-sans">
      <div className="bg-[#1C1C1C] border border-[#2D2D2D] rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
        <h3 className="text-white font-bold flex items-center gap-2">
          <SparklesIcon /> AI Tasks in Progress
        </h3>
        
        <div className="space-y-4">
          {jobs.map(job => {
            const { text, icon } = getStateDisplay(job.state);
            return (
              <div key={job.jobId} className="bg-[#141414] border border-[#282828] p-4 rounded-xl flex items-center justify-between gap-4 relative overflow-hidden">
                {/* Progress bar background */}
                <div 
                  className="absolute left-0 bottom-0 top-0 bg-blue-500/10 transition-all duration-300 ease-out"
                  style={{ width: `${job.progress}%` }}
                />
                
                <div className="flex items-center gap-3 relative z-10 w-full">
                  <div className="w-10 h-10 rounded-lg bg-[#222] border border-[#333] flex items-center justify-center shrink-0 text-blue-400">
                    {icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-[13px] text-white font-semibold capitalize">{job.task.replace('-', ' ')}</div>
                    <div className="text-[11px] text-[#8A8A8A] flex justify-between mt-1">
                      <span>{text}</span>
                      <span>{Math.round(job.progress)}%</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => cancelJob(job.jobId)}
                    className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors border border-transparent hover:border-red-500/30"
                    title="Cancel Task"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};

const SparklesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
    <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"></path>
  </svg>
);
