import type { LoadedImage } from '../image/loader';
import type { DepthResult } from '../image/depth';
import { sampleDepth } from '../image/depth';

// Dark → light luminance ramp.
const RAMP = " .'`^,:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

export interface AsciiOptions {
  /** Pixel width of each character cell (also sets font size). */
  cell: number;
  /** Aspect ratio of cell height / cell width (monospace ~1.9). */
  cellAspect: number;
  /** Tint color in hex (e.g. "#a1b2c3"). */
  tint: string;
}

export interface AsciiLayer {
  canvas: HTMLCanvasElement;
  /** Average depth bucket of this layer (0 far .. 1 near). */
  bucket: number;
}

export interface AsciiResult {
  /** Background-to-foreground ordered layers. */
  layers: AsciiLayer[];
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!m) return [255, 255, 255];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

function mixRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

export function renderAscii(
  img: LoadedImage,
  depth: DepthResult | null,
  viewportW: number,
  viewportH: number,
  opts: Partial<AsciiOptions> = {},
): AsciiResult {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cellW = opts.cell ?? 10;
  const cellAspect = opts.cellAspect ?? 1.9;
  const cellH = cellW * cellAspect;
  const cols = Math.ceil(viewportW / cellW);
  const rows = Math.ceil(viewportH / cellH);

  // Sample the image at one pixel per cell.
  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = cols;
  sampleCanvas.height = rows;
  const sctx = sampleCanvas.getContext('2d', { willReadFrequently: true })!;
  sctx.imageSmoothingEnabled = true;
  // Re-rasterize from original img (cover-fit already applied in loader).
  // We use the existing ImageData by putting it into a tmp canvas and scaling down.
  const tmp = document.createElement('canvas');
  tmp.width = img.width;
  tmp.height = img.height;
  tmp.getContext('2d')!.putImageData(img.data, 0, 0);
  sctx.drawImage(tmp, 0, 0, cols, rows);
  const px = sctx.getImageData(0, 0, cols, rows).data;

  // Build per-cell record: char, color, depth.
  const tintRgb = hexToRgb(opts.tint ?? '#ffffff');
  const NUM_BANDS = 3;

  // Three layer canvases at device pixel resolution.
  const layerCanvases: HTMLCanvasElement[] = [];
  const layerCtx: CanvasRenderingContext2D[] = [];
  for (let i = 0; i < NUM_BANDS; i++) {
    const c = document.createElement('canvas');
    c.width = Math.floor(viewportW * dpr);
    c.height = Math.floor(viewportH * dpr);
    c.style.width = viewportW + 'px';
    c.style.height = viewportH + 'px';
    const ctx = c.getContext('2d')!;
    ctx.scale(dpr, dpr);
    ctx.font = `${cellW * 1.5}px "JetBrains Mono", ui-monospace, monospace`;
    ctx.textBaseline = 'top';
    ctx.textAlign = 'left';
    layerCanvases.push(c);
    layerCtx.push(ctx);
  }

  const bucketSums = [0, 0, 0];
  const bucketCounts = [0, 0, 0];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = px[i];
      const g = px[i + 1];
      const b = px[i + 2];
      // Rec. 709 luminance
      const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
      const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(lum * (RAMP.length - 1)))];
      if (ch === ' ') continue;

      // Depth: sample at this cell's normalized coords. If no depth, fall back to luminance.
      let d = lum;
      if (depth) {
        d = sampleDepth(depth, (x + 0.5) / cols, (y + 0.5) / rows);
      }
      // Bucket: 0=bg(far), 1=mid, 2=fg(near)
      const band = d < 0.34 ? 0 : d < 0.66 ? 1 : 2;
      bucketSums[band] += d;
      bucketCounts[band]++;

      // Color: mix photo color with tint, modulated by depth (nearer = brighter).
      const photoRgb: [number, number, number] = [r, g, b];
      const mixT = 0.5; // half photo, half tint
      const base = mixRgb(photoRgb, tintRgb, mixT);
      const boost = 0.6 + d * 0.7; // 0.6..1.3
      const cr = Math.min(255, Math.round(base[0] * boost));
      const cg = Math.min(255, Math.round(base[1] * boost));
      const cb = Math.min(255, Math.round(base[2] * boost));

      const ctx = layerCtx[band];
      ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      ctx.fillText(ch, x * cellW, y * cellH);
    }
  }

  const layers: AsciiLayer[] = layerCanvases.map((canvas, i) => ({
    canvas,
    bucket: bucketCounts[i] > 0 ? bucketSums[i] / bucketCounts[i] : i / (NUM_BANDS - 1),
  }));

  return { layers, cols, rows, cellW, cellH };
}
