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
    stop,
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

  /** Uploads only: removes the track and deletes its file from this device */
  const handleDeleteUpload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm(`Delete "${track.title}" from this device?`)) return;

    const audio = useAudioStore.getState();
    if (audio.currentTrack?.id === track.id) stop();
    for (let i = audio.queue.length - 1; i >= 0; i--) {
      if (audio.queue[i].id === track.id) useAudioStore.getState().removeFromQueue(i);
    }

    const { removeUploadedTrack } = await import("../services/audioUploads");
    const { discoverAudio } = await import("../services/audioDiscovery");
    await removeUploadedTrack(track);
    window.dispatchEvent(new CustomEvent("audio-library-updated", { detail: await discoverAudio() }));
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
  const isUpload = track.origin === "upload";
  const metaLabel =
    [track.artist, isUpload ? "On this device" : null, dateLabel].filter(Boolean).join(" · ") || "Workspace audio";

  return (
    <div
      className={`group flex min-h-[64px] cursor-pointer items-center gap-3 rounded-2xl border p-2 transition-colors ${
        isCurrentTrack
          ? "border-(--ap-accent-line) bg-(--ap-accent-soft)"
          : "border-transparent hover:bg-(--ap-hover)"
      }`}
      onClick={handlePlayClick}
    >
      {isQueueItem && (
        <div
          className="flex h-9 w-7 shrink-0 cursor-grab items-center justify-center rounded-md text-(--ap-muted) transition-colors hover:bg-(--ap-hover) hover:text-(--ap-ink) active:cursor-grabbing"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical size={16} />
        </div>
      )}

      <div
        className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-(--ap-chip)"
      >
        {track.thumbnail ? (
          <img
            src={track.thumbnail}
            alt={track.title}
            className="h-full w-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
          />
        ) : (
          <Music size={20} className="text-(--ap-accent)" />
        )}
        <div
          className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity ${
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
        <h4
          className={`truncate text-sm font-semibold ${
            isCurrentTrack ? "text-(--ap-accent-strong)" : "text-(--ap-ink)"
          }`}
        >
          {track.title}
        </h4>
        <p className="mt-0.5 truncate text-xs text-(--ap-muted)">
          {metaLabel}
        </p>
      </div>

      <span className="hidden shrink-0 text-xs font-medium tabular-nums text-(--ap-muted) sm:block">
        {durationLabel}
      </span>

      {!isQueueItem && (
        <button
          onClick={handleAddToQueue}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 ${
            added
              ? "bg-(--ap-accent-soft) text-(--ap-accent) sm:opacity-100"
              : "text-(--ap-muted) hover:bg-(--ap-hover) hover:text-(--ap-ink)"
          }`}
          title="Add to Queue"
        >
          {added ? <Check size={18} /> : <Plus size={18} />}
        </button>
      )}

      {!isQueueItem && isUpload && (
        <button
          onClick={handleDeleteUpload}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-(--ap-muted) transition-all hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:hover:text-red-300"
          title="Delete from this device"
          aria-label={`Delete ${track.title} from this device`}
        >
          <Trash2 size={17} />
        </button>
      )}

      {isQueueItem && (
        <button
          onClick={handleRemoveFromQueue}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-(--ap-muted) transition-all hover:bg-red-500/10 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 dark:hover:text-red-300"
          title="Remove from Queue"
        >
          <Trash2 size={17} />
        </button>
      )}

      {isCurrentTrack && isPlaying && !isQueueItem && (
        <div className="hidden h-5 shrink-0 items-end gap-1 px-1 sm:flex">
          <div className="h-full w-1 rounded-full bg-(--ap-accent) animate-[bounce_1s_infinite]" />
          <div className="h-3/5 w-1 rounded-full bg-(--ap-accent) animate-[bounce_1.2s_infinite]" />
          <div className="h-4/5 w-1 rounded-full bg-(--ap-accent) animate-[bounce_0.8s_infinite]" />
        </div>
      )}
    </div>
  );
};
