// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
/*!
 * rollshade-gl / palette.js
 *
 * Ported from rollshade (https://github.com/tsuyatt/rollshade) `src/runtime/palette.ts`:
 * TypeScript types stripped, imports rewired to the GLSL runtime in this folder.
 * The move logic itself is unchanged.
 *
 * MIT License — Copyright (c) 2026 tsuyatt. Port for the VFX Armory "extra" pack.
 */
import { Color } from "three";
export const ELEMENTS = {
  plain: { core: 15922943, main: 11122892, accent: 4871526, smoke: 2894896 },
  fire: { core: 16774358, main: 16742938, accent: 11739146, smoke: 2365974 },
  ice: { core: 15924223, main: 6080767, accent: 1724369, smoke: null },
  thunder: { core: 16184575, main: 9403391, accent: 3812312, smoke: null },
  wind: { core: 16056312, main: 8257476, accent: 1351802, smoke: null },
  earth: { core: 16773328, main: 14260814, accent: 7027991, smoke: 3812642 },
  water: { core: 15400191, main: 4176127, accent: 741280, smoke: null },
  light: { core: 16777215, main: 16769402, accent: 13732383, smoke: null },
  dark: { core: 15784191, main: 10173951, accent: 2754640, smoke: 853522 },
  poison: { core: 14086746, main: 7319058, accent: 3803978, smoke: 1119754 },
  arcane: { core: 16773375, main: 16735457, accent: 5971926, smoke: null }
};
const WHITE = new Color(1, 1, 1);
export function palette(element, hueShift = 0, color, coreWhite = { value: 0.1 }) {
  const e = ELEMENTS[element] ?? ELEMENTS.fire;
  const shift = (c) => hueShift ? c.offsetHSL(hueShift, 0, 0) : c;
  if (color != null) {
    const main = new Color(color);
    return { core: shift(main.clone().lerp(main.clone().lerp(WHITE, 0.82), coreWhite.value)), main: shift(main.clone()), accent: shift(main.clone().multiplyScalar(0.3)), smoke: e.smoke == null ? null : shift(new Color(e.smoke)) };
  }
  return { core: shift(new Color(e.main).lerp(new Color(e.core), coreWhite.value)), main: shift(new Color(e.main)), accent: shift(new Color(e.accent)), smoke: e.smoke == null ? null : shift(new Color(e.smoke)) };
}
