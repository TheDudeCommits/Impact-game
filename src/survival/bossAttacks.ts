/** Each survival boss move's clean clip, and each entrance's: a generated table (do not edit by hand; a boss enters it once its
 *  file carries its clean clips). Each clip is cut from clean sources (the Quaternius library, CC0, and the game's own takes)
 *  on the move's own contacts and length; enemies.ts applies this: the clean clip goes
 *  in front of the move's own names, a chain is played as the one clean clip, on the same clock. */
export const CLEAN_ATTACKS: Readonly<Record<string, Readonly<Record<string, readonly [string, number]>>>> = {
  "barrow": { "Darkness Grab": ["clean_atk_darkness_grab", 1.0], "Swallowing Rush": ["clean_atk_swallowing_rush", 1.1667], "Stolen Quake": ["clean_atk_stolen_quake", 1.3], "Night Maw": ["clean_atk_night_maw", 2.5667], "Disgorge": ["clean_atk_disgorge", 2.8] },
  "jinlin": { "Tyrant's Rush": ["clean_atk_tyrants_rush", 1.8833], "Tail Smash": ["clean_atk_tail_smash", 1.1667], "Needle Ray": ["clean_atk_needle_ray", 2.05], "Doom Sphere": ["clean_atk_doom_sphere", 3.1667] },
  "jirenga": { "Colossus Rush": ["clean_atk_colossus_rush", 1.8833], "Power Smash": ["clean_atk_power_smash", 1.1667], "Dash Smash": ["clean_atk_dash_smash", 1.5667], "Glare": ["clean_atk_glare", 2.3667], "Colossus Impact": ["clean_atk_colossus_impact", 3.2333], "Endless Rush": ["clean_atk_endless_rush", 1.8833] },
  "wuming": { "Dusk Rush": ["clean_atk_dusk_rush", 2.1167], "Violent Rush": ["clean_atk_violent_rush", 1.1333], "Divine Blade": ["clean_atk_divine_blade", 2.15], "Black Sun Beam": ["clean_atk_black_sun_beam", 4.0667] },
};
export const CLEAN_INTROS: Readonly<Record<string, string>> = {
  "barrow": "clean_intro",
  "jirenga": "clean_intro",
};
