/**
 * The couch camera (2 November 2026): one lens for two people at one screen. It is its own camera, beside the game's
 * five (FollowCamera's Dynamic, Stable, Arena, Lock-on and Free), which it leaves exactly as they are: a couch fight
 * simply does not run the follow camera, and this writes the scene's camera instead.
 *
 * What it does, as a shared two-shot for local versus:
 * - IT FILMS THE PAIR FROM THE SIDE. The heading rests across the line between the two players, so both stand in profile,
 *   one on each side of the picture, and each player's keys are read against the screen: right is the screen's right.
 * - IT TURNS ONLY WHEN IT MUST. The line may swing well off square (TURN_WINDOW) before the lens follows, and then slowly
 *   (TURN_SPEED, accelerating and braking), so a pair circling a little leaves the picture still. A pair crossing over
 *   simply swaps sides of the picture: the line's other square is just as good, and the nearer one is always taken.
 * - IT PULLS BACK TO FIT. Both bodies, with a margin, stay inside the frame by distance alone (the field of view is fixed):
 *   out quickly, back in slowly after a beat, between DOLLY_NEAR and DOLLY_FAR.
 * - CO-OP LOOKS DOWN ON THE FIELD. Two heroes against a horde stand side by side, not facing each other: the lens rises
 *   (CO_OP_ELEVATION), stands further back, and holds its heading unless the pair spreads out across it.
 *
 * Numbers in, numbers out: no Three and no DOM (tests/couchCamera.test.ts).
 */
const clamp = (x: number, a: number, b: number) => x < a ? a : x > b ? b : x;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

export const FOV = 50, CHEST = 1.05, MARGIN = 1.15, TOP_MARGIN = .55;
export const DOLLY_NEAR = 5.4, DOLLY_FAR = 17, DOLLY_OUT = 5, DOLLY_IN = 1.1, DOLLY_HOLD = .9;
export const ELEVATION = .2, CO_OP_ELEVATION = .52, CO_OP_NEAR = 8.5;
/** The line between the two may stand this far off square to the lens before it turns (radians), and the lens then turns
 *  only as far as the window's edge. */
export const TURN_WINDOW = .42, TURN_SPEED = .9, TURN_ACCEL = 2.4;
/** Closer than this (metres) the line between the two is too short to read a heading from: the lens holds its own. */
export const SQUARE_FROM = 1.3;
export const PIVOT_RATE = 5, PIVOT_RISE = 3;

export interface CouchBody { x: number; y: number; z: number; height: number }
export interface CouchShot { eyeX: number; eyeY: number; eyeZ: number; lookX: number; lookY: number; lookZ: number; fov: number; yaw: number }

export class CouchRig {
  /** The lens's heading: the direction it looks along, as the game's yaw is read (x = sin, z = cos). */
  yaw = Math.PI;
  private rate = 0;
  distance = DOLLY_NEAR;
  private holdIn = 0;
  private pivot = { x: 0, y: 0, z: 0 };
  private placed = false;
  coop = false;
  reset(yaw?: number) { this.placed = false; this.rate = 0; this.holdIn = 0; if (yaw !== undefined && Number.isFinite(yaw)) this.yaw = yaw; }
  /** `players`: the people's own fighters (the first two frame the shot); `extras`: whoever else should stay in it, a
   *  co-op fight's nearest enemies; `bounds`: the floor's half extents, which the lens stands no further out than. */
  update(dt: number, players: readonly CouchBody[], extras: readonly CouchBody[] = [], bounds?: { halfX: number; halfZ: number }): CouchShot {
    const step = clamp(Number.isFinite(dt) ? dt : 0, 0, .1);
    const all = players.length ? [...players, ...extras] : extras;
    if (!all.length) return this.shot();
    // The pivot: the players' middle (the extras pull it a little), at chest height, smoothed so a shove doesn't jolt it.
    let x = 0, z = 0, y = Infinity, w = 0;
    for (const p of players) { x += p.x; z += p.z; w++; y = Math.min(y, p.y); }
    for (const e of extras) { x += e.x * .25; z += e.z * .25; w += .25; }
    if (!w) { x = all[0].x; z = all[0].z; w = 1; y = all[0].y; }
    x /= w; z /= w; if (!Number.isFinite(y)) y = 0;
    const goal = { x, y: y + CHEST, z };
    if (!this.placed) { this.pivot = { ...goal }; }
    else {
      const k = 1 - Math.exp(-PIVOT_RATE * step), up = 1 - Math.exp(-(goal.y > this.pivot.y ? PIVOT_RISE : PIVOT_RATE) * step);
      this.pivot.x += (goal.x - this.pivot.x) * k; this.pivot.z += (goal.z - this.pivot.z) * k; this.pivot.y += (goal.y - this.pivot.y) * up;
    }
    // The heading: square to the line between the two players, the nearer of its two squares, within the window.
    if (players.length >= 2) {
      const dx = players[1].x - players[0].x, dz = players[1].z - players[0].z, apart = Math.hypot(dx, dz);
      if (apart > (this.coop ? 4 : SQUARE_FROM)) {
        const line = Math.atan2(dx, dz), a = wrap(line + Math.PI / 2 - this.yaw), b = wrap(line - Math.PI / 2 - this.yaw);
        const off = Math.abs(a) < Math.abs(b) ? a : b, window = this.coop ? TURN_WINDOW * 1.6 : TURN_WINDOW;
        const want = Math.abs(off) <= window ? 0 : off - Math.sign(off) * window;
        if (!this.placed) {
          // The first frame: the square that puts the first player (Player 1) on the picture's left, as a versus screen
          // always has it, with their plate (the HUD's left one) over them.
          const ya = wrap(this.yaw + a), yb = wrap(this.yaw + b);
          const left = (yaw: number) => (players[0].x - players[1].x) * -Math.cos(yaw) + (players[0].z - players[1].z) * Math.sin(yaw);
          this.yaw = left(ya) < 0 ? ya : yb; this.rate = 0;
        }
        else {
          // Speed toward the window's edge, accelerating and braking: never a snap.
          const target = clamp(want * 2.2, -TURN_SPEED, TURN_SPEED), dv = clamp(target - this.rate, -TURN_ACCEL * step, TURN_ACCEL * step);
          this.rate += dv; if (Math.abs(want) < 1e-3 && Math.abs(this.rate) < .02) this.rate = 0;
          this.yaw = wrap(this.yaw + this.rate * step);
        }
      } else this.rate *= Math.exp(-6 * step);
    }
    // The distance that fits everyone, with the lens on this heading.
    const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw), rx = -fz, rz = fx;
    const elevation = this.coop ? CO_OP_ELEVATION : ELEVATION;
    const half = (FOV / 2) * Math.PI / 180, aspect = typeof innerWidth === 'number' && innerHeight > 0 ? innerWidth / innerHeight : 16 / 9;
    const across = Math.atan(Math.tan(half) * aspect);
    let need = this.coop ? CO_OP_NEAR : DOLLY_NEAR;
    for (const p of all) {
      const sx = (p.x - this.pivot.x) * rx + (p.z - this.pivot.z) * rz, depth = (p.x - this.pivot.x) * fx + (p.z - this.pivot.z) * fz;
      need = Math.max(need, (Math.abs(sx) + MARGIN) / Math.tan(across) - depth);
      const top = p.y + p.height + TOP_MARGIN - this.pivot.y;
      need = Math.max(need, top / Math.tan(half) * Math.cos(elevation) - depth);
    }
    need = clamp(need, this.coop ? CO_OP_NEAR : DOLLY_NEAR, DOLLY_FAR);
    if (!this.placed) { this.distance = need; this.holdIn = 0; }
    else if (need > this.distance) { this.distance = Math.min(need, this.distance + DOLLY_OUT * step * Math.max(.3, need - this.distance)); this.holdIn = DOLLY_HOLD; }
    else if ((this.holdIn -= step) <= 0) this.distance = Math.max(need, this.distance - DOLLY_IN * step);
    this.placed = true;
    return this.shot(bounds);
  }
  private shot(bounds?: { halfX: number; halfZ: number }): CouchShot {
    const elevation = this.coop ? CO_OP_ELEVATION : ELEVATION, back = Math.cos(elevation) * this.distance;
    let eyeX = this.pivot.x - Math.sin(this.yaw) * back, eyeZ = this.pivot.z - Math.cos(this.yaw) * back;
    // Never far outside the floor: a lens past the stage's own walls would look at their backs (the cutaway opens a hole
    // through the near wall, CameraCutaway.ts, but no further than that).
    if (bounds) { eyeX = clamp(eyeX, -bounds.halfX - 6, bounds.halfX + 6); eyeZ = clamp(eyeZ, -bounds.halfZ - 6, bounds.halfZ + 6); }
    const eyeY = this.pivot.y + Math.sin(elevation) * this.distance;
    const yaw = Math.atan2(this.pivot.x - eyeX, this.pivot.z - eyeZ);
    return { eyeX, eyeY, eyeZ, lookX: this.pivot.x, lookY: this.pivot.y, lookZ: this.pivot.z, fov: FOV, yaw: Number.isFinite(yaw) ? yaw : this.yaw };
  }
}
