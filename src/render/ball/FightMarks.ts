import * as THREE from 'three';
import {BALL_TEAM_COLOURS, GOAL_RULES, otherTeam, shortSide, type BallEvent, type BallTeam, type BallView} from '../../game/ball/model';
import {goalZ} from '../../game/ball/physics';

/** Instances a frame: the glowing goal's mouth and its line on the floor, and the marks running (MARKS of them). */
const MARKS = 4, CAP = 2 + MARKS;
/** What each instance is drawn as (the fragment shader's branches): the mouth stands up in the goal, the rest lie on the
 *  floor. */
const KIND = {mouth: 0, line: 1, won: 2, reversal: 3} as const;
/** The goal's glow: how fast it comes up and goes (1/s), how deep its band on the floor reaches into the pitch (m), how
 *  bright it is at its brightest, and its throb (Hz). */
const GLOW = {rate: 5, band: 2.6, alpha: 1, throb: 1.6} as const;
/** A TACKLE that won the ball: its ring on the floor at the carrier's feet, thrown toward the tackler (m across at its
 *  widest, s). A REVERSAL: its ring closing in on the guard as it twists (m across, s). */
const WON = {size: 4, life: .55} as const, REVERSED = {size: 3.6, life: .5} as const;
/** Light added, its colour already weighed by its strength (the arena's neon is drawn so: a light, never a paint). */
const ADDITIVE = {transparent: true, depthWrite: false, forceSinglePass: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, side: THREE.DoubleSide} as const;
const TEAM: Record<BallTeam, THREE.Color> = {red: new THREE.Color(BALL_TEAM_COLOURS.red), blue: new THREE.Color(BALL_TEAM_COLOURS.blue)};

/**
 * Goal Rush's fight paid in the sport (the rules are BallMatch's TACKLE_WON and REVERSAL, the POWER PLAY model.ts
 * shortSide), drawn in the world:
 * - **The POWER PLAY:** while a side has a body wiped out, its goal glows in the colour of the side up a body - its
 *   frame and mouth lit from the posts and the bar in, a band of it on the floor in front of the line - throbbing gently,
 *   up and down over a fifth of a second. The score bug says the count (BallHud).
 * - **A TACKLE that won the ball:** a ring in the tackler's side's colour thrown out across the floor from the carrier's
 *   feet, its open side toward the tackler, the way the ball pops (LOOSE): won, and where it went.
 * - **A REVERSAL:** a ring in the guard's side's colour closing in on their feet as it twists: turned.
 * Nothing else - no flash, no print (BallMoments' quiet rule). One instanced draw, added only while something is lit;
 * nothing is allocated in a frame.
 */
export class FightMarks {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly pos: THREE.InstancedBufferAttribute;
  private readonly look: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly time = {value: 0};
  /** The glow's side and how far up it is (0-1). */
  private glowTeam: BallTeam | null = null; private glow = 0;
  private readonly marks = Array.from({length: MARKS}, () => ({kind: 0, x: 0, z: 0, dx: 0, dz: 1, team: 'red' as BallTeam, t: 1, life: 1}));

  constructor(parent: THREE.Object3D) {
    const quad = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index; geometry.setAttribute('position', quad.getAttribute('position')); quad.dispose();
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aPos', this.pos); geometry.setAttribute('aLook', this.look); geometry.setAttribute('aTint', this.tint); geometry.instanceCount = 0;
    const W = GOAL_RULES.goalHalfWidth + GOAL_RULES.post, H = GOAL_RULES.goalHeight + GOAL_RULES.post;
    const material = new THREE.ShaderMaterial({
      name: 'Goal Rush fight marks', ...ADDITIVE, toneMapped: false, depthTest: true,
      uniforms: {uTime: this.time, uMouth: {value: new THREE.Vector2(W, H)}, uBand: {value: GLOW.band}},
      // aPos: x, y, z, size (m); aLook: kind, progress (0-1; the mouth's and line's: how lit), and a direction on the
      // floor (the mouth's: which way the pitch is, +1 or -1 along z); aTint: colour and alpha.
      vertexShader: `attribute vec4 aPos;attribute vec4 aLook;attribute vec4 aTint;uniform vec2 uMouth;uniform float uBand;
        varying vec2 vUv;varying vec4 vLook;varying vec4 vTint;
        void main(){
          vUv=position.xy+.5;vLook=aLook;vTint=aTint;vec3 p;
          if(aLook.x<.5){
            // The mouth: stood up across the goal, a hand in front of its line.
            p=vec3(aPos.x+position.x*uMouth.x*2.,aPos.y+(position.y+.5)*uMouth.y,aPos.z);
          }else if(aLook.x<1.5){
            // The band on the floor in front of the line, reaching into the pitch.
            p=vec3(aPos.x+position.x*uMouth.x*2.,aPos.y,aPos.z+(position.y+.5)*uBand*aLook.z);
          }else p=vec3(aPos.x+position.x*aPos.w,aPos.y,aPos.z-position.y*aPos.w);
          gl_Position=projectionMatrix*viewMatrix*vec4(p,1.);
        }`,
      fragmentShader: `uniform float uTime;uniform vec2 uMouth;varying vec2 vUv;varying vec4 vLook;varying vec4 vTint;
        void main(){
          float a=0.;
          if(vLook.x<.5){
            // The frame lit from the posts and the bar in, the mouth a soft wash, brightest low; a slow throb.
            float side=min(vUv.x,1.-vUv.x)*uMouth.x*2.,top=(1.-vUv.y)*uMouth.y,edge=min(side,top);
            a=(exp(-edge*3.)*2.2+.3*(1.-vUv.y))*(.8+.2*sin(uTime*${(GLOW.throb * Math.PI * 2).toFixed(4)}));
            a*=vLook.y;
          }else if(vLook.x<1.5){
            // The band: brightest on the line, fading into the pitch, softer at its ends.
            float ends=smoothstep(0.,.12,min(vUv.x,1.-vUv.x));
            a=exp(-vUv.y*2.2)*ends*vLook.y;
          }else{
            vec2 q=vUv*2.-1.;float r=length(q),t=vLook.y;
            if(vLook.x<2.5){
              // Won: a ring thrown out, open on the tackler's side (the way the ball popped).
              float rad=mix(.25,.92,1.-pow(1.-t,3.)),w=mix(.16,.05,t);
              float ring=smoothstep(w,0.,abs(r-rad));
              float toward=dot(normalize(q+1e-4),normalize(vLook.zw*vec2(1.,-1.)+1e-4));
              a=ring*smoothstep(.75,.35,toward)*(1.-t)*1.8;
              // Three short marks along the way it went, running out.
              float along=dot(q,normalize(vLook.zw*vec2(1.,-1.)+1e-4)),across=abs(q.x*vLook.w+q.y*vLook.z);
              a+=smoothstep(.06,0.,across)*step(.2,along)*step(along,.25+.7*t)*smoothstep(.0,.15,fract(along*4.-t*3.))*(1.-t)*.9;
            }else{
              // Reversal: a ring closing in as it twists.
              float rad=mix(.95,.3,t),ang=atan(q.y,q.x)+t*5.;
              float ring=smoothstep(.09,0.,abs(r-rad))*(.55+.45*step(0.,sin(ang*3.)));
              a=ring*(1.-t*t)*1.8;
            }
          }
          a*=vTint.a;
          if(a<.004)discard;
          gl_FragColor=vec4(vTint.rgb*a,a);
        }`,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    // (Drawn after the arena's own see-through pieces - the net, the crowd's cards - or they cover it.)
    this.mesh.name = 'Goal Rush · the fight paid in the sport'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 11; this.mesh.visible = false;
    parent.add(this.mesh);
  }

  /** A moment of the match: a TACKLE that won the ball, or a REVERSAL, marked where it happened. */
  moment(e: BallEvent, view: BallView) {
    if (view.mode !== 'goal-rush') return;
    const won = e.kind === 'tackle' && !!e.won;
    if (!won && e.kind !== 'reversal') return;
    const m = this.marks.reduce((a, c) => c.t / c.life > a.t / a.life ? c : a);
    // (Won: thrown toward the tackler, from the carrier's feet - the tackler is the actor; a REVERSAL at the guard's.)
    const by = won ? e.actorId : undefined, to = by ? view.seats.find(s => s.id === by) : undefined;
    m.kind = won ? KIND.won : KIND.reversal; m.x = e.x; m.z = e.z; m.t = 0; m.life = won ? WON.life : REVERSED.life;
    m.team = e.team ?? to?.team ?? 'red'; m.dx = 0; m.dz = 1;
    if (won && this.toward) { const dx = this.toward(by!), d = dx ? Math.hypot(dx.x - e.x, dx.z - e.z) : 0; if (dx && d > .05) { m.dx = (dx.x - e.x) / d; m.dz = (dx.z - e.z) / d; } }
  }
  /** Where a seat's body is drawn now (BallField's), for the way a won ball went. */
  toward: ((id: string) => {x: number; z: number} | undefined) | null = null;

  /** Every frame (`dt` s; `seconds` the page's clock). */
  update(view: BallView, dt: number, seconds: number) {
    this.time.value = seconds;
    // The POWER PLAY: the short side's goal, in the colour of the side up a body.
    const live = view.mode === 'goal-rush' && !view.practice && (view.phase === 'live' || view.phase === 'kickoff');
    const short = live ? shortSide(view.seats) : null;
    if (short) this.glowTeam = short;
    this.glow = Math.max(0, Math.min(1, this.glow + (short ? 1 : -1) * GLOW.rate * dt));
    if (!this.glow) this.glowTeam = null;
    let n = 0;
    const pos = this.pos.array as Float32Array, look = this.look.array as Float32Array, tint = this.tint.array as Float32Array;
    const put = (x: number, y: number, z: number, w: number, kind: number, p: number, lx: number, ly: number, c: THREE.Color, a: number) => {
      const o = n * 4; pos[o] = x; pos[o + 1] = y; pos[o + 2] = z; pos[o + 3] = w; look[o] = kind; look[o + 1] = p; look[o + 2] = lx; look[o + 3] = ly;
      tint[o] = c.r; tint[o + 1] = c.g; tint[o + 2] = c.b; tint[o + 3] = a; n++;
    };
    if (this.glowTeam) {
      const z = goalZ(this.glowTeam), into = -Math.sign(z), c = TEAM[otherTeam(this.glowTeam)], k = this.glow * this.glow * (3 - 2 * this.glow);
      put(0, 0, z + into * .12, 0, KIND.mouth, k, into, 0, c, GLOW.alpha);
      put(0, .05, z, 0, KIND.line, k, into, 0, c, GLOW.alpha);
    }
    for (const m of this.marks) {
      if (m.t >= m.life) continue;
      m.t += dt;
      if (m.t >= m.life) continue;
      put(m.x, .07, m.z, m.kind === KIND.won ? WON.size : REVERSED.size, m.kind, m.t / m.life, m.dx, m.dz, TEAM[m.team], 1);
    }
    this.mesh.geometry.instanceCount = n; this.mesh.visible = n > 0;
    if (n) { this.pos.needsUpdate = true; this.look.needsUpdate = true; this.tint.needsUpdate = true; }
  }
  /** What is lit now (for the checks and the captures). */
  state() { return {glow: this.glowTeam, lit: +this.glow.toFixed(2), marks: this.marks.filter(m => m.t < m.life).map(m => m.kind === KIND.won ? 'won' : 'reversal')}; }
  clear() { this.glow = 0; this.glowTeam = null; for (const m of this.marks) m.t = m.life; this.mesh.geometry.instanceCount = 0; this.mesh.visible = false; }
}
