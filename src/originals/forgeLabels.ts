
export const FORGE_LABELS: Readonly<Record<string, string>> = {
  // The breath pack: eight sword forms, each its own.
  breath_flame: 'Brazier Arc',
  breath_insect: 'Hornet Needle',
  breath_mist: 'Fogbank Feint',
  breath_moon: 'Waning Sickles',
  breath_sun: 'NO SHADOW Arc',
  breath_thunder: 'Stormfront Lunge',
  breath_water: 'Riptide Slash',
  breath_wind: 'Squall Slash',
  // The edge and blade packs.
  edge_blackcrescent: 'Umbra Crescent',
  edge_petalswarm: 'Petal Squall',
  edge_onislash: 'Hannya Cleave',
  blade_crescent: 'Reaping Wave',
  blade_iaido: 'Still Draw',
  found_nebula: 'Nebula Field',
  // The ext pack's four elements, after a coined art's names.
  ext_bend_air: 'Gale Palm',
  ext_bend_earth: 'Upheaval Wave',
  ext_bend_fire: 'Firebrand Stream',
  ext_bend_water: 'Brine Whip',
  extra_uppercut: 'Skybreaker Uppercut',
  // The will, arts, ki and saga packs.
  will_sovereign: 'Ikaku',
  arts_clones: 'Mirage Ranks',
  arts_domain: 'Abyssal Ring',
  arts_fireball: 'Kiln Breath',
  arts_purple: 'Annulment Orb',
  arts_push: 'Rebuff Wave',
  arts_windshuriken: 'Buzzsaw Squall',
  ki_flash: 'Blinding Clap',
  ki_sunbomb: 'Heavy Star Drop',
  ki_lightning_hand: 'Static Nukite',
  ki_spiral: 'Churning Orb',
  saga_blitz: 'Myriad Blink',
  saga_void_ray: 'Scarlet Maw',
  saga_drillbeam: 'Auger Ray',
  saga_redaura: 'Redline Aura',
  saga_bigpunch: 'Tetsui',
  // The seal pack.
  seal_eboncoffin: 'Ink Casket',
  seal_cursemark: 'Soot Sigil',
  seal_elasticstrand: 'Sinew Tether',
  seal_shrinedomain: 'Sickle-Wind Ground',
  seal_sproutarms: 'Grasping Thicket',
  seal_stringcage: 'Garrote Cage',
  seal_trigrams: 'Palm Ward Circle',
  // The colossus pack.
  colossus_flamefist: 'Forge Giant Fist',
  colossus_hundredpalm: 'Temple Giant Palm',
  colossus_thunderhound: 'Volt Jackal Rush',
  colossus_moltenfist: 'Slagfall Fist',
  colossus_pressurepillar: 'Spirit Pyre Column',
  colossus_spiritarmor: 'Yoroi Colossus',
};

/** An Armory effect's name as the Forge shows it. */
export const forgeLabel = (id: string, label: string) => FORGE_LABELS[id] ?? label;
