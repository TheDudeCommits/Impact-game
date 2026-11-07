import * as THREE from 'three';
import { propColliders } from '../../../game/stageProps';
import { LIQUID_FLOORS } from '../../../game/footing';
import { addShaderPatch } from '../../look/shaderPatch';
import { modelTriangles, type GroundContext, type GroundPlan } from '../build';
import { box, DENSITY, FLOWERS, GroundField, HEIGHT, type TerrainField, valueNoise } from '../mask';
import { wallsFromModel, WaterSurface, type WaterPlan } from '../water';
import { splashImpulse, subscribeSplashes } from '../splashes';

/** A river surface and a falls' card among a model's meshes, which are water, not bank. */
const RIVER = /^Material\.0(10|16)$/;
const notRiver = (mesh: THREE.Mesh) => !RIVER.test((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).name);

/** The Ashfall Weir's river: its surface, and the stretch of it the waves are simulated over - the play area and its
 *  margins, bank to bank, open upstream and down (the river runs on past both). */
export const VALLEY_WATER: Omit<WaterPlan, 'walls' | 'look'> = {
  name: 'valley river',
  level: LIQUID_FLOORS['ashfall-weir']!.level,
  sim: { x0: -28, z0: -62, x1: 28, z1: 58 },
  open: [true, true],
  speed: 7, damping: .4,
  sources: [{ x: -2.6, z: -52, radius: 10, depth: .01, every: .2 }],
};

/** The Ashfall Weir's ground: the fight stands in the river, so the river takes the waves; grass and moss where it is dry.
 *  The place replaces the water with its own surface (src/originals/grounds.ts). */
export const VALLEY_GROUND: GroundPlan = {
  wind: { heading: 0, strength: .16, gusts: 2.5 },
  async water(c) {
    const plan: WaterPlan = {
      ...VALLEY_WATER,
      walls: field => {
        wallsFromModel(field, modelTriangles(c.model, notRiver), VALLEY_WATER.level, .12);
        for (const p of propColliders('ashfall-weir')) field.paint(DENSITY, box(p.x, p.z, p.halfX, p.halfZ), 1, 'max', .3);
      },
      source: findRiver(c.model),
      look: { crest: 0xe2ddff, foam: 0xf0ecff },
    };
    if (!plan.source) throw new Error('ashfall weir: the river (Material.010) was not found');
    const water = new WaterSurface(c.frame, plan);
    c.own(water);
    c.own({ dispose: subscribeSplashes((x, z, size, dx, dz) => water.push(splashImpulse(x, z, size, dx, dz))) });
  },
  grass: [{
    name: 'valley rims',
    rect: { x0: -45, z0: -100, x1: 45, z1: 70 }, texel: .5,
    floor: { keep: notRiver, texel: .5, up: .72, fallback: -50 },
    look: { height: .42, root: 0x22402c, cool: 0x3a8a5c, warm: 0x7aaa4c, tip: 0xa8c060, warmth: .5, width: .05 },
    cover: { opacity: .95 },
    paint: paintValley,
  }],
  finish(c) {
    mossOnStone(c);
  },
};

/** Where the valley grows grass: every dry, level patch a metre and more above the water. */
function paintValley(field: GroundField, _c: GroundContext, t?: TerrainField) {
  if (!t) return;
  const thin = valueNoise(81), bloom = valueNoise(82);
  field.map(DENSITY, (_, x, z) => {
    const y = t.sample(x, z);
    if (y < 1 || !t.laid[Math.min(t.height - 1, Math.max(0, Math.floor((z - t.rect.z0) / t.texel))) * t.width + Math.min(t.width - 1, Math.max(0, Math.floor((x - t.rect.x0) / t.texel)))]) return 0;
    return (y > 20 ? 1 : .75) * (.6 + .4 * thin(x * .2, z * .2));
  });
  field.map(HEIGHT, (_, x, z) => .8 + .4 * thin(x * .13 + 5, z * .13));
  field.map(FLOWERS, (_, x, z) => bloom(x * .1, z * .1) > .7 ? 1 : 0);
}

/** The moss's colour and strength, shared by the stone materials. */
export const MOSS = { uMossColor: { value: new THREE.Color(0x3d7d2e) }, uMossAmount: { value: .85 } };

/** Moss: the stone greened where water and shade keep it damp - its feet at the waterline and the tops of its ledges and
 *  boulders - in the stage's own stone material, by world position and facing (no new draws). */
function mossOnStone(c: GroundContext) {
  if (import.meta.env?.DEV && typeof window === 'object') (window as unknown as { __moss?: (hex: number, amount?: number) => void }).__moss = (hex, amount = 1) => { MOSS.uMossColor.value.setHex(hex); MOSS.uMossAmount.value = amount; };
  const done = new Set<THREE.Material>();
  c.model.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !notRiver(mesh)) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      if (done.has(material) || !(material instanceof THREE.MeshStandardMaterial)) continue;
      done.add(material);
      addShaderPatch(material, 'ground-valley-moss-v1', shader => {
        Object.assign(shader.uniforms, MOSS);
        shader.vertexShader = 'varying vec3 vMossWorld;\nvarying vec3 vMossNormal;\n' + shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace('#include <project_vertex>', 'vMossWorld = ( modelMatrix * vec4( transformed, 1. ) ).xyz;\nvMossNormal = normalize( mat3( modelMatrix ) * objectNormal );\n#include <project_vertex>');
        shader.fragmentShader = 'varying vec3 vMossWorld;\nvarying vec3 vMossNormal;\nuniform vec3 uMossColor;\nuniform float uMossAmount;\n' + MOSS_NOISE + shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
	{
		float n = mossNoise( vMossWorld.xz * .35 + vMossWorld.y * .2 ) * .6 + mossNoise( vMossWorld.xz * 1.7 ) * .4;
		float wet = 1. - smoothstep( .4, 2.2 + n * 1.5, vMossWorld.y );
		float ledge = smoothstep( .55, .85, vMossNormal.y ) * smoothstep( .8, 1.5, vMossWorld.y );
		float moss = clamp( max( wet * .9, ledge * .75 ) * smoothstep( .3, .55, n ), 0., 1. ) * uMossAmount;
		diffuseColor.rgb = mix( diffuseColor.rgb, uMossColor * ( .7 + n * .6 ), moss );
	}`);
      });
    }
  });
}

const MOSS_NOISE = `
float mossHash( vec2 p ) { vec3 q = fract( vec3( p.xyx ) * .1031 ); q += dot( q, q.yzx + 33.33 ); return fract( ( q.x + q.y ) * q.z ); }
float mossNoise( vec2 p ) { vec2 i = floor( p ), f = fract( p ), u = f * f * ( 3. - 2. * f ); return mix( mix( mossHash( i ), mossHash( i + vec2( 1., 0. ) ), u.x ), mix( mossHash( i + vec2( 0., 1. ) ), mossHash( i + vec2( 1., 1. ) ), u.x ), u.y ); }
`;

/** A model's river surface, if it has one. */
function findRiver(model: THREE.Object3D) {
  let found: THREE.Mesh | undefined;
  model.traverse(o => {
    const m = o as THREE.Mesh;
    if (!found && m.isMesh && /^Material\.010$/.test((Array.isArray(m.material) ? m.material[0] : m.material).name)) found = m;
  });
  return found;
}
