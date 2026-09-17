import React, { useEffect, useState } from "react";
import {
  X,
  Search,
  ListMusic,
  Disc3,
  Layers,
  ChevronLeft,
  Loader2,
} from "lucide-react";
import { useAudioStore } from "../stores/audioStore";
import { useAudioLibrary } from "../hooks/useAudioLibrary";
import { AudioTrackCard } from "./AudioTrackCard";
import { AudioControls } from "./AudioControls";
import { useAudioPlayer } from "../hooks/useAudioPlayer";

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const SURFACE = "bg-white dark:bg-[#0f1116]";
const PANEL = "bg-slate-50 dark:bg-[#0b0d12]";
const HAIRLINE = "border-black/8 dark:border-white/10";

const TAB_BASE =
  "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg text-[13px] font-semibold transition-colors";
const TAB_ACTIVE = "bg-white text-slate-900 shadow-sm dark:bg-white/14 dark:text-white";
const TAB_IDLE =
  "text-slate-500 hover:text-slate-800 dark:text-white/50 dark:hover:text-white/80";

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
  const currentPosition = queueIndex >= 0 ? queueIndex + 1 : 0;

  /** One quiet line instead of a row of competing badges */
  const trackMeta = [
    currentPosition ? `${currentPosition} of ${queueCount}` : queueCount ? `${queueCount} queued` : null,
    currentTrack?.createdAt ? `Added ${DATE_FORMAT.format(currentTrack.createdAt)}` : null,
  ].filter(Boolean).join("  ·  ");

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

  // Escape closes the player, the same as the button in the corner
  useEffect(() => {
    if (!isPlayerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (isMobileLibraryOpen) setIsMobileLibraryOpen(false);
      else togglePlayer();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPlayerOpen, isMobileLibraryOpen, togglePlayer]);

  if (!isPlayerOpen) return null;

  const emptyState = (icon: React.ReactNode, title: string, detail: string) => (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center px-6 text-center">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl border ${HAIRLINE} bg-black/[0.03] text-slate-400 dark:bg-white/5 dark:text-white/30`}>
        {icon}
      </div>
      <p className="mt-4 text-sm font-semibold text-slate-800 dark:text-white/90">{title}</p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-slate-500 dark:text-white/40">
        {detail}
      </p>
    </div>
  );

  const trackList = (
    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
      {activeTab === "library" ? (
        isLoading ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-cyan-500 dark:text-cyan-300" />
            <p className="text-[13px] font-medium text-slate-500 dark:text-white/50">
              Scanning your workspace…
            </p>
          </div>
        ) : tracks.length > 0 ? (
          <div className="flex flex-col gap-2">
            {tracks.map((track, idx) => (
              <AudioTrackCard key={track.id} track={track} index={idx} contextTracks={tracks} />
            ))}
          </div>
        ) : (
          emptyState(
            <Disc3 className="h-7 w-7" />,
            searchQuery ? "Nothing matches that search" : "No audio found",
            searchQuery
              ? "Try a different word, or clear the search."
              : "Audio links found in your workspace data will be listed here.",
          )
        )
      ) : queue.length > 0 ? (
        <div className="flex flex-col gap-2">
          {queue.map((track, idx) => (
            <div
              key={`${track.id}-${idx}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`rounded-xl transition-all duration-150 ${draggedItemIndex === idx ? "scale-[0.98] opacity-50" : ""} ${
                draggedOverIndex === idx && draggedItemIndex !== null
                  ? draggedItemIndex < idx
                    ? "border-b-2 border-b-cyan-400 pb-2"
                    : "border-t-2 border-t-cyan-400 pt-2"
                  : ""
              }`}
            >
              <AudioTrackCard track={track} index={idx} isQueueItem={true} />
            </div>
          ))}
        </div>
      ) : (
        emptyState(
          <Layers className="h-7 w-7" />,
          "Nothing queued",
          "Tracks you add play one after another. Add one from the library.",
        )
      )}
    </div>
  );

  const listControls = (
    <div className={`shrink-0 border-b ${HAIRLINE} p-3 sm:p-4`}>
      <div className={`flex gap-1 rounded-xl border ${HAIRLINE} bg-black/[0.03] p-1 dark:bg-white/5`}>
        <button
          onClick={() => setActiveTab("library")}
          aria-pressed={activeTab === "library"}
          className={`${TAB_BASE} ${activeTab === "library" ? TAB_ACTIVE : TAB_IDLE}`}
        >
          <ListMusic size={15} />
          Library
          <span className="text-[11px] tabular-nums opacity-60">{libraryCount}</span>
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          aria-pressed={activeTab === "queue"}
          className={`${TAB_BASE} ${activeTab === "queue" ? TAB_ACTIVE : TAB_IDLE}`}
        >
          <Layers size={15} />
          Up next
          <span className="text-[11px] tabular-nums opacity-60">{queueCount}</span>
        </button>
      </div>

      {activeTab === "library" ? (
        <div className="relative mt-3">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-white/35" />
          <input
            type="text"
            placeholder="Search audio"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`h-10 w-full rounded-xl border ${HAIRLINE} bg-black/[0.03] pl-9 pr-9 text-sm text-slate-800 outline-none transition-colors placeholder:text-slate-400 focus:border-cyan-400/60 focus:bg-transparent dark:bg-white/5 dark:text-white/90 dark:placeholder:text-white/35`}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-black/6 hover:text-slate-700 dark:text-white/40 dark:hover:bg-white/10 dark:hover:text-white/70"
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 px-1 text-[12px] text-slate-500 dark:text-white/40">
          {queueCount > 1 ? "Drag a track to change the order." : "Tracks play in the order you add them."}
        </p>
      )}
    </div>
  );

  return (
    <div className={`fixed inset-0 z-[10000] flex flex-col ${PANEL} text-slate-900 animate-in fade-in duration-200 dark:text-white`}>
      {/* Header */}
      <header className={`flex h-14 shrink-0 items-center justify-between gap-3 border-b ${HAIRLINE} ${SURFACE} px-3 sm:h-16 sm:px-5`}>
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/12 text-cyan-600 ring-1 ring-inset ring-cyan-500/20 dark:text-cyan-300">
            <ListMusic className="h-[18px] w-[18px]" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-tight sm:text-base">Audio</h2>
            <p className="truncate text-xs text-slate-500 dark:text-white/40">
              {libraryCount} {libraryCount === 1 ? "track" : "tracks"} found
              {queueCount > 0 ? ` · ${queueCount} queued` : ""}
            </p>
          </div>
        </div>

        <button
          onClick={togglePlayer}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-black/6 hover:text-slate-900 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
          title="Close"
          aria-label="Close audio player"
        >
          <X size={19} />
        </button>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(340px,400px)]">
        {/* Now playing */}
        <section className={`flex min-h-0 flex-col overflow-y-auto custom-scrollbar ${SURFACE} lg:border-r ${HAIRLINE}`}>
          <div className="flex flex-1 flex-col items-center justify-center gap-5 px-5 py-6 sm:gap-7 sm:px-8 sm:py-10">
            {/* Artwork. The disc only stands in when there is no picture, rather than covering one */}
            <div className={`relative aspect-square w-full max-w-[220px] overflow-hidden rounded-2xl border ${HAIRLINE} bg-slate-100 shadow-xl shadow-black/10 dark:bg-[#151922] dark:shadow-black/40 sm:max-w-[300px]`}>
              {currentTrack?.thumbnail ? (
                <img
                  src={currentTrack.thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-cyan-500/15 via-indigo-500/10 to-transparent">
                  <Disc3
                    className={`h-20 w-20 text-slate-400/70 dark:text-white/25 sm:h-28 sm:w-28 ${isPlaying ? "animate-[spin_6s_linear_infinite]" : ""}`}
                  />
                </div>
              )}
            </div>

            <div className="w-full max-w-lg text-center">
              <h3 className="text-balance text-xl font-semibold tracking-tight sm:text-2xl">
                {currentTrack ? currentTrack.title : "Nothing playing"}
              </h3>
              <p className="mt-1.5 truncate text-sm text-slate-500 dark:text-white/45">
                {currentTrack
                  ? currentTrack.artist || "Workspace audio"
                  : "Choose a track from your library to start"}
              </p>
              {currentTrack && trackMeta && (
                <p className="mt-2 text-xs text-slate-400 dark:text-white/30">{trackMeta}</p>
              )}
            </div>

            <div className={`w-full max-w-2xl rounded-2xl border ${HAIRLINE} ${PANEL} p-1`}>
              <AudioControls />
            </div>
          </div>

          {/* Only route to the list on small screens, where the panel is a sheet */}
          <div className={`shrink-0 border-t ${HAIRLINE} p-3 lg:hidden`}>
            <button
              onClick={() => setIsMobileLibraryOpen(true)}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-cyan-500/12 text-sm font-semibold text-cyan-700 ring-1 ring-inset ring-cyan-500/20 transition-colors active:scale-[0.99] dark:text-cyan-300"
            >
              <ListMusic size={17} />
              Browse library
              <span className="text-xs tabular-nums opacity-70">{libraryCount}</span>
            </button>
          </div>
        </section>

        {/* Library and queue: a side panel on desktop, a sheet on a phone */}
        <aside
          className={`fixed inset-0 z-30 flex flex-col ${PANEL} transition-transform duration-300 ease-out lg:static lg:z-auto lg:translate-y-0 ${
            isMobileLibraryOpen ? "translate-y-0" : "translate-y-full lg:translate-y-0"
          } ${isMobileLibraryOpen ? "" : "pointer-events-none lg:pointer-events-auto"}`}
        >
          <div className={`flex h-14 shrink-0 items-center gap-2 border-b ${HAIRLINE} ${SURFACE} px-3 lg:hidden`}>
            <button
              onClick={() => setIsMobileLibraryOpen(false)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-black/6 hover:text-slate-900 dark:text-white/50 dark:hover:bg-white/10 dark:hover:text-white"
              title="Back to player"
              aria-label="Back to player"
            >
              <ChevronLeft size={19} />
            </button>
            <h3 className="text-[15px] font-semibold">Library</h3>
          </div>

          {listControls}
          {trackList}
        </aside>
      </main>
    </div>
  );
};

export default AudioPlayerModal;
