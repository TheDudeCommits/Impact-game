import { AWAKENINGS } from '../game/awakening';
import type { FighterId } from '../game/types';
import { awakenedPower } from './awakenedPower';


/** How strongly `fighter`'s standing aura colours them while awakened (0..1), or undefined where none stands. A
 *  definition that burns outside Dust Sea is as it was: its own `auraGlow`, Taisei's and Ouga's default of 1. */
export function standingAura(fighter: FighterId): number | undefined {
  const power = awakenedPower(fighter);
  return power.shell ? power.glow : undefined;
}

const saturation = (hex: number) => { const r = hex >> 16 & 255, g = hex >> 8 & 255, b = hex & 255, max = Math.max(r, g, b); return max ? (max - Math.min(r, g, b)) / max : 0; };
const shade = (hex: number, k: number) => Math.round((hex >> 16 & 255) * k) << 16 | Math.round((hex >> 8 & 255) * k) << 8 | Math.round((hex & 255) * k);
const shells = new Map<number, readonly [number, number]>();
/** The two colours `fighter`'s standing aura is drawn in, core then rim, from their aura's (their outfit's where it has
 *  one). A definition that burns is as authored. The work-in-progress fighters' auras were written the other way
 *  round from the released roster's - a near-white core and the fighter's colour as the rim (Tempo's white and crimson,
 *  Mikage's white and violet) where Ippon's is gold then red - and the shell prints its core as the broad band and
 *  already keeps a white-hot one against the body, so drawn as written they stood a white outline with a hairline of
 *  colour, and their light bleached the body it was meant to tint. Where the core is that pale (under three tenths
 *  saturated, and the rim a tenth more) the rim is the aura's colour and a deeper shade of it the edge. */
export function standingColours(fighter: FighterId, aura: readonly [number, number]): readonly [number, number] {
  const power = awakenedPower(fighter);
  // (The power's own colours where its shell is not the fighter's aura: Will's haze is its edge's, whoever wears it.)
  if (power.colours) return power.colours;
  if (!power.shell || AWAKENINGS[fighter].flames) return aura;
  const key = aura[0] * 0x1000000 + aura[1];
  let colours = shells.get(key);
  if (!colours) { const pale = saturation(aura[0]) < .3 && saturation(aura[1]) >= saturation(aura[0]) + .1; shells.set(key, colours = pale ? [aura[1], shade(aura[1], .5)] : aura); }
  return colours;
}

/** Awakened with no energy to show: the floor says it instead (dust pressed out from under their feet, AwakeningEffects). */
export const PHYSICAL_PRESENCE: ReadonlySet<FighterId> = new Set((Object.keys(AWAKENINGS) as FighterId[]).filter(id => awakenedPower(id).physical));
