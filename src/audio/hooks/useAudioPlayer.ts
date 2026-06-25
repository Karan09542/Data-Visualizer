import { useEffect } from 'react';
import { useAudioStore } from '../stores/audioStore';
import { audioEngine } from '../services/audioEngine';
import { AudioTrack } from '../types/audio';

export const useAudioPlayer = () => {
  const store = useAudioStore();

  const play = () => audioEngine.play();
  const pause = () => audioEngine.pause();
  const togglePlay = () => audioEngine.togglePlay();
  const stop = () => audioEngine.stop();
  const seek = (pos: number) => audioEngine.seek(pos);
  const setVolume = (vol: number) => audioEngine.setVolume(vol);
  const toggleMute = () => audioEngine.toggleMute();
  const setPlaybackRate = (rate: number) => audioEngine.setPlaybackRate(rate);
  const toggleLoop = () => audioEngine.toggleLoop();
  const toggleShuffle = () => audioEngine.toggleShuffle();
  const next = () => audioEngine.next();
  const previous = () => audioEngine.previous();

  const playTrack = (track: AudioTrack) => {
    // If we're playing a track that's not in the queue, add it and play it.
    // Alternatively, just replace the queue with this single track for simplicity,
    // or insert it next. Let's just play it directly and set it as the queue.
    store.setQueue([track]);
    store.setQueueIndex(0);
    audioEngine.playTrack(track);
  };

  const playQueue = (queue: AudioTrack[], startIndex: number = 0) => {
    store.setQueue(queue);
    store.setQueueIndex(startIndex);
    audioEngine.playTrack(queue[startIndex]);
  };

  return {
    ...store,
    play,
    pause,
    togglePlay,
    stop,
    seek,
    setVolume,
    toggleMute,
    setPlaybackRate,
    toggleLoop,
    toggleShuffle,
    next,
    previous,
    playTrack,
    playQueue
  };
};
