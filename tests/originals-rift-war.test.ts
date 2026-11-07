import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LAUNCH, fighterShown, homeCardOpen, modeOpen, pageShipped, partyModeOpen, stageSafe, wayOpen } from '../src/originals/launch';
import { launchUnshipped } from '../src/originals/launchShip';
import { OWN_ART } from '../src/originals/ownArt';
import { HOME_ASSETS, HOME_RAIL } from '../src/ui/MangaHome';
import { MODES } from '../src/ui/modes/catalogue';
import { HEROES, VILLAINS } from '../src/game/objectives/model';
import { isReleasedFighter } from '../src/game/rosterAvailability';
import { riftUnitName } from '../src/game/moba/armyIdentity';
import { RIFT_STAGE } from '../src/game/moba/model';
import { RIFT_TROOP_MODELS } from '../src/render/moba/troopAssets';
import { FIGHTERS } from '../src/config';

const sha = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const MAIN_TILE = 'f699ad408dfde530a4c6d77c6e3f7cd0fccec172bb869c9022eb1f5db1d860e9';


describe('Rift War', () => {
  it('is open: its home card, its sheet\'s ways, the party\'s card and the match server\'s room', () => {
    expect(LAUNCH.riftWar).toBe('open');
    expect(modeOpen('rift-war')).toBe(true);
    expect(stageSafe(RIFT_STAGE)).toBe(true);
    expect(HOME_RAIL).toContain('rift-war');
    expect(homeCardOpen('rift-war')).toBe(true);
    const ways = Object.keys(MODES['rift-war'].variants).sort();
    expect(ways).toEqual(LAUNCH.online ? ['couch', 'friends', 'offline', 'online'] : ['couch', 'offline']);
    for (const way of ['online', 'friends']) expect(wayOpen('rift-war', way)).toBe(LAUNCH.online);
    expect(partyModeOpen('rift-war')).toBe(LAUNCH.online);
    // The server serves its room, its public matchmaker and its queue while the gate opens it; the party room refuses only a closed mode.
    expect(fs.readFileSync('src/server/index.ts', 'utf8')).toContain("const RIFT_WAR_OPEN = modeOpen('rift-war');");
    expect(fs.readFileSync('src/server/social/PartyRoom.ts', 'utf8')).not.toContain('riftClosed');
    expect(fs.readFileSync('src/ui/social/PartyUI.ts', 'utf8')).not.toContain("mode!=='rift-war'");
    expect(fs.readFileSync('src/ui/MangaHome.ts', 'utf8')).not.toContain("filter(mode => mode !== 'rift-war')");
  });

  it('fields only shown originals, each called by its own name (a bot by its fighter\'s shown name, never the slot\'s id)', () => {
    const pool = [...HEROES, ...VILLAINS].filter(isReleasedFighter);
    expect(pool.length).toBeGreaterThanOrEqual(10);
    for (const id of pool) expect(fighterShown(id), id).toBe(true);
    for (const id of pool) expect(FIGHTERS[id].name, id).toBeTruthy(); // (the ids are the originals' own since the clean: a name may read as its id)
    expect(fs.readFileSync('src/ui/moba/RiftWarUI.ts', 'utf8')).toContain("s.name==='Fighter'||s.bot?FIGHTERS[s.fighter].name:s.name");
    // The neutral camp is the Moss Revenant (modes-hordes' body), by name too.
    expect(riftUnitName({ team: 'heroes', kind: 'camp' })).toBe('Moss Revenant');
    expect(RIFT_TROOP_MODELS['pale-sapling']).toBe('/assets/moba/troops/moss-revenant.glb');
  });

  it('ships its troops, structures, floor and stage picture, and its own tile, never the earlier tile or the valley\'s model', () => {
    const troops = [...new Set(Object.values(RIFT_TROOP_MODELS))].map(url => url.slice(1));
    for (const file of troops) expect(fs.existsSync(`public/${file}`), file).toBe(true);
    const structures = fs.readdirSync('public/assets/moba/structures').map(file => `assets/moba/structures/${file}`);
    expect(launchUnshipped([...troops, ...structures, 'assets/environment/rift-war/forest-floor.webp', 'assets/stages/previews/rift-war.webp'])).toEqual([]);
    const tile = 'public/assets/home/modes/rift-war.webp', listed = OWN_ART.modeTiles['rift-war.webp'];
    expect(listed).toBe(sha(tile));
    expect(listed).not.toBe(MAIN_TILE);
    expect(pageShipped('/assets/home/modes/rift-war.webp')).toBe(true);
    expect(launchUnshipped(['assets/home/modes/rift-war.webp'])).toEqual([]);
    expect(HOME_ASSETS).toContain('/assets/home/modes/rift-war.webp');
    // (The Torn Plain is built in code and loads no stage model. The valley's model ships again since stages-old, as the
    // Ashfall Weir with r7's changes: its statues gone, a gatehouse dam in their place; tests/originals-places-*.test.ts.)
  });

});
