import * as THREE from 'three';
import type { GLTF, GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { FighterDefinition } from '../../config';
import type { PlayerState } from '../../game/types';
import { addOpenHands } from './openHands';
import { joinClips } from '../clipMatch';

export const SUNRISE_FLOAT = {
  /** Metres over the floor, standing and gliding; and through an attack, a little lower so his blows meet a standing
   *  body nearer its middle. */
  lift: .3, striking: .22,
  /** The bob: two slow, unrelated sines (metres, Hz), so it never reads as a metronome. */
  bob: [[.034, .42], [.013, .97]] as const,
  /** How fast the lift follows its target (1/s): rising into the float as the form arrives, sinking out of it into a
   *  knockdown. */
  ease: 4.5,
  /** A landing gives under him: this much, over this long (s), and back. */
  land: .1, landFor: .28,
  /** His own takes for standing, travelling and blocking while he floats. */
  idle: 'G5 Float', run: 'G5 Glide', guard: 'G5 Guard',
} as const;

/** Down on the floor: the reactions that put him there, and the end. */
const FLOORED = new Set(['knockdown', 'getup', 'defeated', 'splat']);
/** Swings, where he floats a little lower (SUNRISE_FLOAT.striking). */
const STRIKING = new Set(['light', 'heavy', 'special', 'ultimate']);

/** Where a floating form should be over its floor now (metres), before the bob, by what he is doing. */
export function floatTarget(state: Pick<PlayerState, 'action' | 'alive'>) {
  if (!state.alive || FLOORED.has(state.action)) return 0;
  return STRIKING.has(state.action) ? SUNRISE_FLOAT.striking : SUNRISE_FLOAT.lift;
}

/** The slow bob at `time` seconds (a fighter's own phase so two floating Gummys do not bob together). */
export function floatBob(time: number, phase = 0) {
  let y = 0;
  for (const [amount, rate] of SUNRISE_FLOAT.bob) y += amount * Math.sin(2 * Math.PI * rate * time + phase * (1 + rate));
  return y;
}

/** The dip a landing makes in the float, `since` seconds after it (metres, down). */
export function floatLanding(since: number) {
  if (since < 0 || since > SUNRISE_FLOAT.landFor) return 0;
  const u = since / SUNRISE_FLOAT.landFor;
  return SUNRISE_FLOAT.land * Math.sin(Math.PI * Math.min(1, u * 1.6)) * (1 - u);
}

/** Round 5 (GUMMY): a form's own extra takes (`formExtraModels`, bound onto the form's skeleton by bone name as
 *  `extraModels` are onto the body's - a take with a name the form has replaces it) and the open hands of body and form
 *  (`openHandsModel`, openHands.ts: the file names them 'gummy-open-hand-*' for his body and 'gummy-g5-open-hand-*' for
 *  SUNRISE's, the only fighter that ships one). Idempotent: a room loading the fighter again finds them done. */
export async function bindFormExtras(loader: GLTFLoader, definition: FighterDefinition, body: GLTF, form: GLTF | undefined,
  bind: (scene: THREE.Object3D, clips: THREE.AnimationClip[], label?: string) => THREE.AnimationClip[]) {
  if (form) for (const url of definition.formExtraModels ?? []) {
    try {
      form.animations = joinClips(form.animations, bind(form.scene, (await loader.loadAsync(url)).animations, `${definition.name} form`));
    } catch (error) { console.warn(`${definition.name}: form clips unavailable (${url})`, error); }
  }
  if (definition.openHandsModel) {
    try {
      const hands = await loader.loadAsync(definition.openHandsModel);
      addOpenHands(body, hands, 'gummy');
      if (form) addOpenHands(form, hands, 'gummy-g5');
    } catch (error) { console.warn(`${definition.name}: open hands unavailable (${definition.openHandsModel})`, error); }
  }
}
