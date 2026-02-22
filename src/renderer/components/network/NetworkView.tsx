import { useEffect } from 'react';
import { useNetworkStore } from '../../state/network';
import { useMediaPlayerStore } from '../../state/media-player';
import { Server, Folder, FileVideo, Wifi, RefreshCw, ArrowLeft, RotateCw } from 'lucide-react';
import type { MediaSource, NetworkServer } from '@shared/types';

interface NetworkViewProps {
    onClose: () => void;
}

export function NetworkView({ onClose }: NetworkViewProps) {
    const {
        servers,
        isScanning,
        currentServer,
        contents,
        isLoading,
        error,
        startScan,
        stopScan,
        browse,
        reset
    } = useNetworkStore();

    const { addToPlaylist, playAtIndex } = useMediaPlayerStore();

    useEffect(() => {
        // Start scan on mount if no servers found yet
        if (servers.length === 0 && !isScanning && !currentServer) {
            startScan();
        }

        const cleanupFound = window.electronAPI.network.onServerFound((server) => {
            // Optimistically add to store? Store should handle this via `startScan` logic usually, 
            // but since we don't have a "onServersUpdated" listener in store yet, 
            // we rely on `startScan` fetching list or we can manually update list here.
            // Actually, store's startScan fetches initial list.
            // We should add a method `addServer` to store or just refresh list periodically?
            // Let's rely on standard polling or manual refresh for now, or assume Scan handles it.
            // Wait, store sets servers once on startScan.
            // We need network listener to update store.
            useNetworkStore.getState().setServers([...useNetworkStore.getState().servers, server]); // Dedup logic elsewhere?
        });

        return () => {
            stopScan();
            cleanupFound();
        };
    }, []);

    const handleServerClick = (server: NetworkServer) => {
        browse(server, '0'); // DLNA root is usually '0'. SMB might require path.
    };

    const handleItemClick = async (item: MediaSource) => {
        if (item.isDirectory) {
            browse(currentServer!, item.path);
        } else {
            // It's a file.
            // We can add to playlist and play.
            // Item path is the URL.
            const originalPath = item.path;

            let playbackUrl = originalPath;

            if (currentServer?.type === 'smb') {
                // For SMB, we need to proxy.
                // Check if item.path is absolute or relative?
                // SMBService returns full path relative to share usually? Or absolute on remote?
                // Let's assume we construct a proxy URL.
                // MediaServer proxy: http://localhost:3000/proxy?url=

                // We need Main Process base URL? Or just assume localhost:3000?
                // Actually, `media:get-stream-url` handles this logic if we pass the right path/type.
                // But we have `type: 'network'`.
                // Let's manually construct proxy url or use item.path directly if it's http (DLNA).

                // If DLNA: item.path is typically http://192.168.x.x:port/... (Playable directly)
                // If SMB: item.path is \\HOST\SHARE\file.

                const serverUrl = 'http://127.0.0.1:3000'; // Hardcoded for now or fetch from setting
                playbackUrl = `${serverUrl}/proxy?url=${encodeURIComponent(originalPath)}`;
            }

            // For DLNA, item.path is usually a valid HTTP URL.
            // Renderer can play it directly.

            const playableItem = {
                ...item,
                path: playbackUrl
            };

            addToPlaylist(playableItem);
            // Play the last added item
            playAtIndex(useMediaPlayerStore.getState().playlist.length - 1);
        }
    };

    const handleBack = () => {
        // Logic to go up one level?
        // DLNA doesn't easily support "Parent" ID unless tracking history.
        // We can implement a simple breadcrumb history stack in store or local state.
        // For now, "Back" resets to server list (root).
        reset();
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-5xl h-[80vh] glass-dark rounded-3xl border border-white/10 flex flex-col overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-3">
                        {currentServer ? (
                            <button onClick={handleBack} className="p-2 -ml-2 rounded-full hover:bg-white/10 transition-colors">
                                <ArrowLeft className="w-5 h-5 text-gray-400" />
                            </button>
                        ) : <Wifi className="w-5 h-5 text-primary-500" />}

                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">
                                {currentServer ? currentServer.name : 'Network Media'}
                            </h2>
                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                                {currentServer ? (currentServer.type === 'dlna' ? 'DLNA Server' : 'SMB Share') : 'Discovered Devices'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {!currentServer && (
                            <button
                                onClick={isScanning ? stopScan : startScan}
                                className={`p-2 rounded-xl transition-all ${isScanning ? 'text-primary-400 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                                title={isScanning ? "Scanning..." : "Refresh"}
                            >
                                {isScanning ? <RefreshCw className="w-5 h-5 animate-spin" /> : <RotateCw className="w-5 h-5" />}
                            </button>
                        )}
                        <button onClick={onClose} className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-gray-300 transition-all">
                            Close
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                    {error && (
                        <div className="p-4 mb-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {isLoading && (
                        <div className="flex justify-center items-center h-40">
                            <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
                        </div>
                    )}

                    {!currentServer && !isLoading && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {servers.map(server => (
                                <button
                                    key={server.id}
                                    onClick={() => handleServerClick(server)}
                                    className="group p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-primary-500/30 transition-all flex flex-col items-center gap-3 text-center"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-black/40 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                        <Server className="w-8 h-8 text-indigo-400" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-sm text-gray-200 group-hover:text-white truncate max-w-[150px]">{server.name}</div>
                                        <div className="text-[10px] text-gray-500">{server.address}</div>
                                    </div>
                                </button>
                            ))}
                            {servers.length === 0 && !isScanning && (
                                <div className="col-span-full py-12 text-center text-gray-500">
                                    No media servers found.
                                </div>
                            )}
                        </div>
                    )}

                    {currentServer && !isLoading && (
                        <div className="grid grid-cols-1 gap-1">
                            {contents.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => handleItemClick(item)}
                                    className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-all text-left"
                                >
                                    <div className="p-2 rounded-lg bg-black/20 text-gray-400 group-hover:text-primary-400 transition-colors">
                                        {item.isDirectory ? <Folder className="w-5 h-5" /> : <FileVideo className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm text-gray-300 group-hover:text-white truncate">
                                            {item.title}
                                        </div>
                                        {!item.isDirectory && (
                                            <div className="text-[10px] text-gray-600">
                                                {item.artist ? `${item.artist} • ` : ''}{item.album}
                                            </div>
                                        )}
                                    </div>
                                </button>
                            ))}
                            {contents.length === 0 && (
                                <div className="py-12 text-center text-gray-500">
                                    This folder is empty.
                                </div>
                            )}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
