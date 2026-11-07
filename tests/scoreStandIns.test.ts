import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HOME_MUSIC_IDS, MUSIC_TRACKS, SURVIVAL_MUSIC, selectMusicTracks, type MusicTrack } from '../src/audio/musicTracks';
import { ORIGINAL_HOME, ORIGINAL_RIFT, ORIGINAL_SCORE, ORIGINAL_WORLDS, SOUNDTRACK, type SoundtrackMode } from '../src/originals/score';
import { HELD_SOUNDTRACK, heldSoundtrack, scoreStandIn } from '../src/originals/scoreStandIns';
import { SOUNDTRACK_CREDITS } from '../src/originals/credits';
import { ATTRIBUTIONS, OPEN_WORKS, legalPage } from '../src/ui/legal';

/** The soundtrack's slots whose files are held back from this repository play the game's own earlier score
 *  (src/originals/scoreStandIns.ts): every slot plays a file this repository has, and none asks for a held one. */
const served = (url: string) => fs.existsSync(`public${url}`);
const fileOf = (url: string) => /([\w-]+)\.m4a$/.exec(url)![1];
const EVERY = [...SOUNDTRACK.home, ...Object.values(SOUNDTRACK.modes).flat(), ...SOUNDTRACK.boss, ...SOUNDTRACK.results.win,
  ...SOUNDTRACK.results.loss, SOUNDTRACK.stinger.win, SOUNDTRACK.stinger.loss];
/** The own pieces a slot may stand on: the home theme, the world themes (not the pixel ones) and the Rift's. */
const OWN = new Set([ORIGINAL_HOME, ...ORIGINAL_SCORE, ...ORIGINAL_RIFT, ...ORIGINAL_WORLDS.filter(world => !world.series.startsWith('pixel-'))].map(piece => piece.url));
const MODES = Object.keys(SOUNDTRACK.modes) as SoundtrackMode[];
const PICKERS = ['taisei', 'ippon', 'konta', 'rift', 'rift:gilded-ruin:boss:2', 'rift:konta:hunt:1'];
const urls = (list: readonly MusicTrack[]) => list.map(track => track.url);

describe('the held-back soundtrack', () => {
  it('holds back exactly the soundtrack files this repository does not have', () => {
    for (const track of EVERY) expect(heldSoundtrack(track.url), track.url).toBe(!served(track.url));
    const files = new Set(EVERY.map(track => fileOf(track.url)));
    for (const name of HELD_SOUNDTRACK) expect(files.has(name), name).toBe(true);
  });

  it('plays every track from a file in public/assets - its own or its stand-in - under its own id, with the stand-in\'s title and artist', () => {
    for (const track of EVERY) {
      const entry = MUSIC_TRACKS[track.id], own = scoreStandIn(track.url);
      if (own === null) { expect(entry, track.id).toBeUndefined(); continue; }
      expect(entry, track.id).toBeDefined();
      expect(served(entry.url), `${track.id} ${entry.url}`).toBe(true);
      expect(heldSoundtrack(entry.url), entry.url).toBe(false);
      if (!own) { expect(entry.url, track.id).toBe(track.url); continue; }
      expect(OWN.has(entry.url), `${track.id} ${entry.url}`).toBe(true);
      expect([entry.url, entry.title, entry.artist], track.id).toEqual([own.url, own.title, own.artist]);
    }
    // Only the stings, which no own piece has, play nothing.
    expect(EVERY.filter(track => scoreStandIn(track.url) === null).map(track => track.id)).toEqual(
      [SOUNDTRACK.stinger.win.id, SOUNDTRACK.stinger.loss.id].filter(id => HELD_SOUNDTRACK.has(id.replace(/^ost-/, ''))));
  });

  it('asks for no held file: the home rotation, each mode\'s fights and ends, its boss rounds, the table and the Rift\'s playlist', () => {
    const asked: MusicTrack[] = [...Object.values(MUSIC_TRACKS), ...SURVIVAL_MUSIC, ...selectMusicTracks('taisei', undefined, 'lobby')];
    for (const mode of MODES) for (const turn of [0, 1]) for (const fighter of PICKERS) {
      asked.push(...selectMusicTracks(fighter, 'konta', 'combat', { mode, turn }));
      for (const outcome of ['win', 'loss'] as const) asked.push(...selectMusicTracks(fighter, 'konta', 'results', { mode, outcome, turn }));
    }
    for (const track of asked) {
      expect(track, 'a track the table does not have').toBeDefined();
      expect(heldSoundtrack(track.url), `${track.id} ${track.url}`).toBe(false);
      expect(served(track.url), `${track.id} ${track.url}`).toBe(true);
    }
  });

  it('plays no piece twice in one playlist, and the home rotation opens on the home theme', () => {
    const home = HOME_MUSIC_IDS.map(id => MUSIC_TRACKS[id]);
    expect(home.every(Boolean)).toBe(true);
    expect(home[0].url).toBe(ORIGINAL_HOME.url);
    expect(new Set(urls(home)).size).toBe(home.length);
    for (const mode of MODES) for (const turn of [0, 1]) for (const fighter of PICKERS) for (const queue of [
      selectMusicTracks(fighter, 'konta', 'combat', { mode, turn }),
      selectMusicTracks(fighter, 'konta', 'results', { mode, outcome: 'win', turn }),
      selectMusicTracks(fighter, 'konta', 'results', { mode, outcome: 'loss', turn }),
    ]) expect(new Set(urls(queue)).size, `${mode} ${turn} ${fighter}`).toBe(queue.length);
    // A boss round opens on the two boss themes, then the mode's two: four pieces.
    const boss = selectMusicTracks('rift:gilded-ruin:boss:2', undefined, 'combat', { mode: 'arcade', turn: 0 });
    expect(new Set(urls(boss.slice(0, 4))).size).toBe(4);
  });

  it('credits no held file, in SOUNDTRACK_CREDITS or on the legal page', () => {
    for (const credit of SOUNDTRACK_CREDITS) for (const file of credit.files) expect(served(`/${file}`), file).toBe(true);
    for (const credit of [...ATTRIBUTIONS, ...OPEN_WORKS]) for (const file of credit.files) expect(heldSoundtrack(`/${file}`), file).toBe(false);
    const page = legalPage();
    for (const name of HELD_SOUNDTRACK) expect(page, name).not.toContain(name);
  });
});
