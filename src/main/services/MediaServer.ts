import express from 'express';
import getPort from 'get-port';
import cors from 'cors';
import { Server } from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { app } from 'electron';
import { TranscoderService } from './Transcoder';
import { MediaMetadataService } from './MediaMetadata';
import { NetworkManager } from './network/NetworkManager';

export class MediaServer {
  private app: express.Express;
  private server: Server | null = null;
  private port = 0;
  private transcoder: TranscoderService;
  private networkManager?: NetworkManager;
  private metadataService: MediaMetadataService;

  constructor(ffmpegPath?: string, ffprobePath?: string, networkManager?: NetworkManager) {
    this.app = express();
    this.transcoder = new TranscoderService(ffmpegPath);
    this.metadataService = new MediaMetadataService(ffprobePath);
    this.networkManager = networkManager;

    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware() {
    this.app.use(cors());
    // Basic request logging
    this.app.use((req, _res, next) => {
      console.log(`[MediaServer] ${req.method} ${req.url}`);
      next();
    });
  }

  private setupRoutes() {
    // 1. Direct File Serving (for supported formats)
    // Use this endpoint for files we know the browser can play directly (MP4, WebM, MP3)
    this.app.get('/file', (req, res) => {
      const filePath = req.query.path as string;
      if (!filePath) {
        console.error('[MediaServer] No path provided for /file');
        res.status(400).send('Path is required');
        return;
      }

      if (!fs.existsSync(filePath)) {
        console.error(`[MediaServer] File not found: ${filePath}`);
        res.status(404).send('File not found');
        return;
      }

      res.sendFile(filePath, (err) => {
        if (err) {
          console.error(`[MediaServer] Error sending file: ${filePath}`, err);
          if (!res.headersSent) {
            res.status(500).send('Error sending file');
          }
        }
      });
    });

    // 2. Transcoded Stream
    // Use this for MKV, AVI, etc. Or if we just want uniform MP4 output.
    this.app.get('/stream', (req, res) => {
      const filePath = req.query.path as string;
      const startTime = parseFloat(req.query.start as string) || 0;

      if (!filePath) {
        console.error('[MediaServer] No path provided for /stream');
        res.status(400).send('Path is required');
        return;
      }

      if (!fs.existsSync(filePath)) {
        console.error(`[MediaServer] File not found for stream: ${filePath}`);
        res.status(404).send('File not found');
        return;
      }

      console.log(`[MediaServer] Starting stream for: ${filePath} at ${startTime}s`);

      // Set proper headers for streaming
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Create ffmpeg command
      const command = this.transcoder.createStream(filePath, startTime);

      // Pipe output to response
      command.pipe(res, { end: true });

      // Handle client disconnect
      req.on('close', () => {
        console.log('[MediaServer] Client closed connection, killing ffmpeg...');
        command.kill('SIGKILL');
      });
    });

    // 3. Metadata
    this.app.get('/metadata', async (req, res) => {
      const filePath = req.query.path as string;
      try {
        const metadata = await this.metadataService.getMetadata(filePath);
        res.json(metadata);
      } catch (error) {
        console.error('Metadata error:', error);
        res.status(500).json({ error: 'Failed to get metadata' });
      }
    });

    // 4. Subtitles (VTT extraction)
    this.app.get('/subtitles', async (req, res) => {
      const filePath = req.query.path as string;

      if (!filePath || !fs.existsSync(filePath)) {
        res.status(404).send('File not found');
        return;
      }

      try {
        // Quick check for subtitles
        const metadata = await this.metadataService.getMetadata(filePath);
        if (!metadata.hasSubtitles) {
          res.status(204).end(); // No Content
          return;
        }

        console.log(`[MediaServer] Extracting subtitles for: ${filePath}`);
        res.setHeader('Content-Type', 'text/vtt');

        const command = this.transcoder.extractSubtitles(filePath);
        command.pipe(res, { end: true });

        req.on('close', () => {
          command.kill('SIGKILL');
        });
      } catch (e) {
        console.error('[MediaServer] Subtitle extraction check failed:', e);
        res.status(500).send('Error checking subtitles');
      }
    });

    // 5. Network Proxy (SMB/DLNA)
    this.app.get('/proxy', async (req, res) => {
      const url = req.query.url as string;
      if (!url || !this.networkManager) {
        res.status(400).send('URL required or NetworkManager not init');
        return;
      }

      try {
        // Assume SMB for now if using proxy, or detect scheme
        // Typically DLNA gives HTTP URLs which renderer can play directly.
        // SMB needs proxy.
        // We pass the path relative to current SMB connection.

        const stream = await this.networkManager.getSMBStream(url);

        // Guess content type or use default
        res.setHeader('Content-Type', 'application/octet-stream');

        stream.pipe(res);

        stream.on('error', (err) => {
          console.error('[MediaServer] Proxy stream error:', err);
          if (!res.headersSent) res.status(500).end();
        });

        req.on('close', () => {
          // stream.destroy? Readable stream might not have destroy in all versions but usually yes.
          if (typeof (stream as any).destroy === 'function') {
            (stream as any).destroy();
          }
        });

      } catch (err) {
        console.error('[MediaServer] Proxy error:', err);
        res.status(500).send('Proxy failed');
      }
    });

    // 6. Thumbnails (resized for gallery performance)
    this.app.get('/thumbnail', async (req, res) => {
      const filePath = req.query.path as string;
      if (!filePath || !fs.existsSync(filePath)) {
        res.status(404).send('File not found');
        return;
      }

      const thumbDir = path.join(app.getPath('userData'), 'thumbnails');
      if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

      // Create stable hash for cache key
      const hash = crypto.createHash('md5').update(filePath).digest('hex');
      const thumbPath = path.join(thumbDir, `${hash}.jpg`);

      if (fs.existsSync(thumbPath)) {
        res.sendFile(thumbPath);
        return;
      }

      try {
        console.log(`[MediaServer] Generating thumbnail for: ${filePath}`);
        // Generate thumbnail using ffmpeg
        this.transcoder.createThumbnail(filePath)
          .on('end', () => {
            console.log(`[MediaServer] Thumbnail generated: ${thumbPath}`);
            if (!res.headersSent) res.sendFile(thumbPath);
          })
          .on('error', (err: Error) => {
            console.error(`[MediaServer] FFmpeg thumbnail error for ${filePath}:`, err.message);
            if (!res.headersSent) res.status(500).send('Failed to generate thumbnail');
          })
          .save(thumbPath);
      } catch (e: any) {
        console.error('[MediaServer] Thumbnail service exception:', e);
        res.status(500).send('Thumbnail service failed');
      }
    });

    // 7. App Logo
    this.app.get('/logo', (_req, res) => {
      const logoPath = app.isPackaged 
        ? path.join(process.resourcesPath, 'logo.png')
        : path.join(app.getAppPath(), 'public', 'images', 'logo.png');
      if (fs.existsSync(logoPath)) {
        res.sendFile(logoPath);
      } else {
        res.status(404).send('Logo not found');
      }
    });
  }

  async start(): Promise<string> {
    this.port = await getPort({ port: 3000 });

    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, '127.0.0.1', () => {
        const url = `http://127.0.0.1:${this.port}`;
        console.log(`[MediaServer] Running at ${url}`);
        resolve(url);
      });
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  getUrl(): string {
    return `http://127.0.0.1:${this.port}`;
  }

  async getMetadata(filePath: string) {
    return this.metadataService.getMetadata(filePath);
  }
}
