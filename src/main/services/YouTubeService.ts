import { YtDlp } from 'ytdlp-nodejs';
import { DownloadService } from './DownloadService';
import fs from 'fs';

export interface YouTubeSearchResult {
    id: string;
    title: string;
    thumbnail: string;
    duration: number;
    channel: string;
    url: string;
}

export class YouTubeService {
    private ytdlp: YtDlp | null = null;

    constructor(private downloadService: DownloadService) { }

    async init() {
        const binPath = this.downloadService.getYtDlpPath();
        if (fs.existsSync(binPath)) {
            this.ytdlp = new YtDlp({ binaryPath: binPath });
        }
    }

    async search(query: string, limit = 15): Promise<YouTubeSearchResult[]> {
        if (!this.ytdlp) await this.init();
        if (!this.ytdlp) throw new Error("yt-dlp not initialized");

        try {
            const info = await this.ytdlp.getInfoAsync(`ytsearch${limit}:${query}`, {
                dumpSingleJson: true,
                flatPlaylist: true
            } as never) as any;

            if (info && info.entries) {
                return info.entries.map((entry: any) => ({
                    id: entry.id,
                    title: entry.title,
                    thumbnail: entry.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`,
                    duration: entry.duration || 0,
                    channel: entry.uploader || entry.channel || 'Unknown',
                    url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`
                }));
            }
            return [];
        } catch (err) {
            console.error("[YouTubeService] Search error:", err);
            return [];
        }
    }
}
