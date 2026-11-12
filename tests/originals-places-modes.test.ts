import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { riftLayout } from '../src/game/riftLayouts';
import { STAGES } from '../src/game/stages';
import { LOCATIONS } from '../src/survival/locations';
import { ORIGINAL_STAGES } from '../src/originals/stages';
import { armouryGround } from '../src/originals/places/drownedArmoury';
import { STAR, starGround } from '../src/originals/places/fallenStar';
import { INK_PAGES } from '../src/render/rift/ink';
import { SIEGE_CHAPTERS } from '../src/game/objectives/siegeChapters';

const code = (file: string) => fs.readFileSync(file, 'utf8').split('\n').filter(line => !/^\s*(\/\/|\*|\/\*)/.test(line)).join('\n');

describe('the Drowned Armoury (rift-swords)', () => {
  it('is asked first by the earlier Rift stage, in one hooked line each', () => {
    const stage = fs.readFileSync('src/render/rift/RiftStage.ts', 'utf8');
    for (const hook of ['riftPlaceGround(stage, x, z, halfX, halfZ)', 'if (riftPlaceProp(k, p, stage, fires)) return;',
      'if (riftPlaceBeyond(k, stage, { halfX, halfZ, fires, piece, at })) return;', 'riftPlaceWater(stage, this.root, this.materials);'])
      expect(stage).toContain(hook);
    expect(fs.readFileSync('src/render/rift/propModels.ts', 'utf8')).toContain("const own = riftPlaceDress(stage, p); if (own !== 'main') return own;");
  });

  it('plants no sword: the blades are pikes and the great sword a gauntlet, none on the sword models', () => {
    const text = code('src/originals/places/drownedArmoury.ts');
    expect(text).not.toMatch(/colossalSword|giant-sword|'sword'\s*\}/);
    const places = code('src/originals/places/riftPlaces.ts');
    expect(places).toMatch(/ARMOURY_OWN = new Set<RiftProp\['kind'\]>\(\['statue', 'rock', 'sword', 'grave', 'stake'\]\)/);
  });

  it('keeps the earlier layout: the same props on the same footprints, the fight\'s floor flat under the lake', () => {
    const props = riftLayout('rift-swords').props;
    expect(props.filter(p => p.solid).length).toBeGreaterThan(5);
    expect(props.find(p => p.kind === 'statue')).toMatchObject({ x: 0, z: 16, solid: true });
    const { halfX, halfZ } = STAGES['rift-swords'];
    for (let x = -halfX; x <= halfX; x += 4) for (let z = -halfZ; z <= halfZ; z += 4) expect(armouryGround(x, z, halfX, halfZ)).toBeLessThan(0);
  });

  it('is named for its concept on its card and its stage', () => {
    const hill = LOCATIONS.find(l => l.id === 'hill-of-swords')!;
    expect(hill.name).toBe('The Drowned Armoury');
    expect(ORIGINAL_STAGES['rift-swords'].name).toBe('The Drowned Armoury');
    expect(`${hill.name} ${hill.subtitle} ${hill.line} ${hill.again}`).not.toMatch(/sword|blade|barrow/i);
  });
});

describe('the Fallen Star (rift-eclipse)', () => {
  it('has no sun in its sky, no eclipse and no demons', () => {
    expect(INK_PAGES['rift-eclipse'].sky.disc).toBeUndefined();
    expect(fs.readFileSync('src/render/rift/RiftStage.ts', 'utf8')).not.toMatch(/SkyDemons|riftPlaceDemons/);
  });

  it('puts no one on a stake: its ring and its stakes are built in code, on no body model', () => {
    const text = code('src/originals/places/fallenStar.ts');
    expect(text).not.toMatch(/corpse\(|stake-body|impaled/);
    expect(code('src/originals/places/riftPlaces.ts')).toMatch(/STAR_OWN = new Set<RiftProp\['kind'\]>\(\['stone', 'altar', 'stake', 'rock', 'grave'\]\)/);
  });

  it('keeps the earlier layout and a flat floor, the star and the crater outside the camera walls', () => {
    const props = riftLayout('rift-eclipse').props;
    expect(props.filter(p => p.kind === 'stone').length).toBe(12);
    const { halfX, halfZ } = STAGES['rift-eclipse'];
    for (let x = -halfX - 3; x <= halfX + 3; x += 4) for (let z = -halfZ - 3; z <= halfZ + 3; z += 4) expect(Math.abs(starGround(x, z, halfX, halfZ))).toBeLessThan(.01);
    expect(STAR.z - STAR.r).toBeGreaterThan(halfZ + 10);
  });

  it('is named for its concept, here and in Last Stand\'s chapter', () => {
    const star = LOCATIONS.find(l => l.id === 'fallen-star')!;
    expect(star.name).toBe('The Fallen Star');
    expect(ORIGINAL_STAGES['rift-eclipse'].name).toBe('The Fallen Star');
    expect(SIEGE_CHAPTERS.find(c => c.id === 'eclipse')!.title).toBe('UNDER THE FALLEN STAR');
    expect(`${star.name} ${star.subtitle} ${star.line} ${star.again}`).not.toMatch(/sun|eclipse/i);
  });
});

describe('the Torn Plain (rift-war, the mode open since rift-war)', () => {
  it('loads no stage model for its backdrop and no pagoda, torii, hall, ume or lamp of the kit', async () => {
    const world = fs.readFileSync('src/render/moba/RiftWarWorld.ts', 'utf8');
    expect(world).toContain('await tornPlainBackdrop(this.root);');
    expect(world).not.toMatch(/GLTFLoader|\/assets\/stages\//);
    expect(world).toContain('if(tornPlainPlace(this.root,piece,at))return;');
    expect(world).not.toMatch(/leaf-dusk\.webp'/);
    const { tornPlainKit, TORN_SKY } = await import('../src/originals/places/tornPlain');
    expect(tornPlainKit(['asian/pagoda', 'asian/torii', 'asian/ume', 'asian/building-grand', 'asian/wall-tall', 'asian/lantern', 'br/stone-lamp', 'br/rock-b', 'asian/bush']))
      .toEqual(['br/rock-b', 'asian/bush']);
    expect(TORN_SKY).toBe('/assets/environment/sky/ash-dusk.webp');
    expect(fs.existsSync(`public${TORN_SKY}`)).toBe(true);
  });

  it('opens the mode on it and shows the map\'s own name in its three shown strings', async () => {
    const { modeOpen } = await import('../src/originals/launch');
    expect(modeOpen('rift-war')).toBe(true);
    expect(fs.readFileSync('src/ui/moba/RiftWarUI.ts', 'utf8')).toContain('THE TORN PLAIN · 5 v 5');
    expect(fs.readFileSync('src/ui/modes/catalogue.ts', 'utf8')).toContain("kicker:'THE TORN PLAIN · THREE-LANE WAR'");
    expect(fs.readFileSync('src/ui/results/shareResult.ts', 'utf8')).toContain('THE TORN PLAIN · ${clock(');
    expect(STAGES['rift-war'].name).not.toMatch(/valley/i);
    expect(ORIGINAL_STAGES['rift-war'].name).toBe('The Torn Plain');
  });
});

describe('Last Stand\'s village (ashwood): back on the earlier CC0 kit (stages-old, 4 November 2026)', () => {
  it('builds no Basalt Hive: the earlier kit village loads as main loads it, the backdrop built in code', () => {
    const village = fs.readFileSync('src/render/objectives/AshwoodVillage.ts', 'utf8');
    expect(village).not.toMatch(/basaltHive/);
    expect(fs.readFileSync('src/render/objectives/ObjectiveScenery.ts', 'utf8')).not.toMatch(/basaltHive/);
    expect(fs.existsSync('src/originals/places/basaltHive.ts')).toBe(false);
    expect(village).toMatch(/if\(await lastStandBackdrop\(this\.root\)\)return;/);
  });

  it('keeps the gate\'s passage and every defence box the earlier', async () => {
    const { STAGE_LANDMARKS } = await import('../src/game/environmentLayout');
    expect(STAGE_LANDMARKS['ashwood']).toEqual([
      { x: 0, y: 12.2, z: 20, halfX: 9.5, halfY: 1, halfZ: 1.7 },
      { x: -8.7, y: 6, z: 20, halfX: .7, halfY: 6, halfZ: 1.5 }, { x: 8.7, y: 6, z: 20, halfX: .7, halfY: 6, halfZ: 1.5 },
      { x: -24, y: 4, z: 20, halfX: 16, halfY: 4, halfZ: 1 }, { x: 24, y: 4, z: 20, halfX: 16, halfY: 4, halfZ: 1 },
      { x: -11, y: 3.75, z: 33, halfX: 6, halfY: 3.75, halfZ: 4 },
      { x: -11, y: .6, z: 27, halfX: 2.5, halfY: .6, halfZ: .75 },
    ]);
  });
});
