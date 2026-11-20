/**
 * Impact, live in dude.work (the world's docs/LIVE.md; the contract is ./live-contract.ts). A duel is always on in the
 * Gate Ring of the world's Ring Terraces, fought by the game's own bots on its own sim; a visitor walking onto the ring
 * floor takes over the fighter nearest them, with the game's own camera, controls, HUD and sound, and hands them back
 * with Esc. No menu, no title card, no loading screen.
 *
 * This file stays small (the world loads it to know the game); the game is ./livegame.ts, a chunk of its own. Every call
 * the world makes runs inside the cartridge runtime (./runtime.ts, `rt.within`): what three uploads for the game then is
 * the game's to let go, and only then.
 */
import type * as THREE_NS from 'three';
import type { LiveCourt, LiveGame, LiveHost, LiveView } from './live-contract';
import { rt } from './runtime';
import type { Running } from './livegame';

declare const __IMPACT_SOURCE__: string;

export const meta = { id: 'impact', title: 'Impact', source: __IMPACT_SOURCE__ };

export default function impactLive(): LiveGame {
  let game: Running | null = null;
  let T: typeof THREE_NS | null = null;
  let idleCam: THREE_NS.PerspectiveCamera | null = null;
  let noCourt: LiveCourt | null = null;
  const zero = () => ({ at: new T!.Vector3(), yaw: 0 });
  return {
    get court() { return game?.court ?? noCourt!; },
    get camera() { return game?.camera ?? idleCam!; },
    async mount(host: LiveHost, progress) {
      T = host.THREE;
      idleCam = new T.PerspectiveCamera();
      noCourt = { matrix: new T.Matrix4(), bounds: { minX: 0, maxX: 0, minZ: 0, maxZ: 0 } };
      progress(0.02);
      rt.begin(host, true);
      try {
        const root = rt.app!;
        const { boot } = await import('./livegame');
        progress(0.1);
        // (dude.work round 8, roadmap S2: the duel's chunk's evaluation and the boot's first stretch each in a frame of
        // their own, not one after the other in the same task)
        await host.slot?.();
        game = await boot(host, root, progress);
        progress(1);
      } catch (error) {
        rt.end();
        throw error;
      }
    },
    update(dt, now) { rt.within(() => { rt.frame(now); game?.update(dt, now); }); },
    draw(view: LiveView) { rt.within(() => game?.draw(view)); },
    join(at, yaw) { return rt.within(() => game?.join(at, yaw) ?? false); },
    leave() { return rt.within(() => game?.leave() ?? zero()); },
    you() { return rt.within(() => game?.you() ?? null); },
    notice(at) { rt.within(() => game?.notice(at)); },
    resize(w, h) { rt.within(() => game?.resize(w, h)); },
    status() { return game?.status() ?? null; },
    unmount() {
      const g = game;
      game = null;
      try { rt.within(() => g?.dispose()); } finally { rt.end(); }
    },
  };
}
