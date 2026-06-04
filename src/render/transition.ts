import { gsap } from 'gsap';

export interface AsciiSceneNodes {
  /** Wrapper that holds three .ascii-layer children (bg, mid, fg). */
  wrap: HTMLElement;
}

/** Crossfade two scenes with a Ken Burns zoom on the outgoing one. */
export function crossfade(
  outgoing: HTMLElement | null,
  incoming: HTMLElement,
  duration = 1.4,
): Promise<void> {
  return new Promise((resolve) => {
    gsap.set(incoming, { opacity: 0, scale: 1.04 });

    const tl = gsap.timeline({ onComplete: () => resolve() });
    if (outgoing) {
      tl.to(
        outgoing,
        { opacity: 0, scale: 1.12, filter: 'blur(8px)', duration, ease: 'power2.inOut' },
        0,
      );
    }
    tl.to(
      incoming,
      { opacity: 1, scale: 1, filter: 'blur(0px)', duration, ease: 'power2.inOut' },
      outgoing ? 0.15 : 0,
    );
  });
}

/** Slow ambient Ken Burns drift applied for the lifetime of the element. */
export function kenBurns(el: HTMLElement): gsap.core.Tween {
  const dir = Math.random() > 0.5 ? 1 : -1;
  return gsap.fromTo(
    el,
    { transformOrigin: `${50 + dir * 10}% ${50 - dir * 8}%`, scale: 1.0 },
    { scale: 1.08, duration: 40, ease: 'none', repeat: -1, yoyo: true },
  );
}
