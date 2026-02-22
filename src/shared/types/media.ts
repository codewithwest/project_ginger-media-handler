// Shared TypeScript types for IPC communication

export type PlaybackStatus = 'stopped' | 'playing' | 'paused' | 'buffering';

export type RepeatMode = 'off' | 'one' | 'all';

export interface MediaSource {
  id: string;
  type: 'local' | 'remote' | 'network' | 'provider';
  mediaType: 'audio' | 'video' | 'image';
  networkType?: 'dlna' | 'smb';
  networkServerId?: string;
  providerId?: string;
  path: string;
  title?: string;
  artist?: string;
  album?: string;
  duration?: number;
  isDirectory?: boolean;
}

export type PlaylistItem = MediaSource;

export interface PlaylistMetadata {
  id: string;
  name: string;
  itemCount: number;
  lastModified: number;
}

export interface Playlist extends PlaylistMetadata {
  items: MediaSource[];
}

export interface PlaybackState {
  status: PlaybackStatus;
  currentSource: MediaSource | null;
  position: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  playbackSpeed: number;
}

export interface MediaPlayerState extends PlaybackState {
  playlist: MediaSource[];
  currentIndex: number;
}

export interface JobProgress {
  jobId: string;
  type: 'conversion' | 'download';
  status: 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  progress: number; // 0-100
  message?: string;
  title?: string;
  outputFile?: string;
  error?: string;
}

export interface Job extends JobProgress {
  createdAt: number;
  details: ConversionRequest | DownloadRequest;
  outputFile?: string;
  error?: string;
}

export interface ConversionRequest {
  inputPath: string;
  outputPath: string;
  format: 'mp3' | 'flac' | 'wav' | 'aac';
  quality?: 'low' | 'medium' | 'high';
}

export interface DownloadRequest {
  url: string;
  outputPath: string;
  format: 'best' | 'audio' | 'video';
  quality?: string;
}

export interface MediaFormat {
  formatId: string;
  ext: string;
  resolution?: string;
  filesize?: number;
  vcodec?: string;
  acodec?: string;
}

export interface MediaMetadata {
  duration: number;
  format: string;
  bitrate: number;
  size: number;
  video?: {
    codec: string;
    width: number;
    height: number;
    fps: number;
  };
  audio?: {
    codec: string;
    channels: number;
    sampleRate: number;
  };
  tags?: Record<string, string>;
}

export interface NetworkServer {
  id: string;
  name: string;
  type: 'dlna' | 'smb';
  address: string; // IP or hostname
  port?: number;
  icon?: string;
  location?: string; // DIDL URL or parsed location
  requiresAuth?: boolean;
}

export interface SMBConfig {
  share: string; // \\HOST\SHARE
  domain?: string;
  username?: string;
  password?: string;
}

export interface PluginUITab {
  id: string;
  pluginName?: string;
  title: string;
  icon: string;
  route: string;
}

export interface GingerMediaProvider {
  id: string;
  name: string;
  icon?: string;
  search?: (query: string) => Promise<MediaSource[]>;
  browse?: (path?: string) => Promise<MediaSource[]>;
  resolve?: (source: MediaSource) => Promise<string>; // Resolves to a playable URL/stream
}
