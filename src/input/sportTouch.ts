import { ballRadius, type BallModeId, type BallView } from '../game/ball/model';
import { hasStances } from '../game/ball/stance';
import { headingInto, stepBall } from '../game/ball/physics';
import { TOUCH_RULES } from '../game/ball/BallMatch';
import { duelOn } from '../game/ball/superShots';
import { PLAYER_RADIUS } from '../game/moves';
import type { PlayerState } from '../game/types';
import type { Spot } from './touchLayout';

/**
 * The ball modes' own touch set: a sports pad where the fighting game's fan has ten buttons. In a ball match the fan
 * steps aside for it, each button a press of an action the input already has (Input.touchPress), so the room, the bots
 * and the prediction see exactly what a key would send. Four main buttons are the same in both modes - the shot big in
 * the corner, the pass beside it, the jump over it, the boost at the near end of the bottom row - and one changes with
 * the moment, over the pass. SUPER is the HUD's bar until it is charged (ui/hud/BallHud.ts), and only then a button.
 *
 *  - Goal Rush, BALL stance: SHOOT (heavy: a power shot; in the air a volley), PASS (light: a tap to a team-mate's run),
 *    JUMP, BOOST (the dash: on the floor it runs on as the boost; held, it boosts and lifting stops it), and the
 *    moment's: FIGHT (the target key: Tab's stance toggle).
 *  - Goal Rush, FIGHT stance: the same buttons as fight moves - HEAVY (the move's own art), LIGHT, JUMP, DASH and BALL
 *    (the stance back) - ringed red, so the playstyle you are in is the colour under your thumb.
 *  - Sky Spike: SPIKE (heavy; SERVE on your serve), SET (light, named for the touch it will be: BUMP, SET, TIP, or LOB
 *    on your serve), JUMP, BOOST (the dash, which into a hard ball is the DIVING DIG's reach), and the moment's: BLOCK
 *    (guard, held) at the net, DIVE (the dash again, by the name of what it is for) in the back court while the ball is
 *    the other side's (`spikeMoment`).
 *  - FREE PLAY in Goal Rush has no stances, so no FIGHT button (a drill with fights, the TACKLE drill, has it).
 *  - Goal Rush, BALL stance (BallMatch TRAP): while a ball you could trap is on its way to you, the moment's
 *    button is TRAP - the guard, held, which as the ball arrives kills it dead at your feet to carry - and FIGHT again
 *    once it is not (`trapComing`, `TrapCue`). Never a ball the other side shoots at your goal (that is a save) nor one
 *    anybody carries (FIGHT is how you take that one). FREE PLAY shows it in the slot it leaves empty.
 *  - SUPER (ULT in a fight), gold, over the boost: only once the ultimate is charged.
 *  - In a TECHNIQUE DUEL of yours (superShots.ts DUEL, `duelOn`) the shot's button reads DUEL for the
 *    beat: its press is the duel's, on the mark.
 * The shot's button is held as its key is (`SportFace.held`: Input.touchKey, down with the finger and up with it), for
 * a rule that reads how long SHOOT is held.
 * Not on the set: SPECIAL (the curve), AREA, AWAKEN and Goal Rush's guard as the keeper's SAVE: a shot or a pass at a
 * ball coming at your goal is a save all the same.
 *
 * Data and rules only: input/touch.ts draws it, handheld.css styles it, ui/prompts.ts names its buttons in prompts.
 */
export type SportSlot = 'main' | 'pass' | 'jump' | 'run' | 'side' | 'super';
export const SPORT_SLOTS: readonly SportSlot[] = ['main', 'pass', 'jump', 'run', 'side', 'super'];
/** The press each slot can send (Input.touchPress's actions, and guard, which is held: Input.touchHold). */
export type SportAction = 'light' | 'heavy' | 'jump' | 'dash' | 'guard' | 'ultimate' | 'target';
/** The faces (handheld.css draws each as a line glyph; 'art' is the move's own picture, input/touchArt.ts). */
export type SportGlyph = 'shoot' | 'pass' | 'jump' | 'boost' | 'fist' | 'ball' | 'super' | 'dash' | 'art' | 'bump' | 'set' | 'tip' | 'lob' | 'spike' | 'block' | 'dive' | 'trap' | 'duel';
export interface SportFace {
  action: SportAction; label: string; glyph: SportGlyph;
  /** BOOST: held, it keeps the boost going and lifting stops it (TouchControls). */
  hold?: boolean;
  /** The shot: its press is reported as its key's is, down while the finger is and up as it lifts (TouchControls,
   *  Input.touchKey) - a rule may read how long SHOOT is held. */
  held?: boolean;
}
export type SportSet = Readonly<Record<SportSlot, SportFace | null>>;

/** Where each button stands: diameter and centre, phone CSS px, `x` in from the safe area's right edge and `y` up from its
 *  bottom, as the fan's (touchLayout.ts). Two rows: [SHOOT · PASS · BOOST] along the bottom, the big shot in the corner
 *  under the thumb's rest, the pass beside it, the boost at the row's far end; [JUMP · the moment's] over them, JUMP
 *  straight over the shot (a jump and a strike, the volley and the spike, are one roll of the thumb) and the moment's
 *  beside JUMP (a block is a jump at the net and a guard). SUPER, once charged, stands over the boost. Five
 *  where there were six and a charge ring, the four main ones larger (the shot 88 to 92, the pass 72 to 76, the jump 58
 *  to 64, the boost 60 to 64), the far column 22 px nearer the thumb; nothing passes SPORT_REACH in from the right, and
 *  the seat's strip - the stance badge and the two bars (SPORT_STRIP) - has the screen's foot to the left of it. JUMP
 *  stands up to the fan's own top (touchLayout.ts CLUSTER_TOP), over where the right column stopped: the shot ticker
 *  and the bots' lines that stood above it there are gone from the ball HUD. */
export const SPORT_LAYOUT: Readonly<Record<SportSlot, Spot>> = {
  main: { d: 92, x: 62, y: 62 },
  pass: { d: 76, x: 160, y: 50 },
  run: { d: 64, x: 244, y: 44 },
  jump: { d: 64, x: 56, y: 154 },
  side: { d: 62, x: 150, y: 136 },
  super: { d: 54, x: 236, y: 114 },
};
/** The far column's top (BOOST, SUPER), phone px: under the prompt lane's foot on the shortest phone (handheld.css: 38%
 *  of a 375 px screen). Everything stays within SPORT_REACH of the safe area's right edge. */
export const SPORT_FAR_TOP = 142, SPORT_REACH = 278;
/** The stick's ring at rest in a ball match, phone px across (handheld.css: the fight's is 116): a hint of where the
 *  thumb goes, drawn smaller here so less of the pitch is under it. */
export const SPORT_STICK = 100;
/** The seat's strip on a phone on its side (ui/hud/ballHud.css: the stance badge, then the two bars, in one row), CSS
 *  px: along the screen's foot, ending `gap` short of the boost's reach, no wider than `wide` nor taller than `tall` -
 *  which is lower than the stick's ring at rest (34 px up, 30 on the shortest phone). */
export const SPORT_STRIP = { wide: 340, tall: 28, gap: 10 } as const;
/** BOOST held this long (ms) is a hold: lifting it stops the boost. A shorter tap is a burst that runs on while the stick
 *  holds, as the dash key's does. And while it is held, a boost that has stopped (a landing, a stun, the stick let go and
 *  pushed again) is pressed for again, at most this often (ms). */
export const BOOST_HOLD_MS = 280, BOOST_REPRESS_MS = 240;

/** Sky Spike's light, named for what it will do: the serve's LOB; BUMP for your side's first touch, SET for its second,
 *  TIP for its third (a light then goes over, soft); BUMP while the ball is on their side or on its way there. */
export function spikeLight(view: Pick<BallView, 'phase' | 'serverId' | 'touchTeam' | 'touches' | 'seats'>, selfId: string): { label: string; glyph: SportGlyph } {
  const team = view.seats.find(s => s.id === selfId)?.team;
  if (view.phase === 'kickoff' && view.serverId === selfId) return { label: 'LOB', glyph: 'lob' };
  if (team && view.touchTeam === team) {
    if (view.touches === 2) return { label: 'TIP', glyph: 'tip' };
    if (view.touches === 1) return { label: 'SET', glyph: 'set' };
  }
  return { label: 'BUMP', glyph: 'bump' };
}

/** Sky Spike's back court for the moment's button: this far from the net (m) and further, a body digs; nearer, it
 *  blocks (ui/ball/ballHints.ts: the BLOCK hint's net is 3.2 m, the DIVE hint's back court from 4.5). */
export const SPIKE_BACK = 4;
/** Sky Spike's button of the moment: DIVE - the dash, by the name of what it is for - while the ball is the other side's
 *  and the body stands in the back court (`at`, its place; the net is z = 0); BLOCK - the guard, held - at the net, and
 *  whenever the ball is your own side's or nobody's. */
export function spikeMoment(view: Pick<BallView, 'phase' | 'ball' | 'seats'>, selfId: string, at?: { z: number }): SportFace {
  const team = view.seats.find(s => s.id === selfId)?.team, last = view.ball?.lastTeam;
  if (at && team && last && last !== team && view.phase === 'live' && Math.abs(at.z) >= SPIKE_BACK) return { action: 'dash', label: 'DIVE', glyph: 'dive' };
  return { action: 'guard', label: 'BLOCK', glyph: 'block' };
}

/** TRAP on the touch set (BallMatch TRAP). TRAP_CUE: how far ahead (s) the ball's own flight is looked
 *  along for it reaching the body, how much further than the guard's reach it may pass (m), how fast it must be coming
 *  (m/s, toward the body) and from at least how far (m past that reach: one already there is too late to show), and how
 *  long (ms) TRAP stays up after the ball stops being on its way - so a thumb already going for it finds it; and while
 *  one of the other side is on the ball - within `rival` m of it, it no higher than `low` m: the TACKLE hint's carrier,
 *  ui/ball/ballHints.ts - FIGHT stays, which is how that ball is won. */
export const TRAP_CUE = { look: 1.1, slack: .35, closing: 2.5, keep: 450, rival: 3.2, low: 2.6 } as const;
/** Whether a ball the room would TRAP is on its way to this body (BallMatch TRAP, guardBall): Goal Rush's live play with
 *  no ball machine, the body on its feet; the ball nobody's to carry, not held, not a SUPER SHOT, not a shot of the other
 *  side's at its own goal (`headingInto`: that is a save); coming at it, and its own flight bringing it within the
 *  guarding body's reach - and height - inside TRAP_CUE.look. */
export function trapComing(view: Pick<BallView, 'mode' | 'phase' | 'drill' | 'lesson' | 'seats' | 'ball'>, selfId: string, at: Pick<PlayerState, 'x' | 'y' | 'z' | 'grounded' | 'size'>, players: readonly Pick<PlayerState, 'id' | 'x' | 'z' | 'alive'>[] = []): boolean {
  if (view.mode !== 'goal-rush' || view.phase !== 'live' || view.drill || view.lesson || !at.grounded) return false;
  const team = view.seats.find(s => s.id === selfId)?.team, b = view.ball;
  if (!team || !b || b.held || b.super || b.carry !== undefined) return false;
  if (b.lastTeam && b.lastTeam !== team && headingInto(b, team)) return false;
  if (rivalOn(view, selfId, players)) return false;
  const size = at.size ?? 1, r = ballRadius(view.mode) * (b.size || 1), reach = r + PLAYER_RADIUS * size + TOUCH_RULES.GUARD_REACH + TRAP_CUE.slack;
  const dx = at.x - b.x, dz = at.z - b.z, d = Math.hypot(dx, dz);
  if (d <= reach + TRAP_CUE.slack || (b.vx * dx + b.vz * dz) / d < TRAP_CUE.closing) return false;
  const top = at.y + TOUCH_RULES.BODY_HIGH * size + r + TOUCH_RULES.GUARD_REACH, g = { ...b, held: false };
  for (let t = 0; t <= TRAP_CUE.look; t += 1 / 30) {
    stepBall('goal-rush', g, 1 / 30);
    if (Math.hypot(g.x - at.x, g.z - at.z) <= reach && g.y <= top) return true;
  }
  return false;
}
/** One of the other side on the ball (TRAP_CUE.rival, .low): FIGHT's moment, not TRAP's. */
function rivalOn(view: Pick<BallView, 'seats' | 'ball'>, selfId: string, players: readonly Pick<PlayerState, 'id' | 'x' | 'z' | 'alive'>[]) {
  const team = view.seats.find(s => s.id === selfId)?.team, b = view.ball;
  if (!team || !b || b.y > TRAP_CUE.low) return false;
  return players.some(q => q.alive !== false && view.seats.some(s => s.id === q.id && s.team !== team && s.out === undefined) && Math.hypot(q.x - b.x, q.z - b.z) < TRAP_CUE.rival);
}
/** TRAP shown on the moment's button (`trapComing`), held TRAP_CUE.keep ms past the ball's coming; never in the FIGHT
 *  stance. One a page. */
export class TrapCue {
  private until = -Infinity;
  /** `now`: the page's clock, ms. */
  update(view: BallView, selfId: string, at: Pick<PlayerState, 'x' | 'y' | 'z' | 'grounded' | 'size'>, fight: boolean, now: number, players: readonly Pick<PlayerState, 'id' | 'x' | 'z' | 'alive'>[] = []): boolean {
    if (fight || view.mode !== 'goal-rush' || view.phase !== 'live') { this.until = -Infinity; return false; }
    if (trapComing(view, selfId, at, players)) this.until = now + TRAP_CUE.keep;
    // (Somebody has it at their feet now - perhaps you, trapped - or one of theirs is on it: FIGHT is what is wanted next.)
    else if (view.ball.carry !== undefined || rivalOn(view, selfId, players)) this.until = -Infinity;
    return now < this.until;
  }
  reset() { this.until = -Infinity; }
}

/** The set a ball match shows now: per slot what it presses and how it reads, or null where the slot is empty. `fight`
 *  is Goal Rush's FIGHT stance (the page's own lock, hudView.ballLock); `superReady` whether the ultimate is charged
 *  (short of it there is no button: the HUD's SUPER bar is its charge); `at` the body's place (Sky Spike's moment);
 *  `trap` whether Goal Rush's moment's button is TRAP (TrapCue). */
export function sportSet(view: BallView, selfId: string, fight: boolean, superReady: boolean, at?: { z: number }, trap = false): SportSet {
  const superFace = (label: string): SportFace | null => superReady ? { action: 'ultimate', label, glyph: 'super' } : null;
  // (In a TECHNIQUE DUEL of yours the shot's button is the duel's press - any strike is - and says so.)
  const duel = duelOn(view), duelling = !!duel && (duel.actorId === selfId || duel.targetId === selfId);
  const set = sportSetOf(view, selfId, fight, superFace, at, trap);
  return duelling ? { ...set, main: { action: 'heavy', label: 'DUEL', glyph: 'duel', held: true } } : set;
}
function sportSetOf(view: BallView, selfId: string, fight: boolean, superFace: (label: string) => SportFace | null, at?: { z: number }, trap = false): SportSet {
  if (view.mode === 'sky-spike') {
    const serving = view.phase === 'kickoff' && view.serverId === selfId, light = spikeLight(view, selfId);
    return {
      main: { action: 'heavy', label: serving ? 'SERVE' : 'SPIKE', glyph: serving ? 'shoot' : 'spike', held: true },
      pass: { action: 'light', label: light.label, glyph: light.glyph },
      jump: { action: 'jump', label: 'JUMP', glyph: 'jump' },
      run: { action: 'dash', label: 'BOOST', glyph: 'boost', hold: true },
      side: spikeMoment(view, selfId, at),
      super: superFace('SUPER'),
    };
  }
  const stances = hasStances(view), fighting = stances && fight;
  if (fighting) return {
    main: { action: 'heavy', label: 'HEAVY', glyph: 'art', held: true },
    pass: { action: 'light', label: 'LIGHT', glyph: 'fist' },
    jump: { action: 'jump', label: 'JUMP', glyph: 'jump' },
    run: { action: 'dash', label: 'DASH', glyph: 'dash', hold: true },
    side: { action: 'target', label: 'BALL', glyph: 'ball' },
    super: superFace('ULT'),
  };
  return {
    main: { action: 'heavy', label: 'SHOOT', glyph: 'shoot', held: true },
    pass: { action: 'light', label: 'PASS', glyph: 'pass' },
    jump: { action: 'jump', label: 'JUMP', glyph: 'jump' },
    run: { action: 'dash', label: 'BOOST', glyph: 'boost', hold: true },
    side: trap ? { action: 'guard', label: 'TRAP', glyph: 'trap' } : stances ? { action: 'target', label: 'FIGHT', glyph: 'fist' } : null,
    super: superFace('SUPER'),
  };
}

/** What a prompt calls each action's button on a touch screen in a ball match (prompts.ts touchKey): the set's own
 *  label, in the stance the player is in. An action the set has no button for has no name (the prompt says the verb
 *  alone). Sky Spike's light is SET in prompts, whatever touch it is for; its dash is BOOST, the button that is always
 *  there (the moment's DIVE is the same press, when it shows). */
export function sportTouchName(mode: BallModeId, fight: boolean, action: string): string | undefined {
  if (mode === 'sky-spike') return ({ light: 'SET', heavy: 'SPIKE', jump: 'JUMP', dash: 'BOOST', guard: 'BLOCK', ultimate: 'SUPER', interact: 'JUMP' } as Record<string, string>)[action];
  // (The BALL stance's guard is TRAP, the moment's button as a ball comes at you.)
  return (fight
    ? { light: 'LIGHT', heavy: 'HEAVY', jump: 'JUMP', dash: 'DASH', target: 'BALL', ultimate: 'ULT', interact: 'JUMP' }
    : { light: 'PASS', heavy: 'SHOOT', jump: 'JUMP', dash: 'BOOST', target: 'FIGHT', guard: 'TRAP', ultimate: 'SUPER', interact: 'JUMP' } as Record<string, string>)[action];
}

/** The glyphs: line drawings in the paper's colour on a 32-unit box (handheld.css .tc-glyph), as the fan's. */
export const SPORT_GLYPHS: Readonly<Record<Exclude<SportGlyph, 'art'>, string>> = {
  shoot: '<circle cx="20" cy="16" r="7.6"/><path d="M20 12.2l3.5 2.6-1.3 4.1h-4.4l-1.3-4.1z" class="tc-fill"/><path d="M2.5 11h7M1 16h8M2.5 21h7"/>',
  pass: '<circle cx="5.5" cy="16" r="2.6" class="tc-fill"/><path d="M10.5 16h16M20.5 9.5l6.5 6.5-6.5 6.5"/>',
  jump: '<path d="M8 16.5l8-7.5 8 7.5M8 24l8-7.5 8 7.5"/>',
  boost: '<path d="M16.4 3.5c.9 4.6 7.6 7.2 7.6 14.1a8 8 0 0 1-16 0c0-4 2.3-6.4 3.6-8.4.4 2.8 1.8 4.4 3.3 4.6-1.1-3.3-.2-7 1.5-10.3z"/><path d="M16 27.5c-2.6 0-4-1.8-4-4 0-2.1 1.6-3.6 2.6-5 .5 1.6 1.8 2.6 3 2.8.9 1 2.4 2.3 2.4 3.6 0 1.6-1.6 2.6-4 2.6z" class="tc-fill"/>',
  fist: '<g class="tc-fist"><rect x="7" y="12.5" width="18.6" height="13.5" rx="5"/><rect x="7.4" y="7.4" width="4.7" height="9.6" rx="2.35"/><rect x="12.1" y="6" width="4.7" height="11" rx="2.35"/><rect x="16.8" y="6.6" width="4.7" height="10.4" rx="2.35"/><rect x="21.5" y="8.4" width="4.4" height="8.6" rx="2.2"/><rect x="4.8" y="15.4" width="13.6" height="5.2" rx="2.6"/></g>',
  ball: '<circle cx="16" cy="16" r="10"/><path d="M16 11l4.8 3.5-1.8 5.6h-6l-1.8-5.6z" class="tc-fill"/><path d="M16 11V6M20.8 14.5l4.6-1.6M19 20.1l2.9 4.2M13 20.1l-2.9 4.2M11.2 14.5l-4.6-1.6"/>',
  super: '<path d="M16 2.8l3.2 8.6 9.1.4-7.2 5.6 2.6 8.8L16 21.1l-7.7 5.1 2.6-8.8-7.2-5.6 9.1-.4z"/>',
  dash: '<path d="M3 11h8M1.5 16h10M3 21h8"/><path d="M14 8.5l7.5 7.5-7.5 7.5M21 8.5l7.5 7.5-7.5 7.5"/>',
  bump: '<circle cx="16" cy="7.4" r="4.4" class="tc-fill"/><path d="M5.5 26l10.5-8 10.5 8"/>',
  set: '<circle cx="16" cy="6.8" r="4.4" class="tc-fill"/><path d="M8.5 28v-6.5l4-6M23.5 28v-6.5l-4-6"/>',
  tip: '<path d="M16 29V15"/><circle cx="9.5" cy="8.5" r="3.6" class="tc-fill"/><path d="M12.8 7.4c4.4-1.6 9.4.6 11.7 5.6M20.6 11.6l4 1.6 1-4.2"/>',
  lob: '<path d="M4.5 26C7.5 9.5 24.5 9.5 27.5 26"/><circle cx="16" cy="13.2" r="3.6" class="tc-fill"/>',
  spike: '<path d="M28 4L14.5 17.5"/><path d="M13 10.5v8.4h8.4"/><circle cx="8.6" cy="24.4" r="4.6" class="tc-fill"/>',
  block: '<path d="M4.6 27v-9.6c0-1.9 1.2-3 3-3h3.6c1.8 0 3 1.1 3 3V27M5.9 14.4V7M9.4 14.4V5.2M12.9 14.4V7M17.8 27v-9.6c0-1.9 1.2-3 3-3h3.6c1.8 0 3 1.1 3 3V27M19.1 14.4V7M22.6 14.4V5.2M26.1 14.4V7"/>',
  dive: '<path d="M4 7.5l16 12.5"/><path d="M13.6 21.6h8.2v-8.2"/><path d="M3 17h5M3 22h3"/><circle cx="25.6" cy="25.4" r="3" class="tc-fill"/>',
  // (TRAP - the ball come to rest on the turf, the lines it came in on stopping short of it.)
  // (DUEL - the ball inside the mark's ring.)
  duel: '<circle cx="16" cy="16" r="12.5"/><circle cx="16" cy="16" r="5.6" class="tc-fill"/>',
  trap: '<circle cx="19.5" cy="18.4" r="6.6"/><path d="M19.5 14.6l3.2 2.3-1.2 3.7h-4l-1.2-3.7z" class="tc-fill"/><path d="M2.5 26.2h27M2.5 14.5h6M4 19.5h5"/>',
};
