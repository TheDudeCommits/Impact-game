/** The arenas a match can be fought in. No renderer or DOM dependencies: the
 *  server picks the stage and owns its bounds, the client only draws it.
 *
 *  Each stage's playable rectangle is the floor its place actually has: the
 *  places are not interchangeable backdrops behind one fixed arena (a small
 *  ring stretched to the harbour's 160 m square would put its stands half a
 *  kilometre away and leave the fighters on featureless grey). The harbour
 *  keeps its 160 m square.
 */
import type { FighterId, RoomMode } from './types';

/** Which series each fighter belongs to: its card's (src/config.ts), written out for the match server, which ships only
 *  src/game, by scripts/engine/series.mts. tests/stages.test.ts fails if the two differ. */
import { FIGHTER_SERIES } from './fighterSeries';
export { FIGHTER_SERIES };

export type StageId = 'harbor' | 'wreckers-causeway' | 'ash-colosseum' | 'sunfall-arena'
  | 'hidden-ash' | 'blood-citadel' | 'zenith-coliseum' | 'proving-hall' | 'cinder-flats' | 'warlords-roof' | 'drifting-isle'
  | 'sunward-summit' | 'ashfall-weir' | 'mirror-mere' | 'hollowmere-quarry'
  | 'rift-village' | 'rift-swords' | 'rift-fortress' | 'rift-eclipse'
  | 'rift-frost' | 'rift-grove' | 'rift-wastes' | 'rift-harbor' | 'rift-war'
  | 'dry-harbour'
  | 'thornwood-ward'
  | 'kuroyuki-hall' | 'starfall-crater' | 'scrap-pit';

export interface StageDefinition {
  id: StageId;
  name: string;
  scene: string;
  /** Runtime GLB, or null for the harbour, which is assembled from many parts. */
  model: string | null;
  /** Half-extent of the playable rectangle, in metres. */
  halfX: number;
  halfZ: number;
  /** Spawn ring radius on the short axis, in metres; it is stretched to an
   *  ellipse on a long stage so a bridge does not spawn everyone in one heap. */
  spawnRadius: number;
  /** Camera far plane and linear fog, in metres. A place's far scenery can stand hundreds of metres past its floor,
   *  where the harbour's 340 m far plane would slice it in mid-air. */
  cameraFar: number;
  fog: readonly [number, number];
  /** Replaces the HDR sky when the stage carries its own enclosure. */
  background?: number;
  doubleSided?: boolean;
  duelAxis?: number;
  /** The landmarks round (25 October 2026): the ring of seats turned by this many radians from +z (a circle's seats
   *  rotate; an ellipse's slide along it by the same share of its perimeter, so they stay evenly spaced), to set which
   *  way the seats start facing - each faces its closest opponent - against the place's landmarks. None: as ever. A
   *  Duel on a place with a duelAxis stands on that line and ignores this. A change is a change to the server's seats
   *  (the movement protocol). */
  seatTurn?: number;
}

const define = (stage: StageDefinition) => stage;

export const STAGES: Record<StageId, StageDefinition> = {
  'rift-war': define({id:'rift-war',name:'The Torn Plain',scene:'Three causeways across the rift',model:null,halfX:84,halfZ:84,spawnRadius:12,cameraFar:650,fog:[145,560],background:0xc9d8d1}),
  'blood-citadel': define({id:'blood-citadel',name:'The Fallen Citadel',scene:'Bad Blood beneath the broken moon',model:null,halfX:30,halfZ:24,spawnRadius:13,cameraFar:480,fog:[90,350]}),
  'hidden-ash': define({id:'hidden-ash',name:'The Hidden Ash',scene:'Last stand at the village gates',model:null,halfX:40,halfZ:44,spawnRadius:15,cameraFar:500,fog:[110,430]}),
  harbor: define({
    id: 'harbor', name: 'Manga Harbour', scene: 'Neutral ground',
    model: null, halfX: 80, halfZ: 80, spawnRadius: 36,
    cameraFar: 340, fog: [90, 340],
  }),
  'wreckers-causeway': define({
    id: 'wreckers-causeway', name: 'The Wreckers\' Causeway', scene: 'A fire-lit bridge over the black sea',
    model: null, halfX: 13, halfZ: 52, spawnRadius: 12,
    cameraFar: 1400, fog: [140, 1250],
  }),
  'ash-colosseum': define({
    id: 'ash-colosseum', name: 'The Ash Colosseum', scene: 'A walled court of raked ash under the smoking mountain',
    model: null, halfX: 48, halfZ: 48, spawnRadius: 26,
    cameraFar: 1200, fog: [150, 1100],
  }),
  'sunfall-arena': define({
    id: 'sunfall-arena', name: 'The Sunfall Arena', scene: 'A desert arena under the swollen sun',
    model: null, halfX: 13, halfZ: 13, spawnRadius: 9,
    cameraFar: 900, fog: [120, 800],
    // Round 3 (duelAxis): the duel faces north (+z) and south.
    duelAxis: 0,
  }),
  'zenith-coliseum': define({
    id: 'zenith-coliseum', name: 'The Zenith Coliseum', scene: 'A duelling floor where the sky runs out',
    model: null, halfX: 10.5, halfZ: 10.5, spawnRadius: 7,
    cameraFar: 340, fog: [80, 320], background: 0x0b1424,
    duelAxis: 0,
  }),
  'proving-hall': define({
    id: 'proving-hall', name: 'The Proving Hall', scene: 'Where the Hidden Ash tests its own',
    model: null, halfX: 6.5, halfZ: 7, spawnRadius: 4.5,
    cameraFar: 340, fog: [60, 300], doubleSided: true,
  }),
  'sunward-summit': define({
    id: 'sunward-summit', name: 'The Sunward Summit', scene: 'A temple on the last peak, over a sea of cloud at sundown',
    model: null, halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 1500, fog: [170, 1400],
  }),
  'ashfall-weir': define({
    id: 'ashfall-weir', name: 'The Ashfall Weir', scene: 'The river below the old weir, at first light',
    model: null, halfX: 18, halfZ: 45, spawnRadius: 14,
    cameraFar: 1200, fog: [130, 1100],
  }),
  'mirror-mere': define({
    id: 'mirror-mere', name: 'The Mirror Mere', scene: 'A still lake where the hex lies sealed',
    model: null, halfX: 38, halfZ: 42, spawnRadius: 22,
    cameraFar: 900, fog: [55, 700],
  }),
  'hollowmere-quarry': define({
    id: 'hollowmere-quarry', name: 'Hollowmere Quarry', scene: 'A mining town at the bottom of the iron pit',
    model: null, halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 1300, fog: [150, 1200],
  }),
  'cinder-flats': define({
    id: 'cinder-flats', name: 'The Cinder Flats', scene: 'Black sand where the embers never cool',
    model: null, halfX: 26, halfZ: 26, spawnRadius: 16,
    cameraFar: 1600, fog: [170, 1450],
  }),
  'warlords-roof': define({
    id: 'warlords-roof', name: 'The Warlord\'s Roof', scene: 'Atop the warlord\'s fortress, under thunder',
    model: null, halfX: 28, halfZ: 28, spawnRadius: 17,
    cameraFar: 1500, fog: [150, 1300],
  }),
  'drifting-isle': define({
    id: 'drifting-isle', name: 'The Drifting Isle', scene: 'Old flagstones adrift in a bright sky',
    model: null, halfX: 23, halfZ: 23, spawnRadius: 15,
    cameraFar: 1200, fog: [160, 1100],
  }),
  'rift-village': define({
    id: 'rift-village', name: 'The Burning Village', scene: 'Where the sky first tore open',
    model: null, halfX: 34, halfZ: 34, spawnRadius: 18, cameraFar: 700, fog: [26, 260],
  }),
  'rift-swords': define({
    id: 'rift-swords', name: 'The Drowned Armoury', scene: 'Where an army lay down in the water',
    model: null, halfX: 34, halfZ: 34, spawnRadius: 18, cameraFar: 700, fog: [22, 240],
  }),
  'rift-fortress': define({
    id: 'rift-fortress', name: 'The Black Fortress', scene: 'The last wall between the dark and the living',
    model: null, halfX: 32, halfZ: 32, spawnRadius: 18, cameraFar: 700, fog: [24, 250],
  }),
  'rift-eclipse': define({
    id: 'rift-eclipse', name: 'The Fallen Star', scene: 'Where the rift threw down a star',
    model: null, halfX: 32, halfZ: 32, spawnRadius: 18, cameraFar: 900, fog: [30, 380],
  }),
  'rift-frost': define({
    id: 'rift-frost', name: 'The Frozen Shrine', scene: 'Where the last prayers froze',
    model: null, halfX: 32, halfZ: 32, spawnRadius: 18, cameraFar: 700, fog: [24, 250],
  }),
  'rift-grove': define({
    id: 'rift-grove', name: 'The Crimson Grove', scene: 'Bamboo that drinks blood',
    model: null, halfX: 32, halfZ: 32, spawnRadius: 18, cameraFar: 700, fog: [20, 220],
  }),
  'rift-wastes': define({
    id: 'rift-wastes', name: 'The Ashen Wastes', scene: 'Where the old gods fell',
    model: null, halfX: 34, halfZ: 34, spawnRadius: 18, cameraFar: 800, fog: [26, 320],
  }),
  'rift-harbor': define({
    id: 'rift-harbor', name: 'The Drowned Harbor', scene: 'The tide brought the dead back in',
    model: null, halfX: 32, halfZ: 32, spawnRadius: 18, cameraFar: 700, fog: [18, 210],
  }),
  'dry-harbour': define({
    id: 'dry-harbour', name: 'The Dry Harbour', scene: 'Where the Dust Sea went out and never came back',
    model: null, halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 1500, fog: [420, 1500],
    duelAxis: .45,
  }),
  'thornwood-ward': define({
    id: 'thornwood-ward', name: 'Thornwood Ward', scene: 'A city block the hex gave back to the forest',
    model: null, halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 900, fog: [70, 820],
  }),
  'kuroyuki-hall': define({
    id: 'kuroyuki-hall', name: 'Kuroyuki Hall', scene: 'A mountain hall in the falling black snow',
    model: null, halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 900, fog: [26, 400],
  }),
  'starfall-crater': define({
    id: 'starfall-crater', name: 'The Starfall Crater', scene: 'Where a falling star struck the Hidden Ash hills',
    model: null, halfX: 38, halfZ: 38, spawnRadius: 26,
    cameraFar: 1400, fog: [260, 1350],
    duelAxis: 0,
  }),
  'scrap-pit': define({
    id: 'scrap-pit', name: 'The Scrap Pit', scene: 'A bounty fight under the scrapyard floodlights',
    model: null, halfX: 13, halfZ: 13, spawnRadius: 9,
    cameraFar: 400, fog: [40, 280], background: 0x09090c,
  }),
};

/** The battle royale's places. */
export const ROYALE_STAGES: readonly StageId[] = [
  'sunward-summit', 'ashfall-weir', 'mirror-mere', 'hollowmere-quarry', 'ash-colosseum', 'wreckers-causeway',
  'dry-harbour',
  'thornwood-ward',
  'kuroyuki-hall',
  'starfall-crater',
];

/** Where a series fights when it brings the crowd. */
const SERIES_ARENA: Record<string, StageId> = {};
/** Series that are one series for a crowd: Tobari and Akagane are filed as
 *  'Konta', the rest of the village as 'Hidden Ash'. */
const SERIES_FAMILY: Record<string, string> = { Konta: 'Hidden Ash' };
/** Where two fighters of one series settle it. Konta's own duel venue is the
 *  Proving Hall, which is also everyone else's, so it is not listed here. */
const SERIES_DUEL: Record<string, StageId> = {
  'Last Sun': 'zenith-coliseum',
};

/** The most-represented series, if it is ahead and brings at least a third of
 *  the roster. A genuinely mixed lobby has no iconic scene. */
function dominantSeries(fighters: readonly FighterId[]): string | null {
  const counts = new Map<string, number>();
  for (const fighter of fighters) {
    const raw = FIGHTER_SERIES[fighter], series = raw ? SERIES_FAMILY[raw] ?? raw : raw;
    if (series) counts.set(series, (counts.get(series) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const [top, second] = ranked;
  if (!top) return null;
  if (second && second[1] === top[1]) return null;
  return top[1] * 5 >= fighters.length * 2 ? top[0] : null;
}

/** Round 4 (STAGES): a royale field's own place, when one series brings the
 *  crowd (three fighters or more) and has one. */
export function seriesStage(fighters: readonly FighterId[]): StageId | undefined {
  if (fighters.length < 3) return undefined;
  const series = dominantSeries(fighters);
  return series ? SERIES_ARENA[series] : undefined;
}

/** Round 4 (STAGES): one of the royale's places, off the caller's seeded
 *  stream (`pick`), never the one dealt last when there is a choice. */
export function dealRoyaleStage(pick: (pool: readonly StageId[]) => StageId, previous?: StageId): StageId {
  const pool = ROYALE_STAGES.filter(stage => stage !== previous);
  return pick(pool.length ? pool : ROYALE_STAGES);
}

/** Round 4b (MAPS): the smaller rings a small battle royale can be dealt as
 *  well, and the most fighters each holds. */
export const SMALL_ROYALE_STAGES: Partial<Record<StageId, number>> = {
  'sunfall-arena': 6, 'zenith-coliseum': 4, 'drifting-isle': 8,
  'scrap-pit': 6,
};
/** The places a royale of `field` fighters can be dealt (all of the famous
 *  places; the smaller rings too when the field is small enough for them). */
export function royalePool(field?: number): StageId[] {
  return [...ROYALE_STAGES, ...(field ? (Object.entries(SMALL_ROYALE_STAGES) as [StageId, number][]).filter(([, most]) => field <= most).map(([stage]) => stage) : [])];
}
/** Round 4b (MAPS): deals the royale's places from a shuffled deck, so every
 *  one comes up once before any comes up again (a blind critic saw one place
 *  four times in fifteen starts and another never). Each field size keeps its own deck (a small field's holds the
 *  smaller rings too); the last place dealt is never dealt next while there
 *  is another. Server memory only. */
export class RoyaleDeck {
  private readonly decks = new Map<string, StageId[]>();
  private last?: StageId;
  deal(pick: (pool: readonly StageId[]) => StageId, field?: number): StageId {
    const pool = royalePool(field), key = pool.join();
    let deck = this.decks.get(key);
    if (!deck?.length) deck = [...pool];
    const choices = deck.filter(stage => stage !== this.last);
    const stage = pick(choices.length ? choices : deck);
    deck.splice(deck.indexOf(stage), 1);
    this.decks.set(key, deck);
    this.last = stage;
    return stage;
  }
}

export const ONLINE_DUEL_STAGES: readonly StageId[] = ['sunfall-arena', 'zenith-coliseum', 'scrap-pit'];
/** The online Duel's deck (see ONLINE_DUEL_STAGES), as RoyaleDeck deals the royale's places. Server memory only. */
export class DuelDeck {
  private deck: StageId[] = [];
  private last?: StageId;
  constructor(private readonly pool: readonly StageId[] = ONLINE_DUEL_STAGES) {}
  deal(pick: (pool: readonly StageId[]) => StageId): StageId {
    if (!this.deck.length) this.deck = [...this.pool];
    const choices = this.deck.filter(stage => stage !== this.last);
    const stage = pick(choices.length ? choices : this.deck);
    this.deck.splice(this.deck.indexOf(stage), 1);
    this.last = stage;
    return stage;
  }
}

/** The deal when the caller brings no stream: the field itself, hashed, so
 *  the same roster always gets the same place whatever order it joined in. */
function rosterPick(fighters: readonly FighterId[]) {
  let hash = 2166136261;
  for (const id of [...fighters].sort()) for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return (pool: readonly StageId[]) => pool[(hash >>> 0) % pool.length];
}

/** Server-authoritative. Training and one-on-one use the Proving Hall, as asked;
 *  a same-series duel that has its own ring gets it instead. A royale goes to
 *  its dominant series' place, or to one dealt from the famous places - off
 *  the room's seeded stream when it passes `pick`, else off the roster. */
export function chooseStage(fighters: readonly FighterId[], mode: RoomMode, pick?: (pool: readonly StageId[]) => StageId): StageId {
  if (mode === 'training') return 'proving-hall';
  if (fighters.length === 2) {
    const series = dominantSeries(fighters);
    const same = series !== null && fighters.every(f => (SERIES_FAMILY[FIGHTER_SERIES[f]] ?? FIGHTER_SERIES[f]) === series);
    const duel = same && series ? SERIES_DUEL[series] : undefined;
    return duel ?? 'proving-hall';
  }
  // An empty or single-entrant match room (one dealt its place on creation,
  // before anyone has joined) has no field to read: it is dealt one.
  return seriesStage(fighters) ?? dealRoyaleStage(pick ?? rosterPick(fighters));
}
