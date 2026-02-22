
// Main React application component

import { useEffect, useState, CSSProperties } from 'react';
import { Background3D } from './components/3d/Background3D';
import { PlayerControls } from './components/player/PlayerControls';
import { useMediaPlayerStore } from './state/media-player';
import {
  Disc3,
  Activity,
  Music,
  FileText,
  Wifi,
  Puzzle,
  Search as SearchIcon,
  Youtube,
  Image as ImageIcon,
  FolderOpen
} from 'lucide-react';
import { NetworkView } from './components/network/NetworkView';
import { ConverterView } from './components/converter/ConverterView';
import { ImageBrowser } from './components/library/ImageBrowser';
import { SearchView } from './components/search/SearchView';
import { YouTubeView } from './components/youtube/YouTubeView';
import { PluginSettingsView } from './components/plugins/PluginSettingsView';
import { usePluginStore } from './state/plugins';
import { useProviderStore } from './state/providers';
import { PlaylistSidebar } from './components/playlist/PlaylistSidebar';
import { VideoPlayer } from './components/player/VideoPlayer';
import { JobDashboard } from './components/jobs/JobDashboard';
import { LibraryView } from './components/library/LibraryView';
import { ReleasesView } from './components/release/ReleasesView';
import { Equalizer } from './components/player/Equalizer';
import { useJobsStore } from './state/jobs';
import { Tooltip } from './components/ui/Tooltip';
import { SplashScreen } from './components/ui/SplashScreen';

type Tab = 'player' | 'gallery' | 'library' | 'youtube' | 'network' | 'converter' | 'jobs' | 'plugins' | 'releases' | 'search';

interface CustomCSSProperties extends CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
}

const getMediaType = (path: string): 'audio' | 'video' | 'image' => {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)) return 'image';
  if (['mp4', 'mkv', 'webm', 'mov', 'avi'].includes(ext)) return 'video';
  return 'audio';
};

export function App() {
  const { addToPlaylist, playAtIndex, playlist, status, streamUrl, currentSource } = useMediaPlayerStore();
  const { syncJobs, initializeListeners } = useJobsStore();
  const { tabs: pluginTabs, init: initPlugins } = usePluginStore();
  const { init: initProviders } = useProviderStore();

  const [activeTab, setActiveTab] = useState<Tab>('player');
  const [isInitializing, setIsInitializing] = useState(true);

  const [showEqualizer, setShowEqualizer] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [zenMode, setZenMode] = useState(false);

  useEffect(() => {
    // Initialize Media Player (Sync with Main Process)
    useMediaPlayerStore.getState().init();

    // Check for updates
    const cleanStatus = window.electronAPI.update.onStatusChange(({ status }) => {
      console.log('Update status:', status);
      if (status === 'available') {
        setUpdateAvailable(true);
      }
      if (status === 'downloaded') {
        // Since autoDownload is true, it will reach here automatically when done.
        setUpdateAvailable(false); // Hide the banner if it was showing
        const confirm = window.confirm('Updates are ready to install. Restart Ginger now?');
        if (confirm) window.electronAPI.update.installUpdate();
      }
    });

    // Check after short delay to let app load
    setTimeout(() => {
      window.electronAPI.update.checkForUpdates();
    }, 5000);

    // Sync jobs and start listening
    syncJobs();
    const cleanJobs = initializeListeners();

    // Initialize Plugins
    initPlugins();
    initProviders();

    return () => {
      cleanStatus();
      cleanJobs();
    };
  }, []);

  const handleOpenFiles = async () => {
    const files = (await window.electronAPI.file.openDialog()) as string[];
    if (files && files.length > 0) {
      const newItems = files.map((filePath: string) => ({
        id: filePath,
        type: 'local' as const,
        mediaType: getMediaType(filePath),
        path: filePath,
        title: filePath.split('/').pop()
      }));
      newItems.forEach(item => addToPlaylist(item));
      if (status === 'stopped' || playlist.length === 0) {
        playAtIndex(playlist.length);
      }
    }
  };

  // Handle CLI file opening
  useEffect(() => {
    const cleanup = window.electronAPI.file.onFileOpenFromCLI(async (filePath: string) => {
      const newItem = {
        id: filePath,
        type: 'local' as const,
        mediaType: getMediaType(filePath),
        path: filePath,
        title: filePath.split('/').pop() || filePath
      };
      useMediaPlayerStore.getState().addToPlaylist(newItem);
      const state = useMediaPlayerStore.getState();
      state.playAtIndex(state.playlist.length - 1);
    });
    return cleanup;
  }, []);

  return (
    <div className="h-screen w-screen bg-[#030303] text-[#e5e7eb] flex flex-col overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Three.js Background */}
      {currentSource?.mediaType !== 'video' && <Background3D />}

      {/* Title Bar - Draggable */}
      <div className="h-10 w-full glass flex items-center px-4 select-none z-50" style={{ WebkitAppRegion: 'drag' } as CustomCSSProperties}>
        <div className="flex items-center gap-3">
          <div className="relative group/logo">
            <div className="absolute -inset-1 bg-primary-500/20 rounded-full blur opacity-0 group-hover/logo:opacity-100 transition-opacity" />
            <img
              src="http://127.0.0.1:3000/logo"
              alt="Ginger Logo"
              className="w-5 h-5 object-contain relative z-10"
              style={{ WebkitAppRegion: 'no-drag' } as CustomCSSProperties}
            />
          </div>
          <div className="text-[10px] font-bold text-gray-400 tracking-[0.2em] uppercase">Ginger Media</div>
          <div className="flex items-center gap-1 ml-4" style={{ WebkitAppRegion: 'no-drag' } as CustomCSSProperties}>
            <Tooltip content="Image Gallery" position="bottom">
              <button
                onClick={() => setActiveTab('gallery')}
                className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${activeTab === 'gallery' ? 'text-indigo-400 bg-white/5' : 'text-gray-400'}`}
              >
                <ImageIcon className="w-5 h-5" />
              </button>
            </Tooltip>
          </div>
          {zenMode && (
            <button
              onClick={() => setZenMode(false)}
              className="ml-4 px-3 py-0.5 bg-primary-600/20 border border-primary-500/30 rounded-full text-[8px] font-black text-primary-400 hover:bg-primary-500 hover:text-white transition-all animate-fade-in"
              style={{ WebkitAppRegion: 'no-drag' } as CustomCSSProperties}
            >
              EXIT ZEN MODE
            </button>
          )}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as CustomCSSProperties}>
          <Tooltip content="Library" position="bottom">
            <button
              onClick={() => setActiveTab('library')}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${activeTab === 'library' ? 'text-primary-400 bg-white/5' : 'text-gray-400'}`}
            >
              <Music className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip content="YouTube" position="bottom">
            <button
              onClick={() => setActiveTab('youtube')}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${activeTab === 'youtube' ? 'text-red-500 bg-white/5' : 'text-gray-400'}`}
            >
              <Youtube className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip content="Unified Search (Ctrl+F)" position="bottom">
            <button
              onClick={() => setActiveTab('search')}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${activeTab === 'search' ? 'text-primary-400 bg-white/5' : 'text-gray-400'}`}
            >
              <SearchIcon className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip content="Network Media" position="bottom">
            <button
              onClick={() => setActiveTab('network')}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${activeTab === 'network' ? 'text-primary-400 bg-white/5' : 'text-gray-400'}`}
            >
              <Wifi className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip content="Plugins & Extensions" position="bottom">
            <button
              onClick={() => setActiveTab('plugins')}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${activeTab === 'plugins' ? 'text-indigo-400 bg-white/5' : 'text-gray-400'}`}
            >
              <Puzzle className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip content="Show Jobs" position="bottom">
            <button
              onClick={() => setActiveTab('jobs')}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${activeTab === 'jobs' ? 'text-blue-400 bg-white/5' : 'text-gray-400'}`}
            >
              <Activity className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip content="Release Notes" position="bottom">
            <button
              onClick={() => setActiveTab('releases')}
              className={`p-1.5 rounded-lg hover:bg-white/10 transition-all ${activeTab === 'releases' ? 'text-indigo-400 bg-white/5' : 'text-gray-400'}`}
            >
              <FileText className="w-5 h-5" />
            </button>
          </Tooltip>

          {/* Plugin Tabs */}
          {pluginTabs.map(tab => (
            <Tooltip key={tab.id} content={`${tab.title} (Plugin)`} position="bottom">
              <button
                className="p-1.5 rounded-lg hover:bg-white/10 transition-all text-gray-400"
                onClick={() => console.log(`Opening plugin tab: ${tab.id}`)}
              >
                <Puzzle className="w-4 h-4" />
              </button>
            </Tooltip>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content Area */}
        <div className="flex-1 flex flex-col relative overflow-hidden">
          {isInitializing && <SplashScreen onComplete={() => setIsInitializing(false)} />}

          {/* Overlays / Sidebars */}
          {showEqualizer && <Equalizer onClose={() => setShowEqualizer(false)} />}

          {/* View Container */}
          <div className="flex-1 relative overflow-hidden">
            {activeTab === 'library' && <LibraryView onClose={() => setActiveTab('player')} />}
            {activeTab === 'releases' && <ReleasesView onClose={() => setActiveTab('player')} />}
            {activeTab === 'network' && <NetworkView onClose={() => setActiveTab('player')} />}
            {activeTab === 'gallery' && <ImageBrowser onClose={() => setActiveTab('player')} />}
            {activeTab === 'converter' && <ConverterView onClose={() => setActiveTab('player')} />}
            {activeTab === 'search' && <SearchView onClose={() => setActiveTab('player')} />}
            {activeTab === 'youtube' && <YouTubeView onClose={() => setActiveTab('player')} />}
            {activeTab === 'plugins' && <PluginSettingsView onClose={() => setActiveTab('player')} />}
            {activeTab === 'jobs' && <JobDashboard onClose={() => setActiveTab('player')} />}

            {/* Main Stage (Player) and persistent media container */}
            <div className={`flex-1 h-full relative flex items-center justify-center overflow-hidden ${(activeTab !== 'player' && activeTab !== null) ? 'hidden' : ''}`}>
              {streamUrl ? (
                <div className="w-full h-full animate-fade-in relative">
                  <VideoPlayer key={streamUrl} />
                </div>
              ) : (
                /* Premium Placeholder */
                <div className="flex flex-col items-center gap-8 mb-12 z-10 animate-fade-in">
                  <div className="relative group">
                    <div className="absolute -inset-4 bg-primary-500/20 rounded-full blur-2xl group-hover:bg-primary-500/30 transition-all duration-500" />
                    <div className="w-56 h-56 rounded-3xl glass flex items-center justify-center shadow-2xl relative">
                      <Disc3 className="w-28 h-28 text-primary-500 animate-spin-slow" />
                    </div>
                  </div>

                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-bold tracking-tight bg-gradient-to-b from-white to-gray-400 bg-clip-text text-transparent">
                      Ready for Music?
                    </h2>
                    <p className="text-gray-500 text-sm max-w-[240px] mx-auto leading-relaxed">
                      Select a track from your library or drop files here to begin your experience.
                    </p>
                    <div className="pt-6">
                      <button
                        onClick={handleOpenFiles}
                        className="group flex items-center gap-3 px-6 py-3 bg-primary-600 hover:bg-primary-500 rounded-2xl text-sm font-semibold text-white transition-all duration-300 shadow-lg shadow-primary-900/40 hover:scale-105 active:scale-95"
                      >
                        <FolderOpen className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                        <span>Open Media</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Always-mounted but potentially invisible VideoPlayer for background audio */}
            {streamUrl && (activeTab !== 'player' && activeTab !== null) && (
              <div className="absolute inset-0 pointer-events-none opacity-0 overflow-hidden">
                <VideoPlayer key={streamUrl} />
              </div>
            )}
          </div>
        </div>

        {/* Playlist Sidebar - Floating / Sliding */}
        <div
          className={`
            absolute top-0 right-0 bottom-0 z-40 transition-all duration-500 ease-in-out
            ${showQueue ? 'w-80 translate-x-0' : 'w-0 translate-x-full opacity-0 pointer-events-none'}
          `}
        >
          {/* Collapse pull-tab on the left edge */}
          {showQueue && (
            <button
              onClick={() => setShowQueue(false)}
              title="Collapse Queue"
              className="absolute -left-4 top-1/2 -translate-y-1/2 z-50 w-4 h-12 flex items-center justify-center bg-white/5 hover:bg-white/15 border border-white/10 border-r-0 rounded-l-lg transition-colors text-gray-500 hover:text-white"
            >
              <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M0 4L6 0v8L0 4z" /></svg>
            </button>
          )}
          <div className="h-full w-80 glass-dark border-l border-white/5">
            <PlaylistSidebar />
          </div>
        </div>
      </div>

      {/* Update Notification */}
      {
        updateAvailable && (
          <div className="absolute bottom-28 right-8 glass-dark p-1 rounded-2xl shadow-2xl z-[60] animate-fade-in">
            <div className="bg-primary-600/10 p-4 rounded-xl border border-primary-500/20 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-500 rounded-lg">
                  <Activity className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="font-bold text-sm">New Update Ready</div>
                  <div className="text-[10px] text-gray-400">Downloading the latest improvements...</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setUpdateAvailable(false)}
                  className="flex-1 text-[10px] font-bold text-gray-400 hover:text-white transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Bottom Controls */}
      <div className={`h-28 glass-dark border-t border-white/5 relative z-50 transition-all duration-500 ${zenMode ? 'translate-y-full opacity-0 invisible' : 'translate-y-0'}`}>
        <div className="max-w-7xl mx-auto h-full flex items-center px-8">
          <PlayerControls
            onToggleQueue={() => setShowQueue(!showQueue)}
            queueVisible={showQueue}
            onToggleEqualizer={() => setShowEqualizer(!showEqualizer)}
            zenMode={zenMode}
            onToggleZenMode={() => setZenMode(!zenMode)}
          />
        </div>
      </div>
    </div>
  );
}
