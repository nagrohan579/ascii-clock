// Parallax driver: smooth-follow mouse + slow auto-drift, applies per-layer transforms.

export interface ParallaxLayer {
  el: HTMLElement;
  /** 0..1: 0 = static (background), 1 = strongest (foreground). */
  strength: number;
  /** Z-depth in px for perspective separation. */
  z: number;
}

export class Parallax {
  private layers: ParallaxLayer[] = [];
  private targetX = 0;
  private targetY = 0;
  private curX = 0;
  private curY = 0;
  private driftT = 0;
  private enabled = true;
  private rafId = 0;
  private reducedMotion: boolean;

  constructor() {
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.addEventListener('mousemove', this.onMouse);
    window.addEventListener('deviceorientation', this.onTilt as EventListener);
    this.loop();
  }

  setLayers(layers: ParallaxLayer[]): void {
    this.layers = layers;
  }

  toggle(): void {
    this.enabled = !this.enabled;
    if (!this.enabled) {
      for (const l of this.layers) l.el.style.transform = `translateZ(${l.z}px)`;
    }
  }

  destroy(): void {
    cancelAnimationFrame(this.rafId);
    window.removeEventListener('mousemove', this.onMouse);
    window.removeEventListener('deviceorientation', this.onTilt as EventListener);
  }

  private onMouse = (e: MouseEvent): void => {
    this.targetX = (e.clientX / window.innerWidth - 0.5) * 2;
    this.targetY = (e.clientY / window.innerHeight - 0.5) * 2;
  };

  private onTilt = (e: DeviceOrientationEvent): void => {
    if (e.gamma == null || e.beta == null) return;
    this.targetX = Math.max(-1, Math.min(1, e.gamma / 30));
    this.targetY = Math.max(-1, Math.min(1, e.beta / 30));
  };

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    if (!this.enabled || this.reducedMotion) return;

    // Auto-drift: slow lissajous
    this.driftT += 0.003;
    const driftX = Math.sin(this.driftT) * 0.25;
    const driftY = Math.cos(this.driftT * 0.7) * 0.18;

    const tx = this.targetX * 0.7 + driftX;
    const ty = this.targetY * 0.7 + driftY;

    // Lerp
    this.curX += (tx - this.curX) * 0.06;
    this.curY += (ty - this.curY) * 0.06;

    for (const l of this.layers) {
      const dx = -this.curX * 28 * l.strength;
      const dy = -this.curY * 18 * l.strength;
      l.el.style.transform = `translate3d(${dx}px, ${dy}px, ${l.z}px) scale(${1 + l.strength * 0.04})`;
    }
  };
}
