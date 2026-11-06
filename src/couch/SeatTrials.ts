import { FIGHTERS } from '../config';
import type { CombatEvent, FighterId, GameSnapshot } from '../game/types';
import { el, setHtml, setText } from '../ui/hud/mainHudKit';
import { DEFENCE_TRIALS, defenceTrialOf, SECTION_TITLES, TRIAL_SECTIONS, trialOf, trialsFor, type DefenceTrialId, type Trial, type TrialPress, type TrialSection } from '../ui/hud/trainingTrials';

/** How long a swing may go without touching anyone before MISSED shows (TrainingHud's own SWING_MS). */
const SWING_MS: Readonly<Record<string, number>> = { light: 900, heavy: 1300, special: 2200, ultimate: 4000, area: 4000 };

export class SeatTrials {
  readonly node = el('section', 'training-trials couch-trials');
  private fighter?: FighterId;
  private trials: Trial[] = [];
  private readonly done = new Set<string>();
  private readonly rows = new Map<string, HTMLElement>();
  private readonly sections = new Map<TrialSection, { node: HTMLElement; count: HTMLElement; total: number }>();
  private readonly defenceRows = new Map<DefenceTrialId, HTMLElement>();
  private readonly defenceDone = new Set<DefenceTrialId>();
  private count?: HTMLElement; private missed?: HTMLElement; private missedUntil = 0;
  private defence?: HTMLElement; private defenceCount?: HTMLElement;
  private swing?: { seq: number; slot: string; at: number };
  private castSeq = -1; private castAir = false;
  private keysKey = '';
  /** `keyOf`: one press as this seat's device shows it (a <kbd>, or a pad's glyph). */
  constructor(readonly id: string, private keyOf: (press: TrialPress | 'guard') => string) {
    this.node.setAttribute('aria-label', 'Move trials');
  }
  /** Every HUD tick: this seat's fighter (another one starts the list again) and its device's keys (`device`, a key
   *  that changes when a pad is plugged in or the keys move to another half). */
  update(fighter: FighterId, device: string, now = performance.now()) {
    if (fighter !== this.fighter) this.build(fighter);
    if (device !== this.keysKey) { this.keysKey = device; this.drawKeys(); }
    if (this.swing && now - this.swing.at > (SWING_MS[this.swing.slot] ?? 1200)) this.miss(now);
    if (this.missedUntil && now > this.missedUntil && this.missed) { this.missedUntil = 0; this.missed.hidden = true; }
  }
  /** Each combat event once: this seat's casts, its blows that land and the guards it makes. */
  event(event: CombatEvent, snapshot: GameSnapshot) {
    const self = this.id, defence = defenceTrialOf(event, self);
    if (defence) { this.tickDefence(defence); return; }
    if (event.actorId !== self) return;
    if (event.kind === 'cast') {
      const me = snapshot.players.find(p => p.id === self);
      this.castSeq = event.actionSeq ?? -1; this.castAir = !!me && !me.grounded;
      if (event.slot) this.swing = { seq: event.actionSeq ?? -1, slot: event.slot, at: performance.now() };
      return;
    }
    if ((event.kind === 'hit' || event.kind === 'blocked' || event.kind === 'just-guard' || event.kind === 'guard-break') && event.targetId && event.targetId !== self) this.swing = undefined;
    if (event.kind === 'whiff' && event.slot === 'ultimate') this.miss(performance.now());
    if (event.kind === 'awaken') { this.tick('awaken'); return; }
    if (event.kind !== 'hit' || !event.targetId || event.targetId === self) return;
    const air = event.actionSeq !== undefined && event.actionSeq === this.castSeq ? this.castAir : !snapshot.players.find(p => p.id === self)?.grounded;
    const id = trialOf(event, air);
    if (id) this.tick(id);
  }
  private build(fighter: FighterId) {
    this.fighter = fighter; this.trials = trialsFor(fighter); this.done.clear(); this.rows.clear(); this.sections.clear(); this.swing = undefined;
    const head = el('header'), who = el('span'); this.count = el('em');
    head.append(el('b', '', 'MOVE TRIALS'), who, this.count);
    this.missed = el('p', 'trial-missed', 'MISSED · GET IN RANGE'); this.missed.hidden = true; this.missed.setAttribute('role', 'status');
    head.append(this.missed);
    setText(who, FIGHTERS[fighter]?.name.toUpperCase() ?? '');
    const parts: HTMLElement[] = [head];
    for (const section of TRIAL_SECTIONS) {
      const rows = this.trials.filter(t => t.section === section);
      if (!rows.length) continue;
      const node = el('div', 'trial-section'); node.dataset.section = section;
      const title = el('h5'), count = el('small'); title.append(el('span', '', SECTION_TITLES[section]), count);
      const list = el('ol');
      for (const trial of rows) {
        const row = el('li'); row.dataset.trial = trial.id;
        const name = el('span', 'trial-name'); name.textContent = trial.name;
        row.append(el('span', 'trial-keys'), name, el('i', 'trial-mark'));
        list.append(row); this.rows.set(trial.id, row);
      }
      node.append(title, list); parts.push(node);
      this.sections.set(section, { node, count, total: rows.length });
    }
    // DEFENCE: guarding the other person's blows. It ticks all along; its rows open once the move trials are landed, so
    // the list keeps to one open section at a time, as the single player's does.
    this.defenceRows.clear(); this.defenceDone.clear();
    const defence = el('div', 'trial-section trial-defence'); defence.dataset.section = 'defence';
    const title = el('h5'); this.defenceCount = el('small'); title.append(el('span', '', 'DEFENCE'), this.defenceCount);
    const list = el('ol');
    for (const trial of DEFENCE_TRIALS) {
      const row = el('li'); row.dataset.trial = trial.id;
      const name = el('span', 'trial-name'); name.textContent = trial.name;
      row.append(el('span', 'trial-keys'), name, el('small', 'trial-how', trial.how.toUpperCase()), el('i', 'trial-mark'));
      list.append(row); this.defenceRows.set(trial.id, row);
    }
    defence.append(title, list); parts.push(defence); this.defence = defence;
    this.node.replaceChildren(...parts);
    this.drawKeys(); this.draw(); this.drawDefence();
  }
  private drawKeys() {
    for (const trial of this.trials) { const keys = this.rows.get(trial.id)?.querySelector<HTMLElement>('.trial-keys'); if (keys) setHtml(keys, trial.inputs.map(press => this.keyOf(press)).join('<i>+</i>')); }
    for (const trial of DEFENCE_TRIALS) { const keys = this.defenceRows.get(trial.id)?.querySelector<HTMLElement>('.trial-keys'); if (keys) setHtml(keys, trial.keyed ? this.keyOf('guard') : '<i>—</i>'); }
  }
  private miss(now: number) {
    this.swing = undefined;
    if (!this.missed || this.trials.every(t => this.done.has(t.id))) return;
    this.missed.hidden = false; this.missed.classList.remove('flash'); void this.missed.offsetWidth; this.missed.classList.add('flash');
    this.missedUntil = now + 1800;
  }
  private tick(id: string) {
    if (this.done.has(id) || !this.rows.has(id)) return;
    this.done.add(id);
    const row = this.rows.get(id)!;
    row.classList.add('done'); row.classList.remove('landed'); void row.offsetWidth; row.classList.add('landed');
    this.draw();
  }
  private tickDefence(id: DefenceTrialId) {
    const row = this.defenceRows.get(id);
    if (!row || this.defenceDone.has(id)) return;
    this.defenceDone.add(id);
    row.classList.add('done'); row.classList.remove('landed'); void row.offsetWidth; row.classList.add('landed');
    this.drawDefence();
  }
  private draw() {
    const next = this.trials.find(t => !this.done.has(t.id));
    for (const trial of this.trials) this.rows.get(trial.id)?.classList.toggle('next', trial === next);
    for (const [section, { node, count, total }] of this.sections) {
      let landed = 0; for (const trial of this.trials) if (trial.section === section && this.done.has(trial.id)) landed++;
      setText(count, `${landed}/${total}`);
      node.classList.toggle('open', next?.section === section);
      node.classList.toggle('complete', landed === total);
    }
    if (this.count) setText(this.count, next ? `${this.done.size} / ${this.trials.length}` : 'ALL LANDED');
    this.node.classList.toggle('complete', !next);
    this.defence?.classList.toggle('open', !next);
  }
  private drawDefence() {
    if (!this.defence || !this.defenceCount) return;
    const all = this.defenceDone.size === DEFENCE_TRIALS.length;
    this.defence.classList.toggle('complete', all);
    setText(this.defenceCount, `${this.defenceDone.size}/${DEFENCE_TRIALS.length}`);
  }
}
