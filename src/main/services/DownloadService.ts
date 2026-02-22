import { YtDlp, helpers } from 'ytdlp-nodejs';
import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { path as ffprobeStaticPath } from 'ffprobe-static';
import { DownloadRequest, JobProgress } from '../../shared/types/media';
import { MediaMetadataService } from './MediaMetadata';

export class DownloadService {
  private ytdlp: YtDlp | null = null;
  private activeJobs: Map<string, { cancel: () => void }> = new Map();
  private binPath: string;
  private metadataService: MediaMetadataService | null = null;

  constructor() {
    this.binPath = path.join(app.getPath('userData'), 'bin');
    if (!fs.existsSync(this.binPath)) {
      fs.mkdirSync(this.binPath, { recursive: true });
    }
  }

  getFFmpegPath(): string {
    const fileName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    return path.join(this.binPath, fileName);
  }

  getFFprobePath(): string {
    const fileName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    const customPath = path.join(this.binPath, fileName);

    if (fs.existsSync(customPath)) return customPath;

    const probePath = ffprobeStaticPath;

    // Vite + Electron Forge sometimes incorrectly resolves node_modules paths 
    // to build-time locations that don't exist in dev. 
    // If the path looks like it's in .vite/build/ and doesn't exist, we try to fix it.
    if (probePath && probePath.includes('.vite/build') && !fs.existsSync(probePath)) {
      const parts = probePath.split('.vite/build');
      const possibleDevPath = path.join(app.getAppPath(), 'node_modules', 'ffprobe-static', parts[1]);
      if (fs.existsSync(possibleDevPath)) {
        console.log('[DownloadService] Fixed ffprobe path from build to dev:', possibleDevPath);
        return possibleDevPath;
      }
    }

    return probePath || '';
  }

  getYtDlpPath(): string {
    const fileName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
    return path.join(this.binPath, fileName);
  }

  /** Returns true if the binary at the given path can run without crashing. */
  private validateBinary(binPath: string): Promise<boolean> {
    if (!fs.existsSync(binPath)) return Promise.resolve(false);
    return new Promise(resolve => {
      execFile(binPath, ['-version'], { timeout: 5000 }, (err) => {
        if (!err) { resolve(true); return; }
        // SIGSEGV crashes will have `signal` set on the error object
        const asAny = err as { signal?: string; code?: string | number };
        resolve(!asAny.signal);
      });
    });
  }

  async init(): Promise<void> {
    try {
      const ffmpegFileName = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
      const ffprobeFileName = process.platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
      const ytDlpFileName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';

      const ffmpegPath = path.join(this.binPath, ffmpegFileName);
      const ffprobePath = path.join(this.binPath, ffprobeFileName);
      const ytDlpPath = path.join(this.binPath, ytDlpFileName);

      if (!fs.existsSync(ytDlpPath)) {
        try {
          await helpers.downloadYtDlp(this.binPath);
        } catch (err) {
          console.error('[DownloadService] Failed to download yt-dlp:', err);
        }
      }

      if (!fs.existsSync(ffmpegPath)) {
        try {
          await helpers.downloadFFmpeg(this.binPath);
        } catch (err) {
          console.error('[DownloadService] Failed to download ffmpeg:', err);
        }
      }

      // Ensure all binaries are executable (critical when userData dir changes)
      if (process.platform !== 'win32') {
        for (const binFile of [ffmpegPath, ffprobePath, ytDlpPath]) {
          if (fs.existsSync(binFile)) {
            try {
              fs.chmodSync(binFile, 0o755);
            } catch (e) {
              console.warn(`[DownloadService] Could not chmod ${binFile}:`, e);
            }
          }
        }
      }

      // Validate the downloaded ffprobe before using it - it can crash with
      // SIGSEGV if the binary is incompatible with the OS. If validation fails,
      // getFFprobePath() will automatically fall back to ffprobe-static.
      if (fs.existsSync(ffprobePath)) {
        const probeOk = await this.validateBinary(ffprobePath);
        if (!probeOk) {
          console.warn('[DownloadService] Downloaded ffprobe is broken — deleting and using ffprobe-static fallback.');
          try { fs.unlinkSync(ffprobePath); } catch (e) { /* ignore */ }
        }
      }

      if (fs.existsSync(ytDlpPath)) {
        const ffPath = fs.existsSync(ffmpegPath) ? ffmpegPath : undefined;
        this.ytdlp = new YtDlp({
          binaryPath: ytDlpPath,
          ffmpegPath: ffPath
        });

        // Use the resolved path (may be ffprobe-static fallback if the download was broken)
        const resolvedProbe = this.getFFprobePath();
        this.metadataService = new MediaMetadataService(resolvedProbe || undefined);
      }
    } catch (error) {
      console.error('[DownloadService] Unexpected error during init:', error);
    }
  }

  private downloadQueue: Promise<void> = Promise.resolve();

  async start(
    jobId: string,
    request: DownloadRequest,
    onProgress: (progress: Partial<JobProgress>) => void
  ): Promise<void> {
    this.downloadQueue = this.downloadQueue.then(async () => {
      if (!this.ytdlp) {
        await this.init();
      }

      onProgress({
        status: 'running',
        progress: 1,
        message: 'Analyzing...',
        title: 'New Download'
      });

      try {
        let finalPath = request.outputPath;
        let displayTitle = '';

        let cleanedUrl = request.url;
        try {
          const urlObj = new URL(request.url);
          if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
            urlObj.searchParams.delete('list');
            urlObj.searchParams.delete('index');
            cleanedUrl = urlObj.toString();
          }
        } catch (e) { /* ignore */ }

        // Define interface for yt-dlp info response
        interface YtdlpInfo {
          _type?: string;
          title: string;
          ext?: string;
          entries?: Array<{ title: string }>;
        }

        try {
          const info = await (this.ytdlp as YtDlp).getInfoAsync(cleanedUrl, { noPlaylist: true } as never) as YtdlpInfo;

          let rawTitle = '';
          if (info._type === 'playlist' && info.entries && info.entries[0]) {
            rawTitle = info.entries[0].title;
          } else {
            rawTitle = info.title;
          }

          if (rawTitle) {
            displayTitle = rawTitle.replace(/^Mix\s*-\s*/i, '').trim();
            const ext = request.format === 'audio' ? 'mp3' : (info.ext || 'webm');

            const safeName = displayTitle
              .replace(/[\\/:*?"<>|]/g, '')
              .replace(/\s+/g, ' ')
              .trim();

            finalPath = path.join(path.dirname(request.outputPath), `${safeName}.${ext}`);

            onProgress({
              title: displayTitle,
              progress: 5,
              message: `Queuing: ${displayTitle}`
            });
            console.log(`[DownloadService] Starting: "${displayTitle}"`);
          }
        } catch (e) {
          console.warn('[DownloadService] Info fetch failed:', e);
        }

        if (!displayTitle) {
          displayTitle = path.basename(finalPath).replace(/\.%(ext)s$/, '').replace(/%/g, '') || 'Downloaded Video';
          onProgress({ title: displayTitle, progress: 10 });
        }

        if (fs.existsSync(finalPath)) {
          onProgress({
            status: 'completed',
            progress: 100,
            message: 'Already exists',
            title: displayTitle,
            outputFile: finalPath
          });
          return;
        }

        await (this.ytdlp as YtDlp).downloadAsync(cleanedUrl, {
          output: finalPath,
          format: request.format === 'audio' ? 'bestaudio/best' : 'bestvideo+bestaudio/best',
          noPlaylist: true,
          onProgress: (progress) => {
            const percentage = Math.round(progress.percentage);
            if (!isNaN(percentage)) {
              onProgress({
                status: 'running',
                progress: Math.max(10, percentage),
                message: percentage === 100 ? 'Finishing up...' : `Downloading... ${percentage}%`,
                title: displayTitle
              });
            }
          }
        });

        // RESOLVE ACTUAL PATH: The logOutput is a string of the full terminal log.
        // We need to verify if finalPath exists, or if yt-dlp merged it into a different extension.
        let actualPath = finalPath;

        if (!fs.existsSync(actualPath)) {
          const dir = path.dirname(finalPath);
          const baseName = path.basename(finalPath, path.extname(finalPath));
          if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir);
            const match = files.find(f => f.startsWith(baseName));
            if (match) {
              actualPath = path.join(dir, match);
            }
          }
        }

        // Final Title Check: Minimal logging
        if (this.metadataService && fs.existsSync(actualPath)) {
          try {
            const meta = await this.metadataService.getMetadata(actualPath);
            if (!displayTitle && meta.tags && meta.tags.title) {
              displayTitle = meta.tags.title.replace(/^Mix\s*-\s*/i, '').trim();
            }
          } catch (e) { /* ignore */ }
        }

        onProgress({
          status: 'completed',
          progress: 100,
          message: 'Success',
          title: displayTitle,
          outputFile: actualPath
        });
      } catch (err: unknown) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (error.message && error.message.includes('signal: SIGKILL')) return;
        console.error(`Download job ${jobId} failed:`, error);
        onProgress({ status: 'failed', message: error.message });
        throw error;
      } finally {
        this.activeJobs.delete(jobId);
      }
    });

    return this.downloadQueue;
  }

  cancel(jobId: string) {
    console.warn(`Cancellation requested for ${jobId}.`);
  }
}
