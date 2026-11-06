/** Drives a fighter at every static collider of a stage and reports where the
 *  body ends up inside one, or cannot leave. Shared by
 *  `scripts/probe_stage_collision.mts` (the printed audit) and
 *  `tests/stageCollision.test.ts` (the regression gate), so the two cannot
 *  measure different things.
 *
 *  Everything runs through `ArenaSimulation` with the stage's real Rapier
 *  world: the same sweeps, autostep, bound clamp and knockback arithmetic a
 *  match uses. A probe that moved the capsule itself would measure Rapier,
 *  not the game. */
import { ArenaSimulation } from '../../src/game/simulation';
import { createRapierCollision, type RapierCollisionWorld } from '../../src/game/rapierCollision';
import { HARBOR_BRIDGES, STONE_ARCH, stageColliders, type EnvironmentCollider } from '../../src/game/environmentLayout';
import stoneArch from '../../src/game/data/stoneArchCollider.json';
import { STAGES, type StageId } from '../../src/game/stages';
import { MAX_PLAYERS, PLAYER_HEIGHT, PLAYER_RADIUS } from '../../src/game/moves';
import type { Vec3 } from '../../src/game/types';

export type DriveMode = 'run' | 'dash' | 'knockback';
export const DRIVE_MODES: readonly DriveMode[] = ['run', 'dash', 'knockback'];
/** Knockback the probe applies, in m/s: a heavy finisher's, well past the
 *  4 m/s wall-splat threshold. */
export const KNOCKBACK_SPEED = 12;

export interface GridPoint { x: number; z: number; depth: number; declared: boolean }
export interface DriveCase {
  box: EnvironmentCollider; boxIndex: number; angle: number; mode: DriveMode;
  start: Vec3; end: Vec3;
  /** Deepest the capsule was ever inside a static collider during the approach. */
  deepest: number;
  /** Centre of the capsule inside a collider at some point: the report's "stuck inside". */
  inside: boolean;
  /** Metres covered in the best of four directions in one second of running
   *  away afterwards. */
  away: number;
  /** Went into the canal (harbour) and was eliminated: not stuck, dead. */
  fell: boolean;
  stuck: boolean;
}
export interface SpawnCheck { id: string; kind: 'match' | 'training' | 'bot'; x: number; z: number; clearance: number }
export interface StageProbe {
  stage: StageId;
  boxes: number; meshes: number;
  grid: {
    total: number; water: number; inside: GridPoint[];
    /** Standing room a fighter can walk to from the arena's centre: free
     *  cells, flood-filled. Geometry only a fighter could stand in from an
     *  enclosed pocket behind a wall is not a landmark they can enter. */
    reachable: (x: number, z: number) => boolean;
  };
  drives: DriveCase[];
  skipped: { boxIndex: number; angle: number; reason: string }[];
  spawns: SpawnCheck[];
  seconds: number;
}

export interface ProbeOptions {
  /** Approach directions per collider, spread evenly round the compass. */
  angles?: number;
  modes?: readonly DriveMode[];
  /** Grid spacing in metres. */
  cell?: number;
}

/** Axis-aligned bounds of the harbour's stone arch collider, in the world. */
export function stoneArchBounds() {
  const min = { x: Infinity, y: Infinity, z: Infinity }, max = { x: -Infinity, y: -Infinity, z: -Infinity };
  const c = Math.cos(STONE_ARCH.rotation), s = Math.sin(STONE_ARCH.rotation);
  const v = stoneArch.vertices;
  for (let i = 0; i < v.length; i += 3) {
    const x = v[i] * STONE_ARCH.scale, y = v[i + 1] * STONE_ARCH.scale, z = v[i + 2] * STONE_ARCH.scale;
    const wx = STONE_ARCH.x + x * c + z * s, wz = STONE_ARCH.z - x * s + z * c, wy = STONE_ARCH.y + y;
    min.x = Math.min(min.x, wx); max.x = Math.max(max.x, wx);
    min.y = Math.min(min.y, wy); max.y = Math.max(max.y, wy);
    min.z = Math.min(min.z, wz); max.z = Math.max(max.z, wz);
  }
  return { min, max };
}

/** Whether a capsule standing at (x, z) is expected to meet something the
 *  stage declares solid: a landmark or wall box, a bridge deck, or the arch. */
export function declaredSolidAt(stage: StageId, x: number, z: number, margin = PLAYER_RADIUS): boolean {
  const { walls, landmarks } = stageColliders(stage);
  for (const c of [...walls, ...landmarks]) {
    if (c.y - c.halfY >= PLAYER_HEIGHT || c.y + c.halfY <= 0) continue;
    if (Math.abs(x - c.x) < c.halfX + margin && Math.abs(z - c.z) < c.halfZ + margin) return true;
  }
  if (stage !== 'harbor') return false;
  for (const bridge of HARBOR_BRIDGES) {
    if (Math.abs(x - bridge.x) < 2 * bridge.scale + margin && Math.abs(z - bridge.z) < 12.66165 * bridge.scale + margin) return true;
  }
  const arch = stoneArchBounds();
  return x > arch.min.x - margin && x < arch.max.x + margin && z > arch.min.z - margin && z < arch.max.z + margin;
}

/** Where the harbour has no floor: the canal between the quays, bar the bridges. */
function overWater(stage: StageId, x: number, z: number): boolean {
  if (stage !== 'harbor') return false;
  return z < -28 && z > -42 && !HARBOR_BRIDGES.some(b => Math.abs(x - b.x) < 5);
}

export async function probeStage(stage: StageId, options: ProbeOptions = {}): Promise<StageProbe> {
  const started = Date.now();
  const angles = options.angles ?? 8, modes = options.modes ?? DRIVE_MODES, cell = options.cell ?? .5;
  const { halfX, halfZ } = STAGES[stage];
  const reachX = halfX - PLAYER_RADIUS, reachZ = halfZ - PLAYER_RADIUS;
  const collision: RapierCollisionWorld = await createRapierCollision(stage);
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, stage, collision });
  const id = 'probe';
  sim.addPlayer(id, 'taisei', 'Probe', false, { x: 0, y: .01, z: 0 });
  // The live state, not `getPlayer`'s copy: the probe teleports and reads it.
  const actor = sim.actors.get(id)!, p = actor.state;
  let seq = 0;
  const inRect = (x: number, z: number) => Math.abs(x) <= reachX + 1e-6 && Math.abs(z) <= reachZ + 1e-6;

  // (a) Every point of the play rectangle a fighter could stand at.
  const nx = Math.floor(reachX / cell), nz = Math.floor(reachZ / cell);
  const columns = 2 * nx + 1, rows = 2 * nz + 1;
  const free = new Uint8Array(columns * rows);
  const at = (i: number, j: number) => (j + nz) * columns + (i + nx);
  const inside: GridPoint[] = [];
  let total = 0, water = 0;
  for (let i = -nx; i <= nx; i++) for (let j = -nz; j <= nz; j++) {
    const x = i * cell, z = j * cell;
    if (overWater(stage, x, z)) { water++; continue; }
    total++;
    const depth = collision.penetration({ x, y: .01, z });
    if (depth > 0) inside.push({ x, z, depth, declared: declaredSolidAt(stage, x, z) });
    else free[at(i, j)] = 1;
  }
  const reached = new Uint8Array(columns * rows);
  const queue = [at(0, 0)]; reached[queue[0]] = 1;
  while (queue.length) {
    const k = queue.pop()!, i = k % columns - nx, j = Math.floor(k / columns) - nz;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const I = i + di, J = j + dj;
      if (Math.abs(I) > nx || Math.abs(J) > nz) continue;
      const n = at(I, J);
      if (free[n] && !reached[n]) { reached[n] = 1; queue.push(n); }
    }
  }
  const grid: StageProbe['grid'] = { total, water, inside, reachable: (x, z) => {
    const i = Math.round(x / cell), j = Math.round(z / cell);
    return Math.abs(i) <= nx && Math.abs(j) <= nz && reached[at(i, j)] === 1;
  } };

  // (b) Drive at every box from every angle, three ways.
  const teleport = (x: number, z: number, y = .01) => {
    Object.assign(p, { x, y, z, grounded: true, stamina: 100, hp: p.maxHp, alive: true, guarding: false });
    actor.kx = actor.kz = actor.mx = actor.mz = actor.vy = 0;
    actor.dashUntil = actor.stunUntil = actor.evadeUntil = 0; actor.knockbackDrag = 7;
    actor.reaction = null; actor.cast = null; actor.dashAt = -Infinity;
  };
  const drive = (dx: number, dz: number, ticks: number, extra: { dash?: boolean } = {}) => {
    let deepest = 0;
    for (let t = 0; t < ticks; t++) {
      sim.submitInput(id, { seq: ++seq, moveX: dx, moveZ: dz, yaw: Math.atan2(dx, dz), dash: extra.dash && t === 0 });
      sim.step(1 / 60);
      deepest = Math.max(deepest, collision.penetration(p));
    }
    return deepest;
  };
  const { walls, landmarks } = stageColliders(stage);
  const targets = [...walls, ...landmarks];
  const drives: DriveCase[] = [], skipped: StageProbe['skipped'] = [];
  for (let boxIndex = 0; boxIndex < targets.length; boxIndex++) {
    const box = targets[boxIndex];
    // Nothing a standing fighter can meet: a step or a kerb lower than the
    // autostep, or a canopy above the head.
    if (box.y + box.halfY < .3 || box.y - box.halfY > PLAYER_HEIGHT) continue;
    for (let k = 0; k < angles; k++) {
      const angle = k / angles * Math.PI * 2, dx = Math.sin(angle), dz = Math.cos(angle);
      const support = box.halfX * Math.abs(dx) + box.halfZ * Math.abs(dz) + PLAYER_RADIUS;
      for (const mode of modes) {
        // Close enough that a decaying knockback still arrives; far enough that
        // a dash is at full speed on arrival.
        const gap = mode === 'knockback' ? 1.2 : 2.5;
        let start: Vec3 | null = null;
        for (const extra of [0, .75, 1.5]) {
          const x = box.x - dx * (support + gap + extra), z = box.z - dz * (support + gap + extra);
          if (!inRect(x, z) || overWater(stage, x, z)) continue;
          if (collision.penetration({ x, y: .01, z }) > 0) continue;
          start = { x, y: .01, z }; break;
        }
        if (!start) { skipped.push({ boxIndex, angle, reason: 'no clear start inside the bound' }); continue; }
        teleport(start.x, start.z);
        let deepest = 0;
        if (mode === 'run') deepest = drive(dx, dz, 90);
        else if (mode === 'dash') deepest = drive(dx, dz, 60, { dash: true });
        else {
          actor.kx = dx * KNOCKBACK_SPEED; actor.kz = dz * KNOCKBACK_SPEED; actor.knockbackDrag = 3;
          deepest = drive(0, 0, 60);
        }
        const arrived = { x: p.x, y: p.y, z: p.z };
        const fell = !p.alive || p.y < -.5;
        // Away: back the way it came first, then each other compass point,
        // from the same spot. Not stuck means some direction is open, not
        // that the one the probe happened to pick was.
        let away = 0;
        if (!fell) {
          for (const [ax, az] of [[-dx, -dz], [dz, -dx], [-dz, dx], [dx, dz]]) {
            // Where it arrived, at the height it arrived: a fighter that slid up
            // a bridge ramp is on the deck, and would be under it at y = 0.
            teleport(arrived.x, arrived.z, arrived.y);
            drive(ax, az, 60);
            away = Math.max(away, Math.hypot(p.x - arrived.x, p.z - arrived.z));
            if (away >= 1) break;
          }
        }
        drives.push({ box, boxIndex, angle, mode, start, end: arrived, deepest, inside: deepest > PLAYER_RADIUS, away, fell, stuck: !fell && away < 1 });
      }
    }
  }
  sim.dispose();

  // (c) Every spawn the simulation hands out on this stage.
  const spawns: SpawnCheck[] = [];
  const clearance = (world: RapierCollisionWorld, v: Vec3) => {
    // Distance the capsule could grow before touching: measured by widening it
    // by a radius, which is the margin asked for.
    const depth = world.penetration(v, PLAYER_RADIUS);
    return PLAYER_RADIUS - depth;
  };
  {
    const world = await createRapierCollision(stage);
    const match = new ArenaSimulation({ roomMode: 'match', stage, collision: world });
    for (let i = 0; i < MAX_PLAYERS; i++) match.addPlayer(`p${i}`, 'taisei', `P${i}`);
    match.startMatch();
    for (const player of match.snapshot().players) spawns.push({ id: player.id, kind: 'match', x: player.x, z: player.z, clearance: clearance(world, player) });
    match.dispose();
  }
  {
    const world = await createRapierCollision(stage);
    const training = new ArenaSimulation({ roomMode: 'training', stage, collision: world });
    for (let i = 0; i < 5; i++) training.addPlayer(`t${i}`, 'taisei', `T${i}`);
    for (const player of training.snapshot().players) spawns.push({ id: player.id, kind: player.isBot ? 'bot' : 'training', x: player.x, z: player.z, clearance: clearance(world, player) });
    training.dispose();
  }
  return { stage, boxes: collision.boxes.length, meshes: collision.meshes, grid, drives, skipped, spawns, seconds: (Date.now() - started) / 1000 };
}

export function summarise(probe: StageProbe) {
  const unexplained = probe.grid.inside.filter(g => !g.declared);
  return {
    stage: probe.stage,
    colliders: `${probe.boxes}${probe.meshes ? `+${probe.meshes}m` : ''}`,
    gridTotal: probe.grid.total, gridInside: probe.grid.inside.length, gridUnexplained: unexplained.length,
    drives: probe.drives.length, skipped: probe.skipped.length,
    inside: probe.drives.filter(d => d.inside).length,
    overlap: probe.drives.filter(d => d.deepest > .1).length,
    deepest: Math.max(0, ...probe.drives.map(d => d.deepest)),
    stuck: probe.drives.filter(d => d.stuck).length,
    fell: probe.drives.filter(d => d.fell).length,
    spawnViolations: probe.spawns.filter(s => s.clearance < PLAYER_RADIUS - 1e-6).length,
    spawns: probe.spawns.length,
    seconds: probe.seconds,
  };
}
