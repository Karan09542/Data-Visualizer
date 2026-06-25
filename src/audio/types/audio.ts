export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  duration?: number;
  source: string;
  type: string;
  thumbnail?: string;
  createdAt: number;
}

export interface AudioState {
  currentTrack: AudioTrack | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  duration: number;
  isMuted: boolean;
  playbackRate: number;
  isLooping: boolean;
  isShuffle: boolean;
  queue: AudioTrack[];
  queueIndex: number;
  isPlayerOpen: boolean;
}
