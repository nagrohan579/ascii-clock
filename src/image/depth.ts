// Depth estimation via Depth Anything (Xenova) using transformers.js.
// Loaded from CDN at runtime (avoids large npm install).
// Runs entirely in-browser. WebGPU preferred; falls back to WASM.

// CDN URL for the ESM build of transformers.js v3.
const TRANSFORMERS_CDN =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5/dist/transformers.min.js';

let pipePromise: Promise<any> | null = null;

export interface DepthResult {
  /** Float32 normalized 0..1 depth values (0 = far, 1 = near). */
  data: Float32Array;
  width: number;
  height: number;
}

export async function initDepth(onProgress?: (msg: string) => void): Promise<any> {
  if (pipePromise) return pipePromise;

  pipePromise = (async () => {
    onProgress?.('Fetching depth runtime…');
    const mod: any = await import(/* @vite-ignore */ TRANSFORMERS_CDN);
    const { pipeline, env } = mod;
    env.allowLocalModels = false;

    const device = (await hasWebGPU()) ? 'webgpu' : 'wasm';
    onProgress?.(`Loading depth model (${device})…`);

    const pipe = await pipeline('depth-estimation', 'Xenova/depth-anything-small-hf', {
      device,
      dtype: device === 'webgpu' ? 'fp16' : 'q8',
      progress_callback: (p: any) => {
        if (p && p.status === 'progress' && typeof p.progress === 'number') {
          onProgress?.(`Model ${p.file ?? ''} ${Math.round(p.progress)}%`);
        }
      },
    });
    onProgress?.('Depth model ready');
    return pipe;
  })();
  return pipePromise;
}

async function hasWebGPU(): Promise<boolean> {
  // @ts-expect-error - navigator.gpu may not be typed in older lib versions
  const gpu = navigator.gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

/** Run depth estimation. Returns a normalized 0..1 map sized depthW x depthH. */
export async function estimateDepth(
  img: HTMLImageElement,
  onProgress?: (msg: string) => void,
): Promise<DepthResult> {
  const pipe = await initDepth(onProgress);
  // transformers.js accepts URLs, HTMLImageElement, or RawImage.
  const out: any = await pipe(img as any);
  // out: { predicted_depth: Tensor, depth: RawImage }
  const raw = out.depth; // RawImage; channels=1, .data Uint8ClampedArray, width, height
  const w: number = raw.width;
  const h: number = raw.height;
  const bytes: Uint8ClampedArray = raw.data;
  const channels: number = raw.channels ?? 1;
  // Convert to Float32 0..1 (already 0..255 from RawImage).
  const data = new Float32Array(w * h);
  if (channels === 1) {
    for (let i = 0; i < data.length; i++) data[i] = bytes[i] / 255;
  } else {
    for (let i = 0, p = 0; i < data.length; i++, p += channels) {
      data[i] = bytes[p] / 255;
    }
  }
  return { data, width: w, height: h };
}

/** Bilinear sample of a depth map at normalized [0..1] coords. */
export function sampleDepth(map: DepthResult, u: number, v: number): number {
  const x = Math.max(0, Math.min(map.width - 1, u * (map.width - 1)));
  const y = Math.max(0, Math.min(map.height - 1, v * (map.height - 1)));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(map.width - 1, x0 + 1);
  const y1 = Math.min(map.height - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const a = map.data[y0 * map.width + x0];
  const b = map.data[y0 * map.width + x1];
  const c = map.data[y1 * map.width + x0];
  const d = map.data[y1 * map.width + x1];
  return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
}
