// Application-level TypeScript type definitions

/**
 * Represents an item in the playback queue/playlist
 */


/**
 * Application settings structure
 */


/**
 * Application settings structure
 */
export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  volume: number;
  downloadsPath: string;
  libraryFolders: string[];
  autoScan: boolean;
  hardwareAcceleration: boolean;
  minimizeToTray: boolean;
}

/**
 * Represents a track in the media library
 */
export interface LibraryTrack {
  id: string;
  path: string;
  title: string;
  artist?: string;
  album?: string;
  albumArtist?: string;
  genre?: string;
  year?: number;
  trackNumber?: number;
  duration: number;
  format: string;
  bitrate?: number;
  addedAt: number;
  lastModified: number;
  mediaType: 'audio' | 'video' | 'image';
}

/**
 * Information about an available update
 */
export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl?: string;
}

/**
 * Current status of the update process
 */
export interface UpdateStatus {
  status: 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error';
  info?: UpdateInfo;
  progress?: number;
  error?: string;
}

/**
 * Update download progress information
 */
export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  transferred: number;
  total: number;
}

/**
 * Represents a release note document
 */
export interface ReleaseNote {
  filename: string;
  version: string;
  date: string;
  content: string;
}

/**
 * Result of a library scan operation
 */
export interface LibraryScanResult {
  tracksFound: number;
  errors: string[];
}
