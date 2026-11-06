import * as THREE from 'three';
import { STAGES, type StageId } from '../../game/stages';
import { GroundFrame } from './frame';
import { GroundField, TerrainField, type Rect } from './mask';
import { GrassField, PALETTES, type GrassLook } from './grass';
import { GROUND_ANSWERS, optOutOfCutaway } from './toon';
import { GroundCover, type CoverLook } from './cover';
import { FlowerField, type FlowerLook } from './flowers';
import { LitterField, type LitterLook } from './litter';

/** What a place's ground is made of (one entry of GROUNDS, ./index.ts). Every
 *  layer is optional: a place takes the ones that make sense on its floor. */
export interface GroundPlan {
  /** The wind over the place: heading (radians, three's yaw: 0 blows toward +z), strength, gust speed (m/s). */
  wind?: { heading: number; strength: number; gusts?: number };
  grass?: readonly GrassPlan[];
  /** Water with a wave field (./water.ts), built with the place. */
  water?: (c: GroundContext) => Promise<void> | void;
  /** Loose ground that takes footprints (./sand.ts). */
  sand?: (c: GroundContext) => Promise<void> | void;
  /** The place's own last touches, after the layers. */
  finish?: (c: GroundContext) => void;
}

/** A grass field: where it grows, on what floor, and how it looks. */
export interface GrassPlan {
  name: string;
  /** The field's rectangle of floor and its mask's texel (m). */
  rect: Rect;
  texel?: number;
  /** Paint the mask: DENSITY where it grows, HEIGHT, FLOWERS (./mask.ts);
   *  `terrain` is the floor's baked heights, when it has them. */
  paint: (field: GroundField, c: GroundContext, terrain?: TerrainField) => void;
  /** The floor it stands on: a level (m), or heights baked off the place's own
   *  model (or the whole stage's root, kit pieces and all: `source`), from the
   *  meshes `keep` passes. */
  floor: number | { keep: (mesh: THREE.Mesh) => boolean; source?: 'model' | 'root'; texel?: number; up?: number; ceiling?: number; fallback?: number };
  look: GrassLook;
  cover?: CoverLook | false;
  flowers?: FlowerLook | false;
  /** Fallen leaves on the floor (./litter.ts): where they lie, their colours. */
  litter?: LitterLook;
}

export interface GroundContext {
  stage: StageId;
  /** The stage's root: the ground's group hangs here, shown and released with it. */
  root: THREE.Group;
  model: THREE.Object3D;
  frame: GroundFrame;
  group: THREE.Group;
  /** A texture or render target the ground made, released with it. */
  own(resource: { dispose(): void }): void;
}

/** Build a place's ground under its root. The meshes tick their own frame
 *  (GroundFrame) and are released with the stage (StageEnvironment.release
 *  disposes every mesh it finds); what is not a mesh's - textures, render
 *  targets, listeners - goes with a hidden anchor's material. */
export async function buildGround(stage: StageId, root: THREE.Group, model: THREE.Object3D, plan: GroundPlan) {
  const frame = new GroundFrame(plan.wind);
  const group = new THREE.Group();
  group.name = `${stage}: ground`;
  const owned: { dispose(): void }[] = [];
  const c: GroundContext = { stage, root, model, frame, group, own: r => { owned.push(r); } };
  for (const grass of plan.grass ?? []) layGrass(c, grass);
  if (plan.water) await plan.water(c);
  if (plan.sand) await plan.sand(c);
  plan.finish?.(c);
  const anchor = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ visible: false }));
  anchor.name = 'ground anchor';
  (anchor.material as THREE.Material).addEventListener('dispose', () => { for (const r of owned.splice(0)) r.dispose(); });
  group.add(anchor);
  root.add(group);
  frame.watch(group);
  owned.push({ dispose: () => frame.detach() });
  installProbe(stage, frame, group);
  return { frame, group };
}

function layGrass(c: GroundContext, plan: GrassPlan) {
  const field = new GroundField(plan.rect, plan.texel ?? .5);
  let baked: TerrainField | undefined;
  if (typeof plan.floor !== 'number') {
    const f = plan.floor;
    baked = new TerrainField(plan.rect, f.texel ?? 1, f.fallback ?? 0);
    baked.lay(modelTriangles(f.source === 'root' ? c.root : c.model, f.keep), f.up ?? .35, f.ceiling ?? Infinity);
  }
  plan.paint(field, c, baked);
  // The GPU reads the mask only for the ground sheet; the blades and flowers
  // are laid out from the CPU's copy (clumps.ts).
  const mask = new THREE.DataTexture(field.bytes(), field.width, field.height, THREE.RGBAFormat, THREE.UnsignedByteType);
  mask.minFilter = mask.magFilter = THREE.LinearFilter; mask.wrapS = mask.wrapT = THREE.ClampToEdgeWrapping;
  mask.needsUpdate = true; mask.name = `${plan.name} mask`;
  c.own(mask);
  const terrain: TerrainField | number = baked ?? (typeof plan.floor === 'number' ? plan.floor : 0);
  const region = lensRegion(c.stage);
  const grass = new GrassField(c.frame, { cpu: field, floor: terrain, region }, plan.look, plan.name);
  c.group.add(grass.root);
  c.own(grass);
  if (plan.cover !== false) c.group.add(new GroundCover(c.frame, field, mask, terrain, plan.look, plan.cover ?? {}, `${plan.name} cover`).mesh);
  if (plan.cover && plan.cover.opaque && plan.cover.earth !== undefined && typeof terrain === 'number') c.group.add(underlay(field.rect, terrain, plan.cover.earth, `${plan.name} underlay`));
  if (plan.litter) {
    const litter = new LitterField(c.frame, { cpu: field, region, floor: terrain }, plan.litter, `${plan.name} litter`);
    c.group.add(litter.mesh);
    c.own(litter);
  }
  if (plan.flowers && typeof terrain === 'number') {
    const flowers = new FlowerField(c.frame, { cpu: field, region, baseY: terrain }, plan.look.height, plan.flowers, `${plan.name} flowers`);
    c.group.add(flowers.mesh);
    c.own(flowers);
  }
}

/** Under an opaque ground sheet that is the floor (the place's own flat floor
 *  put away), a plain earth-coloured plane a little below it, out past the
 *  field's edge: whatever ever cuts the sheet - a gap at a wall's foot, the
 *  lens dipping to the floor - shows earth, never the painted sky's foot (on
 *  the colosseum, purple). One unlit draw the sheet hides. */
export function underlay(rect: Rect, floor: number, earth: number, name: string) {
  const width = rect.x1 - rect.x0 + 8, depth = rect.z1 - rect.z0 + 8;
  const geometry = new THREE.PlaneGeometry(width, depth).rotateX(-Math.PI / 2);
  geometry.translate((rect.x0 + rect.x1) / 2, floor - .04, (rect.z0 + rect.z1) / 2);
  const material = new THREE.MeshBasicMaterial({ name, color: new THREE.Color(earth).multiplyScalar(.55) });
  optOutOfCutaway(material);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name; mesh.renderOrder = 1;
  return mesh;
}

/** Where the lens can be on a place: its play area and a margin (the chase
 *  camera stands behind the fighter, and stops at the camera walls on the
 *  bounds). The grass is laid out within each ring's reach of it. */
export function lensRegion(stage: StageId, margin = 6): Rect {
  const { halfX, halfZ } = STAGES[stage];
  return { x0: -halfX - margin, z0: -halfZ - margin, x1: halfX + margin, z1: halfZ + margin };
}

/** Every triangle of the model's meshes that `keep` passes, in world space. */
export function* modelTriangles(model: THREE.Object3D, keep: (mesh: THREE.Mesh) => boolean): Generator<[number, number, number, number, number, number, number, number, number]> {
  model.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  model.traverse(o => { if (o instanceof THREE.Mesh && keep(o)) meshes.push(o); });
  const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3();
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
    const count = index ? index.count : position.count;
    for (let k = 0; k + 2 < count; k += 3) {
      const i0 = index ? index.getX(k) : k, i1 = index ? index.getX(k + 1) : k + 1, i2 = index ? index.getX(k + 2) : k + 2;
      a.fromBufferAttribute(position, i0).applyMatrix4(mesh.matrixWorld);
      b.fromBufferAttribute(position, i1).applyMatrix4(mesh.matrixWorld);
      d.fromBufferAttribute(position, i2).applyMatrix4(mesh.matrixWorld);
      yield [a.x, a.y, a.z, b.x, b.y, b.z, d.x, d.y, d.z];
    }
  }
}

/** Dev builds only: `window.__ground` switches a place's ground's meshes off
 *  and on by name and draws them several times over, for costing each on the
 *  GPU (`__look.bench`) while other work shares the machine. */
function installProbe(stage: StageId, frame: GroundFrame, group: THREE.Group) {
  if (!import.meta.env?.DEV || typeof window === 'undefined') return;
  const meshes = () => { const list: THREE.Mesh[] = []; group.traverse(o => { if ((o as THREE.Mesh).isMesh && !o.userData.groundCopy && o.name !== 'ground anchor') list.push(o as THREE.Mesh); }); return list; };
  const copies: THREE.Mesh[] = [];
  Object.defineProperty(window, '__ground', { configurable: true, value: {
    stage,
    /** Every mesh drawn (true) or none (false). */
    show: (on: boolean) => { for (const m of meshes()) m.visible = on; frame.enabled = on; },
    /** Only the meshes whose names hold `name` ('' for none). */
    only: (name: string) => { for (const m of meshes()) m.visible = !!name && m.name.includes(name); frame.enabled = !!name; },
    /** Each mesh whose name holds `name` drawn `times` more over itself (0 takes the copies away). */
    amplify: (name: string, times: number) => {
      for (const c of copies.splice(0)) c.removeFromParent();
      for (const m of meshes()) if (m.name.includes(name)) for (let k = 0; k < times; k++) {
        const c = m.clone(); c.userData.groundCopy = true; c.onBeforeRender = () => {}; m.parent!.add(c); copies.push(c);
      }
      return copies.length;
    },
    meshes: () => meshes().map(m => ({ name: m.name, visible: m.visible, instances: (m.geometry as THREE.InstancedBufferGeometry).instanceCount ?? 1, vertices: m.geometry.getAttribute('position').count })),
    bodies: () => frame.bodies.list.map(b => ({ id: b.id, x: +b.x.toFixed(2), z: +b.z.toFixed(2), hy: +b.hy.toFixed(2), feet: b.feet.map(f => f.down) })),
    quality: () => frame.quality.current,
    /** Tick before the scene's passes (true, the default) or from the ground's first draw inside them. */
    hook: (on: boolean) => { frame.sceneHook = on; if (!on) frame.detach(); },
    /** The ground's own answers to the toon look (toon.ts GROUND_ANSWERS), live. */
    answers: (o: Record<string, number>) => { for (const [k, v] of Object.entries(o)) { const u = (GROUND_ANSWERS as Record<string, { value: number }>)[k]; if (u) u.value = v; } return Object.fromEntries(Object.entries(GROUND_ANSWERS).map(([k, u]) => [k, u.value])); },
    /** Every grass layer's colours (sRGB hex), live. */
    palette: (o: { root?: number; cool?: number; warm?: number; tip?: number; earth?: number; warmth?: number }) => {
      for (const p of PALETTES) { if (o.root !== undefined) p.uRoot.value.setHex(o.root); if (o.cool !== undefined) p.uCool.value.setHex(o.cool); if (o.warm !== undefined) p.uWarm.value.setHex(o.warm); if (o.tip !== undefined) p.uTip?.value.setHex(o.tip); if (o.earth !== undefined) p.uEarth?.value.setHex(o.earth); if (o.warmth !== undefined) p.uWarmth.value = o.warmth; }
    },
  } });
}
