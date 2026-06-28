import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Maximize2, X, Music } from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

const MiniPlayer: React.FC = () => {
  const { currentTrack, isPlaying, togglePlay, next, previous, isPlayerOpen, togglePlayer, stop } = useAudioPlayer();

  if (isPlayerOpen || !currentTrack) return null;

  return (
    <div className="fixed bottom-4 inset-x-4 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:left-auto z-40 flex justify-center animate-in slide-in-from-bottom-8 fade-in duration-300 pointer-events-none">
      <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-2 sm:p-3 flex items-center gap-3 sm:gap-4 w-full md:min-w-[320px] max-w-[400px] pointer-events-auto">
        
        {/* Thumbnail */}
        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex flex-shrink-0 items-center justify-center relative overflow-hidden group cursor-pointer" onClick={togglePlayer}>
          {currentTrack.thumbnail ? (
            <img src={currentTrack.thumbnail} alt="cover" className="w-full h-full object-cover" />
          ) : (
            <Music className="w-6 h-6 text-indigo-500" />
          )}
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 className="w-5 h-5 text-white" />
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 cursor-pointer" onClick={togglePlayer}>
          <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
            {currentTrack.title}
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
            {isPlaying ? 'Now Playing' : 'Paused'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1.5 border-l border-slate-100 dark:border-slate-800 pl-3">
          <button 
            onClick={(e) => { e.stopPropagation(); previous(); }}
            className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full transition-colors"
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); stop(); }}
            className="p-2 text-slate-400 hover:text-red-500 transition-colors ml-1"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;
