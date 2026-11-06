import * as THREE from 'three';
import type { Fighter } from '../../Fighter';
import { spaceOfContext, type SpaceBodies } from './host';

/**
 * The VFX Armory's extended pack (`extd_*`) in the game: its practice targets are the fighters.
 *
 * In the Armory the pack stands a ring of rigged dummies round the caster (`lib/combat/field.js`, a Mixamo rig): its
 * effects find them (`findTargets`, `findBodies`), aim and home at them, and knock them down, freeze them, carry them,
 * eat them away. The rig is never shipped (scripts/engine/armory/vendor.mts maps that module here: ADAPTER_MODULES),
 * and in the game the bodies are the fighters themselves:
 *
 *  - **Stand-ins at their feet.** Each fighter in play but the caster is a body the effect can find, at its feet and
 *    facing its way, every frame, as tall as the pack's dummies (its aim heights are fractions of that).
 *  - **The game owns the fighters.** No effect knocks one down, freezes, carries, sinks or eats one: those calls do
 *    nothing and say the body was not taken (`kill` and `freeze` answer false), so an effect keeps its own sparks,
 *    pools, beams and birds and leaves the body to the game's own hits.
 *  - **One field per space** (each effect instance's own world, host.ts): its caster is that instance's thrower.
 */

const BODY_RADIUS = .35;
const NO_BONES: ReadonlyMap<string, THREE.Object3D> = new Map();

/** A fighter, as the extended pack's dummies are read (`lib/combat/Dummy.js`). */
class StandIn {
  readonly root = new THREE.Group();
  /** 'alive' while the fighter is: the game decides when it is not. */
  state: 'alive' | 'gone' = 'alive';
  facing = 0;
  height = 1.8;
  timer = 0;
  dissolve = 0;
  sliced = false;
  readonly cutPoint = new THREE.Vector3();
  _searchDistance = 0;
  get alive() { return this.state === 'alive'; }
  get finished() { return this.state === 'gone'; }
  get position() { return this.root.position; }
  get model() { return this.root; }
  get bones() { return NO_BONES; }
  see(f: Fighter) {
    this.root.position.set(f.group.position.x, 0, f.group.position.z);
    this.facing = (f.state as { yaw?: number } | undefined)?.yaw ?? 0;
    this.state = (f.state as { alive?: boolean } | undefined)?.alive === false ? 'gone' : 'alive';
  }
  place() { return this; }
  kill() { return false; }
  freeze() { return false; }
  skinnedMeshes(out: THREE.SkinnedMesh[] = []) { out.length = 0; return out; }
  vanish() {}
  bodyPoint() { return null; }
  bodyVelocity() { return null; }
  carry() {}
  sink() {}
  release() {}
  consume() { return 0; }
  corrode() { return 0; }
  update() {}
  dispose() {}
}

/** The pack's `DummyField`, as its effects read it. */
class GameField {
  readonly group = new THREE.Group();
  environment: unknown = null;
  private readonly bodies = new Map<string, StandIn>();
  constructor(private readonly space: { readonly bodies?: SpaceBodies }) {
    this.group.name = 'Dummies';
    this.group.visible = false;
  }
  /** The fighters in play but the caster, where they are now. */
  private refresh() {
    const at = this.space.bodies;
    for (const [id, body] of this.bodies) if (!at?.fighters.has(id) || id === at.actor) { body.state = 'gone'; this.bodies.delete(id); }
    if (!at) return;
    for (const [id, f] of at.fighters) {
      if (id === at.actor) continue;
      let body = this.bodies.get(id);
      if (!body) { body = new StandIn(); this.bodies.set(id, body); }
      body.see(f);
    }
  }
  get aliveCount() { this.refresh(); let n = 0; for (const body of this.bodies.values()) if (body.alive) n++; return n; }
  /** The bodies standing within `radius` of (x, z), nearest first, into `out`. */
  findTargets(x: number, z: number, radius: number, out: StandIn[]) {
    out.length = 0;
    this.refresh();
    const reach = (radius + BODY_RADIUS) ** 2;
    for (const body of this.bodies.values()) {
      if (!body.alive) continue;
      const dx = body.position.x - x, dz = body.position.z - z, d = dx * dx + dz * dz;
      if (d > reach) continue;
      body._searchDistance = d;
      out.push(body);
    }
    return out.sort((a, b) => a._searchDistance - b._searchDistance);
  }
  /** The same: a fighter is never lying anywhere the game did not put it. */
  findBodies(x: number, z: number, radius: number, out: StandIn[]) { return this.findTargets(x, z, radius, out); }
  reset() {}
  update() {}
  applyHits() {}
  dispose() { this.bodies.clear(); }
}

const fields = new WeakMap<object, GameField>();

/** Nothing to load: the bodies are the fighters. */
export function preloadDummies(): Promise<void> { return Promise.resolve(); }

/** The field of the space the ability draws in (ExtAbility's `dummies`). */
export function ensureField(ctx: object) {
  const space = spaceOfContext(ctx) ?? {};
  let field = fields.get(space);
  if (!field) { field = new GameField(space); fields.set(space, field); }
  return field;
}

/** The Armory counts its casts to show and hide its ring; the game has none to show. */
export function trackCast() {}
export function untrackCast() {}
