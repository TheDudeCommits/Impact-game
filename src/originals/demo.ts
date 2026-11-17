import type { FighterId } from '../game/types';
import type { StageId } from '../game/stages';

/** The dude-world demo (VITE_DEMO=dude-world, the cartridge build: vite.cartridge.config.ts): the launch gate (launch.ts)
 *  narrowed to the demo's slice - one Duel against the game's own bot (BOTS only: nothing online, no couch), on one
 *  place, with a short roster. Everywhere else (VITE_DEMO unset) it is undefined and the game is all there. */
export interface Demo {
  /** The fighters shown, playable and dealt as the bot rival, in the home's order. */
  fighters: readonly FighterId[];
  /** The catalogue's modes (ui/modes/catalogue.ts ModeId) the home offers. */
  modes: readonly string[];
  /** Their ways (VariantId): 'offline' is BOTS. */
  ways: readonly string[];
  /** The one place the Duel is fought. */
  stage: StageId;
  /** The score's pieces it ships (public/assets/music/originals/<name>.m4a): the home's, the fight's, the results'. Every
   *  other slot of the soundtrack plays one of these (launch.ts gateMusic). */
  music: readonly string[];
}

const wanted = (() => { try { return import.meta.env?.VITE_DEMO as string | undefined; } catch { return undefined; } })();

export const DEMO: Demo | undefined = wanted === 'dude-world' ? {
  fighters: ['taisei', 'kenzo', 'kuon', 'shiden', 'setsu'],
  modes: ['duel'],
  ways: ['offline'],
  stage: 'sunfall-arena',
  music: ['pages-of-legend', 'static-trail', 'last-light', 'skyborn-ascent'],
} : undefined;
