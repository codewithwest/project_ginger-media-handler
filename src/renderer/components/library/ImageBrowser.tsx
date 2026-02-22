import { useState, useMemo, useEffect } from 'react';
import {
    Image as ImageIcon,
    X,
    Search,
    Maximize2,
    Calendar,
    Edit3,
    Check,
    ChevronLeft,
    ChevronRight,
    Play,
    Pause,
    Trash2,
    LayoutGrid,
    List,
    FolderOpen,
    Plus
} from 'lucide-react';
import type { LibraryTrack } from '@shared/types';
import { useLibraryStore } from '../../state/library';

interface ImageBrowserProps {
    onClose: () => void;
}

export function ImageBrowser({ onClose }: ImageBrowserProps) {
    const { tracks, isLoading, scanProgress, addFolder, scanLibrary } = useLibraryStore();
    const [searchQuery, setSearchQuery] = useState('');
    const [renamingId, setRenamingId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);
    const [isSlideshowRunning, setIsSlideshowRunning] = useState(false);
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [activeFolder, setActiveFolder] = useState<string | null>(null); // null means "All Photos"

    const images = useMemo(() => tracks.filter(t => t.mediaType === 'image'), [tracks]);

    const folders = useMemo(() => {
        const folderMap = new Map<string, number>();
        images.forEach(img => {
            const dir = img.path.substring(0, img.path.lastIndexOf('/'));
            folderMap.set(dir, (folderMap.get(dir) || 0) + 1);
        });
        return Array.from(folderMap.entries()).map(([path, count]) => ({
            path,
            name: path.split('/').pop() || path,
            count
        }));
    }, [images]);

    const filteredImages = useMemo(() => {
        let result = images;
        if (activeFolder) {
            result = result.filter(img => img.path.startsWith(activeFolder));
        }
        if (searchQuery) {
            const query = searchQuery.toLowerCase();
            result = result.filter(img =>
                img.title.toLowerCase().includes(query) ||
                img.path.toLowerCase().includes(query)
            );
        }
        return result;
    }, [images, activeFolder, searchQuery]);

    const handleImageClick = (index: number) => {
        if (filteredImages[index]) {
            setPreviewIndex(index);
            setRenamingId(null);
        }
    };

    const handleNext = () => {
        if (previewIndex !== null && filteredImages.length > 0) {
            setPreviewIndex((previewIndex + 1) % filteredImages.length);
        }
    };

    const handlePrev = () => {
        if (previewIndex !== null && filteredImages.length > 0) {
            setPreviewIndex((previewIndex - 1 + filteredImages.length) % filteredImages.length);
        }
    };

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (isSlideshowRunning && previewIndex !== null) {
            timer = setInterval(handleNext, 5000);
        }
        return () => clearInterval(timer);
    }, [isSlideshowRunning, previewIndex, filteredImages.length]);

    const handleRename = async (img: LibraryTrack) => {
        if (!newName.trim() || newName === img.title) {
            setRenamingId(null);
            return;
        }

        try {
            const oldId = img.id;
            await window.electronAPI.library.rename(oldId, newName);
            scanLibrary(); // Trigger refresh
            setRenamingId(null);
        } catch (e) {
            alert(e instanceof Error ? e.message : 'Rename failed');
        }
    };

    const handleDelete = async (img: LibraryTrack) => {
        if (confirm(`Are you sure you want to remove "${img.title}" from your library?`)) {
            // Soft remove for now (UI only until we have library.removeTrack)
            setPreviewIndex(null);
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-8 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-6xl h-[85vh] glass-dark rounded-3xl border border-white/10 flex flex-col overflow-hidden shadow-2xl">

                {/* Header */}
                <div className="h-16 px-6 flex items-center justify-between border-b border-white/5 bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-xl">
                            <ImageIcon className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white tracking-tight">Image Gallery</h2>
                            <div className="flex items-center gap-2">
                                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">{images.length} Photos total</p>
                                {isLoading && (
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1">
                                            <span className="w-1 h-1 bg-indigo-400 rounded-full animate-ping" />
                                            <span className="text-[8px] text-indigo-400 font-bold uppercase tracking-tighter">
                                                {scanProgress ? `Scanning: ${scanProgress.processed} items...` : 'Initializing scan...'}
                                            </span>
                                        </div>
                                        {scanProgress?.currentFile && (
                                            <span className="text-[8px] text-gray-500 truncate max-w-[120px] italic">
                                                {scanProgress.currentFile}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1 bg-white/5 rounded-2xl p-1 border border-white/10">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                <LayoutGrid className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
                            >
                                <List className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-indigo-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Search context..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 pr-4 py-1.5 bg-white/5 border border-white/5 focus:border-indigo-500/50 rounded-xl text-xs text-white outline-none w-48 transition-all"
                            />
                        </div>
                        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content Area with Sidebar */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <div className="w-56 border-r border-white/5 flex flex-col bg-black/20">
                        <div className="p-4 space-y-1 overflow-y-auto custom-scrollbar flex-1">
                            <button
                                onClick={() => setActiveFolder(null)}
                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${activeFolder === null ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-gray-400 hover:bg-white/5'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <LayoutGrid className="w-4 h-4" />
                                    <span>All Items</span>
                                </div>
                                <span className="text-[10px] opacity-60 font-mono">{images.length}</span>
                            </button>

                            <div className="pt-4 pb-2 px-3 text-[10px] font-black text-gray-500 uppercase tracking-widest">Folders</div>

                            {folders.map(f => (
                                <button
                                    key={f.path}
                                    onClick={() => setActiveFolder(f.path)}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group ${activeFolder === f.path ? 'bg-white/10 text-white border border-white/5' : 'text-gray-400 hover:bg-white/5 border border-transparent'}`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <FolderOpen className={`w-4 h-4 ${activeFolder === f.path ? 'text-indigo-400' : 'text-gray-500 group-hover:text-gray-300'}`} />
                                        <span className="truncate">{f.name}</span>
                                    </div>
                                    <span className="text-[10px] opacity-40 font-mono">{f.count}</span>
                                </button>
                            ))}

                            {folders.length === 0 && !isLoading && (
                                <div className="px-3 py-4 text-center">
                                    <p className="text-[10px] text-gray-600 italic">No folders found</p>
                                </div>
                            )}
                        </div>

                        <div className="p-4 border-t border-white/5 bg-black/20">
                            <button
                                onClick={addFolder}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
                            >
                                <Plus className="w-4 h-4" />
                                Add Folder
                            </button>
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-6 bg-black/10">
                        {images.length === 0 && !isLoading ? (
                            <div className="h-full flex flex-col items-center justify-center text-center max-w-xs mx-auto animate-in fade-in zoom-in-95 duration-700">
                                <div className="w-20 h-20 bg-indigo-500/10 rounded-full flex items-center justify-center mb-6 border border-indigo-500/20">
                                    <FolderOpen className="w-8 h-8 text-indigo-400" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Empty Gallery</h3>
                                <p className="text-xs text-gray-500 mb-8 leading-relaxed">Your gallery is currenty empty. Add a folder to start discovering your images.</p>
                                <button
                                    onClick={addFolder}
                                    className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all"
                                >
                                    <Plus className="w-4 h-4" />
                                    Add My First Folder
                                </button>
                            </div>
                        ) : filteredImages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-40 text-center">
                                <Search className="w-10 h-10 mb-4 text-gray-400" />
                                <p className="text-xs font-bold uppercase tracking-wider">No matches found</p>
                            </div>
                        ) : (
                            <div className={viewMode === 'grid'
                                ? "grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
                                : "flex flex-col gap-2"
                            }>
                                {filteredImages.map((img, index) => (
                                    <div
                                        key={img.id}
                                        className={`group relative rounded-2xl overflow-hidden bg-white/5 border border-white/5 hover:border-indigo-500/50 transition-all shadow-md hover:shadow-indigo-500/10 ${viewMode === 'grid' ? 'aspect-square' : 'p-3 flex items-center gap-4'}`}
                                    >
                                        <img
                                            src={`http://127.0.0.1:3000/thumbnail?path=${encodeURIComponent(img.path)}`}
                                            alt={img.title}
                                            className={`${viewMode === 'grid' ? 'w-full h-full' : 'w-12 h-12 rounded-xl'} object-cover group-hover:scale-110 transition-transform duration-500 cursor-pointer`}
                                            loading="lazy"
                                            onClick={() => handleImageClick(index)}
                                        />

                                        {viewMode === 'list' && (
                                            <div className="flex-1 min-w-0">
                                                {renamingId === img.id ? (
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            autoFocus
                                                            value={newName}
                                                            onChange={(e) => setNewName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleRename(img);
                                                                if (e.key === 'Escape') setRenamingId(null);
                                                            }}
                                                            className="bg-white/10 px-3 py-1 rounded-lg text-sm text-white outline-none w-full border border-indigo-500/50"
                                                        />
                                                        <button onClick={() => handleRename(img)} className="p-2 bg-indigo-600 rounded-lg text-white">
                                                            <Check className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between">
                                                        <div className="min-w-0">
                                                            <h4 className="text-sm font-bold text-white truncate cursor-pointer" onClick={() => handleImageClick(index)}>{img.title}</h4>
                                                            <p className="text-[10px] text-gray-500 font-medium truncate opacity-60 tracking-tight">{img.path}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => { setRenamingId(img.id); setNewName(img.title); }}
                                                                className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white"
                                                            >
                                                                <Edit3 className="w-4 h-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => handleImageClick(index)}
                                                                className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg shadow-indigo-600/20"
                                                            >
                                                                <Maximize2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {viewMode === 'grid' && (
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4 pointer-events-none">
                                                {renamingId === img.id ? (
                                                    <div className="flex items-center gap-2 pointer-events-auto bg-black/60 p-2 rounded-xl border border-white/10 backdrop-blur-md">
                                                        <input
                                                            autoFocus
                                                            value={newName}
                                                            onChange={(e) => setNewName(e.target.value)}
                                                            onKeyDown={(e) => {
                                                                if (e.key === 'Enter') handleRename(img);
                                                                if (e.key === 'Escape') setRenamingId(null);
                                                            }}
                                                            className="bg-transparent text-[10px] text-white outline-none w-full"
                                                        />
                                                        <button onClick={() => handleRename(img)} className="p-1 hover:text-green-400 text-green-500">
                                                            <Check className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center justify-between pointer-events-auto">
                                                        <p className="text-[10px] font-bold text-white truncate max-w-[80%]">{img.title}</p>
                                                        <button
                                                            onClick={() => { setRenamingId(img.id); setNewName(img.title); }}
                                                            className="p-1.5 hover:bg-white/20 rounded-lg text-gray-400 hover:text-white transition-all shadow-sm"
                                                        >
                                                            <Edit3 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between mt-2 opacity-60">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <Calendar className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                                                        <span className="text-[8px] text-gray-400 truncate">{img.path.split('/').pop()}</span>
                                                    </div>
                                                    <button
                                                        onClick={() => handleImageClick(index)}
                                                        className="pointer-events-auto p-1 text-indigo-400 hover:text-white"
                                                    >
                                                        <Maximize2 className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Full Preview Overlay */}
                {previewIndex !== null && (
                    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col animate-in fade-in duration-300">
                        {/* Preview Header */}
                        <div className="h-20 px-8 flex items-center justify-between border-b border-white/5 bg-white/5">
                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setPreviewIndex(null)}
                                    className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-all"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                                <div>
                                    <h3 className="text-sm font-bold text-white tracking-tight">{filteredImages[previewIndex].title}</h3>
                                    <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{previewIndex + 1} of {filteredImages.length}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => setIsSlideshowRunning(!isSlideshowRunning)}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${isSlideshowRunning ? 'bg-indigo-600 text-white shadow-glow' : 'bg-white/5 text-gray-400 hover:text-white'}`}
                                >
                                    {isSlideshowRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
                                    {isSlideshowRunning ? 'Pause Slideshow' : 'Start Slideshow'}
                                </button>
                            </div>
                        </div>

                        {/* Main Content (Full Image) */}
                        <div className="flex-1 relative flex items-center justify-center p-8 overflow-hidden group/viewer">
                            <img
                                key={filteredImages[previewIndex].id}
                                src={`http://127.0.0.1:3000/file?path=${encodeURIComponent(filteredImages[previewIndex].path)}`}
                                alt={filteredImages[previewIndex].title}
                                className="max-w-full max-h-full object-contain shadow-2xl animate-in zoom-in-95 duration-500 select-none pointer-events-none"
                            />

                            {/* Navigation */}
                            <button
                                onClick={handlePrev}
                                className="absolute left-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white/20 hover:text-white transition-all border border-white/5 opacity-0 group-hover/viewer:opacity-100 backdrop-blur-md"
                            >
                                <ChevronLeft className="w-8 h-8" />
                            </button>
                            <button
                                onClick={handleNext}
                                className="absolute right-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-white/5 hover:bg-white/10 text-white/20 hover:text-white transition-all border border-white/5 opacity-0 group-hover/viewer:opacity-100 backdrop-blur-md"
                            >
                                <ChevronRight className="w-8 h-8" />
                            </button>
                        </div>

                        {/* Controls (Bottom) */}
                        <div className="h-24 px-8 flex items-center justify-center gap-6 border-t border-white/5 bg-black/60 relative z-[110]">
                            {renamingId === filteredImages[previewIndex].id ? (
                                <div className="flex items-center gap-2 bg-indigo-600/20 px-4 py-2 rounded-xl border border-indigo-500/30">
                                    <input
                                        autoFocus
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRename(filteredImages[previewIndex]);
                                            if (e.key === 'Escape') setRenamingId(null);
                                        }}
                                        className="bg-transparent text-sm text-white outline-none w-64 font-bold"
                                        placeholder="Enter new filename..."
                                    />
                                    <button
                                        onClick={() => handleRename(filteredImages[previewIndex])}
                                        className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                                    >
                                        <Check className="w-5 h-5" />
                                    </button>
                                    <button
                                        onClick={() => setRenamingId(null)}
                                        className="p-2 bg-white/5 text-gray-400 rounded-lg hover:text-white transition-colors"
                                    >
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        onClick={() => { setRenamingId(filteredImages[previewIndex].id); setNewName(filteredImages[previewIndex].title); }}
                                        className="flex items-center gap-2 text-[10px] font-bold text-gray-500 hover:text-indigo-400 uppercase tracking-[0.2em] transition-all bg-white/5 px-6 py-3 rounded-xl border border-white/5"
                                    >
                                        <Edit3 className="w-3.5 h-3.5" />
                                        Rename File
                                    </button>
                                    <div className="h-6 w-px bg-white/10" />
                                    <button
                                        onClick={() => handleDelete(filteredImages[previewIndex])}
                                        className="flex items-center gap-2 text-[10px] font-bold text-gray-500 hover:text-red-400 uppercase tracking-[0.2em] transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Remove from Library
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
