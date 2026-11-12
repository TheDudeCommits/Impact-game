/** Each survival boss move's clean clip, and each entrance's: a generated table (do not edit by hand; a boss enters it once its
 *  file carries its clean clips). Each clip is cut from clean sources (the Quaternius library, CC0, and the game's own takes)
 *  on the move's own contacts and length; enemies.ts applies this: the clean clip goes
 *  in front of the move's own names, a chain is played as the one clean clip, on the same clock. */
export const CLEAN_ATTACKS: Readonly<Record<string, Readonly<Record<string, readonly [string, number]>>>> = {
  "akagane": { "War Fan Strike": ["clean_atk_war_fan_strike", 1.83], "Ash Tide Flame": ["clean_atk_ash_tide_flame", 2], "Falling Star": ["clean_atk_falling_star", 3.17] },
  "ashwing": { "Coal-Seam Cut": ["clean_atk_coal_seam_cut", 0.9667], "Pyre Blade": ["clean_atk_pyre_blade", 1], "Cinder Gale": ["clean_atk_cinder_gale", 1.8], "Iron-Feather Dive": ["clean_atk_iron_feather_dive", 2.3] },
  "barrow": { "Tar Grab": ["clean_atk_tar_grab", 1.0], "Gorging Rush": ["clean_atk_gorging_rush", 1.1667], "Wreck Quake": ["clean_atk_wreck_quake", 1.3], "Tar Tide": ["clean_atk_tar_tide", 2.5667], "Disgorge": ["clean_atk_disgorge", 2.8] },
  "caldera": { "Charred Fist": ["clean_atk_charred_fist", 1.3667], "Rising Cinder": ["clean_atk_rising_cinder", 1.3333], "Lava Tears": ["clean_atk_lava_tears", 2.1333], "Rosary Burst": ["clean_atk_rosary_burst", 2.6], "Rain of Embers": ["clean_atk_rain_of_embers", 2.0667] },
  "gantry": { "Gauntlet Cleave": ["clean_atk_gauntlet_cleave", 1.3], "Millstone Palm": ["clean_atk_millstone_palm", 1.3667], "Cloister Slam": ["clean_atk_cloister_slam", 2.4] },
  "gorai": { "Iron Club Swing": ["clean_atk_iron_club_swing", 1.0], "Overhead Ruin": ["clean_atk_overhead_ruin", 0.8], "Tyrant Leap": ["clean_atk_tyrant_leap", 2.3], "Thunderclap Club": ["clean_atk_thunderclap_club", 2.8] },
  "gorai-wyrm": { "Storm Tail": ["clean_atk_storm_tail", 0.9], "Dragon Rush": ["clean_atk_dragon_rush", 0.93], "Thunderclap Club": ["clean_atk_thunderclap_club", 1.57], "Azure Breath": ["clean_atk_azure_breath", 2.97], "Fire Rain": ["clean_atk_fire_rain", 2.2667] },
  "haldor": { "Glaive Sweep": ["clean_atk_glaive_sweep", 1.1333], "Cloudsplitter": ["clean_atk_cloudsplitter", 1.3333], "Quake Punch": ["clean_atk_quake_punch", 1.6333], "Tidal Quake": ["clean_atk_tidal_quake", 2.3], "Island-Splitter": ["clean_atk_island_splitter", 3.1333] },
  "harrow": { "Shackle Fist": ["clean_atk_shackle_fist", 1.1333], "Grave Rake": ["clean_atk_grave_rake", 1.3667], "Gravehound Lunge": ["clean_atk_gravehound_lunge", 1.5] },
  "jinlin": { "Tyrant's Rush": ["clean_atk_tyrants_rush", 1.8833], "Tail Smash": ["clean_atk_tail_smash", 1.1667], "Pearl Lance": ["clean_atk_pearl_lance", 2.05], "Tidal Pearl": ["clean_atk_tidal_pearl", 3.1667] },
  "banjaku": { "Colossus Rush": ["clean_atk_colossus_rush", 1.8833], "Power Smash": ["clean_atk_power_smash", 1.1667], "Dash Smash": ["clean_atk_dash_smash", 1.5667], "Stone Stare": ["clean_atk_stone_stare", 2.3667], "Boulder Orb": ["clean_atk_boulder_orb", 3.2333], "Endless Rush": ["clean_atk_endless_rush", 1.8833] },
  "kade": { "Wrist-Blade Rake": ["clean_atk_wrist_blade_rake", 1.1333], "Silk Step": ["clean_atk_silk_step", 1.1333], "Cut Threads": ["clean_atk_cut_threads", 1.8333], "Stilling Palm": ["clean_atk_stilling_palm", 1.6333], "Needle Silk": ["clean_atk_needle_silk", 1.1] },
  "kanuki": { "Padlock Jab": ["clean_atk_padlock_jab", 0.9667], "Bolt-Bar Kick": ["clean_atk_bolt_bar_kick", 1.1667], "Prison Door Slam": ["clean_atk_prison_door_slam", 1.2333] },
  "kuromitsu": { "Tar-Fork Thrust": ["clean_atk_tar_fork_thrust", 1], "Pitch Whirl": ["clean_atk_pitch_whirl", 1.5], "Tar-Spike Cleave": ["clean_atk_tar_spike_cleave", 2], "Twelve-Eyed Barrage": ["clean_atk_twelve_eyed_barrage", 1.67] },
  "lumen": { "Mirror Kick": ["clean_atk_mirror_kick", 1.3667], "Widow's Flash": ["clean_atk_widows_flash", 1.1667], "Halo Shards": ["clean_atk_halo_shards", 4.97], "Mourning Light": ["clean_atk_mourning_light", 2] },
  "mirabel": { "Dowager's Blade": ["clean_atk_dowagers_blade", 1.1333], "Locket Snatch": ["clean_atk_locket_snatch", 1.6], "Ball Lightning": ["clean_atk_ball_lightning", 1.9667], "Crown of Storms": ["clean_atk_crown_of_storms", 1.57] },
  "nightfall": { "Nightfall Rush": ["clean_atk_nightfall_rush", 1.8667], "Blink Cleave": ["clean_atk_blink_cleave", 1.7], "Cinder Wave": ["clean_atk_cinder_wave", 2.83], "Dusk Ray": ["clean_atk_dusk_ray", 4.47] },
  "nihil": { "Wing Lash": ["clean_atk_wing_lash", 1.8333], "Halo Ray": ["clean_atk_halo_ray", 1.7], "Falling Spikes": ["clean_atk_falling_spikes", 5.07], "Seraph's Spear": ["clean_atk_seraphs_spear", 5.3] },
  "dune-oni": { "Wild Slash": ["clean_atk_wild_slash", 1], "Unchained Flurry": ["clean_atk_unchained_flurry", 2.1333], "Oni Cleave": ["clean_atk_oni_cleave", 2.03] },
  "rime": { "Icicle Rake": ["clean_atk_icicle_rake", 1.3], "Glacier Crescent": ["clean_atk_glacier_crescent", 1.7], "Hoarfrost Breath": ["clean_atk_hoarfrost_breath", 2.3667], "Calving Glacier": ["clean_atk_calving_glacier", 4.3] },
  "shiun": { "Mirage Cut": ["clean_atk_mirage_cut", 1.6667], "Blink Cut": ["clean_atk_blink_cut", 1.6667], "Wing Blades": ["clean_atk_wing_blades", 5.2667], "Fermata": ["clean_atk_fermata", 5.6], "Thousand Lights": ["clean_atk_thousand_lights", 2.6667] },
  "takane": { "Veil Cut": ["clean_atk_veil_cut", 0.9333], "Cartwheel of Knives": ["clean_atk_cartwheel_of_knives", 1.3333], "Hundred-Knife Waltz": ["clean_atk_hundred_knife_waltz", 2.2] },
  "wuming": { "Weeding Rush": ["clean_atk_weeding_rush", 2.1167], "Scything Rush": ["clean_atk_scything_rush", 1.1333], "Lotus Edge": ["clean_atk_lotus_edge", 2.15], "Withering Beam": ["clean_atk_withering_beam", 4.0667] },
  "zarek": { "Glass Claws": ["clean_atk_glass_claws", 2], "Obsidian Pounce": ["clean_atk_obsidian_pounce", 2.0333], "Shard Volley": ["clean_atk_shard_volley", 4.0], "Magma-Vein Rend": ["clean_atk_magma_vein_rend", 3.6667] },
};
export const CLEAN_INTROS: Readonly<Record<string, string>> = {
  "akagane": "clean_intro",
  "barrow": "clean_intro",
  "caldera": "clean_intro",
  "gorai": "clean_intro",
  "gorai-wyrm": "clean_intro",
  "haldor": "clean_intro",
  "banjaku": "clean_intro",
  "kade": "clean_intro",
  "shiun": "clean_intro",
};
