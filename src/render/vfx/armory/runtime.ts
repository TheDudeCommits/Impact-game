import type * as THREE from 'three';
import { ARMORY_MANIFEST } from './withheld';
import { ArmoryHost } from './host';
import { ArmoryEffectType, type ArmoryParams } from './effect';
import { armorySound, soundBank } from './sound';

/**
 * The Armory's runtime, loaded only where a casting or a Forge kit draws with it (castingSignature.ts and forgeFx.ts
 * import it lazily: a page that never asks for an effect never fetches it, or any vendored file).
 *
 * One `armory/<id>` type per effect per scene, shared by every fighter whose casting uses it (each instance takes its
 * fighter's colours), made once with a capacity fixed from the whole rollout's casting, so it does not depend on which
 * fighter loaded first.
 */
/** Whether an Armory effect was vendored into this build. */
export const vendored = (id: string) => Object.hasOwn(ARMORY_MANIFEST, id);

/** The scene's types for `ids`, loaded (their classes imported) and prewarmed. Each caller holds the host once
 *  (`ArmoryHost.for`), released with its registry. */
export async function armoryTypes(scene: THREE.Scene, ids: readonly string[], capacity: (id: string) => number) {
  const host = ArmoryHost.for(scene);
  const mine = host.types as Map<string, ArmoryEffectType>;
  const out: ArmoryEffectType[] = [];
  for (const id of ids) {
    let type = mine.get(id);
    if (!type) {
      const entry = ARMORY_MANIFEST[id];
      if (!entry) continue;
      const Klass = await entry.load();
      type = mine.get(id);
      if (!type) {
        type = new ArmoryEffectType(host, id, Klass, capacity(id));
        mine.set(id, type);
        type.prewarm(scene);
      }
    }
    out.push(type);
  }
  return { host, types: out };
}

/** A casting's sound, asked of the page's bank and made (rendered, cut, addressed) now, at load: each Armory cue's and
 *  its body aura's, in the mode its slot asks for (sound.ts). */
export function prepareSound(track: { readonly cues: readonly { readonly type: string; readonly params?: unknown }[]; readonly body?: { readonly effect: string; readonly params: ArmoryParams } }) {
  const bank = soundBank();
  for (const cue of track.cues) {
    const mode = (cue.params as ArmoryParams | undefined)?.sound;
    if (mode && cue.type.startsWith('armory/')) bank.need(cue.type.slice('armory/'.length), mode);
  }
  if (track.body?.params.sound) bank.need(track.body.effect, track.body.params.sound);
  return bank.prepare();
}

/** A room's Armory sound made and decoded before FIGHT: the bank's renders and cuts awaited (`prepareSound` only started
 *  them), then its files handed to the game's audio and polled until it holds them all, or `cap` ms. Without it the files
 *  were handed over by the fight's first frames and decoded as they arrived, a burst of main-thread work that long (a
 *  250 ms frame in a twelve-fighter match: scripts/night/load_hitches.mjs). */
export async function readySound(cap = 3000, current: () => boolean = () => true) {
  const bank = soundBank(), until = performance.now() + cap;
  // Behind the loading screen the bank works in longer slices and hands the game's audio more files at a time (sound.ts
  // `rushing`); in the fight it is idle-time work, a few milliseconds a frame.
  bank.rushing++;
  try {
    await Promise.race([bank.prepare(), new Promise<void>(done => setTimeout(done, cap))]);
    const player = armorySound();
    if (!player) return;
    while (current() && performance.now() < until) {
      player.bank.pump(player.out);
      if (player.bank.settled(player.out)) return;
      await new Promise<void>(done => setTimeout(done, 40));
    }
  } finally { bank.rushing--; }
}

/** Every frame: the bank's files handed to the game's audio until it has loaded them (it can once the arena is entered). */
export function pumpSound() {
  const player = armorySound();
  player?.bank.pump(player.out);
}
