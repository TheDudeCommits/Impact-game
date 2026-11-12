import type * as THREE from 'three';
import type { StageId } from '../../game/stages';
import type { GroundPlan } from './build';
import { applyOriginalGrounds } from '../../originals/grounds';

export const GROUNDS: Partial<Record<StageId, () => Promise<GroundPlan>>> = {
  'ash-colosseum': () => import('./places/ashColosseum').then(m => m.PROVING_GROUND),
  'ashfall-weir': () => import('./places/ashfallWeir').then(m => m.VALLEY_GROUND),
  'sunward-summit': () => import('./places/sunwardSummit').then(m => m.SUMMIT_GROUND),
  'mirror-mere': () => import('./places/mirrorMere').then(m => m.SHRINE_GROUND),
  'sunfall-arena': () => import('./places/sunfallArena').then(m => m.TOURNAMENT_GROUND),
  'cinder-flats': () => import('./places/cinderFlats').then(m => m.CINDER_GROUND),
  'starfall-crater': () => import('./places/starfallCrater').then(m => m.CRATER_GROUND),
};
applyOriginalGrounds(GROUNDS);

/** What each of the main game's places gets, and why (the brief's "decide,
 *  place by place"): every place has a line, so none is left by accident. */
export const GROUND_DECISIONS: Record<Exclude<StageId, 'ashwood' | 'blood-citadel' | `rift-${string}` | `ball-${string}`>, { ground: readonly ('grass' | 'water' | 'sand' | 'reeds' | 'moss' | 'leaves')[]; why: string }> = {
  'ash-colosseum': { ground: ['grass', 'leaves'], why: 'A grass field inside the stadium wall, knee-high toward the edges and a true green rather than olive. Fallen leaves on its tracks and under its trees.' },
  'ashfall-weir': { ground: ['water', 'grass', 'moss'], why: 'The fight stands in the river: it takes the waves, on the river\'s own surface (src/originals/grounds.ts). Grass where the banks are dry, moss where the stone stays wet at the waterline; the reeds along the banks are the place\'s own dressing.' },
  'sunward-summit': { ground: ['grass'], why: 'The summit\'s gardens: lawns in the four corners round the rim and grass in the gardens\' stone beds. The paving the fight is held on stays bare.' },
  'sunfall-arena': { ground: ['grass'], why: 'The lawn round the ring: the ring stands over a grass field, seen past and below its edges all fight long (the bounds hold the fight on the ring). The ring itself stays stone; the grass parts round stream E\'s ringside pieces and masts, and the competitors\' walk to the gate stays stone.' },
  'mirror-mere': { ground: ['water'], why: 'The fight is on a red lake: it takes the waves, drawn on the lake\'s own dark mirror (stream E\'s) in its reds, coming back off the mounds strewn through it. Nothing grows there.' },
  'wreckers-causeway': { ground: [], why: 'The long causeway: tarred timber on stone piers, with the sea far below the fight. Nothing grows or flows where anyone stands.' },
  'hollowmere-quarry': { ground: [], why: 'A cobbled town square at the bottom of the iron pit, its wear its own. The street stays stone.' },
  'proving-hall': { ground: [], why: 'Indoors: the training hall\'s floor. Nothing grows or flows inside.' },
  'cinder-flats': { ground: ['sand'], why: 'The white desert under the night fortress: nothing grows there, but its sand takes every footprint and fills in again as the wind crosses it.' },
  'warlords-roof': { ground: [], why: 'A fortress roof: tiles over the island\'s fortress, nothing grows or flows on a roof.' },
  'zenith-coliseum': { ground: [], why: 'A ring of stone on a spire over the clouds: no ground round it to grow, and no water.' },
  'drifting-isle': { ground: [], why: 'A tiled floor floating in empty space: tiles under a starfield, nothing to grow or flow.' },
  harbor: { ground: [], why: 'A paved harbour town: the fight is on cobbles and quays, and the canals lie behind the quay walls, never stood in (no liquid floor). Nothing would grow on its stone.' },
  'starfall-crater': { ground: ['sand'], why: 'The crater: bare, swept earth with nothing left growing on it - but loose, so it keeps the fighters\' footprints, filling in as the dust settles.' },
  'dry-harbour': { ground: [], why: 'The plaza\'s flagstones and the dry bay\'s salt flat: nothing grows on either, and no water is left to wade (no liquid floor). Its cracks and wear are the place\'s own.' },
  'thornwood-ward': { ground: [], why: 'A cracked plaza of asphalt and paving: its tufts of grass and its puddles are the place\'s own dressing, low and flat (no liquid floor).' },
  'kuroyuki-hall': { ground: [], why: 'Indoors: a tatami hall in a wooden corridor over a void. Nothing grows or flows in it; the lanterns\' light pooled on the mats is the place\'s own dressing (render/stages/kuroyukiHall.ts).' },
  'scrap-pit': { ground: [], why: 'A ring of riveted steel plate at the bottom of a scrap pit: nothing grows on it and nothing lies loose to take a print; its oil and scuffs are the plate\'s own.' },
};

/** Lay a place's ground under its root, if it has one (StageEnvironment calls
 *  this as it builds a place). A ground that fails leaves the bare floor,
 *  never a broken match; in Node (the collision tests) there is no page. */
export async function dressGround(stage: StageId, root: THREE.Group, model: THREE.Object3D) {
  const plan = GROUNDS[stage];
  if (!plan || typeof document === 'undefined') return;
  // A dev build can leave the ground out altogether (?ground-none), for
  // before-and-after captures of a place in the same build.
  if (import.meta.env?.DEV && typeof location === 'object' && new URLSearchParams(location.search).has('ground-none')) return;
  try {
    const [{ buildGround }, recipe] = await Promise.all([import('./build'), plan()]);
    await buildGround(stage, root, model, recipe);
  } catch (error) {
    console.warn(`Ground failed: ${stage}`, error);
  }
  // A dev build can leave parts of a place out by mesh name, for costing them
  // (?ground-off=<regex>, e.g. "pocket tree|asian/bush").
  const off = import.meta.env?.DEV && typeof location === 'object' ? new URLSearchParams(location.search).get('ground-off') : null;
  if (off) { const pattern = new RegExp(off); root.traverse(o => { if ((o as THREE.Mesh).isMesh && pattern.test(o.name)) o.visible = false; }); }
}
