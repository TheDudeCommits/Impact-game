import type * as THREE from 'three';

/**
 * The VFX Armory's ability API, as the adapter uses it (types only).
 *
 * The Armory is plain JavaScript; scripts/engine/armory/vendor.mts copies the effects a casting picks into ./vendor and
 * writes a `.d.ts` beside each module the game's TypeScript imports, pointing here. These are the parts of
 * `src/abilities/Ability.js` (and its context, `AbilityManager`'s) the host and the effect type touch: nothing more is
 * promised, so a vendored class that grows new members needs no change here.
 */

/** A light handle from `ctx.lights.acquire()`, or null when the pool is out. */
export type ArmoryLightHandle = object | null;

/** The Armory's LightPool API: what every ability calls. The game's version borrows its fixed pool (host.ts). */
export interface ArmoryLightsApi {
  acquire(): ArmoryLightHandle;
  set(handle: ArmoryLightHandle, position: THREE.Vector3, color: THREE.Color, intensity: number, distance: number, dt: number): void;
  release(handle: ArmoryLightHandle): void;
  update(dt: number): void;
  reset(): void;
  dispose(): void;
}

/** The Armory's CameraShake API (abilities add trauma; the sandbox's rig moves). The game never moves its camera for it. */
export interface ArmoryShakeApi {
  add(amount: number, decay?: number, frequency?: number): void;
  rumble(amount: number, dt: number): void;
  update(dt: number): void;
  reset(): void;
}

/** The Armory's ScreenFlash API. */
export interface ArmoryFlashApi {
  trigger(color: THREE.Color, strength: number, decay?: number): void;
  update(dt: number): void;
  reset(): void;
}

/** `ctx`, as every ability is constructed with: `{ scene, camera, environment, particles, lights, decals, fissures,
 *  bursts, shake, flash }`. Here `scene` is the instance's own root (host.ts `ArmorySpace`), not the game's scene. */
export interface ArmoryContext {
  scene: THREE.Object3D;
  camera: THREE.Camera;
  environment: { scene: THREE.Object3D; renderer?: { gl: unknown }; equirect?: THREE.Texture | null; registerShadowCaster?<M>(material: M): M; registerShadowCasterWithPatch?<M>(material: M, patch: unknown): M };
  particles: unknown;
  lights: ArmoryLightsApi;
  decals: unknown;
  fissures: unknown;
  bursts: unknown;
  shake: ArmoryShakeApi;
  flash: ArmoryFlashApi;
}

/** One Armory ability instance (src/abilities/Ability.js). */
export interface ArmoryAbility {
  readonly element: string;
  readonly group: THREE.Group;
  /** 'idle' | 'travel' | 'impact' | 'fade' | 'done' */
  phase: string;
  readonly origin: THREE.Vector3;
  readonly direction: THREE.Vector3;
  readonly side: THREE.Vector3;
  length: number;
  /** Metres the front has travelled, and that as a fraction of `length`. */
  front: number;
  u: number;
  /** The front's world point (what the Armory's camera frames). */
  readonly position: THREE.Vector3;
  age: number;
  light: ArmoryLightHandle;
  readonly isActive: boolean;
  readonly isFinished: boolean;
  readonly impactDuration: number;
  readonly fadeDuration: number;
  readonly config: Record<string, unknown>;
  spawn(origin: THREE.Vector3, direction: THREE.Vector3, distance: number): void;
  update(dt: number): void;
  destroy(): void;
  dispose(): void;
}

export type ArmoryAbilityClass = new (context: ArmoryContext) => ArmoryAbility;

/**
 * The Armory's sound, as data (src/engine/vfx/armory/sounds.json; the Armory's src/audio/README.md): every effect's
 * cue profile and every named sound. scripts/engine/armory/vendor.mts copies the vendored effects' profiles and the
 * sounds they name into ./vendor/sounds.ts, with each sample bank's files at their address in public/.
 */
export interface ArmorySoundLayer {
  readonly sound: string;
  readonly gain: number;
  readonly delay?: number;
  readonly pitch?: number;
  /** An impact layer plays only at or above / at or below this intensity (0 to 1). */
  readonly minIntensity?: number;
  readonly maxIntensity?: number;
  readonly params?: Readonly<Record<string, number | string>>;
}
export interface ArmorySoundProfile {
  readonly kind?: string;
  /** At the cast. */
  readonly cast?: readonly ArmorySoundLayer[];
  /** Its charge (risers), also at the cast. */
  readonly charge?: readonly ArmorySoundLayer[];
  /** Held while it burns: from the cast, its first hit (`release`) or its impact phase, until its impact or fade phase or
   *  its end, and never longer than `max` seconds. */
  readonly loop?: {
    readonly layers: readonly ArmorySoundLayer[]; readonly at: 'cast' | 'release' | 'impact'; readonly until: 'impact' | 'fade' | 'end'; readonly max: number;
    /** The seconds it dies down over when it stops (the Armory's default: a quarter to two thirds of a second). */
    readonly fade?: number;
  };
  /** On its first hit (`first`, replacing that hit's own) and on every hit, at least `gap` seconds apart and at least
   *  `min` strong (0.06 by default; a few voice the faintest ticks). */
  readonly impacts?: readonly { readonly on: 'first' | 'hit'; readonly layers: readonly ArmorySoundLayer[]; readonly gap?: number; readonly min?: number }[];
  /** As it fades. */
  readonly tail?: readonly ArmorySoundLayer[];
}
/** A synth recipe (the Armory's src/audio/recipes.js, vendored at ./vendor/audio/recipes.js) or a sample bank, whose
 *  `files` are addresses without their extension, one per variant, in each of `formats`. */
export type ArmorySoundName =
  | { readonly type: 'synth'; readonly recipe: string; readonly loop: boolean; readonly params: Readonly<Record<string, number | string>> }
  | { readonly type: 'sample'; readonly bank: string; readonly files: readonly string[]; readonly formats: readonly string[]; readonly loop: boolean; readonly durations: readonly number[] };
