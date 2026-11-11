import * as THREE from 'three';
import type {GameSnapshot, FighterId, PlayerState} from '../../game/types';
import {FIGHTERS} from '../../config';
import {BALL_STAGE, GOAL_RULES, SPIKE_RULES, ballOf, type BallEvent, type BallTeam, type BallView} from '../../game/ball/model';
import {BALL_ARENAS, MODE_ARENAS} from '../../game/ball/arenas';
import {INTRO, PODIUM, podiumOf, type PodiumLayout} from '../../game/ball/ceremony';
import {REPLAY} from '../../game/ball/replay';
import {signatureShot, superShotName} from '../../game/ball/superShots';
import {StageKit} from '../stages/StageKit';
import {VFX} from '../vfxLevel';
import {VfxKit} from '../vfx/VfxKit';
import {MangaScreens} from './MangaScreens';
import {forgetGoal, goalNetHit, goalNetPower} from './hype';
import {introLens} from './ceremonyShots';
import {SoundWords, inkShown} from './SoundWords';
import {PitchCount} from './PitchCount';
import {GoalHold} from './GoalHold';
import {GoalHuddle} from './GoalHuddle';
import {faceTheMoment} from './ballFaces';
import type {BallShow, ShowMode} from '../../ui/ball/BallShow';
import {BallCover, COVER, coverFace, coverWanted, winningMoment} from '../../ui/ball/BallCover';
import {coverWorth, keepCover, volumeNext, type CoverFace} from '../../ui/ball/coverShelf';
import {SECOND} from '../../game/couchSeat';

/** What the ceremony needs of the page (main.ts): a fighter's drawn body, the frame's INK FLASH, and the beats' sounds. */
export interface CeremonyHooks {
  body(id: string): THREE.Object3D | undefined;
  inkFlash(seconds: number): void;
  beat(beat: 'panels' | 'stamp' | 'whistle'): void;
}
export type CeremonyShow = 'intro' | 'close' | 'podium' | null;

/** A goal's sequence (and a Sky Spike kill on match point's): when, whose, where the replay takes over. */
interface Sequence { at: number; scorer?: string; team: BallTeam; until: number; x: number; y: number; z: number; key: string }
/** The goal's lens: from this long after the goal (the ball into the net and its burst, from the match's own camera)
 *  to the replay or the kickoff, the scorer's close-up. */
const CLOSE_FROM = .5;
/** The close-up's turns off the scorer's front to try, nearest first, when the walls are in the way (closeUp). */
const CLOSE_TURNS = [0, .5, -.5, 1, -1, 1.5, -1.5, 2.1, -2.1, 2.7, -2.7, Math.PI];
/** The spotlights: how long they take to find the scorer, and to fade once the replay or the kickoff comes. They are
 *  on for the sequence, the close-up's length, and close on the scorer before it. */
const FIND = .55, FADE = .3;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Pad buttons that vote to skip the intro: the face buttons and START. A goal's close-up: A and START, as a replay's
 *  skip (render/ball/BallReplay.ts); any button in a match with one person in it. */
const PAD_SKIP = [0, 1, 2, 3, 9], PAD_CLOSE = [0, 9];
/** Keys that vote to skip a goal's close-up (any key but these in a match with one person in it), as a replay's. */
const KEY_SKIP = ['Space', 'Enter', 'NumpadEnter'];
/** Keys that never vote: the pause menu's, and the modifiers. */
const KEY_NEVER = ['Escape', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight', 'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'];
/** The final whistle's cover (`?cover=0` on this machine leaves it out: BallCover.coverWanted). */
const COVER_ON = coverWanted(typeof location === 'object' ? location : undefined);
/** One person in the match (the rest bots): any press is theirs to skip with (BallMatch.skip). */
export const soloMatch = (view: BallView | null | undefined) => !!view && view.seats.filter(s => !s.bot).length <= 1;

/**
 * The ball modes' ceremonies, timed from the room's clock so every page of an
 * online match shows them together:
 *
 * - The intro: the arena's flyover (render/ball/ceremonyShots.ts: three moves to its landmarks), both sides on their marks
 *   behind the splash page (ui/ball/BallShow.ts), the whistle, then the kickoff or the serve. Any key, tap or pad button
 *   votes to skip it (the page sends `ball-skip`; the room ends it once everyone has).
 * - A goal (and a Sky Spike kill on match point): the net bulges where the ball hit (BallArena's net shader), the
 *   spotlights sweep the arena and find the scorer, then a close-up of the scorer in their pose until the replay, while
 *   the big screens (MangaScreens.focus) show them too - until the kickoff when the goal earned no replay; the
 *   whole sequence about 1.6 s before a replay and 2.4 s without one, and skipped as a replay is (Space, Enter, a tap, a
 *   pad's A or START; any press in a match with one person in it).
 * - A SUPER SHOT's cut-in and INK FLASH (game/ball/superShots.ts names each fighter's).
 * - The podium: the generated podium and trophy under the winners the room stood on it (BallMatch.finish), the
 *   accolades dropping in, and an orbit round it before the results.
 * - FREE PLAY in Sky Spike: the ball machine where its balls come from, recoiling as it fires.
 * - A goal holds its picture for a breath at the net's furthest stretch (GoalHold) and the
 *   scorer's side runs in to them through the sequence (GoalHuddle, drawn on the page only); and two layers of drawn
 *   lettering of their own, driven from here: the sound words at the biggest hits (SoundWords) and Goal Rush's last ten
 *   seconds and Sky Spike's MATCH POINT on the floor (PitchCount).
 * - The final whistle: the winning frame - drawn as the clock ran out, or as the deciding goal or point
 *   went in - frozen under a volume's cover at the whistle (ui/ball/BallCover.ts), for the podium's first COVER.seconds;
 *   the podium's panels drop in once it lifts. A win on this device with an accolade keeps it (ui/ball/coverShelf.ts).
 *   In a couch split screen too: its frame is both halves, its art the winner's half.
 *
 * Not in a couch split screen (two lenses) nor FREE PLAY, except the machine. Reduced motion holds every shot still (cuts,
 * no moves); the VISUAL EFFECTS level dims the spotlights and drops the cut-in on Minimal. Nothing allocates in a frame
 * once the props are loaded.
 */
export class BallCeremony {
  readonly root = new THREE.Group();
  /** The intro's skip vote (main.ts sends `ball-skip`). */
  onSkip: () => void = () => {};
  /** How far the letterbox bars close (0..1) for what shows now. */
  bars = 0;
  private show: CeremonyShow = null;
  private view: BallView | null = null;
  private serverTime = 0;
  private seen = 0; private seenAt = -Infinity;
  private sequence: Sequence | null = null;
  private readonly lens = {eye: [0, 0, 0] as [number, number, number], look: [0, 0, 0] as [number, number, number], fov: 50};
  private readonly eye = new THREE.Vector3(); private readonly look = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3(); private readonly tmp2 = new THREE.Vector3(); private readonly lookNow = new THREE.Vector3(); private readonly eyeNow = new THREE.Vector3();
  private shotIndex = -2; private lastShow: CeremonyShow = null;
  private introVoted = false; private padHeld = true; private beats = new Set<string>(); private matchKey = '';
  /** The ball's last flight (for where a goal met the net), kept while it was in play. */
  private readonly flight = new THREE.Vector3();
  private bodiesOf: (id: string) => THREE.Object3D | undefined;

  // The props: the podium and trophy (generated pieces, placed through the places' kit), the spotlights, the machine.
  private readonly podium = new THREE.Group(); private readonly trophy = new THREE.Group(); private readonly machine = new THREE.Group();
  private readonly spots = new THREE.Group(); private readonly spotMaterial: THREE.ShaderMaterial; private readonly shaftPositions: THREE.BufferAttribute;
  private readonly aimAt = new THREE.Vector3(); private readonly kit: VfxKit;
  private readonly kits = new Map<string, StageKit>(); private loading = new Set<string>();
  private podiumLayout: PodiumLayout | null = null; private podiumOrder: string[] = []; private podiumKey = '';
  private machineKick = -Infinity; private machineHeld = true; private machineStage = '';
  /** Two layers of their own: the sound words stamped at the biggest hits and the floor's numerals and MATCH POINT.
   *  Each its own effect, driven from here with the presented view. */
  readonly words: SoundWords; readonly count: PitchCount;
  /** The goal: its hold at the net's stretch, and the scorer's side running in to them. */
  readonly hold: GoalHold; private readonly huddle = new GoalHuddle();
  /** For the checks (localhost): the two lettering layers left undrawn, to measure what they cost a frame. */
  hideLettering = false;
  /** The final whistle: the cover, and its watch over the match - which match; whether this page saw it
   *  played; the phase last seen; when the deciding goal's or point's frame is due (page s); this frame to be kept as
   *  the winning one; the whistle met; the cover to lay once this frame is drawn (with its worth to the shelf). */
  readonly cover: BallCover;
  private readonly whistle = {key: '', played: false, phase: '', due: -1, copy: false, copied: -Infinity, frame: 0, met: false, lay: null as {face: CoverFace; worth: number | null; half: 0 | 1} | null};
  /** For the checks: the last cover kept on the shelf this page (its volume), and the frames kept as the winning one. */
  readonly coverLast = {kept: 0, frames: 0};

  constructor(scene: THREE.Scene, private readonly ui: BallShow, private readonly hooks: CeremonyHooks) {
    this.bodiesOf = hooks.body;
    this.cover = new BallCover(ui.root.parentElement ?? ui.root);
    this.root.name = 'Ball ceremony';
    this.podium.name = 'Ball podium'; this.trophy.name = 'Ball trophy'; this.machine.name = 'Ball machine'; this.spots.name = 'Ball spotlights';
    this.podium.visible = this.trophy.visible = this.machine.visible = this.spots.visible = false;
    // The spotlights: four pools of light on the floor sweeping the place and closing on the scorer, each with a pooled
    // light over it (vfx/LightPool) so the scorer and the turf are lit. (Shafts of light in the air read as strings of
    // dots once the frame's screentone broke them up: the pools and the light read as spotlights in the ink.)
    this.spotMaterial = new THREE.ShaderMaterial({
      name: 'Ball spotlights', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, forceSinglePass: true,
      uniforms: {uLevel: {value: 0}, uTint: {value: new THREE.Color(1, .95, .85)}},
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float uLevel;uniform vec3 uTint;varying vec2 vUv;void main(){
        float r=length(vUv*2.-1.);if(r>1.)discard;
        float a=(1.-smoothstep(.72,1.,r))*.34+(1.-smoothstep(.0,.02,abs(r-.86)))*.25;
        gl_FragColor=vec4(uTint*a*uLevel,1.);}`,
    });
    const pools = new THREE.BufferGeometry(), uv: number[] = [], index: number[] = [];
    for (let i = 0; i < 4; i++) { uv.push(0, 0, 1, 0, 1, 1, 0, 1); const o = i * 4; index.push(o, o + 1, o + 2, o, o + 2, o + 3); }
    this.shaftPositions = new THREE.BufferAttribute(new Float32Array(16 * 3), 3).setUsage(THREE.DynamicDrawUsage);
    pools.setAttribute('position', this.shaftPositions); pools.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); pools.setIndex(index);
    const discs = new THREE.Mesh(pools, this.spotMaterial); discs.frustumCulled = false; discs.renderOrder = 3; this.spots.add(discs);
    this.kit = VfxKit.for(scene);
    this.words = new SoundWords(scene, () => this.kit.quality); this.count = new PitchCount(scene);
    this.hold = new GoalHold(ui);
    this.root.add(this.podium, this.trophy, this.machine, this.spots);
    scene.add(this.root);
    if (typeof window === 'object') { window.addEventListener('keydown', this.onKey); window.addEventListener('pointerdown', this.onTap); }
    // (Localhost only: the checks stage a moment through it.)
    if (typeof location === 'object' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) (window as unknown as {__ballCeremony?: BallCeremony}).__ballCeremony = this;
  }

  /** What holds the lens now (main.ts gives it the camera after the match's own has placed it). */
  get active() { return this.show; }
  /** The lens holds the page's input too: a goal's close-up (the room holds the intro's and the podium's itself). */
  get holding() { return this.show === 'close'; }

  private readonly onKey = (e: KeyboardEvent) => {
    if (e.repeat || KEY_NEVER.includes(e.code)) return;
    if (this.show === 'intro') this.vote();
    // A goal's close-up is skipped as its replay is (the room ends both at once: BallMatch.skip).
    else if (this.show === 'close' && (KEY_SKIP.includes(e.code) || soloMatch(this.view))) { e.preventDefault(); this.closeVote(); }
  };
  private readonly onTap = () => { if (this.show === 'intro') this.vote(); else if (this.show === 'close') this.closeVote(); };
  private vote() { if (this.introVoted) return; this.introVoted = true; this.onSkip(); }
  /** The sequence this page has voted to skip (one vote a goal). */
  private closeVoted = '';
  private closeVote() { const key = this.sequence?.key ?? ''; if (this.closeVoted === key) return; this.closeVoted = key; this.onSkip(); }

  /** Every frame, with the presented snapshot. `couch`: a couch match (one screen or two), which has none of the lens's. */
  update(snapshot: GameSnapshot | null | undefined, selfId: string, dt: number, couch: boolean): CeremonyShow {
    const view = ballOf(snapshot);
    this.view = view ?? null;
    if (!view || !snapshot) { if (this.lastShow || this.root.visible) this.clear(); return null; }
    this.root.visible = true;
    const now = snapshot.serverTime, key = `${view.startedAt}:${view.round}:${view.mode}`;
    // (Another match - its start is its own - never inherits the last one's goal, hype.ts forgetGoal, nor its
    // hold.)
    if (!this.matchKey.startsWith(`${view.startedAt}:`)) { this.hold.finish(); forgetGoal(); }
    if (key !== this.matchKey || now < this.seenAt - 1) { this.matchKey = key; this.seen = 0; this.sequence = null; this.introVoted = false; this.closeVoted = ''; this.beats.clear(); this.podiumKey = ''; }
    this.seenAt = now; this.serverTime = now;
    if (!view.ball.held) this.flight.set(view.ball.vx, view.ball.vy, view.ball.vz);
    const one = !couch;
    // The moments: a SUPER SHOT's cut-in; a goal's (or a match point kill's) sequence.
    for (const e of view.events) {
      if (e.id <= this.seen) continue;
      this.seen = e.id;
      if (now - e.at > 1) continue;
      this.moment(e, view, selfId, one);
    }
    // (The sequence holds the lens until the replay, or the kickoff when it has none - whenever a skip brings
    // either forward.)
    if (this.sequence && view.phase === 'scored') this.sequence.until = view.replay && view.replay.at > this.sequence.at ? view.replay.at : view.phaseUntil;
    let show: CeremonyShow = null;
    // (The goal's hold, on the page's clock.)
    this.hold.frame(performance.now() / 1000);
    // (The short intro is the full one's tail - SHORT_INTRO - so it is timed as the full one's last seconds.)
    const intro = one && view.phase === 'countdown' && view.intro && view.startsAt !== null && !view.intro.skipped ? (view.intro.short ? INTRO.seconds : view.intro.seconds) - (view.startsAt - now) : -1;
    if (intro >= 0) show = 'intro';
    else if (one && view.phase === 'over' && view.winner) show = 'podium';
    else if (one && this.sequence && view.phase === 'scored' && now >= this.sequence.at + CLOSE_FROM && now < this.sequence.until && !view.practice) show = 'close';
    if (show !== this.lastShow) this.change(show);
    this.show = show;
    // The scorer's side runs in until the replay or the kickoff (the room's bodies are drawn again from then).
    const replaying = !!view.replay && now >= view.replay.at && now < view.replay.until;
    if (this.huddle.active && (view.phase !== 'scored' || replaying || !this.sequence)) this.huddle.stop();
    if (show === 'intro') this.intro(view, selfId, intro);
    else {
      this.ui.introTitle(null); this.ui.introSplash(null, selfId);
      // (A match with one person in it: any press skips the close-up and the replay after it.)
      this.ui.skipPrompt(show === 'close' && soloMatch(view) && this.closeVoted !== this.sequence?.key ? this.ui.touch ? 'TAP TO SKIP' : 'ANY KEY TO SKIP' : null);
    }
    this.finalWhistle(view, selfId);
    this.props(view, snapshot, dt);
    faceTheMoment(view, snapshot, show, couch ? null : this.sequence, this.podiumOrder); // The faces the moment asks for (ballFaces.ts)
    this.spotlights(view, snapshot, dt);
    this.words.update(view, now, this.hideLettering);
    // (The floor's mark is the match's, not a ceremony's: none while one holds the lens.)
    this.count.update(view, dt, !!show || this.hideLettering);
    this.bars += ((show === 'intro' ? intro < INTRO.splash ? 1 : 0 : show === 'close' ? .65 : show === 'podium' ? .45 : 0) - this.bars) * Math.min(1, dt * 7);
    this.pollPad();
    return show;
  }

  private change(show: CeremonyShow) {
    this.lastShow = show; this.shotIndex = -2;
    this.ui.mode((show ?? '') as ShowMode);
  }

  // ---------------------------------------------------------------- the intro

  private intro(view: BallView, selfId: string, elapsed: number) {
    const arena = view.arena ?? MODE_ARENAS[view.mode][0];
    const shot = introLens(arena, view.mode, elapsed, this.lens, reduced());
    if (shot !== this.shotIndex) { this.shotIndex = shot; this.cut = true; }
    if (elapsed < INTRO.splash) this.ui.introTitle(view); else this.ui.introTitle(null);
    if (elapsed >= INTRO.splash && elapsed < INTRO.whistle) {
      // The short intro has no title card, so its splash page says what this is - a REMATCH, and where.
      const arenaName = (BALL_ARENAS[arena]?.name ?? '').toUpperCase();
      this.ui.introSplash(view, selfId, view.intro?.short ? [view.mode === 'goal-rush' ? 'GOAL RUSH' : 'SKY SPIKE', view.round > 1 ? 'REMATCH' : '', arenaName].filter(Boolean).join(' · ') : undefined);
      this.once('panels', () => this.hooks.beat('panels'));
      if (elapsed >= INTRO.splash + .42) this.once('stamp', () => this.hooks.beat('stamp'));
    } else if (elapsed >= INTRO.whistle) {
      this.ui.introSplash(null, selfId);
      // The referee's whistle as the page splits away (Sky Spike's own serve whistle follows the intro at once).
      if (view.mode === 'goal-rush') this.once('whistle', () => this.hooks.beat('whistle'));
    }
    const r = view.intro, votes = r?.people && r.people > 1 && r.skips ? ` · ${r.skips}/${r.people}` : '';
    const touch = this.ui.touch;
    this.ui.skipPrompt(this.introVoted && !votes ? null : `${touch ? 'TAP TO SKIP' : 'ANY KEY TO SKIP'}${votes}`);
  }
  private once(beat: string, fn: () => void) { if (this.beats.has(beat)) return; this.beats.add(beat); fn(); }

  // ---------------------------------------------------------------- the moments

  private moment(e: BallEvent, view: BallView, selfId: string, one: boolean) {
    if (e.kind === 'super' && e.actorId) {
      const seat = view.seats.find(s => s.id === e.actorId);
      if (!seat) return;
      const own = view.seats.find(s => s.id === selfId)?.team;
      const name = FIGHTERS[seat.fighter].name.toUpperCase();
      this.ui.cutIn(seat.fighter, superShotName(seat.fighter), `${name} · SUPER SHOT`, seat.team, !own || own === seat.team, !!signatureShot(seat.fighter));
      // (Its sound word, stamped after this, keeps to the side the cut-in leaves clear; none is shown on Minimal.)
      this.words.superSide = VFX.level === 'minimal' ? 0 : !own || own === seat.team ? 1 : -1;
      this.hooks.inkFlash(.8); inkShown(.8);
      return;
    }
    const goal = e.kind === 'goal', point = (e.kind === 'kill' || e.kind === 'ace') && !!view.replay?.ceremony;
    if ((!goal && e.kind !== 'own-goal' && !point) || view.practice) return;
    // The net, where the ball went in: along its last flight from where it crossed the line, to the goal's back, sides
    // or roof, bulging as far as the shot was hard.
    if (e.kind !== 'kill' && e.kind !== 'ace') this.netHit(e);
    // The hold at the net's stretch (a single lens's: GoalHold).
    if (e.kind !== 'kill' && e.kind !== 'ace' && one) this.hold.goal(performance.now() / 1000);
    if (e.kind === 'own-goal') return;
    // (Until the replay, or the kickoff when it has none: update keeps it so.)
    const until = view.replay && view.replay.at > e.at ? view.replay.at : view.phase === 'scored' ? view.phaseUntil : e.at + (goal ? REPLAY.goalCeremony : REPLAY.ceremony);
    this.sequence = {at: e.at, scorer: e.actorId, team: e.team ?? 'red', until, x: e.x, y: e.y, z: e.z, key: `${e.id}`};
    const body = e.actorId ? this.bodiesOf(e.actorId) : undefined;
    if (body && one) MangaScreens.focus(body, until - e.at + .4, 1.4);
    // The scorer's side runs in to them (Goal Rush: a Sky Spike point keeps its court).
    const scorer = goal && one && e.actorId ? this.player(e.actorId) : undefined;
    if (scorer) this.huddle.begin(scorer, e.team ?? 'red', this.snapshotPlayers ?? [], view.seats, performance.now() / 1000);
  }

  /** A body as the page draws it this frame (main.ts, for every body): the scorer's side runs in through the goal's
   *  sequence, everyone else as given. */
  posed(id: string, state: PlayerState): PlayerState {
    return this.huddle.active ? this.huddle.posed(id, state, performance.now() / 1000) : state;
  }
  /** Just after the page drew the frame, before it yields (main.ts): the canvas still holds the frame, to keep as the
   *  goal's held picture - and, as the winning one, with the cover laid on it at the whistle. */
  afterDraw(canvas: HTMLCanvasElement) {
    this.hold.afterDraw(canvas);
    const w = this.whistle;
    if (w.copy) { w.copy = false; this.cover.capture(canvas, w.key); w.copied = performance.now() / 1000; this.coverLast.frames++; }
    if (w.lay) { const lay = w.lay; w.lay = null; this.layCover(lay, canvas); }
  }

  // ---------------------------------------------------------------- the final whistle

  /** Every frame, before the podium's props: which frame is the winning one (winningMoment: each of Goal Rush's last
   *  frames of play, the last before the whistle standing; while the next goal or point may decide, every COVER.every
   *  frames, the last before the deciding one standing - else the deciding one's, COVER.settle after it is drawn), and at
   *  the whistle the cover, with its volume and its worth to the shelf. An end this page never saw
   *  played (a room joined over, a reconnection) has none, as the finale holds none for it; FREE PLAY never ends. */
  private finalWhistle(view: BallView, selfId: string) {
    const w = this.whistle, key = `${view.startedAt}:${view.round}:${view.mode}`, page = performance.now() / 1000;
    if (w.key !== key) { w.key = key; w.played = false; w.phase = ''; w.due = -1; w.copy = false; w.copied = -Infinity; w.met = false; w.lay = null; }
    this.cover.tick(page);
    if (view.practice || !COVER_ON) return;
    if (view.phase !== 'over') {
      if (view.phase === 'live') w.played = true;
      const moment = winningMoment(view);
      // (The deciding frame itself only when no frame from just before it was kept: it is printed two-tone.)
      if (moment === 'decided' && w.phase !== view.phase && !(page - w.copied <= COVER.fresh)) w.due = page + COVER.settle;
      w.phase = view.phase;
      if (moment === 'live' || (moment === 'next' && ++w.frame % COVER.every === 0)) w.copy = true;
      else if (w.due >= 0 && page >= w.due) { w.copy = true; w.due = -1; }
      return;
    }
    if (w.met) return;
    w.met = true;
    if (!w.played || !view.winner) return;
    // (No frame kept - a page that missed the last ones: the whistle's own, the podium as it begins.)
    if (!this.cover.holds(key)) w.copy = true;
    // (A couch's split screen: the art from the half of the person who won, Player 1's when both did or neither.)
    const winners = view.seats.filter(s => s.team === view.winner).map(s => s.id), half: 0 | 1 = !winners.includes(selfId) && winners.includes(SECOND) ? 1 : 0;
    w.lay = {face: coverFace(view, volumeNext(view.mode)), worth: coverWorth(view, [selfId, SECOND]), half};
  }
  /** The cover laid on the winning frame, once the whistle's frame is drawn; its still kept on the shelf when it earns it. */
  private layCover(lay: {face: CoverFace; worth: number | null; half: 0 | 1}, canvas: HTMLCanvasElement) {
    if (!this.cover.holds(this.whistle.key)) return;
    this.cover.show(lay.face, canvas, performance.now() / 1000, lay.half);
    const worth = lay.worth;
    const match = this.whistle.key;
    if (worth !== null) void this.cover.still().then(still => { if (still && keepCover(lay.face, worth, still, match)) this.coverLast.kept = lay.face.vol; }).catch(() => {});
  }
  /** The cover holds the screen, or is about to (the podium's panels wait for it). */
  private get coverHolds() { return this.cover.up || !!this.whistle.lay; }

  private netHit(e: BallEvent) {
    const R = GOAL_RULES, sz = Math.sign(e.z) || 1, v = this.flight, back = sz * (R.halfZ + R.goalDepth);
    let t = Infinity;
    if (Math.abs(v.z) > .5) t = Math.min(t, (back - e.z) / v.z);
    if (Math.abs(v.x) > .5) t = Math.min(t, (Math.sign(v.x) * R.goalHalfWidth - e.x) / v.x);
    if (v.y > .5) t = Math.min(t, (R.goalHeight - e.y) / v.y);
    if (!(t > 0 && Number.isFinite(t))) t = 0;
    const x = THREE.MathUtils.clamp(e.x + v.x * t, -R.goalHalfWidth, R.goalHalfWidth), y = THREE.MathUtils.clamp(e.y + v.y * t, .3, R.goalHeight);
    const z = sz * THREE.MathUtils.clamp(Math.abs(e.z + v.z * t), R.halfZ, R.halfZ + R.goalDepth);
    goalNetHit.value.set(x, y, z, performance.now() / 1000);
    goalNetPower.value = THREE.MathUtils.clamp((e.value ?? 60) / 110, .35, 1.15) * (reduced() ? .5 : 1);
  }

  // ---------------------------------------------------------------- the lens

  private cut = true;
  /** The lens for what shows, after the match's camera has placed it for the frame. */
  aim(camera: THREE.PerspectiveCamera, dt: number) {
    const view = this.view;
    if (!this.show || !view) return;
    let k = 1 - Math.exp(-dt * 6), fov = 50;
    if (this.show === 'intro') {
      this.eye.fromArray(this.lens.eye); this.look.fromArray(this.lens.look); fov = this.lens.fov; k = 1;
    } else if (this.show === 'close' && this.sequence) {
      if (!this.closeUp(view)) return;
      fov = 34;
    } else if (this.show === 'podium') {
      this.orbit(view);
      fov = 42;
    }
    // (Its own eased lens, copied onto the camera: the match's camera places it afresh every frame before this.)
    if (this.cut) { this.cut = false; k = 1; }
    this.eyeNow.lerp(this.eye, k); this.lookNow.lerp(this.look, k);
    camera.position.copy(this.eyeNow);
    camera.up.set(0, 1, 0); camera.lookAt(this.lookNow);
    camera.fov = fov; camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  /** The scorer from the front, at their chest, a slow push in round them. */
  private closeUp(view: BallView) {
    const s = this.sequence!, body = s.scorer ? this.bodiesOf(s.scorer) : undefined;
    if (!body) return false;
    const p = body.getWorldPosition(this.tmp), player = this.player(s.scorer!);
    const yaw = player?.yaw ?? 0, size = player?.size ?? 1, t = Math.min(1, (this.serverTime - s.at - CLOSE_FROM) / Math.max(.5, s.until - s.at - CLOSE_FROM));
    const swing = (reduced() ? .5 : t) * .5 - .25, d = (3.6 - (reduced() ? .3 : t * .6)) * size;
    // A scorer facing a wall up close (more often on the smaller pitch) had the lens clamped against the wall,
    // inside their own body - a black screen - and a team-mate crowding them stood in front of it. The close-up is turned
    // round them, once a sequence, to the nearest angle off their front whose whole swing keeps the lens inside the walls
    // with nobody else's body across it.
    const [wx, wz] = view.mode === 'goal-rush' ? [GOAL_RULES.halfX - .6, GOAL_RULES.halfZ + GOAL_RULES.goalDepth - .4] : [SPIKE_RULES.halfX - .6, SPIKE_RULES.halfZ - .6];
    if (this.shotIndex !== -3) {
      // (The scorer's side running in is placed for the lens once it is chosen, so only the others count.)
      const far = 3.6 * size, others = (this.snapshotPlayers ?? []).filter(q => q.id !== s.scorer && q.alive && !this.huddle.spotOf(q.id));
      const clear = (a: number) => {
        const ex = p.x + Math.sin(a) * far, ez = p.z + Math.cos(a) * far;
        if (Math.abs(ex) >= wx || Math.abs(ez) >= wz) return false;
        // (Nobody within a body's width of the line from the lens to the scorer.)
        for (const q of others) {
          const dx = ex - p.x, dz = ez - p.z, l2 = dx * dx + dz * dz, k = Math.max(0, Math.min(1, ((q.x - p.x) * dx + (q.z - p.z) * dz) / l2));
          if (k > .08 && Math.hypot(q.x - p.x - dx * k, q.z - p.z - dz * k) < .75 * (q.size ?? 1)) return false;
        }
        return true;
      };
      this.closeTurn = CLOSE_TURNS.find(k => clear(yaw + k - .25) && clear(yaw + k + .25)) ?? CLOSE_TURNS.find(k => clear(yaw + k)) ?? 0;
      // The lens looks at the scorer from yaw + turn: their side's places round them, beyond.
      this.huddle.aim(yaw + this.closeTurn + Math.PI);
    }
    const a = yaw + this.closeTurn + swing;
    this.eye.set(p.x + Math.sin(a) * d, p.y + 1.55 * size, p.z + Math.cos(a) * d);
    // Keep the lens inside the place's walls.
    this.eye.x = THREE.MathUtils.clamp(this.eye.x, -wx, wx); this.eye.z = THREE.MathUtils.clamp(this.eye.z, -wz, wz);
    this.look.set(p.x, p.y + 1.35 * size, p.z);
    if (this.shotIndex !== -3) { this.shotIndex = -3; this.cut = true; }
    return true;
  }
  /** The close-up's turn off the scorer's front (radians) this sequence (closeUp). */
  private closeTurn = 0;
  /** Round the podium in an arc in front of it, a little higher as it goes, then holding a slow drift under the results. */
  private orbit(view: BallView) {
    const layout = this.podiumLayout;
    if (!layout) { this.look.set(0, 1.5, 0); this.eye.set(-14, 6, 0); return; }
    const e = Math.max(0, this.serverTime - view.endsAt), t = reduced() ? .35 : Math.min(1, e / PODIUM.seconds);
    const swing = (reduced() ? 0 : (t * t * (3 - 2 * t)) * 1.5 - .8) + (reduced() ? 0 : Math.max(0, e - PODIUM.seconds) * .04);
    const a = layout.yaw + swing, d = 9.5 - t * 1.6;
    this.eye.set(layout.x + Math.sin(a) * d, 2.2 + t * 1.6, layout.z + Math.cos(a) * d);
    this.look.set(layout.x, 1.9, layout.z);
    if (this.shotIndex !== -4) { this.shotIndex = -4; this.cut = true; }
  }
  private player(id: string) { const list = this.snapshotPlayers; if (list) for (let i = 0; i < list.length; i++) if (list[i].id === id) return list[i]; return undefined; }
  private snapshotPlayers: GameSnapshot['players'] | null = null;

  // ---------------------------------------------------------------- the props

  private props(view: BallView, snapshot: GameSnapshot, dt: number) {
    this.snapshotPlayers = snapshot.players;
    const stage = BALL_STAGE[view.mode];
    // The podium and trophy at the end.
    const over = view.phase === 'over' && !!view.winner;
    if (over) {
      const key = `${this.matchKey}:${view.endsAt}`;
      if (key !== this.podiumKey) {
        this.podiumKey = key;
        const side = view.winner === 'draw' ? view.seats.find(s => s.id === view.mvp)?.team ?? 'red' : view.winner as BallTeam;
        this.podiumLayout = podiumOf(view.mode, side);
        this.podiumOrder = view.seats.filter(s => s.team === side).sort((x, y) => y.points - x.points).map(s => s.id);
        this.ensure(stage, 'own/ball-podium', kit => kit.place('own/ball-podium', {x: 0, z: 0, scale: 1, sx: PODIUM.spacing / .375, sy: PODIUM.heights[0] / .401, sz: PODIUM.depth / .46, shadow: false}), this.podium);
        this.ensure(stage, 'own/ball-grand-trophy', kit => kit.place('own/ball-grand-trophy', {x: 0, z: 0, height: .85, shadow: false}), this.trophy);
        // The big screens on the champion for the rest of the match.
        const top = this.podiumOrder[0] ? this.bodiesOf(this.podiumOrder[0]) : undefined;
        if (top) MangaScreens.focus(top, 60, 1.4);
      }
      const l = this.podiumLayout!;
      this.podium.position.set(l.x, 0, l.z); this.podium.rotation.y = l.yaw; this.podium.visible = this.podium.children.length > 0;
      // The trophy at the middle one's chest, turning slowly, held up before them.
      const centre = this.podiumOrder[0], body = centre ? this.bodiesOf(centre) : undefined, p = this.player(centre ?? '');
      if (body && this.trophy.children.length) {
        const at = body.getWorldPosition(this.tmp2), size = (FIGHTERS[(p?.fighter ?? 'taisei') as FighterId]?.height ?? 1.8) * (p?.size ?? 1);
        this.trophy.position.set(at.x + Math.sin(l.yaw) * .55, at.y + size * .45, at.z + Math.cos(l.yaw) * .55);
        this.trophy.rotation.y += dt * (reduced() ? 0 : .9);
        this.trophy.visible = true;
      } else this.trophy.visible = false;
      // (They drop in once the whistle's cover has lifted.)
      if (this.show === 'podium' && !this.coverHolds) this.ui.podiumPanels(view, '', this.podiumOrder); else this.ui.podiumPanels(null, '', []);
    } else { this.podium.visible = this.trophy.visible = false; if (this.podiumKey) { this.podiumKey = ''; this.ui.podiumPanels(null, '', []); } }
    // Sky Spike's FREE PLAY: the ball machine, at the serving mark on the empty side, kicking back as it fires.
    const machine = view.practice && view.mode === 'sky-spike';
    if (machine) {
      if (this.machineStage !== stage) { this.machineStage = stage; this.ensure(stage, 'own/ball-machine', kit => kit.place('own/ball-machine', {x: 0, z: 0, height: 2.05, shadow: false}), this.machine); }
      const sign = view.servingTeam === 'red' ? -1 : 1, b = view.ball;
      if (this.machineHeld && !b.held && b.shot === 'serve' && !b.lastId) this.machineKick = performance.now() / 1000;
      this.machineHeld = b.held;
      const kick = performance.now() / 1000 - this.machineKick, back = kick < 0 || kick > .6 ? 0 : kick < .06 ? kick / .06 : Math.exp(-(kick - .06) * 7);
      this.machine.position.set(0, 0, sign * (SPIKE_RULES.courtHalfZ + 1.6 + back * .45));
      // (The kick tips its muzzle up as it slides back.)
      this.machine.rotation.set(sign * back * .1 * (reduced() ? .3 : 1), sign < 0 ? 0 : Math.PI, 0);
      this.machine.visible = this.machine.children.length > 0;
    } else this.machine.visible = false;
  }
  /** A generated piece, loaded once for its stage into `group` (the group is moved, never the piece). */
  private ensure(stage: string, piece: string, place: (kit: StageKit) => void, group: THREE.Group) {
    const id = `${stage}:${piece}`;
    if (this.kits.has(id) || this.loading.has(id) || typeof document === 'undefined') { if (this.kits.has(id) && group.userData.piece !== id) this.swap(group, id); return; }
    this.loading.add(id);
    const holder = new THREE.Group(), kit = new StageKit(holder, stage as typeof BALL_STAGE['goal-rush']);
    void kit.load([piece]).then(() => {
      this.loading.delete(id);
      if (!kit.has(piece)) return;
      place(kit); kit.flush(stage as typeof BALL_STAGE['goal-rush']);
      holder.userData.piece = id; this.kits.set(id, kit); this.holders.set(id, holder);
      this.swap(group, id);
    }).catch(error => { this.loading.delete(id); console.warn('Ball ceremony piece failed', piece, error); });
  }
  private readonly holders = new Map<string, THREE.Group>();
  private swap(group: THREE.Group, id: string) {
    const holder = this.holders.get(id);
    if (!holder) return;
    group.clear(); group.add(holder); group.userData.piece = id;
  }

  /** The spotlights: four pools of light sweeping the floor from the place's corners, then closing on the scorer (or the
   *  podium), each with a pooled light over it. */
  private spotlights(view: BallView, snapshot: GameSnapshot, dt: number) {
    const s = this.sequence, now = snapshot.serverTime;
    let target: THREE.Vector3 | null = null, age = 0, level = 0;
    if (view.phase === 'over' && this.podiumLayout && this.show === 'podium') { target = this.tmp.set(this.podiumLayout.x, 0, this.podiumLayout.z); age = now - view.endsAt + FIND; level = 1; }
    else if (s && now < s.until && view.phase === 'scored') {
      age = now - s.at; level = Math.min(1, age / .25) * Math.min(1, (s.until - now) / FADE);
      const body = s.scorer ? this.bodiesOf(s.scorer) : undefined;
      target = body ? body.getWorldPosition(this.tmp) : this.tmp.set(s.x, 0, s.z);
    }
    level *= .45 + .55 * VFX.lights;
    const u = this.spotMaterial.uniforms;
    u.uLevel.value += (level - u.uLevel.value) * Math.min(1, dt * 8);
    this.spots.visible = u.uLevel.value > .01 && !!target;
    if (!this.spots.visible || !target) return;
    const tint = u.uTint.value as THREE.Color;
    if (s && view.phase === 'scored') tint.setHex(s.team === 'red' ? 0xffd8cc : 0xd6e6ff); else tint.setRGB(1, .93, .78);
    const pitch = view.mode === 'goal-rush', R = pitch ? GOAL_RULES : SPIKE_RULES, reach = pitch ? GOAL_RULES.halfX * .9 : 10;
    const find = reduced() ? 1 : Math.min(1, age / FIND), ease = find * find * (3 - 2 * find), lights = this.kit.quality !== 'low';
    const pos = this.shaftPositions.array as Float32Array;
    for (let i = 0; i < 4; i++) {
      // From the place's four corners across the floor (each its own way), closing in round the target.
      const sx = i & 1 ? 1 : -1, sz = i & 2 ? 1 : -1, sweep = 1 - ease, ring = 1.1 * ease;
      const ax = target.x + sx * (sweep * (R.halfX * .7 + Math.sin(age * 2.3 + i) * reach * .3) + ring), az = target.z + sz * (sweep * (R.halfZ * .55 + Math.cos(age * 1.9 + i * 1.3) * reach * .3) + ring);
      this.aimAt.set(ax, 0, az);
      const size = 2.2 + ease * .6, o = i * 12;
      pos[o] = ax - size; pos[o + 1] = .06; pos[o + 2] = az - size;
      pos[o + 3] = ax + size; pos[o + 4] = .06; pos[o + 5] = az - size;
      pos[o + 6] = ax + size; pos[o + 7] = .06; pos[o + 8] = az + size;
      pos[o + 9] = ax - size; pos[o + 10] = .06; pos[o + 11] = az + size;
      if (lights) this.kit.lights.request(ax, 4.2, az, tint.getHex(), 22 * u.uLevel.value, 9, 2);
    }
    this.shaftPositions.needsUpdate = true;
  }

  private pollPad() {
    if (this.show !== 'intro' && this.show !== 'close') { this.padHeld = true; return; }
    const pads = typeof navigator === 'object' && navigator.getGamepads ? navigator.getGamepads() : [];
    const any = this.show === 'close' && soloMatch(this.view), buttons = this.show === 'intro' ? PAD_SKIP : PAD_CLOSE;
    let held = false;
    for (const pad of pads) if (pad?.connected && (any ? pad.buttons.some(b => b.pressed) : buttons.some(i => pad.buttons[i]?.pressed))) held = true;
    if (held && !this.padHeld) { if (this.show === 'intro') this.vote(); else this.closeVote(); }
    this.padHeld = held;
  }

  /** Leaving the match: everything put away. */
  clear() {
    this.show = this.lastShow = null; this.view = null; this.sequence = null; this.bars = 0; this.seen = 0; this.matchKey = ''; this.podiumKey = '';
    this.podium.visible = this.trophy.visible = this.machine.visible = this.spots.visible = false; this.root.visible = false;
    // (The hold let go before the goal is put away: letting go sets the net's clock running again.)
    this.hold.finish(); this.huddle.stop(); this.words.clear(); this.count.clear();
    this.cover.clear(); this.whistle.key = ''; this.whistle.lay = null; this.whistle.copy = false;
    this.spotMaterial.uniforms.uLevel.value = 0; forgetGoal();
    MangaScreens.focus(null, 0);
    this.ui.clear();
  }
  /** For the checks: what shows, and where the lens is told to stand. */
  evidence() { return {show: this.show, shot: this.shotIndex, eye: this.eye.toArray(), look: this.look.toArray(), podium: this.podiumLayout, sequence: this.sequence ? {...this.sequence} : null,
    words: {stamped: {...this.words.stampedCount}, last: this.words.last, up: this.words.mesh.visible}, floor: this.count.shown, floorUp: this.count.mesh.visible,
    hold: {...this.hold.last, holding: this.hold.holding}, huddle: this.huddle.active, cover: {up: this.cover.up, ...this.coverLast}}; }
  dispose() {
    this.clear();
    if (typeof window === 'object') { window.removeEventListener('keydown', this.onKey); window.removeEventListener('pointerdown', this.onTap); }
    for (const kit of this.kits.values()) kit.dispose();
    this.spotMaterial.dispose();
    this.words.dispose(); this.count.dispose(); this.cover.dispose();
    (this.spots.children[0] as THREE.Mesh | undefined)?.geometry.dispose();
  }
}
