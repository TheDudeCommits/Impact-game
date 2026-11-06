import * as THREE from 'three';
import type { Fighter } from '../render/Fighter';
import type { MoveStage, StageLook } from '../render/signature/MoveStage';
import type { CombatEvent } from '../game/types';
import { originalBody } from './launch';
import { RIBBON_PLAN, type ClipRibbons, type RibbonKey } from './rakuchoRibbonPlan';

export const RAKUCHO = originalBody('rakucho');

/** Sections along a drawn ribbon (SEG + 1 cross-sections), points of a hanging end. */
const SEG = 30, TAIL = 7;
/** Each ribbon's torn end at rest (metres), its width, and where it is bound: 0/1 the right/left forearm, 2/3 the waist. */
const TAIL_LEN = [.3, .3, .26, .26] as const, WIDTH = [.15, .15, .13, .13] as const;
/** The trail walks the tip's track back in steps of HIST seconds, at most HIST_MAX of them. */
const HIST = 1 / 120, HIST_MAX = 90;
/** How long a clip change blends the ribbons from where they were (seconds). */
const BLEND = .12;
const UP = new THREE.Vector3(0, 1, 0);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (a: number, b: number, v: number) => { const u = clamp01((v - a) / (b - a)); return u * u * (3 - 2 * u); };

type Rib = {
  mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshToonMaterial>;
  /** The centreline drawn this frame (world), SEG + 1 points, its length, and its sections' distance from the root. */
  line: Float32Array; arc: Float32Array; len: number;
  /** The centreline when the clip changed, blended out over BLEND. */
  from: Float32Array; hasFrom: boolean;
  /** The hanging end's spring chain (world): positions and last positions. */
  p: Float32Array; q: Float32Array; tailOk: boolean;
  drive: number; glow: number; tip: THREE.Vector3; tipLive: boolean;
  /** The binding's side axis, for the ribbon's own lie. */
  side: THREE.Vector3;
};
type Body = { id: string; owner: RakuchoRibbons; ribs: Rib[]; clip?: string; t: number; blend: number; seen: number; aim: THREE.Vector3; scale: number };
const BODIES = new Map<string, Body>();
/** TORN BINDING, his area move: the circle let go (its centre, when its strike lands) and, once it lands, on whom. */
type Area = { born: number; due: number; at: THREE.Vector3; victim?: string; struck?: number };
/** How long the bound victim stays wound after the strike, and the ribbons wind home after (seconds). */
const BOUND = .75, UNBIND = 1.1;
/** From the area cast: the circle let go at the end of its clip (0.6 s), its strike 1.2 s in (filmed, 6 November). */
const AREA_RELEASE = .55, AREA_STRIKE = 1.2;

const TAIL_JOINT = /^Tendrils([1-4])_8$/;
/** Where the ribbon standing in for `joint` has its tip now, for the strike socket (rakuchoContactPoint): false while that
 *  ribbon is not out, and the socket reads what it did before (his hand). */
export function rakuchoTip(f: { shownBody?: { state?: { id?: string } } }, joint: string, out: THREE.Vector3): boolean {
  if (!RAKUCHO) return false;
  const m = TAIL_JOINT.exec(joint), id = f.shownBody?.state?.id; if (!m || id === undefined) return false;
  const rib = BODIES.get(id)?.ribs[Number(m[1]) - 1];
  if (!rib?.tipLive) return false;
  out.copy(rib.tip); return true;
}

export function rakuchoRibbonsOn(f: { state?: { id?: string } }): boolean { return RAKUCHO && f.state?.id !== undefined && BODIES.has(f.state.id); }

/** The plan for the clip as this move plays it: `area:<clip>` (and the like) before the clip's own. */
export function ribbonPlan(clip: string | undefined, action: string): ClipRibbons | undefined {
  if (!clip) return undefined;
  return RIBBON_PLAN[`${action}:${clip}`] ?? RIBBON_PLAN[clip];
}
const S = { reveal: 0, aim: 0, trail: .5 };
/** A track at `t`: the tip (fighter frame) in `out`, its reveal, aim and trail in S. A cubic through the keys, its
 *  tangents Catmull-Rom's on their own times, eased to rest at the first and last key. */
export function sampleTrack(keys: readonly RibbonKey[], t: number, out: THREE.Vector3): typeof S {
  const n = keys.length, first = keys[0], last = keys[n - 1];
  const set = (k: RibbonKey) => { out.set(k[1], k[2], k[3]); S.reveal = k[4]; S.aim = k[5] ?? 0; S.trail = k[6] ?? .5; return S; };
  if (n === 1 || t <= first[0]) return set(first);
  if (t >= last[0]) return set(last);
  let i = 0; while (i < n - 2 && t >= keys[i + 1][0]) i++;
  const a = keys[i], b = keys[i + 1], h = b[0] - a[0], u = (t - a[0]) / h, u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  const p = i > 0 ? keys[i - 1] : undefined, q = i + 2 < n ? keys[i + 2] : undefined;
  const ta = (c: 1 | 2 | 3) => p ? (b[c] - p[c]) / (b[0] - p[0]) * h : 0, tb = (c: 1 | 2 | 3) => q ? (q[c] - a[c]) / (q[0] - a[0]) * h : 0;
  out.set(h00 * a[1] + h10 * ta(1) + h01 * b[1] + h11 * tb(1), h00 * a[2] + h10 * ta(2) + h01 * b[2] + h11 * tb(2), h00 * a[3] + h10 * ta(3) + h01 * b[3] + h11 * tb(3));
  const e = u2 * (3 - 2 * u);
  S.reveal = a[4] + (b[4] - a[4]) * e; S.aim = (a[5] ?? 0) + ((b[5] ?? 0) - (a[5] ?? 0)) * u; S.trail = (a[6] ?? .5) + ((b[6] ?? .5) - (a[6] ?? .5)) * u;
  return S;
}

// --- the paint: crimson silk inked at its edges, torn into a cream page with crimson ink -----------------------------------
/** The strip's texture (u across, v along: 0..0.7 the silk, 0.75..1 its torn end) and the glow map beside it. */
function paint(): { map: THREE.Texture; glow: THREE.Texture } {
  const W = 64, H = 512;
  const make = () => { const c = typeof document !== 'undefined' ? document.createElement('canvas') : undefined; if (c) { c.width = W; c.height = H; } return c; };
  const ca = make(), cb = make(), g = ca?.getContext('2d'), e = cb?.getContext('2d');
  if (!ca || !cb || !g || !e) {
    const solid = (r: number, gg: number, b: number) => { const t = new THREE.DataTexture(new Uint8Array([r, gg, b, 255]), 1, 1); t.needsUpdate = true; return t; };
    return { map: solid(176, 18, 44), glow: solid(200, 40, 60) };
  }
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  // v (0 at the root, 1 at the tip) -> canvas y (flipY: v = 1 is the top row).
  const Y = (v: number) => (1 - v) * H;
  // The silk: a deep crimson, a sheen down one side of it, inked edges.
  const silk = (ctx: CanvasRenderingContext2D, y0: number, y1: number, glowing: boolean) => {
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    if (glowing) { grad.addColorStop(0, '#2a0006'); grad.addColorStop(.12, '#c02038'); grad.addColorStop(.32, '#ff6a7a'); grad.addColorStop(.5, '#d02a40'); grad.addColorStop(.88, '#a01028'); grad.addColorStop(1, '#2a0006'); }
    else { grad.addColorStop(0, '#14030a'); grad.addColorStop(.1, '#3c0612'); grad.addColorStop(.17, '#7c0c20'); grad.addColorStop(.3, '#b52238'); grad.addColorStop(.4, '#951429'); grad.addColorStop(.72, '#7a0c20'); grad.addColorStop(.84, '#560818'); grad.addColorStop(.9, '#2c050e'); grad.addColorStop(1, '#14030a'); }
    ctx.fillStyle = grad; ctx.fillRect(0, y0, W, y1 - y0);
    if (!glowing) { ctx.fillStyle = 'rgba(12,2,4,.95)'; ctx.fillRect(0, y0, 5, y1 - y0); ctx.fillRect(W - 5, y0, 5, y1 - y0); ctx.fillStyle = 'rgba(255,170,180,.12)'; ctx.fillRect(Math.round(W * .3), y0, 2, y1 - y0); }
  };
  g.clearRect(0, 0, W, H); e.clearRect(0, 0, W, H);
  // Silk from the root to just past the tear.
  silk(g, Y(.84), H, false); silk(e, Y(.84), H, true);
  // The tear: a ragged line across the silk at v ~ 0.80-0.84, above it the page.
  const tear: [number, number][] = []; for (let x = 0; x <= W; x += 4) tear.push([x, Y(.8 + .035 * rnd())]);
  // The page: cream, two tatters (a long one on the left, a shorter on the right) with a notch between, jagged edges.
  const page = new Path2D(); page.moveTo(0, tear[0][1]); for (const [x, y] of tear) page.lineTo(x, y);
  const edge = (x0: number, x1: number, top: number) => { const n = 8; for (let i = 0; i <= n; i++) page.lineTo(x0 + (x1 - x0) * i / n, top + (rnd() - .5) * 10 + (i % 2 ? 6 : 0)); };
  page.lineTo(W, Y(.9)); page.lineTo(W - 2, Y(.95));
  edge(W - 2, W * .58, Y(.965)); page.lineTo(W * .5, Y(.9)); edge(W * .46, 3, Y(.995)); page.lineTo(0, Y(.93)); page.closePath();
  g.save(); g.clip(page);
  const pg = g.createLinearGradient(0, Y(1), 0, Y(.8)); pg.addColorStop(0, '#f4ecd8'); pg.addColorStop(1, '#e6d8bc'); g.fillStyle = pg; g.fillRect(0, 0, W, Y(.78));
  // Its print: thin grey lines of text, broken into words.
  g.fillStyle = 'rgba(70,58,48,.55)';
  for (let y = Y(.995); y < Y(.8); y += 7) { let x = 6; while (x < W - 6) { const w = 4 + rnd() * 12; g.fillRect(x, y, Math.min(w, W - 6 - x), 1.6); x += w + 3 + rnd() * 3; } }
  // Crimson ink where the silk bled into it, and a few blots.
  g.fillStyle = 'rgba(150,10,30,.85)'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(rnd() * W, Y(.82 + rnd() * .16), 2 + rnd() * 6, 0, Math.PI * 2); g.fill(); }
  const bleed = g.createLinearGradient(0, Y(.86), 0, Y(.8)); bleed.addColorStop(0, 'rgba(150,10,30,0)'); bleed.addColorStop(1, 'rgba(150,10,30,.8)'); g.fillStyle = bleed; g.fillRect(0, Y(.86), W, Y(.8) - Y(.86));
  g.restore();
  g.strokeStyle = 'rgba(30,14,10,.95)'; g.lineWidth = 2; g.stroke(page);
  // The glow map: the silk burns, the page barely (its ink a little).
  e.save(); e.clip(page); e.fillStyle = '#1a0a08'; e.fillRect(0, 0, W, Y(.78)); e.restore();
  const tex = (c: HTMLCanvasElement, srgb: boolean) => { const t = new THREE.CanvasTexture(c); t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.anisotropy = 4; t.needsUpdate = true; return t; };
  return { map: tex(ca, true), glow: tex(cb, true) };
}
let PAINT: { map: THREE.Texture; glow: THREE.Texture; users: number } | undefined;
let TOON: THREE.DataTexture | undefined;
function toon() {
  if (TOON) return TOON;
  TOON = new THREE.DataTexture(new Uint8Array([110, 155, 203, 255]), 4, 1, THREE.RedFormat);
  TOON.minFilter = TOON.magFilter = THREE.NearestFilter; TOON.generateMipmaps = false; TOON.colorSpace = THREE.NoColorSpace; TOON.needsUpdate = true;
  return TOON;
}

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();
const _t = new THREE.Vector3(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _n = new THREE.Vector3(), _cam = new THREE.Vector3(), _w = new THREE.Vector3();
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion();

export class RakuchoRibbons {
  private last = -1;
  /** The guide polyline (bridge + trail, world) and its lengths, for one ribbon at a time. */
  private gp = new Float32Array((14 + HIST_MAX + 2) * 3); private gl = new Float32Array(14 + HIST_MAX + 2); private gn = 0;
  private tl = new Float32Array((SEG + 1) * 3);
  /** The trail's points, tip first (world). */
  private tp = new Float32Array((HIST_MAX + 1) * 3);
  private anchor = [0, 1, 2, 3].map(() => new THREE.Vector3()); private root = [0, 1, 2, 3].map(() => new THREE.Vector3()); private sides = [0, 1, 2, 3].map(() => new THREE.Vector3());
  private frame = new THREE.Matrix4(); private aimWant = new THREE.Vector3();
  private areas = new Map<string, Area>();
  /** The keys standing for the area binding (its first time the circle's release), and the ribbon it is drawn for. */
  private areaKeys: RibbonKey[] = [[0, 0, 0, 0, 1]]; private areaOn?: Area; private areaI = 0; private areaCentre = new THREE.Vector3();
  constructor(private readonly scene: THREE.Scene) {}

  /** TORN BINDING: his area circle let go (its centre and when its strike lands), and the body its strike lands on. */
  handle(e: CombatEvent) {
    if (e.fighter !== 'rakucho' || e.slot !== 'area') return;
    if (e.kind === 'release' && e.endpoint) this.areas.set(e.actorId, { born: e.serverTime, due: e.due ?? e.serverTime + .6, at: new THREE.Vector3(e.endpoint.x, e.endpoint.y, e.endpoint.z) });
    else if (e.kind === 'hit' && e.targetId) { const a = this.areas.get(e.actorId); if (a && a.struck === undefined) { a.victim = e.targetId; a.struck = Math.max(a.born + .25, e.serverTime); } }
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, st?: MoveStage, look?: StageLook) {
    const dt = this.last < 0 ? 1 / 60 : Math.max(0, Math.min(.05, time - this.last)); this.last = time;
    for (const f of fighters.values()) {
      // (A body this module can draw on: its shown body, its joints and its frame - a fighter a test stands in with is skipped.)
      if (f.state?.fighter !== 'rakucho' || !f.group || !f.shownBody?.model || !f.shownBody.joints) continue;
      let b = BODIES.get(f.state.id);
      if (b && b.owner !== this) continue;
      if (!b) { b = this.create(f.state.id); BODIES.set(f.state.id, b); }
      b.seen = time;
      this.pose(f, b, time, dt, fighters, st, look);
    }
    for (const [id, b] of BODIES) if (b.owner === this && b.seen !== time) { this.drop(b); BODIES.delete(id); }
  }

  private create(id: string): Body {
    if (!PAINT) PAINT = { ...paint(), users: 0 };
    PAINT.users++;
    const ribs: Rib[] = [];
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array((SEG + 1) * 2 * 3), nor = new Float32Array((SEG + 1) * 2 * 3), uv = new Float32Array((SEG + 1) * 2 * 2), index: number[] = [];
      for (let j = 0; j < SEG; j++) { const a = 2 * j; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      for (let j = 0; j <= SEG; j++) { uv[4 * j] = 0; uv[4 * j + 2] = 1; }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2).setUsage(THREE.DynamicDrawUsage));
      geo.setIndex(index);
      const mat = new THREE.MeshToonMaterial({ map: PAINT.map, emissiveMap: PAINT.glow, emissive: new THREE.Color(1, .16, .24), emissiveIntensity: .12, gradientMap: toon(), side: THREE.DoubleSide, alphaTest: .5 });
      mat.name = 'rakucho-ribbon';
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = `rakucho-ribbon-${id}-${i}`; mesh.frustumCulled = false; mesh.matrixAutoUpdate = false; mesh.visible = false; mesh.renderOrder = 1;
      const rib: Rib = { mesh, line: new Float32Array((SEG + 1) * 3), arc: new Float32Array(SEG + 1), len: 0, from: new Float32Array((SEG + 1) * 3), hasFrom: false,
        p: new Float32Array(TAIL * 3), q: new Float32Array(TAIL * 3), tailOk: false, drive: 0, glow: 0, tip: new THREE.Vector3(), tipLive: false, side: new THREE.Vector3(1, 0, 0) };
      mesh.onBeforeRender = (_r, _scene, camera) => this.strip(rib, i, camera);
      this.scene.add(mesh);
      ribs.push(rib);
    }
    return { id, owner: this, ribs, t: 0, blend: 1, seen: 0, aim: new THREE.Vector3(), scale: 1 };
  }

  /** Where each ribbon is bound on the body drawn now, the way it leaves the binding, and its side axis (world). */
  private bind(f: Fighter): boolean {
    const shown = f.shownBody, J = (name: string) => shown.joints.get(name) ?? shown.bones.get(name);
    const fr = J('RightForeArm'), hr = J('RightHand'), fl = J('LeftForeArm'), hl = J('LeftHand'), hips = J('Hips'), sp = J('Spine1') ?? J('Spine2'), ur = J('RightUpLeg'), ul = J('LeftUpLeg');
    if (!fr || !hr || !fl || !hl || !hips || !sp || !ur || !ul) return false;
    // The forearms: 0.58 of the way from the elbow to the wrist, the ribbon leaving toward the hand.
    for (const [i, fa, ha] of [[0, fr, hr], [1, fl, hl]] as const) {
      fa.getWorldPosition(_a); ha.getWorldPosition(_b);
      this.root[i].subVectors(_b, _a); const len = this.root[i].length(); this.root[i].divideScalar(Math.max(1e-4, len));
      this.anchor[i].copy(_a).addScaledVector(this.root[i], len * .58);
      this.sides[i].copy(UP).cross(this.root[i]); if (this.sides[i].lengthSq() < 1e-4) this.sides[i].set(1, 0, 0); this.sides[i].normalize();
    }
    // The waist: the pelvis's own frame from the hips, the spine and the thighs, the ribbon leaving forward and out.
    hips.getWorldPosition(_a); sp.getWorldPosition(_b); ur.getWorldPosition(_c); ul.getWorldPosition(_d);
    const up = _b.sub(_a).normalize(), right = _c.sub(_d); right.addScaledVector(up, -right.dot(up)).normalize();
    const fwd = _e.copy(up).cross(right).normalize();
    for (const [i, s] of [[2, 1], [3, -1]] as const) {
      this.anchor[i].copy(_a).addScaledVector(up, .13 * this.scaleNow).addScaledVector(fwd, .11 * this.scaleNow).addScaledVector(right, .1 * s * this.scaleNow);
      this.root[i].copy(fwd).multiplyScalar(.75).addScaledVector(right, .5 * s).addScaledVector(up, -.35).normalize();
      this.sides[i].copy(up);
    }
    return true;
  }
  private scaleNow = 1;

  private pose(f: Fighter, b: Body, time: number, dt: number, fighters: ReadonlyMap<string, Fighter>, st?: MoveStage, look?: StageLook) {
    const s = f.state, shown = f.shownBody;
    const visible = f.group.visible && shown.model.visible && shown.group.visible !== false;
    f.group.updateWorldMatrix(true, false);
    b.scale = this.scaleNow = f.group.getWorldScale(_w).x || 1;
    if (!visible || !this.bind(f)) { for (const r of b.ribs) { r.mesh.visible = false; r.tipLive = false; r.tailOk = false; } return; }
    this.frame.copy(f.group.matrixWorld);
    let clip = shown.displayedClipName, t = shown.displayedClipTime, plan = ribbonPlan(clip, s.action);
    // Torn Binding, from the circle's release until the ribbons are home, unless he has begun another blow. (The area slot's
    // cast and release are areaFx's alone and never reach a fighter's module; its hits do. So the binding opens on the cast:
    // the circle goes down at the end of the cast clip, AREA_RELEASE in, where he aims it - the one he is locked on, else
    // ahead - and strikes AREA_STRIKE after the cast unless its hit says when.)
    if (s.action === 'area' && !this.areas.has(s.id)) {
      const lock = s.target ? fighters.get(s.target) : undefined;
      if (lock?.state.alive) lock.group.getWorldPosition(_a); else _a.set(0, 0, 3).applyMatrix4(this.frame);
      this.areas.set(s.id, { born: time + AREA_RELEASE, due: time + AREA_STRIKE, at: _a.clone(), victim: lock?.state.alive ? lock.state.id : undefined });
    }
    let area = this.areas.get(s.id);
    if (area && (time > (area.struck ?? area.due) + UNBIND || time > area.due + 1 || s.action === 'light' || s.action === 'heavy' || s.action === 'special' || s.action === 'ultimate' || s.action === 'awaken')) { this.areas.delete(s.id); area = undefined; }
    if (area && time < area.born) area = undefined;
    if (area) {
      const v = area.victim ? fighters.get(area.victim) : undefined;
      if (v?.state.alive) { v.group.getWorldPosition(this.areaCentre); this.areaCentre.y += 1 * (v.group.getWorldScale(_w).x || 1); }
      else this.areaCentre.copy(area.at).setY(area.at.y + 1);
      this.areaKeys[0] = [area.born, 0, 0, 0, 1]; clip = `area@${area.born}`; t = time; plan = undefined;
    }
    this.areaOn = area;
    // A new clip (or the same one begun again): blend from what was drawn.
    if (clip !== b.clip || t < b.t - .05) { for (const r of b.ribs) { r.from.set(r.line); r.hasFrom = r.len > 0; } b.blend = 0; }
    b.clip = clip; b.t = t; b.blend = Math.min(BLEND, b.blend + dt);
    const tau = plan || area ? t : 0;
    // Where the victim stands against where the plan has them (fighter frame), eased so a hit key leans to them.
    this.aimWant.set(0, 0, 0);
    const victim = s.target ? fighters.get(s.target) : undefined;
    if (plan?.hit && victim?.state.alive) {
      victim.group.getWorldPosition(_a); _a.y += 1.02 * (victim.group.getWorldScale(_w).x || 1);
      _m.copy(this.frame).invert(); _a.applyMatrix4(_m);
      if (_a.z > .3 && Math.hypot(_a.x, _a.z) < 6.2) { this.aimWant.set(_a.x - plan.hit[0], _a.y - plan.hit[1], _a.z - plan.hit[2]); if (this.aimWant.length() > 1.7) this.aimWant.setLength(1.7); }
    }
    b.aim.lerp(this.aimWant, 1 - Math.exp(-14 * dt));
    for (let i = 0; i < 4; i++) {
      const r = b.ribs[i], keys = area ? this.areaKeys : plan?.ribs[i] ?? null;
      this.areaI = i;
      let reveal = 0, speed = 0;
      if (keys) {
        const tip = this.tipAt(keys, tau, b, _v), trail = S.trail;
        reveal = S.reveal;
        // How fast the tip runs (its own track, so the glow is the move's, not the camera's or the dash's).
        this.tipAt(keys, tau - 1 / 60, b, _s); speed = _s.distanceTo(tip) * 60 / b.scale;
        this.guide(keys, tau, b, i, trail * b.scale);
      }
      const drive = keys ? smooth(.17, .36, reveal) : 0;
      r.drive += (drive - r.drive) * (1 - Math.exp(-30 * dt));
      // The driven ribbon: the guide unwound to `reveal` of its length (never shorter than its torn end at rest).
      if (r.drive > .002 && keys) this.resample(this.gp, this.gl, this.gn, Math.max(TAIL_LEN[i] * b.scale, reveal * this.gl[this.gn - 1]), this.tl);
      // The hanging end, sprung from the binding (kept on the driven ribbon while it is out, so it falls from there).
      this.tail(r, i, dt, time, b.scale, keys && r.drive > .6 ? this.tl : undefined);
      const line = r.line;
      for (let j = 0; j <= SEG; j++) {
        const u = j / SEG, k = Math.min(TAIL - 1 - 1e-6, u * (TAIL - 1)), k0 = Math.floor(k), w = k - k0;
        for (let c = 0; c < 3; c++) {
          const hang = r.p[3 * k0 + c] + (r.p[3 * k0 + 3 + c] - r.p[3 * k0 + c]) * w;
          line[3 * j + c] = r.drive > .002 && keys ? hang + (this.tl[3 * j + c] - hang) * r.drive : hang;
        }
      }
      // Its life: a slow ripple along it, none at the binding or the tip, little while it strikes.
      const amp = .03 * b.scale * (1 - .7 * r.glow);
      for (let j = 1; j < SEG; j++) {
        const u = j / SEG; _t.set(line[3 * j + 3] - line[3 * j - 3], line[3 * j + 4] - line[3 * j - 2], line[3 * j + 5] - line[3 * j - 1]);
        _n.crossVectors(_t, UP); if (_n.lengthSq() < 1e-8) _n.set(1, 0, 0); _n.normalize();
        const wave = Math.sin(Math.PI * u) * amp * Math.sin(Math.PI * 2 * (1.3 * u - 1.6 * time) + i * 1.7);
        line[3 * j] += _n.x * wave; line[3 * j + 1] += _n.y * wave; line[3 * j + 2] += _n.z * wave;
      }
      if (r.hasFrom && b.blend < BLEND) { const e = smooth(0, BLEND, b.blend); for (let c = 0; c < line.length; c++) line[c] = r.from[c] + (line[c] - r.from[c]) * e; }
      // Lengths along it, the tip, the glow.
      let L = 0; r.arc[0] = 0;
      for (let j = 1; j <= SEG; j++) { L += Math.hypot(line[3 * j] - line[3 * j - 3], line[3 * j + 1] - line[3 * j - 2], line[3 * j + 2] - line[3 * j - 1]); r.arc[j] = L; }
      r.len = L; r.tip.set(line[3 * SEG], line[3 * SEG + 1], line[3 * SEG + 2]); r.tipLive = r.drive > .5;
      const glowWant = keys ? smooth(3.5, 10, speed) * r.drive : 0;
      r.glow += (glowWant - r.glow) * (1 - Math.exp(-(glowWant > r.glow ? 40 : 7) * dt));
      r.mesh.material.emissiveIntensity = .12 + .7 * r.glow;
      r.mesh.userData.scale = b.scale; r.mesh.visible = true;
      if (st && look && r.glow > .08) this.burn(st, look, r, b.scale);
    }
  }

  /** A ribbon's tip at plan time `tau` (world), its reveal, aim and trail in S. */
  private tipAt(keys: readonly RibbonKey[], tau: number, b: Body, out: THREE.Vector3) {
    if (keys === this.areaKeys && this.areaOn) return this.areaTip(this.areaOn, this.areaI, tau, out);
    sampleTrack(keys, tau, out);
    if (S.aim > 0) out.addScaledVector(b.aim, S.aim);
    return out.applyMatrix4(this.frame);
  }

  /** TORN BINDING (world): from the circle's release the ribbon climbs out of him and circles high over the sigil, coming
   *  down round it as the strike nears; as it lands it winds round the struck body (or the sigil's heart) and draws tight,
   *  holds it bound a beat, then lets go and winds home. Its reveal and trail in S. */
  private areaTip(a: Area, i: number, tau: number, out: THREE.Vector3) {
    const T = Math.max(.25, (a.struck ?? a.due) - a.born), u = tau - a.born, C = this.areaCentre, phase = i * Math.PI / 2 + .4;
    S.aim = 0;
    if (u < T) {
      const k = smooth(0, T, u), e = smooth(0, .3, u), ang = phase + u * 2.2, r = 1 - .45 * k, h = 1.5 - .7 * k;
      _e.set(C.x + Math.cos(ang) * r, C.y + h, C.z + Math.sin(ang) * r);
      out.copy(this.anchor[i]).addScaledVector(this.root[i], .3 * this.scaleNow).lerp(_e, e);
      S.reveal = .3 + .7 * e; S.trail = 1.2 * this.scaleNow; return out;
    }
    const w = u - T, k = smooth(0, .22, w), ang = phase + T * 2.2 + Math.PI * 2 * 1.6 * k, r = .55 - .27 * k, h = .8 + (-.45 + .3 * i - .8) * k;
    out.set(C.x + Math.cos(ang) * r, C.y + h, C.z + Math.sin(ang) * r);
    S.reveal = 1 - .85 * smooth(BOUND, UNBIND, w); S.trail = 2.6 * this.scaleNow; return out;
  }

  /** The guide for ribbon `i`: the path its tip has run back over `trail` metres, bridged to its binding (world), into
   *  gp/gl/gn. */
  private guide(keys: readonly RibbonKey[], tau: number, b: Body, i: number, trail: number) {
    const gp = this.gp, A = this.anchor[i], D = this.root[i];
    const t0 = keys[0][0];
    // The trail, from the tip back.
    const tip = this.tipAt(keys, tau, b, _a), trailPts = this.tp;
    let n = 0; const push = (v: THREE.Vector3) => { gp[3 * n] = v.x; gp[3 * n + 1] = v.y; gp[3 * n + 2] = v.z; n++; };
    trailPts[0] = tip.x; trailPts[1] = tip.y; trailPts[2] = tip.z;
    let acc = 0, m = 1; _b.copy(tip);
    for (let k = 1; k <= HIST_MAX && acc < trail; k++) {
      const tk = tau - k * HIST; if (tk < t0) break;
      this.tipAt(keys, tk, b, _c); const d = _c.distanceTo(_b); if (d < .004) continue;
      acc += d; trailPts[3 * m] = _c.x; trailPts[3 * m + 1] = _c.y; trailPts[3 * m + 2] = _c.z; m++; _b.copy(_c);
    }
    const E = _c.set(trailPts[3 * m - 3], trailPts[3 * m - 2], trailPts[3 * m - 1]);
    // Its way at E, toward the tip.
    const dE = _d.set(0, 0, 0);
    if (m > 1) dE.set(trailPts[3 * m - 6] - E.x, trailPts[3 * m - 5] - E.y, trailPts[3 * m - 4] - E.z);
    if (dE.lengthSq() < 1e-8) dE.subVectors(E, A);
    dE.normalize();
    // The bridge from the binding to E: leaving along the binding's way, arriving along the trail's.
    const span = A.distanceTo(E);
    if (span > .02) {
      _e.subVectors(E, A).normalize();
      const m0 = _t.copy(D).multiplyScalar(.55).addScaledVector(_e, .45).normalize().multiplyScalar(span), m1 = _s.copy(dE).multiplyScalar(span * .8);
      const steps = 12;
      for (let k = 0; k < steps; k++) {
        const u = k / steps, u2 = u * u, u3 = u2 * u, h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
        _n.set(h00 * A.x + h10 * m0.x + h01 * E.x + h11 * m1.x, h00 * A.y + h10 * m0.y + h01 * E.y + h11 * m1.y, h00 * A.z + h10 * m0.z + h01 * E.z + h11 * m1.z);
        push(_n);
      }
    } else push(A);
    for (let k = m - 1; k >= 0; k--) { _n.set(trailPts[3 * k], trailPts[3 * k + 1], trailPts[3 * k + 2]); push(_n); }
    // Lengths.
    let L = 0; this.gl[0] = 0;
    for (let k = 1; k < n; k++) { L += Math.hypot(gp[3 * k] - gp[3 * k - 3], gp[3 * k + 1] - gp[3 * k - 2], gp[3 * k + 2] - gp[3 * k - 1]); this.gl[k] = L; }
    if (n === 1) { gp[3] = gp[0]; gp[4] = gp[1] - .01; gp[5] = gp[2]; this.gl[1] = .01; n = 2; }
    this.gn = n;
  }

  /** SEG + 1 points evenly along a polyline (points `p`, lengths `l`, count `n`) over its first `upto` metres, into `out`. */
  private resample(p: Float32Array, l: Float32Array, n: number, upto: number, out: Float32Array) {
    const total = l[n - 1]; upto = Math.min(upto, total);
    let k = 1;
    for (let j = 0; j <= SEG; j++) {
      const at = upto * j / SEG;
      while (k < n - 1 && l[k] < at) k++;
      const seg = Math.max(1e-6, l[k] - l[k - 1]), w = clamp01((at - l[k - 1]) / seg);
      for (let c = 0; c < 3; c++) out[3 * j + c] = p[3 * (k - 1) + c] + (p[3 * k + c] - p[3 * (k - 1) + c]) * w;
    }
  }

  /** The torn end's spring chain: pinned at the binding and leaving along its way, the rest hanging, swinging and
   *  fluttering; laid on `follow` (the driven ribbon's start) while that is out. */
  private tail(r: Rib, i: number, dt: number, time: number, scale: number, follow?: Float32Array) {
    const p = r.p, q = r.q, A = this.anchor[i], D = this.root[i], seg = TAIL_LEN[i] * scale / (TAIL - 1);
    if (follow) {
      // The driven ribbon's first TAIL_LEN, point for point (its first sections are spaced by the drawn length / SEG).
      let L = 0; const want = TAIL_LEN[i] * scale; let k = 0; p[0] = follow[0]; p[1] = follow[1]; p[2] = follow[2];
      for (let j = 1; j <= SEG && k < TAIL - 1; j++) {
        const d = Math.hypot(follow[3 * j] - follow[3 * j - 3], follow[3 * j + 1] - follow[3 * j - 2], follow[3 * j + 2] - follow[3 * j - 1]);
        while (k < TAIL - 1 && L + d >= want * (k + 1) / (TAIL - 1)) { const w = (want * (k + 1) / (TAIL - 1) - L) / Math.max(1e-6, d); k++; for (let c = 0; c < 3; c++) p[3 * k + c] = follow[3 * j - 3 + c] + (follow[3 * j + c] - follow[3 * j - 3 + c]) * w; }
        L += d;
      }
      for (; k < TAIL - 1; k++) for (let c = 0; c < 3; c++) p[3 * (k + 1) + c] = p[3 * k + c] - (c === 1 ? seg : 0);
      q.set(p); r.tailOk = true; return;
    }
    if (!r.tailOk || Math.hypot(p[0] - A.x, p[1] - A.y, p[2] - A.z) > .8 * scale) {
      for (let k = 0; k < TAIL; k++) { const down = Math.max(0, k - 1) * seg; p[3 * k] = A.x + D.x * seg * Math.min(1, k); p[3 * k + 1] = A.y + D.y * seg * Math.min(1, k) - down; p[3 * k + 2] = A.z + D.z * seg * Math.min(1, k); }
      q.set(p); r.tailOk = true;
    }
    const steps = Math.max(1, Math.min(4, Math.ceil(dt * 120))), h = dt / steps;
    for (let st = 0; st < steps; st++) {
      p[0] = A.x; p[1] = A.y; p[2] = A.z; p[3] = A.x + D.x * seg; p[4] = A.y + D.y * seg; p[5] = A.z + D.z * seg;
      for (let k = 2; k < TAIL; k++) {
        const flutter = Math.sin(time * 7.3 + k * 1.3 + i * 2.1) * .9 * (k / TAIL);
        for (let c = 0; c < 3; c++) {
          const v = (p[3 * k + c] - q[3 * k + c]) * .955; q[3 * k + c] = p[3 * k + c];
          p[3 * k + c] += v + (c === 1 ? -7.5 * h * h : c === 0 ? flutter * h * h : flutter * .6 * h * h);
        }
      }
      for (let it = 0; it < 3; it++) for (let k = 1; k < TAIL - 1; k++) {
        const dx = p[3 * k + 3] - p[3 * k], dy = p[3 * k + 4] - p[3 * k + 1], dz = p[3 * k + 5] - p[3 * k + 2], d = Math.hypot(dx, dy, dz) || 1e-6, diff = (d - seg) / d;
        if (k === 1) { p[3 * k + 3] -= dx * diff; p[3 * k + 4] -= dy * diff; p[3 * k + 5] -= dz * diff; }
        else { const hlf = diff * .5; p[3 * k] += dx * hlf; p[3 * k + 1] += dy * hlf; p[3 * k + 2] += dz * hlf; p[3 * k + 3] -= dx * hlf; p[3 * k + 4] -= dy * hlf; p[3 * k + 5] -= dz * hlf; }
      }
    }
  }

  /** The strike's glow along the ribbon's outer half (the stage's own strokes: crimson light, drawn with the burst). */
  private burn(st: MoveStage, look: StageLook, r: Rib, scale: number) {
    const line = r.line, from = Math.floor(SEG * .35), k = r.glow;
    for (let j = from; j < SEG; j += 3) {
      const e = Math.min(SEG, j + 3);
      _a.set(line[3 * j], line[3 * j + 1], line[3 * j + 2]); _b.set(line[3 * e], line[3 * e + 1], line[3 * e + 2]);
      const along = (j - from) / (SEG - from);
      st.streak(_a, _b, .1 * scale * (.6 + .4 * along), look.main, .35 * k * (.4 + .6 * along));
    }
    st.glow(r.tip, .22 * scale, look.core, .4 * k);
  }

  /** The strip itself, laid for the camera about to draw it: each section across the ribbon's way, turned mostly to the
   *  lens (a flat ribbon edge-on would vanish), partly to its own lie so it still turns as it flies. */
  private strip(r: Rib, i: number, camera: THREE.Camera) {
    if (!r.mesh.visible || r.len <= 0) return;
    const geo = r.mesh.geometry, pos = geo.attributes.position.array as Float32Array, nor = geo.attributes.normal.array as Float32Array, uv = geo.attributes.uv.array as Float32Array;
    const line = r.line, L = r.len, scale = r.mesh.userData.scale ?? 1;
    _cam.setFromMatrixPosition(camera.matrixWorld);
    const end = Math.min(.34 * scale, .45 * L), W = WIDTH[i] * scale;
    _s.copy(r.side);
    for (let j = 0; j <= SEG; j++) {
      const a = Math.max(0, j - 1), b = Math.min(SEG, j + 1);
      _t.set(line[3 * b] - line[3 * a], line[3 * b + 1] - line[3 * a + 1], line[3 * b + 2] - line[3 * a + 2]);
      if (_t.lengthSq() < 1e-10) _t.set(0, -1, 0); _t.normalize();
      _c.set(line[3 * j], line[3 * j + 1], line[3 * j + 2]);
      _v.subVectors(_cam, _c).normalize();
      // Its own lie carried along it (and turned a little as it goes), and the lens's.
      _s.addScaledVector(_t, -_s.dot(_t)); if (_s.lengthSq() < 1e-8) _s.crossVectors(_t, UP); _s.normalize();
      _q.setFromAxisAngle(_t, 1.1 * (r.arc[j] - (j ? r.arc[j - 1] : 0)) / Math.max(.05, scale)); _s.applyQuaternion(_q);
      _n.crossVectors(_t, _v); if (_n.lengthSq() < 1e-8) _n.copy(_s); _n.normalize();
      if (_n.dot(_s) < 0) _n.negate();
      _w.copy(_s).multiplyScalar(.5).addScaledVector(_n, .5); _w.addScaledVector(_t, -_w.dot(_t)).normalize();
      const at = r.arc[j], width = W * (.6 + .4 * smooth(0, .12 * scale, at)) * .5;
      pos[6 * j] = _c.x - _w.x * width; pos[6 * j + 1] = _c.y - _w.y * width; pos[6 * j + 2] = _c.z - _w.z * width;
      pos[6 * j + 3] = _c.x + _w.x * width; pos[6 * j + 4] = _c.y + _w.y * width; pos[6 * j + 5] = _c.z + _w.z * width;
      _e.crossVectors(_w, _t).normalize();
      nor[6 * j] = nor[6 * j + 3] = _e.x; nor[6 * j + 1] = nor[6 * j + 4] = _e.y; nor[6 * j + 2] = nor[6 * j + 5] = _e.z;
      const d = L - at, v = d < end ? 1 - .25 * d / end : .35;
      uv[4 * j + 1] = uv[4 * j + 3] = v;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.normal.needsUpdate = true; geo.attributes.uv.needsUpdate = true;
  }

  private drop(b: Body) {
    for (const r of b.ribs) { r.mesh.removeFromParent(); r.mesh.geometry.dispose(); r.mesh.material.dispose(); }
    if (PAINT && --PAINT.users <= 0) { PAINT.map.dispose(); PAINT.glow.dispose(); PAINT = undefined; }
  }
  reset() { for (const b of BODIES.values()) if (b.owner === this) for (const r of b.ribs) { r.tailOk = false; r.hasFrom = false; r.tipLive = false; } }
  dispose() { for (const [id, b] of BODIES) if (b.owner === this) { this.drop(b); BODIES.delete(id); } }
}
