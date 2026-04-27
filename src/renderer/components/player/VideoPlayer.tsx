
import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Volume2, Minimize } from 'lucide-react';
import { useMediaPlayerStore } from '../../state/media-player';
import { useAudioEngine } from '../../state/audio-engine';
import { Visualizer } from './Visualizer';

interface VideoPlayerProps {
  aspectRatio?: string;
}

export function VideoPlayer({ aspectRatio = 'auto' }: VideoPlayerProps) {

  const getVideoStyle = (): CSSProperties => {
    switch (aspectRatio) {
      case '16:9': return { objectFit: 'fill', aspectRatio: '16 / 9', maxWidth: '100%', maxHeight: '100%' };
      case '4:3':  return { objectFit: 'fill', aspectRatio: '4 / 3',  maxWidth: '100%', maxHeight: '100%' };
      case '1:1':  return { objectFit: 'fill', aspectRatio: '1 / 1',  maxWidth: '100%', maxHeight: '100%' };
      case '21:9': return { objectFit: 'fill', aspectRatio: '21 / 9', maxWidth: '100%', maxHeight: '100%' };
      case 'fill': return { objectFit: 'fill',    width: '100%', height: '100%' };
      case 'cover': return { objectFit: 'cover',  width: '100%', height: '100%' };
      default:     return { objectFit: 'contain', maxWidth: '100%', maxHeight: '100%' };
    }
  };

  const videoClass = (aspectRatio === 'fill' || aspectRatio === 'cover')
    ? 'shadow-2xl z-10'
    : 'max-w-full max-h-full shadow-2xl z-10';
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    streamUrl,
    status,
    volume,
    position,
    duration,
    syncTime,
    play,
    pause,
    stop,
    seek,
    next,
    previous,
    setVolume,
    currentSource,
    playbackSpeed,
  } = useMediaPlayerStore();

  // --- Fullscreen controls visibility ---
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const onFSChange = () => setIsFullScreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setControlsVisible(false), 3500);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHide();
  }, [scheduleHide]);

  useEffect(() => {
    if (isFullScreen) {
      revealControls();
    } else {
      setControlsVisible(true);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    }
    return () => { if (hideTimerRef.current) clearTimeout(hideTimerRef.current); };
  }, [isFullScreen]);

  const formatTime = (s: number) => {
    if (!s || !isFinite(s) || isNaN(s)) return '0:00';
    return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
  };

  // Sync Play/Pause/Stop status
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (status === 'playing') {
      video.play().catch(err => console.error("Playback failed", err));
    } else if (status === 'paused') {
      video.pause();
    } else if (status === 'stopped') {
      video.pause();
      video.currentTime = 0;
    }
  }, [status]);

  // Sync Volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume;
  }, [volume]);

  // Sync Playback Speed
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Sync Seek (Position) - careful to avoid loops
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isNaN(position) || !isFinite(position)) return;

    // Only seek if the difference is significant (> 0.5s) to avoid fighting with timeUpdate
    // Also ensure we don't seek past the video's actual duration to avoid "crazy" behavior
    const targetPos = Math.max(0, Math.min(position, video.duration || position));
    if (Math.abs(video.currentTime - targetPos) > 0.5) {
      video.currentTime = targetPos;
    }
  }, [position]);

  // Handle events from Video Element
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      syncTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      syncTime(videoRef.current.currentTime, videoRef.current.duration);
      if (status === 'playing') {
        videoRef.current.play().catch(e => console.error("Auto-play failed", e));
      }
    }
  };

  const handleEnded = () => {
    next();
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    const error = e.currentTarget.error;
    console.error("Video player error:", {
      code: error?.code,
      message: error?.message,
      src: videoRef.current?.src
    });
  };

  /* New state for subtitles */
  const [subtitleUrl, setSubtitleUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadSubtitles() {
      if (currentSource?.path) {
        try {
          const url = await window.electronAPI.media.getSubtitlesUrl(currentSource.path);
          setSubtitleUrl(url);
        } catch (e) {
          console.error("Failed to load subtitles", e);
          setSubtitleUrl(null);
        }
      } else {
        setSubtitleUrl(null);
      }
    }
    loadSubtitles();
  }, [currentSource?.path]);

  const initAudio = useAudioEngine(state => state.init);

  useEffect(() => {
    if (videoRef.current) {
      initAudio(videoRef.current);
    }
  }, [initAudio]);

  if (currentSource?.providerId === 'youtube') {
    let videoId = '';
    try {
      if (currentSource.path.includes('v=')) {
        videoId = new URL(currentSource.path).searchParams.get('v') || '';
      } else if (currentSource.path.includes('youtu.be/')) {
        videoId = currentSource.path.split('youtu.be/')[1].split('?')[0];
      }
    } catch (e) {
      console.error("Failed to parse YouTube URL for embed", e);
    }

    if (videoId) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-black overflow-hidden relative z-[50]">
          <iframe
            className="w-full h-full z-10 absolute inset-0"
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title="YouTube Video Player"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
  }

  if (!streamUrl) return null;

  return (
    <div
      id="video-player-container"
      className={`w-full h-full flex items-center justify-center bg-transparent overflow-hidden relative group ${isFullScreen && !controlsVisible ? 'cursor-none' : ''}`}
      onMouseMove={isFullScreen ? revealControls : undefined}
    >
      {/* Background/Visualizer layer */}
      {currentSource?.path && !currentSource.path.toLowerCase().endsWith('.mp4') && (
        <div className="absolute inset-0 flex items-center justify-center opacity-80 pointer-events-none z-0">
          <div className="relative w-[500px] h-[500px] flex items-center justify-center">
            <Visualizer />
          </div>
        </div>
      )}

      <video
        ref={videoRef}
        src={streamUrl}
        crossOrigin="anonymous"
        className={videoClass}
        style={getVideoStyle()}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={handleError}
        onClick={() => status === 'playing' ? pause() : play()}
      >
        {subtitleUrl && (
          <track
            label="English"
            kind="subtitles"
            srcLang="en"
            src={subtitleUrl}
            default
          />
        )}
      </video>

      {/* Bottom Visualizer Strip removed in favor of central one for circular design */}

      {/* ── Fullscreen Controls Overlay ── */}
      {isFullScreen && (
        <div
          className={`absolute inset-x-0 bottom-0 z-50 transition-all duration-500 ease-in-out select-none
            ${controlsVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}
        >
          {/* Deep gradient scrim covering bottom ~50% */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/75 to-transparent pointer-events-none" />

          <div className="relative flex flex-col gap-7 px-16 pb-12 pt-28">

            {/* Zone 1 – Track info */}
            <div className="flex flex-col gap-1.5">
              <p
                className="text-white text-3xl font-bold tracking-tight truncate"
                style={{ textShadow: '0 2px 16px rgba(0,0,0,0.9)' }}
              >
                {currentSource?.title ?? 'Unknown Track'}
              </p>
              <p className="text-white/45 text-base font-medium truncate">
                {currentSource?.path?.split('/').slice(-2, -1)[0] ?? ''}
              </p>
            </div>

            {/* Zone 2 – Seek bar with custom rendered track */}
            <div className="flex items-center gap-6 w-full">
              <span className="text-sm text-white/55 font-mono tabular-nums w-12 text-right shrink-0">
                {formatTime(position)}
              </span>
              <div className="flex-1 relative h-6 flex items-center">
                {/* Visual track (non-interactive) */}
                <div className="absolute w-full h-2 bg-white/15 rounded-full overflow-hidden pointer-events-none">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-100"
                    style={{
                      width: `${duration > 0 ? Math.min(100, (position / duration) * 100) : 0}%`,
                      boxShadow: '0 0 10px rgba(255,255,255,0.5)',
                    }}
                  />
                </div>
                {/* Invisible range input sits on top for interaction */}
                <input
                  type="range" min={0} max={duration || 0} step={0.1}
                  value={isFinite(position) ? position : 0}
                  onChange={e => seek(parseFloat(e.target.value))}
                  className="absolute w-full h-6 opacity-0 cursor-pointer z-10"
                />
              </div>
              <span className="text-sm text-white/55 font-mono tabular-nums w-12 shrink-0">
                {formatTime(duration)}
              </span>
            </div>

            {/* Zone 3 – Transport (left) + Volume & Exit (right) */}
            <div className="flex items-center justify-between">

              {/* Transport */}
              <div className="flex items-center gap-9">
                <button
                  onClick={previous}
                  className="p-2 text-white/55 hover:text-white transition-all duration-200 hover:scale-110 active:scale-90"
                >
                  <SkipBack className="w-8 h-8 fill-current" />
                </button>

                <button
                  onClick={stop}
                  className="p-2 text-white/45 hover:text-red-400 transition-all duration-200 hover:scale-110 active:scale-90"
                >
                  <Square className="w-6 h-6 fill-current" />
                </button>

                {/* Primary play/pause – 72 px glowing pill */}
                <button
                  onClick={() => status === 'playing' ? pause() : play()}
                  className="w-[76px] h-[76px] rounded-full bg-white text-black flex items-center justify-center
                    hover:scale-105 active:scale-95 transition-all duration-200"
                  style={{ boxShadow: '0 0 0 10px rgba(255,255,255,0.10), 0 10px 40px rgba(0,0,0,0.6)' }}
                >
                  {status === 'playing'
                    ? <Pause className="w-8 h-8 fill-current" />
                    : <Play  className="w-8 h-8 ml-1 fill-current" />}
                </button>

                <button
                  onClick={next}
                  className="p-2 text-white/55 hover:text-white transition-all duration-200 hover:scale-110 active:scale-90"
                >
                  <SkipForward className="w-8 h-8 fill-current" />
                </button>
              </div>

              {/* Volume + Exit */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <Volume2 className="w-5 h-5 text-white/45 shrink-0" />
                  <div className="relative w-36 h-6 flex items-center">
                    <div className="absolute w-full h-1.5 bg-white/15 rounded-full overflow-hidden pointer-events-none">
                      <div
                        className="h-full bg-white/75 rounded-full"
                        style={{ width: `${Math.round(volume * 100)}%` }}
                      />
                    </div>
                    <input
                      type="range" min={0} max={1} step={0.02}
                      value={volume}
                      onChange={e => setVolume(parseFloat(e.target.value))}
                      className="absolute w-full h-6 opacity-0 cursor-pointer z-10"
                    />
                  </div>
                  <span className="text-sm text-white/40 font-mono tabular-nums w-10">
                    {Math.round(volume * 100)}%
                  </span>
                </div>

                <div className="w-px h-7 bg-white/15" />

                <button
                  onClick={() => document.exitFullscreen()}
                  className="flex items-center gap-2.5 px-5 py-2.5 text-white/60 hover:text-white
                    bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25
                    rounded-xl transition-all duration-200 text-sm font-semibold"
                >
                  <Minimize className="w-4 h-4" />
                  <span>Exit Fullscreen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
