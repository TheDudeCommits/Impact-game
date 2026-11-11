import * as THREE from 'three';
import {FOOTBALL, passPick, type Mate} from '../../game/ball/football';
import type {BallView} from '../../game/ball/model';
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
export class PassMark {
  private readonly el: HTMLElement;
  private readonly at = new THREE.Vector3();
  private shown = '';
  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'ball-pass-mark';
    this.el.setAttribute('aria-hidden', 'true');
    Object.assign(this.el.style, {position: 'absolute', left: '0', top: '0', width: '0', height: '0', pointerEvents: 'none', zIndex: '3', display: 'none',
      borderLeft: '7px solid transparent', borderRight: '7px solid transparent', borderTop: '9px solid rgba(255,255,255,.88)', filter: 'drop-shadow(0 1px 0 rgba(0,0,0,.55))'});
    parent.appendChild(this.el);
  }
  /** Each frame: `stick` the page's move as the world has it (x, z; under half: the view's `yaw`). */
  update(view: BallView | undefined, me: PlayerState | undefined, players: readonly PlayerState[], stick: {x: number; z: number}, yaw: number, camera: THREE.Camera, width: number, height: number, drawn: (id: string) => THREE.Vector3 | undefined) {
    const b = view?.ball;
    if (!view?.football || !me || !b || view.phase !== 'live') { this.hide(); return; }
    const team = view.seats.find(s => s.id === me.id)?.team, mates: Mate[] = [];
    // (A team-mate's ball coming to you, inside the moment a first-time PASS or SHOOT pressed now would play -
    // FOOTBALL.press.buffer - is marked by the same chevron, over the ball.)
    if (b.carry === undefined && b.lastTeam === team && b.lastId !== me.id) {
      const dx = me.x - b.x, dz = me.z - b.z, d = Math.hypot(dx, dz), closing = d > .1 ? (b.vx * dx + b.vz * dz) / d : 0;
      if (closing > 2 && d > .8 && d / closing <= FOOTBALL.press.buffer) { this.place(b.x, b.y + .55, b.z, 'ball', camera, width, height); return; }
    }
    if (b.carry !== me.id) { this.hide(); return; }
    for (const p of players) {
      if (p.id === me.id || !p.alive) continue;
      const s = view.seats.find(q => q.id === p.id);
      if (s && s.team === team && s.out === undefined) mates.push({id: p.id, x: p.x, z: p.z, vx: 0, vz: 0});
    }
    const aim = Math.hypot(stick.x, stick.z) >= .5 ? Math.atan2(stick.x, stick.z) : yaw;
    const pick = passPick(b, aim, mates), body = pick && players.find(p => p.id === pick.id), where = pick && drawn(pick.id);
    if (!body || !pick) { this.hide(); return; }
    // (Over the drawn body's head: a fighter is about 1.9 m tall at size 1.)
    this.place(where?.x ?? body.x, (where?.y ?? body.y) + 1.9 * (body.size ?? 1) + .35, where?.z ?? body.z, pick.id, camera, width, height);
  }
  /** The chevron over a point of the world (projected through `camera`), or hidden when the point is off the screen. */
  private place(x: number, y: number, z: number, key: string, camera: THREE.Camera, width: number, height: number) {
    this.at.set(x, y, z).project(camera);
    if (this.at.z > 1 || Math.abs(this.at.x) > 1.05 || Math.abs(this.at.y) > 1.05) { this.hide(); return; }
    const sx = (this.at.x * .5 + .5) * width - 7, sy = (-this.at.y * .5 + .5) * height - 9;
    this.el.style.transform = `translate(${sx.toFixed(1)}px,${sy.toFixed(1)}px)`;
    if (this.shown !== key) { this.el.style.display = 'block'; this.shown = key; }
  }
  hide() { if (this.shown) { this.el.style.display = 'none'; this.shown = ''; } }
  dispose() { this.el.remove(); }
}
