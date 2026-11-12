import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { PartSpec } from '../render/signature/HourOfRuin';


export const HOUR_BELL_PAINTS: Record<string, [THREE.Color, THREE.Color]> = {
  gold: [new THREE.Color(1, .72, .18), new THREE.Color(.46, .22, .03)],
  bronze: [new THREE.Color(1, .74, .34), new THREE.Color(.3, .17, .07)],
  blackIron: [new THREE.Color(.24, .22, .26), new THREE.Color(.055, .05, .065)],
  ivory: [new THREE.Color(.94, .86, .68), new THREE.Color(.5, .42, .32)],
  ink: [new THREE.Color(.06, .045, .04), new THREE.Color(.02, .016, .016)],
};

/** The bell's section in its own metres, the outside from lip to crown and the inside from crown to lip. The lathe
 *  runs down the inside and up the outside (LatheGeometry faces outward along a path that rises), so it is a solid
 *  shell with a lip you can see into. */
const OUTSIDE: [number, number][] = [[1, 0], [1.02, .07], [.96, .2], [.86, .38], [.76, .58], [.68, .8], [.63, 1.02], [.6, 1.22], [.58, 1.36], [.53, 1.48], [.42, 1.55], [.24, 1.58], [0, 1.585]];
const INSIDE: [number, number][] = [[0, 1.47], [.36, 1.44], [.48, 1.32], [.52, 1.15], [.56, .92], [.62, .7], [.71, .48], [.81, .28], [.9, .1], [.93, 0]];
const BELL_HEIGHT = 1.585, BELL_MID = BELL_HEIGHT / 2;
/** Where the dials sit: their centre's height on the bell, and its radius there. */
const DIAL = { y: 1.0, r: .64, size: .27, tilt: Math.atan2(.68 - .6, 1.22 - .8) };

/** The bell's profile as LatheGeometry lays its v out: one step a point, INSIDE then OUTSIDE (v = index / last). */
const PROFILE = [...INSIDE, ...OUTSIDE];
/** v on the outside of the bell at a height (its own metres). */
function vOutside(y: number) {
  const base = INSIDE.length, last = PROFILE.length - 1;
  for (let i = 0; i < OUTSIDE.length - 1; i++) {
    const [, a] = OUTSIDE[i], [, b] = OUTSIDE[i + 1];
    if (y <= b) return (base + i + Math.max(0, (y - a) / (b - a))) / last;
  }
  return 1;
}

let patina: THREE.DataTexture | undefined;
export function bellPatina(): THREE.DataTexture {
  if (patina) return patina;
  const W = 256, H = 256, data = new Uint8Array(W * H * 4);
  const BRONZE: [number, number, number] = [.34, .3, .32], VERDIGRIS: [number, number, number] = [.22, .6, .75], GILT: [number, number, number] = [1, 1, 1];
  const inside = (INSIDE.length - .5) / (PROFILE.length - 1);
  // Bands of the outside, by height: [from, to] in v.
  const band = (y0: number, y1: number) => [vOutside(y0), vOutside(y1)] as const;
  const minuteRing = band(.24, .5), hourRing = band(1.16, 1.34), grooves = [band(.56, .6), band(.7, .73), band(1.4, 1.43)];
  const lipGilt = band(.0, .05), crownGilt = band(1.5, 1.53);
  // Verdigris: runs from the shoulder down the flank, each at its own place round the half, its own length and width.
  const runs = Array.from({ length: 9 }, (_, k) => ({ u: (k + .5) / 9 + .03 * Math.sin(k * 7.3), len: .35 + .3 * ((k * 37) % 10) / 10, w: .012 + .01 * ((k * 53) % 7) / 7 }));
  const top = vOutside(1.4);
  const mix = (a: number[], b: number[], t: number) => a.map((x, i) => x + (b[i] - x) * t);
  for (let j = 0; j < H; j++) {
    const v = (j + .5) / H;
    for (let i = 0; i < W; i++) {
      const u = (i + .5) / W;
      // The cast surface: a slow mottle, a little lighter and darker.
      const mottle = .88 + .07 * Math.sin(u * 23 + v * 9) * Math.sin(u * 7 - v * 31) + .05 * Math.sin(u * 61 + v * 47);
      let m = BRONZE.map(x => x * mottle);
      if (v < inside) m = m.map(x => x * .5);
      else {
        // Verdigris: strongest under the shoulder, thinning down each run; a wash over the shoulder itself.
        let green = v > top ? .45 + .2 * Math.sin(u * 40) : 0;
        for (const r of runs) {
          const du = Math.abs(u - r.u + .006 * Math.sin(v * 90)), down = top - v;
          if (down > 0 && down < r.len && du < r.w) green = Math.max(green, (1 - down / r.len) * (1 - du / r.w) * .95);
        }
        m = mix(m, VERDIGRIS, Math.min(1, green));
        for (const [a, b] of grooves) if (v >= a && v <= b) m = m.map(x => x * .32);
        if ((v >= lipGilt[0] && v <= lipGilt[1]) || (v >= crownGilt[0] && v <= crownGilt[1])) m = [...GILT];
        // The minute ring: sixty ticks round the bell (thirty a half), every fifth long, between two gilt lines.
        const [m0, m1] = minuteRing, mh = m1 - m0;
        if (v >= m0 && v <= m1) {
          const t = (v - m0) / mh, tick = (u * 30) % 1, k = Math.floor(u * 30), long = k % 5 === 0;
          if (t < .1 || t > .9) m = [...GILT];
          else if (Math.abs(tick - .5) < (long ? .16 : .09) && (long || t > .4)) m = [...GILT];
          else m = m.map(x => x * .6);
        }
        // The hour ring under the shoulder: six bars a half (the twelve hours round), each a gilt lozenge.
        const [h0, h1] = hourRing;
        if (v >= h0 && v <= h1) {
          const t = (v - h0) / (h1 - h0), x = (u * 6) % 1, d = Math.abs(x - .5) * 2 + Math.abs(t - .5) * 1.2;
          m = d < .42 ? [...GILT] : d < .5 ? m.map(x => x * .3) : m.map(x => x * .55);
        }
      }
      const o = (j * W + i) * 4;
      for (let c = 0; c < 3; c++) data[o + c] = Math.round(255 * Math.min(1, Math.max(0, m[c])) ** (1 / .7));
      data[o + 3] = 255;
    }
  }
  patina = new THREE.DataTexture(data, W, H);
  patina.wrapS = THREE.RepeatWrapping; patina.magFilter = THREE.LinearFilter; patina.minFilter = THREE.LinearMipmapLinearFilter;
  patina.generateMipmaps = true; patina.anisotropy = 4; patina.needsUpdate = true;
  return patina;
}

const mat = (x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')).setPosition(x, y, z);
const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** A box, moved into place inside a merged part. */
const box = (w: number, h: number, d: number, at: THREE.Matrix4) => new THREE.BoxGeometry(w, h, d).applyMatrix4(at);

/** Half of the bell (`side` 1: +x, -1: -x), centred on its own height so its ink hull grows evenly about the axis. */
function bellHalf(side: 1 | -1) {
  const points = [...INSIDE, ...OUTSIDE].map(([r, y]) => new THREE.Vector2(r, y - BELL_MID));
  return new THREE.LatheGeometry(points, 26, side > 0 ? 0 : Math.PI, Math.PI);
}

/** One dial's face, its marks (twelve ticks, the quarters long, and the two hands at a minute to the hour) and its
 *  gold bezel, built about the dial's centre facing +z. */
function dialParts() {
  const s = DIAL.size;
  const face = new THREE.CylinderGeometry(s, s, .035, 36).rotateX(Math.PI / 2);
  const bezel = new THREE.TorusGeometry(s + .015, .035, 6, 36);
  const marks: THREE.BufferGeometry[] = [];
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2, quarter = k % 3 === 0, len = quarter ? .085 : .045, r = s - .03 - len / 2;
    marks.push(box(quarter ? .03 : .018, len, .02, mat(Math.sin(a) * r, Math.cos(a) * r, .025, 0, 0, -a)));
  }
  // The minute hand on the hour, the hour hand at the eleventh: an hour to midnight.
  const hour = Math.PI / 6;
  marks.push(box(.026, s * .78, .02, mat(0, s * .78 / 2 - .02, .03)));
  marks.push(box(.04, s * .5, .02, mat(-Math.sin(hour) * s * .25, Math.cos(hour) * s * .25, .034, 0, 0, hour)));
  marks.push(new THREE.CylinderGeometry(.035, .035, .03, 12).rotateX(Math.PI / 2).translate(0, 0, .04));
  return { face, bezel, marks: mergeGeometries(marks.map(g => g.toNonIndexed()))! };
}

/** The parts, in the bell's own metres (it is drawn 1.5x like the roller it stands in for), each built centred. */
export function hourBellParts(): PartSpec[] {
  const parts: PartSpec[] = [];
  const add = (geometry: THREE.BufferGeometry, paint: string, at: THREE.Matrix4, fly: THREE.Vector3, spin: THREE.Vector3) =>
    parts.push({ geometry, paint: paint as PartSpec['paint'], at, fly, spin });
  // The bell, in two halves that fall apart to the sides when it cracks.
  add(bellHalf(1), 'bronze', mat(0, BELL_MID, 0), v(3.2, 2.6, .3), v(0, .6, -2.6));
  add(bellHalf(-1), 'bronze', mat(0, BELL_MID, 0), v(-3.2, 2.4, -.3), v(0, -.5, 2.6));
  // Gilt bands: the sound bow and the shoulder.
  const bands = mergeGeometries([
    new THREE.TorusGeometry(.955, .045, 6, 48).rotateX(Math.PI / 2).translate(0, .2 - .4, 0),
    new THREE.TorusGeometry(.565, .04, 6, 40).rotateX(Math.PI / 2).translate(0, 1.36 - .4, 0),
  ].map(g => g.toNonIndexed()))!;
  add(bands, 'gold', mat(0, .4, 0), v(0, 4.4, 0), v(1.2, 0, -.8));
  // The crown's loop and the headstock it hung from, torn out of the belfry with its straps.
  add(new THREE.TorusGeometry(.17, .055, 8, 20), 'gold', mat(0, BELL_HEIGHT + .12, 0), v(.6, 6.6, -.4), v(3, 1, 2));
  const headstock = mergeGeometries([
    box(1.56, .2, .3, mat(0, 0, 0)),
    box(.09, .46, .26, mat(.36, -.25, 0, 0, 0, .32)), box(.09, .46, .26, mat(-.36, -.25, 0, 0, 0, -.32)),
    box(.24, .26, .36, mat(.8, 0, 0)), box(.24, .26, .36, mat(-.8, 0, 0)),
  ].map(g => g.toNonIndexed()))!;
  add(headstock, 'blackIron', mat(0, BELL_HEIGHT + .24, 0), v(-.8, 7.4, -1.2), v(-2.4, 2, 3));
  // The tower's gilded finial on the headstock: the top of it all, 2.15 m.
  const finial = mergeGeometries([
    new THREE.SphereGeometry(.09, 12, 8).translate(0, -.12, 0),
    new THREE.ConeGeometry(.08, .26, 10).translate(0, .06, 0),
  ].map(g => g.toNonIndexed()))!;
  add(finial, 'gold', mat(0, 1.97, 0), v(1.2, 9, .6), v(5, 0, 4));
  // The clapper, hanging inside: it rolls out from under the wreck.
  const clapper = mergeGeometries([
    new THREE.CylinderGeometry(.035, .035, 1, 8).translate(0, .3, 0),
    new THREE.SphereGeometry(.17, 14, 10).translate(0, -.2, 0),
  ].map(g => g.toNonIndexed()))!;
  add(clapper, 'blackIron', mat(0, .52, 0), v(.4, 1.4, 4.2), v(8, 0, 1));
  // Four dials round the waist, one each way, leaning back with the bell's flank; each spins off on its own.
  const dial = dialParts();
  for (let k = 0; k < 4; k++) {
    const yaw = k * Math.PI / 2, out = v(Math.sin(yaw), 0, Math.cos(yaw));
    const at = mat(out.x * (DIAL.r + .01), DIAL.y, out.z * (DIAL.r + .01), -DIAL.tilt, yaw, 0);
    const fly = out.clone().multiplyScalar(4.2).setY(3.4), spin = v(out.z * 7, 2, -out.x * 7);
    add(dial.face, 'ivory', at, fly, spin);
    add(dial.marks, 'ink', at, fly, spin);
    add(dial.bezel, 'gold', at, fly, spin);
  }
  return parts;
}

export const ORIGINAL_FINISHER_PROP = { parts: hourBellParts, paints: HOUR_BELL_PAINTS, maps: { bronze: bellPatina } as Record<string, () => THREE.Texture>, fetch: false } as const;
