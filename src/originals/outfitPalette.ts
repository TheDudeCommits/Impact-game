import * as THREE from 'three';
import type { OutfitSwap } from '../game/economy/outfits';
import { addShaderPatch, replaceOnce } from '../render/look/shaderPatch';

/** How many parts a palette may redraw (the uniforms' length). */
export const PALETTE_PARTS = 4;

/** Each vertex's share of the head (the look's own `lookHead`, made before this) and its height up the mesh as bound (0 the
 *  lowest vertex, 1 the highest), for the parts' masks. Made once per geometry. */
export function paletteMask(geometry: THREE.BufferGeometry) {
  if (geometry.hasAttribute('outfitMask')) return;
  const position = geometry.getAttribute('position'), head = geometry.getAttribute('lookHead');
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const low = geometry.boundingBox!.min.y, span = Math.max(1e-6, geometry.boundingBox!.max.y - low);
  const mask = new Float32Array(position.count * 2);
  for (let i = 0; i < position.count; i++) { mask[i * 2] = head ? head.getX(i) : 0; mask[i * 2 + 1] = (position.getY(i) - low) / span; }
  geometry.setAttribute('outfitMask', new THREE.BufferAttribute(mask, 2));
}

/** HSV of a colour as painted (its sRGB bytes), as the shader reads the map. */
const hsv = (hex: number) => {
  const r = (hex >> 16 & 255) / 255, g = (hex >> 8 & 255) / 255, b = (hex & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d > 1e-6) h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h / 6, s: max > 0 ? d / max : 0, l: max };
};

/** The uniforms of a palette: per part, its selection, its source colour and its new one. */
export function paletteUniforms(palette: readonly OutfitSwap[]) {
  const vec = () => Array.from({ length: PALETTE_PARTS }, () => new THREE.Vector4(0, 0, 2, 2));
  const sel = vec(), sel2 = vec(), from = vec(), to = vec(), mix = vec();
  palette.slice(0, PALETTE_PARTS).forEach((part, i) => {
    const a = hsv(part.from), b = hsv(part.to), grey = a.s < .15;
    const sat = part.sat ?? (grey ? [0, .22] : [Math.max(0, a.s - .3), 1]), val = part.val ?? [0, 1], height = part.height ?? [-1, 2];
    sel[i].set(a.h, part.hue ?? (grey ? .5 : .06), sat[0], sat[1]);
    sel2[i].set(val[0], val[1], height[0], height[1]);
    from[i].set(a.h, a.s, Math.max(a.l, .02), part.on === 'all' ? 1 : part.on === 'head' ? 2 : 0);
    to[i].set(b.h, b.s, b.l, part.glow ?? 0);
    mix[i].set(part.contrast ?? 1, part.fade ?? .03, 0, 0);
  });
  return { uPaletteSel: { value: sel }, uPaletteSel2: { value: sel2 }, uPaletteFrom: { value: from }, uPaletteTo: { value: to }, uPaletteMix: { value: mix } };
}

const PARS = /* glsl */`
uniform vec4 uPaletteSel[${PALETTE_PARTS}];
uniform vec4 uPaletteSel2[${PALETTE_PARTS}];
uniform vec4 uPaletteFrom[${PALETTE_PARTS}];
uniform vec4 uPaletteTo[${PALETTE_PARTS}];
uniform vec4 uPaletteMix[${PALETTE_PARTS}];
varying vec2 vPaletteMask;
vec3 paletteHsv( vec3 c ) {
	vec4 K = vec4( 0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0 );
	vec4 p = mix( vec4( c.bg, K.wz ), vec4( c.gb, K.xy ), step( c.b, c.g ) );
	vec4 q = mix( vec4( p.xyw, c.r ), vec4( c.r, p.yzx ), step( p.x, c.r ) );
	float d = q.x - min( q.w, q.y );
	return vec3( abs( q.z + ( q.w - q.y ) / ( 6.0 * d + 1e-10 ) ), d / ( q.x + 1e-10 ), q.x );
}
vec3 paletteRgb( vec3 c ) {
	vec3 p = abs( fract( c.xxx + vec3( 1.0, 2.0 / 3.0, 1.0 / 3.0 ) ) * 6.0 - 3.0 );
	return c.z * mix( vec3( 1.0 ), clamp( p - 1.0, 0.0, 1.0 ), c.y );
}
float paletteBand( float x, float low, float high ) { return smoothstep( low - .06, low + .02, x ) * ( 1.0 - smoothstep( high - .02, high + .06, x ) ); }
`;
const RECOLOUR = /* glsl */`
	vec3 paletteGlow = vec3( 0.0 );
	{
		// Each part is found by the map's own paint (as the map paints it, before the look draws it toward its cloth's mean or
		// blurs its grain: a place's look lifted the black cloth past a part's range, so it was found in the bench and lost in a
		// fight), and redrawn from the colour as the look has it.
		vec3 paint = pow( max( diffuseColor.rgb, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) );
		vec3 hsv = paletteHsv( pow( max( paletteSource, vec3( 0.0 ) ), vec3( 1.0 / 2.2 ) ) ), shade = paletteHsv( paint ), drawn = paint;
		float taken = 0.0, head = smoothstep( .55, .9, vPaletteMask.x );
		for ( int i = 0; i < ${PALETTE_PARTS}; i ++ ) {
			vec4 sel = uPaletteSel[ i ], sel2 = uPaletteSel2[ i ], from = uPaletteFrom[ i ], to = uPaletteTo[ i ];
			float turn = abs( hsv.x - sel.x ); turn = min( turn, 1.0 - turn );
			float w = sel.y >= .5 ? 1.0 : 1.0 - smoothstep( sel.y * .6, sel.y + 1e-4, turn );
			w *= paletteBand( hsv.y, sel.z, sel.w ) * paletteBand( hsv.z, sel2.x, sel2.y );
			float fade = uPaletteMix[ i ].y;
			w *= smoothstep( sel2.z - fade, sel2.z + fade, vPaletteMask.y ) * ( 1.0 - smoothstep( sel2.w - fade, sel2.w + fade, vPaletteMask.y ) );
			w *= from.w < .5 ? 1.0 - head : ( from.w < 1.5 ? 1.0 : head );  // (head: mostly the head's - a collar half on the neck is the body's)
			w *= 1.0 - taken;
			float contrast = uPaletteMix[ i ].x;
			// (The paint's saturation varies a little round its mean, mostly the map's noise: a third of it is kept.)
			vec3 made = paletteRgb( vec3( to.x, clamp( to.y + ( shade.y - from.y ) * .35 * min( contrast, 1.0 ), 0.0, 1.0 ),
				clamp( to.z * pow( shade.z / from.z, contrast ), 0.0, 1.0 ) ) );
			drawn = mix( drawn, made, w );
			paletteGlow += pow( made, vec3( 2.2 ) ) * to.w * w;
			taken += w;
		}
		diffuseColor.rgb = pow( drawn, vec3( 2.2 ) );
	}
`;

/** Puts `palette` on a body's toon material (`mesh` its mesh, for the masks). */
export function applyOutfitPalette(mesh: THREE.Mesh, material: THREE.Material, palette: readonly OutfitSwap[]) {
  if (!palette.length) return;
  paletteMask(mesh.geometry);
  const uniforms = paletteUniforms(palette);
  addShaderPatch(material, 'outfit-palette-v1', shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = 'attribute vec2 outfitMask;\nvarying vec2 vPaletteMask;\n' + shader.vertexShader;
    shader.vertexShader = replaceOnce(shader.vertexShader, '#include <begin_vertex>', '#include <begin_vertex>\n\tvPaletteMask = outfitMask;', 'outfit palette mask');
    shader.fragmentShader = PARS + shader.fragmentShader;
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <map_fragment>', '#include <map_fragment>\n\tvec3 paletteSource = diffuseColor.rgb;', 'outfit palette source');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <alphamap_fragment>', RECOLOUR + '\n#include <alphamap_fragment>', 'outfit palette');
    shader.fragmentShader = replaceOnce(shader.fragmentShader, '#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += paletteGlow;', 'outfit palette glow');
  });
}
