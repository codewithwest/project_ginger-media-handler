
import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { EventEmitter } from 'events';
import { MediaMetadataService } from './MediaMetadata';

import type { LibraryTrack } from '@shared/types';

export interface LibraryData {
  folders: string[];
  tracks: LibraryTrack[];
}

export class LibraryService extends EventEmitter {
  private dataPath: string;
  private metadataService: MediaMetadataService;
  private data: LibraryData = { folders: [], tracks: [] };

  constructor(ffprobePath?: string) {
    super();
    this.dataPath = path.join(app.getPath('userData'), 'library.json');
    this.metadataService = new MediaMetadataService(ffprobePath);
    this.load();
  }

  private load() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const raw = fs.readFileSync(this.dataPath, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch (err) {
      console.error('Failed to load library:', err);
    }
  }

  private save() {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('Failed to save library:', err);
    }
  }

  getFolders(): string[] {
    return this.data.folders;
  }

  getTracks(): LibraryTrack[] {
    return this.data.tracks;
  }

  async addFolder(folderPath: string): Promise<void> {
    if (!this.data.folders.includes(folderPath)) {
      this.data.folders.push(folderPath);
      this.save();
      await this.scan(); // Scan immediately
    }
  }

  async removeFolder(folderPath: string): Promise<void> {
    this.data.folders = this.data.folders.filter(f => f !== folderPath);
    // Remove tracks belonging to this folder?
    // For now, let generic scan cleanup do it or just filter
    this.data.tracks = this.data.tracks.filter(t => !t.path.startsWith(folderPath));
    this.save();
  }

  async scan(): Promise<LibraryTrack[]> {
    console.log('Scanning library folders...', this.data.folders);
    const audioExts = ['.mp3', '.wav', '.flac', '.ogg', '.m4a'];
    const videoExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi'];
    const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.bmp'];
    const supportedExts = [...audioExts, ...videoExts, ...imageExts];
    const newTracks: LibraryTrack[] = [];

    if (this.data.folders.length === 0) {
      console.log('No folders to scan.');
      this.emit('scan-complete', []);
      return [];
    }

    this.emit('scan-start');

    // existing tracks map for quick lookup
    const existingMap = new Map(this.data.tracks.map(t => [t.path, t]));
    const processedPaths = new Set<string>(); // Prevent duplicates if folders overlap
    let processedCount = 0;

    for (const folder of this.data.folders) {
      if (!fs.existsSync(folder)) continue;

      const files = await this.recursiveReaddir(folder);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        if (processedPaths.has(file)) continue;
        processedPaths.add(file);

        const ext = path.extname(file).toLowerCase();

        if (supportedExts.includes(ext)) {
          if (existingMap.has(file)) {
            newTracks.push(existingMap.get(file) as LibraryTrack);
          } else {
            try {
              const isImage = imageExts.includes(ext);
              let metadata: any = {};

              if (!isImage) {
                metadata = await this.metadataService.getMetadata(file);
              }

              const track: LibraryTrack = {
                id: this.generateId(file),
                path: file,
                title: metadata.tags?.title || path.basename(file, ext),
                artist: metadata.tags?.artist || (isImage ? 'Photo' : 'Unknown Artist'),
                album: metadata.tags?.album || (isImage ? 'Gallery' : 'Unknown Album'),
                duration: metadata.duration || 0,
                format: metadata.format || ext.replace('.', ''),
                addedAt: Date.now(),
                lastModified: Date.now(),
                mediaType: isImage ? 'image' : (videoExts.includes(ext) ? 'video' : 'audio'),
              };

              newTracks.push(track);
              this.emit('scan-track-added', track);
            } catch (err) {
              console.warn(`Failed to process file ${file}:`, err);
            }
          }
        }

        processedCount++;
        // Emit progress every 10 files and yield the event loop
        if (processedCount % 10 === 0) {
          this.emit('scan-progress', {
            processed: processedCount,
            total: files.length, // This is per-folder, could be improved to global total
            currentFile: path.basename(file)
          });
          // Yield to event loop to prevent freezing
          await new Promise(resolve => setImmediate(resolve));
        }
      }
    }

    this.data.tracks = newTracks;
    this.save();
    this.emit('scan-complete', newTracks);
    return newTracks;
  }

  async renameTrack(id: string, newName: string): Promise<LibraryTrack> {
    const tracks = this.getTracks();
    const index = tracks.findIndex(t => t.id === id);
    if (index === -1) throw new Error('Track not found');

    const track = tracks[index];
    const oldPath = track.path;
    const directory = path.dirname(oldPath);
    const ext = path.extname(oldPath);
    const newPath = path.join(directory, newName + ext);

    if (fs.existsSync(newPath)) {
      throw new Error('A file with this name already exists');
    }

    // Rename on disk
    fs.renameSync(oldPath, newPath);

    // Update metadata
    track.path = newPath;
    track.title = newName;
    track.id = this.generateId(newPath);

    this.save();
    return track;
  }

  private async recursiveReaddir(dir: string): Promise<string[]> {
    try {
      const dirents = await fs.promises.readdir(dir, { withFileTypes: true });
      const files = await Promise.all(dirents.map((dirent) => {
        const res = path.resolve(dir, dirent.name);
        return dirent.isDirectory() ? this.recursiveReaddir(res) : res;
      }));
      return files.flat();
    } catch (e) {
      console.warn(`Failed to read directory ${dir}:`, e);
      return [];
    }
  }

  private generateId(filePath: string): string {
    // Simple hash replacement
    return Buffer.from(filePath).toString('base64');
  }
}
