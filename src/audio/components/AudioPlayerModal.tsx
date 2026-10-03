import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  ListMusic,
  Disc3,
  Layers,
  ChevronDown,
  Loader2,
  Play,
  Pause,
  Upload,
} from "lucide-react";
import { useAudioStore } from "../stores/audioStore";
import { useAudioLibrary } from "../hooks/useAudioLibrary";
import { AudioTrackCard } from "./AudioTrackCard";
import { AudioControls } from "./AudioControls";
import { useAudioPlayer } from "../hooks/useAudioPlayer";
import { UPLOAD_ACCEPT, isPlayableMedia, uploadAudioFiles } from "../services/audioUploads";

const DATE_FORMAT = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Inset of each ring around the play button, outermost first, as a percentage of the stage */
const RINGS = [0, 10, 20];

const ROUND_BUTTON =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-(--ap-muted) transition-colors hover:bg-(--ap-hover) hover:text-(--ap-ink) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line)";

const TAB_BASE =
  "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold transition-colors";
const TAB_ACTIVE = "bg-(--ap-surface) text-(--ap-ink) shadow-sm dark:bg-white/10";
const TAB_IDLE = "text-(--ap-muted) hover:text-(--ap-ink)";

const AudioPlayerModal: React.FC = () => {
  const isPlayerOpen = useAudioStore((state) => state.isPlayerOpen);
  const togglePlayer = useAudioStore((state) => state.togglePlayer);
  const queue = useAudioStore((state) => state.queue);
  const queueIndex = useAudioStore((state) => state.queueIndex);
  const { currentTrack, isPlaying, togglePlay, playQueue } = useAudioPlayer();
  const { tracks, isLoading, searchQuery, setSearchQuery, refreshLibrary } =
    useAudioLibrary();

  const [activeTab, setActiveTab] = useState<"library" | "queue">("library");
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);
  const [isMobileLibraryOpen, setIsMobileLibraryOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadNote, setUploadNote] = useState<{ text: string; tone: "ok" | "error" } | null>(null);
  const [isDroppingFiles, setIsDroppingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const libraryCount = tracks.length;
  const queueCount = queue.length;
  const currentPosition = queueIndex >= 0 ? queueIndex + 1 : 0;
  const nextTrack = queueIndex >= 0 ? queue[queueIndex + 1] : undefined;

  const headerMeta = currentPosition
    ? `Track ${currentPosition} of ${queueCount}`
    : `${libraryCount} ${libraryCount === 1 ? "track" : "tracks"} in library`;

  const artistLine = currentTrack
    ? [
        currentTrack.artist || "Workspace audio",
        currentTrack.createdAt ? `Added ${DATE_FORMAT.format(currentTrack.createdAt)}` : null,
      ].filter(Boolean).join("  ·  ")
    : "Choose a track from your library to start";

  /** With nothing loaded yet, the big button starts the library from the top */
  const handlePlayButton = () => {
    if (!currentTrack && tracks.length > 0) playQueue(tracks, 0);
    else togglePlay();
  };

  /** Saves the files on this device and adds them to the library; they never touch the canvas */
  const handleUpload = async (files: File[]) => {
    if (files.length === 0 || isUploading) return;
    setIsUploading(true);
    setUploadNote(null);
    try {
      const { tracks: added, skipped, backend } = await uploadAudioFiles(files);
      await refreshLibrary();
      setActiveTab("library");
      setSearchQuery("");
      const where = backend === "opfs" ? "device storage" : "browser storage";
      const parts = [];
      if (added.length) parts.push(`Added ${added.length} ${added.length === 1 ? "track" : "tracks"} to ${where}.`);
      if (skipped.length === 1) parts.push(`Skipped ${skipped[0].name}: ${skipped[0].reason.toLowerCase()}.`);
      else if (skipped.length > 1) parts.push(`Skipped ${skipped.length} files that could not be added.`);
      setUploadNote({ text: parts.join(" "), tone: added.length ? "ok" : "error" });
    } catch (err) {
      console.error("Audio upload failed", err);
      setUploadNote({ text: "Upload failed. Please try again.", tone: "error" });
    } finally {
      setIsUploading(false);
    }
  };

  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer.types).includes("Files");

  const openSheet = (tab: "library" | "queue") => {
    setActiveTab(tab);
    setIsMobileLibraryOpen(true);
  };

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

  // Escape closes the sheet first, then the player
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
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-(--ap-accent-soft) text-(--ap-accent)">
        {icon}
      </div>
      <p className="mt-4 text-sm font-semibold text-(--ap-ink)">{title}</p>
      <p className="mt-1 max-w-xs text-[13px] leading-relaxed text-(--ap-muted)">{detail}</p>
    </div>
  );

  const trackList = (
    <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-2 sm:px-4">
      {activeTab === "library" ? (
        isLoading ? (
          <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-(--ap-accent)" />
            <p className="text-[13px] font-medium text-(--ap-muted)">Scanning your workspace…</p>
          </div>
        ) : tracks.length > 0 ? (
          <div className="flex flex-col gap-1">
            {tracks.map((track, idx) => (
              <AudioTrackCard key={track.id} track={track} index={idx} contextTracks={tracks} />
            ))}
          </div>
        ) : (
          emptyState(
            <Disc3 className="h-6 w-6" />,
            searchQuery ? "Nothing matches that search" : "No audio yet",
            searchQuery
              ? "Try a different word, or clear the search."
              : "Upload audio from this device, or drop files here. Audio links in your workspace data show up too.",
          )
        )
      ) : queue.length > 0 ? (
        <div className="flex flex-col gap-1">
          {queue.map((track, idx) => (
            <div
              key={`${track.id}-${idx}`}
              draggable
              onDragStart={(e) => handleDragStart(e, idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, idx)}
              onDragEnd={handleDragEnd}
              className={`rounded-2xl transition-all duration-150 ${draggedItemIndex === idx ? "scale-[0.98] opacity-50" : ""} ${
                draggedOverIndex === idx && draggedItemIndex !== null
                  ? draggedItemIndex < idx
                    ? "border-b-2 border-b-(--ap-accent) pb-2"
                    : "border-t-2 border-t-(--ap-accent) pt-2"
                  : ""
              }`}
            >
              <AudioTrackCard track={track} index={idx} isQueueItem={true} />
            </div>
          ))}
        </div>
      ) : (
        emptyState(
          <Layers className="h-6 w-6" />,
          "Nothing queued",
          "Tracks you add play one after another. Add one from the library.",
        )
      )}
    </div>
  );

  const listControls = (
    <div className="shrink-0 px-3 pb-2 pt-1 sm:px-4 lg:pt-5">
      <div className="flex gap-1 rounded-full bg-(--ap-chip) p-1">
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
        <>
        <div className="mt-3 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--ap-muted)" />
          <input
            type="text"
            placeholder="Search audio"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-full border border-transparent bg-(--ap-chip) pl-10 pr-9 text-sm text-(--ap-ink) outline-none transition-colors placeholder:text-(--ap-muted) focus:border-(--ap-accent-line) focus:bg-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-(--ap-muted) transition-colors hover:bg-(--ap-hover) hover:text-(--ap-ink)"
              title="Clear search"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            title="Upload audio from this device"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-(--ap-accent) px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ap-accent-line) disabled:opacity-60 dark:text-[#1b2116]"
          >
            {isUploading ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
            {isUploading ? "Saving…" : "Upload"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept={UPLOAD_ACCEPT}
            multiple
            hidden
            onChange={(e) => {
              handleUpload(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
        </div>
        {uploadNote ? (
          <p
            role="status"
            className={`mt-2 px-1 text-[12px] ${uploadNote.tone === "error" ? "text-red-600 dark:text-red-400" : "text-(--ap-accent-strong)"}`}
          >
            {uploadNote.text}
          </p>
        ) : (
          <p className="mt-2 px-1 text-[12px] text-(--ap-muted)">
            Uploads stay on this device and are not added to your canvas.
          </p>
        )}
        </>
      ) : (
        <p className="mt-3 px-1 text-[12px] text-(--ap-muted)">
          {queueCount > 1 ? "Drag a track to change the order." : "Tracks play in the order you add them."}
        </p>
      )}
    </div>
  );

  return (
    <div className="audio-player fixed inset-0 z-[10000] flex flex-col bg-(--ap-bg) text-(--ap-ink) animate-in fade-in duration-200">
      <main className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(360px,420px)]">
        {/* Now playing */}
        <section className="ap-stage relative flex min-h-0 flex-col">
          <header className="grid h-14 shrink-0 grid-cols-[40px_1fr_40px] items-center gap-2 px-3 sm:h-16 sm:px-5">
            <button
              onClick={togglePlayer}
              className={ROUND_BUTTON}
              title="Close"
              aria-label="Close audio player"
            >
              <ChevronDown size={22} className="lg:hidden" />
              <X size={19} className="hidden lg:block" />
            </button>
            <div className="min-w-0 text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-(--ap-muted)">
                Now playing
              </p>
              <p className="truncate text-xs text-(--ap-muted) opacity-80">{headerMeta}</p>
            </div>
            <span aria-hidden />
          </header>

          <div className="custom-scrollbar flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col items-center justify-center gap-6 px-6 pb-6 pt-2 sm:gap-8 sm:pb-10 [@media(max-height:720px)]:gap-4">
              <div className="w-full text-center">
                <h2 className="line-clamp-2 text-balance text-[26px] font-semibold leading-tight tracking-tight sm:text-[32px]">
                  {currentTrack ? currentTrack.title : "Nothing playing"}
                </h2>
                <div className="mt-3 flex items-center justify-center gap-2 text-sm text-(--ap-muted)">
                  {currentTrack && (
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--ap-accent-soft) text-[11px] font-semibold uppercase text-(--ap-accent-strong)">
                      {currentTrack.thumbnail ? (
                        <img src={currentTrack.thumbnail} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (currentTrack.artist || currentTrack.title).charAt(0)
                      )}
                    </span>
                  )}
                  <span className="truncate">{artistLine}</span>
                </div>
              </div>

              {/* Soft rings around the play button, in place of a square cover */}
              <div className="relative aspect-square w-full max-w-[280px] sm:max-w-[340px] [@media(max-height:720px)]:max-w-[220px]">
                {RINGS.map((inset, i) => (
                  <div
                    key={inset}
                    className={`absolute rounded-full ${isPlaying ? "ap-breathe" : ""}`}
                    style={{
                      inset: `${inset}%`,
                      background: `var(--ap-ring-${i + 1})`,
                      animationDelay: `${i * 0.4}s`,
                    }}
                  />
                ))}
                <div className="absolute inset-[30%] overflow-hidden rounded-full bg-(--ap-ring-4)">
                  {currentTrack?.thumbnail && (
                    <img src={currentTrack.thumbnail} alt="" className="h-full w-full object-cover opacity-70" />
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <button
                    onClick={handlePlayButton}
                    title={isPlaying ? "Pause" : "Play"}
                    aria-label={isPlaying ? "Pause" : "Play"}
                    className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-(--ap-button) text-(--ap-on-button) shadow-(--ap-button-shadow) transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--ap-accent-line) active:scale-95 sm:h-20 sm:w-20"
                  >
                    {isPlaying ? (
                      <Pause size={28} fill="currentColor" strokeWidth={0} />
                    ) : (
                      <Play size={28} className="ml-1" fill="currentColor" strokeWidth={0} />
                    )}
                  </button>
                </div>
              </div>

              <AudioControls />
            </div>

            {/* Phones reach the list from a floating pill; on desktop it sits alongside */}
            <div className="sticky bottom-0 flex shrink-0 justify-center px-6 pb-[max(env(safe-area-inset-bottom),16px)] pt-2 lg:hidden">
              <button
                onClick={() => openSheet(nextTrack ? "queue" : "library")}
                className="flex h-12 max-w-full items-center gap-2.5 rounded-full border border-(--ap-line) bg-(--ap-surface) pl-4 pr-5 text-sm shadow-lg shadow-black/5 transition-transform active:scale-[0.98] dark:shadow-black/40"
              >
                <ListMusic size={17} className="shrink-0 text-(--ap-accent)" />
                {nextTrack ? (
                  <span className="min-w-0 truncate">
                    <span className="text-(--ap-muted)">Up next · </span>
                    <span className="font-semibold">{nextTrack.title}</span>
                  </span>
                ) : (
                  <span className="font-semibold">
                    Browse library
                    <span className="ml-1.5 font-normal tabular-nums text-(--ap-muted)">{libraryCount}</span>
                  </span>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Dims the player behind the sheet on phones */}
        <div
          onClick={() => setIsMobileLibraryOpen(false)}
          aria-hidden
          className={`fixed inset-0 z-20 bg-black/35 transition-opacity duration-300 lg:hidden ${
            isMobileLibraryOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        />

        {/* Library and queue: a side panel on desktop, a bottom sheet on a phone */}
        <aside
          onDragOver={(e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
            setIsDroppingFiles(true);
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setIsDroppingFiles(false);
          }}
          onDrop={(e) => {
            if (!hasFiles(e)) return;
            e.preventDefault();
            setIsDroppingFiles(false);
            handleUpload(Array.from(e.dataTransfer.files).filter(isPlayableMedia));
          }}
          className={`fixed inset-x-0 bottom-0 top-[8vh] z-30 flex flex-col overflow-hidden rounded-t-[28px] bg-(--ap-surface) shadow-2xl transition-[translate,visibility] duration-300 ease-out lg:relative lg:inset-auto lg:z-auto lg:translate-y-0 lg:rounded-none lg:border-l lg:border-(--ap-line) lg:shadow-none ${
            isMobileLibraryOpen ? "translate-y-0" : "translate-y-full max-lg:invisible"
          }`}
        >
          <div className="shrink-0 lg:hidden">
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-(--ap-track)" />
            <div className="flex h-12 items-center justify-between px-4">
              <h3 className="text-[15px] font-semibold">Your audio</h3>
              <button
                onClick={() => setIsMobileLibraryOpen(false)}
                className={ROUND_BUTTON}
                title="Back to player"
                aria-label="Back to player"
              >
                <ChevronDown size={20} />
              </button>
            </div>
          </div>

          {listControls}
          {trackList}

          {isDroppingFiles && (
            <div className="pointer-events-none absolute inset-3 z-10 flex flex-col items-center justify-center gap-2 rounded-3xl border-2 border-dashed border-(--ap-accent) bg-(--ap-surface)/90 text-center backdrop-blur-sm">
              <Upload size={26} className="text-(--ap-accent)" />
              <p className="text-sm font-semibold">Drop audio to add it to your library</p>
              <p className="text-xs text-(--ap-muted)">It stays on this device and is not added to your canvas</p>
            </div>
          )}
        </aside>
      </main>
    </div>
  );
};

export default AudioPlayerModal;
