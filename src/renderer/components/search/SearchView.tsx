import { useState, useEffect, useRef } from 'react';
import { useMediaPlayerStore } from '../../state/media-player';
import { useProviderStore } from '../../state/providers';
import {
    Search as SearchIcon,
    X,
    Music,
    Video,
    Image as ImageIcon,
    Puzzle,
    Play,
    History
} from 'lucide-react';
import type { MediaSource, LibraryTrack } from '@shared/types';

interface SearchViewProps {
    onClose: () => void;
}

export function SearchView({ onClose }: SearchViewProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<{
        library: LibraryTrack[];
        providers: MediaSource[];
        network: MediaSource[];
    }>({ library: [], providers: [], network: [] });
    const [isSearching, setIsSearching] = useState(false);
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    const { addToPlaylist } = useMediaPlayerStore();
    const { search: searchProviders } = useProviderStore();

    const performSearch = async (q: string) => {
        if (!q.trim()) {
            setResults({ library: [], providers: [], network: [] });
            return;
        }

        setIsSearching(true);
        try {
            // 1. Search Local Library
            const allTracks = await window.electronAPI.library.getAll();
            const localMatches = allTracks.filter(t =>
                t.title.toLowerCase().includes(q.toLowerCase()) ||
                t.artist?.toLowerCase().includes(q.toLowerCase())
            );

            // 2. Search Plugin Providers
            const providerMatches = await searchProviders(q);

            setResults({
                library: localMatches,
                providers: providerMatches,
                network: [] // TODO: Search active network sessions
            });
        } catch (e) {
            console.error('Unified search failed:', e);
        } finally {
            setIsSearching(false);
        }
    };

    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            performSearch(query);
        }, 300);

        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, [query]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handlePlay = (source: MediaSource | LibraryTrack) => {
        let mediaSource: MediaSource;
        if ('mediaType' in source) { // it's a MediaSource or LibraryTrack with mediaType
            mediaSource = source as MediaSource;
        } else {
            // It's a slightly different structure if it's strictly LibraryTrack
            const t = source as any;
            mediaSource = {
                id: t.id,
                type: 'local',
                mediaType: t.mediaType || 'audio',
                path: t.path,
                title: t.title
            };
        }
        addToPlaylist(mediaSource, true);
        onClose();
    };

    return (
        <div className="absolute inset-x-0 top-0 bottom-0 z-[100] flex items-start justify-center p-12 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div className="w-full max-w-4xl max-h-[80vh] glass-dark rounded-[2.5rem] border border-white/10 flex flex-col overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.5)] relative">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors z-[100]"
                >
                    <X className="w-5 h-5" />
                </button>
                {/* Search Input Area */}
                <div className="p-8 border-b border-white/5 pr-16">
                    <div className="relative group">
                        <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 w-6 h-6 text-gray-500 group-focus-within:text-primary-400 transition-colors" />
                        <input
                            autoFocus
                            type="text"
                            placeholder="Search anything... music, videos, photos, or YouTube"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="w-full pl-16 pr-12 py-5 bg-white/5 border border-white/5 focus:border-primary-500/50 rounded-3xl text-xl text-white outline-none shadow-inner transition-all placeholder:text-gray-600"
                        />
                        {query && (
                            <button
                                onClick={() => setQuery('')}
                                className="absolute right-6 top-1/2 -translate-y-1/2 p-1.5 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Results Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-8">
                    {!query ? (
                        <div className="h-full flex flex-col items-center justify-center space-y-4 opacity-30 select-none py-12">
                            <History className="w-16 h-16 mb-2" />
                            <h3 className="text-xl font-bold">What would you like to hear?</h3>
                            <p className="text-sm">Search your library, network shares, and 3rd-party services.</p>
                        </div>
                    ) : isSearching ? (
                        <div className="h-full flex flex-col items-center justify-center py-12">
                            <div className="w-12 h-12 border-4 border-primary-500/10 border-t-primary-500 rounded-full animate-spin mb-4" />
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Searching everywhere...</span>
                        </div>
                    ) : results.library.length === 0 && results.providers.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center py-12 opacity-30">
                            <SearchIcon className="w-16 h-16 mb-4" />
                            <p className="text-sm">No results found for "{query}"</p>
                        </div>
                    ) : (
                        <div className="space-y-12 pb-12">
                            {/* Library Results */}
                            {results.library.length > 0 && (
                                <section className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Music className="w-4 h-4 text-primary-400" />
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Your Library</h3>
                                        <div className="flex-1 h-px bg-white/5" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {results.library.map(item => (
                                            <SearchResultItem key={item.id} item={item} onPlay={handlePlay} />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Plugin Provider Results */}
                            {results.providers.length > 0 && (
                                <section className="space-y-4">
                                    <div className="flex items-center gap-3">
                                        <Puzzle className="w-4 h-4 text-indigo-400" />
                                        <h3 className="text-xs font-black uppercase tracking-widest text-gray-500">Dynamic Providers</h3>
                                        <div className="flex-1 h-px bg-white/5" />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {results.providers.map(item => (
                                            <SearchResultItem key={item.id} item={item} onPlay={handlePlay} />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 px-8 border-t border-white/5 bg-black/20 flex items-center justify-between text-[10px] text-gray-500 uppercase font-black tracking-widest">
                    <div className="flex gap-4">
                        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/10 rounded">ESC</kbd> to close</span>
                        <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 bg-white/10 rounded">ENTER</kbd> to play first</span>
                    </div>
                    <span>Ginger Unified Search Engine v1.0</span>
                </div>
            </div>
        </div>
    );
}

function SearchResultItem({ item, onPlay }: { item: any; onPlay: (i: any) => void }) {
    const isImage = item.mediaType === 'image';
    const isVideo = item.mediaType === 'video';

    return (
        <button
            onClick={() => onPlay(item)}
            className="flex items-center gap-4 p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all group text-left"
        >
            <div className="w-12 h-12 rounded-xl bg-black/40 flex items-center justify-center overflow-hidden flex-shrink-0">
                {isImage ? (
                    <ImageIcon className="w-5 h-5 text-indigo-400" />
                ) : isVideo ? (
                    <Video className="w-5 h-5 text-primary-400" />
                ) : (
                    <Music className="w-5 h-5 text-gray-500" />
                )}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-200 truncate leading-tight mb-0.5 group-hover:text-primary-400 transition-colors">{item.title}</p>
                <p className="text-[10px] text-gray-500 truncate uppercase tracking-wider font-bold">
                    {item.artist || item.providerId || (item.type === 'local' ? 'Local File' : 'External')}
                </p>
            </div>
            <div className="p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Play className="w-4 h-4 text-primary-500 fill-current" />
            </div>
        </button>
    );
}
