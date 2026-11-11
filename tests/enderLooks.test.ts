import { afterEach, describe, expect, it, vi } from 'vitest';
import { COMBO_KEYS } from '../src/game/combos';
import type { FighterId } from '../src/game/types';
import { run } from './enderHarness';
import { DREAM_IMPACT } from '../src/render/dreamFlag';

/**
 * The combo enders' decorations (EmperorEffects `ender`): generalised so the main game's sixteen are drawn with them
 * in their own elements, and the shop's twenty exactly as they were. The shop's are pinned here by a fingerprint of
 * everything the layer leaves in the scene - every object's transform and visibility, every buffer and every
 * material's uniforms - frame by frame through each of their six enders, recorded on the code before it was
 * generalised (tests/enderHarness.ts).
 */
afterEach(() => vi.restoreAllMocks());

/** The shop's enders, as they were drawn before `ender` was generalised. The fingerprint folds in every object's name and
 *  every material uniform's name, and seeds Math.random by the fighter id's length (enderHarness.ts), so a renamed object or
 *  uniform, a new uniform, or a new random draw before a seeded one moves its values with nothing drawn differently. Re-record
 *  (RECORD_ENDER_LOOKS=1, and DREAM_OFF=1 for this table) only for such a change, after checking that with it undone the old
 *  values come back exactly. Both tables were last re-recorded for one reason: GroundMarks.mark takes a `rotation` (the ball
 *  modes' skid and stamp marks) whose default draws its Math.random before the mark's seed, so the seeded draws come in a new
 *  order; with the old order put back, both old tables pass exactly. Nothing is drawn differently. */
const SHOP_FINGERPRINTS: Record<string, number> = {
  'gorai:lh': 2806788342, 'gorai:llh': 1103315960, 'gorai:lllh': 3858287008, 'gorai:llls': 371818471, 'gorai:airHeavy': 2200301305, 'gorai:airSpecial': 2327642912, 'gorai:llls:awakened': 2654975735,
  'sorrel:lh': 947133985, 'sorrel:llh': 430350300, 'sorrel:lllh': 4239051802, 'sorrel:llls': 1202129686, 'sorrel:airHeavy': 2305515463, 'sorrel:airSpecial': 3911632716,
  'shiun:lh': 2806445000, 'shiun:llh': 2410079314, 'shiun:lllh': 3812598068, 'shiun:llls': 1747145728, 'shiun:airHeavy': 2823739428, 'shiun:airSpecial': 2709216473,
  'magatsu:lh': 1736929542, 'magatsu:llh': 618407568, 'magatsu:lllh': 3158269383, 'magatsu:llls': 2522934885, 'magatsu:airHeavy': 2388987225, 'magatsu:airSpecial': 1755139356,
  'imago:lh': 1768700603, 'imago:llh': 2411959309, 'imago:lllh': 3422950235, 'imago:llls': 2893100304, 'imago:airHeavy': 756965233, 'imago:airSpecial': 2933299230,
  'sekka:lh': 2688153667, 'sekka:llh': 3618593077, 'sekka:lllh': 3779447943, 'sekka:llls': 3639927024, 'sekka:airHeavy': 3037296808, 'sekka:airSpecial': 3015606851,
  'tobari:lh': 356125363, 'tobari:llh': 3376717514, 'tobari:lllh': 632424433, 'tobari:llls': 455494080, 'tobari:airHeavy': 2259621161, 'tobari:airSpecial': 1631690656,
  'asahi:lh': 2285095577, 'asahi:llh': 3255268392, 'asahi:lllh': 493769569, 'asahi:llls': 2889697904, 'asahi:airHeavy': 386094826, 'asahi:airSpecial': 4145657581,
  'gohaku:lh': 1605205773, 'gohaku:llh': 30186747, 'gohaku:lllh': 3326933761, 'gohaku:llls': 3139874429, 'gohaku:airHeavy': 2558878973, 'gohaku:airSpecial': 1262440125,
  'ippon:lh': 2148407240, 'ippon:llh': 329010800, 'ippon:lllh': 1693035318, 'ippon:llls': 392981501, 'ippon:airHeavy': 297557835, 'ippon:airSpecial': 3505104671,
};
/** The same enders under the dream loop (src/render/dreamFlag.ts), recorded with it on: their own glow is the colour of the
 *  blow under its burst (EmperorEffects.flash, at 0.45 of its strength and 0.7 of its reach), and the shared kit draws its
 *  layered hit (VfxKit.szImpact), the dust column, the victim veil (VictimVeil VEIL_LIGHT), the dirt flecks a heavy blow
 *  into the floor throws up (VfxKit.groundImpact) and each stone of that floor cut its own way (Debris STONE_CUT). With
 *  `DREAM_OFF=1` the table above holds, byte for byte. */
const SHOP_FINGERPRINTS_DREAM: Record<string, number> = {
  'gorai:lh': 3610207613, 'gorai:llh': 2007103994, 'gorai:lllh': 49357149, 'gorai:llls': 1769964226, 'gorai:airHeavy': 830539795, 'gorai:airSpecial': 2601155667, 'gorai:llls:awakened': 2494398633,
  'sorrel:lh': 1981972898, 'sorrel:llh': 658324884, 'sorrel:lllh': 3664713307, 'sorrel:llls': 1412049221, 'sorrel:airHeavy': 758426521, 'sorrel:airSpecial': 1601324260,
  'shiun:lh': 266567611, 'shiun:llh': 1532102998, 'shiun:lllh': 538753433, 'shiun:llls': 1454657837, 'shiun:airHeavy': 99866579, 'shiun:airSpecial': 1417081877,
  'magatsu:lh': 1161438311, 'magatsu:llh': 1944080086, 'magatsu:lllh': 1426455420, 'magatsu:llls': 4049826816, 'magatsu:airHeavy': 1924622361, 'magatsu:airSpecial': 2139044006,
  'imago:lh': 682059940, 'imago:llh': 1545410987, 'imago:lllh': 2473409548, 'imago:llls': 674316220, 'imago:airHeavy': 2658312007, 'imago:airSpecial': 70491720,
  'sekka:lh': 797172818, 'sekka:llh': 3730430384, 'sekka:lllh': 4035659549, 'sekka:llls': 4024090397, 'sekka:airHeavy': 1476541509, 'sekka:airSpecial': 104597727,
  'tobari:lh': 2283948354, 'tobari:llh': 2550659136, 'tobari:lllh': 1546351068, 'tobari:llls': 428385388, 'tobari:airHeavy': 47778661, 'tobari:airSpecial': 3317545362,
  'asahi:lh': 3418064668, 'asahi:llh': 2650778972, 'asahi:lllh': 786003072, 'asahi:llls': 584160625, 'asahi:airHeavy': 4236545651, 'asahi:airSpecial': 646765853,
  'gohaku:lh': 986143945, 'gohaku:llh': 3082443743, 'gohaku:lllh': 2703425305, 'gohaku:llls': 3778528410, 'gohaku:airHeavy': 3767860037, 'gohaku:airSpecial': 141429061,
  'ippon:lh': 1176078808, 'ippon:llh': 1101016524, 'ippon:lllh': 2050126249, 'ippon:llls': 3238438606, 'ippon:airHeavy': 3689053591, 'ippon:airSpecial': 1641770345,
};
const SHOP: readonly FighterId[] = ['gorai', 'sorrel', 'shiun', 'magatsu', 'imago', 'sekka', 'tobari', 'asahi', 'gohaku', 'ippon'];

describe('the shop\'s enders are drawn exactly as they were', () => {
  it('leaves the same scene, frame for frame, through every ender of ten of the twenty', async () => {
    const seen: Record<string, number> = {};
    for (const f of SHOP) for (const key of COMBO_KEYS) seen[`${f}:${key}`] = run(f, key).folded;
    seen['gorai:llls:awakened'] = run('gorai', 'llls', true).folded;
    if (process.env.RECORD_ENDER_LOOKS) { console.log(JSON.stringify(seen)); if (process.env.RECORD_ENDER_LOOKS.endsWith('.json')) (await import('node:fs')).writeFileSync(process.env.RECORD_ENDER_LOOKS, JSON.stringify(seen)); return; }
    expect(seen).toEqual(DREAM_IMPACT ? SHOP_FINGERPRINTS_DREAM : SHOP_FINGERPRINTS);
  }, 60000);
});
