
import { BrowserWindow, ipcMain } from 'electron';
import { MediaSource, RepeatMode, PlaybackState } from '../../shared/types/media';
import { PlaylistService } from './PlaylistService';
import { EventEmitter } from 'events';

export class PlaybackService extends EventEmitter {
   private state: PlaybackState = {
      status: 'stopped',
      currentSource: null,
      position: 0,
      duration: 0,
      volume: 1.0,
      shuffle: false,
      repeat: 'off',
      playbackSpeed: 1.0
   };

   private playlist: MediaSource[] = [];
   private currentIndex = -1;

   constructor(private mainWindow: BrowserWindow, private playlistService: PlaylistService) {
      super();
      this.playlist = this.playlistService.load();
      this.initHandlers();
   }

   private initHandlers() {
      // Commands from Renderer or CLI
      ipcMain.handle('playback:play', (_event, index?: number) => this.play(index));
      ipcMain.handle('playback:pause', () => this.pause());
      ipcMain.handle('playback:stop', () => this.stop());
      ipcMain.handle('playback:next', () => this.next());
      ipcMain.handle('playback:previous', () => this.previous());
      ipcMain.handle('playback:seek', (_event, position: number) => this.seek(position));
      ipcMain.handle('playback:set-volume', (_event, volume: number) => this.setVolume(volume));
      ipcMain.handle('playback:set-shuffle', (_event, shuffle: boolean) => this.setShuffle(shuffle));
      ipcMain.handle('playback:set-repeat', (_event, repeat: RepeatMode) => this.setRepeat(repeat));
      ipcMain.handle('playback:set-speed', (_event, speed: number) => this.setSpeed(speed));

      // State sync
      ipcMain.handle('playback:get-state', () => ({
         ...this.state,
         playlist: this.playlist,
         currentIndex: this.currentIndex
      }));

      // Update from Renderer (e.g. timeUpdate)
      ipcMain.on('playback:sync-time', (_event, { position, duration }) => {
         this.state.position = position;
         if (duration !== undefined) this.state.duration = duration;
      });

      // Playlist Updates
      ipcMain.handle('playback:add-to-playlist', (_event, { item, playNow }: { item: MediaSource; playNow?: boolean }) => {
         this.playlist.push(item);
         this.playlistService.save(this.playlist);
         if (playNow) {
            this.play(this.playlist.length - 1);
         } else {
            this.notifyStateChanged();
         }
      });

      ipcMain.handle('playback:clear-playlist', () => {
         this.playlist = [];
         this.currentIndex = -1;
         this.state.currentSource = null;
         this.state.status = 'stopped';
         this.playlistService.save(this.playlist);
         this.notifyStateChanged();
      });

      ipcMain.handle('playback:remove-from-playlist', (_event, { index }: { index: number }) => {
         if (index < 0 || index >= this.playlist.length) return;
         this.playlist.splice(index, 1);
         // Adjust currentIndex if we removed something at or before it
         if (index < this.currentIndex) {
            this.currentIndex--;
         } else if (index === this.currentIndex) {
            // Removed the playing track — stop playback or move to next
            if (this.playlist.length === 0) {
               this.currentIndex = -1;
               this.state.currentSource = null;
               this.state.status = 'stopped';
            } else {
               // clamp to last if we were at the end
               this.currentIndex = Math.min(this.currentIndex, this.playlist.length - 1);
               this.state.currentSource = this.playlist[this.currentIndex];
            }
         }
         this.playlistService.save(this.playlist);
         this.notifyStateChanged();
      });
   }

   public toggle() {
      if (this.state.status === 'playing') {
         this.pause();
      } else {
         this.play();
      }
   }

   public play(index?: number) {
      if (typeof index === 'number') {
         this.currentIndex = index;
         this.state.currentSource = this.playlist[index] || null;
      }

      if (this.state.currentSource) {
         this.state.status = 'playing';
         this.notifyStateChanged();
      } else if (this.playlist.length > 0) {
         this.currentIndex = 0;
         this.state.currentSource = this.playlist[0];
         this.state.status = 'playing';
         this.notifyStateChanged();
      }
   }

   public pause() {
      this.state.status = 'paused';
      this.notifyStateChanged();
   }

   public stop() {
      this.state.status = 'stopped';
      this.state.position = 0;
      this.notifyStateChanged();
   }

   public next() {
      if (this.playlist.length === 0) return;

      if (this.state.shuffle) {
         this.currentIndex = Math.floor(Math.random() * this.playlist.length);
      } else {
         this.currentIndex++;
         if (this.currentIndex >= this.playlist.length) {
            if (this.state.repeat === 'all') {
               this.currentIndex = 0;
            } else {
               this.stop();
               return;
            }
         }
      }
      this.state.currentSource = this.playlist[this.currentIndex];
      this.state.status = 'playing';
      this.state.position = 0;
      this.notifyStateChanged();
   }

   public previous() {
      if (this.playlist.length === 0) return;

      if (this.state.position > 3) {
         this.seek(0);
         return;
      }

      this.currentIndex--;
      if (this.currentIndex < 0) {
         this.currentIndex = this.playlist.length - 1;
      }

      this.state.currentSource = this.playlist[this.currentIndex];
      this.state.status = 'playing';
      this.state.position = 0;
      this.notifyStateChanged();
   }

   public seek(position: number) {
      this.state.position = position;
      this.notifyStateChanged();
   }

   public setVolume(volume: number) {
      this.state.volume = volume;
      this.notifyStateChanged();
   }

   public setShuffle(shuffle: boolean) {
      this.state.shuffle = shuffle;
      this.notifyStateChanged();
   }

   public setRepeat(repeat: RepeatMode) {
      this.state.repeat = repeat;
      this.notifyStateChanged();
   }

   public setSpeed(speed: number) {
      this.state.playbackSpeed = speed;
      this.notifyStateChanged();
   }

   private notifyStateChanged() {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
         this.mainWindow.webContents.send('playback:state-changed', {
            ...this.state,
            playlist: this.playlist,
            currentIndex: this.currentIndex
         });
      }
      this.emit('state-changed', {
         ...this.state,
         playlist: this.playlist,
         currentIndex: this.currentIndex
      });
   }

   public getState() {
      return this.state;
   }
}
