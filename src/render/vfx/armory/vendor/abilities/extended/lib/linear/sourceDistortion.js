// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * sourceDistortion.js — keeps the linear-extended distortion writers 1:1.
 *
 * The source repo's refraction pass ran at `uScale = settings.post.distortion`
 * = 0.045 and decoded `offset = dir * B * A * uScale`; its writers folded
 * `global.distortion` into their own strength. The armory's pass runs at
 * `post.distortion (1.0) x global.distortion` and decodes `dir * B * uScale`
 * (no alpha). So a ported writer writes `B * A` (one extra coverage factor,
 * done in its shader) and scales its strength by the source's 0.045, without
 * applying `global.distortion` itself (the pass already does).
 *
 * MIT, Copyright (c) 2026 mohamedachrefelouafi (source architecture).
 */
export const SOURCE_POST_DISTORTION = 0.045;
