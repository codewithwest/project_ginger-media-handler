
import { app, BrowserWindow, ipcMain, dialog, globalShortcut, session } from 'electron';

// Extend electron App interface
interface ExtendedApp extends Electron.App {
  isQuitting?: boolean;
}
import path from 'path';
import { MediaServer } from './services/MediaServer';
import { TrayService } from './services/TrayService';
import { JobManager } from './services/JobManager';
import { ConversionService } from './services/ConversionService';
import { DownloadService } from './services/DownloadService';
import { LibraryService } from './services/LibraryService';
import { MediaPlayerState } from '../shared/types/media';
import { PlaylistService } from './services/PlaylistService';
import { UpdateService } from './services/UpdateService';
import { ReleaseService } from './services/ReleaseService';
import { SettingsService } from './services/SettingsService';
import { NetworkManager } from './services/network/NetworkManager';
import { PluginService } from './services/PluginService';
import { YouTubeService } from './services/YouTubeService';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Prevent Dev and Prod from sharing the same user data
const isDev = !app.isPackaged;
if (isDev) {
  const devDataPath = path.join(app.getPath('userData'), '..', `${app.getName()}-dev`);
  app.setPath('userData', devDataPath);
}

// Single Instance Lock
const gotTheLock = isDev ? true : app.requestSingleInstanceLock();

let mainWindow: BrowserWindow | null = null;
let mediaServer: MediaServer | null = null;
let downloadService: DownloadService | null = null;
let trayService: TrayService | null = null;
let libraryService: LibraryService | null = null;
let playlistService: PlaylistService | null = null;
let updateService: UpdateService | null = null;
let settingsService: SettingsService | null = null;
let networkManager: NetworkManager | null = null;
let pluginService: PluginService | null = null;
let youtubeService: YouTubeService | null = null;

function handleCommandLineArgs(argv: string[]) {
  const args = argv.slice(app.isPackaged ? 1 : 2);
  const filePath = args.find(arg => !arg.startsWith('-'));

  if (filePath && mainWindow) {
    console.log('Opening file from CLI:', filePath);
    mainWindow.webContents.send('file:open-from-cli', filePath);
  }
}

const createWindow = (): void => {
  console.log('[Main] Creating window...');

  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: true, // Force show on creation to debug Linux visibility
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      preload: path.join(__dirname, 'preload.js'),
    },
    titleBarStyle: 'hidden',
    icon: path.join(process.resourcesPath, 'logo.png'),
  });

  // Log loading failures
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error(`[Main] Failed to load UI: ${errorCode} ${errorDescription} at ${validatedURL}`);
  });

  // Load the index.html of the app
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    console.log('[Main] Loading Dev Server URL:', MAIN_WINDOW_VITE_DEV_SERVER_URL);
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    const indexPath = path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
    console.log('[Main] Loading File:', indexPath);
    mainWindow.loadFile(indexPath);
  }

  // Ready to show
  mainWindow.once('ready-to-show', () => {
    console.log('[Main] Window ready to show.');
    mainWindow?.show();
    mainWindow?.focus();
  });

  // Force show after a delay just in case ready-to-show never fires on this Linux distro
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      console.log('[Main] Fallback: Force showing window.');
      mainWindow.show();
    }
  }, 5000);

  // Open DevTools in development
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Handle window close - keep app running for background playback
  mainWindow.on('close', (event) => {
    if (!(app as ExtendedApp).isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
      console.log('[Main] Window hidden (background mode)');
    }
    return false;
  });

  // Initialize Tray Service
  trayService = new TrayService(mainWindow);
  trayService.createTray();
};

import { PlaybackService } from './services/PlaybackService';

let playbackService: PlaybackService | null = null;

async function registerIpcHandlers(): Promise<void> {
  // Initialize Services
  settingsService = new SettingsService();
  playlistService = new PlaylistService();
  pluginService = new PluginService();
  playbackService = new PlaybackService(mainWindow as BrowserWindow, playlistService);

  // Broadcast events to plugins
  playbackService.on('state-changed', (state: MediaPlayerState) => {
    pluginService?.broadcastEvent('playback:state-changed', state);
  });

  pluginService?.on('ui-updated', () => {
    mainWindow?.webContents.send('plugins:ui-updated', pluginService?.getRegisteredTabs());
  });

  pluginService?.on('providers-updated', () => {
    mainWindow?.webContents.send('plugins:providers-updated', pluginService?.getProviders());
  });

  pluginService?.on('plugins-updated', () => {
    mainWindow?.webContents.send('plugins:updated', pluginService?.getPlugins());
  });

  // Network Event Listeners
  if (networkManager) {
    networkManager.onServerFound((server) => {
      mainWindow?.webContents.send('network:server-found', server);
    });
  }

  const jobManager = new JobManager(mainWindow as BrowserWindow, settingsService);
  const ffmpegPath = downloadService?.getFFmpegPath();
  const ffprobePath = downloadService?.getFFprobePath();

  const conversionService = new ConversionService(ffmpegPath);
  libraryService = new LibraryService(ffprobePath);

  libraryService.on('scan-start', () => {
    mainWindow?.webContents.send('library:scan-start');
  });

  libraryService.on('scan-progress', (progress) => {
    mainWindow?.webContents.send('library:scan-progress', progress);
  });

  libraryService.on('scan-complete', (tracks) => {
    mainWindow?.webContents.send('library:scan-complete', tracks);
  });

  updateService = new UpdateService(mainWindow as BrowserWindow);
  new ReleaseService();

  jobManager.registerService('conversion', conversionService);
  if (downloadService) {
    jobManager.registerService('download', downloadService);
    youtubeService = new YouTubeService(downloadService);
  }

  // Library Management
  ipcMain.handle('library:add-folder', async (_event, { path }) => {
    await libraryService?.addFolder(path);
    return libraryService?.getTracks();
  });

  ipcMain.handle('library:pick-folder', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('library:remove-folder', async (_event, { path }) => {
    await libraryService?.removeFolder(path);
    return libraryService?.getTracks();
  });

  ipcMain.handle('library:scan', async () => {
    return await libraryService?.scan();
  });

  ipcMain.handle('library:get-all', async () => {
    return libraryService?.getTracks();
  });

  ipcMain.handle('library:get-folders', async () => {
    return libraryService?.getFolders();
  });

  ipcMain.handle('library:rename', async (_event, { id, newName }) => {
    return await libraryService?.renameTrack(id, newName);
  });

  // Playlist Management
  ipcMain.handle('playlist:get-all', async () => {
    return playlistService?.getAllPlaylists() || [];
  });

  ipcMain.handle('playlist:get', async (_event, id) => {
    return playlistService?.getPlaylist(id);
  });

  ipcMain.handle('playlist:create', async (_event, name) => {
    return playlistService?.createPlaylist(name);
  });

  ipcMain.handle('playlist:save-items', async (_event, { id, items }) => {
    playlistService?.savePlaylistItems(id, items);
  });

  ipcMain.handle('playlist:rename', async (_event, { id, name }) => {
    return playlistService?.renamePlaylist(id, name);
  });

  ipcMain.handle('playlist:delete', async (_event, id) => {
    return playlistService?.deletePlaylist(id);
  });

  // Resume Playback
  ipcMain.on('playback:sync-time', (_event, { position }) => {
    const currentState = playbackService?.getState();
    if (currentState?.currentSource?.id) {
      settingsService?.savePlaybackPosition(currentState.currentSource.id, position);
    }
  });

  ipcMain.handle('media:get-resume-position', async (_event, { mediaId }) => {
    return settingsService?.getPlaybackPosition(mediaId) || 0;
  });

  // Media Engine Handlers
  ipcMain.handle('media:get-stream-url', async (_event, { source }) => {
    if (!mediaServer) throw new Error('Media server not running');
    if (!source || !source.path) {
      console.warn('[Main] media:get-stream-url called with invalid source:', source);
      return '';
    }

    if (source.type === 'provider' && source.providerId) {
      return await pluginService?.resolveSource(source) || '';
    }

    const filePath = source.path;
    const ext = path.extname(filePath).toLowerCase();
    const directPlayExtensions = ['.mp4', '.webm', '.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const baseUrl = mediaServer.getUrl();
    if (directPlayExtensions.includes(ext)) {
      return `${baseUrl}/file?path=${encodeURIComponent(filePath)}`;
    } else {
      return `${baseUrl}/stream?path=${encodeURIComponent(filePath)}`;
    }
  });

  ipcMain.handle('media:get-metadata', async (_event, { filePath }) => {
    if (!mediaServer) throw new Error('Media server not running');
    if (!filePath) return null;
    // For now providers might return metadata already, but we need ffprobe for local
    // TODO: support provider-returned metadata
    return mediaServer.getMetadata(filePath);
  });

  ipcMain.handle('media:get-subtitles-url', async (_event, { filePath }) => {
    if (!mediaServer) throw new Error('Media server not running');
    const baseUrl = mediaServer.getUrl();
    return `${baseUrl}/subtitles?path=${encodeURIComponent(filePath)}`;
  });

  // File operations
  ipcMain.handle('file:open-dialog', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Media Files', extensions: ['mp3', 'mp4', 'mkv', 'avi', 'flac', 'wav', 'webm', 'm4a', 'ogg'] },
      ],
    });
    return result.canceled ? null : result.filePaths;
  });

  // Job management
  ipcMain.handle('job:start-conversion', async (_event, request) => {
    const jobId = await jobManager.startConversion(request);
    return { jobId };
  });

  ipcMain.handle('job:start-download', async (_event, request) => {
    const jobId = await jobManager.startDownload(request);
    return { jobId };
  });

  ipcMain.handle('job:cancel', async (_event, { jobId }) => {
    jobManager.cancelJob(jobId);
  });

  ipcMain.handle('job:get-all', async () => {
    return jobManager.getAllJobs();
  });

  ipcMain.handle('job:clear-history', async () => {
    settingsService?.clearHistory();
    return [];
  });

  // Settings Handlers
  ipcMain.handle('settings:get', async () => {
    return settingsService?.getSettings();
  });

  ipcMain.handle('settings:update', async (_event, updates) => {
    settingsService?.updateSettings(updates);
    return settingsService?.getSettings();
  });

  // Downloads
  ipcMain.handle('download:get-formats', async () => {
    return [];
  });

  // YouTube handlers are registered below with others

  // Window controls
  ipcMain.handle('window:minimize', async () => {
    mainWindow?.minimize();
  });

  ipcMain.handle('window:maximize', async () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.handle('window:close', async () => {
    mainWindow?.close();
  });

  ipcMain.handle('window:toggle-full-screen', async () => {
    if (mainWindow) {
      const isFullScreen = mainWindow.isFullScreen();
      mainWindow.setFullScreen(!isFullScreen);
      // Also hide/show title bar if necessary, but Electron's setFullScreen handles this usually.
    }
  });

  // Update Management
  ipcMain.handle('update:check', () => {
    updateService?.checkForUpdates();
  });

  ipcMain.handle('update:download', () => {
    updateService?.downloadUpdate();
  });

  ipcMain.handle('update:install', () => {
    updateService?.quitAndInstall();
  });

  ipcMain.handle('app:get-downloads-path', async () => {
    return settingsService?.getSettings().downloadsPath || path.join(app.getPath('videos'), 'GingerPlayer');
  });

  // Background initialization already handled in app.on('ready')
  console.log('[Main] IPC handlers registered.');

  // Network Handlers
  ipcMain.handle('network:scan-start', () => {
    networkManager?.startDiscovery();
  });

  ipcMain.handle('network:scan-stop', () => {
    networkManager?.stopDiscovery();
  });

  ipcMain.handle('network:get-servers', () => {
    return networkManager?.getServers() || [];
  });

  ipcMain.handle('network:browse', async (_event, { server, path }) => {
    try {
      return await networkManager?.browse(server, path);
    } catch (e: unknown) {
      console.error('Network browse error:', e);
      throw e;
    }
  });

  ipcMain.handle('network:connect-smb', async (_event, config) => {
    await networkManager?.connectSMB(config);
  });

  ipcMain.handle('plugins:get-ui-tabs', () => {
    return pluginService?.getRegisteredTabs() || [];
  });

  ipcMain.handle('plugins:get-providers', () => {
    return pluginService?.getProviders() || [];
  });

  ipcMain.handle('plugins:browse-provider', async (_event, { providerId, path }) => {
    return await pluginService?.browseProvider(providerId, path) || [];
  });

  ipcMain.handle('plugins:search-providers', async (_event, query) => {
    return await pluginService?.searchProviders(query) || [];
  });

  ipcMain.handle('plugins:get-all', async () => {
    return pluginService?.getPlugins() || [];
  });

  ipcMain.handle('youtube:search', async (_event, query) => {
    return await youtubeService?.search(query) || [];
  });

  ipcMain.handle('youtube:get-playlist', async (_event, url) => {
    return await youtubeService?.getPlaylist(url) || [];
  });
}

function registerGlobalShortcuts(): void {
  const registerSafety = (key: string, callback: () => void) => {
    try {
      globalShortcut.register(key, callback);
    } catch (e) {
      console.error(`[Main] Failed to register global shortcut: ${key}`, e);
    }
  };

  registerSafety('MediaPlayPause', () => playbackService?.toggle());
  registerSafety('MediaNextTrack', () => playbackService?.next());
  registerSafety('MediaPreviousTrack', () => playbackService?.previous());
  registerSafety('VolumeMute', () => playbackService?.toggleMute());
  registerSafety('CommandOrControl+M', () => playbackService?.toggleMute());
}

if (!gotTheLock) {
  console.log('[Main] Failed to get single instance lock. Quitting.');
  app.quit();
  process.exit(0); // Force exit to prevent further execution (like ready event)
} else {
  console.log('[Main] Single instance lock obtained.');

  app.on('second-instance', (_event, commandLine) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      handleCommandLineArgs(commandLine);
    }
  });

  if (process.platform === 'win32' && require('electron-squirrel-startup')) {
    console.log('[Main] Squirrel startup detected. Quitting.');
    app.quit();
    process.exit(0);
  }

  // Only start the app if we have the lock
  app.on('ready', async () => {
    // Allow YouTube iframes — only modify CSP for OUR app's responses
    // External responses (like YouTube itself) must NOT be modified or their
    // own CDN resources (googlevideo.com, fonts, scripts) will be blocked too
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      const isOurApp =
        details.url.startsWith('http://localhost') ||
        details.url.startsWith('http://127.0.0.1') ||
        details.url.startsWith('file://');

      if (isOurApp) {
        callback({
          responseHeaders: {
            ...details.responseHeaders,
            'Content-Security-Policy': [
              "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http://127.0.0.1:* ws://127.0.0.1:*;" +
              "frame-src https://www.youtube.com https://www.youtube-nocookie.com;" +
              "img-src 'self' http://127.0.0.1:* data: https://*.ytimg.com https://i.ytimg.com;"
            ]
          }
        });
      } else {
        // Pass through all external responses (YouTube, CDNs, etc.) unchanged
        callback({ responseHeaders: details.responseHeaders });
      }
    });

    downloadService = new DownloadService();

    // Validate binaries BEFORE starting any media services or windows
    console.log('[Main] Initializing DownloadService...');
    try {
      await downloadService.init();
      console.log('[Main] DownloadService initialized successfully.');
    } catch (err) {
      console.error('[Main] Failed to initialize DownloadService:', err);
    }

    networkManager = new NetworkManager();
    mediaServer = new MediaServer(
      downloadService.getFFmpegPath(),
      downloadService.getFFprobePath(),
      networkManager
    );

    try {
      const url = await mediaServer.start();
      console.log('Media server started at:', url);
    } catch (err) {
      console.error('Failed to start media server:', err);
    }

    createWindow();
    youtubeService = new YouTubeService(downloadService);
    await registerIpcHandlers();
    registerGlobalShortcuts();

    // Async init plugins
    pluginService?.init().catch(err => {
      console.error('[Main] Failed to init plugins:', err);
    });

    mainWindow?.webContents.on('did-finish-load', () => {
      handleCommandLineArgs(process.argv);
    });
  });
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  } else {
    mainWindow?.show();
  }
});

app.on('before-quit', () => {
  (app as ExtendedApp).isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
