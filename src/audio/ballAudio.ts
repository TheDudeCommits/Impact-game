import { BALL_ID, GOAL_RULES, POINT_GIVEN, POINT_WON, SPIKE_RULES, ballOf, heatTier, servedPoint, type BallEvent, type BallState, type BallTeam, type BallView, type CharmKind, type ShotKind } from '../game/ball/model';
import { stepBall, type BallContact } from '../game/ball/physics';
import type { GameSnapshot, Vec3 } from '../game/types';
import { BallCaller, callerFiles, type CallerMoment, type CallerVoice } from './ballCaller';
/** The caller's FEVER lines that say every point counts double (caller.json fever-1, fever-4), not said while a FEVER
 *  point is worth two to the side behind alone (BallMatch SWINGS.feverBehind). */
const FEVER_FOR_EVERYONE = /\/fever-[14]\.[a-z0-9]+$/;

/** Goal Rush's and Sky Spike's own sound.
 *
 *  - The ball itself: every strike by what it was (a tap, a power shot, a volley, a curve, a blast, an eruption, a SUPER
 *    SHOT), every bounce by what it met and how hard (the Ink Bowl's turf and glass, the Sky Court's planks, net, cord
 *    and dome), the post and the bar, the goal's net; heat catching tier by tier and OVERDRIVE's roar held on the ball;
 *    a CLASH charging and breaking, the SKY SPIKE's crack, blocks, a hot ball bowling a fighter over, the charms, the ball
 *    machine, a target. Bounces and light touches come from the ball's own flight (physics.ts stepped between two
 *    snapshots, as every page runs it), not from the network: no event per bounce.
 *  - The referee: kickoff, goal, OVERTIME and full time; Sky Spike's serve, point and side-out.
 *  - The stands: their bed rides the match's tension (the ball near a goal or the net, its heat, how close the score
 *    is, OVERTIME, FEVER), quiet under play and loud at the peaks; they "ooh" at a near miss and a save, gasp at the post,
 *    roar for a goal or a kill, chant under pressure, whistle the other side's SUPER SHOT. The home side - the local
 *    player's - is louder.
 *  - The caller (ballCaller.ts) for the big moments, and the music (CharacterMusic): a climax track and a push in heat.
 *
 *  Files: public/assets/audio/ball/<id>.m4a, made for the game (synthesised, or layered from CC0 recordings; each one's
 *  sources in that folder's manifest.json), levelled by family; their gains here. */

const url = (id: string) => `/assets/audio/ball/${id}.m4a`;
/** Each sound's gain (its file is levelled by family: impacts -14 LUFS, lights -17, bounces -16, whistles -16,
 *  accents -17, loops -19, the stands -18, the stadium -15, over its loudest 400 ms). */
export const BALL_SFX = {
  'strike-tap-1': .62, 'strike-tap-2': .62, 'strike-power-1': .72, 'strike-power-2': .72, 'strike-volley': .7, 'strike-curve': .68,
  'strike-blast': .7, 'strike-eruption': .74, 'strike-super': .9, 'strike-dig': .64,
  'bounce-turf-soft': .62, 'bounce-turf-hard': .66, 'bounce-glass-1': .6, 'bounce-glass-2': .6, 'bounce-wood-soft': .6, 'bounce-wood-hard': .66,
  'bounce-net': .6, 'bounce-cord': .55, 'bounce-dome': .55,
  post: .85, bar: .85, 'goal-net': .7,
  'whistle-kickoff': .5, 'whistle-goal': .5, 'whistle-overtime': .5, 'whistle-fulltime': .52, 'whistle-serve': .4, 'whistle-point': .42, 'whistle-sideout': .4,
  'heat-1': .42, 'heat-2': .48, 'heat-3': .55, 'heat-4': .72, 'overdrive-loop': .36,
  'clash-charge': .7, 'clash-break': .82, 'spike-crack': .85, block: .72, 'block-stuff': .82, bowled: .7,
  'charm-power': .55, 'charm-feather': .55, 'charm-giant': .55, 'charm-ice': .55, 'charm-guard': .55, 'charm-hook': .55, 'shield-hit': .72,
  'machine-launch': .6, 'target-hit': .55,
  'crowd-ooh-1': .8, 'crowd-ooh-2': .8, 'crowd-gasp': .85, 'crowd-roar-1': 1, 'crowd-roar-2': 1, 'crowd-applause': .7, 'crowd-groan': .75,
  'crowd-jeer': .75, 'crowd-chant': .55,
  'goal-horn': .55, 'goal-burst': .72, 'riser-overtime': .5, 'riser-fever': .5,
  // The weight under the biggest hits, a spike slammed into the court, a wipe-out.
  'impact-boom': .72, 'spike-slam': .88, 'wipeout-hit': .86,
} as const;
export type BallSfx = keyof typeof BALL_SFX;
/** The loops' seamless periods (sound.py writes each period with 0.3 s of it again on either side). */
export const BALL_LOOPS: Partial<Record<BallSfx, readonly [number, number]>> = { 'overdrive-loop': [.3, 3.3], 'crowd-chant': [.3, 8.3] };
export const ballSfxUrl = (id: BallSfx) => url(id);
export const ballSoundFiles = () => (Object.keys(BALL_SFX) as BallSfx[]).map(url);

/** A blow's effects on the ball, against its own sound (CombatAudio.soften): the fighter's colour under the ball. */
export const BLOW_SHARE = .45;
/** The shot a strike made, heard as (taps, bumps and sets come without an event: the flight finds them). */
const STRIKE: Partial<Record<ShotKind, BallSfx[]>> = {
  tap: ['strike-tap-1', 'strike-tap-2'], bump: ['strike-tap-1', 'strike-tap-2'], set: ['strike-tap-2', 'strike-tap-1'], header: ['strike-tap-2'],
  drive: ['strike-power-2'], power: ['strike-power-1', 'strike-power-2'], pop: ['strike-volley'], volley: ['strike-volley'], spike: ['strike-volley'],
  curve: ['strike-curve'], sinker: ['strike-curve'], blast: ['strike-blast'], eruption: ['strike-eruption'], super: ['strike-super'],
  serve: ['strike-tap-1'], dig: ['strike-dig'], save: ['strike-power-2'], block: ['block'],
};
/** Each charm by its family. */
const CHARM: Record<CharmKind, BallSfx> = { charge: 'charm-power', surge: 'charm-power', feather: 'charm-feather', giant: 'charm-giant', ice: 'charm-ice', wall: 'charm-guard', magnet: 'charm-hook' };
/** The other side's moments in the stands, against the home side's (the local player's). */
const AWAY = .6;
/** A ball that bounces this soon after the last bounce sound is not heard again (a roll's chatter), seconds. */
const BOUNCE_GAP = .06;
/** When the caller calls the result: after the finale's VICTORY! (main.ts says it 0.55 s into the end), seconds. */
const RESULT_CALL = 1.9;
/** Heat catching again at a tier no higher than the last heard waits this long (s): a ball heats and cools all match. */
const HEAT_REST = 3;
/** A strike this fast (m/s off the boot) or faster has the boom laid under it. */
const BOOM_FROM = 28;
/** A bounce this hard (m/s into the surface) or harder is the hard take. */
const HARD = { 'goal-rush': 9, 'sky-spike': 8 } as const;
/** The names a moment may carry (an event's `text`: a strike's, a serve's, or an event
 *  of a kind this file does not know yet) that the caller has lines for, so a round that adds one is called the moment
 *  it emits it. A Goal Rush strike with `perfect: true` is a perfect strike whatever its name; a Sky Spike one is a
 *  PERFECT SPIKE (its text SKY SPIKE). */
export const CALLED_TEXT: Readonly<Record<string, CallerMoment>> = {
  'PERFECT STRIKE': 'perfect-strike', 'PERFECT SHOT': 'perfect-strike', 'PERFECT SERVE': 'perfect-strike', 'PERFECT VOLLEY': 'perfect-strike',
  'PERFECT SET': 'clever-touch', 'QUICK SET': 'clever-touch', 'BACK SET': 'clever-touch', 'JUMP SET': 'clever-touch',
  TIP: 'clever-touch', DUMP: 'clever-touch', FEINT: 'clever-touch', 'NO-LOOK PASS': 'clever-touch', 'BACKHEEL': 'clever-touch',
};
/** A point won this soon (s) after its side's PERFECT SPIKE is that spike's - the stands' biggest roar. */
const PERFECT_ROAR = 2.5;
/** The stands' "ooh" at the commonest moments (a TACKLE, eleven a match; a DIVING DIG, two dozen) rests this long
 *  (s), so it stays a reaction and not a murmur. */
const OOH_REST = 7;

/** What BallAudio asks of the game's mixer (CombatAudio). */
export interface BallMixer extends CallerVoice {
  sample(url: string, at: Vec3, gain: number, rate?: number, owner?: string, priority?: number, delay?: number): void;
  centred(url: string, gain: number, delay?: number, rate?: number, priority?: number): void;
  stands(url: string, gain: number, delay?: number, rate?: number): void;
  loopAt(key: string, url: string, gain: number, options?: { at?: Vec3; loop?: readonly [number, number]; bus?: 'sfx' | 'ambience'; rate?: number }): void;
  crowdTension(level: number): void;
  soften(id: string, share?: number): void;
  cheer(worth?: number, win?: boolean): void;
}
/** And of the soundtrack (CharacterMusic). */
export interface BallMusic { peak(on: boolean): void; heat(level: number): void; punch(hold: number): void }

/** How worked up a ball match is, 0-1 (the stands' bed, the chant, the music's heat): the ball near a goal mouth or the
 *  net, times its heat, times how close the score is, raised by OVERTIME, the last minute, FEVER and match point. */
export function ballTension(view: BallView): number {
  if (view.practice || view.phase === 'lobby' || view.phase === 'over' || view.phase === 'countdown') return view.practice ? .1 : .15;
  const b = view.ball, heat = .65 + .0875 * Math.min(4, b.heat), gap = Math.abs(view.score.red - view.score.blue);
  let t: number;
  if (view.mode === 'goal-rush') {
    const d = Math.min(Math.hypot(b.x, b.z - GOAL_RULES.halfZ), Math.hypot(b.x, b.z + GOAL_RULES.halfZ));
    const near = Math.max(0, Math.min(1, 1 - (d - 4) / (GOAL_RULES.halfZ * .85))) ** 1.3;
    const close = gap === 0 ? 1 : gap === 1 ? .85 : gap === 2 ? .62 : .45;
    t = (.1 + .9 * near) * heat * close * (view.overtime ? 1.35 : view.clock < 60 ? 1.15 : 1);
  } else {
    const net = Math.max(0, 1 - Math.abs(b.z) / 9) * Math.max(.4, Math.min(1, b.y / 5));
    const rally = Math.min(1, view.rally / 10), lead = Math.max(view.score.red, view.score.blue);
    const close = gap <= 1 ? 1 : gap <= 3 ? .8 : .6, late = lead >= view.target - 2 ? 1.15 : 1;
    t = (.15 + .35 * net + .5 * rally) * heat * close * late * (view.fever ? 1.3 : 1);
  }
  if (view.phase === 'scored' || view.phase === 'kickoff') t *= .55;
  return Math.max(0, Math.min(1, t));
}

/** One page's ball-mode sound (main.ts ballSounds hands it every snapshot). */
export class BallAudio {
  readonly caller: BallCaller;
  private match = NaN;
  private heard = 0;
  private prev?: BallState;
  private prevTime = 0;
  private prevPhase = '';
  private prevTier = 0;
  private heatHeard = 0;
  private heatHeardAt = -Infinity;
  private prevClock = Infinity;
  private prevBest = 0;
  private lastBounce = -Infinity;
  private taps = 0;
  private flavour = new Map<string, number>();
  private contacts: BallContact[] = [];
  private tension = 0;
  private toldTension = -1;
  private chantFrom = Infinity;
  private chanting = false;
  private calmSince = Infinity;
  private peaked = false;
  private matchPoint = false;
  private lastStrike?: BallEvent;
  /** The last PERFECT SPIKE (the room's time, and its side), for the roar when it is put away; and when the
   *  stands last "oohed" at a common moment (OOH_REST). */
  private perfectSpike: { at: number; team?: BallTeam } | null = null;
  private oohAt = -Infinity;
  private deficit: Record<BallTeam, number> = { red: 0, blue: 0 };
  private comeback = new Set<BallTeam>();
  private loaded = false;
  constructor(private readonly mix: BallMixer, private readonly music?: BallMusic, random: () => number = Math.random, private readonly clock = () => performance.now() / 1000) {
    this.caller = new BallCaller(mix, random, clock);
  }

  /** A snapshot of a ball match: every fresh event heard, the flight's touches and bounces, the heat, the stands, the
   *  caller and the music brought up to it. Returns the fresh events (main.ts lays its camera's punches on them). */
  update(snapshot: GameSnapshot, selfId: string | null | undefined): BallEvent[] {
    const view = ballOf(snapshot);
    if (!view) return [];
    if (!this.loaded) { this.loaded = true; this.mix.preload([...ballSoundFiles(), ...callerFiles()]); this.mix.soften(BALL_ID, BLOW_SHARE); }
    const now = snapshot.serverTime;
    if (view.startedAt !== this.match || now < this.prevTime - 1) this.begin(view);
    const home = view.seats.find(s => s.id === selfId)?.team ?? null;
    const fresh = view.events.filter(e => e.id > this.heard);
    if (fresh.length) this.heard = Math.max(this.heard, ...fresh.map(e => e.id));
    const struck = fresh.some(e => e.kind === 'strike' || e.kind === 'super' || e.kind === 'clash' || e.kind === 'save' || e.kind === 'block' || e.kind === 'perfect');
    for (const e of fresh) this.event(e, view, home, fresh, now);
    this.flight(view, now, struck);
    this.heat(view, now);
    this.phases(view);
    this.stands(view, home, now);
    this.score(view);
    this.prev = { ...view.ball }; this.prevTime = now; this.prevPhase = view.phase; this.prevClock = view.clock; this.prevBest = view.best;
    return fresh;
  }

  /** Out of the ball modes: the loops let go (CombatAudio.reset also stops them) and the blows on the ball sound whole. */
  leave() {
    this.mix.loopAt('ball-overdrive', url('overdrive-loop'), 0); this.mix.loopAt('ball-chant', url('crowd-chant'), 0);
    this.mix.soften(BALL_ID); this.loaded = false; this.match = NaN; this.prev = undefined; this.heard = 0;
  }

  private begin(view: BallView) {
    this.match = view.startedAt; this.heard = Math.max(0, ...view.events.map(e => e.id)); this.prev = undefined;
    this.prevTier = heatTier(view.ball.heat); this.prevClock = view.clock; this.prevBest = view.best; this.peaked = false; this.matchPoint = false;
    this.chanting = false; this.chantFrom = Infinity; this.calmSince = Infinity; this.lastStrike = undefined; this.perfectSpike = null;
    this.deficit = { red: 0, blue: 0 }; this.comeback.clear(); this.caller.reset();
    this.music?.peak(false); this.music?.heat(0);
  }

  /** One of the ball's sounds centred, from outside (the intro's whistle, BallCeremony). */
  cue(id: BallSfx, scale = 1, delay = 0) { this.centred(id, scale, delay); }
  private play(id: BallSfx, at: Vec3, scale = 1, rate = 1, delay = 0, priority = 2) {
    this.mix.sample(url(id), at, BALL_SFX[id] * scale, rate, 'ball', priority, delay);
  }
  private centred(id: BallSfx, scale = 1, delay = 0, rate = 1) { this.mix.centred(url(id), BALL_SFX[id] * scale, delay, rate); }
  private react(id: BallSfx, scale = 1, delay = 0) { this.mix.stands(url(id), BALL_SFX[id] * scale, delay); }
  /** One of a few takes, in turn. */
  private take(ids: readonly BallSfx[], key: string): BallSfx {
    const n = (this.flavour.get(key) ?? 0) + 1; this.flavour.set(key, n);
    return ids[n % ids.length];
  }
  private say(moment: CallerMoment, delay = 0, queue = false, avoid?: RegExp) { this.caller.say(moment, { delay, queue, avoid }); }
  private side(team: BallTeam | null | undefined, home: BallTeam | null) { return !home || !team || team === home ? 1 : AWAY; }

  private event(e: BallEvent, view: BallView, home: BallTeam | null, fresh: BallEvent[], now: number) {
    if (POINT_WON.has(e.kind) || POINT_GIVEN.has(e.kind)) { this.point(e, view, home); return; }
    const at = { x: e.x, y: e.y, z: e.z }, mine = !home || e.team === home, side = this.side(e.team, home);
    const speed = e.value ?? 0, hard = Math.max(.7, Math.min(1.25, .6 + speed / 55));
    switch (e.kind) {
      case 'strike': {
        this.lastStrike = e;
        const sfx = STRIKE[e.shot ?? 'power'] ?? ['strike-power-1'];
        this.play(this.take(sfx, e.shot ?? 'power'), at, hard, .97 + ((e.id * 7) % 7) * .01);
        // The boom under a power shot, by how hard it was struck (and under a SKY SPIKE's crack).
        if (speed >= BOOM_FROM && e.text !== 'SKY SPIKE') this.play('impact-boom', at, Math.min(1, .45 + (speed - BOOM_FROM) / 30), .96 + ((e.id * 5) % 5) * .02, 0, 3);
        // A PERFECT SPIKE (struck from the top of the jump) cracks harder, the stands draw breath as it goes, and
        // roar when it is put away (point); the caller names it.
        if (e.text === 'SKY SPIKE' && e.perfect) {
          this.play('spike-crack', at, 1.1, .96); this.play('impact-boom', at, .75, 1.02, 0, 4);
          this.react('crowd-ooh-2', .7 * side, .08); this.say('perfect-spike', .12); this.perfectSpike = { at: e.at, team: e.team };
        }
        else if (e.text === 'SKY SPIKE') { this.play('spike-crack', at); this.play('impact-boom', at, .5, 1.08, 0, 3); this.say('sky-spike', .15); this.react('crowd-ooh-2', .5 * side, .2); }
        else if (e.text === 'ROLL SPIKE') { this.play('spike-crack', at, .8); this.say('roll-spike', .15); }
        else if (e.text === 'BICYCLE KICK' || e.text === 'AERIAL') this.react('crowd-ooh-1', .45 * side, .15);
        // A LINK SHOT: the crowd and the caller's moment.
        else if (e.text === 'LINK SHOT') { this.react('crowd-ooh-2', .55 * side, .1); this.say('link-shot', .2); }
        // A perfect strike (a Goal Rush strike timed perfectly, whatever its name), or a named one the caller knows.
        else if (e.perfect && view.mode === 'goal-rush') this.named('perfect-strike', at, side);
        else if (e.text && CALLED_TEXT[e.text]) this.named(CALLED_TEXT[e.text], at, side);
        break;
      }
      // A TECHNIQUE DUEL - the clash's charge as the guard meets the shot, then its break; the keeper's side
      // roars when the shot dies on the guard, the striker's when it breaks through.
      case 'duel': this.play('clash-charge', at, 1, 1, 0, 5); this.react('crowd-gasp', .8); this.say('technique-duel', .05); break;
      case 'duel-won':
        this.play('clash-break', at, 1.1, 1, 0, 6); this.mix.cheer(1.2, true);
        this.react('crowd-roar-2', side); if (!mine) this.react('crowd-groan', .5, .25);
        if (e.text === 'SHOT STOPPED') { this.play('block-stuff', at, 1, .9); this.say('duel-won', .2); }
        break;
      case 'super':
        this.lastStrike = e;
        this.play('strike-super', at, 1, 1, 0, 5); this.play('impact-boom', at, 1, .9, 0, 5);
        this.mix.cheer(.9);
        if (mine) this.react('crowd-roar-1', .55); else this.react('crowd-jeer', 1, .15);
        this.say('super-shot', .3);
        break;
      case 'clash': {
        this.play('clash-charge', at, 1, 1, 0, 5);
        const hold = Math.max(.2, Math.min(.8, view.ball.clash > now ? view.ball.clash - now : .5));
        this.play('clash-break', at, 1, 1, hold, 5);
        this.react('crowd-gasp', .7); this.react('crowd-roar-1', .5 * side, hold + .1);
        this.say('clash', .05); this.say('clash-win', hold + .7);
        break;
      }
      case 'save': {
        this.play('strike-power-2', at, .8);
        if (e.text === 'PERFECT SAVE') this.play('impact-boom', at, .55, 1.1, 0, 3);
        // OFF THE LINE - a gasp as it nearly goes in, the long "ooh" of the one that got away, then applause.
        const line = e.text === 'OFF THE LINE';
        if (line) { this.react('crowd-gasp', .6, .02); this.react('crowd-ooh-1', side, .3); this.react('crowd-applause', .7 * side, 1.3); }
        else { this.react(this.take(['crowd-ooh-1', 'crowd-ooh-2'], 'ooh'), side, .1); this.react('crowd-applause', .6 * side, .9); }
        this.say(e.text === 'PERFECT SAVE' ? 'save-perfect' : e.text === 'DIVING SAVE' ? 'save-diving' : line ? 'off-the-line' : 'save', .2);
        break;
      }
      case 'perfect':
        if (e.text === 'STUFF BLOCK') { this.play('block-stuff', at); this.react('crowd-roar-1', .6 * side, .1); this.say('stuff-block', .15); }
        else this.play('block', at, .8);
        break;
      case 'block': this.play('block', at); this.react(this.take(['crowd-ooh-2', 'crowd-ooh-1'], 'ooh'), .55 * side, .1); break;
      case 'post': {
        const bar = e.text === 'CROSSBAR!';
        this.play(bar ? 'bar' : 'post', at, Math.max(.7, Math.min(1.2, .5 + speed / 40)), 1, 0, 4);
        this.react('crowd-gasp', side); this.react(this.take(['crowd-ooh-1', 'crowd-ooh-2'], 'ooh'), .7 * side, .55);
        this.say(bar ? 'crossbar' : 'post', .25);
        break;
      }
      case 'goal': case 'own-goal': this.goal(e, view, home, fresh); break;
      case 'side-out': if (!view.practice) this.centred('whistle-sideout', 1, .95); break;
      case 'serve':
        if (!view.practice) {
          this.centred('whistle-serve', 1, .5);
          if (view.score.red + view.score.blue === 0) this.say('serve', 1.1);
          else if (e.text && CALLED_TEXT[e.text]) this.named(CALLED_TEXT[e.text], at, side);
        }
        break;
      case 'kickoff': if (!view.practice) this.mix.cheer(.5); break;
      case 'overtime':
        this.centred('whistle-overtime'); this.centred('riser-overtime', 1, .35);
        this.react('crowd-roar-1', .75, .5); this.mix.cheer(1.1);
        this.say('overtime', .6);
        break;
      case 'fever':
        this.centred('riser-fever'); this.react('crowd-roar-1', .6, .3); this.mix.cheer(1);
        // (Goal Rush's FINAL PUSH is a 'fever' too: the caller's fever lines are Sky Spike's FEVER RALLY.)
        // (A FEVER point worth double to the side behind alone - the event's team - is never called "every point counts
        // double" or "double points".)
        if (view.mode === 'sky-spike') this.say('fever', .4, false, e.team ? FEVER_FOR_EVERYONE : undefined);
        break;
      case 'match-point': this.matchPoint = true; this.mix.cheer(.8); this.say('match-point', .5); break;
      case 'rally': this.mix.cheer(.5); this.react('crowd-applause', .4, .1); this.say('rally', .2); break;
      case 'bowled': this.play('bowled', at); this.react('crowd-ooh-2', .4 * side, .1); break;
      // Goal Rush's fights heard. A WIPE-OUT: the knockout blow and the boom under it, the stands roaring for
      // their own side's and gasping at the other's. A BUMP: the body flattened, an "ooh".
      // A TAKEDOWN's own wipe-out (the room sends both the same step) is the TAKEDOWN's to call, and its gasp
      // has been heard; the wipe-out's roar for the home side's comes after it.
      case 'wipeout': {
        const takedown = fresh.some(f => f.kind === 'tackle' && f.text === 'TAKEDOWN' && f.targetId === e.targetId);
        this.play('wipeout-hit', at, 1, .97 + ((e.id * 3) % 4) * .02, 0, 5); this.play('impact-boom', at, .6, .92, .1, 4);
        if (mine) this.react('crowd-roar-1', .5, takedown ? .4 : .12); else if (!takedown) this.react('crowd-gasp', .75, .05);
        this.react(this.take(['crowd-ooh-1', 'crowd-ooh-2'], 'ooh'), .55 * side, .35);
        if (!takedown) this.say('wipeout', .3);
        break;
      }
      case 'demo': this.play('bowled', at, 1.1); this.react('crowd-ooh-2', .45 * side, .1); this.say('bump', .15); break;
      // Goal Rush's FIGHT stance put the one on the ball down - a TACKLE (weight under the blow, an "ooh") or a
      // TAKEDOWN (wiped out: the whole bowl gasps).
      case 'tackle':
        if (e.text === 'TAKEDOWN') { this.react('crowd-gasp', .9, .02); this.say('takedown', .2); }
        else { this.play('impact-boom', at, .4, 1.06, 0, 3); this.ooh(.5 * side, .08); this.say('tackle', .2); }
        break;
      // Sky Spike's DIG (thirty a match: the caller now and then) and DIVING DIG; a PERFECT SPIKE dug up is the
      // stands' "ooh" and their applause.
      case 'dig': {
        const dived = e.text === 'DIVING DIG', spike = this.perfectSpike && this.perfectSpike.team !== e.team && e.at - this.perfectSpike.at < 1.5;
        if (spike) { this.perfectSpike = null; this.react('crowd-ooh-1', .8 * side, .05); this.react('crowd-applause', .55 * side, .9); }
        else if (dived) this.ooh(.45 * side, .08);
        this.say(dived ? 'diving-dig' : 'dig', .12);
        break;
      }
      case 'charm': this.play(CHARM[e.charm ?? 'charge'], at, e.actorId && view.seats.some(s => s.id === e.actorId && s.team === home) ? 1.2 : 1); break;
      case 'shield': this.play('shield-hit', at); this.react(this.take(['crowd-ooh-1', 'crowd-ooh-2'], 'ooh'), .6 * side, .1); break;
      case 'accolade':
        if (e.text === 'HAT TRICK') this.say('hat-trick', 1.6, true);
        else if (e.text === 'ON FIRE') this.say('on-fire', 1.4, true);
        break;
      case 'target': {
        const streak = Math.max(1, e.value ?? 1);
        this.centred('target-hit', 1, 0, 1 + .045 * Math.min(8, streak - 1));
        this.react('crowd-applause', Math.min(.7, .25 + streak * .06), .1);
        if (streak >= 3 && streak % 3 === 0) this.say('target', .3);
        break;
      }
      case 'win': this.end(e, view, home); break;
      default: if (e.text && CALLED_TEXT[e.text]) this.named(CALLED_TEXT[e.text], at, side); break;
    }
  }

  /** An "ooh" at a common moment, unless the stands made one at another lately (OOH_REST). */
  private ooh(scale: number, delay: number) {
    const now = this.clock();
    if (now - this.oohAt < OOH_REST) return;
    this.oohAt = now; this.react(this.take(['crowd-ooh-2', 'crowd-ooh-1'], 'ooh'), scale, delay);
  }

  /** A named moment the caller has lines for (CALLED_TEXT) - a perfect strike draws an "ooh" from the stands,
   *  a clever touch a ripple of applause. */
  private named(moment: CallerMoment, at: Vec3, side: number) {
    if (moment === 'perfect-strike') { this.play('impact-boom', at, .55, 1.04, 0, 3); this.react('crowd-ooh-2', .6 * side, .1); }
    else if (moment === 'clever-touch') this.react('crowd-applause', .35 * side, .2);
    this.say(moment, .15);
  }

  private goal(e: BallEvent, view: BallView, home: BallTeam | null, fresh: BallEvent[]) {
    const at = { x: e.x, y: e.y, z: e.z }, own = e.kind === 'own-goal', mine = !home || e.team === home, side = this.side(e.team, home);
    const big = e.text === 'SUPER GOAL';
    this.play('goal-net', at, 1, 1, 0, 6);
    // A screamer (110 km/h or more, or a SUPER GOAL) booms through the bowl.
    if (big || (e.value ?? 0) >= 110) this.centred('impact-boom', .85, .02, .9);
    if (!view.practice) {
      this.centred('whistle-goal', 1, .12);
      // (The burst is the bowl's, heard from anywhere: a goal at the far end is past the effects' 48 m.)
      this.centred('goal-burst', 1, .05);
      this.centred('goal-horn', mine ? 1 : .7, .3);
      this.music?.punch(1.6);
    }
    this.react(big || mine ? 'crowd-roar-2' : 'crowd-roar-1', (view.practice ? .45 : 1) * side, .05);
    if (!mine && !view.practice) this.react('crowd-groan', .5, .25);
    this.mix.cheer(big ? 1.4 : 1.2, true);
    // What the caller makes of it: the accolade it earned, else how it was struck.
    const feats = new Set(fresh.filter(f => f.kind === 'accolade').map(f => f.text));
    const strike = this.lastStrike && this.lastStrike.actorId === e.actorId ? this.lastStrike : undefined;
    let moment: CallerMoment = 'goal';
    if (own) moment = 'own-goal';
    else if (view.overtime) moment = 'overtime-win';
    else if (big) moment = 'super-goal';
    else if (feats.has('BICYCLE GOAL') || strike?.text === 'BICYCLE KICK') moment = 'goal-bicycle';
    else if (feats.has('AERIAL GOAL') || strike?.text === 'AERIAL') moment = 'goal-aerial';
    else if (feats.has('LONG GOAL')) moment = 'goal-long';
    else if (e.shot === 'volley' || strike?.shot === 'volley') moment = 'goal-volley';
    else if (e.shot === 'curve' || e.shot === 'sinker') moment = 'goal-curve';
    else if (e.shot === 'power' || e.shot === 'blast' || e.shot === 'eruption' || e.shot === 'drive') moment = 'goal-power';
    // (FREE PLAY's every goal is not called: only the special ones.)
    if (!view.practice || moment !== 'goal') this.say(moment, .35);
    this.lastStrike = undefined;
  }

  private point(e: BallEvent, view: BallView, home: BallTeam | null) {
    const mine = !home || e.team === home, side = this.side(e.team, home), worth = e.value ?? 1;
    // The ball coming down, which ends the rally (the room holds it the same tick, so the flight never sees this bounce):
    // the planks in a court, the stone of the free zone outside them.
    const inCourt = Math.abs(e.x) <= SPIKE_RULES.courtHalfX + .3 && Math.abs(e.z) <= SPIKE_RULES.courtHalfZ + .3;
    if (POINT_WON.has(e.kind) || e.kind === 'out') {
      const down = Math.abs(this.prev?.vy ?? 10);
      this.play(inCourt ? (down >= HARD['sky-spike'] ? 'bounce-wood-hard' : 'bounce-wood-soft') : 'bounce-dome', { x: e.x, y: 0, z: e.z }, Math.max(.5, Math.min(1.1, .3 + down / 16)), 1, 0, 4);
      // A kill or an ace slammed into the court - the slam and the boom under it, as big as it looks.
      if (inCourt && (e.kind === 'kill' || e.kind === 'ace')) {
        this.play('spike-slam', { x: e.x, y: 0, z: e.z }, Math.max(.75, Math.min(1, .5 + down / 30)), .97 + ((e.id * 3) % 4) * .02, 0, 5);
        this.play('impact-boom', { x: e.x, y: 0, z: e.z }, .7, .95, .01, 4);
      }
    }
    if (!view.practice) this.centred('whistle-point', 1, .12);
    if (POINT_WON.has(e.kind)) {
      const rally = Math.min(1, (view.rally || 1) / 8);
      // A PERFECT SPIKE put away brings the house down, however short the rally.
      const perfect = !!this.perfectSpike && this.perfectSpike.team === e.team && e.at - this.perfectSpike.at < PERFECT_ROAR;
      this.perfectSpike = null;
      this.react(perfect || rally > .6 || worth > 1 || e.text === 'SUPER SHOT' ? 'crowd-roar-2' : 'crowd-roar-1', (view.practice ? .4 : perfect ? 1 : .55 + .45 * rally) * side, .05);
      if (!mine && !view.practice) this.react('crowd-groan', .4, .2);
      this.mix.cheer(.8 + .4 * rally);
      if (!view.practice) this.music?.punch(.5);
      if (servedPoint(e)) this.say('serve-winner', .3);
      else if (e.text === 'SUPER SHOT') this.say('super-goal', .3);
      else if (e.kind === 'kill') this.say('kill', .3);
    } else {
      // A point given away: out, four touches, a fault.
      this.react(mine ? 'crowd-applause' : 'crowd-groan', mine ? .4 : .55, .15);
    }
  }

  private end(e: BallEvent, view: BallView, home: BallTeam | null) {
    if (view.practice) return;
    this.centred('whistle-fulltime');
    const won = !!home && e.team === home, lost = !!home && !!e.team && e.team !== home;
    if (won || !home) { this.react('crowd-roar-2', 1, .5); this.mix.cheer(1.4, true); }
    else { this.react('crowd-groan', .7, .4); this.react('crowd-applause', .5, 1.4); }
    const other = home === 'red' ? 'blue' : 'red';
    const moment: CallerMoment = lost ? 'loss' : view.overtime ? 'overtime-win' : home && view.score[other] === 0 ? 'shutout' : 'win';
    // (After the finale's own VICTORY! for the local side, main.ts, which the Rift's announcer says 0.55 s into the end.)
    this.say(moment, RESULT_CALL);
    if (won && view.mvp && view.seats.some(s => s.id === view.mvp && s.team === home)) this.say('mvp', RESULT_CALL, true);
    this.music?.heat(0);
    this.mix.loopAt('ball-overdrive', url('overdrive-loop'), 0); this.mix.loopAt('ball-chant', url('crowd-chant'), 0);
  }

  /** The flight between the last snapshot and this one (physics.ts, as the room ran it): what the ball met, and the touches
   *  no event names (a tap, a bump, a set, a body playing it), or the ball machine letting a ball go. */
  private flight(view: BallView, now: number, struck: boolean) {
    const b = view.ball, prev = this.prev, dt = now - this.prevTime;
    if (!prev || !(dt > 0) || dt > .3 || view.replay) return;
    if (prev.held && !b.held) {
      // Let go without a strike: FREE PLAY's ball machine, or a serve that served itself (a kickoff's ball is only let go).
      if (!struck && view.mode === 'sky-spike' && b.shot === 'serve') this.play(view.practice ? 'machine-launch' : 'strike-tap-1', b, view.practice ? 1 : .8);
      return;
    }
    if (prev.held || b.held || prev.clash > this.prevTime || b.clash > now || prev.frozenUntil > this.prevTime || b.frozenUntil > now) return;
    const ghost = { ...prev }, contacts = stepBall(view.mode, ghost, dt, this.contacts);
    const off = Math.hypot(ghost.vx - b.vx, ghost.vy - b.vy, ghost.vz - b.vz);
    const touched = b.lastId !== prev.lastId || b.shot !== prev.shot || (off > 4 && !contacts.length);
    if (touched) {
      if (!struck) {
        const speed = Math.hypot(b.vx, b.vy, b.vz);
        this.play(this.take(STRIKE[b.shot ?? 'tap'] ?? STRIKE.tap!, 'tap'), b, Math.max(.6, Math.min(1.1, .5 + speed / 30)), .96 + (this.taps++ % 5) * .02);
      }
      return;
    }
    for (const c of contacts) this.bounce(view, c, now);
  }

  private bounce(view: BallView, c: BallContact, now: number) {
    if (now - this.lastBounce < BOUNCE_GAP && c.kind !== 'post' && c.kind !== 'bar') return;
    const at = { x: c.x, y: c.y, z: c.z }, loud = Math.max(.15, Math.min(1.1, .15 + c.speed / 18)), rate = .96 + Math.random() * .08;
    const hard = c.speed >= HARD[view.mode];
    let id: BallSfx | undefined;
    if (view.mode === 'goal-rush') {
      if (c.kind === 'floor') id = hard ? 'bounce-turf-hard' : 'bounce-turf-soft';
      else if (c.kind === 'wall' || c.kind === 'ceiling') {
        id = this.take(['bounce-glass-1', 'bounce-glass-2'], 'glass');
        // Off the end wall beside the goal mouth, at speed: a near miss.
        if (c.kind === 'wall' && c.speed > 9 && Math.abs(c.z) > GOAL_RULES.halfZ - 1.2 && Math.abs(c.x) < GOAL_RULES.goalHalfWidth + 2.4 && c.y < GOAL_RULES.goalHeight + 2) {
          this.react(this.take(['crowd-ooh-1', 'crowd-ooh-2'], 'ooh'), .75, .05); this.say('near-miss', .2);
        }
      }
    } else if (c.kind === 'floor') id = c.team ? (hard ? 'bounce-wood-hard' : 'bounce-wood-soft') : 'bounce-dome';
    else if (c.kind === 'wall' || c.kind === 'ceiling') id = 'bounce-dome';
    else if (c.kind === 'net') id = 'bounce-net';
    else if (c.kind === 'cord') id = 'bounce-cord';
    if (c.kind === 'shield') id = 'shield-hit';
    if (!id) return;
    this.lastBounce = now;
    this.play(id, at, loud * (id === 'bounce-dome' && c.kind === 'floor' ? .7 : 1), rate, 0, 1);
  }

  /** Heat catching, tier by tier, and OVERDRIVE's roar held on the ball while it burns. */
  private heat(view: BallView, now: number) {
    const b = view.ball, tier = heatTier(b.heat), live = view.phase === 'live' && !view.replay;
    if (tier > this.prevTier && live && (tier > this.heatHeard || this.clock() - this.heatHeardAt > HEAT_REST)) {
      this.heatHeard = tier; this.heatHeardAt = this.clock();
      this.play((['heat-1', 'heat-2', 'heat-3', 'heat-4'] as const)[tier - 1], b, 1, 1, 0, tier >= 4 ? 4 : 2);
      if (tier >= 4) { this.mix.cheer(.7); this.say('overdrive', .25); }
    }
    this.prevTier = tier;
    if (tier < this.heatHeard - 1) this.heatHeard = tier;
    const speed = Math.hypot(b.vx, b.vy, b.vz);
    const roar = tier >= 4 && live && !b.held ? BALL_SFX['overdrive-loop'] * (.55 + .45 * Math.min(1, speed / 30)) : 0;
    this.mix.loopAt('ball-overdrive', url('overdrive-loop'), roar, { at: b, loop: BALL_LOOPS['overdrive-loop'], rate: .94 + .12 * Math.min(1, speed / 40) });
    void now;
  }

  /** The kickoff's whistle as play starts; and the clock's last minute and seconds. */
  private phases(view: BallView) {
    if (view.mode === 'goal-rush' && !view.practice && view.phase === 'live' && (this.prevPhase === 'kickoff' || this.prevPhase === 'countdown')) {
      this.centred('whistle-kickoff');
      if (view.score.red + view.score.blue === 0 && !view.overtime) this.say('kickoff', .3);
    }
    if (view.mode === 'goal-rush' && !view.practice && view.phase === 'live' && !view.overtime) {
      if (this.prevClock > 60 && view.clock <= 60) this.say('last-minute');
      if (this.prevClock > 10 && view.clock <= 10) this.say('final-seconds');
    }
    if (view.practice && view.best > this.prevBest + .5 && this.prevBest > 0) this.say('new-record', .2);
  }

  /** The stands' bed on the match's tension, and the chant under pressure; the music's heat and climax with it. */
  private stands(view: BallView, home: BallTeam | null, now: number) {
    const target = ballTension(view), wall = this.clock();
    this.tension += (target - this.tension) * (target > this.tension ? .12 : .05);
    if (Math.abs(this.tension - this.toldTension) > .02) { this.toldTension = this.tension; this.mix.crowdTension(this.tension); }
    const pressure = !view.practice && view.phase !== 'over' && (view.overtime || view.fever || this.matchPoint || this.tension > .55);
    if (pressure) { this.calmSince = Infinity; if (this.chantFrom === Infinity) this.chantFrom = wall; }
    else { this.chantFrom = Infinity; if (this.calmSince === Infinity) this.calmSince = wall; }
    if (!this.chanting && pressure && wall - this.chantFrom > 2.5) this.chanting = true;
    if (this.chanting && !pressure && wall - this.calmSince > 2) this.chanting = false;
    const chant = this.chanting ? BALL_SFX['crowd-chant'] * (.45 + .55 * this.tension) : 0;
    this.mix.loopAt('ball-chant', url('crowd-chant'), chant, { bus: 'ambience', loop: BALL_LOOPS['crowd-chant'] });
    if (!this.music || view.practice) return;
    const lead = Math.max(view.score.red, view.score.blue), gap = Math.abs(view.score.red - view.score.blue);
    const heat = view.phase === 'over' ? 0 : view.mode === 'goal-rush'
      ? (view.overtime ? .8 : view.clock < 30 && gap <= 1 ? .5 : 0)
      : (view.fever ? 1 : this.matchPoint ? .6 : view.rally >= SPIKE_RULES.rallyHeat ? .3 : 0);
    this.music.heat(heat);
    const climax = view.phase !== 'over' && (view.mode === 'goal-rush' ? view.overtime : this.matchPoint || (view.fever && lead >= view.target - 3));
    if (climax && !this.peaked) { this.peaked = true; this.music.peak(true); }
    void home;
  }

  /** A side that was two or more down drawing level or going ahead: the comeback, once a match a side. */
  private score(view: BallView) {
    if (view.practice) return;
    for (const team of ['red', 'blue'] as const) {
      const other = team === 'red' ? 'blue' : 'red', behind = view.score[other] - view.score[team];
      this.deficit[team] = Math.max(this.deficit[team], behind);
      if (this.deficit[team] >= 2 && behind <= 0 && !this.comeback.has(team) && view.phase !== 'over') {
        this.comeback.add(team); this.say('comeback', 2.2, true);
      }
    }
  }
}
