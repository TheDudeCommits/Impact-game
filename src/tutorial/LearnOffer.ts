import { firstVisit, LESSON_END, markTutorial } from './guidedFight';
import './tutorial.css';

/**
 * LEARN TO FIGHT on the home (HomeShell): a slip in the bottom bar, before PLAY. On a first visit (guidedFight.ts
 * `firstVisit`) it offers the lesson - ▶ LEARN TO FIGHT · 60 s, and SKIP, which keeps it away from then on (HOW TO PLAY
 * still offers it). After the lesson is finished it says YOU'RE READY and marks PLAY, until PLAY is pressed.
 *
 * Not offered to an automated browser (the smokes and capture tools photograph the home as players have it), unless
 * the address asks with `?learn`.
 */
export class LearnOffer {
  readonly node = document.createElement('div');
  private ready = false;
  private play?: HTMLElement;
  constructor(root: HTMLElement, private readonly start: () => void) {
    this.node.className = 'learn-offer';
    this.node.hidden = true;
    this.node.addEventListener('click', event => {
      const b = (event.target as HTMLElement).closest<HTMLElement>('[data-learn]');
      if (b?.dataset.learn === 'go') this.start();
      else if (b?.dataset.learn === 'skip') { markTutorial('skipped'); this.refresh(); this.play?.focus({ preventScroll: true }); }
    });
    root.addEventListener(LESSON_END, event => { this.ready = !!(event as CustomEvent<{ done: boolean }>).detail?.done; this.refresh(); });
  }
  /** In the home's bottom bar, just before PLAY. PLAY pressed puts YOU'RE READY away. */
  mount(play: HTMLElement) {
    this.play = play;
    play.before(this.node);
    play.addEventListener('click', () => { if (this.ready) { this.ready = false; this.refresh(); } });
  }
  private get due() {
    const automated = typeof navigator === 'object' && navigator.webdriver;
    return firstVisit() && (!automated || new URLSearchParams(location.search).has('learn'));
  }
  /** As the home comes back (HomeShell.refresh). */
  refresh() {
    this.play?.classList.toggle('learn-ready', this.ready);
    if (this.ready) {
      this.show('ready', `<b>YOU'RE READY ›</b>`);
    } else if (this.due) {
      this.show('offer', `<span>NEW HERE?</span><button type="button" data-learn="go"><i aria-hidden="true">▶</i> LEARN TO FIGHT · 60 s</button><button type="button" data-learn="skip" aria-label="Skip the lesson">SKIP</button>`);
    } else if (!this.node.hidden) { this.node.hidden = true; this.node.replaceChildren(); delete this.node.dataset.kind; }
  }
  private show(kind: 'offer' | 'ready', html: string) {
    if (this.node.dataset.kind === kind && !this.node.hidden) return;
    this.node.dataset.kind = kind; this.node.innerHTML = html; this.node.hidden = false;
  }
}
