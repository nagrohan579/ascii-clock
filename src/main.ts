import { UnsplashSource, type Photo } from './image/unsplash';
import { loadImage, rasterize } from './image/loader';
import { estimateDepth, type DepthResult } from './image/depth';
import { renderAscii, type AsciiResult } from './render/ascii';
import { Parallax } from './render/parallax';
import { crossfade, kenBurns } from './render/transition';
import { Clock } from './clock/Clock';

const $ = <T extends HTMLElement>(s: string) => document.querySelector(s) as T;

const statusEl = $('#status');
const layersHost = $('#ascii-layers');
const clockHost = $('#clock');
const creditEl = $('#credit');
const hintEl = $('#hint');

const setStatus = (msg: string | null) => {
  if (!msg) {
    statusEl.classList.add('hidden');
    return;
  }
  statusEl.textContent = msg;
  statusEl.classList.remove('hidden');
};

const source = new UnsplashSource();
const parallax = new Parallax();
const clock = new Clock(clockHost);

let currentScene: HTMLElement | null = null;
let cycleTimer: number | null = null;
let paused = false;
let depthEnabled = true;

const CYCLE_MS = 120_000; // 2 min per image; with count:5 = 1 API request every 10 min (~6/hr, well under 50/hr demo limit)
const ASCII_CELL = 10; // px

// ---------------- bootstrap ----------------
async function boot(): Promise<void> {
  clock.start();

  if (!source.hasKey()) {
    setStatus('Missing VITE_UNSPLASH_ACCESS_KEY in .env.local — using fallback gradient.');
    await renderFallback();
    return;
  }

  setStatus('Loading first image…');
  await nextImage();
  setStatus(null);
  scheduleCycle();
}

function scheduleCycle(): void {
  if (cycleTimer != null) clearTimeout(cycleTimer);
  cycleTimer = window.setTimeout(async () => {
    if (!paused) {
      try {
        await nextImage();
      } catch (e) {
        console.warn('cycle error', e);
      }
    }
    scheduleCycle();
  }, CYCLE_MS);
}

async function nextImage(): Promise<void> {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const target = Math.min(1920, Math.max(1280, w));

  const photo = await source.next(target);
  if (!photo) return;
  source.trackDownload(photo).catch(() => {});

  // 1. Load full image element
  const img = await loadImage(photo.url);

  // 2. Compute depth in parallel with rasterize
  const rasterized = rasterize(img, 800, Math.round((800 * h) / w));
  let depth: DepthResult | null = null;
  if (depthEnabled) {
    try {
      depth = await estimateDepth(img, (msg) => setStatus(msg));
      setStatus(null);
    } catch (e) {
      console.warn('depth failed, continuing without', e);
      depth = null;
    }
  }

  // 3. Render ASCII
  const ascii = renderAscii(rasterized, depth, w, h, {
    cell: ASCII_CELL,
    cellAspect: 1.9,
    tint: photo.color,
  });

  // 4. Build scene DOM
  const scene = buildScene(ascii);
  layersHost.appendChild(scene);
  kenBurns(scene);

  // 5. Wire parallax layers
  const layerEls = Array.from(scene.querySelectorAll<HTMLElement>('.ascii-layer'));
  parallax.setLayers([
    { el: layerEls[0], strength: 0.1, z: -120 },
    { el: layerEls[1], strength: 0.45, z: -20 },
    { el: layerEls[2], strength: 1.0, z: 80 },
  ]);

  // 6. Crossfade
  const oldScene = currentScene;
  currentScene = scene;
  await crossfade(oldScene, scene);
  if (oldScene) oldScene.remove();

  // 7. Credit
  showCredit(photo);
}

function buildScene(ascii: AsciiResult): HTMLDivElement {
  const wrap = document.createElement('div');
  wrap.className = 'kb';
  wrap.style.transformStyle = 'preserve-3d';

  const classes = ['bg', 'mid', 'fg'];
  ascii.layers.forEach((layer, i) => {
    const div = document.createElement('div');
    div.className = `ascii-layer ${classes[i] ?? 'mid'}`;
    div.appendChild(layer.canvas);
    if (i === 2) {
      // Foreground chroma duplicates
      const r = layer.canvas.cloneNode(true) as HTMLCanvasElement;
      r.className = 'chroma-r';
      copyCanvas(layer.canvas, r);
      const b = layer.canvas.cloneNode(true) as HTMLCanvasElement;
      b.className = 'chroma-b';
      copyCanvas(layer.canvas, b);
      div.prepend(r, b);
    }
    wrap.appendChild(div);
  });
  return wrap;
}

function copyCanvas(src: HTMLCanvasElement, dst: HTMLCanvasElement): void {
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d')!;
  ctx.drawImage(src, 0, 0);
}

function showCredit(photo: Photo): void {
  creditEl.innerHTML = `Photo by <a href="${photo.author.link}" target="_blank" rel="noopener">${escape(photo.author.name)}</a> on <a href="https://unsplash.com/?utm_source=ascii-clock&utm_medium=referral" target="_blank" rel="noopener">Unsplash</a>`;
  creditEl.classList.add('show');
  window.clearTimeout((showCredit as any)._t);
  (showCredit as any)._t = window.setTimeout(() => creditEl.classList.remove('show'), 6000);
}

function escape(s: string): string {
  return s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]!));
}

async function renderFallback(): Promise<void> {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const c = document.createElement('canvas');
  c.width = 800;
  c.height = Math.round((800 * h) / w);
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, c.width, c.height);
  g.addColorStop(0, '#1a1c30');
  g.addColorStop(0.5, '#3a2a5a');
  g.addColorStop(1, '#0a0a12');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, c.width, c.height);
  // sprinkle some bright spots
  for (let i = 0; i < 200; i++) {
    ctx.fillStyle = `rgba(255,210,122,${Math.random() * 0.6})`;
    ctx.beginPath();
    ctx.arc(Math.random() * c.width, Math.random() * c.height, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const ascii = renderAscii(
    { image: new Image(), data, width: c.width, height: c.height },
    null,
    w,
    h,
    { cell: ASCII_CELL, cellAspect: 1.9, tint: '#ffd27a' },
  );
  const scene = buildScene(ascii);
  layersHost.appendChild(scene);
  kenBurns(scene);
  const layerEls = Array.from(scene.querySelectorAll<HTMLElement>('.ascii-layer'));
  parallax.setLayers([
    { el: layerEls[0], strength: 0.1, z: -120 },
    { el: layerEls[1], strength: 0.45, z: -20 },
    { el: layerEls[2], strength: 1.0, z: 80 },
  ]);
  await crossfade(null, scene);
  currentScene = scene;
}

// ---------------- hotkeys ----------------
window.addEventListener('keydown', (e) => {
  if (e.key === 'f' || e.key === 'F') {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  } else if (e.key === 'n' || e.key === 'N') {
    nextImage().catch(console.warn);
  } else if (e.key === 'h' || e.key === 'H') {
    clockHost.classList.toggle('hidden');
  } else if (e.key === 'd' || e.key === 'D') {
    depthEnabled = !depthEnabled;
    parallax.toggle();
    setStatus(`Depth ${depthEnabled ? 'on' : 'off'}`);
    setTimeout(() => setStatus(null), 1200);
  } else if (e.key === ' ') {
    paused = !paused;
    setStatus(paused ? 'Paused' : 'Resumed');
    setTimeout(() => setStatus(null), 1200);
    e.preventDefault();
  }
});

// ---------------- idle cursor hide ----------------
let idleT: number | null = null;
const resetIdle = () => {
  document.body.classList.remove('idle');
  if (idleT != null) clearTimeout(idleT);
  idleT = window.setTimeout(() => document.body.classList.add('idle'), 3000);
};
window.addEventListener('mousemove', resetIdle);
window.addEventListener('keydown', resetIdle);
resetIdle();

// Hide the hint after first 8 seconds.
setTimeout(() => (hintEl.style.opacity = '0'), 8000);

// Resize: re-render current image (debounced).
let resizeT: number | null = null;
window.addEventListener('resize', () => {
  if (resizeT != null) clearTimeout(resizeT);
  resizeT = window.setTimeout(() => nextImage().catch(() => {}), 400);
});

boot().catch((e) => {
  console.error(e);
  setStatus('Boot failed — see console.');
});
