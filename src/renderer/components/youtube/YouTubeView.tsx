import React, { useState, useEffect } from 'react';
import { Search, Download, Play, Loader2, X, Youtube, ListMusic } from 'lucide-react';
import { useMediaPlayerStore } from '../../state/media-player';

export function YouTubeView({ onClose }: { onClose?: () => void }) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const { addToPlaylist } = useMediaPlayerStore();

    const isPlaylistUrl = (url: string) => {
        return url.includes('list=') || url.includes('playlist?list=');
    };

    const handleSearch = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setError('');

        try {
            if (isPlaylistUrl(query)) {
                const playlistTracks = await window.electronAPI.youtube.getPlaylist(query);
                if (playlistTracks.length === 0) {
                    setError('No tracks found in playlist or playlist is private.');
                } else {
                    // Load all tracks into playlist
                    playlistTracks.forEach((video: any, index: number) => {
                        const mediaItem = {
                            id: video.id,
                            title: video.title,
                            type: 'provider' as const,
                            mediaType: 'video' as const,
                            path: `https://www.youtube.com/watch?v=${video.id}`,
                            providerId: 'youtube',
                            duration: video.duration
                        };
                        addToPlaylist(mediaItem, index === 0); // Play first track immediately
                    });
                    if (onClose) onClose();
                }
            } else {
                const data = await window.electronAPI.youtube.search(query);
                setResults(data);
            }
        } catch (err) {
            console.error(err);
            setError('Failed to fetch from YouTube.');
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (video: any, isAudioOnly: boolean) => {
        try {
            const downloadsPath = await window.electronAPI.app.getDownloadsPath();
            await window.electronAPI.jobs.startDownload({
                url: video.url,
                format: isAudioOnly ? 'audio' : 'video',
                outputPath: `${downloadsPath}/${video.title.replace(/[/\\?%*:|"<>]/g, '-')}.mp4`
            });
        } catch (err) {
            console.error("Failed to start download:", err);
        }
    };

    const handlePlay = (video: any) => {
        const mediaItem = {
            id: video.id,
            title: video.title,
            type: 'provider' as const,
            mediaType: 'video' as const,
            path: video.url,
            providerId: 'youtube',
            duration: video.duration
        };

        addToPlaylist(mediaItem, true);
        if (onClose) onClose();
    };

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && onClose) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    return (
        <div className="absolute inset-x-0 top-0 bottom-0 z-[100] flex items-start justify-center p-12 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[80vh] glass-dark rounded-[2.5rem] border border-white/10 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] relative">
                {onClose && (
                    <button
                        onClick={onClose}
                        className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-[100]"
                    >
                        <X className="w-5 h-5" />
                    </button>
                )}

                {/* Search Input Area */}
                <div className="p-8 border-b border-white/5 pr-16 bg-black/20">
                    <form onSubmit={handleSearch} className="relative group">
                        <Youtube className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500 group-focus-within:text-red-500 transition-colors" />
                        <input
                            autoFocus
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Paste YouTube Search or Playlist URL..."
                            className="w-full pl-16 pr-24 py-5 bg-white/5 border border-white/5 focus:border-red-500/50 rounded-3xl text-xl text-white outline-none shadow-[inset_0_2px_4px_rgba(0,0,0,0.4)] transition-all placeholder:text-gray-600"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery('')}
                                    className="p-1.5 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={loading || !query.trim()}
                                className="bg-red-500 hover:bg-red-600 active:bg-red-700 text-white p-3 rounded-full transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center mr-1"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : isPlaylistUrl(query) ? <ListMusic className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                            </button>
                        </div>
                    </form>
                    {error && <p className="text-red-400 mt-2 text-sm pl-4">{error}</p>}
                </div>

                {/* Results Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {!loading && results.length === 0 && !query ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30 select-none py-12">
                            <Youtube className="w-16 h-16 mb-2" />
                            <h3 className="text-xl font-bold">What do you want to play?</h3>
                            <p className="text-sm">Search videos or paste a playlist link to load everything.</p>
                        </div>
                    ) : loading ? (
                        <div className="h-full flex flex-col items-center justify-center py-12">
                            <Loader2 className="w-12 h-12 text-red-500 animate-spin mb-4" />
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{isPlaylistUrl(query) ? 'Loading Playlist...' : 'Searching YouTube...'}</span>
                        </div>
                    ) : results.length === 0 && query && !error && !loading ? (
                        <div className="h-full flex flex-col items-center justify-center py-12 opacity-30">
                            <Search className="w-16 h-16 mb-4" />
                            <p className="text-sm">No results found for "{query}"</p>
                        </div>
                    ) : (
                        <div className="space-y-12 pb-12">
                            {results.length > 0 && (
                                <section className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Youtube className="w-4 h-4 text-red-500" />
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">YouTube Results</h3>
                                        <div className="flex-1 h-px bg-white/5" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {results.map((video) => (
                                            <div key={video.id} className="flex gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 transition-colors border border-white/5 group">
                                                <div className="relative w-40 aspect-video rounded-xl overflow-hidden flex-shrink-0 bg-black/50">
                                                    <img src={video.thumbnail} alt={video.title} className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500" />
                                                    <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[10px] font-mono shadow-sm">
                                                        {formatDuration(video.duration)}
                                                    </div>
                                                </div>

                                                <div className="flex flex-col flex-1 py-1 min-w-0 pointer-events-none">
                                                    <h3 className="font-semibold text-base leading-tight line-clamp-2 mb-1 group-hover:text-primary-400 transition-colors pointer-events-auto" title={video.title}>{video.title}</h3>
                                                    <p className="text-xs text-gray-400 mb-auto line-clamp-1 pointer-events-auto">{video.channel}</p>

                                                    <div className="flex gap-1.5 mt-3 pointer-events-auto">
                                                        <button
                                                            onClick={() => handlePlay(video)}
                                                            className="flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shadow-sm"
                                                        >
                                                            <Play className="w-3.5 h-3.5 fill-current" /> Play
                                                        </button>
                                                        <div className="flex bg-white/10 hover:bg-white/15 rounded-lg overflow-hidden border border-white/5 transition-colors">
                                                            <button
                                                                onClick={() => handleDownload(video, false)}
                                                                className="flex items-center gap-1.5 hover:bg-white/20 px-3 py-1.5 text-xs transition-colors text-white border-r border-white/10"
                                                                title="Download Video"
                                                            >
                                                                <Download className="w-3.5 h-3.5" /> MP4
                                                            </button>
                                                            <button
                                                                onClick={() => handleDownload(video, true)}
                                                                className="flex items-center gap-1.5 hover:bg-white/20 px-3 py-1.5 text-xs transition-colors text-gray-300 font-medium"
                                                                title="Download Audio"
                                                            >
                                                                MP3
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )
                    }
                </div>

                {/* Footer */}
                <div className="p-4 px-8 border-t border-white/5 bg-black/20 flex items-center justify-between text-[10px] text-gray-500 uppercase font-black tracking-widest shrink-0">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/10 rounded">ESC</kbd> to close</span>
                        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/10 rounded">ENTER</kbd> to search</span>
                    </div>
                    <span>Ginger YouTube Connect v1.0</span>
                </div>
            </div>
        </div>
    );
}
