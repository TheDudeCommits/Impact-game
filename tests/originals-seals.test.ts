import { describe, expect, it } from 'vitest';
import { moveFor } from '../src/game/awakening';
import { MOVES } from '../src/game/moves';
import type { FighterId } from '../src/game/types';
import { areaJaOf } from '../src/engine/sim/areaMoves';
import { ORIGINAL_AREAS } from '../src/originals/area';
import { LAUNCH, SHOWN_FIGHTERS } from '../src/originals/launch';
import { ORIGINALS } from '../src/originals/roster';
import { originalSealChars } from '../src/originals/sealChars';
import { EMBLEMS, emblemText } from '../src/render/area/emblems';
import { ORIGINAL_EMBLEMS, shownEmblem } from '../src/originals/emblems';
import { PIXEL_EMBLEMS } from '../src/originals/pixelEmblems'; // the Pixel port's (merged 3 November 2026)
import glyphs from '../src/render/area/glyphs.json';
import { charsOf, ringLatin, type GlyphSet } from '../src/render/area/glyphText';
import { sealTextOf } from '../src/render/AreaTelegraph';
import { R6P_HOLD } from '../src/originals/shop/r6p';

const SET = glyphs as unknown as GlyphSet;
const shown = [...SHOWN_FIGHTERS];
/** The seals a fighter casts: its area move, and the one its awakened form casts where that is another. */
const casts = (id: FighterId) => [...new Set([MOVES[id].area, moveFor(id, 'area', true)])];
const PENDING = new Set<FighterId>(['kosho']);


describe('the originals\' floor seals', () => {
  it('have every character they letter baked: the kanji of the ring and the capitals of the name', () => {
    expect(shown.length).toBeGreaterThan(0);
    for (const id of shown) for (const move of casts(id)) {
      const { ja, en } = sealTextOf(id, move.name);
      for (const c of [...charsOf(ja), ...charsOf(ringLatin(en))]) expect(SET.glyphs[c], `${id} ${move.name}: ${c} of ${ja} / ${en}`).toBeDefined();
      for (const c of charsOf(emblemText(shownEmblem(id, EMBLEMS[id])))) expect(SET.glyphs[c], `${id}'s emblem ${c}`).toBeDefined();
    }
  });

  it('are on the bake\'s list, so a rebake keeps them', () => {
    const baked = new Set(originalSealChars());
    for (const [id, area] of Object.entries(ORIGINAL_AREAS) as [FighterId, NonNullable<(typeof ORIGINAL_AREAS)[FighterId]>][]) {
      for (const c of charsOf(area.ja)) expect(baked.has(c), `${id}: ${c} of ${area.ja}`).toBe(true);
      for (const c of charsOf(ringLatin(area.name))) expect(baked.has(c), `${id}: ${c} of ${area.name}`).toBe(true);
    }
    for (const c of baked) expect(SET.glyphs[c], c).toBeDefined();
  });


  it('stamp the original\'s own mark at the centre, never the withheld fighter\'s (the pixel cast theirs, src/originals/pixelEmblems.ts)', () => {
    const POINTING = new Set<FighterId>(Object.keys(PIXEL_EMBLEMS) as FighterId[]);
    for (const id of shown.filter(id => POINTING.has(id))) {
      expect(EMBLEMS[id], `${id}: Pixel's own emblem`).toBe(PIXEL_EMBLEMS[id]);
      expect([...PIXEL_EMBLEMS[id]!.glyph].length, id).toBeGreaterThanOrEqual(1);
    }
    for (const id of shown.filter(id => !POINTING.has(id))) {
      const emblem = ORIGINAL_EMBLEMS[id];
      expect(emblem, `${id} has an emblem of its own`).toBeDefined();
      expect('glyph' in emblem! && [...emblem.glyph].length, id).toBeGreaterThanOrEqual(1);
      expect(shownEmblem(id, EMBLEMS[id]), id).toBe(emblem);
      expect(emblemText(emblem!), id).toBe(emblemText(EMBLEMS[id]));
      expect('symbol' in emblem!, `${id}: a drawn symbol would be a licensed logo`).toBe(false);
    }
    // (round 6: and the originals held for their drawn art, src/originals/shop/r6b.ts, whose seals are ready)
    expect(Object.keys(ORIGINAL_EMBLEMS).sort(), 'no emblem for a slot outside the fork').toEqual([...shown, ...LAUNCH.hold].filter(id => !POINTING.has(id)).sort());
  });

  it('read the writers\' lines: the five that showed the earlier card and seal have entries of their own', () => {
    const lines: Partial<Record<FighterId, [string, string, string]>> = {
      gorai: ['Wyrm Breath', 'Wyrm Breath', '嵐竜の息吹'], dorado: ['Crown Clash', 'Crown Clash', '王冠の激突'],
      shiun: ['Hymn 7: Storm Psalm', 'Storm Psalm', '聖歌七番・嵐の詩篇'], gaunt: ['Scrap Repeater', 'Scrap Repeater', '鉄屑連射'],
      ippon: ['All-Nighter Desk Flip', 'Desk Flip', '残業ちゃぶ台返し'], shiden: ['Storm Art: Great Thunderball', 'Thunderball', '霆遁・大雷球'],
      asahi: ['Daybreak Cycle', 'Daybreak Cycle', '夜明けの巡り'],
    };
    for (const [id, [name, card, ja]] of Object.entries(lines) as [FighterId, [string, string, string]][]) {
      const area = ORIGINAL_AREAS[id]!;
      expect([area.name, area.card ?? area.name, area.ja], id).toEqual([name, card, ja]);
      expect(ORIGINALS[id]!.names[area.main], id).toBe(name);
    }
  });
});
