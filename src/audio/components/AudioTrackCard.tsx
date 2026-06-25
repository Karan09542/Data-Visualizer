import React, { useState } from 'react';
import { Play, Pause, Music, Plus, Check, Trash2, GripVertical } from 'lucide-react';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { AudioTrack } from '../types/audio';
import { useAudioStore } from '../stores/audioStore';

interface AudioTrackCardProps {
  track: AudioTrack;
  index: number;
  isQueueItem?: boolean;
  contextTracks?: AudioTrack[];
}

export const AudioTrackCard: React.FC<AudioTrackCardProps> = ({ track, index, isQueueItem, contextTracks }) => {
  const { currentTrack, isPlaying, togglePlay, playQueue, playTrack, queue } = useAudioPlayer();
  const isCurrentTrack = isQueueItem ? (currentTrack?.id === track.id && useAudioStore.getState().queueIndex === index) : currentTrack?.id === track.id;
  const [added, setAdded] = useState(false);

  const handlePlayClick = () => {
    if (isCurrentTrack) {
      togglePlay();
    } else {
      if (isQueueItem) {
        playQueue(queue, index);
      } else {
        if (contextTracks) {
          playQueue(contextTracks, index);
        } else {
          playTrack(track);
        }
      }
    }
  };

  const handleAddToQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    useAudioStore.getState().addToQueue(track);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleRemoveFromQueue = (e: React.MouseEvent) => {
    e.stopPropagation();
    useAudioStore.getState().removeFromQueue(index);
  };

  return (
    <div 
      className={`flex items-center gap-2 sm:gap-4 p-2 sm:p-3 rounded-xl transition-all border ${isCurrentTrack ? 'bg-indigo-50 border-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800/50' : 'bg-white border-slate-100 hover:border-slate-200 dark:bg-[#161b22] dark:border-slate-800/60 dark:hover:border-slate-700'} cursor-pointer group`}
      onClick={handlePlayClick}
    >
      {isQueueItem && (
        <div className="cursor-grab active:cursor-grabbing p-1 text-slate-300 hover:text-slate-500 dark:hover:text-slate-400 drag-handle" onClick={(e) => e.stopPropagation()}>
          <GripVertical size={16} />
        </div>
      )}
      
      <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 flex-shrink-0 relative overflow-hidden">
        {track.thumbnail ? (
          <img src={track.thumbnail} alt={track.title} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
        ) : (
          <Music size={20} />
        )}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity ${isCurrentTrack && isPlaying ? 'opacity-100' : ''}`}>
          {isCurrentTrack && isPlaying ? (
            <Pause size={20} className="text-white" fill="currentColor" />
          ) : (
            <Play size={20} className="text-white ml-0.5" fill="currentColor" />
          )}
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className={`font-semibold text-xs sm:text-sm truncate ${isCurrentTrack ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-800 dark:text-slate-200'}`}>
          {track.title}
        </h4>
        <p className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5 sm:mt-1">
          {track.artist ? `${track.artist} • ` : ''}{new Date(track.createdAt).toLocaleDateString()}
        </p>
      </div>

      {!isQueueItem && (
        <button 
          onClick={handleAddToQueue}
          className={`p-2 transition-all rounded-full ${added ? 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/30' : 'text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 opacity-0 group-hover:opacity-100 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'}`}
          title="Add to Queue"
        >
          {added ? <Check size={20} /> : <Plus size={20} />}
        </button>
      )}

      {isQueueItem && (
        <button 
          onClick={handleRemoveFromQueue}
          className="p-2 text-slate-400 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-red-50 dark:hover:bg-red-900/30"
          title="Remove from Queue"
        >
          <Trash2 size={18} />
        </button>
      )}

      {isCurrentTrack && isPlaying && !isQueueItem && (
        <div className="flex items-end gap-1 h-4 px-2 hidden sm:flex">
          <div className="w-1 bg-indigo-500 animate-[bounce_1s_infinite] h-full"></div>
          <div className="w-1 bg-indigo-500 animate-[bounce_1.2s_infinite] h-2/3"></div>
          <div className="w-1 bg-indigo-500 animate-[bounce_0.8s_infinite] h-4/5"></div>
        </div>
      )}
    </div>
  );
};

