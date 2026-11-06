import * as THREE from 'three';
import type { StageId } from '../../game/stages';

/** The look plan, stream C: a place's own large pieces near the fight cast into the sun's shadow map,
 *  where it is cheap, so the shadows describe the place.
 *
 *  The base models cast nothing (StageEnvironment): the map is spent on the 36 m box round the fight, and a whole
 *  place drawn into it every frame is vertices for shadows nobody fighting can see. The near scenery the places are
 *  dressed with (src/render/stages: the houses, rocks, crates, lamps, pots, torii, trees and the Sunfall Arena's masts)
 *  casts already. Here, per place, the base model's own sourced meshes that stand near the fight and throw a short
 *  shadow onto it are named by their material, so a re-export that renames them casts nothing rather than
 *  everything. Of the base models, only the crater's cover qualifies:
 *  - the Sunfall Arena's walls, stands and planters stand 30 m and more from the ring, outside the box;
 *  - the floating isle's lamp towers stand 20 m off, and the noon sun throws their shadows away from the fight;
 *  - the stadium's wall and trees would lay the whole fight in shade under an evening sun;
 *  - the training hall's window wall is its light (the cookie). */
const CASTERS: Partial<Record<StageId, RegExp>> = {
  'starfall-crater': /^Crater_Cover(_Tiles)?$/,
};

/** Whether a mesh of a place's own model is one of its casters, by its material's name. */
export function placeCaster(stage: StageId, materialName: string): boolean {
  return CASTERS[stage]?.test(materialName) ?? false;
}

/** The place on show, whose casters (`userData.placeCaster`) cast unless the quality is low: low quality's map is
 *  half the size and spent on the fighters. */
let shown: THREE.Object3D | null = null;
let on = true;
function apply() { shown?.traverse(o => { if (o.userData.placeCaster) o.castShadow = on; }); }
export function showPlaceCasters(root: THREE.Object3D | null) { shown = root; apply(); }
export function setPlaceShadowQuality(quality: 'high' | 'medium' | 'low') { on = quality !== 'low'; apply(); }

/** The sun's shadow ends at the edge of its 36 m box round the fight. A fighter's shadow never reaches it; a place's
 *  can, and it was cut off there in a hard line. Every shadow now fades out over the box's outer eighth (three's PCF
 *  shadow, once for every material). */
const EDGE = /* glsl */`
			// Faded out toward the edge of the sun's box round the fight, so a long shadow ends softly (look/placeShadows.ts).
			vec2 lookShadowEdge = min( shadowCoord.xy, 1.0 - shadowCoord.xy );
			shadow = mix( 1.0, shadow, smoothstep( 0.0, 0.125, min( lookShadowEdge.x, lookShadowEdge.y ) ) );
			return mix( 1.0, shadow, shadowIntensity );`;
let installed = false;
export function installShadowEdge() {
  if (installed) return;
  installed = true;
  const chunk = THREE.ShaderChunk.shadowmap_pars_fragment;
  const pcf = chunk.indexOf('#if defined( SHADOWMAP_TYPE_PCF )');
  const end = '\t\t\treturn mix( 1.0, shadow, shadowIntensity );';
  const at = chunk.indexOf(end, pcf);
  if (pcf < 0 || at < 0) { console.warn('look: the shadow edge fade did not find three\'s PCF shadow'); return; }
  THREE.ShaderChunk.shadowmap_pars_fragment = chunk.slice(0, at) + EDGE.slice(1) + chunk.slice(at + end.length);
}
installShadowEdge();

/** The materials named per place, for the tests. */
export const PLACE_CASTERS = CASTERS;
