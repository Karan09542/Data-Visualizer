import { Howl, Howler } from 'howler';
import { useAudioStore } from '../stores/audioStore';
import { AudioTrack } from '../types/audio';

class AudioEngine {
  private sound: Howl | null = null;
  private timer: number | null = null;

  playTrack(track: AudioTrack) {
    this.stop();
    
    const getFormat = (type?: string, url?: string) => {
      if (type) {
        const baseType = type.split(';')[0];
        let f = (baseType.includes('/') ? baseType.split('/')[1] : baseType).toLowerCase();
        if (f === 'mpeg') return 'mp3';
        return f;
      }
      if (url) {
        const match = url.match(/\.([^.?#]+)/);
        if (match) return match[1].toLowerCase();
      }
      return 'mp3';
    };

    const isBlob = track.source && track.source.startsWith('blob:');

    this.sound = new Howl({
      src: [track.source],
      html5: !isBlob, // Force HTML5 only for external URLs, blobs are better natively buffered via Web Audio API to avoid browser block bugs
      format: [getFormat(track.type, track.source)],
      volume: useAudioStore.getState().volume,
      rate: useAudioStore.getState().playbackRate,
      loop: useAudioStore.getState().isLooping,
      mute: useAudioStore.getState().isMuted,
      onloaderror: (id, err) => {
        console.error('Audio load error for track:', track.title, 'Error:', err);
      },
      onplayerror: (id, err) => {
        console.error('Audio play error for track:', track.title, 'Error:', err);
        this.sound?.once('unlock', () => {
          this.sound?.play();
        });
      },
      onload: () => {
        useAudioStore.getState().setDuration(this.sound?.duration() || 0);
      },
      onplay: () => {
        useAudioStore.getState().setIsPlaying(true);
        this.startTimer();
      },
      onpause: () => {
        useAudioStore.getState().setIsPlaying(false);
        this.stopTimer();
      },
      onstop: () => {
        useAudioStore.getState().setIsPlaying(false);
        useAudioStore.getState().setProgress(0);
        this.stopTimer();
      },
      onend: () => {
        if (!useAudioStore.getState().isLooping) {
          useAudioStore.getState().setIsPlaying(false);
          useAudioStore.getState().setProgress(0);
          this.stopTimer();
          this.next();
        }
      }
    });

    useAudioStore.getState().setCurrentTrack(track);
    this.sound.play();
  }

  play() {
    if (this.sound) {
      this.sound.play();
    } else {
      const state = useAudioStore.getState();
      if (state.queue.length > 0) {
        const index = state.queueIndex >= 0 ? state.queueIndex : 0;
        state.setQueueIndex(index);
        this.playTrack(state.queue[index]);
      }
    }
  }

  pause() {
    if (this.sound) {
      this.sound.pause();
    }
  }

  togglePlay() {
    if (this.sound && this.sound.playing()) {
      this.pause();
    } else {
      this.play();
    }
  }

  stop() {
    if (this.sound) {
      this.sound.stop();
      this.sound.unload();
      this.sound = null;
    }
    useAudioStore.getState().setIsPlaying(false);
    useAudioStore.getState().setCurrentTrack(null);
  }

  seek(position: number) {
    if (this.sound) {
      this.sound.seek(position);
      useAudioStore.getState().setProgress(position);
    }
  }

  setVolume(volume: number) {
    useAudioStore.getState().setVolume(volume);
    Howler.volume(volume);
  }

  toggleMute() {
    const isMuted = !useAudioStore.getState().isMuted;
    useAudioStore.getState().setIsMuted(isMuted);
    Howler.mute(isMuted);
  }

  setPlaybackRate(rate: number) {
    useAudioStore.getState().setPlaybackRate(rate);
    if (this.sound) {
      this.sound.rate(rate);
    }
  }

  toggleLoop() {
    const isLooping = !useAudioStore.getState().isLooping;
    useAudioStore.getState().setIsLooping(isLooping);
    if (this.sound) {
      this.sound.loop(isLooping);
    }
  }

  toggleShuffle() {
    const isShuffle = !useAudioStore.getState().isShuffle;
    useAudioStore.getState().setIsShuffle(isShuffle);
  }

  next() {
    const state = useAudioStore.getState();
    if (state.queue.length === 0) return;

    let nextIndex = state.queueIndex + 1;
    
    if (state.isShuffle) {
      nextIndex = Math.floor(Math.random() * state.queue.length);
    } else if (nextIndex >= state.queue.length) {
      nextIndex = 0; // Loop queue? or stop? Let's loop queue for now
    }

    state.setQueueIndex(nextIndex);
    this.playTrack(state.queue[nextIndex]);
  }

  previous() {
    const state = useAudioStore.getState();
    if (state.queue.length === 0) return;

    // If played more than 3 seconds, restart current track
    if (this.sound && (this.sound.seek() as number) > 3) {
      this.seek(0);
      return;
    }

    let prevIndex = state.queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = state.queue.length - 1;
    }

    state.setQueueIndex(prevIndex);
    this.playTrack(state.queue[prevIndex]);
  }

  private startTimer() {
    this.stopTimer();
    this.timer = window.setInterval(() => {
      if (this.sound && this.sound.playing()) {
        useAudioStore.getState().setProgress(this.sound.seek() as number);
      }
    }, 250);
  }

  private stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

export const audioEngine = new AudioEngine();
