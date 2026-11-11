import type { CombatEvent, GameSnapshot } from '../../game/types';
import { RULES } from '../../game/objectives/model';
import { ballOf } from '../../game/ball/model';
import { ULTIMATE_COST } from '../../game/moves';
import { AWAKENING_COST } from '../../game/awakening';
import { boundTo } from '../../input/bindings';
import { FIGHTERS } from '../../config';
import { GUARD_GUIDE } from '../guardGuide';
import { prompt, type PromptAction } from '../prompts';
import type { HudLayoutId, ModeHudFrame } from '../hud/modeHud';
import { coachOn, coachShown, markCoachShown } from './prefs';
import type { ModeId } from './catalogue';
import './coach.css';

/** A tip: when it fires (once ever, per mode), what it says, and what makes it done early. */
interface Tip { id: string; fire(f: ModeHudFrame, state: CoachState): boolean; text(f: ModeHudFrame, state: CoachState): { action?: PromptAction; verb: string; detail?: string }; done?: (f: ModeHudFrame, state: CoachState) => boolean }
interface CoachState { activeAt: number; targetPressed: boolean; downName?: string; heroDown?: string; blockedAt?: number; parried?: boolean }
const SECONDS = 4.5;
/** At most four tips ever shown per mode (a mode may list a fifth: whichever fire first are the four). */
export const MAX_TIPS = 4;
const name = (f: ModeHudFrame, id?: string) => { const p = f.snapshot.players.find(p => p.id === id); return p ? (p.isBot || p.name === 'Fighter' ? FIGHTERS[p.fighter].name : p.name).toUpperCase() : ''; };

/** Techniques (game/techniques.ts): the stick makes the buttons into more moves - said once, a little into the fight. */
const techniques: Tip = { id: 'techniques', fire: (f, s) => f.now - s.activeAt > 9000, text: () => ({ action: 'light', verb: 'STICK + LIGHT OR HEAVY', detail: 'TOWARD, AWAY OR SIDEWAYS: A TECHNIQUE · MIX THEM FOR STYLE' }) };
const lockOn: Tip = { id: 'lock-on', fire: (f, s) => f.now - s.activeAt > 6000 && !s.targetPressed, text: () => ({ action: 'target', verb: 'LOCK ON', detail: 'AGAIN TO SWITCH TARGET' }), done: (_f, s) => s.targetPressed };
const ultimate: Tip = { id: 'ultimate', fire: f => (f.self.ultimate ?? 0) >= ULTIMATE_COST, text: () => ({ action: 'ultimate', verb: 'ULTIMATE READY' }), done: f => f.self.action === 'ultimate' };
const awaken: Tip = { id: 'awaken', fire: f => !f.self.awakened && (f.self.awakening ?? 0) >= AWAKENING_COST, text: () => ({ action: 'awaken', verb: 'AWAKEN', detail: 'YOUR TRANSFORMATION IS READY' }), done: f => !!f.self.awakened };
const opening = (id: string, words: (f: ModeHudFrame) => string): Tip => ({ id, fire: (f, s) => f.now - s.activeAt > 1800, text: f => ({ verb: words(f) }) });
/** Round 5 (PARRY): once the player has blocked a blow, the Perfect Parry - in the PARRY stream's own words
 *  (ui/guardGuide.ts) - while that block is fresh, until they land one. */
const PARRY = GUARD_GUIDE.find(g => g.name === 'Perfect Parry')!;
const parry: Tip = { id: 'parry', fire: (f, s) => !s.parried && s.blockedAt !== undefined && f.now - s.blockedAt < 6000, text: () => ({ action: 'guard', verb: PARRY.name.toUpperCase(), detail: `TAP ${PARRY.how.toUpperCase()}` }), done: (_f, s) => !!s.parried };

/** Each mode's tips, in the order they may fire: each once, at most four shown (MAX_TIPS). */
export const TIPS: Readonly<Record<ModeId, readonly Tip[]>> = {
  'rift-war':[opening('lanes',()=> 'PUSH WITH YOUR WAVE · DESTROY THEIR CORE'),lockOn,ultimate,awaken],
  // The ball modes: the goal at the whistle, then the super shot and the awakening (both fill from touching it). The
  // skills - the stances and the tackle, the boost, the spike's timing, the dig, the block - are taught when they are the
  // play, by the ball modes' own hints in the same lane (ui/ball/ballHints.ts), not on a clock.
  // (The match's own rules decide the words - football's and volleyball's on this device's matches on a page
  // on the sport rules, the classic ones in the online room.)
  'goal-rush': [opening('goal-goal', f => ballOf(f.snapshot)?.football ? 'THE BALL IS YOURS AT YOUR FEET · PASS, SHOOT, SCORE' : 'EVERY SWING HITS THE BALL · IT GOES WHERE YOU LOOK'),
    { ...ultimate, text: () => ({ action: 'ultimate', verb: 'SUPER SHOT READY', detail: 'A SUPER GOAL COUNTS TWO' }) }, awaken],
  'sky-spike': [opening('spike-goal', f => ballOf(f.snapshot)?.volley ? 'THREE TOUCHES A SIDE · RECEIVE, SET, SPIKE' : 'THREE TOUCHES A SIDE · BUMP, SET, SPIKE'),
    { ...ultimate, text: f => ballOf(f.snapshot)?.volley ? { action: 'ultimate', verb: 'SUPER SPIKE READY', detail: 'UP FOR THE ATTACK' } : { action: 'ultimate', verb: 'SUPER SHOT READY', detail: 'INTO THEIR EMPTIEST CORNER' } }, awaken],
  // No lock-on tip in a duel: there is nobody to switch to (the critic: "again to switch target" against one rival).
  duel: [opening('duel-goal', () => 'BEST OF THREE · WIN TWO ROUNDS'), techniques, parry, ultimate, awaken],
  royale: [opening('royale-goal', f => `${f.snapshot.players.length} FIGHTERS · LAST ONE STANDING WINS`), lockOn, parry, ultimate, awaken],
  // (Training locks onto its one opponent as it starts - autoLock.ts - so its fifth tip is the techniques', not lock-on's.)
  training: [{ id: 'dummy', fire: (f, s) => f.now - s.activeAt > 2500, text: () => ({ action: 'quick1', verb: 'DUMMY', detail: 'STANDING STILL OR FIGHTING BACK' }) }, techniques, parry, ultimate, awaken],
  arcade: [
    { id: 'rift', fire: f => (f.run?.dungeon?.progress ?? 0) >= .5, text: () => ({ verb: 'FILL THE RIFT · THE GUARDIAN COMES' }) },
    // (No skill-tree tip: the HUD's own SKILL POINT [T] chip says exactly that, at the same moment.)
    { id: 'relic', fire: f => (f.run?.relics?.length ?? 0) > 0, text: () => ({ verb: "RELIC · A GUARDIAN'S POWER IS YOURS" }) },
    ultimate,
  ],
  'last-stand': [
    opening('gate', () => 'PROTECT THE GATE · ITS BAR IS YOUR LIFE'),
    { id: 'rescue', fire: (_f, s) => !!s.downName, text: (_f, s) => ({ verb: `STAND BESIDE ${s.downName} TO REVIVE`, detail: `${RULES.rescueSeconds} SECONDS` }) },
    { id: 'shop', fire: f => (f.objective?.village?.points ?? 0) >= 300, text: f => ({ action: 'interact', verb: 'QUARTERMASTER', detail: `◈ ${f.objective?.village?.points} · INSIDE THE GATE` }) },
    lockOn,
  ],
  'bad-blood': [
    opening('sides', () => `VILLAINS ${RULES.villainMultiplier}× · HEROES RETURN ONCE`),
    { id: 'return', fire: (_f, s) => !!s.heroDown, text: (_f, s) => ({ verb: `${s.heroDown} RETURNS IN ${RULES.heroReviveSeconds}s`, detail: 'KEEP ONE HERO STANDING' }) },
    parry, lockOn, ultimate,
  ],
};

export class Coach {
  private readonly el = document.createElement('div');
  private state: CoachState = { activeAt: 0, targetPressed: false };
  private showing?: { tip: Tip; until: number; mode: ModeId };
  private layout?: HudLayoutId;
  private selfId = '';
  constructor(private readonly root: HTMLElement) {
    this.el.className = 'coach-tip'; this.el.setAttribute('role', 'status'); this.el.setAttribute('aria-live', 'polite');
    window.addEventListener('keydown', event => { if (boundTo('target', event.code)) this.state.targetPressed = true; });
  }
  frame(f: ModeHudFrame, layout: HudLayoutId) {
    if (layout !== this.layout) { this.layout = layout; this.state = { activeAt: 0, targetPressed: false }; this.hide(); }
    // LEARN TO FIGHT (src/tutorial) teaches in this lane itself: no tip shows, or is spent, during it.
    if ('tutorial' in this.root.dataset) { this.hide(); return; }
    if (f.phase !== 'active' || !f.self.alive && layout !== 'last-stand' && layout !== 'bad-blood') { if (f.phase !== 'active') this.state.activeAt = 0; this.hide(); return; }
    if (!this.state.activeAt) this.state.activeAt = f.now;
    this.selfId = f.self.id;
    const zone = this.root.querySelector<HTMLElement>('.mode-hud [data-zone="6"]');
    if (zone && this.el.parentElement !== zone) zone.append(this.el);
    if (this.showing) {
      const { tip, until } = this.showing;
      if (f.now > until || tip.done?.(f, this.state)) this.hide(); else return;
    }
    if (!coachOn()) return;
    const mode = layout, shown = coachShown(mode);
    if (shown.length >= MAX_TIPS) return;
    const tip = TIPS[mode].find(t => !shown.includes(t.id) && t.fire(f, this.state));
    if (!tip) return;
    markCoachShown(mode, tip.id);
    const { action, verb, detail } = tip.text(f, this.state);
    this.el.innerHTML = action ? prompt(action, verb, { detail }) : `<span class="ux-prompt" data-keyless><b>${verb}</b>${detail ? `<small>${detail}</small>` : ''}</span>`;
    this.el.classList.add('on');
    this.showing = { tip, until: f.now + SECONDS * 1000, mode };
  }
  /** A blow the player blocked or parried (the parry tip), or an ally down (Last Stand) or a Hero falling (Bad Blood):
   *  their name, for the tip. */
  event(event: CombatEvent, snapshot: GameSnapshot, layout: HudLayoutId) {
    if (event.targetId && event.targetId === this.selfId) {
      if (event.kind === 'blocked') this.state.blockedAt = performance.now();
      else if (event.kind === 'just-guard') this.state.parried = true;
    }
    if (event.kind !== 'eliminated' || !event.targetId) return;
    const frame = { snapshot } as ModeHudFrame;
    const victim = snapshot.players.find(p => p.id === event.targetId);
    if (!victim || victim.enemy) return;
    const own = snapshot.players.find(p => p.team && p.id !== victim.id && p.team === victim.team);
    if (layout === 'last-stand' && own) this.state.downName = name(frame, victim.id);
    if (layout === 'bad-blood' && victim.team === 'heroes') this.state.heroDown = name(frame, victim.id);
  }
  clear() { this.layout = undefined; this.state = { activeAt: 0, targetPressed: false }; this.hide(); }
  private hide() { this.showing = undefined; this.el.classList.remove('on'); }
}
