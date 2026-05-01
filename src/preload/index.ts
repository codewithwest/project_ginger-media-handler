// Preload script - Exposes safe IPC API to renderer via contextBridge

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type {
  IpcRequest,
  IpcResponse,
  IpcEventData,
  PlaylistItem,
  MediaMetadata,
  MediaPlayerState,
  ConversionRequest,
  LibraryTrack,
  AppSettings,
  UpdateStatus,
  UpdateProgress,

  NetworkServer,
  MediaSource,
  SMBConfig,
  PluginUITab,
  GingerMediaProvider,
  PlaylistMetadata,
  Playlist,
} from '@shared/types';

// Create type-safe API
const electronAPI = {
  // Media controls (backed by PlaybackService in Main)
  media: {
    play: (index?: number): Promise<void> =>
      ipcRenderer.invoke('playback:play', index),
    pause: (): Promise<void> =>
      ipcRenderer.invoke('playback:pause'),
    stop: (): Promise<void> =>
      ipcRenderer.invoke('playback:stop'),
    seek: (position: number): Promise<void> =>
      ipcRenderer.invoke('playback:seek', position),
    setVolume: (volume: number): Promise<void> =>
      ipcRenderer.invoke('playback:set-volume', volume),
    toggleMute: (): Promise<void> =>
      ipcRenderer.invoke('playback:toggle-mute'),
    next: (): Promise<void> =>
      ipcRenderer.invoke('playback:next'),
    previous: (): Promise<void> =>
      ipcRenderer.invoke('playback:previous'),
    setShuffle: (shuffle: boolean): Promise<void> =>
      ipcRenderer.invoke('playback:set-shuffle', shuffle),
    setRepeat: (repeat: string): Promise<void> =>
      ipcRenderer.invoke('playback:set-repeat', repeat),
    setSpeed: (speed: number): Promise<void> =>
      ipcRenderer.invoke('playback:set-speed', speed),
    addToPlaylist: (item: PlaylistItem, playNow?: boolean): Promise<void> =>
      ipcRenderer.invoke('playback:add-to-playlist', { item, playNow }),
    clearPlaylist: (): Promise<void> =>
      ipcRenderer.invoke('playback:clear-playlist'),
    removeFromPlaylist: (index: number): Promise<void> =>
      ipcRenderer.invoke('playback:remove-from-playlist', { index }),

    // Sync position from Renderer to Main
    syncTime: (position: number, duration?: number) =>
      ipcRenderer.send('playback:sync-time', { position, duration }),

    // Media Engine (Main process services)
    getStreamUrl: (source: MediaSource): Promise<string> =>
      ipcRenderer.invoke('media:get-stream-url', { source }),
    getMetadata: (filePath: string): Promise<MediaMetadata> =>
      ipcRenderer.invoke('media:get-metadata', { filePath }),
    getSubtitlesUrl: (filePath: string): Promise<string> =>
      ipcRenderer.invoke('media:get-subtitles-url', { filePath }),

    // Event listeners
    onStateChanged: (callback: (state: MediaPlayerState) => void) => {
      const subscription = (_event: IpcRendererEvent, data: MediaPlayerState) => callback(data);
      ipcRenderer.on('playback:state-changed', subscription);
      return () => { ipcRenderer.removeListener('playback:state-changed', subscription); };
    },
    getState: (): Promise<MediaPlayerState> => ipcRenderer.invoke('playback:get-state'),
    getResumePosition: (mediaId: string): Promise<number> => ipcRenderer.invoke('media:get-resume-position', { mediaId }),
  },

  // File operations
  file: {
    openDialog: () =>
      ipcRenderer.invoke('file:open-dialog'),
    openFolderDialog: () =>
      ipcRenderer.invoke('file:open-folder-dialog'),
    addToPlaylist: (paths: string[]) =>
      ipcRenderer.invoke('file:add-to-playlist', { paths }),
    onFileOpenFromCLI: (callback: (path: string) => void) => {
      const subscription = (_event: IpcRendererEvent, path: string) => callback(path);
      ipcRenderer.on('file:open-from-cli', subscription);
      return () => { ipcRenderer.removeListener('file:open-from-cli', subscription); };
    },
    savePlaylist: (playlist: PlaylistItem[]) => ipcRenderer.invoke('playlist:save', { playlist }),
    loadPlaylist: () => ipcRenderer.invoke('playlist:load'),
  },

  // Job management
  jobs: {
    startConversion: (request: ConversionRequest) =>
      ipcRenderer.invoke('job:start-conversion', request),
    startDownload: (request: IpcRequest<'job:start-download'>): Promise<{ jobId: string }> =>
      ipcRenderer.invoke('job:start-download', request),
    cancel: (jobId: string): Promise<void> =>
      ipcRenderer.invoke('job:cancel', { jobId }),
    getAll: (): Promise<IpcResponse<'job:get-all'>> =>
      ipcRenderer.invoke('job:get-all'),
    clearHistory: (): Promise<void> =>
      ipcRenderer.invoke('job:clear-history'),

    onProgress: (callback: (data: IpcEventData<'job:progress'>) => void) => {
      const subscription = (_event: IpcRendererEvent, data: IpcEventData<'job:progress'>) => callback(data);
      ipcRenderer.on('job:progress', subscription);
      return () => { ipcRenderer.removeListener('job:progress', subscription); };
    },
  },

  // Downloads
  download: {
    getFormats: (url: string): Promise<IpcResponse<'download:get-formats'>> =>
      ipcRenderer.invoke('download:get-formats', { url }),
  },

  // YouTube
  youtube: {
    search: (query: string): Promise<any[]> => ipcRenderer.invoke('youtube:search', query),
    getPlaylist: (url: string): Promise<any[]> => ipcRenderer.invoke('youtube:get-playlist', url),
  },

  // Library
  library: {
    addFolder: (path: string): Promise<void> => ipcRenderer.invoke('library:add-folder', { path }),
    removeFolder: (path: string): Promise<void> => ipcRenderer.invoke('library:remove-folder', { path }),
    scan: (): Promise<LibraryTrack[]> => ipcRenderer.invoke('library:scan'),
    getAll: (): Promise<LibraryTrack[]> => ipcRenderer.invoke('library:get-all'),
    getFolders: (): Promise<string[]> => ipcRenderer.invoke('library:get-folders'),
    pickFolder: (): Promise<string | null> => ipcRenderer.invoke('library:pick-folder'),
    rename: (id: string, newName: string): Promise<LibraryTrack> => ipcRenderer.invoke('library:rename', { id, newName }),
    onScanStart: (callback: () => void) => {
      const subscription = () => callback();
      ipcRenderer.on('library:scan-start', subscription);
      return () => { ipcRenderer.removeListener('library:scan-start', subscription); };
    },
    onScanProgress: (callback: (progress: { processed: number, total: number, currentFile: string }) => void) => {
      const subscription = (_event: IpcRendererEvent, progress: any) => callback(progress);
      ipcRenderer.on('library:scan-progress', subscription);
      return () => { ipcRenderer.removeListener('library:scan-progress', subscription); };
    },
    onScanComplete: (callback: (tracks: LibraryTrack[]) => void) => {
      const subscription = (_event: IpcRendererEvent, tracks: LibraryTrack[]) => callback(tracks);
      ipcRenderer.on('library:scan-complete', subscription);
      return () => { ipcRenderer.removeListener('library:scan-complete', subscription); };
    },
    onTrackAdded: (callback: (track: LibraryTrack) => void) => {
      const subscription = (_event: IpcRendererEvent, track: LibraryTrack) => callback(track);
      ipcRenderer.on('library:scan-track-added', subscription);
      return () => { ipcRenderer.removeListener('library:scan-track-added', subscription); };
    },
  },

  // Window controls
  window: {
    minimize: (): Promise<void> =>
      ipcRenderer.invoke('window:minimize'),
    maximize: (): Promise<void> =>
      ipcRenderer.invoke('window:maximize'),
    close: (): Promise<void> =>
      ipcRenderer.invoke('window:close'),
    toggleFullScreen: (): Promise<void> =>
      ipcRenderer.invoke('window:toggle-full-screen'),
  },

  // Update
  update: {
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    downloadUpdate: () => ipcRenderer.invoke('update:download'),
    installUpdate: () => ipcRenderer.invoke('update:install'),
    onStatusChange: (callback: (data: UpdateStatus) => void) => {
      const subscription = (_event: IpcRendererEvent, data: UpdateStatus) => callback(data);
      ipcRenderer.on('update:status', subscription);
      return () => { ipcRenderer.removeListener('update:status', subscription); };
    },
    onProgress: (callback: (data: UpdateProgress) => void) => {
      const subscription = (_event: IpcRendererEvent, data: UpdateProgress) => callback(data);
      ipcRenderer.on('update:progress', subscription);
      return () => { ipcRenderer.removeListener('update:progress', subscription); };
    },
  },



  // Network
  network: {
    scanStart: (): Promise<void> => ipcRenderer.invoke('network:scan-start'),
    scanStop: (): Promise<void> => ipcRenderer.invoke('network:scan-stop'),
    getServers: (): Promise<NetworkServer[]> => ipcRenderer.invoke('network:get-servers'),
    browse: (server: NetworkServer, path?: string): Promise<MediaSource[]> => ipcRenderer.invoke('network:browse', { server, path }),
    connectSMB: (config: SMBConfig): Promise<void> => ipcRenderer.invoke('network:connect-smb', config),
    onServerFound: (callback: (server: NetworkServer) => void) => {
      const subscription = (_event: IpcRendererEvent, server: NetworkServer) => callback(server);
      ipcRenderer.on('network:server-found', subscription);
      return () => { ipcRenderer.removeListener('network:server-found', subscription); };
    },
  },



  // Plugins
  plugins: {
    getUITabs: (): Promise<PluginUITab[]> => ipcRenderer.invoke('plugins:get-ui-tabs'),
    onUIUpdated: (callback: (tabs: PluginUITab[]) => void) => {
      const subscription = (_event: IpcRendererEvent, tabs: PluginUITab[]) => callback(tabs);
      ipcRenderer.on('plugins:ui-updated', subscription);
      return () => { ipcRenderer.removeListener('plugins:ui-updated', subscription); };
    },
    getProviders: (): Promise<GingerMediaProvider[]> => ipcRenderer.invoke('plugins:get-providers'),
    browseProvider: (providerId: string, path?: string): Promise<MediaSource[]> =>
      ipcRenderer.invoke('plugins:browse-provider', { providerId, path }),
    searchProviders: (query: string): Promise<MediaSource[]> =>
      ipcRenderer.invoke('plugins:search-providers', query),
    onProvidersUpdated: (callback: (providers: GingerMediaProvider[]) => void) => {
      const subscription = (_event: IpcRendererEvent, providers: GingerMediaProvider[]) => callback(providers);
      ipcRenderer.on('plugins:providers-updated', subscription);
      return () => { ipcRenderer.removeListener('plugins:providers-updated', subscription); };
    },
    getAll: (): Promise<any[]> => ipcRenderer.invoke('plugins:get-all'),
    updateSetting: (pluginName: string, key: string, value: any): Promise<void> =>
      ipcRenderer.invoke('plugins:update-setting', { pluginName, key, value }),
    onUpdated: (callback: (plugins: any[]) => void) => {
      const subscription = (_event: IpcRendererEvent, plugins: any[]) => callback(plugins);
      ipcRenderer.on('plugins:updated', subscription);
      return () => { ipcRenderer.removeListener('plugins:updated', subscription); };
    },
  },

  // Releases
  releases: {
    list: (): Promise<string[]> => ipcRenderer.invoke('releases:list'),
    getContent: (filename: string): Promise<string> => ipcRenderer.invoke('releases:content', filename),
  },

  // App Info
  app: {
    getDownloadsPath: (): Promise<string> => ipcRenderer.invoke('app:get-downloads-path'),
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (updates: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke('settings:update', updates),
  },
  playlists: {
    getAll: (): Promise<PlaylistMetadata[]> => ipcRenderer.invoke('playlist:get-all'),
    get: (id: string): Promise<Playlist | null> => ipcRenderer.invoke('playlist:get', id),
    create: (name: string): Promise<PlaylistMetadata> => ipcRenderer.invoke('playlist:create', name),
    saveItems: (id: string, items: MediaSource[]): Promise<void> => ipcRenderer.invoke('playlist:save-items', { id, items }),
    rename: (id: string, name: string): Promise<boolean> => ipcRenderer.invoke('playlist:rename', { id, name }),
    delete: (id: string): Promise<boolean> => ipcRenderer.invoke('playlist:delete', id),
  },
};

// Expose API to renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for window object
export type ElectronAPI = typeof electronAPI;
