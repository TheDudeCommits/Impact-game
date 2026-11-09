import { MODE_OF_HOME } from '../modes/catalogue';
import type { HomeMode } from '../MangaHome';
import { getBindings } from '../../input/bindings';
import { population, type PageWhere, type PopulationView, type QueueMode } from '../../social/population';
import './socialPlay.css';

const MODE_NAMES: Record<QueueMode, string> = { royale: 'BATTLE ROYALE', duel: 'DUEL', 'last-stand': 'LAST STAND', 'bad-blood': 'BAD BLOOD', 'rift-war': 'RIFT WAR', arcade: 'ARCADE SURVIVAL', 'goal-rush': 'GOAL RUSH', 'sky-spike': 'SKY SPIKE' };
/** A home card's mode, as the population counts it (Training is played on the device and counted by nobody). */
export function cardMode(card: string): QueueMode | undefined {
  const mode = MODE_OF_HOME[card as HomeMode]?.mode;
  return mode && mode !== 'training' ? mode as QueueMode : undefined;
}
/** A card's line: everyone playing the mode or queued for it. Empty when nobody is (an empty mode says nothing). */
export function cardLine(view: PopulationView | undefined, mode: QueueMode | undefined): string {
  if (!view || !mode) return '';
  const m = view.modes[mode];
  if (!m) return '';
  const n = m.queue + m.playing;
  return n ? `${n} PLAYING` : '';
}
/** The home's line: the people online, the page itself among them. */
export const onlineLine = (view: PopulationView | undefined) => view && view.online > 0 ? `${view.online.toLocaleString('en-US')} ONLINE` : '';
/** The waiting dock's line for a queue of `mode`: who is queued and playing, and any standby asked to join. */
export function dockLine(view: PopulationView | undefined, mode: QueueMode): string {
  if (!view) return '';
  const m = view.modes[mode];
  if (!m) return '';
  return `${m.queue} IN QUEUE · ${m.playing} PLAYING${m.standby ? ` · ${m.standby} FIGHTING BOTS ASKED TO JOIN` : ''}`;
}

/** The home's counts: ONLINE beside the heading, PLAYING on each mode card (written only when they change). */
export function showCounts(root: ParentNode, view: PopulationView | undefined) {
  const heading = root.querySelector<HTMLElement>('.home-heading');
  if (heading) {
    let chip = heading.querySelector<HTMLElement>('.home-online');
    const text = onlineLine(view);
    if (!chip && text) { chip = document.createElement('b'); chip.className = 'home-online'; chip.setAttribute('role', 'status'); heading.append(chip); }
    if (chip && chip.textContent !== text) { chip.textContent = text; chip.hidden = !text; }
  }
  for (const panel of root.querySelectorAll<HTMLElement>('.home-mode-panel[data-panel]')) {
    const text = cardLine(view, cardMode(panel.dataset.panel!));
    let badge = panel.querySelector<HTMLElement>('.home-mode-online');
    if (!badge && text) { badge = document.createElement('span'); badge.className = 'home-mode-online'; badge.setAttribute('aria-hidden', 'true'); panel.append(badge); }
    if (badge && badge.textContent !== text) { badge.textContent = text; badge.hidden = !text; }
  }
}

/** "A challenger is here": a player on standby (fighting bots after an empty queue) is told someone queued for their mode,
 *  and JOIN takes them to that queue. ✕ puts it away until the queue empties and somebody queues again. */
export class ChallengerPrompt {
  readonly el = document.createElement('div');
  onJoin: (mode: QueueMode) => void = () => {};
  private mode?: QueueMode;
  private dismissed = false;
  constructor(parent: HTMLElement) {
    this.el.className = 'challenger-prompt'; this.el.hidden = true; this.el.setAttribute('role', 'status');
    this.el.innerHTML = '<strong>A CHALLENGER IS HERE</strong><span></span><button type="button" data-challenger-join>JOIN <kbd>ENTER</kbd></button><button type="button" data-challenger-close aria-label="Not now">✕</button>';
    this.el.addEventListener('click', event => {
      const target = event.target as HTMLElement;
      if (target.closest('[data-challenger-join]')) this.join();
      else if (target.closest('[data-challenger-close]')) { this.dismissed = true; this.hide(); }
    });
    // Enter joins while it is up, unless the player put an action on Enter (it is no fight key by default).
    window.addEventListener('keydown', event => {
      if (this.el.hidden || event.repeat || (event.code !== 'Enter' && event.code !== 'NumpadEnter')) return;
      if (Object.values(getBindings().keyboard).some(keys => (keys as readonly string[]).includes(event.code))) return;
      event.preventDefault(); event.stopPropagation(); this.join();
    }, true);
    parent.append(this.el);
  }
  update(view: PopulationView | undefined, where: PageWhere) {
    const mode = where.at === 'standby' ? where.mode : undefined, waiting = mode && view ? view.modes[mode]?.queue ?? 0 : 0;
    if (!mode || mode !== this.mode) this.dismissed = false;
    this.mode = mode;
    if (!waiting) { this.dismissed = false; this.hide(); return; }
    if (this.dismissed) return;
    const text = `${waiting === 1 ? 'SOMEONE QUEUED' : `${waiting} QUEUED`} FOR ${MODE_NAMES[mode!]} · LEAVE THE BOTS AND FIGHT THEM`;
    const line = this.el.querySelector('span')!;
    if (line.textContent !== text) line.textContent = text;
    this.el.hidden = false;
  }
  private join() { const mode = this.mode; this.hide(); this.dismissed = false; if (mode) this.onJoin(mode); }
  private hide() { if (!this.el.hidden) this.el.hidden = true; }
}

/** The page's social play (main.ts, once): the population asked as the page goes, the home's counts, and the challenger. */
export function mountSocialPlay(root: HTMLElement, where: () => PageWhere, join: (mode: QueueMode) => void) {
  const challenger = new ChallengerPrompt(root);
  challenger.onJoin = join;
  population.where = where;
  population.on(view => { showCounts(root, view); challenger.update(view, population.where()); });
  population.start();
  // (The home's counts as the home comes back: the last answer, at once.)
  return { challenger, refresh: () => showCounts(root, population.view) };
}

