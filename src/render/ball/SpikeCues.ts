import * as THREE from 'three';
import {BALL_TEAM_COLOURS, SPIKE_RULES, otherTeam, type BallTeam, type BallView} from '../../game/ball/model';
import {jumpArc} from '../../game/moves';
import {VOLLEY, volleyArc} from '../../game/ball/volley';
import type {FighterId, PlayerState} from '../../game/types';

/** The timing the cues teach, as the room judges it (game/ball/BallMatch.ts PERFECT_SPIKE and SERVE_RULES): a spike or a
 *  JUMP SERVE swung with the body at `apex` of its jump's top or more is PERFECT (judged from where the swing left as
 *  well as where it landed - online, with the page's own fighter drawn where the room has it, a swing pressed as the
 *  glint flared would land a hair under it after the air cast's sink, and a JUMP SERVE never be PERFECT); a spike only over the net's zone
 *  (`net` metres either side) with the ball over `ball` metres. A set is met at the top of the jump with the ball
 *  `reach` metres over the jump's top (BallBrain APEX_REACH); the swing goes `swing` seconds short of the top and lands
 *  `contact` after it - so the jump goes that long, plus the jump's own rise, before the ball gets there. Under a low
 *  ball (a QUICK SET) the hitter meets it at `low` metres on the way up, `lowLead` seconds after leaving the floor.
 *  (`contact` is SHOOT's tap, the swing everyone throws - the ball away 8 ticks after the
 *  room hears the press, model.ts SHOOT. It was 0.23, the charged spike's - a fighter's own air strike, 0.22 to 0.33
 *  s - which no cue can be for every fighter at once; a tap on that beat met the set a tenth of a second before it
 *  came down to the hand.) */
export const SPIKE_TIMING = {apex: .92, net: 3.6, ball: 3.6, reach: .9, swing: .1, contact: .133, low: 4, lowLead: .15} as const;
/** How the cues are shown: the JUMP ring closes on the ball over `jumpLead` seconds; the glint flares for `flare` s; a
 *  DIVE chevron shows for a hard ball (`hard` m/s and over) whose line passes `diveFrom`-`diveTo` metres from the body -
 *  beyond its own reach, inside the dive's (BallMatch DIG_DIVE) - in the next `diveWithin` seconds. */
const CUE = {jumpLead: .55, flare: .32, hard: 17, diveFrom: .9, diveTo: 1.75, diveWithin: .55, hand: 1.55} as const;
/** The volleyball rules (game/ball/volley.ts): the timing the cues teach is volleyball's jump (volleyArc: the set met by the raised hand,
 *  VOLLEY.air.hand, at the jump's top; a QUICK on the way up at its own height), an attack's ball over `ball` m; and each
 *  cue drawn `size` its size and `alpha` its strength - the JUMP ring closing on the ball a thin, faint circle about a
 *  metre across at its widest, not a big white one three across. */
export const VOLLEY_TIMING = {...SPIKE_TIMING, reach: VOLLEY.set.reach, low: VOLLEY.set.quickMeet, ball: 3, hand: VOLLEY.air.hand} as const;
const VOLLEY_CUE = {jump: .45, jumpAlpha: .55, hand: .6, handAlpha: .6, glint: .65} as const;
/** Instances a frame: your glint and its ring, your jump ring, your dive chevron, the other side's glints. */
const CAP = 12;
const KIND = {glint: 0, ring: 1, chevron: 2} as const;
const PREMULTIPLIED = {transparent: true, depthWrite: false, forceSinglePass: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor} as const;
const GOLD = new THREE.Color(1, .82, .36), WHITE = new THREE.Color(1, 1, 1);
const TEAM: Record<BallTeam, THREE.Color> = {red: new THREE.Color(BALL_TEAM_COLOURS.red), blue: new THREE.Color(BALL_TEAM_COLOURS.blue)};
/** A cue's sound (main.ts plays each on the ball's own takes): your jump's beat, your window opening, the other side's
 *  hitter at the top (the block's beat), a dive to make. */
export type SpikeCueTick = 'jump' | 'apex' | 'block' | 'dive';

/** The seconds until a ball at height `y` climbing at `vy` comes down through `h` (the later root), or NaN if it never
 *  gets that high. */
export function untilDown(y: number, vy: number, h: number, g: number) {
  const disc = vy * vy + 2 * g * (y - h);
  if (disc < 0) return NaN;
  return (vy + Math.sqrt(disc)) / g;
}
/** Whether a set climbs high enough to be met at the top of a jump of `arc` (the floating set), read off its flight. */
export function highSet(ball: {y: number; vy: number; grav?: number}, arc: {apex: number}, T: {reach: number} = SPIKE_TIMING) {
  const g = SPIKE_RULES.gravity * (ball.grav || 1);
  return ball.y + Math.max(0, ball.vy) ** 2 / (2 * g) >= arc.apex + T.reach + .2;
}
/** Seconds until the jump should leave the floor to meet a set at the top of the jump (`high`), or on the way up under a
 *  low one, for a fighter of jump `arc`; NaN when there is no such moment ahead. */
export function jumpIn(ball: {y: number; vy: number; grav?: number}, arc: {apex: number; rise: number}, high = highSet(ball, arc), T: {readonly reach: number; readonly low: number; readonly swing: number; readonly contact: number; readonly lowLead: number} = SPIKE_TIMING) {
  const g = SPIKE_RULES.gravity * (ball.grav || 1);
  const t = untilDown(ball.y, ball.vy, high ? arc.apex + T.reach : T.low, g);
  return t - (high ? arc.rise - T.swing + T.contact : T.lowLead);
}

/**
 * Sky Spike's timing cues. A PERFECT SPIKE is struck from the top of the jump: without a cue a player could only guess
 * at the window. Here the rhythm is shown and heard, so it is learned in a few rallies:
 * - **JUMP:** your side's set up and coming down near you, a thin ring closes on the ball and a soft tick lands on the
 *   moment to leave the floor (for a floating set, its rise and the swing's wind-up before the ball gets there; for a
 *   QUICK SET, a breath before).
 * - **APEX:** in the air near the ball, a ring closes in on your hands as you climb, and as the body crosses into the
 *   PERFECT window a gold four-point glint flares on them with a bright "ting": swing now. The ring and a settled glint
 *   hold while the window is open. The JUMP SERVE's toss has the same.
 * - **BLOCK:** the other side's hitter at the top of the jump flares in their colour (the glint they would see), with a
 *   tick when you are at the net: their swing is a breath away, the moment to put the hands up for a STUFF BLOCK.
 * - **DIVE:** a hard ball of theirs whose line passes beyond your reach but inside a dive's: a chevron at your feet points
 *   the way to throw yourself.
 * The page's own fighter only, drawn at the fighter's drawn place; nothing here decides anything (the room judges every
 * strike). One instanced draw of quads, nothing allocated in a frame.
 *
 * A couch split screen: each seat has its own, made with its `half` - Player 1's the page's own (0), Player
 * 2's the second (1) - and each is drawn only into its own half (`drawing`, which main.ts's splitHalf calls before each
 * half is drawn): Player 2's jump ring, glint, dive chevron and the other side's flares for them, never in Player 1's
 * view, and the other way round.
 */
export class SpikeCues {
  readonly mesh: THREE.Mesh<THREE.InstancedBufferGeometry, THREE.ShaderMaterial>;
  private readonly pos: THREE.InstancedBufferAttribute;
  private readonly look: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly time = {value: 0};
  private n = 0;
  /** Each cue's sound, once a moment. */
  onTick: (kind: SpikeCueTick) => void = () => {};
  /** What this page's own cues are doing (for checks and the drills). */
  readonly state = {jump: NaN, share: 0, window: false, dive: false};
  private wasWindow = false; private flareAge = Infinity; private jumpTold = ''; private diveTold = '';
  /** The set the jump's beat is for: which, whether it is a floating one (read as it left the hand), and whether its beat
   *  is still ahead (a set first seen already past its beat gets none). */
  private setKey = ''; private setHigh = true; private setArmed = false;
  private readonly theirsTold = new Map<string, boolean>();
  private readonly theirsFlare = new Map<string, number>();
  private readonly at = new THREE.Vector3();

  /** `half`: the split screen's half these cues are drawn in (drawing), 0 for the page's own seat, 1 for Player 2's. */
  constructor(parent: THREE.Object3D, readonly half: 0 | 1 = 0) {
    const quad = new THREE.PlaneGeometry(1, 1), geometry = new THREE.InstancedBufferGeometry();
    geometry.index = quad.index; geometry.setAttribute('position', quad.getAttribute('position')); quad.dispose();
    this.pos = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.look = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.tint = new THREE.InstancedBufferAttribute(new Float32Array(CAP * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('aPos', this.pos); geometry.setAttribute('aLook', this.look); geometry.setAttribute('aTint', this.tint); geometry.instanceCount = 0;
    const material = new THREE.ShaderMaterial({
      name: 'Sky Spike cues', ...PREMULTIPLIED, toneMapped: false, depthTest: false,
      uniforms: {uTime: this.time},
      vertexShader: `attribute vec4 aPos;attribute vec4 aLook;attribute vec4 aTint;varying vec2 vUv;varying vec4 vLook;varying vec4 vTint;
        void main(){
          vUv=position.xy*2.;vLook=aLook;vTint=aTint;
          if(aLook.x>1.5){
            // The chevron lies on the floor, turned to where the ball will be (ang).
            float c=cos(aLook.y),s=sin(aLook.y);vec2 q=vec2(position.x*c+position.y*s,-position.x*s+position.y*c)*aPos.w;
            gl_Position=projectionMatrix*viewMatrix*vec4(aPos.x+q.x,aPos.y,aPos.z-q.y,1.);
          }else{
            // The glint and the rings stand up to the lens, held to a size on screen as they go far (the broadcast stand
            // is some twenty-five metres off).
            vec4 mv=viewMatrix*vec4(aPos.xyz,1.);
            mv.xy+=position.xy*aPos.w*clamp(-mv.z*.045,.75,1.8);
            gl_Position=projectionMatrix*mv;
          }
        }`,
      fragmentShader: `uniform float uTime;varying vec2 vUv;varying vec4 vLook;varying vec4 vTint;
        float band(float d,float w){float px=max(fwidth(d),.003);return 1.-smoothstep(w,w+px,abs(d));}
        void main(){
          float kind=vLook.x,k=vLook.y,alpha=vLook.z;vec3 col=vTint.rgb;
          float r=length(vUv),cover=0.,glow=0.;
          if(kind<.5){
            // The glint: a four-point star, long thin rays and a hot heart, inked at its edge so it reads on the planks
            // and on a pale sky alike; k is how far into its flare (0 the burst, 1 settled).
            vec2 p=abs(vUv);
            float ray=max(1.-smoothstep(0.,.07+.05*(1.-k),p.y)-p.x*.95,1.-smoothstep(0.,.07+.05*(1.-k),p.x)-p.y*.95);
            float diag=max(1.-smoothstep(0.,.05,abs(p.x-p.y))-r*1.6,0.)*.7;
            float heart=1.-smoothstep(.0,.2,r);
            float star=clamp(max(max(ray,diag),heart),0.,1.);
            float ink=clamp(max(1.-smoothstep(0.,.13,p.y)-p.x*.9,1.-smoothstep(0.,.13,p.x)-p.y*.9),0.,1.)*(1.-star);
            cover=max(star,ink*.75);glow=star;col=mix(vec3(.03),mix(col,vec3(1.),heart*.8),star);
          }else if(kind<1.5){
            // A ring: k its radius (a share of the quad), thin, on an ink hairline, a little brighter where it is turned.
            float ring=band(r-k*.92,.035),ink=band(r-k*.92,.06)*(1.-ring);
            cover=max(ring,ink*.7);glow=ring;col=mix(vec3(.03),col,ring);
          }else{
            // The DIVE chevron: a broad arrow pointing up the quad, an ink edge, pulsing outward.
            vec2 p=vUv;p.y-=fract(uTime*2.2)*.25;
            float body=step(abs(p.x)*1.1-.1,p.y+.5)*step(p.y,.2)*step(abs(p.x),.85);
            float notch=step(abs(p.x)*1.1+.3,p.y+.5);
            float inner=body*(1.-notch);
            float edge=step(abs(p.x)*1.1-.22,p.y+.62)*step(p.y,.32)*step(abs(p.x),.95)*(1.-step(abs(p.x)*1.1+.18,p.y+.38));
            cover=max(inner,edge*.85);glow=inner;col=mix(vec3(.03),col,inner);
          }
          float al=cover*alpha;
          gl_FragColor=vec4(col*(glow*1.3+.05)*al,al);
        }`,
    });
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.name = 'Sky Spike cues'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 14;
    parent.add(this.mesh);
  }

  /**
   * Every frame. `self` is the page's seat; `players` the frame's fighters (their state: grounded, which fighter);
   * `at` where a seat's body is drawn; `ball` where the ball is drawn; `show` whether play is on screen (no replay, no
   * ceremony).
   */
  update(dt: number, view: BallView | undefined, self: string, players: readonly PlayerState[], at: (id: string) => THREE.Vector3 | undefined, ball: THREE.Vector3 | null, show: boolean) {
    this.time.value += dt; this.n = 0; this.flareAge += dt;
    for (const [id, age] of this.theirsFlare) this.theirsFlare.set(id, age + dt);
    this.state.jump = NaN; this.state.share = 0; this.state.window = false; this.state.dive = false;
    if (!show || !view || view.mode !== 'sky-spike' || !ball || (view.phase !== 'live' && view.phase !== 'kickoff')) { this.wasWindow = false; this.flush(); return; }
    let team: BallTeam | undefined, fighter: FighterId | undefined;
    for (const s of view.seats) if (s.id === self) { team = s.team; fighter = s.fighter; }
    const me = at(self), state = players.find(p => p.id === self);
    if (team && fighter && me && state) this.mine(view, team, fighter, me, state, ball);
    else this.wasWindow = false;
    if (team) this.theirs(view, team, players, at, ball, me);
    this.flush();
  }

  /** Your own cues: the jump's beat, the window at the top, the dive. */
  private mine(view: BallView, team: BallTeam, fighter: FighterId, me: THREE.Vector3, state: PlayerState, ball: THREE.Vector3) {
    const volley = !!view.volley, b = view.ball, arc = volley ? volleyArc(fighter) : jumpArc(fighter), T = volley ? VOLLEY_TIMING : SPIKE_TIMING, sign = team === 'red' ? -1 : 1;
    const Z = volley ? VOLLEY_CUE : null;
    const touches = view.touchTeam === team ? view.touches : 0, mySide = Math.sign(ball.z || sign) === sign || Math.abs(ball.z) < .9;
    const serving = view.phase === 'kickoff' && view.serverId === state.id;
    // (Read off the drawn body, so the cue keeps the frame's own time: the page's prediction of its own fighter.)
    const air = me.y > .15;
    void state;
    // JUMP: your side's set up (two touches in), coming down near you; the ring closes on the ball to the moment.
    if (!air && view.phase === 'live' && touches === 2 && b.shot === 'set' && b.lastTeam === team && mySide) {
      const key = `${view.rally}:${b.lastId}:${view.score.red + view.score.blue}`;
      if (key !== this.setKey) { this.setKey = key; this.setHigh = highSet(b, arc, T); this.setArmed = false; }
      // (The frame's ball is the room's last sample of it, carried on to the moment drawn - `since` s on, read off how far
      // along its flight the drawn ball is: online up to a snapshot's gap, which would make the beat that much late.)
      const flat = b.vx * b.vx + b.vz * b.vz, since = flat > 1 ? Math.min(.1, Math.max(0, ((ball.x - b.x) * b.vx + (ball.z - b.z) * b.vz) / flat)) : 0;
      const t = jumpIn(b, arc, this.setHigh, T) - since, g = SPIKE_RULES.gravity * (b.grav || 1);
      if (t > .04) this.setArmed = true;
      // (Where it comes through hitting height: near enough to you to be yours.)
      const when = untilDown(b.y, b.vy, this.setHigh ? arc.apex + T.reach : T.low, g);
      const near = Number.isFinite(when) && Math.hypot(b.x + b.vx * when - me.x, b.z + b.vz * when - me.z) < 3.2;
      if (near && this.setArmed && t > -.08 && t < CUE.jumpLead) {
        this.state.jump = t;
        const k = Math.max(0, t / CUE.jumpLead);
        this.put(KIND.ring, ball.x, ball.y, ball.z, (1.1 + 2.2 * k) * (Z?.jump ?? 1), Math.max(.3, 1 - k * .4), (.55 + .45 * (1 - k)) * (Z?.jumpAlpha ?? 1), t <= .02 ? GOLD : WHITE);
        if (t <= .02 && this.jumpTold !== key) { this.jumpTold = key; this.onTick('jump'); }
      }
    }
    // APEX: in the air near a ball you could spike (or your JUMP SERVE's toss): the ring closing on your hands as you
    // climb, the glint when the window opens.
    const hand = this.at.set(me.x, me.y + (volley ? VOLLEY_TIMING.hand : CUE.hand), me.z), dBall = hand.distanceTo(ball);
    // (The attacking touch still to make: two touches in, the ball not yet struck over - not your own serve going by.)
    const attack = view.phase === 'live' && touches === 2 && b.shot !== 'serve' && mySide && ball.y > T.ball && Math.abs(ball.z) < T.net;
    const share = air ? me.y / Math.max(.1, arc.apex) : 0;
    this.state.share = share;
    const open = air && share >= T.apex && dBall < 3.6 && (attack || serving);
    if (air && (attack || serving) && dBall < 4.4 && !open && share > .45 && share < T.apex && !this.wasWindow) {
      const k = (share - .45) / (T.apex - .45);
      this.put(KIND.ring, hand.x, hand.y, hand.z, (1.6 + 2.6 * (1 - k)) * (Z?.hand ?? 1), .9, (.3 + .55 * k) * (Z?.handAlpha ?? 1), WHITE);
    }
    if (open) {
      this.state.window = true;
      if (!this.wasWindow) { this.flareAge = 0; this.onTick('apex'); }
      this.put(KIND.ring, hand.x, hand.y, hand.z, 1.6 * (Z?.hand ?? 1), 1, .95 * (Z?.handAlpha ?? 1), GOLD);
    }
    this.wasWindow = open;
    if (this.flareAge < CUE.flare) {
      const k = this.flareAge / CUE.flare;
      this.put(KIND.glint, hand.x, hand.y, hand.z, 3.3 * (1.25 - .45 * k) * (Z?.glint ?? 1), k, 1 - k * k, GOLD);
    }
    // (The glint stays lit, settled, as long as the window is open: a swing now is still PERFECT.)
    if (open) this.put(KIND.glint, hand.x, hand.y, hand.z, 2.2 * (Z?.glint ?? 1), 1, .85, GOLD);
    // DIVE: a hard ball of theirs whose line passes beyond your reach but inside a dive's, soon. (Not in LEARN TO
    // PLAY's BLOCK step - the spike past your block is the step's miss, and a DIVE tick and chevron on it, right after
    // the block's own tick, taught the next step's move in this one's place.)
    const speed = Math.hypot(b.vx, b.vy, b.vz);
    if (!air && view.phase === 'live' && view.lesson?.step !== 'ss-block' && b.lastTeam && b.lastTeam !== team && speed >= CUE.hard && Math.sign(b.vz) === sign) {
      const g = SPIKE_RULES.gravity * (b.grav || 1);
      let best = Infinity, bx = 0, bz = 0;
      for (let t = 0; t <= CUE.diveWithin; t += 1 / 30) {
        const x = ball.x + b.vx * t, y = ball.y + b.vy * t - .5 * g * t * t, z = ball.z + b.vz * t;
        if (y < 0) break;
        const d = Math.hypot(x - me.x, Math.max(0, Math.abs(y - (me.y + .95)) - .5), z - me.z);
        if (d < best) { best = d; bx = x; bz = z; }
      }
      if (best >= CUE.diveFrom && best <= CUE.diveTo) {
        this.state.dive = true;
        const ang = Math.atan2(bx - me.x, -(bz - me.z));
        this.put(KIND.chevron, me.x + Math.sin(ang) * 1.1, .06, me.z - Math.cos(ang) * 1.1, 1.5, ang, .95, GOLD);
        const key = `${b.lastId}:${view.rally}`;
        if (this.diveTold !== key) { this.diveTold = key; this.onTick('dive'); }
      }
    }
  }

  /** The other side's hitter at the top of the jump: their glint, in their colour, and a tick when you are at the net. */
  private theirs(view: BallView, team: BallTeam, players: readonly PlayerState[], at: (id: string) => THREE.Vector3 | undefined, ball: THREE.Vector3, me: THREE.Vector3 | undefined) {
    const T = SPIKE_TIMING, foe = otherTeam(team), foeSign = foe === 'red' ? -1 : 1;
    const attack = view.phase === 'live' && view.touchTeam === foe && view.touches === 2 && view.ball.shot !== 'serve' && Math.sign(ball.z || foeSign) === foeSign && ball.y > (view.volley ? VOLLEY_TIMING.ball : T.ball) && Math.abs(ball.z) < T.net;
    for (const s of view.seats) {
      if (s.team !== foe) continue;
      const p = attack ? players.find(q => q.id === s.id) : undefined, body = p ? at(s.id) : undefined;
      if (!p || !body || body.y < .15) { this.theirsTold.set(s.id, false); continue; }
      const hand = this.at.set(body.x, body.y + (view.volley ? VOLLEY_TIMING.hand : CUE.hand), body.z);
      // (VOLLEYBALL - game/ball/volley.ts: the block is your jump, so its beat is their hitter leaving the
      // floor - jump with them - not the top of their jump, by which time a jump is too late.)
      const open = view.volley ? body.y > .15 && body.y < 1.6 && Math.abs(body.z) < T.net && hand.distanceTo(ball) < 8 : body.y / Math.max(.1, jumpArc(s.fighter).apex) >= T.apex && hand.distanceTo(ball) < 3.6;
      if (open && !this.theirsTold.get(s.id)) {
        this.theirsFlare.set(s.id, 0);
        if (me && Math.abs(me.z) < 3 && Math.abs(me.x - body.x) < 4) this.onTick('block');
      }
      this.theirsTold.set(s.id, open);
      const age = this.theirsFlare.get(s.id) ?? Infinity;
      if (age < CUE.flare) { const k = age / CUE.flare; this.put(KIND.glint, hand.x, hand.y, hand.z, 2.6 * (1.2 - .4 * k) * (view.volley ? VOLLEY_CUE.glint : 1), k, (1 - k * k) * .85, TEAM[foe]); }
    }
  }

  private put(kind: number, x: number, y: number, z: number, size: number, k: number, alpha: number, colour: THREE.Color) {
    if (this.n >= CAP) return;
    const i = this.n * 4, pos = this.pos.array as Float32Array, look = this.look.array as Float32Array, tint = this.tint.array as Float32Array;
    pos[i] = x; pos[i + 1] = y; pos[i + 2] = z; pos[i + 3] = size;
    look[i] = kind; look[i + 1] = k; look[i + 2] = alpha; look[i + 3] = 0;
    tint[i] = colour.r; tint[i + 1] = colour.g; tint[i + 2] = colour.b; tint[i + 3] = 0;
    this.n++;
  }
  private flush() {
    const g = this.mesh.geometry; g.instanceCount = this.n; this.mesh.visible = this.n > 0;
    for (const attr of [this.pos, this.look, this.tint]) { attr.clearUpdateRanges(); attr.addUpdateRange(0, Math.max(1, this.n) * 4); attr.needsUpdate = true; }
  }
  /** A couch split screen's half about to be drawn (main.ts splitHalf): these cues show only in their own seat's half;
   *  undefined, a single view: shown wherever there are any. (Every update shows them again: flush.) */
  drawing(half: 0 | 1 | undefined) { this.mesh.visible = this.n > 0 && (half === undefined || half === this.half); }
  /** How many cues are drawn this frame (for checks). */
  get count() { return this.n; }
  clear() { this.n = 0; this.wasWindow = false; this.flareAge = Infinity; this.jumpTold = this.diveTold = this.setKey = ''; this.setArmed = false; this.theirsTold.clear(); this.theirsFlare.clear(); this.flush(); }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
