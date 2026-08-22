import React, { useEffect, useState } from "react";
import {
  X,
  Search,
  ListMusic,
  Disc3,
  Layers,
  SkipBack,
  Music2,
  Radio,
  Clock3,
  Headphones,
} from "lucide-react";
import { useAudioStore } from "../stores/audioStore";
import { useAudioLibrary } from "../hooks/useAudioLibrary";
import { AudioTrackCard } from "./AudioTrackCard";
import { AudioControls } from "./AudioControls";
import { useAudioPlayer } from "../hooks/useAudioPlayer";

const visualizerBars = [28, 52, 36, 68, 44, 82, 58, 92, 48, 76, 34, 62, 88, 54, 72, 40, 64, 46];

const formatDisplayDate = (value?: number) => {
  if (!value) return "No file selected";

  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const AudioPlayerModal: React.FC = () => {
  const isPlayerOpen = useAudioStore((state) => state.isPlayerOpen);
  const togglePlayer = useAudioStore((state) => state.togglePlayer);
  const queue = useAudioStore((state) => state.queue);
  const queueIndex = useAudioStore((state) => state.queueIndex);
  const { currentTrack, isPlaying } = useAudioPlayer();
  const { tracks, isLoading, searchQuery, setSearchQuery, refreshLibrary } =
    useAudioLibrary();

  const [activeTab, setActiveTab] = useState<"library" | "queue">("library");
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);
  const [isMobileLibraryOpen, setIsMobileLibraryOpen] = useState(false);

  const libraryCount = tracks.length;
  const queueCount = queue.length;
  const activeListCount = activeTab === "library" ? libraryCount : queueCount;
  const currentPosition = queueIndex >= 0 ? queueIndex + 1 : 0;
  const trackDate = currentTrack
    ? formatDisplayDate(currentTrack.createdAt)
    : "No file selected";
  const panelTitle = activeTab === "library" ? "Discovery Library" : "Up Next";
  const statusLabel = currentTrack ? (isPlaying ? "Playing now" : "Paused") : "Idle";

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    setDraggedOverIndex(index);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = () => {
    setDraggedOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDraggedOverIndex(null);
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    useAudioStore.getState().reorderQueue(draggedItemIndex, index);
    setDraggedItemIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedItemIndex(null);
    setDraggedOverIndex(null);
  };

  useEffect(() => {
    if (isPlayerOpen) {
      refreshLibrary();
    }
  }, [isPlayerOpen]);

  if (!isPlayerOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] bg-white dark:bg-[#05070d] text-slate-900 dark:text-slate-100 animate-in fade-in duration-200">
      <div
        className="flex h-full w-full flex-col overflow-hidden bg-slate-50 dark:bg-[#070a12]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#080b12]/95 px-4 shadow-2xl shadow-black/5 dark:shadow-black/20 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 dark:border-cyan-300/25 bg-cyan-500/10 dark:bg-cyan-300/10 shadow-[0_0_24px_rgba(34,211,238,0.12)]">
              <ListMusic className="h-5 w-5 text-cyan-600 dark:text-cyan-300" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold tracking-tight text-slate-900 dark:text-white sm:text-lg">
                Audio Workspace
              </h2>
              <p className="hidden text-xs font-medium text-slate-500 dark:text-slate-400 sm:block">
                {libraryCount} discovered audio files - {queueCount} queued
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.03] px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 lg:flex">
              <Radio className={`h-4 w-4 ${isPlaying ? "text-emerald-500 dark:text-emerald-300" : "text-slate-400 dark:text-slate-500"}`} />
              {statusLabel}
            </div>
            <button
              onClick={togglePlayer}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 transition-colors hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
              title="Close player"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,0.94fr)_minmax(420px,1.06fr)]">
            <section className="relative flex min-h-0 flex-col overflow-hidden border-slate-200 dark:border-white/10 bg-white dark:bg-[#10151d] lg:border-r dark:lg:border-white/10 lg:border-slate-200">
              <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-5 py-5 custom-scrollbar sm:px-8 sm:py-7 lg:px-10">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/20 dark:border-cyan-300/20 bg-cyan-500/10 dark:bg-cyan-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-cyan-700 dark:text-cyan-200">
                    <Radio className={`h-3.5 w-3.5 ${isPlaying ? "animate-pulse" : ""}`} />
                    {statusLabel}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] px-3 py-1.5">
                      <Headphones className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                      {currentPosition ? `${currentPosition}/${queueCount}` : `${queueCount} queued`}
                    </span>
                    <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] px-3 py-1.5">
                      <Clock3 className="h-3.5 w-3.5 text-amber-600 dark:text-amber-200" />
                      {trackDate}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col items-center justify-center gap-6 pb-3 sm:gap-8">
                  <div className="relative w-full max-w-[260px] sm:max-w-[430px]">
                    <div className="relative aspect-square overflow-hidden rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#151a25] shadow-2xl shadow-slate-200/50 dark:shadow-black/40">
                      {currentTrack?.thumbnail ? (
                        <>
                          <img
                            src={currentTrack.thumbnail}
                            alt={currentTrack.title}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/70 to-transparent" />
                        </>
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 via-indigo-500/15 to-amber-400/10" />
                      )}

                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="flex h-24 w-24 items-center justify-center rounded-full border border-slate-200 dark:border-white/15 bg-white/50 dark:bg-black/20 shadow-2xl shadow-slate-200/50 dark:shadow-black/30 backdrop-blur-sm sm:h-40 sm:w-40">
                          <Disc3
                            className={`h-12 w-12 text-cyan-600/70 dark:text-cyan-100/70 sm:h-24 sm:w-24 ${isPlaying ? "animate-[spin_5s_linear_infinite]" : ""}`}
                          />
                        </div>
                      </div>

                      <div className="absolute bottom-5 left-5 right-5 flex h-16 items-end gap-1.5 opacity-85">
                        {visualizerBars.map((height, index) => (
                          <span
                            key={`${height}-${index}`}
                            className={`flex-1 rounded-full bg-gradient-to-t from-cyan-500 via-indigo-400 to-amber-400 dark:from-cyan-300 dark:via-indigo-300 dark:to-amber-200 ${isPlaying ? "animate-pulse" : ""}`}
                            style={{
                              height: `${isPlaying ? height : Math.max(12, Math.round(height * 0.42))}%`,
                              animationDelay: `${index * 70}ms`,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-xl text-center">
                    <p className="mb-2 text-xs font-bold uppercase tracking-[0.24em] text-cyan-700/80 dark:text-cyan-200/80">
                      Now playing
                    </p>
                    <h3 className="text-balance text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
                      {currentTrack ? currentTrack.title : "Ready to play"}
                    </h3>
                    <p className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                      {currentTrack ? currentTrack.artist || "Workspace Audio" : "Pick a track from your workspace library"}
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Music2 className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-200" />
                        Workspace audio
                      </span>
                      <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                        <Layers className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />
                        {queueCount} in queue
                      </span>
                    </div>
                  </div>

                  <div className="w-full max-w-2xl rounded-xl border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-black/20 shadow-xl shadow-slate-200/50 dark:shadow-black/20 backdrop-blur-md">
                    <AudioControls />
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-200 dark:border-white/10 pt-4 lg:hidden">
                  <button
                    onClick={() => setIsMobileLibraryOpen(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/30 dark:border-cyan-300/25 bg-cyan-50 dark:bg-cyan-300/10 px-4 py-3 text-sm font-bold text-cyan-700 dark:text-cyan-100 transition-colors active:scale-[0.99]"
                  >
                    <Layers size={18} />
                    Browse Library
                    <span className="rounded-md bg-cyan-100 dark:bg-white/10 px-2 py-0.5 text-xs text-cyan-800 dark:text-cyan-50">
                      {libraryCount}
                    </span>
                  </button>
                </div>
              </div>
            </section>

            <aside
              className={`fixed inset-0 z-30 flex h-full flex-col bg-slate-50 dark:bg-[#070a12] transition-all duration-300 lg:static lg:z-auto lg:translate-y-0 lg:opacity-100 ${
                isMobileLibraryOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0"
              }`}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white dark:bg-[#0b1018] p-4 lg:hidden">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsMobileLibraryOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                    title="Back to player"
                  >
                    <SkipBack size={16} />
                  </button>
                  <h3 className="font-semibold text-slate-900 dark:text-white">Workspace Library</h3>
                </div>
                <button
                  onClick={() => setIsMobileLibraryOpen(false)}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white"
                  title="Close library"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="shrink-0 border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#090d15]/95 p-4 shadow-2xl shadow-slate-200/50 dark:shadow-black/10 sm:p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                      Collection
                    </p>
                    <h3 className="mt-1 truncate text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                      {panelTitle}
                    </h3>
                  </div>
                  <div className="hidden shrink-0 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04] px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 sm:block">
                    {activeListCount} tracks
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.03] p-1">
                  <button
                    onClick={() => setActiveTab("library")}
                    className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-all ${
                      activeTab === "library"
                        ? "bg-cyan-400 dark:bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/15"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <ListMusic size={16} />
                    Library
                    <span className="rounded bg-black/10 px-1.5 py-0.5 text-[11px]">
                      {libraryCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setActiveTab("queue")}
                    className={`flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold transition-all ${
                      activeTab === "queue"
                        ? "bg-cyan-400 dark:bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-500/15"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Layers size={16} />
                    Up Next
                    <span className="rounded bg-black/10 px-1.5 py-0.5 text-[11px]">
                      {queueCount}
                    </span>
                  </button>
                </div>

                {activeTab === "library" ? (
                  <div className="relative mt-4">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Search discovered audio"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-11 w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-black/20 pl-10 pr-4 text-sm font-medium text-slate-900 dark:text-white outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-cyan-400/50 dark:focus:border-cyan-300/50 focus:ring-2 focus:ring-cyan-400/15 dark:focus:ring-cyan-300/15"
                    />
                  </div>
                ) : (
                  <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.03] px-3 py-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400">
                    <span className="inline-flex items-center gap-2">
                      <Headphones className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                      Queue order
                    </span>
                    <span>{currentPosition ? `${currentPosition}/${queueCount}` : "No active track"}</span>
                  </div>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto bg-white dark:bg-[#05070d] p-3 custom-scrollbar sm:p-5">
                {activeTab === "library" ? (
                  isLoading ? (
                    <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-4">
                      <div className="h-11 w-11 animate-spin rounded-full border-2 border-cyan-400 dark:border-cyan-300 border-t-transparent shadow-sm" />
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-400">Scanning workspace</p>
                    </div>
                  ) : tracks.length > 0 ? (
                    <div className="grid grid-cols-1 gap-2.5">
                      {tracks.map((track, idx) => (
                        <AudioTrackCard
                          key={track.id}
                          track={track}
                          index={idx}
                          contextTracks={tracks}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex h-full min-h-[260px] items-center justify-center px-6 text-center">
                      <div className="max-w-sm">
                        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04]">
                          <Disc3 className="h-7 w-7 text-slate-500" />
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-white">No audio found</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                          Audio URLs discovered in workspace data will appear here.
                        </p>
                      </div>
                    </div>
                  )
                ) : queue.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2.5">
                    {queue.map((track, idx) => (
                      <div
                        key={`${track.id}-${idx}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, idx)}
                        onDragOver={(e) => handleDragOver(e, idx)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, idx)}
                        onDragEnd={handleDragEnd}
                        className={`transition-all duration-200 ${draggedItemIndex === idx ? "scale-[0.98] opacity-55" : ""} ${
                          draggedOverIndex === idx && draggedItemIndex !== null
                            ? draggedItemIndex < idx
                              ? "border-b-2 border-b-cyan-300 pb-2 mb-2"
                              : "border-t-2 border-t-cyan-300 pt-2 mt-2"
                            : ""
                        }`}
                      >
                        <AudioTrackCard
                          track={track}
                          index={idx}
                          isQueueItem={true}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-full min-h-[260px] items-center justify-center px-6 text-center">
                    <div className="max-w-sm">
                      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/[0.04]">
                        <Layers className="h-7 w-7 text-slate-500" />
                      </div>
                      <p className="font-semibold text-slate-900 dark:text-white">Queue is empty</p>
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        Added tracks will be staged here for continuous playback.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </main>
      </div>
    </div>
  );
};

export default AudioPlayerModal;
