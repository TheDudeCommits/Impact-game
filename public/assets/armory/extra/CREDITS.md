# Extra pack: asset and code credits

All sprite sheets in `sprites/` were downloaded from their original pages on 2026-10-10,
with the license checked on each page, and repacked (cropped, regridded, resized,
converted to WebP). The art itself is unchanged.

## Sprite sheets (CC0)

| File(s) in `sprites/` | Source | Author | License |
|---|---|---|---|
| `inguz_impact04.webp`, `inguz_impact07.webp`, `inguz_impact08.webp` | https://opengameart.org/content/2dfx-impact-spritesheets (`impact04_0.png`, `impact07_0.png`, `impact08_0.png`) | Inguz Media | Multi-licensed on the page; used under **CC0** |
| `sinestesia_hit1.webp` | https://opengameart.org/content/hit-animation-frame-by-frame (`hit - yellow.png`) | Sinestesia | CC0 |
| `sinestesia_hit2.webp` | https://opengameart.org/content/hit-animation-2-frame-by-frame (`Hit-Yellow.png`) | Sinestesia | CC0 |
| `sinestesia_explosion_a.webp`, `sinestesia_explosion_b.webp` | https://opengameart.org/content/2d-explosion-animations-frame-by-frame (`0_22.png`, `1_143.png`) | Sinestesia | CC0 |
| `meta_slash_big.webp`, `meta_slash_arcing.webp`, `meta_slash_circular.webp`, `meta_lunge_big.webp`, `meta_slash_atlas.webp` (the 39 small slashes in one atlas) | https://opengameart.org/content/slash-effect-collection (`Slash Effect Collection.zip`) | MetaShinryu | CC0 |
| `kutejnikov_aura001.webp`, `kutejnikov_aura002.webp` (white variants, 60 frames each) | https://opengameart.org/content/auras (`auras-001-002.7z`) | Pavel Kutejnikov | CC0 |
| `vsg_fx_charge.webp` | https://opengameart.org/content/fx-charge (`fx_0_0.png`) | VSG | CC0 |
| `rice_radial_lightning.webp` | https://opengameart.org/content/radial-lightning-effect (`spark_radial_spritesheet_13rice_0.png`) | 13rice | CC0 |
| `soluna_explosion21.webp`, `soluna_aura38.webp`, `soluna_ring95.webp` | https://opengameart.org/content/explosion-effects-and-more (`Explosion21.png`, `Aura38.png`, `Effect95.png`) | Soluna Software | Dual-licensed CC-BY 3.0 / **CC0**; used under CC0 |
| `rubberduck_shockwave_magic.webp`, `rubberduck_ring_magic.webp`, `rubberduck_explosion_magic.webp` | https://opengameart.org/content/25-special-effects-rendered-with-blender (`blender-volumetric-particles-effects.zip`, `effect-images/{shockwave,ring,explosion}/magic`) | rubberduck | CC0 |

CC0 needs no attribution; it is given here anyway.

## Code

| Code | Source | License |
|---|---|---|
| `src/abilities/extra/lib/rs/*` (rollshade-gl runtime and the 14 rollshade moves) | rollshade by tsuyatt, https://github.com/tsuyatt/rollshade (TSL/WebGPU runtime ported to WebGL GLSL; recipe logic kept) | MIT, © 2026 tsuyatt |
| Shock-ring refraction in `src/abilities/extra/lib/shaders/` | gamedevserj Godot-Shaders `ImpactEffectShader/impact_effect_procedural.gdshader`, https://github.com/gamedevserj/Godot-Shaders | MIT, © 2020 Serj |
