import {CLASSIC_COURT, GOAL_RULES, SPIKE_RULES, heatTier, spikeCourt, type BallModeId, type BallState, type BallTeam, type SpikeCourt} from './model';

/** What the ball touched this step, for the rules to judge: a Goal Rush goal (the team that conceded it is `team`), a
 *  post, the crossbar or a wall; Sky Spike's floor (where: in which side's court, or out), the net, its cord, the dome's
 *  walls and roof. `speed` is how hard it met it (m/s along the normal). */
export interface BallContact {
  kind: 'floor' | 'wall' | 'ceiling' | 'post' | 'bar' | 'net' | 'cord' | 'goal'
    /** RUMBLE: off an IRON WALL sealing a goal (team: the side it saved). */
    | 'shield';
  x: number; y: number; z: number; speed: number;
  /** Goal Rush 'goal': whose goal it went into. Sky Spike 'floor': whose court it came down in (undefined: out). */
  team?: BallTeam;
}

/** Magnus: how hard spin bends the flight (per rad/s, per m/s), and how fast spin dies away. */
const MAGNUS = .018, SPIN_DECAY = .6;
/** Below this a floor bounce dies and the ball rolls. */
const SETTLE = 1.3;
const SQRT2 = Math.SQRT2;

/** The red team defends the -z end (Goal Rush) or the -z half (Sky Spike); blue the +z. */
export const sideOf = (z: number): BallTeam => z < 0 ? 'red' : 'blue';
export const goalZ = (team: BallTeam) => team === 'red' ? -GOAL_RULES.halfZ : GOAL_RULES.halfZ;
/** Goal Rush: whether the ball is on its way into `team`'s goal inside `within` seconds - under the bar, between the posts
 *  and a little - the room's test for a shot on target and a save to be made (BallMatch). Exported, so the
 *  bots' TRAP and the page's forecast read the same rule (BallBrain CARRY_BOT, touchForecast.ts). */
export function headingInto(b: BallState, team: BallTeam, within = 1.8) {
  const R = GOAL_RULES, gz = goalZ(team);
  if (Math.sign(b.vz) !== Math.sign(gz) || Math.abs(b.vz) < 2) return false;
  const t = (gz - b.z) / b.vz;
  if (t < 0 || t > within) return false;
  const x = b.x + b.vx * t, y = b.y + b.vy * t - .5 * R.gravity * (b.grav || 1) * t * t;
  return Math.abs(x) < R.goalHalfWidth + .4 && y < R.goalHeight + .5;
}

/** One step of the ball's flight and everything it bounced off, sub-stepped so a fifty-metre-a-second super shot cannot
 *  pass through a post or the net between two ticks. Deterministic: the server and every page agree on it. */
export function stepBall(mode: BallModeId, b: BallState, dt: number, out: BallContact[] = []): BallContact[] {
  out.length = 0;
  if (b.held) return out;
  const r = (mode === 'goal-rush' ? GOAL_RULES.ballRadius : SPIKE_RULES.ballRadius) * (b.size || 1);
  const speed = Math.hypot(b.vx, b.vy, b.vz);
  const steps = Math.max(1, Math.min(10, Math.ceil(speed * dt / (r * .45))));
  const h = dt / steps;
  for (let i = 0; i < steps; i++) {
    flight(mode, b, h);
    if (mode === 'goal-rush') pitch(b, r, h, out); else court(b, r, out);
  }
  return out;
}

function flight(mode: BallModeId, b: BallState, h: number) {
  const g = (mode === 'goal-rush' ? GOAL_RULES.gravity : SPIKE_RULES.gravity) * (b.grav ?? 1);
  const drag = mode === 'goal-rush' ? GOAL_RULES.drag : SPIKE_RULES.drag;
  // Spin across the flight bends it: a curve's sidespin, a sinker's topspin.
  const mx = b.sy * b.vz - b.sz * b.vy, my = b.sz * b.vx - b.sx * b.vz, mz = b.sx * b.vy - b.sy * b.vx;
  b.vx += (mx * MAGNUS + (b.windX ?? 0)) * h; b.vy += (my * MAGNUS - g) * h; b.vz += (mz * MAGNUS + (b.windZ ?? 0)) * h;
  const keep = 1 - drag * h;
  b.vx *= keep; b.vy *= keep; b.vz *= keep;
  const spin = 1 - SPIN_DECAY * h;
  b.sx *= spin; b.sy *= spin; b.sz *= spin;
  b.x += b.vx * h; b.y += b.vy * h; b.z += b.vz * h;
}

function bounceFloor(b: BallState, r: number, e: number, roll: number, h: number, out: BallContact[], team?: BallTeam) {
  if (b.y >= r) return;
  b.y = r;
  // The arena's ground (BallState.ground, .spring): sand drags and deadens the bounce, wet slate lets the ball run.
  const ground = b.ground ?? 1; e *= b.spring ?? 1; roll *= ground;
  if (b.vy < -SETTLE) { out.push({kind: 'floor', x: b.x, y: 0, z: b.z, speed: -b.vy, team}); b.vy = -b.vy * e; const slide = Math.max(.6, 1 - .1 * ground); b.vx *= slide; b.vz *= slide; }
  else {
    if (b.vy < 0) b.vy = 0;
    // Rolling: friction along the floor, and the spin it rolls with.
    const flat = Math.hypot(b.vx, b.vz);
    if (flat > 1e-4) { const k = Math.max(0, flat - roll * h) / flat; b.vx *= k; b.vz *= k; }
  }
}

function reflect(b: BallState, nx: number, ny: number, nz: number, e: number): number {
  const vn = b.vx * nx + b.vy * ny + b.vz * nz;
  if (vn >= 0) return 0;
  b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vz -= (1 + e) * vn * nz;
  return -vn;
}

/** A sphere against a capsule's axis from (ax,ay,az) to (bx,by,bz) of radius `cr`: pushed clear and bounced. */
function cylinder(b: BallState, r: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, cr: number, e: number): number {
  const ux = bx - ax, uy = by - ay, uz = bz - az, len2 = ux * ux + uy * uy + uz * uz;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((b.x - ax) * ux + (b.y - ay) * uy + (b.z - az) * uz) / len2)) : 0;
  const px = ax + ux * t, py = ay + uy * t, pz = az + uz * t;
  let dx = b.x - px, dy = b.y - py, dz = b.z - pz;
  const d = Math.hypot(dx, dy, dz), reach = r + cr;
  if (d >= reach) return -1;
  if (d < 1e-6) { dx = 0; dy = 1; dz = 0; } else { dx /= d; dy /= d; dz /= d; }
  b.x = px + dx * reach; b.y = py + dy * reach; b.z = pz + dz * reach;
  return reflect(b, dx, dy, dz, e);
}

/** Goal Rush's walls have a foot (GOAL_RULES.wallFoot, wallLift): a low ball that meets one at `s` m/s is lifted by a
 *  share of it, as a curved board would turn it up, so it comes back off the wall into play instead of rolling dead along
 *  it. */
function lift(b: BallState, r: number, s: number, k: number = GOAL_RULES.wallLift) {
  if (s > 1 && b.y < r + GOAL_RULES.wallFoot) b.vy = Math.max(b.vy, s * k);
}

function pitch(b: BallState, r: number, h: number, out: BallContact[]) {
  const R = GOAL_RULES, e = R.wallBounce;
  bounceFloor(b, r, R.bounce, R.roll, h, out);
  if (b.y > R.ceiling - r) { b.y = R.ceiling - r; const s = reflect(b, 0, -1, 0, .6); if (s > 2) out.push({kind: 'ceiling', x: b.x, y: b.y, z: b.z, speed: s}); }
  const inMouth = Math.abs(b.x) < R.goalHalfWidth && b.y < R.goalHeight;
  // RUMBLE's IRON WALL: the sealed goal's mouth is a wall.
  const sealed = b.wall !== null && b.wall !== undefined && Math.sign(b.z) === (b.wall === 'red' ? -1 : 1);
  if (sealed && inMouth && Math.abs(b.z) > R.halfZ - r && Math.abs(b.z) < R.halfZ + r) {
    const sz = Math.sign(b.z); b.z = sz * (R.halfZ - r); const s = reflect(b, 0, 0, -sz, .8);
    if (s > 1) out.push({kind: 'shield', x: b.x, y: b.y, z: b.z, speed: s, team: b.wall!});
  }
  // Past the goal line the ball is inside a goal's box: its side nets, roof and back.
  if (Math.abs(b.z) > R.halfZ && inMouth) {
    const sz = Math.sign(b.z);
    if (Math.abs(b.x) > R.goalHalfWidth - r) { b.x = Math.sign(b.x) * (R.goalHalfWidth - r); reflect(b, -Math.sign(b.x), 0, 0, .3); }
    if (b.y > R.goalHeight - r) { b.y = R.goalHeight - r; reflect(b, 0, -1, 0, .3); }
    if (Math.abs(b.z) > R.halfZ + R.goalDepth - r) { b.z = sz * (R.halfZ + R.goalDepth - r); reflect(b, 0, 0, -sz, .25); }
    if (Math.abs(b.z) > R.halfZ + r) out.push({kind: 'goal', x: b.x, y: b.y, z: b.z, speed: Math.hypot(b.vx, b.vy, b.vz), team: sz < 0 ? 'red' : 'blue'});
  } else {
    if (Math.abs(b.x) > R.halfX - r) { const sx = Math.sign(b.x); b.x = sx * (R.halfX - r); const s = reflect(b, -sx, 0, 0, e); lift(b, r, s); if (s > 2) out.push({kind: 'wall', x: b.x, y: b.y, z: b.z, speed: s}); }
    if (Math.abs(b.z) > R.halfZ - r && !inMouth) { const sz = Math.sign(b.z); b.z = sz * (R.halfZ - r); const s = reflect(b, 0, 0, -sz, e); lift(b, r, s); if (s > 2) out.push({kind: 'wall', x: b.x, y: b.y, z: b.z, speed: s}); }
    // The chamfered corners, so a ball never dies in one: they kick it back out livelier and higher than a wall does
    // (GOAL_RULES.cornerBounce, cornerLift), a ball run along a side wall turned across the goal's face as a cross.
    const limit = (R.halfX + R.halfZ - R.corner) / SQRT2 - r;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const d = (sx * b.x + sz * b.z) / SQRT2;
      if (d <= limit) continue;
      const nx = -sx / SQRT2, nz = -sz / SQRT2, over = d - limit;
      b.x += nx * over; b.z += nz * over;
      const s = reflect(b, nx, 0, nz, R.cornerBounce); lift(b, r, s, R.cornerLift); if (s > 2) out.push({kind: 'wall', x: b.x, y: b.y, z: b.z, speed: s});
    }
  }
  // The posts and the crossbar of both goals.
  for (const sz of [-1, 1]) {
    const z = sz * R.halfZ;
    if (Math.abs(b.z - z) > r + R.post + .5) continue;
    for (const sx of [-1, 1]) {
      const s = cylinder(b, r, sx * R.goalHalfWidth, 0, z, sx * R.goalHalfWidth, R.goalHeight, z, R.post, .7);
      if (s > 1.5) out.push({kind: 'post', x: b.x, y: b.y, z: b.z, speed: s});
    }
    const s = cylinder(b, r, -R.goalHalfWidth, R.goalHeight, z, R.goalHalfWidth, R.goalHeight, z, R.post, .7);
    if (s > 1.5) out.push({kind: 'bar', x: b.x, y: b.y, z: b.z, speed: s});
  }
}

/** Which side's court a point on the floor is inside (with the ball's own radius of grace on the lines, as a line
 *  call gives the ball touching it), or undefined for out. */
export function courtSide(x: number, z: number, c: SpikeCourt = CLASSIC_COURT): BallTeam | undefined {
  const R = SPIKE_RULES, grace = R.ballRadius * .5;
  if (Math.abs(x) > c.x + grace || Math.abs(z) > c.z + grace) return undefined;
  return sideOf(z);
}

function court(b: BallState, r: number, out: BallContact[]) {
  // (The court the ball carries - volleyball's for three a side - else SPIKE_RULES' own.)
  const R = SPIKE_RULES, e = R.wallBounce, C = spikeCourt(b);
  if (b.y < r) { const team = courtSide(b.x, b.z, C); bounceFloor(b, r, R.bounce, 4, 1 / 60, out, team); }
  if (b.y > R.ceiling - r) { b.y = R.ceiling - r; const s = reflect(b, 0, -1, 0, e); out.push({kind: 'ceiling', x: b.x, y: b.y, z: b.z, speed: s}); }
  if (Math.abs(b.x) > C.wallX - r) { const sx = Math.sign(b.x); b.x = sx * (C.wallX - r); const s = reflect(b, -sx, 0, 0, e); out.push({kind: 'wall', x: b.x, y: b.y, z: b.z, speed: s}); }
  if (Math.abs(b.z) > C.wallZ - r) { const sz = Math.sign(b.z); b.z = sz * (C.wallZ - r); const s = reflect(b, 0, 0, -sz, e); out.push({kind: 'wall', x: b.x, y: b.y, z: b.z, speed: s}); }
  // The net: a soft wall from the floor to its cord, across the court and a little past it.
  const netHalf = C.x + R.netPost;
  if (Math.abs(b.x) < netHalf) {
    if (b.y < R.netHeight && Math.abs(b.z) < r) {
      const sz = b.vz > 0 ? -1 : b.vz < 0 ? 1 : Math.sign(b.z) || 1;
      b.z = sz * r; const s = reflect(b, 0, 0, sz, .3); b.vx *= .7; b.vy *= .7;
      out.push({kind: 'net', x: b.x, y: b.y, z: 0, speed: s});
    }
    const s = cylinder(b, r, -netHalf, R.netHeight, 0, netHalf, R.netHeight, 0, .05, .45);
    if (s > .5) out.push({kind: 'cord', x: b.x, y: b.y, z: b.z, speed: s});
  }
  for (const sx of [-1, 1]) {
    const s = cylinder(b, r, sx * netHalf, 0, 0, sx * netHalf, R.netHeight + .3, 0, .12, .6);
    if (s > 1) out.push({kind: 'post', x: b.x, y: b.y, z: b.z, speed: s});
  }
}

/** Where a ball now at `b` comes down to height `y` (the floor's ball radius by default), and how soon: a few hundred
 *  steps of the same flight with nothing to bounce off. For the landing ring the pages draw and the bots' reads. */
export function landing(mode: BallModeId, b: BallState, y?: number, limit = 4): {x: number; z: number; t: number} {
  const r = (mode === 'goal-rush' ? GOAL_RULES.ballRadius : SPIKE_RULES.ballRadius) * (b.size || 1), floor = y ?? r;
  const probe = {...b, held: false}, h = 1 / 60;
  let t = 0;
  if (probe.y <= floor && probe.vy <= 0) return {x: probe.x, z: probe.z, t: 0};
  while (t < limit) {
    flight(mode, probe, h); t += h;
    if (probe.y <= floor && probe.vy < 0) break;
  }
  return {x: probe.x, z: probe.z, t};
}

/** The ball's speed limit at its heat (a hotter ball may fly faster). */
export function speedCap(mode: BallModeId, heat: number) {
  return (mode === 'goal-rush' ? GOAL_RULES.speedCap : SPIKE_RULES.speedCap)[heatTier(heat)];
}

export function freshBall(): BallState {
  return {x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0, lastId: null, lastTeam: null, shot: null, held: true, frozenUntil: 0, super: false, size: 1, grav: 1, wall: null, clash: 0};
}
