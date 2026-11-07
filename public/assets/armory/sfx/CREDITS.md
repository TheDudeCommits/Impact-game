# Sound effects: credits and licences

Every sample in this folder is **CC0 1.0 (public domain dedication)**. Each licence was checked on
the asset's own page on 2026-10-10. Attribution is not required; it is given anyway.

Files are named `<bank>_<n>.ogg` (Opus) / `<bank>_<n>.mp3` (Safari fallback). They were trimmed,
made mono, peak-normalised to -1 dBFS and re-encoded by `scripts/sfx-build.mjs`, which also holds
the exact source-file → bank mapping. The loops (`loop_*`) were made seamless by crossfading.

Everything else you hear (charge risers, beam hums, crackles, whooshes, sub-booms, shimmer, sword
"shing", wind, fire roar, ice cracks, zaps) is synthesised at runtime by the recipes in `src/audio/recipes.js` (pack 2 added chainsaw rev, metal
grind, hex-shield hum/hit, laser charge, railgun crack, EMP whine, power-down, glitch stutter, black-hole sub drone,
megaswell, surf, magma, pad, clock stop, heartbeat, string twang, boing, scan, beep, whip, petal rustle and hiss).

## Kenney (www.kenney.nl), CC0

| pack | page | banks |
| --- | --- | --- |
| Impact Sounds 1.0 | https://kenney.nl/assets/impact-sounds | punch_heavy, punch_med, clang, plate, bell, glass, mining, thud, wood |
| Sci-Fi Sounds 1.0 | https://kenney.nl/assets/sci-fi-sounds | crunch, boom_low, laser, laser_small, loop_fire, loop_engine, loop_force |
| RPG Audio 1.0 | https://kenney.nl/assets/rpg-audio | blade (knifeSlice), draw, paper, creak |
| Interface Sounds 1.0 | https://kenney.nl/assets/interface-sounds | glitch |

## OpenGameArt.org, CC0

| asset | author | page | banks |
| --- | --- | --- | --- |
| Swishes Sound Pack | artisticdude | https://opengameart.org/content/swishes-sound-pack | swish |
| 80 CC0 RPG SFX | rubberduck | https://opengameart.org/content/80-cc0-rpg-sfx | blade, spell, spell_fire, chain, roar, rubble |
| 50 CC0 Sci-Fi SFX | rubberduck | https://opengameart.org/content/50-cc0-sci-fi-sfx | spell (teleport) |
| 100 CC0 SFX | rubberduck | https://opengameart.org/content/100-cc0-sfx | gong, slam |
| 100 CC0 SFX #2 | rubberduck | https://opengameart.org/content/100-cc0-sfx-2 | thunder, air |
| 25 CC0 bang / firework SFX | rubberduck | https://opengameart.org/content/25-cc0-bang-firework-sfx | bang, cannon, firework |
| 40 CC0 water / splash / slime SFX | rubberduck | https://opengameart.org/content/40-cc0-water-splash-slime-sfx | splash, bubble, slime, loop_water, loop_rain |

Licence text: https://creativecommons.org/publicdomain/zero/1.0/
