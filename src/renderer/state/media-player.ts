
// Main React application component
import { create } from 'zustand';
import type { PlaybackState, MediaSource, MediaMetadata, MediaPlayerState } from '../../shared/types/media';

interface MediaPlayerStore extends MediaPlayerState {
  playlist: MediaSource[];
  currentIndex: number;
  playbackSpeed: number;
  isMuted: boolean;
  streamUrl?: string;
  metadata?: MediaMetadata;

  // Actions
  init: () => void;
  setPlaybackState: (state: Partial<PlaybackState>) => void;
  syncTime: (position: number, duration?: number) => void;

  // Commands to Main
  play: (index?: number) => void;
  pause: () => void;
  stop: () => void;
  seek: (position: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  next: () => void;
  previous: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  setSpeed: (speed: number) => void;

  loadPlaylist: () => Promise<void>;
  addToPlaylist: (item: MediaSource, playNow?: boolean) => void;
  removeFromPlaylist: (index: number) => void;
  clearPlaylist: () => void;
  playAtIndex: (index: number) => void;
}

export const useMediaPlayerStore = create<MediaPlayerStore>((set, get) => ({
  // Initial state (will be synced from Main)
  status: 'stopped',
  currentSource: null,
  position: 0,
  duration: 0,
  volume: 1.0,
  shuffle: false,
  repeat: 'off',
  playbackSpeed: 1.0,
  isMuted: false,
  streamUrl: undefined,
  metadata: undefined,
  playlist: [],
  currentIndex: -1,

  init: () => {
    // 1. Initial State Load
    window.electronAPI.media.getState().then(state => {
      set({ ...state });
      if (state.currentSource) {
        get().playAtIndex(state.currentIndex);
      }
    });

    // 2. Listen for changes from Main
    window.electronAPI.media.onStateChanged((newState) => {
      const current = get();
      const oldSource = current.currentSource;

      // 1. Position Protection: The renderer is the source of truth for 'position' while playing.
      // If the remote state is lagging behind or resetting to 0 for the same track, ignore it.
      if (current.status === 'playing' && newState.status === 'playing') {
        const isSameTrack = oldSource && newState.currentSource && (oldSource.id === newState.currentSource.id || oldSource.path === newState.currentSource.path);
        if (isSameTrack) {
          // If remote is 0 or lagging by more than 1 second, keep local position
          if (newState.position === 0 || (newState.position < current.position && (current.position - newState.position) < 30)) {
            newState.position = current.position;
          }
        }
      }

      // 2. Track Change Detection: Only trigger 'playAtIndex' if the track IDENTITY has changed.
      // We check both ID and Path to be safe.
      const hasTrack = !!newState.currentSource;
      const isNewTrack = hasTrack && (
        !oldSource || 
        (oldSource.id !== newState.currentSource.id && oldSource.path !== newState.currentSource.path)
      );

      // 3. Update mirrored state
      set({ ...newState });

      // 4. Enrichment: If it's a real track change, fetch metadata/streamUrl
      if (isNewTrack && newState.currentIndex !== -1) {
        console.log(`[MediaPlayerStore] Real track change to index ${newState.currentIndex}: ${newState.currentSource?.title}`);
        get().playAtIndex(newState.currentIndex);
      }
    });
  },

  setPlaybackState: (newState) => set((state) => ({ ...state, ...newState })),

  syncTime: (position, duration) => {
    const update: Partial<MediaPlayerState> = { position };
    if (duration !== undefined && isFinite(duration) && duration > 0) {
      update.duration = duration;
    }
    set(update);
    window.electronAPI.media.syncTime(position, duration);
  },

  play: (index) => window.electronAPI.media.play(index),
  pause: () => window.electronAPI.media.pause(),
  stop: () => window.electronAPI.media.stop(),

  seek: (position) => {
    set({ position });
    window.electronAPI.media.seek(position);
  },

  setVolume: (volume) => {
    set({ volume });
    window.electronAPI.media.setVolume(volume);
  },

  toggleMute: () => window.electronAPI.media.toggleMute(),

  next: () => window.electronAPI.media.next(),
  previous: () => window.electronAPI.media.previous(),

  toggleShuffle: () => {
    const { shuffle } = get();
    window.electronAPI.media.setShuffle(!shuffle);
  },

  toggleRepeat: () => {
    const { repeat } = get();
    const modes = ['off', 'one', 'all'];
    const nextMode = modes[(modes.indexOf(repeat) + 1) % modes.length];
    window.electronAPI.media.setRepeat(nextMode);
  },

  setSpeed: (speed) => {
    set({ playbackSpeed: speed });
    window.electronAPI.media.setSpeed(speed);
  },

  loadPlaylist: async () => {
    const state = await window.electronAPI.media.getState();
    set({ playlist: state.playlist, currentIndex: state.currentIndex });
  },

  addToPlaylist: (item, playNow?: boolean) => {
    window.electronAPI.media.addToPlaylist(item, playNow);
  },

  removeFromPlaylist: (index: number) => {
    window.electronAPI.media.removeFromPlaylist(index);
  },

  clearPlaylist: () => window.electronAPI.media.clearPlaylist(),

  playAtIndex: async (index) => {
    const { playlist } = get();
    if (index < 0 || index >= playlist.length) return;

    const item = playlist[index];

    // YouTube items stream via iframe — skip ffprobe/getStreamUrl entirely
    if (item.providerId === 'youtube') {
      set({
        currentSource: item,
        currentIndex: index,
        streamUrl: item.path,
        metadata: undefined,
        duration: item.duration || 0,
        position: 0,
        status: 'playing',
      });
      return;
    }

    // Clear stale URL immediately
    set({ streamUrl: undefined });

    // Step 1: Get stream URL and start playback right away — don't block on metadata
    let url: string;
    try {
      url = await window.electronAPI.media.getStreamUrl(item);
    } catch (err) {
      console.error("[MediaPlayer] Failed to get stream URL for index", index, err);
      return;
    }

    // Commit just enough to start playback immediately
    set({
      currentSource: item,
      currentIndex: index,
      streamUrl: url,
      position: 0,
    });

    // Step 2: Enrich with metadata and resume position — best-effort, failure won't stop playback
    try {
      const [metadata, resumePos] = await Promise.all([
        window.electronAPI.media.getMetadata(item.path),
        window.electronAPI.media.getResumePosition(item.id),
      ]);
      set({
        metadata,
        duration: metadata.duration || 0,
        position: (resumePos > 5 && resumePos < (metadata.duration || 0) - 10) ? resumePos : 0
      });
    } catch (err) {
      console.warn("[MediaPlayer] Metadata fetch failed (ffprobe issue?) — playing without metadata:", err);
    }
  },
}));
