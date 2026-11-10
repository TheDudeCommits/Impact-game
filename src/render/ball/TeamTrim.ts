import * as THREE from 'three';
import {BALL_TEAM_COLOURS, type BallTeam, type BallView} from '../../game/ball/model';
import {teamTrimOn} from './ballCamChoice';

/** How much of a body's ink and of its rim light the side's colour takes (0-1), and how bright the ink's line is drawn
 *  (a share of the side's colour: a coloured line that is still a line, under the bloom). The trim is whole where a body
 *  is small on screen and needs it - `far` metres from the lens and beyond, which is all of Sky Spike's court from
 *  either stand - and eases to `inkNear` and `rimNear` by `near` metres: your own fighter in Goal Rush, a few metres
 *  from the lens, keeps most of its own ink and rim, its side a tint on them. */
export const TRIM = {ink: .85, rim: .8, inkLight: .62, inkNear: .5, rimNear: .5, near: 7, far: 16} as const;
/** The sides' rings on the floor under every fighter but your own (BallField draws them: a ring's size and how solid it
 *  is). With the sides on the bodies they step back - smaller and half as solid - so they stop being the loudest thing
 *  on the floor; your own fighter's doubled ring, and Goal Rush's stance marks (StanceMarks), are as they were. Without
 *  the trim (`?trim=0` on this machine) the rings are the ones they were (`before`). */
const RINGS = {quiet: {size: .8, alpha: .4}, before: {size: .95, alpha: .72}} as const;
export const sideRing = (): {readonly size: number; readonly alpha: number} => teamTrimOn() ? RINGS.quiet : RINGS.before;

/** The sides' colours for the trim (the match's crimson and azure, game/ball/model.ts): the rim's at full strength - the
 *  shader lights it as bright as the rim it replaces - and the ink's a share darker. */
const rimOf = (team: BallTeam) => { const c = new THREE.Color(BALL_TEAM_COLOURS[team]); return c.multiplyScalar(1 / Math.max(c.r, c.g, c.b, 1e-4)); };
const RIM: Record<BallTeam, THREE.Color> = {red: rimOf('red'), blue: rimOf('blue')};
const INK: Record<BallTeam, THREE.Color> = {red: rimOf('red').multiplyScalar(TRIM.inkLight), blue: rimOf('blue').multiplyScalar(TRIM.inkLight)};
const NONE = new THREE.Color(0, 0, 0);

/** A body the trim is put on (render/Fighter.ts): its ink's colour and its rim's, and how much of each; and where it is
 *  drawn (absent: taken as far off). */
export interface TrimBody { setTeamTrim(ink: THREE.Color, rim: THREE.Color, inkAmount: number, rimAmount: number): void; readonly group?: {readonly position: Place} }
interface Place { readonly x: number; readonly y: number; readonly z: number }

/**
 * Team trim. In a ball match every fighter's ink outline and rim light are tinted
 * with their side's colour (look/toonShading.ts applyTeamTrim), so a side reads from the bodies themselves - the far
 * side of Sky Spike's court at seventy pixels tall included - and the rings on the floor can step back (sideRing).
 * Presentation only, on every quality tier (the ink hull and the rims are drawn on all of them), on a transformation's
 * body with the fighter's own, and nowhere but a ball match: a body last seen in one is cleared the frame the match is
 * gone or the seat is, and a body in any other mode is never touched. Nothing here allocates in a frame.
 */
export class TeamTrimmer {
  /** The bodies wearing a side's trim, and the frame each was last seen in a ball match. */
  private readonly worn = new Map<TrimBody, number>();
  private frame = 0;

  /** Every frame: `view` the ball match drawn (undefined: none, any other mode), `body` a seat's drawn body, `lens` where
   *  the frame is filmed from (a split screen's second half: `lens2`; a body is as near as its nearer lens). */
  update(view: BallView | undefined, body: (id: string) => TrimBody | undefined, lens?: Place | null, lens2?: Place | null, on = teamTrimOn()) {
    this.frame++;
    if (view && on) for (let i = 0; i < view.seats.length; i++) {
      const seat = view.seats[i], b = body(seat.id);
      if (!b) continue;
      const at = b.group?.position, d = at ? Math.min(lens ? Math.hypot(at.x - lens.x, at.y - lens.y, at.z - lens.z) : Infinity, lens2 ? Math.hypot(at.x - lens2.x, at.y - lens2.y, at.z - lens2.z) : Infinity) : Infinity;
      const t = Math.min(1, Math.max(0, (d - TRIM.near) / (TRIM.far - TRIM.near))), k = t * t * (3 - 2 * t);
      b.setTeamTrim(INK[seat.team], RIM[seat.team], TRIM.inkNear + (TRIM.ink - TRIM.inkNear) * k, TRIM.rimNear + (TRIM.rim - TRIM.rimNear) * k);
      this.worn.set(b, this.frame);
    }
    for (const [b, seen] of this.worn) if (seen !== this.frame) { b.setTeamTrim(NONE, NONE, 0, 0); this.worn.delete(b); }
  }
  /** Every body let go at once. */
  clear() { for (const b of this.worn.keys()) b.setTeamTrim(NONE, NONE, 0, 0); this.worn.clear(); }
  /** How many bodies wear a trim (for checks). */
  get count() { return this.worn.size; }
}
