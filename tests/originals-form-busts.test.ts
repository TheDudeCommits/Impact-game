import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';
import { FORM_BUSTS } from '../src/originals/formBusts';
import { OWN_ART } from '../src/originals/ownArt';
import { ORIGINAL_IDS } from '../src/originals/roster';
import { formBust, pictures } from '../src/ui/hud/protos/proto';

const SWAPS: readonly FighterId[] = [
  'taisei', 'konta', 'gummy', 'nigo', 'kenzo', 'gaunt', 'gorai', 'jinlin', 'shiun', 'magatsu', 'vesper', 'gaku', 'rook',
  'hawser', 'rakucho', 'irbis', 'shijima', 'hakushi', 'madake', 'ampere', 'hagure', 'lanthorn', 'shanxiao',
  'tobari', 'ouga', 'wuming',
  'minase', // Minase (minase-build, 5 November): FULL STRIDE is his own body lit gold
  'gohaku',
  'svanhild',
];
/** Awakened, the same look: the plate keeps the base bust. */
const SAME_LOOK: Partial<Record<FighterId, string>> = {
  highsun: 'Highsun, NO SHADOW: his awakened body is his base body (the owner\'s report)',
  onigawara: 'Onigawara, UNMUZZLED: the same body',
  ume: 'Ume, IRON BLOSSOM: the same body',
  kusushi: 'Kusushi, GRAND CHAMPION: the same body and head; a rope belt at her waist, under the bust',
  hikui: 'Hikui, FIRE-EATER: the same body',
  akayuri: 'Akayuri, SCARLET BLOOM: the same body',
  rotfalke: 'Rotfalke, MOTHER\'S WINGS: the same body',
  cardo: 'Cardo, OVERGROWN: his own body, unchanged',
  aquilo: 'Aquilo, WINDBORNE: his own body, unchanged',
  shirokane: 'Shirokane, HARVEST WARDEN: his own body; the guardian rises behind him',
};
/** Slots another agent is rebuilding, which set their own entry (the lead, 5 November evening): Kanata becomes Minase, and
 *  minase-build adds `minase` to FORM_BUSTS, with a form bust of its own, once FULL STRIDE looks different. */
const LEFT_TO_OTHERS: Partial<Record<FighterId, string>> = {
  // (minase-build, 5 November: Minase's FULL STRIDE looks different now, so `minase` is in SWAPS.)
};
/** A transformation with no awakened bust of its own yet: the plate keeps the base bust until one is drawn. */
const NO_BUST_YET: Partial<Record<FighterId, string>> = {
};

describe('the awakened HUD bust', () => {
  it('shows only for the forms judged to look different, and no other fighter\'s', () => {
    expect([...FORM_BUSTS].filter(id => !LEFT_TO_OTHERS[id]).sort()).toEqual([...SWAPS].sort());
    for (const id of ORIGINAL_IDS) if (!LEFT_TO_OTHERS[id]) expect(formBust(id), id).toBe(SWAPS.includes(id));
  });

  it('keeps Highsun\'s own bust while he is awakened, and every other form that looks like its base', () => {
    expect(formBust('highsun')).toBe(false);
    for (const id of Object.keys(SAME_LOOK) as FighterId[]) {
      expect(formBust(id), SAME_LOOK[id]).toBe(false);
      // No awakened bust of theirs is listed, so none ships (src/originals/launchShip.ts).
      expect(OWN_ART.busts[`${id}-form.webp`], id).toBeUndefined();
    }
  });

  it('has the game\'s own awakened bust for every fighter it swaps, first in the plate\'s list', () => {
    for (const id of FORM_BUSTS) {
      expect(OWN_ART.busts[`${id}-form.webp`], id).toBeDefined();
      expect(pictures(id, true)[0], id).toContain(`/assets/hud/busts/${id}-form.webp`);
    }
  });

  it('has judged every original with an awakened body of its own: a new form body needs a verdict here', () => {
    const judged = new Set<string>([...SWAPS, ...Object.keys(SAME_LOOK), ...Object.keys(NO_BUST_YET), ...Object.keys(LEFT_TO_OTHERS)]);
    for (const id of ORIGINAL_IDS) if ((FIGHTERS[id] as { formModel?: string }).formModel) expect(judged.has(id), `${id} has a formModel but no verdict`).toBe(true);
    for (const id of SWAPS) expect(ORIGINAL_IDS, id).toContain(id);
  });
});
