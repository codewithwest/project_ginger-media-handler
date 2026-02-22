import { useRef, useState, useCallback } from 'react';
import { Play, Pause, SkipForward, SkipBack, Shuffle, Repeat, Volume2, VolumeX, Maximize, ListMusic, SlidersHorizontal, Gauge, EyeOff } from 'lucide-react';
import { useMediaPlayerStore } from '../../state/media-player';
import { Tooltip } from '../ui/Tooltip';

interface PlayerControlsProps {
  onToggleQueue?: () => void;
  queueVisible?: boolean;
  onToggleEqualizer?: () => void;
  zenMode?: boolean;
  onToggleZenMode?: () => void;
}

export function PlayerControls({
  onToggleQueue,
  queueVisible,
  onToggleEqualizer,
  zenMode,
  onToggleZenMode
}: PlayerControlsProps) {
  const {
    status,
    currentSource,
    shuffle,
    repeat,
    volume,
    isMuted,
    position,
    duration,
    play,
    pause,
    seek,
    next,
    previous,
    toggleShuffle,
    toggleRepeat,
    setVolume,
    toggleMute,
    playbackSpeed,
    setSpeed,
  } = useMediaPlayerStore();

  const [isDragging, setIsDragging] = useState(false);
  const [dragValue, setDragValue] = useState(0);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverX, setHoverX] = useState(0);
  const progressRef = useRef<HTMLDivElement>(null);

  const isPlaying = status === 'playing';
  const isYouTube = currentSource?.providerId === 'youtube';

  const formatTime = (seconds: number) => {
    if (!seconds || !isFinite(seconds) || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newPosition = parseFloat(e.target.value) || 0;
    setDragValue(newPosition);
    if (!isDragging) {
      seek(newPosition);
    }
  };

  const handleMouseDown = () => setIsDragging(true);
  const handleMouseUp = () => {
    setIsDragging(false);
    seek(dragValue);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!progressRef.current || !duration) return;
    const rect = progressRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    const percentage = x / rect.width;
    setHoverTime(percentage * duration);
    setHoverX(x);
  }, [duration]);

  const handleMouseLeave = () => setHoverTime(null);

  const handlePlayPause = () => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  };

  const handleToggleFullScreen = () => {
    window.electronAPI.window.toggleFullScreen();
  };

  const getValidPosition = (val: number, dur: number) => {
    if (isNaN(val) || !isFinite(val)) return 0;
    if (isNaN(dur) || !isFinite(dur) || dur <= 0) return 0;
    return Math.min(dur, Math.max(0, val));
  };

  const currentPos = getValidPosition(isDragging ? dragValue : position, duration || 0);
  const progressPercent = duration && duration > 0
    ? Math.min(100, Math.max(0, (currentPos / duration) * 100))
    : 0;

  const hoverPercent = duration && duration > 0 && progressRef.current
    ? Math.min(100, Math.max(0, (hoverX / progressRef.current.clientWidth) * 100))
    : 0;

  return (
    <div className="flex flex-col gap-2 w-full animate-fade-in">
      {/* Progress Bar - Hidden for YouTube as it has its own controls usually or we can't sync well */}
      {!isYouTube && (
        <div className="flex items-center gap-4 w-full px-2 animate-in fade-in slide-in-from-top-2 duration-500">
          <span className="text-[10px] text-gray-500 w-[38px] text-right font-mono tabular-nums shrink-0">
            {formatTime(currentPos)}
          </span>
          <div
            ref={progressRef}
            className={`flex-1 relative group h-6 flex items-center transition-opacity duration-500 ${!duration || duration <= 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Hover Timestamp Tooltip */}
            {hoverTime !== null && (
              <div
                className="absolute bottom-full mb-2 -translate-x-1/2 px-2 py-1 bg-black/90 border border-white/10 rounded text-[10px] font-mono text-white pointer-events-none z-50 animate-in fade-in zoom-in-95"
                style={{ left: `${hoverPercent}%` }}
              >
                {formatTime(hoverTime)}
              </div>
            )}

            <input
              type="range"
              min="0"
              max={duration || 0}
              disabled={!duration || duration <= 0}
              value={currentPos}
              onChange={handleSeek}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer z-10
                accent-primary-500
                hover:accent-primary-400
                [&::-webkit-slider-thumb]:appearance-none
                [&::-webkit-slider-thumb]:w-0
                [&::-webkit-slider-thumb]:h-0
                group-hover:[&::-webkit-slider-thumb]:w-4
                group-hover:[&::-webkit-slider-thumb]:h-4
                group-hover:[&::-webkit-slider-thumb]:bg-white
                group-hover:[&::-webkit-slider-thumb]:rounded-full
                group-hover:[&::-webkit-slider-thumb]:shadow-[0_0_15px_rgba(255,255,255,0.8)]"
            />
            {/* Background Track */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1.5 bg-primary-500 rounded-full pointer-events-none shadow-[0_0_10px_rgba(14,165,233,0.5)] transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            />
            {/* Hover Line */}
            {hoverTime !== null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-white/20 rounded-full pointer-events-none"
                style={{ width: `${hoverPercent}%` }}
              />
            )}
          </div>
          <span className="text-[10px] text-gray-500 w-[38px] font-mono tabular-nums shrink-0">
            {formatTime(duration)}
          </span>
        </div>
      )}

      <div className={`flex items-center justify-between w-full h-14 ${isYouTube ? 'mt-2' : ''}`}>
        {/* Left: Secondary controls */}
        <div className="flex items-center gap-1 w-1/3">
          <Tooltip content="Shuffle" position="top">
            <button
              onClick={toggleShuffle}
              className={`p-2 rounded-xl transition-all duration-300 ${shuffle ? 'text-primary-500 bg-primary-500/10 shadow-[0_0_15px_rgba(14,165,233,0.2)]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </Tooltip>
          <Tooltip content={`Repeat: ${repeat}`} position="top">
            <button
              onClick={toggleRepeat}
              className={`p-2 rounded-xl transition-all duration-300 ${repeat !== 'off' ? 'text-primary-500 bg-primary-500/10 shadow-[0_0_15px_rgba(14,165,233,0.2)]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            >
              <Repeat className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>

        {/* Center: Main controls */}
        <div className="flex items-center gap-6">
          <Tooltip content="Previous" position="top">
            <button
              onClick={previous}
              className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all duration-300 transform active:scale-90"
            >
              <SkipBack className="w-6 h-6 fill-current" />
            </button>
          </Tooltip>

          <Tooltip content={isPlaying ? 'Pause' : 'Play'} position="top">
            <button
              onClick={handlePlayPause}
              className="w-14 h-14 rounded-2xl bg-white text-black hover:scale-105 active:scale-95 transition-all duration-300 flex items-center justify-center shadow-[0_8px_30px_rgb(255,255,255,0.2)]"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6 fill-current" />
              ) : (
                <Play className="w-6 h-6 ml-1 fill-current" />
              )}
            </button>
          </Tooltip>

          <Tooltip content="Next" position="top">
            <button
              onClick={next}
              className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-full transition-all duration-300 transform active:scale-90"
            >
              <SkipForward className="w-6 h-6 fill-current" />
            </button>
          </Tooltip>
        </div>

        {/* Right: Volume & Extra */}
        <div className="flex items-center justify-end gap-3 w-1/3">
          <div className="flex items-center gap-2 group/vol">
            <button
              onClick={toggleMute}
              className="p-1 hover:bg-white/5 rounded-lg transition-colors"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-red-500" />
              ) : (
                <Volume2 className="w-4 h-4 text-gray-500 group-hover/vol:text-gray-300 transition-colors" />
              )}
            </button>
            <div className={`w-20 relative h-1 bg-white/10 rounded-full overflow-hidden transition-opacity ${isMuted ? 'opacity-30' : 'opacity-100'}`}>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
              />
              <div
                className={`h-full transition-colors ${isMuted ? 'bg-red-500/50' : 'bg-gray-400 group-hover/vol:bg-primary-500'}`}
                style={{ width: `${volume * 100}%` }}
              />
            </div>
          </div>

          <div className="w-[1px] h-4 bg-white/10 mx-2" />

          <Tooltip content="Equalizer" position="top">
            <button
              onClick={onToggleEqualizer}
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-xl transition-all"
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content="Playback Speed" position="top">
            <button
              onClick={() => {
                const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
                const nextIndex = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                setSpeed(speeds[nextIndex]);
              }}
              className="flex items-center gap-1.5 px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg transition-all border border-white/5"
            >
              <Gauge className="w-3.5 h-3.5 text-gray-400" />
              <span className="text-[10px] font-bold text-gray-300 font-mono w-8 text-left">{playbackSpeed}x</span>
            </button>
          </Tooltip>

          <Tooltip content="Full Screen" position="top">
            <button
              onClick={handleToggleFullScreen}
              className="p-2 text-gray-500 hover:text-gray-300 hover:bg-white/5 rounded-xl transition-all"
            >
              <Maximize className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content="Toggle Queue" position="top">
            <button
              onClick={onToggleQueue}
              className={`p-2 rounded-xl transition-all ${queueVisible ? 'text-primary-500 bg-primary-500/10 shadow-[0_0_15px_rgba(14,165,233,0.2)]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            >
              <ListMusic className="w-4 h-4" />
            </button>
          </Tooltip>

          <Tooltip content="Zen Mode (Hide Controls)" position="top">
            <button
              onClick={onToggleZenMode}
              className={`p-2 rounded-xl transition-all ${zenMode ? 'text-primary-500 bg-primary-500/10 shadow-[0_0_15px_rgba(14,165,233,0.2)]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
            >
              <EyeOff className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
