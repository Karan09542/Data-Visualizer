export interface AudioTrack {
  id: string;
  title: string;
  artist?: string;
  duration?: number;
  source: string;
  type: string;
  thumbnail?: string;
  createdAt: number;
  /**
   * "upload" tracks were added in the audio player. They live only in the library, never in the
   * workspace data, so they never become canvas nodes and workspace cleanup leaves them alone.
   */
  origin?: "workspace" | "upload";
  /** Uploads: the file's key in the on-device store (OPFS, or IndexedDB where OPFS is missing) */
  storageKey?: string;
  /** Uploads: whether cover art was saved beside the file */
  hasCover?: boolean;
  /** Uploads: file size in bytes */
  size?: number;
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
