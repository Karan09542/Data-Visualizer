import React from 'react';
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Repeat, Shuffle } from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';

export const AudioControls: React.FC = () => {
  const { 
    isPlaying, 
    togglePlay, 
    next, 
    previous, 
    volume, 
    setVolume,
    isMuted,
    toggleMute,
    isLooping,
    toggleLoop,
    isShuffle,
    toggleShuffle,
    progress,
    duration,
    seek
  } = useAudioPlayer();

  const formatTime = (secs: number) => {
    const min = Math.floor(secs / 60);
    const sec = Math.floor(secs % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  return (
    <div className="flex flex-col w-full max-w-xl mx-auto gap-4 p-4">
      {/* Progress Bar */}
      <div className="flex items-center gap-3 w-full text-xs text-slate-500 font-mono">
        <span>{formatTime(progress)}</span>
        <input 
          type="range" 
          min="0" 
          max={duration || 100} 
          value={progress} 
          onChange={handleSeek}
          className="flex-1 h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls Container */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-6 sm:gap-4 mt-2 sm:mt-0">
        
        {/* Playback Settings (Shuffle/Repeat) */}
        <div className="flex items-center justify-center sm:justify-start gap-2 order-2 sm:order-1 w-full sm:w-auto">
          <button 
            onClick={toggleShuffle} 
            title="Shuffle"
            className={`p-2 rounded-full transition-colors ${isShuffle ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <Shuffle size={18} />
          </button>
          <button 
            onClick={toggleLoop} 
            title="Repeat"
            className={`p-2 rounded-full transition-colors ${isLooping ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
          >
            <Repeat size={18} />
          </button>
        </div>

        {/* Main Controls */}
        <div className="flex items-center justify-center gap-6 sm:gap-4 w-full sm:w-auto order-1 sm:order-2">
          <button 
            onClick={previous}
            title="Previous"
            className="p-3 sm:p-2 text-slate-700 dark:text-slate-200 hover:text-indigo-500 transition-colors"
          >
            <SkipBack size={28} className="sm:w-6 sm:h-6" fill="currentColor" />
          </button>
          <button 
            onClick={togglePlay}
            title={isPlaying ? "Pause" : "Play"}
            className="p-5 sm:p-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full transition-transform hover:scale-105 active:scale-95 shadow-md"
          >
            {isPlaying ? <Pause size={32} className="sm:w-7 sm:h-7" fill="currentColor" /> : <Play size={32} className="sm:w-7 sm:h-7 ml-1" fill="currentColor" />}
          </button>
          <button 
            onClick={next}
            title="Next"
            className="p-3 sm:p-2 text-slate-700 dark:text-slate-200 hover:text-indigo-500 transition-colors"
          >
            <SkipForward size={28} className="sm:w-6 sm:h-6" fill="currentColor" />
          </button>
        </div>

        {/* Desktop & Mobile Volume */}
        <div className="flex items-center justify-center sm:justify-end gap-3 sm:gap-2 w-full sm:w-28 order-3 px-6 sm:px-0">
          <button 
            onClick={toggleMute}
            title={isMuted || volume === 0 ? "Unmute" : "Mute"}
            className="p-2 text-slate-500 hover:text-indigo-500 transition-colors"
          >
            {isMuted || volume === 0 ? <VolumeX size={20} className="sm:w-[18px] sm:h-[18px]" /> : <Volume2 size={20} className="sm:w-[18px] sm:h-[18px]" />}
          </button>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01"
            value={isMuted ? 0 : volume} 
            onChange={handleVolume}
            className="w-full h-2 sm:h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
      </div>
    </div>
  );
};
