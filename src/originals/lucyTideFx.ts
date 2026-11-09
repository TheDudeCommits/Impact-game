import * as THREE from 'three';
import type { Fighter } from '../render/Fighter';
import { MoveStage, stageLook, SHEEN, WAVE, BURN, type StageLook } from '../render/signature/MoveStage';
import { GLOW, RING, STAR } from '../render/signature/GlowBatch';
import { SIGNATURE, involvesLocal } from '../render/signature/context';
import { floorUnder } from '../render/signature/blowFloor';
import { bodyCenter } from '../render/signature/body';
import { VfxKit } from '../render/vfx/VfxKit';
import { SPRITE } from '../render/vfx/SparkField';
import { TIDE, HAMMER, MONSOONS, LUCY_TIDE, hammerPhase, type MonsoonCast } from './lucyTide';

/** The Dust Sea's sand: a white-gold heart, amber body, a burnt umber edge; the low sun's red-gold; the wet sand it leaves. */
const SAND: StageLook = stageLook(0xfff1c4, 0xf0a032, 0x6e3410);
const SUN: StageLook = stageLook(0xfff2b8, 0xff5a1a, 0x7a1206);
const WET = new THREE.Color(.55, .36, .16);
const lin = (r: number, g: number, b: number) => new THREE.Color(r, g, b);
const SAND_BODY = lin(.98, .52, .16), SAND_DARK = lin(.4, .19, .06);
const SUN_DISC = lin(2.4, .62, .14), SUN_CORE = lin(3.1, 2.1, .9), CREST = lin(2.6, 1.9, 1.0), GOLD = lin(2.3, 1.35, .35), LINE = lin(2.8, 2.0, .9);
/** polish6: the crest's spray, pale foam over the bloom threshold. */
const FOAM = lin(2.2, 1.95, 1.5);
/** Sand thrown up: lit and shaded (sRGB, the kit's puff two tones). */
const SAND_LIT = 0xf6c467, SAND_SHADE = 0x9a5222, GLINT = 0xfff0b8;
const UP = new THREE.Vector3(0, 1, 0), TAU = Math.PI * 2;
const clamp = (x: number) => Math.max(0, Math.min(1, x));
const smooth = (a: number, b: number, x: number) => { const u = clamp((x - a) / (b - a)); return u * u * (3 - 2 * u); };
const hash = (x: number) => { const v = Math.sin(x * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };

/** The wave's shape (metres): how far beyond the victim it stands, how wide and how tall, and its beats (seconds into
 *  the move): rising, curling, crashing onto the victim with the hammer, and sinking back into the floor. */
const WAVE_SHAPE = { back: 2.4, half: 4.4, tall: 5.2, rise: [.72, 1.85], curl: [1.3, 2.05], crash: [2.06, TIDE.blow + .02], sink: [TIDE.blow + .02, TIDE.blow + .7] } as const;
const NU = 40, NV = 22;

const waveVertex = /* glsl */`
varying vec2 vUv;varying vec3 vN;varying vec3 vW;
void main(){vUv=uv;vN=normalize(mat3(modelMatrix)*normal);vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`;
// polish6 (5 November 2026): the crest drawn sharp. From the gameplay camera the wave read as a soft golden swell (a soft
// lip fading into dust, a backlit glow over it): now the lip is a hard scalloped edge of pale foam, the underside of the
// curl under it (the barrel, turned from the sun) a dark umber band with an ink line between the two, foam streaks run back
// down from the lip, the outline is inked where the sheet turns edge-on to the lens, and the sun's backlight is only on
// the crest's outer top. Same sheet, same shape and beats.
const waveFragment = /* glsl */`
uniform float uTime;uniform float uOpacity;uniform float uGlow;uniform float uSeed;uniform vec3 uOrigin;uniform vec3 uDir;uniform float uBack;uniform float uCurl;
varying vec2 vUv;varying vec3 vN;varying vec3 vW;
float h1(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h1(i),h1(i+vec2(1,0)),f.x),mix(h1(i+vec2(0,1)),h1(i+vec2(1,1)),f.x),f.y);}
void main(){
  float u=vUv.x,v=vUv.y;
  // Sand running up the face: two scales of streaks drawn upward, the finer faster.
  float flow=n2(vec2(u*16.+uSeed,v*4.5-uTime*2.4))*.62+n2(vec2(u*38.-uSeed,v*12.-uTime*4.1))*.38;
  vec3 deep=vec3(.26,.1,.03),body=vec3(.78,.38,.1),crest=vec3(1.45,1.02,.55);
  vec3 col=mix(deep,body,smoothstep(.0,.5,v));
  col=mix(col,crest,smoothstep(.7,.96,v));
  // Cel-lit from above and behind (the low sun is behind the wave): three flat tones. The normal turned to the lens (the
  // sheet is drawn from both sides), so the curl's underside reads as facing down.
  vec3 V=normalize(cameraPosition-vW);
  vec3 n=normalize(vN);if(dot(n,V)<0.)n=-n;
  float k=dot(n,normalize(vec3(.15,.8,.35)))*.5+.5;
  col*=k>.6?.92:k>.36?.72:.55;
  col+=vec3(.42,.22,.05)*step(.64,flow)*(1.-smoothstep(.6,.82,v));
  col-=vec3(.1,.06,.015)*step(flow,.3);
  // The lip: a hard edge of foam, scalloped along the crest and stirring.
  float lip=.875+(n2(vec2(u*34.+uSeed,uTime*1.7))-.5)*.05+(n2(vec2(u*9.-uSeed,uTime*.6))-.5)*.03;
  float foam=smoothstep(lip-.008,lip+.004,v);
  // Under it, the barrel: the face darkening up into the curl, deepest right under the foam (seen from below, the curl's
  // underside is turned from the sun), its top a hard ink line.
  float under=smoothstep(-.02,-.38,n.y)*smoothstep(.45,.65,v)*(.35+.65*uCurl);
  float band=smoothstep(lip-.3,lip-.05,v)*(1.-foam);
  col=mix(col,vec3(.15,.05,.018),clamp(.5*under+.86*band*band*(.6+.4*uCurl),0.,.85));
  // Foam streaks run back down from the lip over the band (thin, stretched along the face, drifting).
  float streak=step(.8,n2(vec2(u*70.+uSeed*3.,v*1.6+uTime*.9)))*smoothstep(lip-.3,lip-.04,v)*(1.-foam);
  col=mix(col,vec3(1.45,1.2,.84),streak*.85);
  col=mix(col,vec3(1.7,1.48,1.12),foam);
  // The crest's outer top backlit by the sun (not the underside, which it cannot reach).
  col+=vec3(1.1,.62,.2)*uGlow*smoothstep(.55,1.,v)*smoothstep(.05,.45,n.y)*(1.-foam*.6);
  // Ink: the line between the foam and the band, the outline where the sheet turns edge-on to the lens, and the sides.
  float rim=smoothstep(.84,.94,1.-dot(n,V))*smoothstep(.4,.6,v);
  float seam=smoothstep(lip-.035,lip-.012,v)*(1.-foam);
  float edge=max(max(rim,seam),1.-smoothstep(.02,.07,min(u,1.-u)));
  col=mix(col,vec3(.05,.018,.008),edge*.92);
  // Sunk into the floor at its foot, thinning at its sides, and cut clean at the lip (a hard scalloped edge, not a fade).
  float a=smoothstep(.0,.05,v)*smoothstep(.0,.05,u)*smoothstep(1.,.95,u);
  a*=1.-smoothstep(.986,.996,v+(n2(vec2(u*26.-uSeed,uTime*2.))-.5)*.02);
  // Seen from beyond it (the victim's own camera behind them, looking back at him), the wave stands between that lens and
  // the fight: thinned to a veil there, so whoever it involves still reads both bodies.
  float beyond=smoothstep(uBack-1.,uBack+.5,dot(cameraPosition-uOrigin,uDir));
  gl_FragColor=vec4(col,a*uOpacity*(1.-.75*beyond));
}`;

/** His arms stretched past a forearm's length, drawn over the skin's own thin stretch as rubber: a tube from the elbow to the
 *  wrist, cel-shaded in his skin's two tones under the room's sunset, inked round as the fighters are. */
const armVertex = /* glsl */`
varying vec3 vN;varying float vAlong;
void main(){vN=normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal);vAlong=position.y+.5;gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);}`;
const armFragment = /* glsl */`
varying vec3 vN;varying float vAlong;
void main(){float k=dot(normalize(vN),normalize(vec3(.3,.8,.45)));vec3 lit=vec3(.7,.42,.29),shade=vec3(.42,.22,.15);
vec3 c=k>.15?lit:shade;c=mix(c,vec3(.78,.74,.68),step(.88,vAlong)*.9);
gl_FragColor=vec4(c,1.);}`;
const armInkVertex = /* glsl */`
void main(){vec4 clip=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);vec2 d=(projectionMatrix*viewMatrix*vec4(normalize(mat3(modelMatrix)*mat3(instanceMatrix)*normal),0.)).xy;float l=length(d);if(l>1e-5)clip.xy+=d/l*.0065*clip.w;clip.z+=.0004*clip.w;gl_Position=clip;}`;
const ARMS = 8;

interface WaveMesh { mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>; pos: THREE.BufferAttribute; owner: string; key: number }
interface Ring { at: THREE.Vector3; radius: number; born: number; life: number; color: THREE.Color }
interface Cast { key: number; grabbed: boolean; gathered: boolean; landed: boolean; last: THREE.Vector3; seen: number; dir: THREE.Vector3; ground: THREE.Vector3; center: THREE.Vector3; side: THREE.Vector3 }

export class LucyTideFx {
  private stage?: MoveStage;
  private waves: WaveMesh[] = [];
  private casts = new Map<string, Cast>();
  private fired = new Map<string, number>();
  private rings: Ring[] = Array.from({ length: 12 }, () => ({ at: new THREE.Vector3(), radius: 0, born: -1e9, life: 0, color: SAND.core }));
  private ringNext = 0;
  private until = -1e9; private cleared = true;
  private a = new THREE.Vector3(); private b = new THREE.Vector3(); private c = new THREE.Vector3(); private d = new THREE.Vector3();
  private p0 = new THREE.Vector2(); private p1 = new THREE.Vector2(); private p2 = new THREE.Vector2(); private p3 = new THREE.Vector2(); private q = new THREE.Vector2();

  private arms?: { body: THREE.InstancedMesh; ink: THREE.InstancedMesh; count: number };
  private o = new THREE.Object3D();

  constructor(private scene: THREE.Scene, private kit: VfxKit) {}

  /** A stretched arm this frame: elbow to wrist, `radius` metres. */
  private arm(elbow: THREE.Vector3, wrist: THREE.Vector3, radius: number) {
    if (!this.arms) {
      const geometry = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
      const body = new THREE.InstancedMesh(geometry, new THREE.ShaderMaterial({ name: 'LucyRubberArm', vertexShader: armVertex, fragmentShader: armFragment, toneMapped: false }), ARMS);
      const ink = new THREE.InstancedMesh(geometry, new THREE.ShaderMaterial({ name: 'LucyRubberArmInk', vertexShader: armInkVertex, fragmentShader: 'void main(){gl_FragColor=vec4(.035,.02,.02,1.);}', side: THREE.BackSide, toneMapped: false }), ARMS);
      ink.instanceMatrix = body.instanceMatrix;
      for (const m of [body, ink]) { m.frustumCulled = false; m.count = 0; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.name = 'lucy-rubber-arm'; this.scene.add(m); }
      this.arms = { body, ink, count: 0 };
    }
    const a = this.arms; if (a.count >= ARMS) return;
    const span = elbow.distanceTo(wrist); if (span < .05) return;
    this.o.position.addVectors(elbow, wrist).multiplyScalar(.5);
    this.o.quaternion.setFromUnitVectors(UP, this.c.subVectors(wrist, elbow).divideScalar(span));
    this.o.scale.set(radius, span, radius); this.o.updateMatrix();
    a.body.setMatrixAt(a.count++, this.o.matrix);
  }
  /** The arms of a body whose forearms are stretched past `min` of their length (the grab, the hammer). */
  private rubberArms(f: Fighter, min = .55) {
    const form = (f as unknown as { awakenedForm?: Fighter }).awakenedForm, body = form && form.group.visible && !f.model.visible ? form : f;
    for (const side of ['Right', 'Left']) {
      const fore = body.joints.get(side + 'ForeArm'), hand = body.joints.get(side + 'Hand');
      if (!fore || !hand) continue;
      fore.getWorldPosition(this.a); hand.getWorldPosition(this.b);
      const span = this.a.distanceTo(this.b);
      if (span > min) this.arm(this.a, this.b, .085 + Math.min(.04, (span - min) * .008));
    }
  }
  private get st() { return this.stage ??= MoveStage.for(this.scene, this.kit); }

  /** Sand thrown: one clump of the kit's cel-shaded puffs in the sand's two tones (the kit's own dust is a pale grey). */
  private clump(x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, born: number, life: number, gravity = 9, drag = .8) {
    const dust = this.kit.dust, sp = dust.spec;
    sp.reset(SPRITE.puff, born, life).pos(x, y, z).velocity(vx, vy, vz); sp.gravity = gravity; sp.drag = drag;
    sp.sized(size * .5, size, .45).hot(SAND_LIT, 1).cool(SAND_SHADE, .9); sp.bias = size * .6; dust.emit();
  }
  /** Sand kicked out along the floor in a fan about (dx, dz) (the kit's dustSpray, in sand). */
  private spray(x: number, floor: number, z: number, dx: number, dz: number, count: number, speed: number, size: number, born: number, life = .5, spread = 1.2) {
    const base = Math.atan2(dz, dx);
    for (let i = 0, n = this.kit.n(count, 2); i < n; i++) {
      const a = base + (n > 1 ? i / (n - 1) - .5 : 0) * spread * 2 + (hash(born * 7 + i) - .5) * .3, v = speed * (.6 + .6 * hash(born * 3 + i * 1.7));
      this.clump(x + Math.cos(a) * .3, floor + size * .3, z + Math.sin(a) * .3, Math.cos(a) * v, .8 + 1.4 * hash(i + born), Math.sin(a) * v, size * (.6 + .4 * hash(i * 2.1 + born)), born + .02 * hash(i), life * (.75 + .5 * hash(i * 4.3)), 4, 2.6);
    }
  }
  /** A ring of sand thrown out over the floor (the kit's dustRing, in sand), and its wave on the floor (WAVE). */
  private sandRing(x: number, floor: number, z: number, count: number, radius: number, speed: number, size: number, born: number, life = .8) {
    for (let i = 0, n = this.kit.n(count, 4); i < n; i++) {
      const a = i / n * TAU + hash(born + i) * .5, c = Math.cos(a), sn = Math.sin(a), v = speed * (.6 + .6 * hash(i * 3.3 + born));
      this.clump(x + c * radius, floor + size * .25, z + sn * radius, c * v, .5 + 1.2 * hash(i + born * 2), sn * v, size * (.6 + .4 * hash(i * 5.1)), born + .02 * hash(i), life * (.7 + .5 * hash(i * 1.9)), 2, 3);
    }
    const r = this.rings[this.ringNext++ % this.rings.length];
    r.at.set(x, floor, z); r.radius = radius + speed * life * .9; r.born = born; r.life = life * .8; r.color = SAND_BODY;
  }

  /** Every frame (GummyEffects.update): each of his ultimates, each MONSOON, and the waves. */
  update(time: number, fighters: ReadonlyMap<string, Fighter>) {
    if (!LUCY_TIDE) return;
    let busy = MONSOONS.length > 0;
    for (const f of fighters.values()) if (f.state.fighter === 'gummy' && f.state.action === 'ultimate' && f.state.alive) busy = true;
    if (!busy && time > this.until) {
      if (!this.cleared) { this.stage?.open(time).close(); for (const w of this.waves) w.mesh.visible = false; if (this.arms) this.arms.body.count = this.arms.ink.count = 0; this.cleared = true; }
      return;
    }
    this.cleared = false;
    const st = this.st.open(time);
    for (const w of this.waves) w.mesh.visible = false;
    if (this.arms) this.arms.count = 0;
    for (const f of fighters.values()) {
      const s = f.state;
      if (s.fighter !== 'gummy' || s.action !== 'ultimate' || !s.alive) continue;
      this.ultimate(st, f, s.actionTime * s.actionDuration, time, fighters);
    }
    for (const r of this.rings) {
      const age = time - r.born; if (age < 0 || age > r.life) continue;
      const u = age / r.life; st.disc(r.at, r.radius, r.color, .7 * (1 - u * .6), WAVE, .08 + .92 * easeOut(u), 3);
    }
    for (let i = MONSOONS.length - 1; i >= 0; i--) if (!this.monsoon(st, MONSOONS[i], time, fighters)) { this.fired.delete(MONSOONS[i].key); MONSOONS.splice(i, 1); }
    st.close();
    if (this.arms) { this.arms.body.count = this.arms.ink.count = this.arms.count; this.arms.body.instanceMatrix.needsUpdate = true; }
  }

  // ------------------------------------------------------------------------------------------------- GRAND TIDE
  private ultimate(st: MoveStage, f: Fighter, t: number, time: number, fighters: ReadonlyMap<string, Fighter>) {
    const s = f.state, key = Math.round(s.actionStarted * 1000), local = involvesLocal(s.id, s.target ?? undefined);
    let cast = this.casts.get(s.id);
    if (!cast || cast.key !== key) {
      cast = { key, grabbed: false, gathered: false, landed: false, last: new THREE.Vector3().copy(f.handR), seen: time, dir: new THREE.Vector3(0, 0, 1), ground: new THREE.Vector3(), center: new THREE.Vector3(), side: new THREE.Vector3(1, 0, 0) };
      this.casts.set(s.id, cast); if (this.casts.size > 16) this.casts.delete(this.casts.keys().next().value!);
    }
    this.until = Math.max(this.until, time + 3.2);
    const victim = s.target ? fighters.get(s.target) : undefined, confirmed = s.confirmedAt !== undefined;
    // Where it all happens: the victim (or ahead of him), the line from him to them, and the floor there.
    if (victim && victim.state.alive) bodyCenter(victim, cast.center);
    else if (!cast.landed) { this.a.set(Math.sin(s.yaw ?? 0), 0, Math.cos(s.yaw ?? 0)); cast.center.copy(f.group.position).addScaledVector(this.a, 3.5).setY(f.group.position.y + 1); }
    cast.dir.subVectors(cast.center, f.group.position).setY(0);
    if (cast.dir.lengthSq() < .01) cast.dir.set(Math.sin(s.yaw ?? 0), 0, Math.cos(s.yaw ?? 0)); cast.dir.normalize();
    cast.side.crossVectors(UP, cast.dir).normalize();
    cast.ground.set(cast.center.x, floorUnder(cast.center.x, cast.center.y - 1, cast.center.z), cast.center.z);
    const hand = f.handR, handL = f.handL, kit = this.kit;
    this.rubberArms(f);

    // The wind-up: the throwing fist warming gold.
    if (t < TIDE.grab) st.glow(hand, .22 + .2 * t / TIDE.grab, GOLD, .25 * t / TIDE.grab);
    // The line: clamped on (a ring round the grip, sand off them) or closed on the air.
    if (!cast.grabbed && t >= TIDE.grab && (confirmed || s.whiffedAt !== undefined)) {
      cast.grabbed = true;
      const born = time - (t - TIDE.grab);
      bodyCenter(f, this.a); this.b.subVectors(hand, this.a).normalize();
      if (confirmed && victim) {
        this.c.copy(cast.center).lerp(hand, .4);
        kit.ring(this.c.x, this.c.y, this.c.z, .2, 1.9, born, .28, 0xffffff, SAND.element.rim, .1, 'plane', this.b.x, this.b.y, this.b.z);
        kit.streaks(this.c.x, this.c.y, this.c.z, SAND.element, kit.n(14, 5), 10, .03, born, this.b, .8);
        this.spray(cast.ground.x, cast.ground.y, cast.ground.z, -cast.dir.x, -cast.dir.z, 8, 3.5, .45, born, .55, 1);
        st.burst(this.c, SAND, .7, born, { dir: this.b, clean: true });
        if (local) SIGNATURE.screen?.speedLines?.(.6);
      } else this.clump(hand.x, hand.y, hand.z, -this.b.x, .5, -this.b.z, .4, born, .3, -.3, 3);
    }
    if (!confirmed) { cast.last.copy(hand); return; }

    // The haul: the line taut and humming gold from his shoulder to them until it lets go.
    if (t > TIDE.grab && t < TIDE.grab + .34) {
      const k = 1 - smooth(TIDE.grab + .22, TIDE.grab + .34, t);
      this.c.copy(f.group.position).setY(f.group.position.y + 1.35);
      st.streak(this.c, hand, .02 + .01 * Math.sin(time * 40), LINE, .6 * k, .2);
      st.glow(hand, .55, GOLD, .5 * k);
      // Sand dragged up at their feet as he hauls.
      if (st.tick) this.spray(cast.ground.x, cast.ground.y, cast.ground.z, -cast.dir.x, -cast.dir.z, 2, 2.5, .35, time, .45, .8);
    }
    // The gather: he plants; the floor answers round his feet and the sea begins to come up beyond them.
    const p = f.group.position, floorHere = floorUnder(p.x, p.y, p.z);
    if (!cast.gathered && t >= .86) {
      cast.gathered = true; const born = time - (t - .86);
      this.sandRing(p.x, floorHere, p.z, 16, .7, 4, .5, born, .7);
    }
    if (t > .86 && t < TIDE.blow) {
      for (let r = 0; r < 3; r++) { const age = ((t - .86) + r * .3) % .9; st.disc(this.a.set(p.x, floorHere, p.z), .6 + 3.2 * age, SAND.main, .55 * (1 - age / .9), WAVE, clamp(age / .9), r * 3.1); }
      if (local) st.dim(.32 * smooth(.9, 1.3, t), s.id);
    }

    // The low sun rising through the wave beyond them.
    const rise = smooth(WAVE_SHAPE.rise[0], WAVE_SHAPE.rise[1], t), sunUp = smooth(.9, 1.75, t), flare = t >= TIDE.blow ? Math.max(0, 1 - (t - TIDE.blow) / .5) : 0;
    const sunFade = 1 - smooth(TIDE.blow + .1, TIDE.blow + .7, t);
    if (sunUp > 0 && sunFade > 0) {
      // (Over the crest, not behind the face: a glow laid over the wave washed it out to a haze.)
      this.a.copy(cast.ground).addScaledVector(cast.dir, WAVE_SHAPE.back + 7).addScaledVector(UP, 1 + 5.6 * sunUp);
      st.glow(this.a, 2.3 + .4 * sunUp + 1.5 * flare, SUN_DISC, (.38 + .25 * sunUp) * sunFade);
      st.glow(this.a, 1.25 + .25 * sunUp, SUN_CORE, (.3 + .35 * sunUp + .4 * flare) * sunFade, GLOW, .5);
      st.glow(this.a, 4 + 3 * flare, SUN.main, .12 * sunUp * sunFade, STAR, .12, 3);
      st.light(this.b.copy(cast.ground).addScaledVector(UP, 1.2), 9, SUN, .35 * sunUp * sunFade);
    }

    // The arms: fists lit like the sun, a trail along the arc as they come over.
    const ph = hammerPhase(t);
    if (ph && ph.out > .2) {
      const glowK = Math.min(1, ph.up * 1.2) * Math.min(1, ph.out);
      for (const h of [hand, handL]) { st.glow(h, .3 + .15 * glowK, GOLD, .18 + .22 * glowK); st.glow(h, .7, SUN.main, .12 * glowK, RING, .05, 1); }
      if (ph.over > 0 && ph.over < 1) st.streak(cast.last, hand, .32, CREST, .9);
      if (ph.over > .05 && local) SIGNATURE.screen?.speedLines?.(.9);
    }
    cast.last.copy(hand);

    // The wave itself.
    if (t >= WAVE_SHAPE.rise[0] && t <= WAVE_SHAPE.sink[1]) this.drawWave(st, s.id, key, cast, t, time, rise);

    // The blow: fists and wave land together.
    if (!cast.landed && t >= TIDE.blow) {
      cast.landed = true; const born = time - (t - TIDE.blow), g = cast.ground, c = cast.center;
      st.burst(c, SAND, 3.0, born, { dir: cast.dir, floor: g.y, clean: true });
      st.dome(c, SAND, 3.4, born, .5);
      st.shatter(this.a.copy(c).addScaledVector(cast.dir, -.3), cast.dir, SAND, 2.6, born, .5);
      this.sandRing(g.x, g.y, g.z, 30, 1.6, 8, 1.1, born, 1.1);
      // The crown of sand thrown up and falling back, and gold glints in it.
      const dust = kit.dust, sp = dust.spec;
      for (let i = 0, n = kit.n(46, 18); i < n; i++) {
        const a = i / n * TAU + hash(i + key) * .5, out = 2 + 5 * hash(i * 3.1 + key), up = 5 + 7 * hash(i * 7.7 + key), sz = .35 + .5 * hash(i * 1.9);
        sp.reset(SPRITE.puff, born + .01 * hash(i), .9 + .5 * hash(i * 2.3)).pos(g.x + Math.cos(a) * .6, g.y + .3, g.z + Math.sin(a) * .6);
        sp.velocity(Math.cos(a) * out + cast.dir.x * 2, up, Math.sin(a) * out + cast.dir.z * 2); sp.gravity = 9; sp.drag = .9;
        sp.sized(sz * .5, sz, .4).hot(SAND_LIT, 1).cool(SAND_SHADE, .9); sp.bias = sz * .6; dust.emit();
      }
      const sparks = kit.sparks, gs = sparks.spec;
      for (let i = 0, n = kit.n(24, 10); i < n; i++) {
        const a = hash(i * 5.3 + key) * TAU, v = 4 + 7 * hash(i * 1.3 + key);
        gs.reset(SPRITE.star, born + .02, .5 + .4 * hash(i)).pos(c.x, c.y, c.z).velocity(Math.cos(a) * v, 3 + 6 * hash(i * 9.1), Math.sin(a) * v);
        gs.sized(.12, .05, .4).hot(GLINT, 2).cool(SAND.element.rim, .5); gs.gravity = 6; gs.drag = 1; sparks.emit();
      }
      if (local) { SIGNATURE.screen?.impactFrame?.(1); SIGNATURE.screen?.chromaticPulse?.(.8); }
    }
    // The wash: sand raining back, the stone left wet, ripples running out over it.
    if (t > TIDE.blow) {
      const age = t - TIDE.blow, fade = 1 - smooth(.5, 1.1, age), g = cast.ground;
      st.disc(g, 4.2, WET, .7 * (1 - smooth(.6, 1.4, age)), SHEEN, clamp(age / .25), 7);
      st.disc(g, 2 + 6 * clamp(age / .8), SAND.main, .5 * (1 - clamp(age / .8)), WAVE, clamp(age / .8), 2);
      st.disc(g, 2.8, SAND.rim, .5 * fade, BURN, .5, 4);
      for (let i = 0, n = st.n(36, 14); i < n; i++) {
        const h = hash(i * 4.4 + key), a = h * TAU, r = .4 + 3.6 * hash(i * 2.7 + key), y = g.y + Math.max(.05, 5.5 * hash(i * 6.1) - age * (6 + 5 * h));
        this.a.set(g.x + Math.cos(a) * r, y, g.z + Math.sin(a) * r); this.b.copy(this.a).setY(y + .3 + .2 * h);
        st.streak(this.a, this.b, .05, i % 3 ? SAND.main : SAND.core, .9 * fade);
      }
      st.light(this.a.copy(g).setY(g.y + 1), 7, SAND, .5 * fade);
    }
  }

  /** The wave: a sheet of sand climbing out of the floor `back` beyond the victim across the line to them, curling over
   *  them, crashing onto them with the blow and sinking back. Its lip streams dust; its crest is backlit by the sun. */
  private drawWave(st: MoveStage, owner: string, key: number, cast: Cast, t: number, time: number, rise: number) {
    const w = this.wave(owner, key);
    const curl = smooth(WAVE_SHAPE.curl[0], WAVE_SHAPE.curl[1], t);
    const u = clamp((t - WAVE_SHAPE.crash[0]) / (WAVE_SHAPE.crash[1] - WAVE_SHAPE.crash[0])), crash = u * u;
    const sink = smooth(WAVE_SHAPE.sink[0], WAVE_SHAPE.sink[1], t);
    const tall = WAVE_SHAPE.tall * (rise * (1 + .06 * Math.sin(Math.PI * rise))) * (1 - .85 * sink), back = WAVE_SHAPE.back;
    const g = cast.ground, F = cast.dir, L = cast.side, pos = w.pos;
    // Its profile across (z along the line, + beyond the victim; y up): a Bezier from its foot up its face to the lip.
    for (let i = 0; i <= NU; i++) {
      const x = i / NU, across = (x * 2 - 1) * WAVE_SHAPE.half, e = Math.pow(Math.max(0, 1 - (x * 2 - 1) ** 2), .55) * (.88 + .12 * Math.sin(x * 9.3 + key * .01));
      const H = tall * e, c = curl * (.35 + .65 * e), k = crash * (.4 + .6 * e);
      this.p0.set(back + .5, 0);
      this.p1.set(back + 1.0, .5 * H);
      this.p2.set(back - .1 - 1.5 * c, 1.04 * H).lerp(this.q.set(.9, Math.min(H, 1.8)), k);
      this.p3.set(back - .7 - 2.3 * c, H * (1 - .3 * c)).lerp(this.q.set(-.1 - .2 * e, .2), k);
      for (let j = 0; j <= NV; j++) {
        const v = j / NV, m = 1 - v;
        const z = m * m * m * this.p0.x + 3 * m * m * v * this.p1.x + 3 * m * v * v * this.p2.x + v * v * v * this.p3.x;
        const y = m * m * m * this.p0.y + 3 * m * m * v * this.p1.y + 3 * m * v * v * this.p2.y + v * v * v * this.p3.y;
        const ripple = .1 * Math.sin(v * 8 - time * 6 + x * 5) * v;
        pos.setXYZ(i * (NV + 1) + j, g.x + F.x * (z + ripple) + L.x * across, g.y + y, g.z + F.z * (z + ripple) + L.z * across);
      }
    }
    pos.needsUpdate = true; w.mesh.geometry.computeVertexNormals(); w.mesh.geometry.computeBoundingSphere();
    const m = w.mesh.material.uniforms;
    (m.uOrigin.value as THREE.Vector3).copy(g); (m.uDir.value as THREE.Vector3).copy(F);
    m.uTime.value = time; m.uGlow.value = .35 + .45 * smooth(1.2, 1.9, t); m.uOpacity.value = smooth(WAVE_SHAPE.rise[0], WAVE_SHAPE.rise[0] + .3, t) * (1 - smooth(TIDE.blow + .15, WAVE_SHAPE.sink[1], t));
    m.uCurl.value = curl;   // polish6: the barrel's dark band deepens as the lip curls over
    w.mesh.visible = m.uOpacity.value > .01;
    // polish6: spray off the crest, sharp strokes rather than puffs: foam flung off the lip along its curl (falling as it
    // goes), and spray blown back over the crest's top, each stroke running out and thinning on its own clock.
    const spray = rise * (1 - sink) * m.uOpacity.value;
    if (spray > .08) {
      for (let i = 3; i <= NU - 3; i += 3) {
        const top = i * (NV + 1) + NV, prev = top - 2, e = Math.pow(Math.max(0, 1 - (i / NU * 2 - 1) ** 2), .55);
        this.a.set(pos.getX(top), pos.getY(top), pos.getZ(top));
        this.b.set(pos.getX(prev), pos.getY(prev), pos.getZ(prev));
        this.c.subVectors(this.a, this.b).normalize();
        // flung off the lip
        for (let r = 0; r < 2; r++) {
          const ph = (time * (1.7 + .5 * hash(i * 1.3 + r)) + hash(i * 7.1 + r * 3.3)) % 1, len = (.35 + .55 * hash(i + r * 9.2)) * (.5 + .5 * e);
          this.d.copy(this.a).addScaledVector(this.c, .15 + ph * 1.3 * (.6 + .4 * e)).addScaledVector(UP, -ph * ph * .9);
          this.b.copy(this.d).addScaledVector(this.c, len * (1 - .6 * ph)).addScaledVector(UP, -.25 * ph);
          st.streak(this.d, this.b, .035 + .03 * (1 - ph), FOAM, .95 * spray * (1 - ph) * (.4 + .6 * e));
        }
        // blown back over the top: from the crest's highest point along this column, up and away from him
        let hj = NV, hy = -1e9;
        for (let j = NV - 12; j <= NV; j += 2) { const y = pos.getY(i * (NV + 1) + j); if (y > hy) { hy = y; hj = j; } }
        const apex = i * (NV + 1) + hj, ph = (time * 1.3 + hash(i * 2.9 + key)) % 1;
        this.d.set(pos.getX(apex), pos.getY(apex), pos.getZ(apex)).addScaledVector(F, .1 + .9 * ph).addScaledVector(UP, .05 + .5 * ph);
        this.b.copy(this.d).addScaledVector(F, .55 * (1 - ph) + .15).addScaledVector(UP, .3 * (1 - ph) + .1);
        st.streak(this.d, this.b, .03 + .025 * (1 - ph), FOAM, .7 * spray * (1 - ph) * e * curl);
      }
    }
    // Dust streaming off the lip; glints along the crest. (polish6: one puff a tick, the spray strokes carry the rest)
    if (st.tick && rise > .25 && sink < .6) {
      const dust = this.kit.dust, sp = dust.spec;
      for (let n = 0; n < 1; n++) {
        const i = Math.floor(hash(time * 7.3 + n * 1.7) * (NU - 4)) + 2, top = i * (NV + 1) + NV;
        this.a.set(pos.getX(top), pos.getY(top), pos.getZ(top));
        const sz = .28 + .2 * hash(n + time);
        sp.reset(SPRITE.puff, time, .55 + .3 * hash(n * 3 + time)).pos(this.a.x, this.a.y, this.a.z);
        sp.velocity(-F.x * (1.5 + 2 * crash) + (hash(n) - .5), .6 - 3 * crash, -F.z * (1.5 + 2 * crash)); sp.drag = 1.8; sp.gravity = crash > 0 ? 6 : -.4;
        sp.sized(sz * .5, sz, .5).hot(SAND_LIT, 1).cool(SAND_SHADE, .85); sp.bias = sz * .5; dust.emit();
      }
    }
    // The crest's light and the lip's line of gold. (polish6: tighter and fainter: wide glows over the lip blurred its edge)
    for (let i = 4; i <= NU - 4; i += 6) {
      const top = i * (NV + 1) + NV; this.a.set(pos.getX(top), pos.getY(top), pos.getZ(top));
      st.glow(this.a, .45, CREST, .1 * rise * (1 - sink));
    }
    st.light(this.a.copy(cast.ground).addScaledVector(F, back * .5).addScaledVector(UP, 2), 8, SAND, .28 * rise * (1 - sink));
  }

  private wave(owner: string, key: number): WaveMesh {
    let w = this.waves.find(m => m.owner === owner && m.key === key) ?? this.waves.find(m => !m.mesh.visible && m.owner === owner) ?? this.waves.find(m => !m.mesh.visible);
    if (!w) {
      // Column-major: vertex i*(NV+1)+j is across i, up j.
      const count = (NU + 1) * (NV + 1), uv = new Float32Array(count * 2), index: number[] = [];
      for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) { const k = i * (NV + 1) + j; uv[k * 2] = i / NU; uv[k * 2 + 1] = j / NV; }
      for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; index.push(a, b, a + 1, b, b + 1, a + 1); }
      const g = new THREE.BufferGeometry();
      const pos = new THREE.BufferAttribute(new Float32Array(count * 3), 3); pos.setUsage(THREE.DynamicDrawUsage);
      g.setAttribute('position', pos); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(index);
      const material = new THREE.ShaderMaterial({ name: 'LucyTideWave', vertexShader: waveVertex, fragmentShader: waveFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
        uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uGlow: { value: 0 }, uSeed: { value: Math.random() * 10 }, uOrigin: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, 0, 1) }, uBack: { value: WAVE_SHAPE.back }, uCurl: { value: 0 } } });
      const mesh = new THREE.Mesh(g, material); mesh.name = 'lucy-tide-wave'; mesh.frustumCulled = false; mesh.renderOrder = 2; mesh.visible = false;
      this.scene.add(mesh);
      w = { mesh, pos, owner, key }; this.waves.push(w);
    }
    w.owner = owner; w.key = key; w.mesh.visible = true;
    return w;
  }

  // ------------------------------------------------------------------------------------------------- MONSOON
  /** One MONSOON this frame; false once it is spent. */
  private monsoon(st: MoveStage, m: MonsoonCast, time: number, fighters: ReadonlyMap<string, Fighter>): boolean {
    const last = m.strikes[m.strikes.length - 1];
    if (time > last + 2.2 || time < m.release - 1) return false;
    this.until = Math.max(this.until, last + 2.2);
    const kit = this.kit, floor = floorUnder(m.at.x, m.at.y, m.at.z), R = m.radius, seed = (m.release * 97) % 31;
    const local = involvesLocal(m.actorId);
    // Where the caster drove his fists in: his body when the release came (else where the cast says).
    const caster = fighters.get(m.actorId);
    if (time - m.release < .05 && caster) m.from.copy(caster.group.position);
    const fromFloor = floorUnder(m.from.x, m.from.y, m.from.z);
    this.d.subVectors(m.at, m.from).setY(0); const span = this.d.length(); if (span > .01) this.d.divideScalar(span); else this.d.set(0, 0, 1);
    // The slam where his fists went in.
    const fired = this.fired.get(m.key) ?? -1;
    if (fired < 0 && time >= m.release) {
      this.fired.set(m.key, 0); const born = m.release;
      this.a.copy(m.from).addScaledVector(this.d, .7).setY(fromFloor);
      st.burst(this.b.copy(this.a).setY(fromFloor + .25), SAND, .8, born, { floor: fromFloor, clean: true });
      this.sandRing(this.a.x, fromFloor, this.a.z, 14, .4, 4, .45, born, .6);
    }
    // The ridge: sand heaving up along the floor from his fists to the circle as the seal fills, a spray at its front.
    const first = m.strikes[0], k = smooth(m.release, first, time) ** .9;
    if (time >= m.release && time < first + .2) {
      const reach = Math.max(0, span - R * .2) * k + .7;
      this.a.copy(m.from).addScaledVector(this.d, .7).setY(fromFloor + .06);
      this.b.copy(m.from).addScaledVector(this.d, Math.min(span, reach)); this.b.y = floorUnder(this.b.x, this.b.y, this.b.z) + .06;
      st.streak(this.a, this.b, .22, SAND.rim, .8 * (1 - smooth(first, first + .2, time)));
      st.streak(this.a, this.b, .07, SAND.main, 1.1 * (1 - smooth(first, first + .2, time)));
      st.disc(this.b, 1.1, SAND.main, .6, WAVE, (time * 3) % 1, seed);
      st.glow(this.c.copy(this.b).setY(this.b.y + .3), .7, GOLD, .45);
      if (st.tick) {
        for (let n = 0; n < 4; n++) { const a = hash(time * 13 + n) * TAU, sz = .22 + .18 * hash(n + time); this.clump(this.b.x, this.b.y + .1, this.b.z, Math.cos(a) * 1.3 + this.d.x * 1.5, 3 + 2.5 * hash(n * 2 + time), Math.sin(a) * 1.3 + this.d.z * 1.5, sz, time, .55); }
      }
    }
    // The strikes: a ring of spouts round the rim, a ring inside it, then the column through the middle.
    let shown = this.fired.get(m.key) ?? 0;
    for (let i = shown; i < m.strikes.length && time >= m.strikes[i]; i++) { this.strike(st, m, i, m.strikes[i], floor, local); shown = i + 1; }
    this.fired.set(m.key, shown);
    for (let i = 0; i < m.strikes.length; i++) {
      const age = time - m.strikes[i]; if (age < 0 || age > .7) continue;
      const final = i === m.strikes.length - 1, spouts = final ? 1 : i === 0 ? 7 : 5, r = final ? 0 : i === 0 ? R * .78 : R * .42;
      for (let j = 0; j < spouts; j++) {
        const a = j / spouts * TAU + i * .7 + seed, x = m.at.x + Math.cos(a) * r, z = m.at.z + Math.sin(a) * r;
        const top = (final ? 7.5 : 3.2 + .8 * hash(j + i * 7)) * easeOut(age / .18) * (1 - smooth(.25, .7, age) * .7), wide = (final ? .75 : .28) * (1 - smooth(.3, .7, age) * .6);
        const fade = 1 - smooth(.35, .7, age);
        this.a.set(x, floor, z); this.b.set(x + (hash(j + 3.3) - .5) * .3, floor + top, z + (hash(j + 5.1) - .5) * .3);
        st.streak(this.a, this.b, wide, SAND_DARK, 1.2 * fade); st.streak(this.a, this.b, wide * .6, SAND_BODY, 1 * fade); st.streak(this.a, this.b, wide * .14, SAND.core, .3 * fade);
        st.glow(this.b, wide * 1.6, SAND_BODY, .2 * fade);
        st.disc(this.a, wide * 4, SAND.main, .55 * fade, WAVE, clamp(age / .5), j);
      }
      if (final) st.light(this.c.set(m.at.x, floor + 2, m.at.z), R * 2 + 4, SAND, .7 * (1 - smooth(.2, .7, age)));
    }
    // After the column: a rain of sand over the circle, the floor left wet, rings running out.
    const after = time - last;
    if (after > 0) {
      const fade = 1 - smooth(.8, 1.6, after);
      for (let i = 0, n = st.n(34, 12); i < n; i++) {
        const h = hash(i * 3.7 + seed), a = h * TAU, rr = R * Math.sqrt(hash(i * 1.9 + seed)), y = floor + Math.max(.05, 7 * hash(i * 5.3) - after * (6.5 + 4 * h));
        this.a.set(m.at.x + Math.cos(a) * rr, y, m.at.z + Math.sin(a) * rr); this.b.copy(this.a).setY(y + .35);
        st.streak(this.a, this.b, .05, i % 4 ? SAND.main : SAND.core, .85 * fade);
      }
      st.disc(this.a.set(m.at.x, floor, m.at.z), R * 1.05, WET, .6 * (1 - smooth(.6, 1.6, after)), SHEEN, clamp(after / .3), seed);
    }
    return true;
  }
  /** A strike landing: its spouts' bursts (the column's is the big one). */
  private strike(st: MoveStage, m: MonsoonCast, i: number, born: number, floor: number, local: boolean) {
    const kit = this.kit, final = i === m.strikes.length - 1, R = m.radius, seed = (m.release * 97) % 31;
    const spouts = final ? 1 : i === 0 ? 7 : 5, r = final ? 0 : i === 0 ? R * .78 : R * .42;
    const dust = kit.dust, sp = dust.spec;
    for (let j = 0; j < spouts; j++) {
      const a = j / spouts * TAU + i * .7 + seed, x = m.at.x + Math.cos(a) * r, z = m.at.z + Math.sin(a) * r;
      const n = kit.n(final ? 40 : 14, final ? 16 : 6), up = final ? 11 : 7.5;
      for (let q = 0; q < n; q++) {
        const b = hash(q * 2.1 + j + i * 9) * TAU, out = (final ? 3.5 : 1.4) * hash(q * 4.7 + j), sz = (final ? .45 : .32) + .3 * hash(q);
        sp.reset(SPRITE.puff, born + .015 * hash(q * 1.3), .7 + .4 * hash(q * 3.3)).pos(x, floor + .2, z);
        sp.velocity(Math.cos(b) * out, up * (.6 + .4 * hash(q * 6.6 + j)), Math.sin(b) * out); sp.gravity = 9; sp.drag = .7;
        sp.sized(sz * .5, sz, .4).hot(SAND_LIT, 1).cool(SAND_SHADE, .9); sp.bias = sz * .5; dust.emit();
      }
      kit.ring(x, floor + .05, z, .2, final ? 2.6 : 1.1, born, .35, 0xffffff, SAND.element.rim, .1, 'flat');
    }
    this.a.set(m.at.x, floor, m.at.z);
    if (final) {
      st.burst(this.b.set(m.at.x, floor + 1.2, m.at.z), SAND, 1.6, born, { floor, clean: true });
      this.sandRing(m.at.x, floor, m.at.z, 26, R * .5, 7, .8, born, 1);
    } else { const r = this.rings[this.ringNext++ % this.rings.length]; r.at.set(m.at.x, floor, m.at.z); r.radius = R * (i === 0 ? 1.3 : 1); r.born = born; r.life = .45; r.color = SAND_BODY; }
    void local;
  }

  reset() { MONSOONS.length = 0; this.casts.clear(); this.fired.clear(); for (const w of this.waves) w.mesh.visible = false; this.until = -1e9; }
  dispose() { if (this.arms) { this.arms.body.removeFromParent(); this.arms.ink.removeFromParent(); this.arms.body.geometry.dispose(); (this.arms.body.material as THREE.Material).dispose(); (this.arms.ink.material as THREE.Material).dispose(); this.arms = undefined; }
    for (const w of this.waves) { w.mesh.removeFromParent(); w.mesh.geometry.dispose(); w.mesh.material.dispose(); } this.waves = []; if (this.stage) { this.stage.release(); this.stage = undefined; } }
}
const easeOut = (v: number) => 1 - (1 - clamp(v)) ** 3;
