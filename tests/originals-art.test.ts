import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FORM_BUSTS } from '../src/originals/formBusts';
import { launchUnshipped } from '../src/originals/launchShip';
import { OWN_ART, areaCardWithheld, ownAreaCard } from '../src/originals/ownArt';
import { ORIGINAL_IDS } from '../src/originals/roster';
import { areaArtUrl } from '../src/ui/moveSheet';
import { pictures } from '../src/ui/hud/protos/proto';
import type { FighterId } from '../src/game/types';

const BUSTS = 'public/assets/hud/busts', CARDS = 'public/assets/ui/moves/area';
const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
/** The plates that show an awakened bust (hud-art, 5 November 2026: only a form that looks different, src/originals/formBusts.ts;
 *  tests/originals-form-busts.test.ts pins the list). */
const hasFormBust = (id: FighterId) => FORM_BUSTS.has(id);

describe('the originals\' HUD busts', () => {
  it('are the game\'s own (renders of the fighters\' bodies, drawn for the pixel cast), one for each fighter and a form bust where the HUD asks for one', () => {
    expect(ORIGINAL_IDS.length).toBeGreaterThanOrEqual(36);
    for (const id of ORIGINAL_IDS) {
      for (const name of [`${id}.webp`, ...(hasFormBust(id) ? [`${id}-form.webp`] : [])]) {
        expect(OWN_ART.busts[name], `${name} is listed`).toBeDefined();
        expect(existsSync(`${BUSTS}/${name}`), name).toBe(true);
        expect(sha(`${BUSTS}/${name}`), `${name}: the listed bytes`).toBe(OWN_ART.busts[name]);
      }
      // A form no HUD plate asks for keeps no bust of its own.
      if (!hasFormBust(id)) expect(OWN_ART.busts[`${id}-form.webp`], `${id}-form`).toBeUndefined();
    }
    for (const name of Object.keys(OWN_ART.busts)) expect(existsSync(`${BUSTS}/${name}`), `${name} exists`).toBe(true);
  });

  it('are the only busts that ship: the earlier ones (every other file of both folders) stay out of the package', () => {
    const busts = readdirSync(BUSTS).map(file => `assets/hud/busts/${file}`);
    const cards = readdirSync(CARDS).map(file => `assets/ui/moves/area/${file}`);
    const away = new Set(launchUnshipped([...busts, ...cards]));
    for (const file of busts) expect(away.has(file), file).toBe(!(file.slice('assets/hud/busts/'.length) in OWN_ART.busts));
    for (const file of cards) expect(away.has(file), file).toBe(!(file.slice('assets/ui/moves/area/'.length) in OWN_ART.areaCards));
    expect(launchUnshipped(['assets/hud/busts/not-listed.webp', 'assets/ui/moves/area/not-listed.webp'])).toHaveLength(2);
  });

  it('leave every plate a picture: the bust, else the fighter\'s own manga portrait', () => {
    for (const id of ORIGINAL_IDS) for (const form of [false, true]) {
      const list = pictures(id, form);
      expect(list.at(-1), id).toContain(`/assets/home/portraits/${id}.webp`);
      for (const url of list.slice(0, -1)) expect(url, id).toMatch(/^\/assets\/hud\/busts\//);
      expect(existsSync(`public${list.at(-1)!.split('?')[0]}`), `${id}'s portrait is its own, shipped`).toBe(true);
    }
  });
});

describe('the originals\' area-move cards', () => {
  it('ship none of the earlier and ask for none: the card shows its glyph until a card of the game\'s own is listed', () => {
    for (const id of ORIGINAL_IDS) {
      expect(ownAreaCard(id), id).toBe(`${id}.webp` in OWN_ART.areaCards);
      if (!ownAreaCard(id)) expect(areaArtUrl(id), `${id} requests no picture`).toBeUndefined();
    }
    expect(areaCardWithheld('konta-kurobi')).toBe(true);
    expect(areaCardWithheld('hawser-colossus')).toBe(false);
    for (const [name, listed] of Object.entries(OWN_ART.areaCards)) expect(sha(`${CARDS}/${name}`), name).toBe(listed);
  });
});
