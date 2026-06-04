import { createApi } from 'unsplash-js';

export interface Photo {
  id: string;
  url: string; // sized URL
  width: number;
  height: number;
  color: string; // hex like '#a1b2c3'
  blurHash: string | null;
  author: { name: string; link: string };
  link: string; // photo page
  downloadLocation: string; // trigger this on use (per Unsplash API guidelines)
}

const KEY = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;

const QUERIES = [
  'mountain landscape',
  'foggy forest',
  'neon city night',
  'brutalist architecture',
  'ocean waves',
  'desert dunes',
  'snowy peaks',
  'cyberpunk street',
  'minimal portrait',
  'abstract texture',
];

function pickQuery(): string {
  return QUERIES[Math.floor(Math.random() * QUERIES.length)];
}

function sizedUrl(raw: string, width: number): string {
  // Imgix params: clamp width, auto format, decent quality.
  const sep = raw.includes('?') ? '&' : '?';
  return `${raw}${sep}w=${width}&q=80&fit=max&auto=format`;
}

export class UnsplashSource {
  private api = KEY ? createApi({ accessKey: KEY }) : null;
  private queue: Photo[] = [];
  private inflight: Promise<void> | null = null;

  hasKey(): boolean {
    return Boolean(KEY);
  }

  async next(targetWidth: number): Promise<Photo | null> {
    if (!this.api) return null;
    if (this.queue.length < 2) {
      await this.refill(targetWidth);
    }
    const p = this.queue.shift() ?? null;
    // prefetch in background if running low
    if (this.queue.length < 2) {
      this.refill(targetWidth).catch(() => {});
    }
    return p;
  }

  private async refill(targetWidth: number): Promise<void> {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      try {
        const res = await this.api!.photos.getRandom({
          orientation: 'landscape',
          count: 5,
          query: pickQuery(),
          contentFilter: 'high',
        });
        if (res.errors) {
          console.warn('Unsplash error:', res.errors);
          return;
        }
        const raw = res.response;
        const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
        for (const p of list) {
          this.queue.push({
            id: p.id,
            url: sizedUrl(p.urls.raw, targetWidth),
            width: p.width,
            height: p.height,
            color: p.color ?? '#888',
            blurHash: p.blur_hash ?? null,
            author: {
              name: p.user.name,
              link: `${p.user.links.html}?utm_source=ascii-clock&utm_medium=referral`,
            },
            link: `${p.links.html}?utm_source=ascii-clock&utm_medium=referral`,
            downloadLocation: p.links.download_location,
          });
        }
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  /** Per Unsplash API guidelines: ping download endpoint when a photo is used. */
  async trackDownload(photo: Photo): Promise<void> {
    if (!this.api) return;
    try {
      await this.api.photos.trackDownload({ downloadLocation: photo.downloadLocation });
    } catch {
      /* non-fatal */
    }
  }
}
