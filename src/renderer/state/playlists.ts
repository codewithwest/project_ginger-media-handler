
import { create } from 'zustand';
import type { PlaylistMetadata, Playlist, MediaSource } from '../../shared/types/media';

interface PlaylistStore {
    playlists: PlaylistMetadata[];
    activePlaylist: Playlist | null;
    isLoading: boolean;

    fetchPlaylists: () => Promise<void>;
    createPlaylist: (name: string) => Promise<void>;
    renamePlaylist: (id: string, name: string) => Promise<void>;
    deletePlaylist: (id: string) => Promise<void>;
    loadPlaylist: (id: string) => Promise<void>;
    updateItems: (id: string, items: MediaSource[]) => Promise<void>;
}

export const usePlaylistStore = create<PlaylistStore>((set) => ({
    playlists: [],
    activePlaylist: null,
    isLoading: false,

    fetchPlaylists: async () => {
        set({ isLoading: true });
        try {
            const playlists = await window.electronAPI.playlists.getAll();
            set({ playlists, isLoading: false });
        } catch (error) {
            console.error('Failed to fetch playlists:', error);
            set({ isLoading: false });
        }
    },

    createPlaylist: async (name) => {
        try {
            await window.electronAPI.playlists.create(name);
            const playlists = await window.electronAPI.playlists.getAll();
            set({ playlists });
        } catch (error) {
            console.error('Failed to create playlist:', error);
        }
    },

    renamePlaylist: async (id, name) => {
        try {
            await window.electronAPI.playlists.rename(id, name);
            const playlists = await window.electronAPI.playlists.getAll();
            set({ playlists });
        } catch (error) {
            console.error('Failed to rename playlist:', error);
        }
    },

    deletePlaylist: async (id) => {
        try {
            await window.electronAPI.playlists.delete(id);
            const playlists = await window.electronAPI.playlists.getAll();
            set({ playlists });
        } catch (error) {
            console.error('Failed to delete playlist:', error);
        }
    },

    loadPlaylist: async (id) => {
        set({ isLoading: true });
        try {
            const activePlaylist = await window.electronAPI.playlists.get(id);
            set({ activePlaylist, isLoading: false });
        } catch (error) {
            console.error('Failed to load playlist:', error);
            set({ isLoading: false });
        }
    },

    updateItems: async (id, items) => {
        try {
            await window.electronAPI.playlists.saveItems(id, items);
            // Refresh active playlist state
            const activePlaylist = await window.electronAPI.playlists.get(id);
            set({ activePlaylist });
            // Update metadata in playlists list too
            const playlists = await window.electronAPI.playlists.getAll();
            set({ playlists });
        } catch (error) {
            console.error('Failed to update playlist items:', error);
        }
    },
}));
