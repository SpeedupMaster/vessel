import gsap from 'gsap';

// UI tweens should catch up after a stalled frame (backgrounded tab) rather than resume slowly.
gsap.ticker.lagSmoothing(0);

export const EASE_OUT = 'expo.out';
export const EASE_SPRING = 'back.out(1.4)';

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const SPOTLIGHT_SELECTOR = 'a.card-vessel, button.card-vessel, .card-vessel.cursor-pointer, .card-interactive';

/**
 * Tracks the pointer over interactive cards and exposes its position as --mx / --my,
 * which the card ::before spotlight in globals.css reads. One delegated listener for the whole app.
 */
export function installSpotlight(): () => void {
  if (typeof window === 'undefined' || !window.matchMedia('(hover: hover)').matches) return () => {};

  let frame = 0;
  let pending: { el: HTMLElement; x: number; y: number } | null = null;

  const flush = () => {
    frame = 0;
    if (!pending) return;
    const { el, x, y } = pending;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${x - rect.left}px`);
    el.style.setProperty('--my', `${y - rect.top}px`);
    pending = null;
  };

  const onMove = (e: PointerEvent) => {
    const el = (e.target as Element | null)?.closest?.(SPOTLIGHT_SELECTOR) as HTMLElement | null;
    if (!el) return;
    pending = { el, x: e.clientX, y: e.clientY };
    if (!frame) frame = requestAnimationFrame(flush);
  };

  document.addEventListener('pointermove', onMove, { passive: true });
  return () => {
    document.removeEventListener('pointermove', onMove);
    if (frame) cancelAnimationFrame(frame);
  };
}

/**
 * Staggered entrance for a view: the view root's direct children rise and un-blur in sequence.
 * Inline styles are cleared on completion so no lingering transform creates a containing block
 * for position:fixed overlays rendered inside the view.
 */
export function revealView(container: HTMLElement | null): gsap.core.Timeline | null {
  if (!container) return null;
  if (prefersReducedMotion()) return null;

  const root = container.lastElementChild as HTMLElement | null;
  const sections = root ? Array.from(root.children).slice(0, 10) : [];
  const targets = sections.length > 0 ? sections : [container];

  const tl = gsap.timeline();
  tl.fromTo(
    targets,
    { opacity: 0, y: 14, filter: 'blur(4px)' },
    {
      opacity: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 0.55,
      ease: EASE_OUT,
      stagger: 0.05,
      clearProps: 'opacity,transform,filter',
    }
  );
  return tl;
}
