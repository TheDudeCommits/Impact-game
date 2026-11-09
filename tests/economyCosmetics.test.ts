import { describe, expect, it } from 'vitest';
import { ITEMS, released, type ItemKind } from '../src/game/economy/catalog';
import { SKIN } from '../src/render/cosmetics/skins';
import { AURA_IDS, FORM_IDS } from '../src/render/cosmetics/auras';
import { KILL_IDS } from '../src/render/cosmetics/kills';
import { BANNER_IDS } from '../src/ui/survival/banners';
import { OUTFITS } from '../src/game/economy/outfits';
import { FIGHTERS } from '../src/config';
import { HOME_FIGHTERS } from '../src/ui/MangaHome';
import { RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { TRAIL_IDS } from '../src/render/cosmetics/trails';
import { KNOCKOUT_IDS } from '../src/render/cosmetics/knockouts';
import { ENTRANCE_IDS, STAMP_IDS, entranceHtml, stampHtml } from '../src/render/cosmetics/pages';
import { EMOTE_IDS } from '../src/render/cosmetics/emotes';
import { BALL_SKIN_IDS, BALL_TRAIL_IDS, GOAL_BURST_IDS } from '../src/render/ball/ballCosmetics';
import { CELEBRATION_IDS } from '../src/game/ball/look';

/** What draws each kind that is worn. Titles are words: the HUD letters them. */
const DRAWN: Partial<Record<ItemKind, readonly string[]>> = {
  skin: Object.keys(SKIN), aura: AURA_IDS, trail: TRAIL_IDS, ko: KNOCKOUT_IDS, entrance: ENTRANCE_IDS, stamp: STAMP_IDS, emote: EMOTE_IDS,
  kill: KILL_IDS, banner: BANNER_IDS, form: FORM_IDS, outfit: Object.keys(OUTFITS),
  // A fighter is drawn by the game itself - a body in the roster, a panel on the home screen. Every one past the first
  // volume's sixteen is sold (28 October 2026).
  fighter: RELEASED_FIGHTERS.filter(id => FIGHTERS[id] && !HOME_FIGHTERS.includes(id)).map(id => `fighter-${id}`),
  // The ball modes' gear: the ball and its moments draw the skins, trails and bursts; the match holds the celebrations.
  ball: BALL_SKIN_IDS, balltrail: BALL_TRAIL_IDS, goalburst: GOAL_BURST_IDS, celebration: CELEBRATION_IDS,
};

describe('the economy: what is sold is drawn', () => {
  // (8 October 2026, the shop streamlined: what is out is sold, on the road, or retired and still worn by its owners -
  // every one of them must still be drawn.)
  it('draws everything out - on sale, on the road, retired and still worn - and offers nothing it cannot draw', () => {
    for (const item of ITEMS.filter(released)) {
      if (item.kind === 'title') continue;
      expect(DRAWN[item.kind], `${item.kind} has no drawer`).toBeTruthy();
      expect(DRAWN[item.kind], item.id).toContain(item.id);
    }
    for (const [kind, ids] of Object.entries(DRAWN)) for (const id of ids!) expect(ITEMS.find(each => each.id === id)?.kind, id).toBe(kind);
  });
  it('dresses each outfit on the fighter its item names, and only them', () => {
    for (const item of ITEMS.filter(each => each.kind === 'outfit' && each.stage !== 'ask')) { expect(item.fighter, item.id).toBeTruthy(); expect(OUTFITS[item.id]?.fighter, item.id).toBe(item.fighter); }
    for (const [id, outfit] of Object.entries(OUTFITS)) expect(outfit.model || outfit.variant, id).toBeTruthy();
  });
  it('letters an entrance page and a seal, and nothing for what is not one', () => {
    const page = entranceHtml('entrance-night', { fighter: 'kenzo', name: 'Strix <3', title: 'Dark Choir', level: 12 });
    expect(page).toContain('e-night'); expect(page).toContain('STRIX &lt;3'); expect(page).toContain('DARK CHOIR'); expect(page).toContain('LV 12');
    expect(stampHtml('stamp-the-end')).toContain('完'); expect(stampHtml(undefined)).toBe(''); expect(stampHtml('skin-negative')).toBe('');
  });
});
