import { LETTERBOX } from '../render/FinisherCuts';

/** The feel pass: the cinema bars an ultimate is framed in (render/FinisherCuts.ts) - two thin ink bands,
 *  LETTERBOX of the frame each, over the game canvas and under the HUD: they go in ahead of everything else the page
 *  root holds, so every plate, card and number paints over them (they used to sit over the HUD and cut the top of the
 *  health plates). Sized each frame from how far in FinisherCuts' bars are, which eases them; nothing to click,
 *  nothing read aloud. ui/hud/host.ts reads a bar shown (`display: block`) as RoaN's cinema. */
export class Letterbox {
  private readonly top: HTMLDivElement;
  private readonly bottom: HTMLDivElement;
  private shown = -1;
  constructor(parent: HTMLElement) {
    const bar = (edge: 'top' | 'bottom') => {
      const el = document.createElement('div');
      el.className = `cine-bar cine-bar-${edge}`;
      el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, { position: 'fixed', left: '0', right: '0', [edge]: '0', height: `${(LETTERBOX * 100).toFixed(2)}vh`, zIndex: '0', pointerEvents: 'none',
        background: '#08070a', transformOrigin: edge === 'top' ? '50% 0' : '50% 100%', transform: 'scaleY(0)', willChange: 'transform', display: 'none' });
      parent.prepend(el);
      return el;
    };
    this.bottom = bar('bottom'); this.top = bar('top');
  }
  /** `amount` 0..1 of the bars' full height. */
  set(amount: number) {
    const a = Math.round(Math.max(0, Math.min(1, amount)) * 1000) / 1000;
    if (a === this.shown) return;
    this.shown = a;
    for (const el of [this.top, this.bottom]) { el.style.transform = `scaleY(${a})`; el.style.display = a > 0 ? 'block' : 'none'; }
  }
}
