import React, { useEffect, useState } from "react";
import {
  X,
  Search,
  ListMusic,
  Disc3,
  Layers,
  Maximize2,
  Minimize2,
  SkipBack,
} from "lucide-react";
import { useAudioStore } from "../stores/audioStore";
import { useAudioLibrary } from "../hooks/useAudioLibrary";
import { AudioTrackCard } from "./AudioTrackCard";
import { AudioControls } from "./AudioControls";
import { useAudioPlayer } from "../hooks/useAudioPlayer";

const AudioPlayerModal: React.FC = () => {
  const isPlayerOpen = useAudioStore((state) => state.isPlayerOpen);
  const togglePlayer = useAudioStore((state) => state.togglePlayer);
  const queue = useAudioStore((state) => state.queue);
  const { currentTrack, isPlaying } = useAudioPlayer();
  const { tracks, isLoading, searchQuery, setSearchQuery, refreshLibrary } =
    useAudioLibrary();

  const [activeTab, setActiveTab] = useState<"library" | "queue">("library");
  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedItemIndex(index);
    // Needed for Firefox to allow dragging
    e.dataTransfer.setData("text/plain", index.toString());
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    setDraggedOverIndex(index);
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragLeave = (e: React.DragEvent) => {
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
  const [isMobileLibraryOpen, setIsMobileLibraryOpen] = useState(false);

  // Load library when opened
  useEffect(() => {
    if (isPlayerOpen) {
      refreshLibrary();
    }
  }, [isPlayerOpen]);

  if (!isPlayerOpen) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-white dark:bg-[#0d1117] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-300 shadow-2xl w-full h-full rounded-none border-0"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <ListMusic className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              Audio Workspace
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={togglePlayer}
              className="p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
          {/* Left Column: Player & Current Track Details */}
          <div className="flex-1 w-full md:w-[45%] border-b md:border-b-0 md:border-r border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-[#161b22] flex flex-col sm:overflow-hidden custom-scrollbar">
            {/* Album Art / Visualizer Area */}
            <div className="flex-1 flex items-center justify-center p-4 sm:p-8 min-h-[200px] sm:min-h-[280px]">
              <div className="relative w-full max-w-[240px] sm:max-w-[320px] lg:max-w-[400px] aspect-square mx-auto">
                {currentTrack ? (
                  <div className="w-full h-full rounded-2xl shadow-xl overflow-hidden bg-slate-200 dark:bg-slate-800 relative group flex items-center justify-center ring-4 ring-white dark:ring-slate-800/50 transition-transform duration-500 hover:scale-[1.02]">
                    {currentTrack.thumbnail ? (
                      <img
                        src={currentTrack.thumbnail}
                        alt={currentTrack.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 flex items-center justify-center">
                        <Disc3
                          className={`w-24 sm:w-32 h-24 sm:h-32 text-indigo-500/40 dark:text-indigo-400/30 ${isPlaying ? "animate-[spin_4s_linear_infinite]" : ""}`}
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-full h-full rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 flex flex-col items-center justify-center text-slate-400">
                    <Disc3 className="w-12 sm:w-16 h-12 sm:h-16 mb-4 opacity-30" />
                    <p className="font-medium text-xs sm:text-sm">
                      No track selected
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Track Info */}
            <div className="px-4 py-2 sm:px-6 sm:py-4 text-center shrink-0">
              <h3 className="text-lg sm:text-2xl font-bold text-slate-900 dark:text-white truncate max-w-sm mx-auto">
                {currentTrack ? currentTrack.title : "Ready to play"}
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-0.5 sm:mt-1 font-medium">
                {currentTrack
                  ? "Workspace Audio"
                  : "Select a track from library"}
              </p>
            </div>

            {/* Controls */}
            <div className="pb-4 sm:pb-12 shrink-0 transform scale-90 sm:scale-100 origin-top">
              <AudioControls />
            </div>

            {/* Mobile Library Toggle */}
            <div className="md:hidden mt-auto p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0d1117] flex justify-center pb-4 sm:pb-8 shrink-0">
              <button
                onClick={() => setIsMobileLibraryOpen(true)}
                className="px-6 py-2.5 sm:px-8 sm:py-3 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20 rounded-full font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Layers size={18} />
                Open Library
              </button>
            </div>
          </div>

          {/* Right Column: Library / Queue */}
          <div
            className={`w-full md:w-[55%] flex flex-col bg-white dark:bg-[#0d1117] h-full overflow-hidden absolute md:relative inset-0 z-20 transition-all duration-500 ease-in-out ${isMobileLibraryOpen ? "translate-y-0 opacity-100" : "translate-y-full md:translate-y-0 opacity-0 md:opacity-100"}`}
          >
            {/* Mobile Header for Library */}
            <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 shrink-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsMobileLibraryOpen(false)}
                  className="p-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg"
                >
                  <SkipBack size={16} />
                </button>
                <h3 className="font-bold text-slate-900 dark:text-white">
                  Workspace Library
                </h3>
              </div>
              <button
                onClick={() => setIsMobileLibraryOpen(false)}
                className="p-2 bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs & Search */}
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 space-y-4 shrink-0 bg-white dark:bg-[#0d1117]">
              <div className="flex bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-200/50 dark:border-slate-700/50">
                <button
                  onClick={() => setActiveTab("library")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${activeTab === "library" ? "bg-white dark:bg-[#161b22] text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  Discovery Library
                </button>
                <button
                  onClick={() => setActiveTab("queue")}
                  className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${activeTab === "queue" ? "bg-white dark:bg-[#161b22] text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-black/5" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
                >
                  <Layers size={16} />
                  Up Next
                </button>
              </div>

              {activeTab === "library" && (
                <div className="relative group">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                  <input
                    type="text"
                    placeholder="Search discovered audio..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 dark:text-white transition-all placeholder:text-slate-400"
                  />
                </div>
              )}
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-slate-50/30 dark:bg-black/10">
              {activeTab === "library" ? (
                isLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="animate-spin rounded-full h-10 w-10 border-3 border-indigo-500 border-t-transparent shadow-sm"></div>
                    <p className="text-sm font-medium text-slate-500 animate-pulse">
                      Scanning workspace...
                    </p>
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
                  <div className="text-center py-16 px-6">
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Disc3 className="w-8 h-8 text-slate-300" />
                    </div>
                    <p className="text-slate-900 dark:text-white font-semibold mb-1">
                      No audio found
                    </p>
                    <p className="text-slate-500 dark:text-slate-400 text-sm">
                      Add JSON data with audio URLs to your workspace to see
                      them here.
                    </p>
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
                      className={`transition-all duration-200 ${draggedItemIndex === idx ? "opacity-50 scale-95" : ""} ${draggedOverIndex === idx && draggedItemIndex !== null ? (draggedItemIndex < idx ? "border-b-2 border-b-indigo-500 pb-2 mb-2" : "border-t-2 border-t-indigo-500 pt-2 mt-2") : ""}`}
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
                <div className="text-center py-16 px-6">
                  <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Layers className="w-8 h-8 text-slate-300" />
                  </div>
                  <p className="text-slate-900 dark:text-white font-semibold mb-1">
                    Queue is empty
                  </p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm">
                    Add tracks from the library to build your playlist.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AudioPlayerModal;
