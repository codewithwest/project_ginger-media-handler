
import React, { useState, useEffect } from 'react';
import { useMediaPlayerStore } from '../../state/media-player';
import { usePlaylistStore } from '../../state/playlists';
import { Trash2, ListMusic, Plus, Download, Bookmark, Edit2, Check, Save, FolderPlus, FolderOpen } from 'lucide-react';
import type { MediaSource, PlaylistMetadata } from '../../../shared/types/media';
import { FileTree, useFileTree } from '@pierre/trees/react';

const getMediaType = (filePath: string): 'audio' | 'video' | 'image' => {
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '')) return 'image';
  if (['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv'].includes(ext || '')) return 'video';
  return 'audio'; // Default
};

export function PlaylistSidebar() {
  const {
    playlist,
    currentIndex,
    playAtIndex,
    removeFromPlaylist,
    clearPlaylist,
    addToPlaylist
  } = useMediaPlayerStore();

  const {
    playlists,
    fetchPlaylists,
    createPlaylist,
    renamePlaylist,
    deletePlaylist,
    loadPlaylist,
    updateItems,
  } = usePlaylistStore();

  const [view, setView] = useState<'queue' | 'library' | 'explorer'>('queue');
  const [explorerPaths, setExplorerPaths] = useState<string[]>([]);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [downloadsPath, setDownloadsPath] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);

  const treePaths = React.useMemo(() => {
    return explorerPaths.map(p => {
      const type = getMediaType(p);
      const folderName = type === 'audio' ? 'Audio' : type === 'video' ? 'Video' : 'Images';
      return `${folderName}${p}`;
    });
  }, [explorerPaths]);

  const { model: treeModel } = useFileTree({
    paths: treePaths,
    icons: { set: 'complete' },
    search: true,
    dragAndDrop: true,
    composition: {
      contextMenu: {
        enabled: true,
        triggerMode: 'both',
        buttonVisibility: 'when-needed',
      },
    },
  });

  useEffect(() => {
    window.electronAPI.settings.get().then(settings => {
      if (settings?.downloadsPath) {
        setDownloadsPath(settings.downloadsPath);
      }
    });
    fetchPlaylists();
  }, [fetchPlaylists]);

  const handleAddFiles = async () => {
    const files = await window.electronAPI.file.openDialog();
    if (files && files.length > 0) {
      const newItems: MediaSource[] = files.map((filePath: string) => ({
        id: filePath,
        type: 'local' as const,
        mediaType: getMediaType(filePath),
        path: filePath,
        title: filePath.split('/').pop() || 'Unknown'
      }));
      newItems.forEach((item: MediaSource) => addToPlaylist(item));
    }
  };

  const handleAddFolder = async () => {
    const files = await window.electronAPI.file.openFolderDialog();
    if (files && files.length > 0) {
      const newItems: MediaSource[] = files.map((filePath: string) => ({
        id: filePath,
        type: 'local' as const,
        mediaType: getMediaType(filePath),
        path: filePath,
        title: filePath.split('/').pop() || 'Unknown'
      }));
      newItems.forEach((item: MediaSource) => addToPlaylist(item));
      setExplorerPaths(files);
      setView('explorer');
    }
  };

  const handleDownloadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (urlInput.trim()) {
      const baseDir = downloadsPath || '/tmp';
      const outputPath = `${baseDir}/%(title)s.%(ext)s`;

      window.electronAPI.jobs.startDownload({
        url: urlInput,
        outputPath,
        format: 'best'
      });
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  const startRename = (playlist: PlaylistMetadata) => {
    setEditingId(playlist.id);
    setEditName(playlist.name);
  };

  const confirmRename = async (id: string) => {
    if (editName.trim()) {
      await renamePlaylist(id, editName.trim());
      setEditingId(null);
    }
  };

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPlaylistName.trim()) {
      await createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowCreateInput(false);
    }
  };

  const handleSaveCurrentQueue = async () => {
    const name = `Quick Playlist ${playlists.length + 1}`;
    await createPlaylist(name);
    // Find the latest one (by name or just re-fetch and get last)
    const latest = await window.electronAPI.playlists.getAll();
    const newId = latest.find(p => p.name === name)?.id;
    if (newId) {
      await updateItems(newId, playlist);
    }
  };

  const handleLoadPlaylist = async (id: string) => {
    await loadPlaylist(id);
    // In actual implementation, you might want to ask if they want to append or replace
    const saved = await window.electronAPI.playlists.get(id);
    if (saved) {
      clearPlaylist();
      saved.items.forEach(item => addToPlaylist(item));
      playAtIndex(0);
      setView('queue');
    }
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* Tab Switcher */}
      <div className="px-6 pt-6 flex gap-4 border-b border-white/5 pb-4">
        <button
          onClick={() => setView('queue')}
          className={`text-xs font-black uppercase tracking-widest transition-colors ${view === 'queue' ? 'text-primary-500' : 'text-gray-500 hover:text-white'}`}
        >
          Queue
        </button>
        <button
          onClick={() => setView('library')}
          className={`text-xs font-black uppercase tracking-widest transition-colors ${view === 'library' ? 'text-primary-500' : 'text-gray-500 hover:text-white'}`}
        >
          Library
        </button>
        <button
          onClick={() => setView('explorer')}
          className={`text-xs font-black uppercase tracking-widest transition-colors ${view === 'explorer' ? 'text-primary-500' : 'text-gray-500 hover:text-white'}`}
        >
          Explorer
        </button>
      </div>

      <div className="p-6 flex flex-col gap-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              {view === 'queue' ? 'Playing Next' : view === 'library' ? 'Your Playlists' : 'File Explorer'}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            {view === 'queue' ? (
              <>
                <button
                  onClick={handleSaveCurrentQueue}
                  className="p-2 text-gray-400 hover:text-primary-400 hover:bg-white/5 rounded-xl transition-all duration-300"
                  title="Save Queue as Playlist"
                >
                  <Save className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowUrlInput(!showUrlInput)}
                  className={`p-2 rounded-xl transition-all duration-300 ${showUrlInput ? 'bg-primary-500 text-white shadow-glow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  title="Download from URL"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={handleAddFolder}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300"
                  title="Add Folder"
                >
                  <FolderPlus className="w-4 h-4" />
                </button>
                <button
                  onClick={handleAddFiles}
                  className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all duration-300"
                  title="Add Files"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  onClick={clearPlaylist}
                  className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all duration-300"
                  title="Clear Queue"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowCreateInput(!showCreateInput)}
                className={`p-2 rounded-xl transition-all duration-300 ${showCreateInput ? 'bg-primary-500 text-white shadow-glow' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                title="Create New Playlist"
              >
                <Plus className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Create Input */}
        {showCreateInput && (
          <form onSubmit={handleCreatePlaylist} className="flex gap-2 animate-in slide-in-from-top-2 duration-300">
            <input
              autoFocus
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Playlist name..."
              className="flex-1 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500/50"
            />
            <button type="submit" className="p-2 bg-primary-600 rounded-xl text-white"><Check className="w-4 h-4" /></button>
          </form>
        )}

        {/* URL Input Form */}
        {view === 'queue' && showUrlInput && (
          <div className="flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-300 p-4 rounded-2xl bg-white/5 border border-white/5">
            <form onSubmit={handleDownloadSubmit} className="flex gap-2">
              <input
                id="url-input"
                type="text"
                autoFocus
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste Media URL..."
                className="flex-1 bg-black/40 border border-white/5 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary-500/50 transition-colors"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
              >
                Go
              </button>
            </form>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-3 pb-6 space-y-1">
        {view === 'explorer' ? (
          explorerPaths.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <FolderOpen className="w-8 h-8 text-gray-600 mb-4" />
              <p className="text-gray-500 text-sm font-medium">Add a folder to explore</p>
            </div>
          ) : (
            <div className="h-full w-full" style={{ 
              '--trees-bg': 'transparent', 
              '--trees-row-hover-bg': 'rgba(255, 255, 255, 0.05)',
              '--trees-row-selected-bg': 'rgba(255, 255, 255, 0.1)',
              '--trees-text': '#d1d5db',
              '--trees-text-muted': '#9ca3af'
            } as React.CSSProperties}>
              <FileTree 
                model={treeModel} 
                className="h-full"
                renderContextMenu={(item, context) => (
                  <div className="rounded-md border border-white/10 bg-black/90 p-1 shadow-xl flex flex-col min-w-[120px] z-50">
                    <button
                      className="text-xs text-left px-2 py-1.5 text-white hover:bg-white/10 rounded transition-colors"
                      onClick={() => {
                        context.close({ restoreFocus: false });
                        const realPath = item.path.replace(/^(Audio|Video|Images)/, '');
                        addToPlaylist({
                          id: realPath,
                          type: 'local',
                          mediaType: getMediaType(realPath),
                          path: realPath,
                          title: realPath.split('/').pop() || 'Unknown'
                        });
                      }}
                      type="button"
                    >
                      Add to Queue
                    </button>
                    <button
                      className="text-xs text-left px-2 py-1.5 text-white hover:bg-white/10 rounded transition-colors"
                      onClick={() => {
                        context.close({ restoreFocus: false });
                        const realPath = item.path.replace(/^(Audio|Video|Images)/, '');
                        addToPlaylist({
                          id: realPath,
                          type: 'local',
                          mediaType: getMediaType(realPath),
                          path: realPath,
                          title: realPath.split('/').pop() || 'Unknown'
                        });
                        playAtIndex(playlist.length); // Play this newly added item
                      }}
                      type="button"
                    >
                      Play Now
                    </button>
                  </div>
                )}
              />
            </div>
          )
        ) : view === 'queue' ? (
          playlist.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <ListMusic className="w-8 h-8 text-gray-600 mb-4" />
              <p className="text-gray-500 text-sm font-medium">Your queue is empty</p>
            </div>
          ) : (
            playlist.map((item, index) => (
              <div
                key={index}
                className={`group flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition-all ${index === currentIndex ? 'bg-white/10' : ''}`}
                onDoubleClick={() => playAtIndex(index)}
              >
                <div className="w-8 h-8 rounded-lg bg-black/40 flex items-center justify-center text-[10px] font-bold text-gray-500">
                  {index === currentIndex ? (
                    <div className="flex gap-0.5 items-end h-2">
                      <div className="w-0.5 bg-primary-500 animate-[music-bar_0.8s_ease-in-out_infinite]" />
                      <div className="w-0.5 bg-primary-500 animate-[music-bar_0.8s_ease-in-out_infinite_0.2s] h-[60%]" />
                      <div className="w-0.5 bg-primary-500 animate-[music-bar_0.8s_ease-in-out_infinite_0.4s]" />
                    </div>
                  ) : index + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-bold truncate ${index === currentIndex ? 'text-primary-400' : 'text-gray-300'}`}>
                    {item.title}
                  </div>
                  <div className="text-[10px] text-gray-600 truncate">{item.artist || 'Unknown'}</div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    removeFromPlaylist(index);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 text-gray-500 hover:text-red-400 transition-all z-10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))
          )
        ) : (
          playlists.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <Bookmark className="w-8 h-8 text-gray-600 mb-4" />
              <p className="text-gray-500 text-sm font-medium">No saved playlists</p>
            </div>
          ) : (
            playlists.map((p) => (
              <div key={p.id} className="group flex flex-col p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-all gap-2 border border-transparent hover:border-white/5">
                <div className="flex items-center justify-between">
                  {editingId === p.id ? (
                    <div className="flex-1 flex gap-2">
                      <input
                        autoFocus
                        className="flex-1 bg-black/40 border-none rounded-lg px-2 py-1 text-xs text-white"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onBlur={() => confirmRename(p.id)}
                        onKeyDown={(e) => e.key === 'Enter' && confirmRename(p.id)}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-black text-white truncate uppercase tracking-tighter">{p.name}</div>
                      <div className="text-[9px] text-gray-500 uppercase font-mono">{p.itemCount} items</div>
                    </div>
                  )}

                  <div className="flex items-center gap-1">
                    {editingId !== p.id && (
                      <button onClick={() => startRename(p)} className="p-1.5 text-gray-500 hover:text-white transition-colors" title="Rename"><Edit2 className="w-3 h-3" /></button>
                    )}
                    <button onClick={() => deletePlaylist(p.id)} className="p-1.5 text-gray-500 hover:text-red-400 transition-colors" title="Delete"><Trash2 className="w-3 h-3" /></button>
                  </div>
                </div>

                <button
                  onClick={() => handleLoadPlaylist(p.id)}
                  className="w-full py-2 bg-primary-600/20 hover:bg-primary-500 text-primary-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Load Playlist
                </button>
              </div>
            ))
          )
        )}
      </div>

      <style>{`
        @keyframes music-bar {
          0%, 100% { height: 30%; }
          50% { height: 100%; }
        }
      `}</style>
    </div>
  );
}
