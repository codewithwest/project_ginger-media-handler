
import { create } from 'zustand';

import type { LibraryTrack } from '../../shared/types/app';

interface LibraryStore {
  folders: string[];
  tracks: LibraryTrack[];
  isLoading: boolean;
  scanProgress: { processed: number; total: number; currentFile: string } | null;

  init: () => () => void;
  loadLibrary: () => Promise<void>;
  addFolder: () => Promise<void>; // Triggers dialog in main
  removeFolder: (path: string) => Promise<void>;
  scanLibrary: () => Promise<void>;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  folders: [],
  tracks: [],
  isLoading: false,
  scanProgress: null,

  init: () => {
    // Set up listeners for background scan events
    const unsubStart = window.electronAPI.library.onScanStart(() => {
      set({ isLoading: true, scanProgress: null });
    });

    const unsubProgress = window.electronAPI.library.onScanProgress((progress) => {
      set({ scanProgress: progress, isLoading: true });
    });

    const unsubTrackAdded = window.electronAPI.library.onTrackAdded((track) => {
      set((state) => {
        // Simple deduplication locally just in case
        if (state.tracks.some(t => t.path === track.path)) return state;
        return { tracks: [...state.tracks, track], isLoading: true };
      });
    });

    const unsubComplete = window.electronAPI.library.onScanComplete((tracks) => {
      set({ tracks, isLoading: false, scanProgress: null });
    });

    // Cleanup function
    return () => {
      unsubStart();
      unsubProgress();
      unsubTrackAdded();
      unsubComplete();
    };
  },

  loadLibrary: async () => {
    set({ isLoading: true });
    try {
      const folders = await window.electronAPI.library.getFolders();
      const tracks = await window.electronAPI.library.getAll();
      set({ folders, tracks, isLoading: false });
    } catch (err) {
      console.error('Failed to load library:', err);
      set({ isLoading: false });
    }
  },

  addFolder: async () => {
    try {
      const folderPath = await window.electronAPI.library.pickFolder();
      if (!folderPath) return;

      set({ isLoading: true });
      // Add folder to backend (this will trigger scan too)
      await window.electronAPI.library.addFolder(folderPath);

      // Refresh local state
      const folders = await window.electronAPI.library.getFolders();
      const tracks = await window.electronAPI.library.getAll();
      set({ folders, tracks, isLoading: false });
    } catch (err) {
      console.error('Failed to add folder:', err);
      set({ isLoading: false });
    }
  },

  removeFolder: async (path: string) => {
    await window.electronAPI.library.removeFolder(path);
    // Update folders list locally too?
    const folders = await window.electronAPI.library.getFolders();
    const tracks = await window.electronAPI.library.getAll();
    set({ folders, tracks });
  },

  scanLibrary: async () => {
    // The scan events will handle the state updates
    await window.electronAPI.library.scan();
  }
}));
