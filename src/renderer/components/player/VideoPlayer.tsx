
import { useEffect, useRef, useState } from 'react';
import { useMediaPlayerStore } from '../../state/media-player';
import { useAudioEngine } from '../../state/audio-engine';
import { Visualizer } from './Visualizer';

export function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const {
    streamUrl,
    status,
    volume,
    position,
    syncTime,
    play,
    pause,
    next,
    currentSource,
    playbackSpeed,
  } = useMediaPlayerStore();

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
    <div className="w-full h-full flex items-center justify-center bg-transparent overflow-hidden relative group">
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
        className="max-w-full max-h-full object-contain shadow-2xl z-10"
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
    </div>
  );
}
