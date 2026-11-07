import { ARMORY_RUNTIME } from './rollout';

/**
 * Where the Armory's sound goes: the game's own audio (docs/engine/armory/README.md, "Sound").
 *
 * The Armory's effects play through CombatAudio's public one-shot path (`sample`, `preload`, `sampleSeconds`): the
 * game's AudioContext and its effects bus, so the player's volume settings, the voice duck, the stage's reverb, the
 * effects' voice cap and their placement in the world (distance and pan from the listener) all apply as to the game's
 * own sounds. Nothing here reaches into CombatAudio (another session's): main.ts hands the game's audio over, once.
 * CombatAudio keeps its bus to itself, so a loop is played as overlapping segments (render/vfx/armory/sound.ts).
 */
export interface SoundAt { readonly x: number; readonly y: number; readonly z: number }

/** What the Armory's sound needs of the game's audio: CombatAudio has exactly this. */
export interface ArmorySoundOut {
  /** A one-shot by url at a place in the world, `delay` seconds from now (CombatAudio.sample). One not loaded yet is
   *  loaded for next time and skipped. */
  sample(url: string, at: SoundAt, gain: number, rate?: number, owner?: string, priority?: number, delay?: number): void;
  /** Fetch and decode ahead of the first use (once the player has entered the arena, which makes the context). */
  preload(urls: readonly string[]): void;
  /** A loaded sample's length, or undefined until it is decoded. */
  sampleSeconds(url: string): number | undefined;
  /** Let go of decoded samples no effect built now will play (CombatAudio.release). */
  release?(urls: readonly string[]): void;
}

let out: ArmorySoundOut | undefined;

/** main.ts: the game's audio, for the Armory's sound (the rollout's castings, a Forge kit's effects). */
export function connectArmorySound(audio: ArmorySoundOut) { if (ARMORY_RUNTIME) out = audio; }
export const armorySoundOut = (): ArmorySoundOut | undefined => out;
