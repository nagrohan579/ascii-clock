// Single split-flap digit. Top half flips down (0 -> -90deg) revealing new top behind it,
// then bottom flipper flips down (90 -> 0deg) showing the new bottom.

import { gsap } from 'gsap';

export class Flap {
  readonly el: HTMLDivElement;
  private current = '';
  private staticTop: HTMLDivElement;
  private staticBottom: HTMLDivElement;
  private flipperTop: HTMLDivElement;
  private flipperBottom: HTMLDivElement;
  private animating = false;

  constructor(initial = '0') {
    this.el = document.createElement('div');
    this.el.className = 'flap';

    // Static halves show the *new* digit, hidden behind the flippers.
    this.staticTop = mkHalf('top');
    this.staticBottom = mkHalf('bottom');

    // Flippers show the *current* digit and rotate.
    this.flipperTop = document.createElement('div');
    this.flipperTop.className = 'flipper top';
    this.flipperTop.appendChild(mkHalf('top'));

    this.flipperBottom = document.createElement('div');
    this.flipperBottom.className = 'flipper bottom';
    this.flipperBottom.appendChild(mkHalf('bottom'));
    gsap.set(this.flipperBottom, { rotationX: 90 });

    this.el.append(this.staticTop, this.staticBottom, this.flipperTop, this.flipperBottom);
    this.set(initial, true);
  }

  /** Synchronously set the digit (no animation). */
  set(v: string, immediate = false): void {
    if (v === this.current && !immediate) return;
    if (immediate) {
      this.current = v;
      setText(this.staticTop, v);
      setText(this.staticBottom, v);
      setText(this.flipperTop.firstElementChild as HTMLElement, v);
      setText(this.flipperBottom.firstElementChild as HTMLElement, v);
      gsap.set(this.flipperTop, { rotationX: 0 });
      gsap.set(this.flipperBottom, { rotationX: 90 });
      return;
    }
    this.flipTo(v);
  }

  private async flipTo(next: string): Promise<void> {
    if (this.animating) {
      // queue: snap and continue
      this.set(next, true);
      return;
    }
    this.animating = true;
    const prev = this.current;
    this.current = next;

    // New digit shows on static halves (revealed as flippers move).
    setText(this.staticTop, next);
    setText(this.staticBottom, next);
    // Bottom flipper still shows previous (it's hidden behind staticBottom).
    setText(this.flipperBottom.firstElementChild as HTMLElement, next);
    // Top flipper shows the *old* digit as it rotates down.
    setText(this.flipperTop.firstElementChild as HTMLElement, prev);

    const tl = gsap.timeline({
      onComplete: () => {
        // Reset for next cycle.
        gsap.set(this.flipperTop, { rotationX: 0 });
        gsap.set(this.flipperBottom, { rotationX: 90 });
        setText(this.flipperTop.firstElementChild as HTMLElement, next);
        this.animating = false;
      },
    });
    tl.to(this.flipperTop, { rotationX: -90, duration: 0.18, ease: 'power2.in' });
    tl.to(this.flipperBottom, { rotationX: 0, duration: 0.18, ease: 'power2.out' });
  }
}

function mkHalf(side: 'top' | 'bottom'): HTMLDivElement {
  const h = document.createElement('div');
  h.className = `half ${side}`;
  const s = document.createElement('span');
  s.textContent = '0';
  h.appendChild(s);
  return h;
}

function setText(half: HTMLElement, v: string): void {
  const s = half.querySelector('span');
  if (s) s.textContent = v;
}
