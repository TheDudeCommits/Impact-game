
import { SOUNDTRACK, type SoundtrackTrack } from './score';
import { heldSoundtrack } from './scoreStandIns';

const CC_BY_4 = 'https://creativecommons.org/licenses/by/4.0/', CC_BY_3 = 'https://creativecommons.org/licenses/by/3.0/';
const S = 'assets/audio/survival/';

export const ORIGINAL_OPEN_CREDITS = [
  {
    work: '“Hell”, “Monster’s Belly” and “Murder of Crows”, and the knife stabs, bone cracks, zombies, monsters, screams and evil laughs of the Horror Sound Effects Library',
    by: 'by Little Robot Sound Factory',
    sources: [['littlerobotsoundfactory.com', 'https://littlerobotsoundfactory.com'], ['OpenGameArt', 'https://opengameart.org/content/horror-sound-effects-library']],
    licence: 'CC BY 3.0', licenceUrl: CC_BY_3,
    changes: 'trimmed, levelled and looped for Arcade Survival, and some layered into the horde’s crowd',
    files: ['gore-7', 'gore-8', 'gore-9', 'gore-10', 'gore-11', 'gore-12', 'gore-13', 'zombie-cry-3', 'zombie-cry-5', 'zombie-hurt-5', 'zombie-hurt-6',
      'zombie-die-2', 'zombie-die-4', 'demon-roar-1', 'demon-roar-2', 'demon-roar-3', 'demon-roar-4', 'demon-roar-5', 'demon-roar-6', 'demon-roar-7',
      'scream-1', 'scream-2', 'scream-3', 'scream-4', 'scream-5', 'laugh-1', 'laugh-2', 'laugh-3', 'bed-swords-crows', 'bed-eclipse-hell', 'bed-eclipse-belly',
      'bed-horde'].map(name => `${S}${name}.m4a`),
  },
  {
    work: '“Large Bonfire”, “Campfire Crackling”, “Winter Wind” and “Heavy Thunderstorm” from Nature Ambient Pack Vol 1',
    by: 'by JC Sounds',
    sources: [['OpenGameArt', 'https://opengameart.org/content/jc-sounds-nature-ambient-pack-vol-1']],
    licence: 'CC BY 4.0', licenceUrl: CC_BY_4,
    changes: 'looped and levelled for Arcade Survival',
    files: ['bed-village-fire', 'bed-village-crackle', 'bed-swords-wind', 'bed-fortress-storm'].map(name => `${S}${name}.m4a`),
  },
  {
    work: '“Magical gyroscope”', by: 'by reddification',
    sources: [['Sketchfab', 'https://sketchfab.com/3d-models/magical-gyroscope-a3f110c0d2944a2dbff78709eb8f3984']],
    licence: 'CC BY 4.0', licenceUrl: CC_BY_4, changes: 'compressed for the web',
    files: ['assets/armory/cinematic/models/magical_gyroscope.glb'],
  },
  {
    work: '“Two- Headed Snake FBX”', by: 'by Providence Secretary (NIEZDE)',
    sources: [['Sketchfab', 'https://sketchfab.com/3d-models/two-headed-snake-fbx-2154cfc2e43f4f959b917f4e1a1fa935']],
    licence: 'CC BY 4.0', licenceUrl: CC_BY_4, changes: 'compressed for the web',
    files: ['assets/armory/extended/models/snake.glb'],
  },
] as const satisfies readonly { work: string; by?: string; sources: readonly (readonly [string, string])[]; licence: string; licenceUrl?: string; changes?: string; files: readonly string[] }[];

export const ARMORY_OPEN_WORKS = [
  {
    work: 'Effekseer for WebGL and its sample effects', by: 'by the Effekseer Project; the samples by AndrewFM, NextSoft, Pierre, Suzuki (ICS LAB) and tktk',
    sources: [['effekseer.github.io', 'https://effekseer.github.io'], ['GitHub', 'https://github.com/effekseer/EffekseerForWebGL']],
    licence: 'MIT (the runtime) and CC0 (the samples)',
    files: ['assets/armory/fxlib/effekseer/'],
  },
  {
    work: 'Elemental Sandbox (threejs-vfx), the base of the VFX Armory, and the casting packs built on it', by: '© 2026 mohamedachrefelouafi',
    sources: [['threejs-vfx', 'https://github.com/majidmanzarpour/threejs-vfx'], ['the casting packs', 'https://github.com/achrefelouafi']],
    licence: 'MIT', files: [],
  },
  {
    work: 'Ability-ThreeJS-Project (the Armory\'s p27 pack)', by: '© 2026 itzmitto',
    sources: [['GitHub', 'https://github.com/itzmitto/Ability-ThreeJS-Project']],
    licence: 'MIT', files: [],
  },
  {
    work: 'The other open code in the Forge\'s effects',
    by: 'by tsuyatt (rollshade), ICS INC., Codrops and MisterPrada, Forrest Sun (three.quarks), a-jie and rohan-deshpande (three-nebula), Otto Seiskari, Pavel Dobryakov, Sahil K, Anderson Mancini, Serj, Evan Wallace, Martin Renou, Ashima Arts and Stefan Gustavson, Mapbox, Rye Terrell and the MaterialX contributors',
    sources: [['rollshade', 'https://github.com/tsuyatt/rollshade'], ['three.quarks', 'https://github.com/Alchemist0823/three.quarks'], ['three-nebula', 'https://github.com/creativelifeform/three-nebula'], ['webgl-noise', 'https://github.com/ashima/webgl-noise']],
    licence: 'MIT, BSD-3-Clause, ISC, Apache 2.0 and the Unlicense', files: [],
  },
] as const satisfies readonly { work: string; by?: string; sources: readonly (readonly [string, string])[]; licence: string; licenceUrl?: string; changes?: string; files: readonly string[] }[];

/** The Armory's effects the game may not offer (their files' licences forbid it), and their files. */
export const UNSHIPPED_ARMORY = new Set(['cin_dragon']);
export const UNSHIPPED_ARMORY_FILES = ['assets/armory/remake/dragon.glb', 'assets/armory/thumbs/cin_dragon.webp'] as const;

const PH = (id: string) => ['Poly Haven', `https://polyhaven.com/a/${id}`] as const;
const CC0_URL = 'https://creativecommons.org/publicdomain/zero/1.0/';
const TEX = (...names: string[]) => names.flatMap(name => ['diff', 'nor', 'rough'].map(part => `assets/environment/cc0/tex/${name}-${part}.webp`));
export const STAGE_CC0_WORKS = [
  { work: 'Monastery Stone Floor, Dark Wooden Planks, Red Sandstone Wall', by: 'by Amal Kumar', sources: [PH('monastery_stone_floor'), PH('dark_wooden_planks'), PH('red_sandstone_wall')],
    files: TEX('flagstone', 'planks-dark', 'sandstone-red') },
  { work: 'White Sandstone Blocks 02 and Sandstone Cracks', by: 'by Rob Tuytel', sources: [PH('white_sandstone_blocks_02'), PH('sandstone_cracks')],
    files: TEX('sandstone-pale', 'sandstone-cracked') },
  { work: 'Japanese Stone Wall', by: 'by Rico Cilliers, Charlotte Baglioni and Dario Barresi', sources: [PH('japanese_stone_wall')], files: TEX('ashlar-grey') },
  { work: 'Red Sand', by: 'by Rohit Seervi', sources: [PH('red_sand')], files: TEX('sand-red') },
  { work: 'Weathered Planks', by: 'by Dario Barresi and Dimitrios Savva', sources: [PH('weathered_planks')], files: TEX('planks-weathered') },
  { work: 'Seaside Rock', by: 'by Dimitrios Savva', sources: [PH('seaside_rock')], files: TEX('rock-sea') },
  { work: 'Chinese Chandelier', by: 'by Kirill Sannikov', sources: [PH('chinese_chandelier')], files: ['assets/environment/cc0/chandelier-lantern.glb'] },
  { work: 'Wooden Lantern 01, Wooden Barrels 01, Wooden Crate 01, Wooden Bucket 01 and Utility Box 02', by: 'by James Ray Cock',
    sources: [PH('wooden_lantern_01'), PH('wooden_barrels_01'), PH('wooden_crate_01'), PH('wooden_bucket_01'), PH('utility_box_02')],
    files: ['assets/environment/cc0/lantern-wood.glb', 'assets/environment/cc0/barrels.glb', 'assets/environment/cc0/crate.glb', 'assets/environment/cc0/bucket.glb', 'assets/environment/cc0/utility-box.glb'] },
  { work: 'Stone Fire Pit', by: 'by Sebastian Platen', sources: [PH('stone_fire_pit')], files: ['assets/environment/cc0/fire-pit.glb'] },
  { work: 'Namaqualand Cliff 01 and 02, Namaqualand Boulder 02 and 05', by: 'by Jenelle van Heerden, Greg Zaal, Dario Barresi and Rico Cilliers',
    sources: [PH('namaqualand_cliff_01'), PH('namaqualand_cliff_02'), PH('namaqualand_boulder_02'), PH('namaqualand_boulder_05')],
    files: ['assets/environment/cc0/cliff-a.glb', 'assets/environment/cc0/cliff-b.glb', 'assets/environment/cc0/boulder-a.glb', 'assets/environment/cc0/boulder-b.glb'] },
  { work: 'Quiver Tree 01 and Dead Quiver Trunk', by: 'by James Ray Cock, Dario Barresi and Rico Cilliers', sources: [PH('quiver_tree_01'), PH('dead_quiver_trunk')],
    files: ['assets/environment/cc0/desert-tree.glb', 'assets/environment/cc0/dead-trunk.glb'] },
  { work: 'Dutch Ship Medium', by: 'by James Ray Cock, Rico Cilliers and Nicolò Zubbini', sources: [PH('dutch_ship_medium')], files: ['assets/environment/cc0/ship-hulk.glb'] },
  { work: 'Covered Car', by: 'by MP', sources: [PH('covered_car')], files: ['assets/environment/cc0/covered-car.glb'] },
  // places-finish (5 November 2026): the surfaces that finish Thornwood Ward, the Mirror Mere, the Drifting Isle, Kuroyuki
  // Hall and the Warlord's Roof (src/originals/places/finish.ts).
  { work: 'Asphalt 02, Snow 02 and Castle Wall Slates', by: 'by Rob Tuytel', sources: [PH('asphalt_02'), PH('snow_02'), PH('castle_wall_slates')],
    files: TEX('asphalt-cracked', 'snow', 'slate-wall') },
  { work: 'River Small Rocks', by: 'by Rob Tuytel and Rico Cilliers', sources: [PH('river_small_rocks')], files: ['assets/environment/cc0/tex/pebbles-river-diff.webp'] },
  { work: 'Leafy Grass and Rock Tile Floor', by: 'by Charlotte Baglioni', sources: [PH('leafy_grass'), PH('rock_tile_floor')], files: TEX('grass-leafy', 'stone-tiles') },
  { work: 'Grey Stone Path and Marble Rock 01', by: 'by Amal Kumar', sources: [PH('grey_stone_path'), PH('marble_rock_01')], files: TEX('stone-path', 'limestone-rock') },
  { work: 'Patterned Slate Tiles', by: 'by Dimitrios Savva', sources: [PH('patterned_slate_tiles')], files: TEX('slate-patterned') },
].map(credit => ({ ...credit, licence: 'CC0', licenceUrl: CC0_URL, changes: 'reduced for the web' }));

/** music (4 November 2026): the soundtrack's sourced tracks (src/originals/score.ts SOUNDTRACK; each one's source, licence and
 *  the terms that allow it in scripts/originals/music/soundtrack.json), credited one by one as CC BY 4.0 asks (the title,
 *  the author, where it is from, the licence, what was changed) and as MaouDamashii asks (「音楽：魔王魂」, with a link).
 *  A track two playlists share, or a sting cut from a track, is one line per file. src/ui/legal.ts ATTRIBUTIONS lists these
 *  after its own. */
const OST_TRACKS = [...new Map([...SOUNDTRACK.home, ...Object.values(SOUNDTRACK.modes).flat(), ...SOUNDTRACK.boss, ...SOUNDTRACK.results.win,
  ...SOUNDTRACK.results.loss, SOUNDTRACK.stinger.win, SOUNDTRACK.stinger.loss].map(track => [track.url, track as SoundtrackTrack])).values()];
export const SOUNDTRACK_CREDITS = OST_TRACKS.filter(track => !heldSoundtrack(track.url)).map(track => ({ // (a held-back file, not in this repository, is not credited: scoreStandIns.ts)
  work: track.credit.work, by: `${track.credit.by}; 音楽：魔王魂`,
  sources: [['maou.audio', track.credit.page]] as const,
  licence: 'CC BY 4.0', licenceUrl: CC_BY_4, changes: track.credit.changes,
  files: [track.url.slice(1)],
}));
