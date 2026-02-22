
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import type { MediaSource, PlaylistMetadata, Playlist } from '../../shared/types/media';

export class PlaylistService {
  private playlistsDir: string;
  private metaPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.playlistsDir = path.join(userDataPath, 'playlists');
    this.metaPath = path.join(userDataPath, 'playlists_meta.json');

    if (!fs.existsSync(this.playlistsDir)) {
      fs.mkdirSync(this.playlistsDir, { recursive: true });
    }

    // Initialize meta if not exists
    if (!fs.existsSync(this.metaPath)) {
      this.saveMeta([]);
    }
  }

  private saveMeta(meta: PlaylistMetadata[]): void {
    fs.writeFileSync(this.metaPath, JSON.stringify(meta, null, 2));
  }

  private loadMeta(): PlaylistMetadata[] {
    try {
      if (fs.existsSync(this.metaPath)) {
        return JSON.parse(fs.readFileSync(this.metaPath, 'utf-8'));
      }
    } catch (err) {
      console.error('Failed to load playlist meta:', err);
    }
    return [];
  }

  getAllPlaylists(): PlaylistMetadata[] {
    return this.loadMeta();
  }

  getPlaylist(id: string): Playlist | null {
    const meta = this.loadMeta().find(m => m.id === id);
    if (!meta) return null;

    const playlistPath = path.join(this.playlistsDir, `${id}.json`);
    try {
      if (fs.existsSync(playlistPath)) {
        const items = JSON.parse(fs.readFileSync(playlistPath, 'utf-8'));
        return { ...meta, items };
      }
    } catch (err) {
      console.error(`Failed to load playlist ${id}:`, err);
    }
    return null;
  }

  createPlaylist(name: string): PlaylistMetadata {
    const id = uuidv4();
    const newPlaylist: PlaylistMetadata = {
      id,
      name,
      itemCount: 0,
      lastModified: Date.now()
    };

    const meta = this.loadMeta();
    meta.push(newPlaylist);
    this.saveMeta(meta);

    // Create empty items file
    fs.writeFileSync(path.join(this.playlistsDir, `${id}.json`), JSON.stringify([], null, 2));

    return newPlaylist;
  }

  savePlaylistItems(id: string, items: MediaSource[]): void {
    const meta = this.loadMeta();
    const index = meta.findIndex(m => m.id === id);
    if (index === -1) return;

    meta[index].itemCount = items.length;
    meta[index].lastModified = Date.now();
    this.saveMeta(meta);

    fs.writeFileSync(path.join(this.playlistsDir, `${id}.json`), JSON.stringify(items, null, 2));
  }

  renamePlaylist(id: string, newName: string): boolean {
    const meta = this.loadMeta();
    const index = meta.findIndex(m => m.id === id);
    if (index === -1) return false;

    meta[index].name = newName;
    meta[index].lastModified = Date.now();
    this.saveMeta(meta);
    return true;
  }

  deletePlaylist(id: string): boolean {
    const meta = this.loadMeta();
    const filteredMeta = meta.filter(m => m.id !== id);
    if (meta.length === filteredMeta.length) return false;

    this.saveMeta(filteredMeta);

    const playlistPath = path.join(this.playlistsDir, `${id}.json`);
    if (fs.existsSync(playlistPath)) {
      fs.unlinkSync(playlistPath);
    }
    return true;
  }

  // Active Queue Persistence
  load(): MediaSource[] {
    const queuePath = path.join(app.getPath('userData'), 'queue.json');
    try {
      if (fs.existsSync(queuePath)) {
        return JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
      }
    } catch (err) {
      console.error('Failed to load queue:', err);
    }
    return [];
  }

  save(items: MediaSource[]): void {
    const queuePath = path.join(app.getPath('userData'), 'queue.json');
    fs.writeFileSync(queuePath, JSON.stringify(items, null, 2));
  }
}
