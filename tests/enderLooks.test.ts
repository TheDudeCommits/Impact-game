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
 *  values come back exactly. Both tables were re-recorded for one reason: GroundMarks.mark takes a `rotation` (the ball
 *  modes' skid and stamp marks) whose default draws its Math.random before the mark's seed, so the seeded draws come in a new
 *  order; with the old order put back, both old tables pass exactly. Nothing is drawn differently. Both were re-recorded
 *  again when ids and the effects' object names were renamed (the fingerprint folds in every object's name): with the names
 *  left out, all 61 enders fold to the same value before and after, dream loop on and off.
 *  Both were re-recorded again when the shared kit's material gained `uStep` (the film look's effects drawn on twos) and
 *  the toon materials `uReelBoil` (the film look's boil), both nothing in the modern look: with those two names left out
 *  of the hash, both old tables pass exactly, dream loop on and off. Nothing is drawn differently.
 *  Both were re-recorded again for new uniform names alone: the victim veil's cap for every fighter (`uVeilC`, `uVeilCap`,
 *  `uVeilCapOn`), the guard's `uGuardInk` and the see-through's `uOccSketch`; with those names left out of the hash, both
 *  old tables pass exactly, the cap on and off. Nothing is drawn differently. */
const SHOP_FINGERPRINTS: Record<string, number> = {
  'gorai:lh': 3154383874, 'gorai:llh': 1006272740, 'gorai:lllh': 1703929232, 'gorai:llls': 3933713207, 'gorai:airHeavy': 4230450593, 'gorai:airSpecial': 3235427468, 'gorai:llls:awakened': 1947498631,
  'sorrel:lh': 16080017, 'sorrel:llh': 1454612000, 'sorrel:lllh': 3785399234, 'sorrel:llls': 3161307722, 'sorrel:airHeavy': 419719647, 'sorrel:airSpecial': 344397828,
  'shiun:lh': 825785900, 'shiun:llh': 1191847918, 'shiun:lllh': 2991619342, 'shiun:llls': 2028282708, 'shiun:airHeavy': 4219901224, 'shiun:airSpecial': 3371795639,
  'magatsu:lh': 2473528370, 'magatsu:llh': 771271276, 'magatsu:lllh': 384133459, 'magatsu:llls': 4099758469, 'magatsu:airHeavy': 1161583193, 'magatsu:airSpecial': 1633233812,
  'imago:lh': 3244785651, 'imago:llh': 3528369013, 'imago:lllh': 2415730181, 'imago:llls': 2893039692, 'imago:airHeavy': 366743617, 'imago:airSpecial': 167547406,
  'sekka:lh': 1867508467, 'sekka:llh': 1739957109, 'sekka:lllh': 1299427257, 'sekka:llls': 4261177004, 'sekka:airHeavy': 3296193476, 'sekka:airSpecial': 2553897,
  'tobari:lh': 1164239643, 'tobari:llh': 3030553710, 'tobari:lllh': 2164050671, 'tobari:llls': 2183813300, 'tobari:airHeavy': 132472321, 'tobari:airSpecial': 2275912020,
  'asahi:lh': 1678489473, 'asahi:llh': 2527507092, 'asahi:lllh': 3267838663, 'asahi:llls': 1860025980, 'asahi:airHeavy': 4164566182, 'asahi:airSpecial': 4017210811,
  'gohaku:lh': 730800021, 'gohaku:llh': 1473899139, 'gohaku:lllh': 3070462025, 'gohaku:llls': 1046900933, 'gohaku:airHeavy': 1024848061, 'gohaku:airSpecial': 37175233,
  'ippon:lh': 2821304772, 'ippon:llh': 3457682308, 'ippon:lllh': 2836022238, 'ippon:llls': 2461075325, 'ippon:airHeavy': 198826923, 'ippon:airSpecial': 194444251,
};
/** The same enders under the dream loop (src/render/dreamFlag.ts), recorded with it on: their own glow is the colour of the
 *  blow under its burst (EmperorEffects.flash, at 0.45 of its strength and 0.7 of its reach), and the shared kit draws its
 *  layered hit (VfxKit.szImpact), the dust column, the victim veil (VictimVeil VEIL_LIGHT), the dirt flecks a heavy blow
 *  into the floor throws up (VfxKit.groundImpact) and each stone of that floor cut its own way (Debris STONE_CUT). With
 *  `DREAM_OFF=1` the table above holds, byte for byte. */
const SHOP_FINGERPRINTS_DREAM: Record<string, number> = {
  'gorai:lh': 1002520413, 'gorai:llh': 3807593118, 'gorai:lllh': 2654715909, 'gorai:llls': 2153715846, 'gorai:airHeavy': 3618886659, 'gorai:airSpecial': 1610097843, 'gorai:llls:awakened': 314187585,
  'sorrel:lh': 609313526, 'sorrel:llh': 1202696512, 'sorrel:lllh': 184175963, 'sorrel:llls': 1467217437, 'sorrel:airHeavy': 1217676105, 'sorrel:airSpecial': 2906919292,
  'shiun:lh': 2903999715, 'shiun:llh': 91317010, 'shiun:lllh': 862350543, 'shiun:llls': 481525629, 'shiun:airHeavy': 4207035547, 'shiun:airSpecial': 1958567907,
  'magatsu:lh': 3858647759, 'magatsu:llh': 3947121514, 'magatsu:lllh': 2223114892, 'magatsu:llls': 2099873772, 'magatsu:airHeavy': 2159305857, 'magatsu:airSpecial': 2143363906,
  'imago:lh': 1608821832, 'imago:llh': 1133391803, 'imago:lllh': 3833385846, 'imago:llls': 1395500592, 'imago:airHeavy': 1114084055, 'imago:airSpecial': 3233191952,
  'sekka:lh': 1924126870, 'sekka:llh': 896355212, 'sekka:lllh': 1008966463, 'sekka:llls': 4142350389, 'sekka:airHeavy': 1600198349, 'sekka:airSpecial': 992014613,
  'tobari:lh': 3864451966, 'tobari:llh': 1242907428, 'tobari:lllh': 30253194, 'tobari:llls': 3426224432, 'tobari:airHeavy': 3424096261, 'tobari:airSpecial': 2734632722,
  'asahi:lh': 1648177368, 'asahi:llh': 516625480, 'asahi:lllh': 1648540786, 'asahi:llls': 2428975833, 'asahi:airHeavy': 305999331, 'asahi:airSpecial': 1536240451,
  'gohaku:lh': 3218102945, 'gohaku:llh': 3038383263, 'gohaku:lllh': 1982994017, 'gohaku:llls': 3328976966, 'gohaku:airHeavy': 1617129637, 'gohaku:airSpecial': 4116187209,
  'ippon:lh': 2217986628, 'ippon:llh': 3660663584, 'ippon:lllh': 1182324153, 'ippon:llls': 2300567898, 'ippon:airHeavy': 588475047, 'ippon:airSpecial': 3967567945,
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
