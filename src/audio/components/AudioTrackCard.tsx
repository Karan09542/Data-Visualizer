import React, { useState } from "react";
import { Play, Pause, Music, Plus, Check, Trash2, GripVertical } from "lucide-react";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { AudioTrack } from "../types/audio";
import { useAudioStore } from "../stores/audioStore";

interface AudioTrackCardProps {
  track: AudioTrack;
  index: number;
  isQueueItem?: boolean;
  contextTracks?: AudioTrack[];
}

const formatDuration = (secs?: number) => {
  if (!secs) return null;

  const min = Math.floor(secs / 60);
  const sec = Math.floor(secs % 60);
  return `${min}:${sec < 10 ? "0" : ""}${sec}`;
};

export const AudioTrackCard: React.FC<AudioTrackCardProps> = ({
  track,
  index,
  isQueueItem,
  contextTracks,
}) => {
  const {
    currentTrack,
    isPlaying,
    togglePlay,
    playQueue,
    playTrack,
    queue,
    queueIndex,
  } = useAudioPlayer();
  const isCurrentTrack = isQueueItem
    ? currentTrack?.id === track.id && queueIndex === index
    : currentTrack?.id === track.id;
  const [added, setAdded] = useState(false);

  const handlePlayClick = () => {
    if (isCurrentTrack) {
      togglePlay();
    } else if (isQueueItem) {
      playQueue(queue, index);
    } else if (contextTracks) {
      playQueue(contextTracks, index);
    } else {
      playTrack(track);
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

  const dateLabel = new Date(track.createdAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const durationLabel = formatDuration(track.duration) || dateLabel;
  const metaLabel = [track.artist, dateLabel].filter(Boolean).join(" - ") || "Workspace audio";

  return (
    <div
      className={`group flex min-h-[68px] cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-all ${
        isCurrentTrack
          ? "border-cyan-500 bg-cyan-50/90 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/30 dark:border-cyan-300/35 dark:bg-cyan-300/10 dark:shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_18px_40px_-26px_rgba(34,211,238,0.55)] dark:ring-0"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/90 dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/15 dark:hover:bg-white/[0.06] shadow-sm dark:shadow-none"
      }`}
      onClick={handlePlayClick}
    >
      {isQueueItem && (
        <div
          className="flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white/5 hover:text-slate-200 active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </div>
      )}

      <div
        className={`relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400 dark:bg-[#121824] ${
          isCurrentTrack ? "ring-2 ring-cyan-300/35" : ""
        }`}
      >
        {track.thumbnail ? (
          <img
            src={track.thumbnail}
            alt={track.title}
            className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
          />
        ) : (
          <Music size={20} className="text-cyan-600/70 dark:text-cyan-200/70" />
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/45 transition-opacity ${
            isCurrentTrack ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          {isCurrentTrack && isPlaying ? (
            <Pause size={20} className="text-white" fill="currentColor" />
          ) : (
            <Play size={20} className="ml-0.5 text-white" fill="currentColor" />
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h4
            className={`truncate text-sm font-semibold ${
              isCurrentTrack ? "text-cyan-900 dark:text-cyan-100" : "text-slate-900 dark:text-slate-100"
            }`}
          >
            {track.title}
          </h4>
          {isCurrentTrack && (
            <span className="hidden rounded bg-cyan-100 dark:bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-cyan-800 dark:text-cyan-200 sm:inline">
              Live
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-xs font-medium text-slate-500 dark:text-slate-400">
          {metaLabel}
        </p>
      </div>

      <span className="hidden shrink-0 text-xs font-bold tabular-nums text-slate-500 sm:block">
        {durationLabel}
      </span>

      {!isQueueItem && (
        <button
          onClick={handleAddToQueue}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-all sm:opacity-0 sm:group-hover:opacity-100 ${
            added
              ? "border-emerald-400 bg-emerald-50 text-emerald-600 sm:opacity-100 dark:border-emerald-300/30 dark:bg-emerald-300/10 dark:text-emerald-200"
              : "border-transparent text-slate-400 hover:border-cyan-500/30 hover:bg-cyan-50 hover:text-cyan-700 dark:hover:border-cyan-300/20 dark:hover:bg-cyan-300/10 dark:hover:text-cyan-200"
          }`}
          title="Add to Queue"
        >
          {added ? <Check size={18} /> : <Plus size={18} />}
        </button>
      )}

      {isQueueItem && (
        <button
          onClick={handleRemoveFromQueue}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-transparent text-slate-500 transition-all hover:border-red-400 hover:bg-red-50 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 dark:hover:border-red-300/20 dark:hover:bg-red-400/10 dark:hover:text-red-300"
          title="Remove from Queue"
        >
          <Trash2 size={17} />
        </button>
      )}

      {isCurrentTrack && isPlaying && !isQueueItem && (
        <div className="hidden h-5 shrink-0 items-end gap-1 px-1 sm:flex">
          <div className="h-full w-1 rounded-full bg-cyan-400 dark:bg-cyan-300 animate-[bounce_1s_infinite]" />
          <div className="h-3/5 w-1 rounded-full bg-emerald-400 dark:bg-emerald-300 animate-[bounce_1.2s_infinite]" />
          <div className="h-4/5 w-1 rounded-full bg-amber-400 dark:bg-amber-200 animate-[bounce_0.8s_infinite]" />
        </div>
      )}
    </div>
  );
};
