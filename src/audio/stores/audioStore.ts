import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { AudioState, AudioTrack } from '../types/audio';

interface AudioStore extends AudioState {
  setCurrentTrack: (track: AudioTrack | null) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setVolume: (volume: number) => void;
  setProgress: (progress: number) => void;
  setDuration: (duration: number) => void;
  setIsMuted: (isMuted: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setIsLooping: (isLooping: boolean) => void;
  setIsShuffle: (isShuffle: boolean) => void;
  setQueue: (queue: AudioTrack[]) => void;
  setQueueIndex: (index: number) => void;
  setIsPlayerOpen: (isOpen: boolean) => void;
  togglePlayer: () => void;
  addToQueue: (track: AudioTrack) => void;
  removeFromQueue: (index: number) => void;
  reorderQueue: (startIndex: number, endIndex: number) => void;
  clearQueue: () => void;
  playTrackNow: (track: AudioTrack) => void;
}

export const useAudioStore = create<AudioStore>()(
  persist(
    (set) => ({
      currentTrack: null,
      isPlaying: false,
      volume: 1,
      progress: 0,
      duration: 0,
      isMuted: false,
      playbackRate: 1,
      isLooping: false,
      isShuffle: false,
      queue: [],
      queueIndex: -1,
      isPlayerOpen: false,

  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setVolume: (volume) => set({ volume }),
  setProgress: (progress) => set({ progress }),
  setDuration: (duration) => set({ duration }),
  setIsMuted: (isMuted) => set({ isMuted }),
  setPlaybackRate: (rate) => set({ playbackRate: rate }),
  setIsLooping: (isLooping) => set({ isLooping }),
  setIsShuffle: (isShuffle) => set({ isShuffle }),
  setQueue: (queue) => set({ queue }),
  setQueueIndex: (index) => set({ queueIndex: index }),
  setIsPlayerOpen: (isOpen) => set({ isPlayerOpen: isOpen }),
  togglePlayer: () => set((state) => ({ isPlayerOpen: !state.isPlayerOpen })),
  addToQueue: (track) => set((state) => ({ queue: [...state.queue, track] })),
  removeFromQueue: (index) => set((state) => {
    const newQueue = state.queue.filter((_, i) => i !== index);
    let newIndex = state.queueIndex;
    if (index < state.queueIndex) {
      newIndex--;
    } else if (index === state.queueIndex && newQueue.length > 0) {
      if (newIndex >= newQueue.length) newIndex = 0;
    } else if (newQueue.length === 0) {
      newIndex = -1;
    }
    return { queue: newQueue, queueIndex: newIndex };
  }),
  reorderQueue: (startIndex, endIndex) => set((state) => {
    const newQueue = [...state.queue];
    const [removed] = newQueue.splice(startIndex, 1);
    newQueue.splice(endIndex, 0, removed);
    
    let newIndex = state.queueIndex;
    if (state.queueIndex === startIndex) {
      newIndex = endIndex;
    } else if (startIndex < state.queueIndex && endIndex >= state.queueIndex) {
      newIndex--;
    } else if (startIndex > state.queueIndex && endIndex <= state.queueIndex) {
      newIndex++;
    }

    return { queue: newQueue, queueIndex: newIndex };
  }),
  clearQueue: () => set({ queue: [], queueIndex: -1 }),
  playTrackNow: (track) => set((state) => {
    const existingIndex = state.queue.findIndex(t => t.id === track.id);
    if (existingIndex !== -1) {
      return { currentTrack: track, queueIndex: existingIndex, isPlayerOpen: true };
    }
    const newQueue = [...state.queue];
    const insertIndex = state.queueIndex >= 0 ? state.queueIndex + 1 : 0;
    newQueue.splice(insertIndex, 0, track);
    return { currentTrack: track, queue: newQueue, queueIndex: insertIndex, isPlayerOpen: true };
  })
}), {
  name: 'audio-workspace-storage',
  partialize: (state) => ({
    queue: state.queue,
    queueIndex: state.queueIndex,
    currentTrack: state.currentTrack,
    volume: state.volume,
    isMuted: state.isMuted,
    playbackRate: state.playbackRate,
    isLooping: state.isLooping,
    isShuffle: state.isShuffle,
  })
}));
