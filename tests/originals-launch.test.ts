import { ALL_FIGHTERS, GATED_FIGHTERS, LAUNCH, NEUTRAL_STAGES, RENAMED_ITEMS, SHOWN_FIGHTERS, duelStage, fighterShown, homeCardOpen,
  isOriginal, launchInvite, launchStage, modeOpen, partyModeOpen, shownFighter, stageSafe, unroutedVoices, wayOpen, gateFighterManifest } from '../src/originals/launch';
import { describe, expect, it, vi } from 'vitest';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { ORIGINALS } from '../src/originals/roster';
import { HELD, LOCKED, lockedOut, mayPlay } from '../src/game/economy/fighters';
import { ITEMS } from '../src/game/economy/catalog';
import { OUTFITS } from '../src/game/economy/outfits';
import { ROAD } from '../src/game/economy/unlocks';
import { draftBots } from '../src/game/matchmaking';
import { ArenaSimulation } from '../src/game/simulation';
import { HOME_ASSETS, HOME_FIGHTERS, HOME_FIGHTERS_2, HOME_RAIL, HOME_ROSTER } from '../src/ui/MangaHome';
import { MODES } from '../src/ui/modes/catalogue';
import { MUSIC_TRACKS, SURVIVAL_MUSIC, selectMusicTracks } from '../src/audio/musicTracks';
import { HOME_VOICES } from '../src/audio/HomeVoice';
import { launchManifests, launchUnshipped } from '../src/originals/launchShip';
import originalsLaunch, { BUNDLED_MANIFESTS, gatedManifestText } from '../scripts/build/launchPlugin';
import { ROYALE_STAGES, SMALL_ROYALE_STAGES, chooseStage, seriesStage } from '../src/game/stages';
import { ARENAS, DUEL_ARENAS } from '../src/game/social/custom';
import { HOME_ARENA, PARTY_ARENAS } from '../src/game/social/party';
import type { FighterId } from '../src/game/types';
import { SHOP_PX } from '../src/originals/shop/px';
import { R6P_DRAWN, SHOP_R6P } from '../src/originals/shop/r6p';
import { R6B_ART, SHOP_R6B } from '../src/originals/shop/r6b';

const SHOP: FighterId[] = ['gorai', 'haldor', 'sorrel', 'dorado', 'shiun', 'magatsu', 'vesper', 'imago', 'wuming', 'jirenga',
  'jinlin', 'gohaku', 'ippon', 'sekka', 'tobari', 'akagane', 'asahi', 'levin', 'rook', 'gaku'];

describe('the launch gate: fighters', () => {
  it('shows a fighter only when ORIGINALS has it and every voice cue of its id is routed', () => {
    // (and the integrator's LAUNCH.hold: an original whose 2D set has not landed)
    for (const id of ALL_FIGHTERS) expect(SHOWN_FIGHTERS.has(id), id).toBe(!LAUNCH.hold.includes(id) && !!ORIGINALS[id] && unroutedVoices(id).length === 0);
    // Every VOL.1 slot is an original with its own voice.
    for (const id of HOME_FIGHTERS) expect(isOriginal(id), id).toBe(true);
    // A shop fighter no team has finished is hidden (each lets itself through once ORIGINALS and voices.json have it).
    for (const id of SHOP) if (!ORIGINALS[id]) expect(fighterShown(id), id).toBe(false);
  });
  it('lists only originals in the home roster, both volumes, the guide and every picker that reads them', () => {
    for (const id of HOME_ROSTER) expect(fighterShown(id), id).toBe(true);
    for (const id of HOME_FIGHTERS_2) expect(fighterShown(id), id).toBe(true);
    const added = { ...SHOP_PX, ...SHOP_R6P, ...SHOP_R6B };
    expect(HOME_ROSTER.filter(id => !(id in added))).toEqual([...HOME_FIGHTERS, ...HOME_FIGHTERS_2]);
    for (const id of [...Object.keys(SHOP_PX), ...R6P_DRAWN, ...R6B_ART]) expect(HOME_ROSTER, id).toContain(id);
  });
  it('holds every hidden fighter: never drafted as a bot, never on sale, not playable', () => {
    for (const id of GATED_FIGHTERS) {
      expect(HELD.has(id), id).toBe(true);
      expect(LOCKED.has(id), id).toBe(false);
      expect(mayPlay(id, undefined), id).toBe(false);
    }
    const drafted = new Set(draftBots([], 400, items => [...items]));
    for (const id of drafted) expect(fighterShown(id), id).toBe(true);
    // The simulation's own draw (Training's sparring partner), copied from HELD when simulation.ts loads: after the gate.
    for (let seed = 1; seed <= 40; seed++) {
      const sim = new ArenaSimulation({ roomMode: 'training', seed });
      sim.addPlayer('human', 'taisei', 'Human');
      expect(fighterShown(sim.getPlayer('sparring-bot')?.fighter), `seed ${seed}`).toBe(true);
      sim.dispose?.();
    }
    expect(shownFighter('gorai')).toBe(fighterShown('gorai') ? 'gorai' : ALL_FIGHTERS.find(fighterShown));
  });
  it('leaves them off the road (the REWARDS page and the next goal)', () => {
    for (const step of ROAD) { const item = ITEMS.find(each => each.id === step.id); if (item) expect(item.stage, item.id).not.toBe('ask'); }
  });
  it('takes a hidden fighter and every outfit no original renames off the shelves, and out of OUTFITS', () => {
    for (const item of ITEMS) {
      if (item.kind === 'fighter' && !fighterShown(item.fighter)) expect(item.stage, item.id).toBe('ask');
      if (item.kind === 'fighter' && fighterShown(item.fighter)) {
        const own = ORIGINALS[item.fighter!]?.shop?.[item.id];
        if (own) { expect(item.name, item.id).toBe(own.name); expect(item.stage, item.id).not.toBe('ask'); }
        else { expect(item.stage, item.id).toBe('ask'); expect(LOCKED.has(item.fighter!), item.id).toBe(false); }
      }
      if (item.kind === 'outfit' && !(fighterShown(item.fighter) && ORIGINALS[item.fighter!]?.shop?.[item.id])) {
        expect(item.stage, item.id).toBe('ask');
        expect(item.id in OUTFITS, item.id).toBe(false);
      }
    }
  });
});

describe('the launch gate: modes and stages', () => {
  it('hides Arcade Survival while team R gates it, and Last Stand and Bad Blood while team O does', () => {
    expect(modeOpen('arcade')).toBe(LAUNCH.survival === 'open');
    expect(modeOpen('bad-blood')).toBe(LAUNCH.objectives === 'open');
    expect(modeOpen('last-stand')).toBe(LAUNCH.objectives === 'open' && stageSafe('hidden-ash'));
    for (const card of ['arcade', 'last-stand', 'bad-blood', 'rift-war']) expect(HOME_RAIL.includes(card as 'arcade'), card).toBe(modeOpen(card)); // (Rift War: LAUNCH.riftWar, open since rift-war)
    expect(HOME_RAIL).toEqual(expect.arrayContaining(['duel', 'bots', 'training']));
  });
  it('shows the ball modes on impact.dude.work and the match server, never in Player Two\'s copy while LAUNCH.ballModes is "site"', () => {
    expect(LAUNCH.ballModes).toBe('site');
    expect(modeOpen('goal-rush')).toBe(true); expect(modeOpen('sky-spike')).toBe(true); // (node: the match server serves their rooms)
    expect(HOME_RAIL).toEqual(expect.arrayContaining(['goal-rush', 'sky-spike']));
    try {
      vi.stubGlobal('location', new URL('https://impact.playertwo.cc/~b1/index.html'));
      for (const mode of ['goal-rush', 'sky-spike']) { expect(modeOpen(mode), mode).toBe(false); expect(homeCardOpen(mode), mode).toBe(false); expect(partyModeOpen(mode), mode).toBe(false); }
      expect(modeOpen('duel')).toBe(true);
      vi.stubGlobal('location', new URL('https://impact.dude.work/'));
      expect(modeOpen('goal-rush')).toBe(true); expect(homeCardOpen('sky-spike')).toBe(true);
    } finally { vi.unstubAllGlobals(); }
  });
  it('offers the ways to play that need a match server only while LAUNCH.online is on (on by default; off in a build for no server)', () => {
    for (const [mode, info] of Object.entries(MODES)) if (modeOpen(mode)) {
      for (const [way, variant] of Object.entries(info.variants)) if (!variant?.onDevice) expect(LAUNCH.online, `${mode} ${way}`).toBe(true);
      expect(info.variants.offline, mode).toBeTruthy();
      if (info.variants.couch) expect(info.variants.couch.onDevice, `${mode} couch`).toBe(true);
      if (LAUNCH.online && mode !== 'training') expect(Object.keys(info.variants).filter(way => way !== 'couch'), mode).toEqual(['offline', 'online', 'friends']);
    }
    expect(homeCardOpen('players')).toBe(LAUNCH.online);
    expect(homeCardOpen('private')).toBe(LAUNCH.online);
    expect(wayOpen('duel', 'offline')).toBe(true);
    expect(partyModeOpen('survival')).toBe(LAUNCH.online && modeOpen('arcade'));
    expect(partyModeOpen('last-stand')).toBe(LAUNCH.online && modeOpen('last-stand'));
    expect(partyModeOpen('bad-blood')).toBe(LAUNCH.online && modeOpen('bad-blood'));
    expect(partyModeOpen('royale')).toBe(LAUNCH.online);
    const invite = { kind: 'coop', code: '123456' }, duel = { kind: 'duel', code: '123456' };
    expect(launchInvite(invite)).toBe(LAUNCH.online && modeOpen('arcade') ? invite : null); // a co-op invite: Arcade's
    expect(launchInvite(duel)).toBe(LAUNCH.online ? duel : null);
  });
  it('renames the shop items named after another work', () => {
    for (const [id, name] of Object.entries(RENAMED_ITEMS)) expect(ITEMS.find(each => each.id === id)?.name, id).toBe(name);
  });
  it("deals the server's matches from cleared places: an original's own series sends no crowd to a withheld place", () => {
    expect(seriesStage(['gummy', 'kenzo', 'kosho', 'nigo'])).toBeUndefined();
    expect(stageSafe(chooseStage(['taisei', 'ouga'], 'match')), 'a same-series duel').toBe(true);
    for (const field of [['gummy', 'kenzo', 'kosho', 'nigo'], ['konta', 'shiden', 'shirokane', 'koko'], ['taisei', 'ouga', 'taisei', 'nigo'], ['kuon', 'nigo', 'oro']] as FighterId[][])
      expect(stageSafe(chooseStage(field, 'match')), field.join()).toBe(true);
  });
  it("offers only cleared places in a private room's and a party's pickers", () => {
    for (const list of [...Object.values(ARENAS), DUEL_ARENAS, ...Object.values(PARTY_ARENAS)]) for (const stage of list) expect(stageSafe(stage), stage).toBe(true);
    for (const stage of Object.values(HOME_ARENA)) expect(stageSafe(stage), stage).toBe(true);
    expect(DUEL_ARENAS.length).toBeGreaterThan(0); expect(ARENAS.royale.length).toBeGreaterThan(0);
  });
  it('fights only on the neutral and original stages until team G clears more', () => {
    for (const stage of NEUTRAL_STAGES) expect(launchStage(stage)).toBe(stage);
    for (const stage of ROYALE_STAGES) expect(stageSafe(stage), stage).toBe(true);
    for (const stage of Object.keys(SMALL_ROYALE_STAGES)) expect(stageSafe(stage), stage).toBe(true);
    expect(duelStage('sunfall-arena')).toBe(stageSafe('sunfall-arena') ? 'sunfall-arena' : 'blood-citadel');
    expect(MODES.duel.kicker).not.toMatch(/MARTIAL ARTS/);
    for (const stage of ['proving-hall', 'zenith-coliseum', 'wreckers-causeway', 'ashfall-weir', 'hidden-ash'] as const) {
      expect(stageSafe(stage), stage).toBe(LAUNCH.stages.includes(stage));
      if (!LAUNCH.stages.includes(stage)) expect(launchStage(stage)).toBe('harbor');
    }
  });
});

describe('the launch gate: pages, music, voices and the package', () => {
  it('references neither the upcoming page nor the withheld home sheet', () => {
    expect(HOME_ASSETS.filter(url => /\/home\/upcoming\/|manga-home\.png/.test(url))).toEqual([]);
  });
  it('lists, plays and ships only the original score', () => {
    for (const track of Object.values(MUSIC_TRACKS)) expect(track.url, track.id).toMatch(/^\/assets\/music\/originals\//);
    for (const track of SURVIVAL_MUSIC) expect(track.url, track.id).toMatch(/^\/assets\/music\/originals\//);
    const pickers = ['taisei', 'gorai', 'ippon', ...(modeOpen('arcade') ? ['rift', 'rift:gilded-ruin:boss:2', 'rift:konta:boss:1'] : [])];
    for (const id of pickers) for (const phase of ['lobby', 'combat', 'results'] as const)
      for (const track of selectMusicTracks(id, 'konta', phase)) expect(track?.url, `${id} ${phase}`).toMatch(/^\/assets\/music\/originals\//);
  });
  it("plays only the shown fighters' home lines", () => {
    for (const id of Object.keys(HOME_VOICES)) expect(fighterShown(id), id).toBe(true);
  });
  it("leaves a hidden fighter's files, the withheld pages and the uncleared recordings out of the package, and keeps the originals'", () => {
    const files = ['assets/props/steamroller1.glb', 'assets/fighters/gorai-br1.glb', 'assets/home/portraits/gorai.webp', 'assets/ui/moves/gorai.webp', 'assets/audio/home/gorai.m4a',
      'assets/audio/v2/voice/vo-gorai-mast-breaker.wav', 'assets/home/upcoming/index.html', 'assets/home/manga-home.png',
      // (team G: every stage is safe now - src/originals/stages.ts - so a hidden fighter's second file stands where a gated
      // stage's model was: launchUnshipped still drops a stage's model while team G lists it as unsafe)
      'assets/music/home-main.m4a', 'assets/fighters/gorai-wyrm-br1.glb', // (yodaka until Yodaka opened)
      'assets/fighters/wukong-tr1.glb', 'assets/home/portraits/taisei.webp', 'assets/audio/home/taisei.m4a', 'assets/music/originals/set-sail.m4a',
      'assets/audio/v2/voice/originals/wukong/vo-taisei-ha.wav', 'assets/audio/v2/swing-a.wav',
      'assets/audio/v2/shirokane-sickle-bolt.wav'];
    const away = new Set(launchUnshipped(files));
    for (const file of files.slice(0, 10)) expect(away.has(file) || (fighterShown('gorai') && file.includes('gorai')), file).toBe(true);
    for (const file of files.slice(10)) expect(away.has(file), file).toBe(false);
  });
});

describe('the launch gate on the match server', () => {
  it('imports the gate first in src/server/index.ts', () => {
    const entry = readFileSync('src/server/index.ts', 'utf8');
    expect(entry.split('\n').find(line => line.startsWith('import '))).toMatch(/^import '\.\.\/originals\/launch';/);
  });
  it('copies into the server image every file the gate loads', () => {
    const copied = [...readFileSync('Dockerfile', 'utf8').matchAll(/^COPY\s+(.+?)\s+\.\/\S*$/gm)].flatMap(m => m[1].split(/\s+/));
    const seen = new Set<string>();
    const walk = (file: string) => {
      if (seen.has(file)) return; seen.add(file);
      if (!file.endsWith('.ts')) return;
      for (const [, kind, spec] of readFileSync(file, 'utf8').matchAll(/^\s*import\s+(type\s+)?[^'"]*?['"](\.[^'"]+)['"]/gm)) {
        if (kind) continue;
        const base = path.normalize(path.join(path.dirname(file), spec));
        const found = ['', '.ts', '.json'].map(ext => base + ext).find(existsSync);
        if (found) walk(found);
      }
    };
    walk('src/originals/launch.ts');
    for (const file of seen) expect(copied.some(entry => file === entry || file.startsWith(`${entry}/`)), file).toBe(true);
  });
  it("drafts no hidden fighter for the server's rooms either", async () => {
    const { draftBots: serverDraft } = await import('../src/server/ArenaRoom');
    for (const id of new Set(serverDraft([], 400, items => [...items]))) expect(fighterShown(id), id).toBe(true);
  }, 120000);
});

describe('the launch gate: per-fighter manifests', () => {
  const read = (file: string) => JSON.parse(readFileSync(path.join('public', file), 'utf8'));
  const SPRITES = 'assets/home/sprites/manifest.json', HOME_LINES = 'assets/audio/home/manifest.json';
  type Entry = { id?: string; fighter?: string };
  const entries = (manifest: { fighters?: Entry[]; assets?: Entry[] }) => (manifest.fighters ?? manifest.assets)!;
  const idOf = (entry: Entry) => (entry.id ?? entry.fighter)!;

  it("keeps a hidden fighter's entries out, and every shown fighter's entry as it was", () => {
    const sprites = read(SPRITES);
    // (The clean, 6 November 2026: the manifests no longer hold a hidden fighter's entry, so there may be nothing to take out.)
    for (const manifest of [sprites, read(HOME_LINES)]) {
      const gated = gateFighterManifest(manifest);
      for (const entry of entries(gated)) expect(fighterShown(idOf(entry)), idOf(entry)).toBe(true);
      expect(entries(gated)).toEqual(entries(manifest).filter(entry => fighterShown(idOf(entry))));
      for (const key of Object.keys(manifest)) if (key !== 'fighters' && key !== 'assets') expect(gated[key], key).toEqual(manifest[key]);
    }
  });
  it('rewrites the packaged copies in place, in their own indentation, and leaves every other file as it is', () => {
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'launch-manifests-'));
    try {
      const files = [SPRITES, HOME_LINES, 'assets/environment/br/manifest.json', 'assets/audio/survival/manifest.json'];
      for (const file of files) { mkdirSync(path.dirname(path.join(tmp, file)), { recursive: true }); copyFileSync(path.join('public', file), path.join(tmp, file)); }
      // (The clean: with no hidden fighter's entry left in either manifest, the gate rewrites only what it has to.)
      expect([SPRITES, HOME_LINES]).toEqual(expect.arrayContaining(launchManifests(tmp, files)));
      for (const file of [SPRITES, HOME_LINES]) {
        const text = readFileSync(path.join(tmp, file), 'utf8');
        expect(text.slice(0, 4), file).toBe(readFileSync(path.join('public', file), 'utf8').slice(0, 4));
        for (const entry of entries(JSON.parse(text))) expect(fighterShown(idOf(entry)), `${file} ${idOf(entry)}`).toBe(true);
      }
      for (const file of files.slice(2)) expect(readFileSync(path.join(tmp, file)).equals(readFileSync(path.join('public', file))), file).toBe(true);
    } finally { rmSync(tmp, { recursive: true, force: true }); }
  });
});

describe('a held fighter\'s notice', () => {
  it('names the original, or no one, never the withheld fighter', () => {
    for (const id of GATED_FIGHTERS) {
      const notice = lockedOut(id, undefined), item = ITEMS.find(each => each.kind === 'fighter' && each.fighter === id);
      if (item) expect(item.name, id).toBe(ORIGINALS[id]?.name ?? 'This fighter');
      // (A fighter main has retired is "not available": named by no one either.)
      if (notice && HELD.has(id)) expect(notice, id).toMatch(new RegExp(`^(${item ? item.name : 'This fighter'}) is not (out yet|available)`));
    }
  });
});
