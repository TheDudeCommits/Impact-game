import { FIGHTERS } from '../../config';
import { ballOf, BALL_TEAM_NAMES, CHARM_COLOURS, POINT_GIVEN, POINT_WON, GOAL_RULES, SHOT_NAMES, SPIKE_RULES, charmLine, charmName, heatTier, inPlay, otherTeam, shortSide, type BallEvent, type BallSeat, type BallTeam, type BallView } from '../../game/ball/model';
import type { PlayerState } from '../../game/types';
import type { ModeHud, ModeHudFrame, ModeHudMount } from './modeHud';
import { el, Text, Flag, Data, Face, Markup, Fill, clockOf, pulse } from './kit';
import { hudView } from './hudView';
import { readEdge, type EdgeRead } from './EdgeMarkers';
import { promptKey, promptText } from '../prompts';
import { DRILLS } from '../../game/ball/drills';
import { superShotName } from '../../game/ball/superShots';
import { VFX } from '../../render/vfxLevel';
import { ballSpeech } from '../../render/ball/BallTags';
import { quietCounts, sportQuiet } from '../../render/ball/BallMoments';
import { chargeFull, ownCharge, ownShot } from '../../render/ball/ownShot';
import { padKey } from '../../input/glyphs';
import { BallHints } from '../ball/ballHints';
import { hasStances } from '../../game/ball/stance';
import { ULTIMATE_COST } from '../../game/moves';
import { SECOND } from '../../game/couchSeat';
import { BANNER_RANK, BANNER_RULES, LINE_RANK, LINE_RULES, Slot, type Shown } from './ballBanner';
import { VOLLEY } from '../../game/ball/volley';
import { ownCues } from '../../render/ball/SpikeCues';
import './ballHud.css';

/**
 * The ball modes' HUD: Goal Rush and Sky Spike share one layout, a broadcast scoreboard over the
 * fight and the game's moments as big manga banners.
 *
 * Fewer, larger, clearer pieces than the fighting HUD's (whose move cards, ticker and chat feed are put away here):
 *
 * Zone 2, the top stack, each piece directly under the last (ballHud.css `--bh-*`):
 *  - the score bug, half again as big: each side's faces and name in its colour (Sky Spike: its touches as dots, and a
 *    gold ball on the score of the side that serves), the two scores, between them the clock (Goal Rush), OVERTIME, or
 *    the rally (Sky Spike), and the ball's heat;
 *  - one line: who did what (the scorer, the assist, the shot's speed), the banner's own detail while one is up, or the
 *    match's terms at a kickoff - one at a time, never a feed (ballBanner.ts LINE_RULES);
 *  - one banner (GOAL, SAVE, STUFF BLOCK, the kickoff's count): one at a time by what it is worth (ballBanner.ts
 *    BANNER_RULES), under the score and over the net and the goal mouths, never on them.
 * Zone 9, the foot of the view: Goal Rush's stance badge and health, and two bars in place of the move cards - BOOST
 * (the stamina the run spends) and SUPER (the ultimate's charge), each with its key (`SeatStrip`; a split screen's
 * second half has its own). Zone 3: RUMBLE's charms at work. Zone 6: the one prompt that matters now (your serve).
 * Zone 8: an arrow at the screen's edge toward the ball when it is off screen. What the bots and people say is a speech
 * bubble over the speaker (render/ball/BallTags.ts), not text here.
 */
const KMH = 3.6;
/** A line under the score is up this long (ms). */
const LINE_MS = 2600;
/** A point's banner on the volleyball rules is up this long (ms) - the score's own pulse says the rest. */
export const VOLLEY_POINT_MS = 650;
/** So the prompt reads clearly and times the press: the prompt's timing bar on the volleyball rules fills over the last
 *  `lead` s to the moment to press - a receive's or a set's best moment less the swing's contact (game/ball/volley.ts
 *  VOLLEY.tier), the jump's beat for your spike (render/ball/SpikeCues.ts) - and over your jump's climb to the spike's
 *  window; it is gold (`now`) inside the PERFECT window. */
export const VOLLEY_TIMER = { lead: 1.1 } as const;
/** SHOOT's charge readout stays this long after its blow (ms), as it ended, then goes. */
const CHARGE_KEPT = 320;

interface Slotted { seat: string; root: HTMLElement; face: Face }
interface Banner extends Shown { kind: string; team: BallTeam | ''; top: string; title: string; line: string }
interface Line extends Shown { text: string; team: BallTeam | ''; kind: string }

export function createBallHud(): ModeHud { return new BallHud(); }

// The display face: Barlow Condensed Black Italic, the game's own file (SIL OFL 1.1; declared by
// ui/hud/inked.css as 'Barlow Condensed' italic 900), in place of Impact, which the game never shipped and a phone does
// not have. It is asked for as the page boots (this module is the HUD registry's, loaded with the page; inked.ts asks
// too), so the first score bug and the first ball menu are never drawn in a stand-in. (Not a preload link in index.html:
// a file the page preloads must be one of the home's, tests/brand.test.ts.)
if (typeof document === 'object' && document.fonts?.load) void document.fonts.load("italic 900 1em 'Barlow Condensed'").catch(() => {});

const nameOf = (seat: BallSeat | undefined) => !seat ? '' : (seat.bot || seat.name === 'Fighter' ? FIGHTERS[seat.fighter].name : seat.name).toUpperCase();

/**
 * One seat's own strip at the foot of its view: Goal Rush's stance badge - BALL in gold, or FIGHT in red
 * with the one locked and their health - over the seat's health (Goal Rush, where the sides fight; red under a third)
 * and the two bars a ball player needs of the fighting HUD's six cards: BOOST, gold, bright on a full bar and while
 * boosting, dim under one dash's worth; SUPER, filling as the ultimate charges and flashing once it is ready. Each bar
 * names its key (none on a touch screen, whose buttons say it, nor on a split screen, whose seats' keys the mode HUD
 * is not told). The place after the bars is SHOOT's charge's (`shot`). Written only when a value moves.
 */
class SeatStrip {
  readonly root: HTMLElement;
  private readonly mode: Data; private readonly hpOn: Flag; private readonly low: Flag; private readonly hp: Fill;
  private readonly boost: Fill; private readonly boostState: Data; private readonly boostBar: HTMLElement; private readonly boostKey: Markup;
  private readonly sup: Fill; private readonly supState: Data; private readonly supKey: Markup; private readonly supName: Text; private readonly boostName: Text;
  private readonly stance: HTMLElement; private readonly stanceKind: Data; private readonly stanceOn: Flag; private readonly stanceName: Text; private readonly stanceKey: Markup; private readonly stanceHp: Fill;
  /** Goal Rush's SPORT mode (`?football`): the badge says SPORT where it said BALL, and the legend under it names SPORT's
   *  buttons and the camera's state (BALL LOCK or FREE LOOK). */
  private readonly sportOn: Flag; private readonly legend: Markup;
  /** The SPORT strip faded out (FOOT_STRIP) - set by BallHud on the sport rules' football. */
  private readonly quiet: Flag;
  private readonly charge: HTMLElement; private readonly chargeFill: Fill; private readonly chargeState: Data; private readonly chargeSide: Data;
  /** Whether SHOOT's charge shown last reached full, and until when (ms) it stays after its blow. */
  private chargedFull = false; private chargeUntil = -Infinity;
  private stanceShown = ''; private wasFull = true;

  constructor(parent: HTMLElement, second = false) {
    this.root = el('div', second ? 'bh-seat two' : 'bh-seat', parent); this.mode = new Data(this.root, 'mode');
    this.stance = el('div', 'bh-stance', this.root); this.stanceKind = new Data(this.stance, 'stance'); this.stanceOn = new Flag(this.stance, 'on');
    el('b', '', this.stance); this.stanceName = new Text(el('span', '', this.stance));
    this.stanceHp = new Fill(el('b', '', el('i', 'bh-stance-hp', this.stance)));
    this.stanceKey = new Markup(el('small', 'ux-keys', this.stance));
    this.sportOn = new Flag(this.stance, 'sport'); this.legend = new Markup(el('small', 'ux-keys bh-legend', this.stance)); this.quiet = new Flag(this.stance, 'quiet');
    const hp = el('i', 'bh-hp', this.root); this.hp = new Fill(el('b', '', hp), .01); this.hpOn = new Flag(hp, 'on'); this.low = new Flag(hp, 'low');
    const bars = el('div', 'bh-bars', this.root);
    const bar = (kind: string, name: string) => {
      const node = el('div', `bh-bar ${kind}`, bars), key = new Markup(el('span', 'bh-key ux-keys', node));
      const label = new Text(el('small', '', node)); label.set(name);
      return { node, key, label, fill: new Fill(el('b', '', el('i', '', node)), .01), state: new Data(node, 'state') };
    };
    const boost = bar('boost', 'BOOST'), sup = bar('super', 'SUPER');
    this.boost = boost.fill; this.boostState = boost.state; this.boostBar = boost.node; this.boostKey = boost.key; this.boostName = boost.label;
    this.sup = sup.fill; this.supState = sup.state; this.supKey = sup.key; this.supName = sup.label;
    // SHOOT's charge, in the place the bars left for it: nothing on a tap; held past the
    // split, a small fill in the side's colour that fills over the fighter's own wind-up and flashes as it is full.
    this.charge = el('i', 'bh-charge', bars); this.charge.setAttribute('aria-hidden', 'true');
    this.chargeFill = new Fill(el('b', '', this.charge), .004); this.chargeState = new Data(this.charge, 'state'); this.chargeSide = new Data(this.charge, 'side');
  }

  /** SHOOT's charge now (0-1), or null when none is winding up (a tap, no swing, the blow struck), and whether it is full
   *  (ownShot.ts chargeFull); `now` ms. Shown a breath after its blow (CHARGE_KEPT), as it ended - full, or where the key
   *  came up - and then let go. */
  shot(charge: number | null, now: number, full = charge !== null && charge >= .999) {
    if (charge !== null) {
      if (full && !this.chargedFull) pulse(this.charge, 'pulse');
      this.chargedFull = full; this.chargeUntil = now + CHARGE_KEPT;
      this.chargeFill.set(full ? 1 : charge); this.chargeState.set(full ? 'full' : 'on');
      return;
    }
    if (now < this.chargeUntil) { this.chargeState.set(this.chargedFull ? 'full' : 'kept'); return; }
    this.chargeState.set(''); this.chargedFull = false;
  }

  /** `lock`: the opponent the seat's FIGHT stance is on, or null in the BALL stance; `stances`: whether the badge shows.
   *  Returns the stance shown ('' for none). */
  update(v: BallView, self: PlayerState, lock: string | null, stances: boolean, players: readonly PlayerState[], keys: { boost: string; super: string; stance: string; legend?: string; quiet?: boolean }): 'ball' | 'fight' | '' {
    this.mode.set(v.mode); this.chargeSide.set(v.seats.find(s => s.id === self.id)?.team ?? '');
    const fights = v.mode === 'goal-rush' && (!v.practice || !!v.lesson);
    this.hpOn.set(fights);
    const hp = fights && self.maxHp > 0 ? Math.max(0, self.hp) / self.maxHp : 1;
    this.hp.set(hp); this.low.set(fights && hp <= .3);
    const max = Math.max(1, self.maxStamina ?? 100), stamina = Math.max(0, Math.min(max, self.stamina ?? 0)), full = stamina >= .99 * max;
    this.boost.set(stamina / max);
    this.boostState.set(self.boost ? 'on' : full ? 'full' : stamina < 20 ? 'spent' : '');
    // A bar just filled flashes once: the boost is there again.
    if (full && !this.wasFull) pulse(this.boostBar, 'pulse');
    this.wasFull = full;
    const charge = Math.max(0, Math.min(1, (self.ultimate ?? 0) / ULTIMATE_COST));
    // (VOLLEYBALL: the meter is the SUPER SPIKE's, lit only when its button would fire it - full, and up
    // for the attack: game/ball/volley.ts superReady.)
    const vol = v.volley;
    this.supName.set(vol ? 'SUPER SPIKE' : 'SUPER');
    this.sup.set(charge); this.supState.set(charge >= 1 && (!vol || vol.prompt[self.id] === 'SPIKE') ? 'ready' : '');
    this.boostKey.set(keys.boost); this.supKey.set(keys.super);
    // (On the volleyball rules the dash is the DIVE - game/ball/volley.ts - so its bar is too; set before the stance's
    // early way out, which volleyball - no stances - always takes.)
    if (v.volley) this.boostName.set('DIVE');
    this.stanceOn.set(stances);
    if (!stances) { if (!v.volley) this.boostName.set('BOOST'); this.stanceShown = ''; return ''; }
    const kind = lock ? 'fight' : 'ball', foe = lock ? players.find(p => p.id === lock) : undefined;
    this.stanceKind.set(kind);
    this.stanceName.set(lock ? nameOf(v.seats.find(s => s.id === lock)) : '');
    this.stanceHp.set(foe && foe.maxHp > 0 ? foe.hp / foe.maxHp : 0);
    if (kind + lock !== this.stanceShown) { this.stanceShown = kind + lock; pulse(this.stance, 'pulse'); }
    this.stanceKey.set(keys.stance);
    // (Football's dash is SPRINT - its legend's, its phone button's - so its bar is too.)
    this.boostName.set(v.football ? 'SPRINT' : v.volley ? 'DIVE' : 'BOOST');
    this.sportOn.set(!!v.football); this.legend.set(v.football && !lock ? keys.legend ?? '' : '');
    this.quiet.set(!!v.football && !lock && !!keys.quiet);
    return kind;
  }
  remove() { this.root.remove(); }
}

/** A clear HUD with a control strip big enough to read: football's SPORT legend, as keys with their words, the same
 *  from moment to moment: one fixed line - PASS, SHOOT, TACKLE, SPRINT, TRICK, whoever has the ball (PASS without it
 *  is the call, as ever) - then the camera's state. A touch screen's are its buttons: none here. */
function footLegend(keyed: boolean, at: { device: ModeHudFrame['input']; family: ModeHudFrame['family'] }) {
  if (!keyed) return '';
  return promptText('{light} PASS {heavy} SHOOT {guard} TACKLE {dash} SPRINT {special} TRICK', at);
}
/** Football's SPORT strip (the keys) is shown for the first `first` s of live play of the visit's football
 *  (its first match, or as far into the next as it takes), then fades; it comes back while the pause menu is open and for
 *  `back` s after it closes. Never faded in the FIGHT stance (its badge names the one locked). */
const FOOT_STRIP = { first: 20, back: 8 } as const;
const footStrip = { seen: 0, lastNow: NaN, backUntil: -Infinity };
let pauseScrim: Element | null | undefined;
const pauseOpen = () => { if (typeof document !== 'object') return false; if (!pauseScrim?.isConnected) pauseScrim = document.querySelector('.settings-scrim'); return !!pauseScrim && !pauseScrim.classList.contains('hidden'); };

/** SPORT mode (`?football`): what the banner and the line under the score still say. */
const SPORT_SAID: ReadonlySet<BallEvent['kind']> = new Set<BallEvent['kind']>(['goal', 'own-goal', 'overtime', 'fever', 'win', 'super', 'duel', 'duel-won', 'wipeout', 'tackle', 'reversal', 'chat', 'accolade']);
/** SPORT's great save, the one save the banner names: off the line, or a shot of GREAT_SAVE m/s or more stopped (a
 *  charged one: a tap leaves at 24-30). A few a match. */
const GREAT_SAVE = 31;
const greatSave = (e: BallEvent) => e.text === 'OFF THE LINE' || (e.value ?? 0) >= GREAT_SAVE;

class BallHud implements ModeHud {
  private board!: HTMLElement; private side!: Data; private boardMode!: Data; private boardLesson!: Flag;
  private faces: Record<BallTeam, HTMLElement> = {} as Record<BallTeam, HTMLElement>;
  private scores: Record<BallTeam, Text> = {} as Record<BallTeam, Text>;
  private scoreNodes: Record<BallTeam, HTMLElement> = {} as Record<BallTeam, HTMLElement>;
  private serving: Record<BallTeam, Flag> = {} as Record<BallTeam, Flag>;
  private labels: Record<BallTeam, Text> = {} as Record<BallTeam, Text>;
  private dots: Record<BallTeam, { used: Data; last: Flag }> = {} as Record<BallTeam, { used: Data; last: Flag }>;
  private middle!: Text; private middleKind!: Data;
  /** The POWER PLAY: the count in the bug's middle while a side is short (3 v 2), in place of the heat. */
  private power!: Data; private powerRed!: Text; private powerBlue!: Text; private powerShown = '';
  private slots: Slotted[] = []; private rosterKey = '';
  private heat!: Data; private heatLabel!: Text;
  /** The one banner (ballBanner.ts): what is up now, and the one shown last tick. */
  private readonly banners = new Slot<Banner>(BANNER_RULES); private bannerShown: Banner | null = null;
  private banner!: HTMLElement; private bannerOn!: Flag; private bannerKind!: Data; private bannerTeam!: Data; private bannerTop!: Text; private bannerTitle!: Text; private bannerLine!: Text;
  /** The one line under the score: a moment's (ballBanner.ts), the banner's own, or what the match says at rest. */
  private readonly lines = new Slot<Line>(LINE_RULES); private lineShown = '';
  private line!: HTMLElement; private lineOn!: Flag; private lineTeam!: Data; private lineKind!: Data; private lineText!: Text; private lineKeys!: Markup;
  private charms!: HTMLElement; private charmsKey = '';
  private chatButton!: HTMLButtonElement; private chatOn!: Flag;
  private prompt!: HTMLElement; private promptText!: Markup; private promptOn!: Flag;
  /** The prompt's timing bar (VOLLEY_TIMER) and what it is timing now - a touch's moment on the page's clock, the
   *  jump's beat, or the climb in the air. */
  private timer!: HTMLElement; private timerFill!: HTMLElement; private timerOn!: Flag; private timerNow!: Flag;
  private timed: { kind: 'touch'; at: number } | { kind: 'jump' | 'air' } | null = null;
  /** The first-time hints (ui/ball/ballHints.ts) in the prompt lane, when it has nothing else to say and the coach's tip
   *  is not up. */
  private readonly hints = new BallHints(() => !!this.root?.querySelector('.mode-hud .coach-tip.on'));
  private arrow!: HTMLElement; private arrowOn!: Flag; private edge: EdgeRead = { onScreen: true, side: 1, height: 0, behind: false };
  private lastEvent = 0; private lastAt = -Infinity; private shownScore = ''; private live = false;
  /** The page's own strip at the foot of the view (SeatStrip), a split screen's second seat's in its own half, and the
   *  count back in while the page's own fighter is wiped out. */
  private strip!: SeatStrip; private second?: SeatStrip; private selfId = '';
  /** SHOOT's charge readout's own frame loop (`shotFrame`), and the page's own state as last told (`update`), for a page
   *  with no prediction of its own fighter. */
  private shotLoop = 0; private lastSelf?: PlayerState;
  private out!: HTMLElement; private outOn!: Flag; private outText!: Text; private shownOut = '';
  private countdown = -1;
  private root?: HTMLElement; private combat?: HTMLElement;
  private wipe!: HTMLElement; private wipeTeam!: Data; private replayShown = false;
  private mood!: HTMLElement; private moodKind!: Data;
  private replay!: HTMLElement; private replayOn!: Flag; private replayTeam!: Data; private replayLine!: Text; private replaySkip!: Markup; private replayKey = '';

  mount(m: ModeHudMount) {
    this.root = m.root; this.combat = m.combat;
    this.board = el('div', 'bh-board', m.zone('2')); this.side = new Data(this.board, 'side'); this.boardMode = new Data(this.board, 'mode'); this.boardLesson = new Flag(this.board, 'lesson');
    for (const team of ['red', 'blue'] as BallTeam[]) {
      const plate = el('div', `bh-team ${team}`, this.board);
      this.labels[team] = new Text(el('small', '', plate));
      const row = el('div', 'bh-row', plate);
      this.faces[team] = el('div', 'bh-faces', row);
      // Sky Spike: the side's touches spent, as dots (the side that has the ball; the last one left throbs).
      const dots = el('i', 'bh-dots', row); for (let i = 0; i < SPIKE_RULES.touches; i++) el('i', '', dots);
      this.dots[team] = { used: new Data(dots, 'used'), last: new Flag(dots, 'last') };
      const score = el('b', `bh-score ${team}`, this.board);
      this.scoreNodes[team] = score; this.scores[team] = new Text(el('span', '', score)); this.serving[team] = new Flag(score, 'serve');
    }
    // Order: red plate, red score, middle, blue score, blue plate (the CSS grid places them by class).
    const middle = el('div', 'bh-middle', this.board);
    this.middle = new Text(el('strong', '', middle)); this.middleKind = new Data(middle, 'kind');
    // (The POWER PLAY's count - red's bodies in play, then blue's - in the heat's place while it lasts.)
    const power = el('div', 'bh-power', middle); this.power = new Data(middle, 'power');
    this.powerRed = new Text(el('b', 'red', power)); el('small', '', power, 'V'); this.powerBlue = new Text(el('b', 'blue', power));
    const heat = el('div', 'bh-heat', middle); this.heat = new Data(heat, 'tier');
    this.heatLabel = new Text(el('small', '', heat)); for (let i = 0; i < 4; i++) el('i', '', heat);
    // The one line under the score, then the one banner under it: both in the score bug's own zone, one
    // block down from the top edge.
    this.line = el('div', 'bh-line', m.zone('2')); this.lineOn = new Flag(this.line, 'on'); this.lineTeam = new Data(this.line, 'team'); this.lineKind = new Data(this.line, 'kind');
    this.lineText = new Text(el('span', '', this.line)); this.lineKeys = new Markup(el('span', 'ux-keys', this.line));
    this.banner = el('div', 'bh-banner', m.zone('2')); this.bannerOn = new Flag(this.banner, 'on');
    this.bannerKind = new Data(this.banner, 'kind'); this.bannerTeam = new Data(this.banner, 'team');
    // (A phone on its side: the banner stands in the line's place while it is up, and says the line's words in its top
    // row - its own <em>, in place of the top's words when it has them: ballHud.css.)
    this.bannerLine = new Text(el('em', '', this.banner));
    this.bannerTop = new Text(el('small', '', this.banner)); this.bannerTitle = new Text(el('strong', '', this.banner));
    // RUMBLE: the charms at work, each a chip in its colour with whose it is and the seconds it has left.
    this.charms = el('div', 'bh-charms', m.zone('3'));
    this.prompt = el('div', 'hk-slip bh-prompt hidden', m.zone('6')); this.promptText = new Markup(this.prompt); this.promptOn = new Flag(this.prompt); this.promptOn.set(true);
    this.timer = el('div', 'bh-timer', m.zone('6')); this.timerFill = el('i', '', this.timer); el('b', '', this.timer); this.timerOn = new Flag(this.timer, 'on'); this.timerNow = new Flag(this.timer, 'now');
    // FREE PLAY's prompt is also the reset's button on a touch screen (main.ts hears the event and tells the room).
    this.prompt.addEventListener('pointerdown', event => { if (this.prompt.dataset.act === 'reset') { event.stopPropagation(); window.dispatchEvent(new CustomEvent('ball-reset')); } });
    // Quick chat's button on a touch screen (ui/ball/QuickChat.ts opens on the event): a small round one in the corner
    // beside PAUSE and the emote (handheld.css).
    this.chatButton = el('button', 'bh-chat-btn', m.root); this.chatButton.type = 'button'; this.chatButton.setAttribute('aria-label', 'Quick chat'); this.chatOn = new Flag(this.chatButton, 'on');
    this.chatButton.innerHTML = '<svg viewBox="0 0 32 32" aria-hidden="true"><path d="M5 7h22v14H15l-6 5v-5H5z"/><path d="M10.5 12h11M10.5 16h7"/></svg>';
    this.chatButton.addEventListener('pointerdown', event => { event.stopPropagation(); event.preventDefault(); window.dispatchEvent(new CustomEvent('ball-chat-open')); });
    this.arrow = el('div', 'bh-arrow', m.zone('8')); this.arrowOn = new Flag(this.arrow, 'on');
    this.strip = new SeatStrip(m.zone('9'));
    // (SHOOT's charge is read every frame, not at the HUD's own pace - a fifteenth of a second - against a wind-up of a
    // third to two thirds of one: it fills with the swing and is full as the blow lands.)
    if (typeof requestAnimationFrame === 'function') { const frame = () => { this.shotLoop = requestAnimationFrame(frame); this.shotFrame(); }; this.shotLoop = requestAnimationFrame(frame); }
    // Wiped out: the count back in, in the prompt lane.
    this.out = el('div', 'bh-out', m.zone('6a')); this.outOn = new Flag(this.out, 'on'); this.outText = new Text(this.out);
    // The replay's tag: REPLAY, whose goal it was, and the skip vote.
    this.replay = el('div', 'bh-replay', m.root);
    this.wipe = el('div', 'bh-wipe', m.root); this.wipeTeam = new Data(this.wipe, 'team');
    // FEVER and OVERTIME: the screen's edges glow while they last (gold; the two sides' colours).
    this.mood = el('div', 'bh-mood', m.root); this.moodKind = new Data(this.mood, 'mood'); this.replayOn = new Flag(this.replay, 'on'); this.replayTeam = new Data(this.replay, 'team');
    const chip = el('b', 'bh-replay-chip', this.replay); el('i', '', chip); el('span', '', chip, 'REPLAY');
    this.replayLine = new Text(el('strong', '', this.replay)); this.replaySkip = new Markup(el('small', '', this.replay));
    el('i', '', this.arrow); el('b', '', this.arrow, 'BALL');
  }

  update(f: ModeHudFrame) {
    const v = ballOf(f.snapshot);
    if (!v) return;
    const now = f.now, own = v.seats.find(s => s.id === f.self.id), team: BallTeam = own?.team ?? 'red';
    this.side.set(team); this.boardMode.set(v.mode);
    // #interface[data-ball-live] while the ball is in play: the sports HUD's CSS clears the screen down to the score bug.
    const live = v.phase === 'live' && !v.replay;
    if (this.root && live !== this.live) { this.live = live; if (live) this.root.dataset.ballLive = ''; else delete this.root.dataset.ballLive; }
    // (#interface[data-ball-volley] on the volleyball rules - the prompt's one place, bottom centre over the bars.)
    if (this.root && !!v.volley !== ('ballVolley' in this.root.dataset)) { if (v.volley) this.root.dataset.ballVolley = ''; else delete this.root.dataset.ballVolley; }
    // (#interface[data-ball-foot] on the sport rules' football - its strip and bars at the foot's left corner.)
    if (this.root && !!v.football !== ('ballFoot' in this.root.dataset)) { if (v.football) this.root.dataset.ballFoot = ''; else delete this.root.dataset.ballFoot; }
    this.roster(v, f);
    this.selfId = f.self.id; this.lastSelf = f.self; this.seats(v, f, own);
    const spike = v.mode === 'sky-spike';
    for (const t of ['red', 'blue'] as BallTeam[]) {
      this.labels[t].set(t === team ? `${BALL_TEAM_NAMES[t]} · YOU` : BALL_TEAM_NAMES[t]);
      this.scores[t].set(String(v.score[t]));
      // Sky Spike's serve and touches, on the bug itself: a gold ball on the serving side's score, and each side's
      // touches spent while it has the ball (the last one left throbs).
      const used = spike && v.touchTeam === t ? Math.min(SPIKE_RULES.touches, v.touches) : 0;
      this.serving[t].set(spike && !v.practice && v.servingTeam === t);
      this.dots[t].used.set(String(used)); this.dots[t].last.set(used === SPIKE_RULES.touches - 1);
    }
    // (LEARN TO PLAY's goals and points are its steps' moments, not a match's: the score bug carries no score
    // there, only LEARN TO PLAY between the two sides - the steps' count is the checklist's, ui/ball/LearnToPlay.ts.)
    this.boardLesson.set(!!v.lesson);
    const score = `${v.score.red}-${v.score.blue}`;
    if (score !== this.shownScore) { if (this.shownScore) for (const t of ['red', 'blue'] as BallTeam[]) pulse(this.scoreNodes[t], 'pulse'); this.shownScore = score; }
    // The middle: the clock, OVERTIME, or the rally and what the next point is worth. What the match says at rest is
    // the line's, under the bug (`rest`).
    let rest = '';
    if (v.practice) {
      this.middle.set(v.drill ? 'DRILL' : v.lesson ? 'LEARN TO PLAY' : 'FREE PLAY'); this.middleKind.set('word');
      // (A training drill: its name; its progress is ui/ball/BallBadge.ts's. LEARN TO PLAY: the step's line and
      // checklist are ui/ball/LearnToPlay.ts's.)
      if (v.drill) rest = DRILLS[v.drill.id].name;
      else if (!v.lesson) rest = [v.hits ? `TARGETS ${v.hits}${v.streak > 1 ? ` · STREAK ${v.streak}` : ''}` : v.mode === 'goal-rush' ? 'SHOOT THROUGH THE GOLD RING' : 'SPIKE IT ONTO THE GOLD RING', v.best > 0 ? `FASTEST ${Math.round(v.best * KMH)} KM/H` : ''].filter(Boolean).join(' · ');
    } else if (v.mode === 'goal-rush') {
      const ending = v.clock <= 0 && !v.overtime && v.phase === 'live';
      this.middle.set(v.overtime ? 'OVERTIME' : clockOf(Math.ceil(v.clock)));
      this.middleKind.set(v.overtime ? 'overtime' : ending ? 'ending' : v.clock <= 30 ? 'late' : 'clock');
      // In play the line says only what changes the play (the sports HUD): the match's terms are for the kickoff.
      rest = v.overtime ? 'NEXT GOAL WINS' : ending ? 'BALL ON THE GROUND ENDS IT' : v.phase === 'live' ? '' : `${v.rumble ? 'RUMBLE' : 'FIRST TO SCORE MORE'} · ${Math.round(GOAL_RULES.matchSeconds / 60)} MIN`;
    } else {
      // (A FEVER point counts double to the side behind alone - the arrow points at it on the score bug, red's
      // on the left - or to either side level, and to anyone in SUDDEN DEATH.)
      const behind = !v.fever || v.mutator === 'sudden-death' || v.score.red === v.score.blue ? '' : v.score.red < v.score.blue ? 'red' : 'blue';
      this.middle.set(v.fever ? behind === 'red' ? '◂ FEVER ×2' : behind === 'blue' ? 'FEVER ×2 ▸' : 'FEVER ×2' : `RALLY ${v.rally}`);
      this.middleKind.set(v.fever ? 'fever' : v.rally >= SPIKE_RULES.rallyHeat ? 'hot' : 'rally');
      // Whose serve it is and who serves, as the server walks up; the match's terms before the first.
      const server = v.seats.find(s => s.id === v.serverId);
      rest = v.phase === 'kickoff' ? `${BALL_TEAM_NAMES[v.servingTeam]} SERVE · ${nameOf(server)}` : v.phase === 'live' ? '' : `${v.rumble ? 'RUMBLE · ' : ''}FIRST TO ${v.target} · WIN BY 2`;
    }
    const tier = heatTier(v.ball.heat);
    // (SPORT mode, `?football`: the ball has no heat - the place is left empty. Nor on the volleyball rules.)
    this.heat.set(v.football || v.volley ? 'none' : String(tier)); this.heatLabel.set(v.football || v.volley ? '' : tier >= 4 ? 'OVERDRIVE' : 'HEAT');
    this.powerCount(v);
    this.charmChips(v, f, team);
    // The ball cam's key (Tab, the pad's target button: on by default, render/ball/BallCam.ts, and the key turns it off
    // for the follow camera), and quick chat's (ui/ball/QuickChat.ts; none in FREE PLAY, where nobody hears it): taught in
    // the line for the match's first half minute, while it has nothing else to say, and out of the way otherwise.
    const teach = f.input !== 'touch' && !rest && v.phase === 'live' && f.snapshot.serverTime - v.startedAt < 30;
    // (Football against bots alone has nobody to chat with - no CHAT prompt.)
    const alone = !!v.football && !v.seats.some(s => !s.bot && s.id !== f.self.id);
    const chat = v.practice || alone ? '' : `${f.input === 'controller' ? padKey(f.family, 'select') : '<kbd>C</kbd>'} CHAT`;
    // (Goal Rush's target key is the stance's: its badge teaches it, at the foot of the view.)
    const stances = v.mode === 'goal-rush' && (!v.practice || !!v.lesson);
    const keys = !teach ? '' : stances ? chat : [promptText(hudView.ballCam() ? '{target} FREE CAM' : '{target} BALL CAM', { device: f.input, family: f.family }), chat].filter(Boolean).join(' · ');
    // The prompt: your serve, or a KI CHARGE waiting in your boots.
    // (LEARN TO PLAY's JUMP SERVE says it in its own line: ui/ball/LearnToPlay.ts.)
    const serving = spike && v.phase === 'kickoff' && v.serverId === f.self.id && !v.lesson;
    const charged = v.rumble && v.effects.some(e => e.kind === 'charge' && e.id === f.self.id);
    const practice = v.practice && !v.drill && !v.lesson && (v.phase === 'live' || v.phase === 'kickoff');
    // (VOLLEYBALL - game/ball/volley.ts: what PLAY does now, for the one button every touch is.)
    const vol = v.volley, play = vol && v.phase === 'live' ? vol.prompt[f.self.id] : undefined;
    // (SPORT mode, `?football`: the classic first-time hints teach the BALL stance's TRAP and carry - not shown. Nor under
    // VOLLEYBALL: they teach the classic spike, the guard's block and the dash's dig; PLAY's own word says the touch.)
    const hint = serving || charged || practice || play || v.football || vol ? '' : this.hints.frame({ view: v, self: f.self, players: f.snapshot.players, fight: !!hudView.ballLock(), device: f.input, family: f.family, serverTime: f.snapshot.serverTime }, now);
    this.promptOn.set(!serving && !charged && !practice && !hint && !play);
    if (serving && vol) this.promptText.set(promptText('YOUR SERVE · {light} FLOAT SERVE · {jump} THEN {light} JUMP SERVE', { device: f.input, family: f.family }));
    else if (serving) this.promptText.set(promptText('YOUR SERVE · {light} LOB · {heavy} POWER SERVE', { device: f.input, family: f.family }));
    // (On the attack the TIP's button too, and the SUPER SHOT's once the meter is full; the block is the jump.)
    else if (play) {
      const ready = (f.self.ultimate ?? 0) >= 100, attack = play === 'SPIKE' || play === 'JUMP';
      const line = play === 'BLOCK' ? '{jump} BLOCK' : play === 'JUMP' ? '{jump} THEN {light} SPIKE' : attack ? '{light} SPIKE · {heavy} TIP' : `{light} ${play}`;
      // (On a phone the buttons carry the words - sportTouch.ts volleySet - so the lane says only the BLOCK's.)
      const words = attack && ready ? `${line} · {ultimate} SUPER` : line;
      if (f.input === 'touch') this.promptOn.set(play !== 'BLOCK');
      this.promptText.set(f.input === 'touch' ? '<span class="ux-prompt"><b>JUMP TO BLOCK</b></span>' : promptText(words, { device: f.input, family: f.family }));
    }
    else if (charged) this.promptText.set(promptText('KI CHARGE · YOUR NEXT {heavy} FLIES AT OVERDRIVE', { device: f.input, family: f.family }));
    else if (practice) this.promptText.set(f.input === 'touch' ? '<span class="ux-prompt"><b>TAP: RESET BALL</b></span>' : `<span class="ux-prompt">${f.input === 'controller' ? padKey(f.family, 'select') : '<kbd>⌫</kbd>'}<b>RESET BALL</b></span>`);
    else if (hint) this.promptText.set(hint);
    // (What the timing bar times - your own receive or set (its moment on the page's clock), your spike's jump, your
    // climb in the air.)
    const yours = !!vol && vol.owner === f.self.id && v.phase === 'live';
    this.timed = !vol || !play ? null : yours && (vol.touch === 1 || vol.touch === 2) && (play === 'RECEIVE' || play === 'SET')
      ? { kind: 'touch', at: performance.now() + (vol.at - VOLLEY.contact - f.snapshot.serverTime) * 1000 } : play === 'JUMP' ? { kind: 'jump' } : play === 'SPIKE' ? { kind: 'air' } : null;
    if (practice && f.input === 'touch') this.prompt.dataset.act = 'reset'; else delete this.prompt.dataset.act;
    this.chatOn.set(f.input === 'touch' && !v.practice && !alone && v.phase !== 'lobby' && v.phase !== 'over');
    // The events.
    if (f.snapshot.serverTime < this.lastAt - 1) this.lastEvent = 0;
    this.lastAt = f.snapshot.serverTime;
    for (const e of v.events) if (e.id > this.lastEvent) { this.lastEvent = e.id; this.hints.event(e, f.self.id); this.moment(e, v, team, now); }
    // The kickoff's count.
    // (An intro plays through its countdown: BallCeremony's own lens and pages, no count.)
    if (v.phase === 'kickoff' && v.mode === 'goal-rush' && !v.practice || v.phase === 'countdown' && !v.intro) {
      const until = v.phase === 'countdown' ? v.startsAt ?? 0 : v.phaseUntil, left = Math.ceil(until - f.snapshot.serverTime);
      if (left !== this.countdown && left >= 0) { this.countdown = left; this.count(now, team, v.phase === 'countdown' ? 'GET READY' : 'KICKOFF', left > 0 ? String(left) : 'GO!', 1000); }
    } else if (this.countdown > 0 && v.phase === 'live' && !v.practice) { this.countdown = 0; this.count(now, team, v.mode === 'goal-rush' ? 'KICKOFF' : 'SERVE', 'GO!', 700); }
    this.replayTag(v, f);
    // (No glowing edges on the volleyball rules - the FEVER word on the score bug says it.)
    this.moodKind.set(v.phase === 'over' || v.phase === 'lobby' ? '' : v.mode === 'sky-spike' && v.fever && !v.volley ? 'fever' : v.mode === 'goal-rush' && v.overtime ? 'overtime' : '');
    this.draw(now, rest, keys);
    this.edgeArrow(v, f);
  }

  /** The banner and the line as they stand this tick, written when either changes. The line: the banner's own detail
   *  while one is up, else the newest moment's, else what the match says at rest (and the keys it teaches). */
  private draw(now: number, rest: string, keys: string) {
    const banner = this.banners.frame(now);
    if (banner !== this.bannerShown) {
      this.bannerShown = banner; this.bannerOn.set(!!banner);
      // (The speech bubbles keep out of its place while it is up: render/ball/BallTags.ts.)
      ballSpeech.banner = !!banner;
      if (banner) { this.bannerKind.set(banner.kind); this.bannerTeam.set(banner.team); this.bannerTop.set(banner.top); this.bannerLine.set(banner.line); this.bannerTitle.set(banner.title); pulse(this.banner, 'pulse'); }
    }
    const said = banner?.line ? null : this.lines.frame(now);
    const text = banner?.line || said?.text || rest, key = banner?.line || said ? '' : keys;
    this.lineText.set(text); this.lineKeys.set(key);
    this.lineTeam.set(banner?.line ? banner.team : said ? said.team : ''); this.lineKind.set(banner?.line ? 'banner' : said ? said.kind : 'rest');
    this.lineOn.set(!!text || !!key);
    // A new line comes in with a flick; the clock's words at rest do not.
    const shown = banner?.line || said?.text || '';
    if (shown !== this.lineShown) { this.lineShown = shown; if (shown) pulse(this.line, 'pulse'); }
  }

  /** The POWER PLAY: while a side of Goal Rush has a body wiped out, the bug's middle reads the count -
   *  red's bodies in play, then blue's (3 v 2, 2 v 3, 3 v 1), the short side's number dim - where the heat was; the
   *  wiped-out faces fade (roster). */
  private powerCount(v: BallView) {
    const short = v.mode === 'goal-rush' && !v.practice && (v.phase === 'live' || v.phase === 'kickoff' || v.phase === 'scored') ? shortSide(v.seats) : null;
    const n = short ? inPlay(v.seats) : null, key = n ? `${short}:${n.red}:${n.blue}` : '';
    if (key === this.powerShown) return;
    this.powerShown = key; this.power.set(short ?? '');
    if (n) { this.powerRed.set(String(n.red)); this.powerBlue.set(String(n.blue)); }
  }

  private roster(v: BallView, f: ModeHudFrame) {
    const key = v.seats.map(s => `${s.id}:${s.team}:${s.fighter}`).join('|');
    if (key !== this.rosterKey) {
      this.rosterKey = key;
      for (const slot of this.slots) slot.root.remove();
      this.slots = [];
      for (const seat of v.seats) {
        // (SPORT mode's keeper, a fourth body the game plays, is not one of the three faces a side.)
        if (seat.keeper) continue;
        const root = el('div', `bh-face ${seat.team}`, this.faces[seat.team]);
        const face = new Face(el('span', '', root)); face.set(seat.fighter);
        root.title = nameOf(seat);
        if (seat.id === f.self.id) root.classList.add('self');
        this.slots.push({ seat: seat.id, root, face });
      }
    }
    for (const slot of this.slots) {
      const seat = v.seats.find(s => s.id === slot.seat);
      slot.root.classList.toggle('touch', v.ball.lastId === slot.seat);
      slot.root.classList.toggle('gone', !!seat?.disconnected);
      // (Wiped out - the POWER PLAY's missing body - faded on the bug while they are off.)
      slot.root.classList.toggle('out', seat?.out !== undefined);
    }
  }

  /** Each seat's strip at the foot of its view (SeatStrip), the count back in from a wipe-out, and
   *  `#interface[data-ball-stance]` for the touch layer's button (its label: what a tap does - FIGHT from the ball, BALL
   *  from a fight). The stance's key is shown while the match is young and at each kickoff. On a split screen the second
   *  seat has a strip of its own in its own half (couch/CouchHud.ts lays the halves), its stance the room's word for it
   *  (the seat's `lock`), and neither names keys: each seat's are its own device's, which the mode HUD is not told. */
  private seats(v: BallView, f: ModeHudFrame, own: BallSeat | undefined) {
    const half = this.combat?.querySelector<HTMLElement>('.couch-view[data-seat="1"]') ?? null, split = !!half;
    const keyed = f.input !== 'touch' && !split, at = { device: f.input, family: f.family };
    const stances = hasStances(v) && v.phase !== 'lobby' && v.phase !== 'over';
    const on = stances && !!own && own.out === undefined, lock = on ? hudView.ballLock() : null;
    const teach = f.snapshot.serverTime - v.startedAt < 40 || v.phase === 'kickoff' || v.phase === 'countdown';
    // (The football strip's fade - FOOT_STRIP.)
    let quiet = false;
    if (v.football && keyed) {
      const dt = Number.isFinite(footStrip.lastNow) ? Math.min(.25, Math.max(0, (f.now - footStrip.lastNow) / 1000)) : 0; footStrip.lastNow = f.now;
      if (pauseOpen()) footStrip.backUntil = f.now + FOOT_STRIP.back * 1000;
      else if (v.phase === 'live' && !v.replay) footStrip.seen += dt;
      quiet = footStrip.seen >= FOOT_STRIP.first && f.now > footStrip.backUntil;
    }
    const kind = this.strip.update(v, f.self, lock, on, f.snapshot.players, {
      boost: keyed ? promptKey('dash', at) : '', super: keyed ? promptKey('ultimate', at) : '',
      stance: keyed && (teach || v.football) ? promptText(lock ? `{target} ${v.football ? 'SPORT' : 'BALL'}` : '{target} FIGHT', at) : '',
      // (SPORT mode: the buttons and the camera's state - its key while the match is young, its state always.)
      legend: v.football ? footLegend(keyed, at) + (keyed ? ` <kbd>${f.input === 'controller' ? 'L3' : 'V'}</kbd> ` : ' ') + hudView.goalLook() : '', quiet,
    });
    if (this.root) { if (kind) this.root.dataset.ballStance = kind; else delete this.root.dataset.ballStance; }
    const two = half ? f.snapshot.players.find(p => p.id === SECOND) : undefined, seat = two ? v.seats.find(s => s.id === SECOND) : undefined;
    if (half && two && seat) {
      this.second ??= new SeatStrip(half, true);
      if (this.second.root.parentElement !== half) half.append(this.second.root);
      this.second.update(v, two, seat.lock ?? null, stances && seat.out === undefined, f.snapshot.players, { boost: '', super: '', stance: '' });
      // (The second seat has no prediction of its own on this page: its charge is the room's word, at the HUD's pace.)
      this.second.shot(two.action === 'heavy' && two.strike === 'charge' ? two.charge ?? 0 : null, f.now);
    } else if (this.second) { this.second.remove(); this.second = undefined; }
    const left = own?.out !== undefined ? own.out - f.snapshot.serverTime : 0;
    const out = left > 0 ? `WIPED OUT · BACK IN ${left.toFixed(1)}` : '';
    if (out !== this.shownOut) { this.shownOut = out; this.outText.set(out); this.outOn.set(!!out); }
  }

  /** A banner for the one slot: `rank` is what it is worth (ballBanner.ts BANNER_RANK); its `line` is shown under the
   *  score while it is up. */
  private show(now: number, rank: number, kind: string, team: BallTeam | '', top: string, title: string, line: string, ms: number) {
    quietCounts.banners++;
    this.banners.offer({ priority: rank, ms, kind, team, top, title, line }, now);
  }
  /** The kickoff's count: on its beat or not at all. */
  private count(now: number, team: BallTeam, top: string, title: string, ms: number) {
    this.banners.offer({ priority: BANNER_RANK.count, ms, urgent: true, kind: 'count', team, top, title, line: '' }, now);
  }
  /** A line under the score: who did what. */
  private tick(now: number, team: BallTeam | undefined, text: string, kind = '', rank: number = LINE_RANK.strike) {
    quietCounts.lines++;
    this.lines.offer({ priority: rank, ms: LINE_MS, text, team: team ?? '', kind }, now);
  }

  private moment(e: BallEvent, v: BallView, team: BallTeam, now: number) {
    const seat = (id?: string) => v.seats.find(s => s.id === id);
    const who = nameOf(seat(e.actorId)), mine = e.team === team, shot = e.shot ? SHOT_NAMES[e.shot] : '';
    const speed = e.value ? `${Math.round(e.value * (e.kind === 'goal' || e.kind === 'own-goal' ? 1 : KMH))} KM/H` : '';
    const R = BANNER_RANK;
    // (LEARN TO PLAY keeps no score - a goal or point to the other side is a step's miss, which the lesson's own
    // line says, not a banner that stood over the next step's start for two seconds; the person's own side's moment keeps
    // its banner without the score's words.)
    const scored = e.kind === 'goal' || e.kind === 'own-goal' || POINT_WON.has(e.kind) || POINT_GIVEN.has(e.kind);
    if (v.lesson && scored && !mine) return;
    const lesson = !!v.lesson && scored;
    // (SPORT mode, `?football`: the banner and the line under the score are a goal's - and a great save's (GREAT_SAVE) -
    // and the FIGHT stance's own; never a pass, a first touch, an ordinary shot or save.)
    if (v.football && sportQuiet && !(SPORT_SAID.has(e.kind) || e.kind === 'save' && greatSave(e))) return;
    switch (e.kind) {
      case 'goal': {
        const assist = seat(e.assistId);
        // (A goal into a short side's goal is the POWER PLAY's - named in the banner's line, its count first,
        // and in the ticker after it; no print of its own.)
        const power = e.short ? `POWER PLAY GOAL · ${e.short[0]} V ${e.short[1]}` : '';
        this.show(now, R.score, 'goal', e.team ?? '', lesson ? '' : mine ? 'YOUR TEAM SCORES' : `${BALL_TEAM_NAMES[e.team!]} SCORES`, e.text === 'SUPER GOAL' ? 'SUPER GOAL!!' : 'GOOOAL!!',
          [power, who, shot, speed, assist ? `ASSIST ${nameOf(assist)}` : ''].filter(Boolean).join(' · '), v.drill || v.lesson ? 1500 : 3600); // (A drill's next ball comes a breath after, and LEARN TO PLAY's: its banner goes before it does.)
        if (power) this.tick(now, e.team, `${power} · ${who}`, 'accolade', LINE_RANK.named);
        break;
      }
      case 'own-goal': this.show(now, R.score, 'goal', e.team ?? '', `${BALL_TEAM_NAMES[e.team!]} SCORES`, 'OWN GOAL!', who, 3200); break;
      case 'save': this.show(now, R.stop, 'save', e.team ?? '', mine ? 'DENIED' : 'STOPPED', e.text === 'PERFECT SAVE' ? 'PERFECT SAVE!' : e.text === 'DIVING SAVE' ? 'DIVING SAVE!' : e.text === 'OFF THE LINE' ? 'OFF THE LINE!' : 'SAVE!', who, 1600); break;
      case 'post': this.tick(now, e.team, `${e.text ?? 'OFF THE POST!'} ${who}`, '', LINE_RANK.named); break;
      case 'overtime': this.show(now, R.turn, 'overtime', '', 'ALL SQUARE', 'OVERTIME', 'NEXT GOAL WINS', 2600); break;
      // Each fighter's super shot by its own name (game/ball/superShots.ts). Its cut-in (ui/ball/BallShow.ts) names it
      // big; the banner only where the VISUAL EFFECTS level leaves the cut-in out.
      // (VOLLEYBALL: the SUPER SHOT is a touch - its own show, and no line or banner under the score.)
      case 'super': if (v.volley) break; if (VFX.level !== 'minimal') { this.tick(now, e.team, `${who} · ${superShotName(seat(e.actorId)?.fighter)}`, 'accolade', LINE_RANK.named); break; }
        this.show(now, R.duel, 'super', e.team ?? '', `${who} · SUPER SHOT`, superShotName(seat(e.actorId)?.fighter), v.mode === 'goal-rush' ? `A GOAL FROM IT COUNTS ${GOAL_RULES.superGoal}` : 'INTO THE EMPTIEST CORNER', 1900); break;
      case 'duel': this.show(now, R.duel, 'clash', e.team ?? '', `${who} MEETS ${superShotName(seat(e.targetId)?.fighter)}`, 'TECHNIQUE DUEL!!', 'A PERFECT GUARD AGAINST A SUPER SHOT', 1200); break;
      case 'duel-won': this.show(now, R.duel, e.text === 'SHOT STOPPED' ? 'save' : 'super', e.team ?? '', e.text === 'SHOT STOPPED' ? `${who} WINS THE DUEL` : `${who} BREAKS THROUGH`, e.text === 'SHOT STOPPED' ? 'SHOT STOPPED!!' : 'BREAKS THROUGH!!', nameOf(seat(e.targetId)) ? `OVER ${nameOf(seat(e.targetId))}` : '', 1800); break;
      // (The volleyball rules: a point's words up for VOLLEY_POINT_MS only, small, under the score bug - SPIKED! stood
      // two seconds over the net and the next serve's ball.)
      case 'kill': this.show(now, R.score, 'kill', e.team ?? '', lesson ? '' : mine ? 'POINT' : `${BALL_TEAM_NAMES[e.team!]} POINT`, e.text === 'SUPER SHOT' ? 'SUPER SHOT!!' : e.shot === 'spike' ? 'SPIKED!' : 'KILL!', [who, shot, (e.value ?? 1) > 1 ? '×2 FEVER' : ''].filter(Boolean).join(' · '), v.lesson ? 1500 : v.volley ? VOLLEY_POINT_MS : 2400); break;
      case 'ace': this.show(now, R.score, 'ace', e.team ?? '', lesson ? '' : mine ? 'POINT' : `${BALL_TEAM_NAMES[e.team!]} POINT`, 'ACE!', who, v.lesson ? 1500 : v.volley ? VOLLEY_POINT_MS : 2400); break;
      case 'out': this.show(now, R.score, 'out', e.team ?? '', `${BALL_TEAM_NAMES[e.team!]} POINT`, 'OUT!', who ? `OFF ${who}` : '', v.volley ? VOLLEY_POINT_MS : 1900); break;
      case 'touches': this.show(now, R.score, 'out', e.team ?? '', `${BALL_TEAM_NAMES[e.team!]} POINT`, 'FOUR TOUCHES!', `${SPIKE_RULES.touches} A SIDE`, v.volley ? VOLLEY_POINT_MS : 1900); break;
      // (Sky Spike's block stands under the score now, over the net it was struck at, while the ball is live.)
      // (Goal Rush's TRAP - twenty a match - is the sport's first touch: no line under the score, which a
      // PERFECT GUARD keeps; its mark and its thud are the pitch's.)
      case 'block': case 'perfect':
        // (VOLLEYBALL: a block is a touch - its word over the blocker; the banner is the points'.)
        if (v.volley) break;
        if (v.mode === 'sky-spike') this.show(now, R.stop, 'save', e.team ?? '', who, e.kind === 'perfect' ? 'STUFF BLOCK!' : 'BLOCK!', '', 1400);
        else if (e.text && e.text !== 'TRAP') this.tick(now, e.team, `${e.text} · ${who}`, '', LINE_RANK.named);
        break;
      // (Goal Rush's FINAL PUSH: the last half minute of a match in reach - the ball burns, the side behind charges.)
      // (Sky Spike's FEVER point counts double to the side behind - the event's team - or to either side level.)
      case 'fever': this.show(now, R.turn, 'fever', v.mode === 'goal-rush' ? '' : e.team ?? '', v.mode === 'goal-rush' ? `${e.value ?? 30} SECONDS LEFT` : `RALLY ${e.value}`, v.mode === 'goal-rush' ? 'FINAL PUSH!' : 'FEVER RALLY!',
        v.mode === 'goal-rush' ? 'THE BALL BURNS' : e.team ? (mine ? 'YOUR POINT COUNTS DOUBLE' : `${BALL_TEAM_NAMES[e.team]}'S POINT COUNTS DOUBLE`) : 'EVERY POINT COUNTS DOUBLE', 2400); break;
      case 'rally': this.tick(now, undefined, e.text ? `${e.text} · RALLY ${e.value}` : `RALLY ${e.value}!`, '', LINE_RANK.named); break;
      case 'match-point': this.show(now, R.turn, 'match', e.team ?? '', BALL_TEAM_NAMES[e.team!], 'MATCH POINT', '', 1800); break;
      case 'side-out': break;
      case 'target': this.show(now, R.skill, 'save', team, (e.value ?? 1) > 1 ? `STREAK ${e.value}` : 'FREE PLAY', (e.value ?? 1) >= 3 ? `${e.value} IN A ROW!` : 'TARGET!', `BEST STREAK ${v.bestStreak}`, 1300); break;
      case 'clash': this.show(now, R.duel, 'clash', e.team ?? '', `${who} OVERPOWERS ${nameOf(seat(e.targetId))}`, 'CLASH!!', speed, 1500); break;
      case 'accolade': this.tick(now, e.team, `${e.text ?? ''}! · ${e.assistId ? `${nameOf(seat(e.assistId))} ▸ ${who}` : who}`, 'accolade', LINE_RANK.named); break;
      case 'charm': this.tick(now, e.team, `${who} · ${e.text ?? ''}${e.charm ? ` · ${charmLine(e.charm, v.mode)}` : ''}`, 'charm', LINE_RANK.named); break;
      case 'shield': this.show(now, R.stop, 'save', e.team ?? '', who ? `${who} · ${mine ? 'SAVED' : 'DENIED'}` : 'DENIED', `${e.text ?? 'IRON WALL'}!`, v.mode === 'goal-rush' ? 'THE GOAL WAS SEALED' : 'THE BALL BOUNCED BACK UP', 1600); break;
      // What the bots and people say (their plans, quick chat): a speech bubble over the speaker, in the world
      // (render/ball/BallTags.ts; it was a feed of lines down the right edge).
      case 'chat': if (e.actorId && e.text) ballSpeech.say(e.actorId, e.team ?? 'red', e.text, now); break;
      // Goal Rush's fights (GOAL_FIGHT): your own wipe-out a banner, anyone else's and every bump a line.
      case 'wipeout': {
        const down = nameOf(seat(e.targetId)), self = v.seats.find(s => s.id === this.selfId);
        // (The wipe-out that makes a POWER PLAY says its count.)
        const short = v.mode === 'goal-rush' && !v.practice ? shortSide(v.seats) : null, n = inPlay(v.seats), power = short ? `POWER PLAY · ${n.red} V ${n.blue}` : '';
        if (e.targetId === this.selfId) this.show(now, R.fight, 'out', e.team ?? '', who ? `BY ${who}` : 'DOWN', 'WIPED OUT!', `BACK IN ${Math.round(e.value ?? 3)} S`, 1500);
        else if (e.actorId === this.selfId) this.show(now, R.fight, 'kill', self?.team ?? '', down, 'WIPED OUT!', [e.text, power].filter(Boolean).join(' · '), 1300);
        else this.tick(now, e.team, `${who || 'DOWN'} ${who ? 'WIPES OUT' : ''} ${down}${power ? ` · ${power}` : ''}`.replace(/\s+/g, ' ').trim(), '', LINE_RANK.fight);
        break;
      }
      case 'demo': this.tick(now, e.team, `${who} BUMPS ${nameOf(seat(e.targetId))} · ${Math.round((e.value ?? 0) * KMH)} KM/H`); break;
      // Goal Rush's FIGHT stance (game/ball/model.ts GOAL_STANCE): yours a banner, anyone's a line.
      case 'tackle': {
        // (A TACKLE that knocked the ball off its carrier says so - BALL WON - on the tackler's banner and
        // in everyone's line.)
        const down = nameOf(seat(e.targetId)), big = e.text === 'TAKEDOWN';
        if (e.actorId === this.selfId) this.show(now, R.fight, 'tackle', e.team ?? '', `${down} · ${e.won ? 'BALL WON' : 'OFF THE BALL'}`, big ? 'TAKEDOWN!!' : 'TACKLE!', '', big ? 1400 : 1000);
        else this.tick(now, e.team, `${who} ${big ? 'TAKES DOWN' : 'TACKLES'} ${down}${e.targetId === this.selfId ? ' · YOU' : ''}${e.won ? ' · BALL WON' : ''}`, 'tackle', LINE_RANK.fight);
        break;
      }
      // (A REVERSAL - a guard timed against a tackle - is named small, as a touch is: a line under the
      // score, the guard's side's.)
      case 'reversal': {
        const down = nameOf(seat(e.targetId));
        this.tick(now, e.team, e.actorId === this.selfId ? `REVERSAL! · ${down} DOWN` : e.targetId === this.selfId ? `${who} · REVERSAL · YOU'RE DOWN` : `${who} · REVERSAL · ${down} DOWN`, 'tackle', LINE_RANK.fight);
        break;
      }
      case 'bowled': this.tick(now, e.team, `${who || 'THE BALL'} ${e.text === 'STAGGERED' ? 'STAGGERS' : 'BOWLS OVER'} ${nameOf(seat(e.targetId))} · ${Math.round((e.value ?? 0) * KMH)} KM/H`); break;
      // (VOLLEYBALL: a touch's tier is a word over the fighter who made it - render/ball/touchWord.ts - not a
      // line under the score; the line and the banner are the points'.)
      case 'touch': break;
      // (Goal Rush: your own PERFECT STRIKE - PERFECT VOLLEY, PERFECT HEADER - is a short gold banner.)
      case 'strike':
        if (v.volley) break;
        if (e.perfect && v.mode === 'goal-rush' && e.actorId === this.selfId) this.show(now, R.skill, 'perfect', e.team ?? '', speed, `${e.text ?? 'PERFECT STRIKE'}!`, '', 1000);
        else if (e.shot && e.shot !== 'tap' && e.shot !== 'bump' && e.shot !== 'set') this.tick(now, e.team, [who, e.perfect ? (v.mode === 'sky-spike' ? 'PERFECT SPIKE' : e.text ?? 'PERFECT STRIKE') : e.text ?? shot, speed].filter(Boolean).join(' · '));
        break;
      case 'win': {
        const winner = e.team;
        this.show(now, R.win, 'win', winner ?? '', winner ? (winner === team ? 'VICTORY' : 'DEFEAT') : 'FULL TIME', winner ? `${BALL_TEAM_NAMES[winner]} WIN` : 'DRAW', `${v.score.red} – ${v.score.blue}`, 4200);
        break;
      }
      default: break;
    }
    void otherTeam;
  }

  /** RUMBLE's charms at work: a chip each, rebuilt only when what it says changes. */
  private charmChips(v: BallView, f: ModeHudFrame, team: BallTeam) {
    const t = f.snapshot.serverTime, live = v.rumble ? v.effects.filter(e => e.until > t) : [];
    const key = live.map(e => `${e.kind}:${e.team}:${e.id}:${Math.ceil(e.until - t)}`).join('|');
    if (key === this.charmsKey) return;
    this.charmsKey = key;
    this.charms.replaceChildren(...live.map(e => {
      const chip = document.createElement('span'); chip.className = `bh-charm ${e.team}`;
      chip.style.setProperty('--c', `#${CHARM_COLOURS[e.kind].toString(16).padStart(6, '0')}`);
      const holder = e.id === f.self.id ? 'YOU' : e.kind === 'wall' || e.kind === 'feather' || e.kind === 'giant' || e.kind === 'ice' ? BALL_TEAM_NAMES[e.team] : nameOf(v.seats.find(s => s.id === e.id));
      chip.textContent = `${charmName(e.kind, v.mode)} · ${holder} · ${Math.ceil(e.until - t)}`;
      if (e.team === team) chip.classList.add('ours');
      return chip;
    }));
  }

  /** While a replay shows (render/ball/BallReplay.ts): its tag, the fight's own plates and cards put away, the banner
   *  that was up let go. */
  private replayTag(v: BallView, f: ModeHudFrame) {
    const r = v.replay, t = f.snapshot.serverTime, on = !!r && v.phase === 'scored' && t >= r.at && t < r.until;
    this.replayOn.set(on);
    // In and out of it, a wipe in the scorer's colour across the cut.
    if (on !== this.replayShown) { this.replayShown = on; this.wipeTeam.set(r?.team ?? ''); pulse(this.wipe, 'pulse'); }
    if (this.root) { if (on) this.root.dataset.ballReplay = ''; else delete this.root.dataset.ballReplay; }
    if (!on || !r) { this.replayKey = ''; return; }
    const key = `${r.from}:${r.to}`;
    if (key !== this.replayKey) {
      this.replayKey = key; this.banners.clear(); this.replayTeam.set(r.team ?? '');
      const who = nameOf(v.seats.find(s => s.id === r.actorId)), shot = r.shot ? SHOT_NAMES[r.shot] : '';
      this.replayLine.set([r.text ?? (r.kind === 'goal' ? 'GOAL' : ''), who, r.text === 'OWN GOAL' ? '' : shot, r.speed ? `${r.speed} KM/H` : ''].filter(Boolean).join(' · '));
    }
    const votes = r.people && r.people > 1 && r.skips ? ` · ${r.skips}/${r.people}` : '';
    this.replaySkip.set(f.input === 'touch' ? `TAP TO SKIP${votes}` : promptText(`{jump} SKIP${votes}`, { device: f.input, family: f.family }));
  }

  /** Every frame: the page's own SHOOT's charge into its strip, read off the page's own
   *  prediction (render/ball/ownShot.ts) - online the room's word on it is a round trip and more late, and the readout
   *  filled as the ball was already on its way. A page that predicts nothing reads its own state as last told. */
  private shotFrame() {
    this.timerFrame();
    if (!this.strip || !this.selfId) return;
    const now = performance.now(), self = this.lastSelf;
    if (ownShot.read()) { const c = ownCharge(this.selfId); this.strip.shot(c ? c.charge : null, now, !!c && chargeFull(c)); }
    else this.strip.shot(self?.action === 'heavy' && self.strike === 'charge' ? self.charge ?? 0 : null, now);
  }

  /** The prompt's timing bar (VOLLEY_TIMER), every frame: full on the moment to press, gold inside PERFECT. */
  private timerFrame() {
    const t = this.timed;
    if (!t || !this.timer) { this.timerOn?.set(false); return; }
    let fill = NaN, now = false;
    if (t.kind === 'touch') { const left = (t.at - performance.now()) / 1000; if (left > -.2) { fill = 1 - left / VOLLEY_TIMER.lead; now = Math.abs(left) <= VOLLEY.tier.perfect; } }
    else { const c = ownCues.state; if (t.kind === 'jump' && c && Number.isFinite(c.beat)) { fill = 1 - c.beat / VOLLEY_TIMER.lead; now = c.beat <= .03; } else if (c && Number.isFinite(c.air)) { fill = c.air; now = c.air >= 1; } }
    if (!Number.isFinite(fill)) { this.timerOn.set(false); return; }
    this.timerOn.set(true); this.timerNow.set(now);
    this.timerFill.style.transform = `scaleX(${Math.min(1, Math.max(0, fill)).toFixed(3)})`;
  }

  /** An arrow at the screen's edge toward the ball when the view has lost it. */
  private edgeArrow(v: BallView, f: ModeHudFrame) {
    const camera = hudView.camera, b = v.ball;
    const live = v.phase === 'live' || v.phase === 'kickoff';
    if (!camera || !live) { this.arrowOn.set(false); return; }
    readEdge(camera, b.x, b.y, b.z, this.edge, .06);
    this.arrowOn.set(!this.edge.onScreen);
    if (this.edge.onScreen) return;
    const zone = this.arrow.parentElement, w = zone?.clientWidth ?? 1600, h = zone?.clientHeight ?? 900;
    // (On the touch controls it stays above the sports set's buttons down the right: input/sportTouch.ts, JUMP's top.)
    const x = this.edge.side > 0 ? w - (v.football ? 205 : 70) : 16, y = Math.max(60, Math.min(h - (f.input === 'touch' ? 216 : 120), (this.edge.height * .5 + .5) * h));
    this.arrow.style.transform = `translate(${x}px,${y}px)`;
    this.arrow.dataset.side = this.edge.side > 0 ? 'r' : 'l';
    this.arrow.dataset.team = b.lastTeam ?? '';
    if (v.football) this.arrow.dataset.foot = ''; else delete this.arrow.dataset.foot;
    void f;
  }

  unmount() { if (this.shotLoop && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(this.shotLoop); this.shotLoop = 0; this.lastSelf = undefined; this.hints.clear(); ballSpeech.clear(); if (this.root) { delete this.root.dataset.ballReplay; delete this.root.dataset.ballLive; delete this.root.dataset.ballStance; delete this.root.dataset.ballVolley; delete this.root.dataset.ballFoot; } this.strip?.remove(); this.second?.remove(); this.second = undefined; this.live = false; this.replay?.remove(); this.wipe?.remove(); this.mood?.remove(); this.chatButton?.remove(); this.replayKey = ''; this.replayShown = false; this.board?.remove(); this.line?.remove(); this.banner?.remove(); this.banners.clear(); this.bannerShown = null; this.lines.clear(); this.lineShown = ''; this.charms?.remove(); this.charmsKey = ''; this.prompt?.remove(); this.timer?.remove(); this.timed = null; this.arrow?.remove(); this.out?.remove(); this.shownOut = ''; this.slots = []; this.rosterKey = ''; this.lastEvent = 0; this.countdown = -1; }
}
