import * as THREE from 'three';
import {BALL_TEAM_COLOURS, type BallEvent, type BallTeam, type BallView} from '../../game/ball/model';

/** Instances a frame: your own ring, the lock's reticle and chevron, and every other seat's lock and warning. */
const CAP = 16;
/** What each instance is drawn as (the fragment shader's branches); CHEVRON stands up facing the lens, the rest lie on
 *  the floor. */
const KIND = {ball: 0, fight: 1, reticle: 2, hunter: 3, hunted: 4, chevron: 5, tackle: 6} as const;
/** A TACKLE's shock ring on the floor: how long it runs, and how many at once. */
const BURST = .7, BURSTS = 3;
const PREMULTIPLIED = {transparent: true, depthWrite: false, forceSinglePass: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor} as const;
const GOLD = new THREE.Color(1, .78, .3), FIGHT = new THREE.Color(1, .16, .2);
const TEAM: Record<BallTeam, THREE.Color> = {red: new THREE.Color(BALL_TEAM_COLOURS.red), blue: new THREE.Color(BALL_TEAM_COLOURS.blue)};

/**
 * Goal Rush's stances on the pitch (game/ball/stance.ts): what the stance is, read at a glance
 * under the feet, in the world, so a split screen's each half sees its own.
 * - **Yours, BALL:** a thin gold ring with a pointer at its rim turned to the ball - you are playing the ball.
 * - **Yours, FIGHT:** a heavier red ring, toothed like a saw and turning - you are fighting.
 * - **The one you lock:** red brackets closing round their feet and a red chevron over their head, pulsing.
 * - **Anyone else locked on somebody:** a thin toothed ring in their side's colour under them (they are hunting), and
 *   when it is you they hunt, a red pulse under you - so a tackle coming is seen before it lands.
 * One instanced draw of quads; nothing is allocated in a frame. (The sides' own rings under every fighter are
 * BallField's.)
 */
export class StanceMarks {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly pos: THREE.InstancedBufferAttribute;
  private readonly look: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly time = {value: 0};
  private n = 0;
  private readonly at = new THREE.Vector3();
  /** The lock's reticle closes in when it is new (seconds since the lock changed). */
  private lockAge = 0;
  private lockShown: string | null = null;
  /** The room's events read so far (each once), and the TACKLE rings running. */
  private seen = -1;
  private readonly bursts = Array.from({length: BURSTS}, () => ({x: 0, z: 0, t: 1}));
  /** Each new event of the match, once (main.ts: the lens's punch on a TACKLE). */
  onEvent: (e: BallEvent) => void = () => {};

  constructor(parent: THREE.Object3D) {
    const quad = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index; geometry.setAttribute('position', quad.getAttribute('position')); quad.dispose();
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aPos', this.pos); geometry.setAttribute('aLook', this.look); geometry.setAttribute('aTint', this.tint); geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      name: 'Ball stance marks', ...PREMULTIPLIED, toneMapped: false, depthTest: true,
      uniforms: {uTime: this.time},
      vertexShader: `attribute vec4 aPos;attribute vec4 aLook;attribute vec4 aTint;varying vec2 vUv;varying vec4 vLook;varying vec4 vTint;
        void main(){
          vUv=position.xy*2.;vLook=aLook;vTint=aTint;
          if(aLook.x>4.5){
            // The chevron: stood up facing the lens, its size held on screen a little as it goes far.
            vec4 mv=viewMatrix*vec4(aPos.xyz,1.);
            float s=aPos.w*clamp(-mv.z*.06,.8,2.2);
            mv.xy+=position.xy*s;
            gl_Position=projectionMatrix*mv;
          }else{
            vec3 w=vec3(aPos.x+position.x*aPos.w,aPos.y,aPos.z-position.y*aPos.w);
            gl_Position=projectionMatrix*viewMatrix*vec4(w,1.);
          }
        }`,
      fragmentShader: `uniform float uTime;varying vec2 vUv;varying vec4 vLook;varying vec4 vTint;
        float band(float d,float w){float px=max(fwidth(d),.003);return 1.-smoothstep(w,w+px,abs(d));}
        void main(){
          float kind=vLook.x,ang=vLook.y,alpha=vLook.z,spin=vTint.w;
          if(kind>5.5){
            // A TACKLE: a red shock ring racing out over the floor with ink cracks, thinning (ang: how far through, 0-1).
            float t=ang,rr=mix(.25,.95,1.-pow(1.-t,3.));
            float ring=band(length(vUv)-rr,mix(.09,.015,t));
            float a2=atan(vUv.x,vUv.y),crack=step(.82,fract(a2/6.28318*9.+.13))*band(length(vUv)-rr*.8,.08);
            float al2=(ring+crack*.7)*(1.-t)*alpha;
            gl_FragColor=vec4(vTint.rgb*1.6*al2,al2);return;
          }
          vec3 col=vTint.rgb;
          float r=length(vUv),a=atan(vUv.x,vUv.y);
          float cover=0.,glow=0.;
          if(kind<.5){
            // BALL: a thin gold ring, and a pointer at its rim turned to the ball.
            cover=band(r-.82,.035);
            float off=abs(atan(sin(a-ang),cos(a-ang)));
            float tip=(1.-smoothstep(.0,.36,off))*band(r-.92+off*.25,.06+.04*(1.-off));
            cover=max(cover,tip);glow=cover;
          }else if(kind<1.5){
            // FIGHT: a heavier red ring, toothed and turning.
            float t=fract((a+uTime*spin)/6.28318*10.);
            float tooth=.8+.1*(1.-abs(t*2.-1.));
            cover=max(band(r-.78,.045),(1.-smoothstep(tooth-.02,tooth,r))*smoothstep(.79,.81,r));
            glow=cover;
          }else if(kind<2.5){
            // The lock: four brackets closing round the feet (ang: how far closed, 0 open to 1 home), an inner ring.
            float k=clamp(ang,0.,1.),rr=mix(1.25,.86,k);
            vec2 p=vUv;float c=cos(uTime*spin),s=sin(uTime*spin);p=mat2(c,-s,s,c)*p;
            vec2 q=abs(p);float corner=max(q.x,q.y);
            float edge=band(corner-rr*.72,.045)*step(.32*rr,min(q.x,q.y));
            float pulse=.7+.3*sin(uTime*9.);
            cover=max(edge,band(r-.6,.025)*.8*pulse);glow=cover*1.3;
          }else if(kind<3.5){
            // Somebody hunting: a thin toothed ring in their colour.
            float t=fract((a+uTime*spin)/6.28318*8.);
            cover=band(r-.84,.03)*step(.35,t);glow=cover*.8;
          }else if(kind<4.5){
            // Hunted: a red pulse running out from under you.
            float t=fract(uTime*1.6);
            cover=band(r-(.45+t*.5),.05)*(1.-t)+band(r-.86,.02)*.6;glow=cover;
          }else{
            // The chevron over the lock's head: a downward arrow with an ink edge.
            vec2 p=vUv*vec2(1.,1.);p.y+=.15;
            float body=step(abs(p.x)*1.25-.05,(p.y+.55))*step(p.y,.35)*step(abs(p.x),.9);
            float notch=step(abs(p.x)*1.25+.25,(p.y+.55));
            float inner=body*(1.-notch);
            float ink=step(abs(p.x)*1.25-.18,(p.y+.7))*step(p.y,.48)*step(abs(p.x),1.)*(1.-step(abs(p.x)*1.25+.12,(p.y+.4)));
            cover=max(inner,ink*.9);
            col=mix(vec3(.02),col,inner);glow=inner;
          }
          float al=cover*alpha;
          gl_FragColor=vec4(col*(glow*1.25+.06)*al,al);
        }`,
    });
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.name = 'Ball stance marks'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 13;
    parent.add(this.mesh);
  }

  /**
   * Every frame. `self` is whose rings are drawn as yours (the page's seat), `lock` the FIGHT stance's opponent as this
   * page has it (null: BALL), `ball` where the ball is drawn, `at` where a seat's body is drawn (null: not shown).
   */
  update(dt: number, view: BallView | undefined, self: string, lock: string | null, ball: THREE.Vector3 | null, at: (id: string) => THREE.Vector3 | undefined, show: boolean) {
    this.time.value += dt;
    this.n = 0;
    if (view) this.read(view);
    for (const b of this.bursts) if (b.t < 1) { b.t = Math.min(1, b.t + dt / BURST); if (show) this.put(KIND.tackle, b.x, b.z, 3.2, b.t, 1, FIGHT, 0); }
    if (!show || !view || view.mode !== 'goal-rush' || view.practice || (view.phase !== 'live' && view.phase !== 'kickoff')) { this.flush(); return; }
    if (lock !== this.lockShown) { this.lockShown = lock; this.lockAge = 0; } else this.lockAge += dt;
    let mine: BallTeam | undefined;
    for (const s of view.seats) if (s.id === self) mine = s.team;
    const me = at(self);
    let hunted = false;
    for (const s of view.seats) {
      if (s.out !== undefined || s.id === self) continue;
      if (s.lock === self && s.team !== mine) hunted = true;
      // Someone else locked on somebody: their ring.
      if (s.lock) { const p = at(s.id); if (p) this.put(KIND.hunter, p.x, p.z, 1.15, 0, .85, TEAM[s.team], .8, p.y); }
    }
    if (me) {
      if (lock) this.put(KIND.fight, me.x, me.z, 1.35, 0, 1, FIGHT, .9, me.y);
      else {
        const ang = ball ? Math.atan2(ball.x - me.x, ball.z - me.z) : 0;
        this.put(KIND.ball, me.x, me.z, 1.3, ang, ball ? .95 : .5, GOLD, 0, me.y);
      }
      if (hunted) this.put(KIND.hunted, me.x, me.z, 1.6, 0, .9, FIGHT, 0, me.y);
    }
    const foe = lock ? at(lock) : undefined;
    if (foe) {
      const close = 1 - Math.exp(-this.lockAge * 9);
      this.put(KIND.reticle, foe.x, foe.z, 1.9, close, 1, FIGHT, 1.4, foe.y);
      this.at.set(foe.x, foe.y + 3.15 + Math.sin(this.time.value * 5) * .1, foe.z);
      this.put(KIND.chevron, this.at.x, this.at.z, .42, 0, 1, FIGHT, 0, this.at.y);
    }
    this.flush();
  }

  /** The match's new events, each once; a page that joins late hears none of the backlog. */
  private read(view: BallView) {
    const events = view.events, last = events.length ? events[events.length - 1].id : 0;
    if (last < this.seen) this.seen = -1;
    if (this.seen < 0) { this.seen = last; return; }
    for (const e of events) {
      if (e.id <= this.seen) continue;
      if (e.kind === 'tackle') { const b = this.bursts.reduce((a, c) => c.t > a.t ? c : a); b.x = e.x; b.z = e.z; b.t = 0; }
      this.onEvent(e);
    }
    this.seen = last;
  }

  private put(kind: number, x: number, z: number, size: number, ang: number, alpha: number, colour: THREE.Color, spin: number, y = 0) {
    if (this.n >= CAP) return;
    const k = this.n * 4, pos = this.pos.array as Float32Array, look = this.look.array as Float32Array, tint = this.tint.array as Float32Array;
    pos[k] = x; pos[k + 1] = kind === KIND.chevron ? y : .05; pos[k + 2] = z; pos[k + 3] = size;
    look[k] = kind; look[k + 1] = ang; look[k + 2] = alpha; look[k + 3] = 0;
    tint[k] = colour.r; tint[k + 1] = colour.g; tint[k + 2] = colour.b; tint[k + 3] = spin;
    this.n++;
  }
  private flush() {
    const g = this.mesh.geometry; g.instanceCount = this.n; this.mesh.visible = this.n > 0;
    for (const attr of [this.pos, this.look, this.tint]) { attr.clearUpdateRanges(); attr.addUpdateRange(0, Math.max(1, this.n) * 4); attr.needsUpdate = true; }
  }
  clear() { this.n = 0; this.lockShown = null; this.seen = -1; for (const b of this.bursts) b.t = 1; this.flush(); }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
