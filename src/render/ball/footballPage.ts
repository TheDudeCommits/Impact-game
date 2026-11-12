import * as THREE from 'three';
import {FOOTBALL, personPass, type Mate} from '../../game/ball/football';
import {BALL_TEAM_COLOURS, GOAL_RULES, type BallView} from '../../game/ball/model';
import type {PlayerState} from '../../game/types';
import {ballRulesOf} from '../../game/ball/sportRules';

/**
 * Goal Rush's SPORT mode on the page (game/ball/football.ts has the rules): the switch in the address, the camera's two
 * states, and the mark over the team-mate a PASS would find now.
 *
 * - The matches this device plays (BOTS, COUCH) are on SPORT mode on any page whose rules are the sport's
 *   (game/ball/sportRules.ts: the default; `?classic` in the address for the classic rules; the old `?football` is
 *   still accepted and changes nothing). The online room never has it.
 * - The camera (Settings.goalLook): BALL LOCK, today's ball cam (render/ball/BallCam.ts: the view keeps the ball in
 *   frame), or FREE LOOK, the heading the player's alone (the mouse, the right stick, a drag) and never eased back. V or
 *   the pad's left stick click switches it; `?look=free|lock` on this machine sets it for a visit (the films).
 */
export function footballWanted(location?: {search: string}): boolean {
  return ballRulesOf(location) === 'sport';
}
export type GoalLook = 'lock' | 'free';
export const goalLookOf = (value: unknown): GoalLook => value === 'free' ? 'free' : 'lock';
const local = typeof location === 'object' && ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
let asked = local ? new URLSearchParams(location.search).get('look') : null;
/** The camera a SPORT match is filmed with: the address's on this machine, else the player's setting. */
export const goalLookChoice = (settings: {goalLook?: unknown}): GoalLook => asked === 'free' || asked === 'lock' ? asked : goalLookOf(settings.goalLook);
/** V's switch: the other state, into the settings (and over the address's for the rest of the visit). */
export function switchGoalLook(settings: {goalLook?: GoalLook}): GoalLook {
  const next: GoalLook = goalLookChoice(settings) === 'free' ? 'lock' : 'free';
  settings.goalLook = next; if (asked) asked = next;
  return next;
}
/** The pause menu's SPORT MODE VIEW (on a page on the sport rules only), the default first. */
export const GOAL_LOOK_OPTIONS: readonly (readonly [GoalLook, string, string?])[] = [['lock', 'Ball lock', 'Default'], ['free', 'Free look']];
/** What the legend and the notice call each state. */
export const GOAL_LOOK_NAME: Record<GoalLook, string> = {lock: 'BALL LOCK', free: 'FREE LOOK'};

/** The one quiet mark over the team-mate a PASS would find now, while the page's own fighter has the ball: a small
 *  downward chevron in white over their head, no glow, gone the moment the ball is not at their feet. The pick is the
 *  match's own (football.ts passPick), from the stick (else the view) as the page reads it. The same chevron
 *  over a team-mate's ball coming to you in the moment a first-time press would play it. */
/** The attacked goal's mark (PassMark.goal): its width and height (px), and how far over the bar it floats (m). */
export const GOAL_MARK = {w: 30, h: 34, over: 1.1} as const;
/** The page's own fighter's mark (PassMark.self): its width and height (px) and how far over the head it floats (m). */
export const SELF_MARK = {w: 26, h: 18, over: .05} as const;
export class PassMark {
  private readonly el: HTMLElement;
  private readonly at = new THREE.Vector3();
  private shown = '';
  /** So the person's own fighter is found in one glance: the page's own fighter's mark, a bold arrow in its side's
   *  colour edged in white over its head, through kickoffs and play - bigger than the PASS chevron, never white, so the
   *  two are never taken for each other. */
  private readonly self: HTMLElement;
  private selfShown = '';
  /** So the goal is never lost off screen or behind a post: the goal the page's own side attacks, always found - a
   *  chevron in the side's colour over its crossbar while it is on screen, and at the screen's edge, pointing to it,
   *  while it is not (GOAL_MARK). */
  private readonly goal: HTMLElement;
  private goalShown = '';
  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'ball-pass-mark';
    this.el.setAttribute('aria-hidden', 'true');
    Object.assign(this.el.style, {position: 'absolute', left: '0', top: '0', width: '0', height: '0', pointerEvents: 'none', zIndex: '3', display: 'none',
      borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '9px solid rgba(255,255,255,.88)', filter: 'drop-shadow(0 1px 0 rgba(0,0,0,.55))'});
    parent.appendChild(this.el);
    this.self = document.createElement('div');
    this.self.className = 'ball-self-mark';
    this.self.setAttribute('aria-hidden', 'true');
    Object.assign(this.self.style, {position: 'absolute', left: '0', top: '0', width: '0', height: '0', pointerEvents: 'none', zIndex: '3', display: 'none',
      borderLeft: `${SELF_MARK.w / 2}px solid transparent`, borderRight: `${SELF_MARK.w / 2}px solid transparent`, borderTop: `${SELF_MARK.h}px solid #fff`,
      filter: 'drop-shadow(0 0 1.5px #fff) drop-shadow(0 2px 0 rgba(0,0,0,.6))'});
    parent.appendChild(this.self);
    this.goal = document.createElement('div');
    this.goal.className = 'ball-goal-mark';
    this.goal.setAttribute('aria-hidden', 'true');
    Object.assign(this.goal.style, {position: 'absolute', left: '0', top: '0', width: `${GOAL_MARK.w}px`, height: `${GOAL_MARK.h}px`, pointerEvents: 'none', zIndex: '3', display: 'none',
      filter: 'drop-shadow(0 0 1.5px #fff) drop-shadow(0 2px 0 rgba(0,0,0,.55))'});
    // (A goal's frame over a chevron: drawn in its side's colour, the frame white-edged.)
    this.goal.innerHTML = `<svg viewBox="0 0 30 34" width="${GOAL_MARK.w}" height="${GOAL_MARK.h}"><path d="M4 15V3h22v12" fill="none" stroke="#fff" stroke-width="6" stroke-linejoin="round"/><path d="M4 15V3h22v12" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round"/><path d="M6 19h18l-9 13z" fill="currentColor" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
    parent.appendChild(this.goal);
  }
  /** Each frame: `stick` the page's move as the world has it (x, z; under half: the view's `yaw`). */
  update(view: BallView | undefined, me: PlayerState | undefined, players: readonly PlayerState[], stick: {x: number; z: number}, yaw: number, camera: THREE.Camera, width: number, height: number, drawn: (id: string) => THREE.Vector3 | undefined) {
    const b = view?.ball;
    // (The lens as it is aimed this frame, its inverse included: the marks are laid through it.)
    if (view?.football) camera.updateMatrixWorld();
    this.mark(view, me, camera, width, height, drawn);
    this.goalMark(view, me, camera, width, height);
    if (!view?.football || !me || !b || view.phase !== 'live') { this.hide(true); return; }
    const team = view.seats.find(s => s.id === me.id)?.team, mates: Mate[] = [];
    // (A team-mate's ball coming to you, inside the moment a first-time PASS or SHOOT pressed now would play -
    // FOOTBALL.press.buffer - is marked by the same chevron, over the ball.)
    if (b.carry === undefined && b.lastTeam === team && b.lastId !== me.id) {
      const dx = me.x - b.x, dz = me.z - b.z, d = Math.hypot(dx, dz), closing = d > .1 ? (b.vx * dx + b.vz * dz) / d : 0;
      if (closing > 2 && d > .8 && d / closing <= FOOTBALL.press.buffer) { this.place(b.x, b.y + .55, b.z, 'ball', camera, width, height); return; }
    }
    if (b.carry !== me.id) { this.hide(true); return; }
    const foes: {x: number; z: number}[] = [];
    for (const p of players) {
      if (p.id === me.id || !p.alive) continue;
      const s = view.seats.find(q => q.id === p.id);
      if (s && s.team === team && s.out === undefined) mates.push({id: p.id, x: p.x, z: p.z, vx: 0, vz: 0, ...(s.keeper ? {keeper: true} : {})});
      else if (s && s.out === undefined) foes.push({x: p.x, z: p.z});
    }
    const aim = Math.hypot(stick.x, stick.z) >= .5 ? Math.atan2(stick.x, stick.z) : yaw;
    // (The match's own pick for a person - football.ts personPass, the best open team-mate the stick is toward.)
    const chosen = personPass(b, aim, mates, foes).mate, pick = chosen && mates.find(m => m.id === chosen.id), body = pick && players.find(p => p.id === pick.id), where = pick && drawn(pick.id);
    if (!body || !pick) { this.hide(true); return; }
    // (Over the drawn body's head: a fighter is about 1.9 m tall at size 1.)
    this.place(where?.x ?? body.x, (where?.y ?? body.y) + 1.9 * (body.size ?? 1) + .35, where?.z ?? body.z, pick.id, camera, width, height);
  }
  /** The chevron over a point of the world (projected through `camera`), or hidden when the point is off the screen. */
  private place(x: number, y: number, z: number, key: string, camera: THREE.Camera, width: number, height: number) {
    this.at.set(x, y, z).project(camera);
    if (this.at.z > 1 || Math.abs(this.at.x) > 1.05 || Math.abs(this.at.y) > 1.05) { this.hide(true); return; }
    const sx = (this.at.x * .5 + .5) * width - 7, sy = (-this.at.y * .5 + .5) * height - 9;
    this.el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
    if (this.shown !== key) { this.el.style.display = 'block'; this.shown = key; }
  }
  /** The page's own fighter's mark (SELF_MARK): over its drawn head while a football match is in a kickoff or in play
   *  and the fighter is up; not over a replay or the celebrations. */
  private mark(view: BallView | undefined, me: PlayerState | undefined, camera: THREE.Camera, width: number, height: number, drawn: (id: string) => THREE.Vector3 | undefined) {
    const team = me && view?.seats.find(s => s.id === me.id)?.team;
    if (!view?.football || !me || !team || !me.alive || (view.phase !== 'live' && view.phase !== 'kickoff')) { this.hideSelf(); return; }
    const where = drawn(me.id);
    this.at.set(where?.x ?? me.x, (where?.y ?? me.y) + 1.9 * (me.size ?? 1) + SELF_MARK.over, where?.z ?? me.z).project(camera);
    if (this.at.z > 1 || Math.abs(this.at.x) > 1.05 || Math.abs(this.at.y) > 1.05) { this.hideSelf(); return; }
    const sx = (this.at.x * .5 + .5) * width - SELF_MARK.w / 2, sy = (-this.at.y * .5 + .5) * height - SELF_MARK.h;
    this.self.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
    if (this.selfShown !== team) { this.self.style.borderTopColor = `#${BALL_TEAM_COLOURS[team].toString(16).padStart(6, '0')}`; this.self.style.display = 'block'; this.selfShown = team; }
  }
  /** The goal the page's own side attacks (GOAL_MARK): over its bar on screen, else at the frame's edge toward it. */
  private goalMark(view: BallView | undefined, me: PlayerState | undefined, camera: THREE.Camera, width: number, height: number) {
    const team = me && view?.seats.find(s => s.id === me.id)?.team;
    if (!view?.football || !team || view.replay || (view.phase !== 'live' && view.phase !== 'kickoff')) { if (this.goalShown) { this.goal.style.display = 'none'; this.goalShown = ''; } return; }
    const gz = team === 'red' ? GOAL_RULES.halfZ : -GOAL_RULES.halfZ;
    this.at.set(0, GOAL_RULES.goalHeight + GOAL_MARK.over, gz).project(camera);
    let x = this.at.x, y = this.at.y;
    const behind = this.at.z > 1, inside = !behind && Math.abs(x) < .92 && Math.abs(y) < .86;
    let turn = 0;
    if (!inside) {
      // (Off the frame: on its edge, the way to it - behind the lens, the other way round.)
      if (behind) { x = -x; y = -y; }
      // (The glyph's chevron points down the screen: turned to point out along the way to the goal.)
      turn = Math.atan2(-x, -y);
      const k = Math.max(Math.abs(x) / .9, Math.abs(y) / .8, 1e-3); x /= k; y /= k;
    }
    const sx = (x * .5 + .5) * width - GOAL_MARK.w / 2, sy = (-y * .5 + .5) * height - GOAL_MARK.h * (inside ? 1 : .5);
    this.goal.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)` + (inside ? '' : ` rotate(${turn.toFixed(3)}rad)`);
    const key = team + (inside ? 'i' : 'o');
    if (this.goalShown !== key) { this.goal.style.color = `#${BALL_TEAM_COLOURS[team].toString(16).padStart(6, '0')}`; this.goal.style.display = 'block'; this.goal.style.opacity = inside ? '.92' : '1'; this.goalShown = key; }
  }
  private hideSelf() { if (this.selfShown) { this.self.style.display = 'none'; this.selfShown = ''; } }
  /** The PASS chevron hidden; and the page's own mark too, unless `keepSelf`. */
  hide(keepSelf = false) { if (this.shown) { this.el.style.display = 'none'; this.shown = ''; } if (!keepSelf) { this.hideSelf(); if (this.goalShown) { this.goal.style.display = 'none'; this.goalShown = ''; } } }
  dispose() { this.el.remove(); this.self.remove(); this.goal.remove(); }
}
