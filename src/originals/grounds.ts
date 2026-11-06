import type { StageId } from '../game/stages';
import type * as THREE from 'three';
import type { GroundPlan, GrassPlan } from '../render/ground/build';
import type { WaterPlan } from '../render/ground/water';
import { LIQUID_FLOORS, type LiquidFloor } from '../game/footing';

type GrassLook = GrassPlan['look'];
/** Every grass field of a plan in another colour (its blades' root, cool, warm and tip). */
const regrass = (look: Partial<GrassLook>, cover?: GrassPlan['cover']) => (plan: GroundPlan): GroundPlan => ({
  ...plan,
  grass: plan.grass?.map(g => ({ ...g, look: { ...g.look, ...look }, ...(cover !== undefined ? { cover } : {}) })),
});

const mereWater: GroundPlan['water'] = async c => {
  const [{ propColliders }, { box, DENSITY }, { WaterSurface }, { splashImpulse, subscribeSplashes }, { SHRINE_WATER }, { stageMaterial }, THREE, { STAGE_LANDMARKS }] = await Promise.all([
    import('../game/stageProps'), import('../render/ground/mask'), import('../render/ground/water'), import('../render/ground/splashes'),
    import('../render/ground/places/mirrorMere'), import('../render/stages/build'), import('three'), import('../game/environmentLayout')]);
  const bed = await new THREE.TextureLoader().loadAsync('/assets/environment/cc0/tex/pebbles-river-diff.webp');
  bed.colorSpace = THREE.SRGBColorSpace; bed.wrapS = bed.wrapT = THREE.RepeatWrapping; bed.repeat.set(64, 64); bed.anisotropy = 8;
  const source = new THREE.Mesh(new THREE.PlaneGeometry(320, 320, 4, 4).rotateX(-Math.PI / 2).translate(0, SHRINE_WATER.level, 0),
    stageMaterial('mirror-mere', 'mere water', { map: bed, emissive: 0x06050f, emissiveIntensity: 1, roughness: .14, metalness: .2 }));
  // The stones' brown taken to a near-black indigo (the bed's mean is about a fifth of white).
  (source.material as InstanceType<typeof THREE.MeshStandardMaterial>).color.setRGB(.2, .19, .34);
  source.name = 'mere water'; source.receiveShadow = true;
  c.group.add(source);
  const plan: WaterPlan = {
    ...SHRINE_WATER, name: 'mere water', source,
    walls: field => {
      for (const p of [...STAGE_LANDMARKS['mirror-mere'], ...propColliders('mirror-mere')]) field.paint(DENSITY, box(p.x, p.z, p.halfX, p.halfZ), 1, 'max', .3);
    },
    look: { crest: 0x6a5ca8, foam: 0x8a7cc8 }, // places-epic-a: the rings and froth in the hex's violet, dim by night
  };
  const water = new WaterSurface(c.frame, plan);
  c.own(water);
  c.own({ dispose: subscribeSplashes((x, z, size, dx, dz) => water.push(splashImpulse(x, z, size, dx, dz))) });
};

const ashPrints: GroundPlan['sand'] = async c => {
  const [{ SandPrints }, { GROUND_TIERS }] = await Promise.all([import('../render/ground/sand'), import('../render/ground/quality')]);
  const prints = new SandPrints(c.frame, { name: 'ash prints', rect: { x0: -46, z0: -46, x1: 46, z1: 46 }, level: 0, life: 30, shade: .55 }, GROUND_TIERS.high.prints);
  c.group.add(prints.mesh);
  c.own(prints);
};

/** The Sunfall Arena's dust (stages-old): the canyon's sand blown over the dial's face takes a footprint and fills in again,
 *  faint (a dust of sand on stone, not a dune), over the dial. */
const dialDust: GroundPlan['sand'] = async c => {
  const [{ SandPrints }, { GROUND_TIERS }] = await Promise.all([import('../render/ground/sand'), import('../render/ground/quality')]);
  const prints = new SandPrints(c.frame, { name: 'dial dust', rect: { x0: -20, z0: -20, x1: 20, z1: 20 }, level: 0, life: 20, shade: .8 }, GROUND_TIERS.high.prints);
  c.group.add(prints.mesh);
  c.own(prints);
};

export const GROUND_CHANGES: Partial<Record<StageId, (plan: GroundPlan) => GroundPlan>> = {
  'ash-colosseum': plan => ({ wind: plan.wind, sand: ashPrints }),
  // The Mirror Mere: the lake's waves in its own pale colours, on its own surface (r9, built whole in code).
  'mirror-mere': plan => ({ wind: plan.wind, water: mereWater }),
  'sunfall-arena': plan => ({ wind: plan.wind, sand: dialDust }),
};

export function applyOriginalGrounds(grounds: Partial<Record<StageId, () => Promise<GroundPlan>>>) {
  for (const [id, change] of Object.entries(GROUND_CHANGES) as [StageId, (plan: GroundPlan) => GroundPlan][]) {
    const load = grounds[id];
    if (load) grounds[id] = () => load().then(change);
  }
  return grounds;
}

export function originalLiquid(stage: StageId): LiquidFloor | undefined {
  const main = LIQUID_FLOORS[stage];
  return stage === 'mirror-mere' && main ? { ...main, kind: 'water', lit: 0xe0d6ff, shade: 0x3e3a70 /* places-epic-a: night water */ } : main;
}
