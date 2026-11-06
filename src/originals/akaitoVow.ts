import * as THREE from 'three';
import { BoltBatch } from '../render/signature/BoltBatch';
import type { MoveStage, StageLook } from '../render/signature/MoveStage';
import { floorUnder } from '../render/signature/blowFloor';
import { originalBody } from './launch';

export const AKAITO = originalBody('akaito');

const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
/** The red thread: a white-hot heart in crimson, cooling to a deep red. */
export const THREAD: StageLook = { core: lin(3.3, 2.05, 2.15), main: lin(2.45, .14, .26), rim: lin(.62, .02, .07), light: lin(1.45, .34, .42),
  element: { spike: 0xffe2e8, rim: 0xe8203c, light: 0xff4a5e, ink: 0x2a0408 }, shell: 0xff3050, edge: 0x6a0614, flame: -1, dark: false, heart: 0 };
/** The bride's light: white at its heart, his cape's pale lilac (#d4c0ed) through its body. */
export const VEIL: StageLook = { core: lin(3.1, 2.95, 3.3), main: lin(1.7, 1.42, 2.25), rim: lin(.48, .36, .78), light: lin(1.22, 1.08, 1.48),
  element: { spike: 0xffffff, rim: 0xd4c0ed, light: 0xe8dcff, ink: 0x2a2040 }, shell: 0xeee6ff, edge: 0x6a5a9a, flame: -1, dark: false, heart: 0 };
/** The floor under the vow: the stone gone still and dark, her lilac at its creeping edge; nothing burns in it. */
export const HUSH: StageLook = { ...VEIL, core: lin(1.9, 1.6, 2.6), main: lin(.95, .7, 1.6), rim: lin(.22, .14, .4), dark: true };

const TAU = Math.PI * 2, UP = new THREE.Vector3(0, 1, 0), ACROSS = new THREE.Vector3(1, 0, 0), DEEP = new THREE.Vector3(0, 0, 1);
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const CONFIRM = .576, CHARGE = 1.44, BLAST = 2.592, BLAST_END = 3.06, END = 3.2;
/** A knot of three loops (the trefoil's shadow: one cord, closed on itself), `t` 0..1 round it, in a unit's reach. */
const knot = (t: number, out: THREE.Vector2) => { const a = t * TAU; return out.set((Math.sin(a) + 2 * Math.sin(2 * a)) / 3, (Math.cos(a) - 2 * Math.cos(2 * a)) / 3); };

/** The ghost bride's surface (her skinned build, akaito-bride*.glb): a ghost drawn in light. Her edges burn lilac-white
 *  over the bloom threshold, her body is glass with bands of her veil's light running down it, and she breaks up out of
 *  nothing as `presence` rises (value noise on her bind-pose surface, so the grain stays on her as she moves) with a
 *  crimson edge burning just inside the break - the thread she is made of. Premultiplied, depth-tested, not written. */
const brideVertex = /* glsl */`
#include <common>
#include <skinning_pars_vertex>
varying vec3 vN;varying vec3 vV;varying vec3 vRest;varying vec3 vW;
void main(){
  #include <beginnormal_vertex>
  #include <skinbase_vertex>
  #include <skinnormal_vertex>
  #include <defaultnormal_vertex>
  #include <begin_vertex>
  vRest=position;
  #include <skinning_vertex>
  #include <project_vertex>
  vN=normalize(transformedNormal);vV=-mvPosition.xyz;vW=(modelMatrix*vec4(transformed,1.)).xyz;
}`;
const brideFragment = /* glsl */`
uniform float uPresence;uniform float uTime;uniform vec3 uBody;uniform vec3 uEdge;uniform vec3 uThread;
varying vec3 vN;varying vec3 vV;varying vec3 vRest;varying vec3 vW;
float h3(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x),mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x),mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x),f.y),f.z);}
void main(){
  if(uPresence<=.004)discard;
  vec3 n=normalize(vN),v=normalize(vV);if(!gl_FrontFacing)n=-n;
  float e=1.-abs(dot(n,v));
  float grain=noise(vRest*7.)*.65+noise(vRest*19.)*.35;
  float cut=uPresence*1.25-.12;
  if(grain>cut)discard;
  float burn=1.-smoothstep(0.,.07,cut-grain);
  // A thin burning outline, a soft band inside it, and a body of deep violet glass that dims what is behind her (so she
  // reads as a figure against the room, not as a haze), light running down her veil in slow bands.
  float line=smoothstep(.8,.97,e),band=smoothstep(.5,.85,e)*(1.-line);
  float flow=.5+.5*sin(vW.y*5.5+uTime*2.6+sin(vW.x*3.1+vW.z*2.3+uTime*.9)*1.6);
  float veil=smoothstep(.55,1.,.5+.5*sin((vRest.x*9.+vRest.z*7.)+vRest.y*3.-uTime*1.7));
  // Never filling the lens: gone within two metres of the eye, whole from four.
  float near=smoothstep(2.,4.,length(vV));
  vec3 col=uBody*(.4+.45*flow*band+.35*veil*band)+uEdge*(line*1.7+band*.3)+uThread*burn*2.4;
  float a=clamp(uPresence*near*(.48+band*.25+line*.5+burn*.6),0.,1.);
  gl_FragColor=vec4(col*a,a);
}`;

/** Her material, for each of her meshes: `presence` is AkaitoGhostBride's own uniform (0 gone, 1 whole). */
export function brideMaterial(presence: { value: number }, clock: { value: number }): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'AkaitoBride', vertexShader: brideVertex, fragmentShader: brideFragment, side: THREE.FrontSide,
    transparent: true, depthWrite: false, toneMapped: false, premultipliedAlpha: true,
    blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    uniforms: { uPresence: presence, uTime: clock, uBody: { value: lin(.55, .42, .95) }, uEdge: { value: lin(1.75, 1.5, 2.45) }, uThread: { value: lin(2.4, .16, .3) } },
  });
}

type Cut = { p: THREE.Vector3; yaw: number; roll: number; born: number; size: number; live: boolean };
type Strand = { p: THREE.Vector3; v: THREE.Vector3; spin: number; len: number; live: boolean };
type Kept = { at: THREE.Vector3; ground: THREE.Vector3; side: THREE.Vector3; born: number; seed: number; live: boolean; strands: Strand[] };
/** What the move's frame needs to know of the pair: where his left hand is, her hand (if she is drawn), the victim's
 *  centre and feet, and how far into the move he is. */
export interface VowFrame { feet: THREE.Vector3; hand: THREE.Vector3; bride?: THREE.Vector3; veil?: THREE.Vector3; presence?: number; target: THREE.Vector3; targetFeet: THREE.Vector3; elapsed: number; seq: number; actor: string; victim: string }

export class AkaitoVow {
  /** His threads: their own pool of glowing strokes (BoltBatch), so the vow never starves the stage's shared one. */
  private threads = new BoltBatch(1400, 'akaito-threads');
  private clockValue = { value: 0 };
  private cuts: Cut[] = Array.from({ length: 6 }, () => ({ p: new THREE.Vector3(), yaw: 0, roll: 0, born: -1e9, size: 0, live: false }));
  private kept: Kept[] = Array.from({ length: 3 }, () => ({ at: new THREE.Vector3(), ground: new THREE.Vector3(), side: new THREE.Vector3(), born: -1e9, seed: 0, live: false,
    strands: Array.from({ length: 22 }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), spin: 0, len: 0, live: false })) }));
  private cutCursor = 0; private keptCursor = 0; private time = 0; private detail = true;
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private e = new THREE.Vector3(); private side = new THREE.Vector3(); private lift = new THREE.Vector3(); private k2 = new THREE.Vector2();
  private q1 = new THREE.Vector3(); private q2 = new THREE.Vector3(); private q3 = new THREE.Vector3();
  constructor(scene: THREE.Scene) { scene.add(this.threads.mesh); }
  /** The clock her material breathes by. */
  get clock() { return this.clockValue; }

  /** The frame begins (AkaitoGhostBride.update's top). */
  begin(time: number, detail: boolean) { this.time = time; this.detail = detail; this.clockValue.value = time % 1000; this.threads.begin(); }

  // ------------------------------------------------------------------------------------------------- the strokes

  /** A stroke of thread: a crimson glow round a white-hot heart (the pool blends by the brighter, so a thread drawn in
   *  pieces reads as one cord). */
  private stroke(a: THREE.Vector3, b: THREE.Vector3, width: number, intensity: number, color = THREAD) {
    if (intensity <= .01) return;
    this.threads.segment(a, b, width, color.main, intensity * .95, 0);
    this.threads.segment(a, b, width * .32, color.core, intensity * .9, 0);
  }
  /** A thread from `a` to `b`: bowed `bow` metres off the straight line (turned `turn` round it), its slack waving `wave`
   *  metres, the first `reach` of it drawn, `width` its glow's half-width. */
  private thread(a: THREE.Vector3, b: THREE.Vector3, bow: number, turn: number, wave: number, reach: number, width: number, intensity: number, seed: number, color = THREAD) {
    if (reach <= .01 || intensity <= .01) return;
    this.d.subVectors(b, a); const span = this.d.length(); if (span < .05) return;
    this.d.divideScalar(span);
    this.side.crossVectors(this.d, UP); if (this.side.lengthSq() < 1e-4) this.side.set(1, 0, 0); this.side.normalize();
    this.lift.crossVectors(this.side, this.d).normalize();
    const cs = Math.cos(turn), sn = Math.sin(turn), n = this.detail ? 16 : 9, t = this.time;
    this.e.copy(a);
    for (let i = 1; i <= n; i++) {
      const s = i / n * reach, env = Math.sin(Math.PI * s);
      const off = env * bow + Math.sin(s * 9 + t * 7.3 + seed) * wave * env, up = Math.sin(s * 6.3 - t * 5.1 + seed * 2.1) * wave * .6 * env;
      this.c.copy(a).addScaledVector(this.d, span * s)
        .addScaledVector(this.side, off * cs - up * sn).addScaledVector(this.lift, off * sn + up * cs);
      this.stroke(this.e, this.c, width, intensity * (.75 + .25 * env), color);
      this.e.copy(this.c);
    }
  }
  /** Thread wound round a body: `turns` turns up `height` metres round `centre`, `radius` out, turned `spin`. */
  private coil(centre: THREE.Vector3, radius: number, height: number, turns: number, spin: number, width: number, intensity: number) {
    const n = Math.ceil(turns * (this.detail ? 16 : 10));
    for (let i = 0; i <= n; i++) {
      const u = i / n, ang = spin + u * turns * TAU, r = radius * (.8 + .2 * Math.sin(u * Math.PI));
      this.c.set(centre.x + Math.cos(ang) * r, centre.y - height / 2 + u * height, centre.z + Math.sin(ang) * r);
      if (i) this.stroke(this.e, this.c, width, intensity);
      this.e.copy(this.c);
    }
  }
  /** The knot of three loops at `at` in the plane of `x` and `y`, `size` metres from its middle to a loop's tip, its first
   *  `k` drawn. */
  private knot(at: THREE.Vector3, x: THREE.Vector3, y: THREE.Vector3, size: number, k: number, width: number, intensity: number, spin = 0, color = THREAD) {
    const n = this.detail ? 72 : 42, cs = Math.cos(spin), sn = Math.sin(spin);
    for (let i = 0; i <= n * k; i++) {
      knot(i / n, this.k2); const u = this.k2.x * cs - this.k2.y * sn, v = this.k2.x * sn + this.k2.y * cs;
      this.q1.copy(at).addScaledVector(x, u * size).addScaledVector(y, v * size);
      if (i) this.stroke(this.q2, this.q1, width, intensity, color);
      this.q2.copy(this.q1);
    }
  }
  /** A ring of thread lying on the floor round `at` (its y the floor's), `radius` out, its first `k` laid, turning. */
  private floorRing(at: THREE.Vector3, radius: number, k: number, width: number, intensity: number, spin: number) {
    const n = this.detail ? 56 : 32;
    for (let i = 0; i <= n * k; i++) {
      const ang = spin + i / n * TAU;
      this.c.set(at.x + Math.cos(ang) * radius, at.y + .04, at.z + Math.sin(ang) * radius);
      if (i) this.stroke(this.e, this.c, width, intensity);
      this.e.copy(this.c);
    }
  }

  // ------------------------------------------------------------------------------------------------- the move

  /** His katana's edge through the wind-up of the move, in thread's colour (AkaitoGhostBride.windup's ultimate). */
  windup(st: MoveStage, hand: THREE.Vector3, tip: THREE.Vector3, k: number, seed: number) {
    st.streak(hand, tip, .035 + .045 * k, THREAD.main, .55 + .6 * k); st.streak(hand, tip, .012, THREAD.core, k);
    st.charge(tip, THREAD, .22, k, seed);
  }
  /** One of the two cuts that open it landed at `p` (AkaitoGhostBride.land's ultimate, contact 0 and 1). */
  cut(st: MoveStage, p: THREE.Vector3, ground: THREE.Vector3, dir: THREE.Vector3, floor: number, yaw: number, second: boolean, t: number) {
    const cut = this.cuts[this.cutCursor++ % this.cuts.length];
    cut.p.copy(p); cut.yaw = yaw; cut.roll = second ? -.7 : .6; cut.born = t; cut.size = second ? 2.7 : 2.3; cut.live = true;
    st.burst(p, THREAD, second ? 1.4 : 1.1, t, { dir, floor, clean: true });
    if (second) { st.shock(ground, THREAD, 5.2, t, .45); st.shock(ground, VEIL, 3.4, t + .06, .4); }
  }
  /** The promise kept: the blast where the last blow lands (AkaitoGhostBride.land's ultimate, contact 2). */
  land(st: MoveStage, point: THREE.Vector3, ground: THREE.Vector3, dir: THREE.Vector3, floor: number, t: number, seed: number) {
    st.burst(point, THREAD, 3.2, t, { dir, floor });
    st.dome(point, VEIL, 5, t, .5);
    st.shock(ground, THREAD, 11, t, .6);
    st.erupt(ground, UP, VEIL, 1.25, 11, t + .06, .75);
    st.shatter(point, this.a.copy(dir).negate(), THREAD, 3.6, t, .7);
    st.scar(ground, THREAD, 3.4, t + .2, 2.4);
    const kept = this.kept[this.keptCursor++ % this.kept.length];
    kept.at.copy(point); kept.ground.copy(ground); kept.born = t; kept.seed = seed; kept.live = true;
    kept.side.crossVectors(dir, UP); if (kept.side.lengthSq() < 1e-4) kept.side.set(1, 0, 0); kept.side.normalize();
    // The threads cut: strands flung out from where they were wound, falling.
    kept.strands.forEach((s, i) => {
      const a = hash(seed + i * 3.7) * TAU, out = 3.5 + 5.5 * hash(seed * 1.3 + i), lift = 1.5 + 4 * hash(i * 2.9 + seed);
      s.p.set(point.x + Math.cos(a) * .35, point.y + (hash(i * 7.1) - .5) * 1.2, point.z + Math.sin(a) * .35);
      s.v.set(Math.cos(a) * out, lift, Math.sin(a) * out); s.spin = (hash(i * 5.3 + seed) - .5) * 9; s.len = .55 + .7 * hash(i * 1.9); s.live = true;
    });
  }
  /** Each frame of the move from the first cut to its end, for one thrower and his victim. */
  stage(st: MoveStage, f: VowFrame) {
    const t = this.time, el = f.elapsed, seed = f.seq * 2.9;
    const g = clamp((el - CONFIRM) / (BLAST - CONFIRM)), charge = clamp((el - CHARGE) / (BLAST - CHARGE));
    const blast = el >= BLAST && el <= BLAST_END, after = clamp((el - BLAST) / (END - BLAST));
    const fade = el > BLAST_END ? clamp((END - el) / (END - BLAST_END)) : 1;
    // The floor gone still under the pair, and her ring of thread laid round both.
    const mid = this.a.addVectors(f.feet, f.targetFeet).multiplyScalar(.5);
    mid.y = floorUnder(mid.x, Math.min(f.feet.y, f.targetFeet.y), mid.z);
    const apart = Math.hypot(f.feet.x - f.targetFeet.x, f.feet.z - f.targetFeet.z);
    st.pool(this.b.copy(mid), apart * .5 + 2.6 + 2 * g, HUSH, Math.min(1, .25 + g * 1.2) * fade, seed, .9);
    const ringR = apart * .5 + 2.2;
    this.floorRing(mid, ringR, smooth(0, .35, g), .07, 1.1 * fade, t * .35 + seed);
    this.floorRing(mid, ringR + .28, smooth(.1, .5, g), .04, .8 * fade, -t * .5 + seed);
    // (Its light gives way to the blast's own: the stage's light volumes are a shared, short pool.)
    if (el < BLAST) st.light(this.b.copy(mid).setY(mid.y + .4), ringR + 2.5, THREAD, .26 + .42 * g);
    // The knot on the floor under the victim, laid through the charge and burning at the blast.
    if (charge > 0) {
      const tf = this.q3.set(f.targetFeet.x, floorUnder(f.targetFeet.x, f.targetFeet.y, f.targetFeet.z) + .05, f.targetFeet.z);
      this.knot(tf, ACROSS, DEEP, 1.55, smooth(0, .8, charge), .07, (.8 + .7 * charge) * fade, t * .4);
    }
    // Her light round her, under the veil.
    if (f.veil) st.glow(f.veil, 2.2, VEIL.main, .13 * (f.presence ?? 1));
    if (el < CONFIRM + .12) return;
    // The threads, his hand (hers, out of his sleeve) to the victim: shot out over a quarter second, slack, then drawn
    // tight through the charge.
    const reach = smooth(CONFIRM + .12, CONFIRM + .42, el), tight = blast ? 1 : charge * charge;
    const wave = .45 * (1 - tight) + .03, bright = (.7 + .9 * charge + (blast ? .8 : 0)) * fade;
    const count = this.detail ? 6 : 3;
    for (let i = 0; i < count; i++) this.thread(f.hand, f.target, (1.1 - .95 * tight) * (.4 + .6 * hash(seed + i)), i * TAU / count + seed, wave, reach, .05 + .03 * charge, bright, seed + i * 1.7);
    if (f.bride) this.thread(f.bride, f.target, .9 - .8 * tight, seed + 1, wave * .8, smooth(.9, 1.3, el), .06 + .03 * charge, bright, seed + 9, VEIL);
    // Wound round the victim: loose coils pulled in tight as the charge fills.
    if (el > CONFIRM + .3) {
      const r = blast ? .34 : 1.25 - .8 * charge, spin = t * (2 + 6 * charge) + seed, wind = smooth(CONFIRM + .3, CHARGE, el);
      this.coil(f.target, r, 1.5, 2.4 * wind + .2, spin, .045 + .03 * charge, bright * .85);
      if (this.detail) this.coil(f.target, r * 1.15, 1.2, 1.6 * wind + .2, -spin * .8 + 1.3, .035, bright * .6);
    }
    // In his hand through the charge: the thread's light gathering; on hers, her own.
    if (charge > 0 && !blast && el < BLAST) { st.charge(f.hand, THREAD, .26 + .3 * charge, charge, seed); if (f.bride) st.glow(f.bride, .3 + .2 * charge, VEIL.main, .35 + .3 * charge); }
    if (charge > .7 && el < BLAST_END) st.speed(.55 * Math.min(1, (charge - .7) / .3 + (blast ? 1 : 0)), f.actor, f.victim);
    // The promise kept: the thread pulled taut as a beam from his hand, and from hers.
    if (blast) {
      const life = clamp((el - BLAST) / (BLAST_END - BLAST));
      st.beam(f.hand, f.target, .55, THREAD, life, f.seq + 1, 1);
      // And hers, taut in her light: drawn as thread (the stage's light volumes go to his beam and the blast).
      if (f.bride) { const k = life < .8 ? 1 : 1 - (life - .8) / .2; this.thread(f.bride, f.target, 0, 0, 0, 1, .16, 1.5 * k, f.seq + 7, VEIL); st.glow(f.bride, .6, VEIL.core, .6 * k); st.glow(f.target, 1.4, VEIL.main, .5 * k); }
    }
    if (el > BLAST_END) st.light(f.target, 10, VEIL, .75 * (1 - after));
  }

  /** What outlives a frame of the move: the cuts' arcs, the knot flaring where the promise was kept, the cut threads
   *  falling, petals of her veil. AkaitoGhostBride.update's end, every frame. */
  tick(st: MoveStage) {
    const t = this.time;
    for (const cut of this.cuts) {
      if (!cut.live) continue;
      const age = t - cut.born; if (age >= .42) { cut.live = false; continue; } if (age < 0) continue;
      const w = age / .42, open = Math.min(1, age / .05), fade = w < .4 ? 1 : 1 - (w - .4) / .6;
      this.arc(cut.p, cut.yaw, cut.roll, cut.size, open, fade);
      st.light(cut.p, 1.6 + cut.size, THREAD, .3 * (1 - w));
    }
    for (const kept of this.kept) {
      if (!kept.live) continue;
      const age = t - kept.born; if (age >= 2.4) { kept.live = false; continue; } if (age < 0) continue;
      // The knot flaring in the air where it was kept: grown in a tenth of a second, white-hot, fading as it turns.
      if (age < .95) {
        const grow = .45 + .55 * smooth(0, .12, age), flare = age < .12 ? 1.6 : 1.6 * (1 - (age - .12) / .83);
        this.knot(kept.at, kept.side, UP, 1.7 * grow, 1, .1 + .06 * flare, flare, age * 1.2);
        st.glow(kept.at, 2.4 * grow, THREAD.main, .45 * flare); st.glow(kept.at, 1.1 * grow, THREAD.core, .5 * flare);
      }
      // The knot left burning on the stone.
      const burn = age < .3 ? age / .3 : 1 - (age - .3) / 2.1;
      this.knot(this.q3.copy(kept.ground).setY(floorUnder(kept.ground.x, kept.ground.y, kept.ground.z) + .05), ACROSS, DEEP, 2.1, 1, .09, 1.2 * burn, kept.seed);
      // The cut threads, flung out and falling.
      if (age < 1.5) {
        const dt = age, fall = 1 - age / 1.5;
        for (const s of kept.strands) {
          if (!s.live) continue;
          this.a.copy(s.p).addScaledVector(s.v, dt * (1 - .35 * dt)); this.a.y -= 5.5 * dt * dt;
          const floor = floorUnder(this.a.x, this.a.y, this.a.z) + .03; if (this.a.y < floor) this.a.y = floor;
          const ang = s.spin * dt;
          this.d.set(Math.cos(ang), Math.sin(ang * .7) * .6, Math.sin(ang)).normalize();
          this.e.copy(this.a);
          for (let j = 1; j <= 4; j++) {
            this.c.copy(this.a).addScaledVector(this.d, s.len * j / 4); this.c.y += Math.sin(j * 1.7 + t * 8 + s.spin) * .06;
            this.stroke(this.e, this.c, .035, 1.3 * fall); this.e.copy(this.c);
          }
        }
        // Petals of her veil, drifting down.
        for (let i = 0, n = this.detail ? 26 : 12; i < n; i++) {
          const a = hash(kept.seed + i * 4.1) * TAU, out = 1 + 4.5 * hash(i * 3.3 + kept.seed), sway = Math.sin(t * 3 + i) * .3;
          this.a.set(kept.at.x + Math.cos(a) * out * Math.min(1, age * 2.2) + sway, kept.at.y + 1.6 * hash(i * 9.7) + 1.5 * age - 2.1 * age * age, kept.at.z + Math.sin(a) * out * Math.min(1, age * 2.2));
          st.glow(this.a, .12 + .08 * hash(i), i % 3 ? VEIL.core : THREAD.main, .9 * fall);
        }
      }
    }
  }
  /** A cut of thread in the air: a crescent `size` metres to either side across `yaw`, turned `roll`. */
  private arc(p: THREE.Vector3, yaw: number, roll: number, size: number, open: number, fade: number) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cr = Math.cos(roll), sr = Math.sin(roll), parts = this.detail ? 12 : 7;
    for (let i = 0; i < parts; i++) {
      const u0 = i / parts, u1 = (i + 1) / parts; if (u0 >= open) break;
      const x0 = (u0 * 2 - 1) * size, x1 = (Math.min(u1, open) * 2 - 1) * size, b0 = (1 - (u0 * 2 - 1) ** 2) * size * .22, b1 = (1 - (Math.min(u1, open) * 2 - 1) ** 2) * size * .22;
      this.a.set(p.x + cy * (x0 * cr - b0 * sr), p.y + x0 * sr + b0 * cr, p.z - sy * (x0 * cr - b0 * sr));
      this.b.set(p.x + cy * (x1 * cr - b1 * sr), p.y + x1 * sr + b1 * cr, p.z - sy * (x1 * cr - b1 * sr));
      const thick = Math.sin(Math.PI * (u0 + u1) * .5);
      this.stroke(this.a, this.b, size * .06 * thick + .03, 1.2 * fade);
    }
    // And a thread trailing the edge, waving as it settles.
    for (let i = 0; i < parts; i++) {
      const u0 = i / parts, u1 = (i + 1) / parts; if (u0 >= open) break;
      const w0 = Math.sin(u0 * 11 + this.time * 9) * .08 * size * .3, w1 = Math.sin(u1 * 11 + this.time * 9) * .08 * size * .3;
      const x0 = (u0 * 2 - 1) * size * 1.08, x1 = (Math.min(u1, open) * 2 - 1) * size * 1.08, b0 = (1 - (u0 * 2 - 1) ** 2) * size * .3 + w0, b1 = (1 - (Math.min(u1, open) * 2 - 1) ** 2) * size * .3 + w1;
      this.a.set(p.x + cy * (x0 * cr - b0 * sr), p.y + x0 * sr + b0 * cr, p.z - sy * (x0 * cr - b0 * sr));
      this.b.set(p.x + cy * (x1 * cr - b1 * sr), p.y + x1 * sr + b1 * cr, p.z - sy * (x1 * cr - b1 * sr));
      this.stroke(this.a, this.b, .03, .9 * fade);
    }
  }
  /** The frame ends (AkaitoGhostBride.update's end). */
  end() { this.threads.end(); }
  reset() { for (const c of this.cuts) c.live = false; for (const k of this.kept) k.live = false; this.threads.begin(); this.threads.end(); }
  dispose() { this.threads.mesh.removeFromParent(); this.threads.mesh.geometry.dispose(); this.threads.mesh.material.dispose(); }
}
