import { STAGES, type StageId } from '../game/stages';

export interface OriginalStage {
  /** The name shown wherever the game names the place. */
  name: string;
  /** The line under it (the stage banner, the party's arena list). */
  scene: string;
  world: string;
  safe: boolean;
}

export const ORIGINAL_STAGES: Record<StageId, OriginalStage> = {
  'proving-hall': {
    name: 'The Proving Hall', scene: 'Where the Hidden Ash tests its own', world: 'Hidden Ash', safe: true,
  },
  'sunfall-arena': {
    name: 'The Sunfall Arena', scene: 'A desert arena under the swollen sun', world: 'Last Sun', safe: true,
  },
  'hidden-ash': {
    name: 'The Hidden Ash', scene: 'Last stand at the village gates', world: 'Hidden Ash', safe: true,
  },
  'blood-citadel': {
    name: 'The Fallen Citadel', scene: 'Bad Blood beneath the broken moon', world: '', safe: true,
  },
  harbor: {
    name: 'Manga Harbour', scene: 'Neutral ground', world: '', safe: true,
  },
  // Arcade Survival's places, built in code (src/render/rift); their names are the location cards' (src/survival/locations.ts).
  'rift-village': { name: 'The Burning Village', scene: 'Where the sky first tore open', world: '', safe: true },
  'rift-swords': { name: 'The Drowned Armoury', scene: 'Where an army lay down in the water', world: '', safe: true },
  'rift-fortress': { name: 'The Black Fortress', scene: 'The last wall between the dark and the living', world: '', safe: true },
  'rift-eclipse': { name: 'The Fallen Star', scene: 'Where the rift threw down a star', world: '', safe: true },
  'rift-frost': { name: 'The Frozen Shrine', scene: 'Where the last prayers froze', world: '', safe: true },
  'rift-grove': { name: 'The Crimson Grove', scene: 'Bamboo that drinks blood', world: '', safe: true },
  'rift-wastes': { name: 'The Ashen Wastes', scene: 'Where the old gods fell', world: '', safe: true },
  'rift-harbor': { name: 'The Drowned Harbor', scene: 'The tide brought the dead back in', world: '', safe: true },
  'ash-colosseum': {
    name: 'The Ash Colosseum', scene: 'A walled court of raked ash under the smoking mountain', world: 'Hidden Ash', safe: true,
  },
  'wreckers-causeway': {
    name: 'The Wreckers\' Causeway', scene: 'A fire-lit bridge over the black sea', world: 'Dust Sea', safe: true,
  },
  'sunward-summit': {
    name: 'The Sunward Summit', scene: 'A temple on the last peak, over a sea of cloud at sundown', world: 'Last Sun', safe: true,
  },
  'ashfall-weir': {
    name: 'The Ashfall Weir', scene: 'The river below the old weir, at first light', world: 'Hidden Ash', safe: true,
  },
  'mirror-mere': {
    name: 'The Mirror Mere', scene: 'A still lake where the hex lies sealed', world: 'Hex Fallout', safe: true,
  },
  'hollowmere-quarry': {
    name: 'Hollowmere Quarry', scene: 'A mining town at the bottom of the iron pit', world: 'Ironwall', safe: true,
  },
  'zenith-coliseum': {
    name: 'The Zenith Coliseum', scene: 'A duelling floor where the sky runs out', world: 'Last Sun', safe: true,
  },
  'cinder-flats': {
    name: 'The Cinder Flats', scene: 'Black sand where the embers never cool', world: 'Cinder Requiem', safe: true,
  },
  'warlords-roof': {
    name: 'The Warlord\'s Roof', scene: 'Atop the warlord\'s fortress, under thunder', world: 'Dust Sea', safe: true,
  },
  'drifting-isle': {
    name: 'The Drifting Isle', scene: 'Old flagstones adrift in a bright sky', world: 'Last Sun', safe: true,
  },
  'rift-war': { name: 'The Torn Plain', scene: 'Three causeways across the rift', world: '', safe: true },
  'dry-harbour': { name: 'The Dry Harbour', scene: 'Where the Dust Sea went out and never came back', world: 'Dust Sea', safe: true },
  'thornwood-ward': { name: 'Thornwood Ward', scene: 'A city block the hex gave back to the forest', world: 'Hex Fallout', safe: true },
  'kuroyuki-hall': { name: 'Kuroyuki Hall', scene: 'A mountain hall in the falling black snow', world: 'Black Snow', safe: true },
  'starfall-crater': { name: 'The Starfall Crater', scene: 'Where a falling star struck the Hidden Ash hills', world: 'Hidden Ash', safe: true },
  'scrap-pit': { name: 'The Scrap Pit', scene: 'A bounty fight under the scrapyard floodlights', world: 'Salvage Wilds', safe: true },
};

/** The launch gate's lists (team L): what may be dealt today, and what is left out until it is fixed. */
export const SAFE_STAGES = (Object.keys(ORIGINAL_STAGES) as StageId[]).filter(id => ORIGINAL_STAGES[id].safe);
export const GATED_STAGES = (Object.keys(ORIGINAL_STAGES) as StageId[]).filter(id => !ORIGINAL_STAGES[id].safe);

export function shownStage(id: StageId | string | undefined | null): { name: string; scene: string } | undefined {
  if (!id) return undefined;
  const stage = ORIGINAL_STAGES[id as StageId] ?? STAGES[id as StageId];
  return stage && { name: stage.name, scene: stage.scene };
}

export const STAGE_SKIES: Partial<Record<StageId, string>> = {
  'zenith-coliseum': 'sky-zenith-coliseum.webp',
};
export const SKY_OVERRIDES: Partial<Record<StageId, string>> = {
  'sunfall-arena': 'sky-sunfall-arena.webp', 
  'starfall-crater': 'sky-starfall-twilight.webp' /* places-epic-a: twilight after the star fell */, 'kuroyuki-hall': 'sky-kuroyuki-night.webp' /* places-epic-a: Kuroyuki by night */, 'cinder-flats': 'sky-cinder-ember.webp' /* places-epic-a: under the eruption */, 'mirror-mere': 'sky-mirror-mere-night.webp' /* places-epic-a: the mere at night */, 'drifting-isle': 'sky-drifting-isle.webp', 
  'dry-harbour': 'sky-dry-harbour.webp', 'sunward-summit': 'sky-sunward-summit.webp', 'ashfall-weir': 'sky-ashfall-smoke.webp', 'thornwood-ward': 'sky-thornwood-night.webp',
  'hollowmere-quarry': 'sky-hollowmere-quarry.webp', 'wreckers-causeway': 'sky-wreckers-night.webp', 'scrap-pit': 'sky-scrap-pit.webp',
};
export const WITHHELD_SKIES: readonly string[] = [];
export const RETIRED_SKIES: readonly string[] = [];
export const BUILT_PLACES: Partial<Record<StageId, string>> = {
  'proving-hall': 'built in code',
  'wreckers-causeway': 'built in code',
  'sunfall-arena': 'built in code',
  'warlords-roof': 'built in code',
  'ash-colosseum': 'built in code',
  'mirror-mere': 'built in code',
  'starfall-crater': 'built in code',
  'kuroyuki-hall': 'built in code',
  'drifting-isle': 'built in code',
  'cinder-flats': 'built in code',
  'zenith-coliseum': 'built in code',
  'ashfall-weir': 'built in code',
  'sunward-summit': 'built in code',
  'scrap-pit': 'built in code',
  'dry-harbour': 'built in code',
  'thornwood-ward': 'built in code',
  'hollowmere-quarry': 'built in code',
};
export const STILL_LOADED: Partial<Record<StageId, string>> = {};
export const RETIRED_FILES: readonly string[] = RETIRED_SKIES.map(file => `assets/environment/br/${file}`);
export const RETIRED_KIT: readonly string[] = [];
const skyPath = (file: string) => file.startsWith('/') ? file : `/assets/environment/br/${file}`;
export const stageSky = (id: StageId, asked?: string) => {
  const own = SKY_OVERRIDES[id] ?? STAGE_SKIES[id];
  return skyPath(own ?? asked ?? `sky-${id}.webp`);
};

export const UNCLEARED_DRESSINGS: readonly StageId[] = [];
export function applyOriginalDressers<T>(dressers: Partial<Record<StageId, T>>) {
  for (const id of UNCLEARED_DRESSINGS) delete dressers[id];
  return dressers;
}

/** The Last Stand mode's words for the village it defends (the Hidden Ash, Konta's and Shirokane's home). */
export const LAST_STAND = {
  /** The mode sheet's and the mission cover's kicker. */
  kicker: 'THE HIDDEN ASH · ENDLESS DEFENCE',
  /** The mode sheet's goal line. */
  goal: 'Defend the Hidden Ash gate, wave after wave.',
  /** The loading screen's line under LAST STAND. */
  loading: 'DEFEND THE HIDDEN ASH',
  /** The party's custom-rules note. */
  custom: 'Defend the Hidden Ash. Automatic personal fighter levels. Shared village defences.',
  /** The results header's place. */
  where: 'THE HIDDEN ASH',
  /** The mission result's headline. */
  remembers: 'THE ASH<br>REMEMBERS.',
  /** The squad lobby's line. */
  lobby: 'HOLD THE GATE. SPEND TOGETHER. FALL TOGETHER.',
  /** The Quartermaster's header. */
  shop: 'HIDDEN ASH · VILLAGE DEFENCES',
  /** The sign over the gate (src/render/objectives/HiddenAshVillage.ts): "the village of ash". */
  sign: '灰ノ里',
} as const;

export const SUNFALL_LETTERING = { name: '落陽闘技場', roundel: '陽' } as const;

/** The duel's mode sheet kicker: the place a duel vs a bot is fought (src/game/duel/LocalDuel.ts). */
export const DUEL_KICKER = `${ORIGINAL_STAGES['sunfall-arena'].name.toUpperCase()} · 1 V 1`;
