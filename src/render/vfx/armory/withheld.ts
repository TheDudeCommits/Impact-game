/** Stand-ins for the VFX Armory, a separate effects library under its own licence that is not part of this repository.
 *
 *  The game's Armory integration (this folder) compiles and runs against these: there is no Armory effect to look up,
 *  cast or hear, so every fighter whose casting would have drawn one falls back to the engine's own effects, and the
 *  host's particle, decal, burst and fissure systems are inert. A build that carries the library replaces this module
 *  with the library's own exports. */
import * as THREE from 'three';
import type { ArmoryAbilityClass, ArmorySoundName, ArmorySoundProfile } from './types';
import type { FighterCasting } from '../../../engine/vfx/casting';

// ---- the catalogue: empty -------------------------------------------------------------------------------------------

export interface ArmoryManifestEntry {
  readonly id: string;
  readonly label: string;
  readonly school: string;
  readonly settings: string;
  readonly cast: 'line' | 'zone';
  readonly hash: string;
  readonly usedBy: readonly string[];
  readonly kit?: string;
  readonly aura?: boolean;
  readonly thumb?: string;
  readonly load: () => Promise<ArmoryAbilityClass>;
}
export const ARMORY_MANIFEST: Readonly<Record<string, ArmoryManifestEntry>> = {};

export type RuntimeCasting = { readonly palette: FighterCasting['palette']; readonly slots?: Partial<FighterCasting['slots']> };
export const ARMORY_CASTINGS: Readonly<Record<string, RuntimeCasting>> = {};

export interface ForgeCatalogEntry { readonly id: string; readonly label: string; readonly school: string; readonly kit?: string; readonly cast: 'line' | 'zone'; readonly aura?: boolean; readonly thumb?: string }
export const ARMORY_EFFECTS: readonly ForgeCatalogEntry[] = [];

// ---- sound: none ----------------------------------------------------------------------------------------------------

export interface ArmoryRecipeVoice { readonly end: number; stop?(when: number, fade?: number): number }
export type ArmoryKit = { readonly ac: BaseAudioContext };
export type ArmoryRecipe = (kit: ArmoryKit, out: AudioNode, t: number, p: Record<string, unknown>) => ArmoryRecipeVoice;
export interface ArmoryRecipes {
  makeKit(ac: BaseAudioContext): ArmoryKit;
  readonly RECIPES: Readonly<Record<string, ArmoryRecipe>>;
  readonly RECIPE_INFO: Readonly<Record<string, { readonly loop: boolean; readonly about: string; readonly params: Readonly<Record<string, number | string>> }>>;
  readonly LOOP_RECIPES: ReadonlySet<string>;
}
export const ARMORY_SOUND_PROFILES: Readonly<Record<string, ArmorySoundProfile>> = {};
export const ARMORY_SOUND_NAMES: Readonly<Record<string, ArmorySoundName>> = {};
export const loadRecipes: (() => Promise<ArmoryRecipes>) | undefined = undefined;

// ---- the host's systems: inert --------------------------------------------------------------------------------------

const box = <T>(value: T) => ({ value });
/** The shared uniforms the host keeps up to date each frame. */
export const frame: any = {
  uTime: box(0), uDelta: box(0), uCameraNear: box(.1), uCameraFar: box(1000), uSceneDepth: box(null as unknown),
  uResolution: box(new THREE.Vector2(1, 1)), uShaderIntensity: box(1), uGlobalGlow: box(1), uLightDir: box(new THREE.Vector3(0, 1, 0)),
  fighters: new Map<string, unknown>(), light: undefined,
};
export const LAYER: any = { DISTORTION: 31 };
export const settings: any = { global: { lightIntensity: 1, lightRadius: 1, shaderIntensity: 1, glow: 1, opacity: 1 } };
export const noiseGLSL = '';
export const patchOnBeforeCompile = (_material: unknown, _patch: unknown) => undefined;
export const sceneHooks = { install: (_options: unknown) => undefined, apply: () => undefined };

/** A system that holds nothing and draws nothing. */
class Inert {
  readonly pools = new Map<unknown, unknown>();
  readonly systems = new Map<string, unknown>();
  readonly group = new THREE.Group();
  readonly pool = { acquire: () => ({ group: new THREE.Group() }), release: (_item: unknown) => undefined, free: [] as { group: THREE.Object3D }[] };
  constructor(_root?: THREE.Object3D) {}
  spawn(..._args: unknown[]): unknown { return undefined; }
  update(_dt?: number) {}
  flush() {}
  reset() {}
  clear() {}
  dispose() {}
  _poolFor(_key: unknown) { return this.pool; }
}
export const ParticleEngine: any = Inert;
export const DecalSystem: any = Inert;
export const BurstSystem: any = Inert;
export const FissureSystem: any = Inert;
