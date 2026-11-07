import { ORIGINAL_HOME, ORIGINAL_RIFT, ORIGINAL_SCORE, ORIGINAL_WORLDS } from './score';

/** The soundtrack's files held back from this repository (README.md): src/originals/score.ts SOUNDTRACK still lists them,
 *  and each of their slots plays a piece of the game's own earlier score instead (public/assets/music/originals/, its
 *  records in public/assets/music/originals.json). The slot keeps its track's id - the home rotation (musicTracks.ts
 *  HOME_MUSIC_IDS) and the modes' queues (apply.ts soundtrackQueue) find tracks by id - and shows the own piece's title and
 *  artist. Take a name off when its own file is back: its slot plays it again, and its credit returns (credits.ts). */
const HELD = new Set([
  'maoudamashii-shining-star', 'maoudamashii-burning-heart', 'maoudamashii-hikari-trigger', 'maoudamashii-tsuki-to-okami',
  'maoudamashii-12345', 'maoudamashii-halzion', 'maoudamashii-neorock82', 'maoudamashii-neorock36', 'maoudamashii-neorock81',
  'maoudamashii-neorock80', 'maoudamashii-neorock33', 'maoudamashii-neorock54', 'maoudamashii-fantasy15', 'maoudamashii-fantasy03',
  'maoudamashii-neorock83', 'maoudamashii-orchestra24', 'maoudamashii-neorock75', 'maoudamashii-neorock68', 'maoudamashii-fantasy12',
  'maoudamashii-orchestra20', 'maoudamashii-neorock71', 'maoudamashii-orchestra25', 'maoudamashii-neorock49', 'maoudamashii-orchestra26',
  'maoudamashii-sting-victory', 'maoudamashii-sting-defeat',
]);
export const HELD_SOUNDTRACK: ReadonlySet<string> = HELD;

/** The piece that stands in for each held file (the piece's file name under /assets/music/originals/; its length; why):
 *
 *  | slot              | stands in                        | why
 *  | home 1            | pages-of-legend          125.2 s | the home screen's own theme before the soundtrack: the rotation opens on it
 *  | home 2            | skyborn-ascent           107.4 s | E major, 152 bpm, the brass fanfare and the anthem's chorus: the bright turn after the overture
 *  | home 3            | set-sail                 105.9 s | G major sea adventure, fiddle and accordion: a lighter colour
 *  | home 4            | embers-in-the-black-snow 113.7 s | C# minor, a music box and a violin carrying the tune: the rotation's tender one
 *  | home 5            | endless-null             111.3 s | F# minor, celesta and a cool synth groove: another colour again
 *  | home 6            | gale-runner              102.9 s | D minor, shakuhachi over taiko and the band crashing in: a quick close before the overture comes back
 *  | duel 1            | static-trail             106.0 s | the quickest theme (172 bpm), bright with an edge and a guitar solo of fast runs: one rival
 *  | duel 2            | cinder-requiem           111.2 s | the dark rock requiem at 164 bpm, its lead guitar soaring: the other side of the same set
 *  | royale 1          | endless-null             111.3 s | cool and unhurried, a groove that leaves the beat empty: everyone against everyone, waiting for the opening
 *  | royale 2          | the-dead-follow          120.0 s | the synth arpeggio, the build and the drop: the field thinning out
 *  | training 1        | hazard-pay                94.3 s | a deadpan lounge vamp that turns into a big chorus: no stakes, a joke kept straight
 *  | training 2        | set-sail                 105.9 s | the bouncing fiddle tune: light enough to practise under
 *  | arcade 1          | rift-unbound             120.0 s | written as the Rift run's battle march
 *  | arcade 2          | embers-in-the-black-snow 113.7 s | "a hundred years of ash and no dawn", a riff that drives on: the endless horde
 *  | last-stand 1      | gale-runner              102.9 s | the Hidden Ash's own theme, for the gate the mode defends
 *  | last-stand 2      | gilded-hour              114.0 s | the hour struck on a bell while the wood blocks tick, brass and choir: wave after wave against the clock
 *  | bad-blood 1       | cinder-requiem           111.2 s | the reaper's requiem, a tolling bell and a driving low riff: team elimination
 *  | bad-blood 2       | grave-road               110.0 s | grim and heavy, a funeral bell over a choir: the fallen citadel
 *  | rift-war 1        | rift-unbound             120.0 s | a horn call over the choir, a march: an army through three lanes
 *  | rift-war 2        | skyborn-ascent           107.4 s | the sky-high anthem: the heroes' side of heroes against villains
 *  | boss 1            | apex-of-the-rift         114.3 s | written for the thing circling the Rift: stalking strings and low brass, the whole orchestra at the kill
 *  | boss 2            | rite-of-ashes            125.7 s | written for the Rift's rite: an organ drone, a taiko heartbeat, a tolling bell and a march for horns and voices
 *  | results, win      | long-night-watch         109.1 s | written for the watch between two fights: warm, the dorian's bright sixth, a rest after a win
 *  | results, loss     | last-light               133.3 s | written for what is left when the run is over: a piano, the strings, the swell
 *  | sting, win/loss   | (none)                           | a sting is a few seconds cut from a held track, and no own piece has one: the end opens on its results theme
 *
 *  No playlist plays a piece twice: each mode's two differ, and an Arcade Survival boss round's four (the boss themes, then
 *  the mode's) are four pieces. Across playlists a piece may recur (the home rotation's in the modes; the Rift's march and
 *  the anthem in two modes each): the battle slots are fourteen, the own battle pieces twelve. */
const STAND_INS: Readonly<Record<string, string | null>> = {
  'maoudamashii-shining-star': 'pages-of-legend', 'maoudamashii-burning-heart': 'skyborn-ascent', 'maoudamashii-hikari-trigger': 'set-sail',
  'maoudamashii-tsuki-to-okami': 'embers-in-the-black-snow', 'maoudamashii-12345': 'endless-null', 'maoudamashii-halzion': 'gale-runner',
  'maoudamashii-neorock82': 'static-trail', 'maoudamashii-neorock36': 'cinder-requiem',
  'maoudamashii-neorock81': 'endless-null', 'maoudamashii-neorock80': 'the-dead-follow',
  'maoudamashii-neorock33': 'hazard-pay', 'maoudamashii-neorock54': 'set-sail',
  'maoudamashii-fantasy15': 'rift-unbound', 'maoudamashii-fantasy03': 'embers-in-the-black-snow',
  'maoudamashii-neorock83': 'gale-runner', 'maoudamashii-orchestra24': 'gilded-hour',
  'maoudamashii-neorock75': 'cinder-requiem', 'maoudamashii-neorock68': 'grave-road',
  'maoudamashii-fantasy12': 'rift-unbound', 'maoudamashii-orchestra20': 'skyborn-ascent',
  'maoudamashii-neorock71': 'apex-of-the-rift', 'maoudamashii-orchestra25': 'rite-of-ashes',
  'maoudamashii-neorock49': 'long-night-watch', 'maoudamashii-orchestra26': 'last-light',
  'maoudamashii-sting-victory': null, 'maoudamashii-sting-defeat': null,
};

/** A music url's file name: /assets/music/originals/set-sail.m4a -> set-sail. */
const fileOf = (url: string) => /\/([\w-]+)\.m4a$/.exec(url)?.[1] ?? url;

/** The game's own pieces by file name, as score.ts records them (url, title, artist). */
const OWN: Readonly<Record<string, { url: string; title: string; artist: string }>> = Object.fromEntries(
  [ORIGINAL_HOME, ...ORIGINAL_SCORE, ...ORIGINAL_RIFT, ...ORIGINAL_WORLDS].map(({ url, title, artist }) => [fileOf(url), { url, title, artist }]));

/** Whether a url is one of the held files. */
export const heldSoundtrack = (url: string) => HELD.has(fileOf(url));

/** What plays for a held url: the own piece that stands in for it, or null (nothing plays). undefined: the url is not held. */
export function scoreStandIn(url: string): { url: string; title: string; artist: string } | null | undefined {
  const file = fileOf(url);
  if (!HELD.has(file)) return undefined;
  const own = STAND_INS[file];
  return own ? OWN[own] : null;
}

/** src/originals/apply.ts applyOriginalMusic: each table entry on a held file plays its stand-in under its own id, with the
 *  stand-in's title and artist; an entry with none (the stings) comes off the table, so its queue opens on what follows it. */
export function applyScoreStandIns<T extends { url: string; title: string; artist: string }>(tracks: Record<string, T>) {
  for (const [id, track] of Object.entries(tracks)) {
    const own = scoreStandIn(track.url);
    if (own) tracks[id] = { ...track, ...own };
    else if (own === null) delete tracks[id];
  }
  return tracks;
}
