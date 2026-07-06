import React, { useState } from 'react';
import { Play, Pause, SkipForward, SkipBack, Maximize2, X, Music, ChevronRight, ChevronLeft } from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

const MiniPlayer: React.FC = () => {
  const { currentTrack, isPlaying, togglePlay, next, previous, isPlayerOpen, togglePlayer, stop } = useAudioPlayer();
  const [isMinimized, setIsMinimized] = useState(false);

  if (isPlayerOpen || !currentTrack) return null;

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 animate-in slide-in-from-right-8 fade-in duration-300">
        <button 
          onClick={() => setIsMinimized(false)}
          className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 shadow-xl rounded-full p-2 flex items-center gap-2 hover:scale-105 active:scale-95 transition-all group"
        >
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center relative overflow-hidden">
            {currentTrack.thumbnail ? (
              <img src={currentTrack.thumbnail} alt="cover" className="w-full h-full object-cover" />
            ) : (
              <Music className="w-5 h-5 text-indigo-500" />
            )}
            {isPlaying && (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="w-1 h-1 bg-white rounded-full animate-ping" />
              </div>
            )}
          </div>
          <ChevronLeft className="w-5 h-5 text-slate-400 group-hover:text-indigo-500 transition-colors mr-1" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 z-40 flex justify-center animate-in slide-in-from-bottom-8 fade-in duration-300 pointer-events-none">
      <div className="bg-white dark:bg-[#161b22] border border-slate-200 dark:border-slate-800 shadow-xl rounded-2xl p-2 sm:p-3 flex items-center gap-3 sm:gap-4 w-full md:min-w-[320px] max-w-[400px] pointer-events-auto relative group/player">
        
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
        <div className="flex items-center gap-1 sm:gap-1.5 border-l border-slate-100 dark:border-slate-800 pl-2 sm:pl-3">
          <button 
            onClick={(e) => { e.stopPropagation(); previous(); }}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-500 transition-colors"
          >
            <SkipBack size={18} fill="currentColor" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            className="p-1.5 sm:p-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-full transition-colors"
          >
            {isPlaying ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); next(); }}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-500 transition-colors hidden sm:block"
          >
            <SkipForward size={18} fill="currentColor" />
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); stop(); }}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-red-500 transition-colors hidden sm:block"
          >
            <X size={18} />
          </button>
          
          <div className="w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); setIsMinimized(true); }}
            className="p-1.5 sm:p-2 text-slate-400 hover:text-indigo-500 transition-colors"
            title="Minimize"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MiniPlayer;
