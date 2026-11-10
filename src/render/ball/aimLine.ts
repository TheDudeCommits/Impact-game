import * as THREE from 'three';
import {BALL_TEAM_COLOURS, ballRadius, type BallState, type BallTeam, type BallView} from '../../game/ball/model';
import {baseGravity} from '../../game/ball/mutators';
import {stepBall, type BallContact} from '../../game/ball/physics';
import {chargedPath} from '../../game/ball/strike';
import {noiseTexture} from '../vfx/noiseTexture';
import {ownCharge, type OwnCharge} from './ownShot';

/** The aim line (fewer effects, clearer). While the page's own SHOOT winds up as a
 *  CHARGED shot (the key still down at the split: model.ts SHOOT), one dry brush stroke in the side's colour lies on the
 *  pitch along where the shot will go - the floor under the flight strike.ts `chargedPath()` gives it for this seat at
 *  this charge, struck at the blow from where the ball will be by then - and it turns with the aim and the stick as they
 *  are held (the kernel reads them as the key comes up). It is drawn out as far as it is charged - that share of the
 *  way, all of it at a full charge (a charge starts at the split, a fifth of a second in: a third to two thirds of the
 *  way by the fighter's wind-up) - broad where the ball is struck and a thin flick where it ends: Sky Spike's where it
 *  first comes down, Goal Rush's in the goal or where its flight stops. Gone the frame the ball is seen leaving. Nothing
 *  on a tap, nobody else's, nothing in a replay, nothing for a ball the swing cannot reach. From the page's own
 *  prediction (ownShot.ts), so it is there at once online. One draw while it shows, none otherwise; nothing allocated in
 *  a frame but the path's points.
 *  AIM: how fast its points ease onto a new track (1/s), the last moments of the wind-up (s) in which a jump in the ball's
 *  pace (m/s) is the ball leaving, its width at the ball (m, and per metre of the ball's radius), the gap between its
 *  points (m), its fade in (s) and its opacity, how far the swing reaches (m to the ball's edge along the floor - the
 *  quick strike's 2.85 - the most a lunge adds, m over the body's middle), its height off the floor (m), and the least of
 *  it worth drawing (m). */
export const AIM = {settle: 20, leaving: .1, kick: 4, width: .36, widthPerRadius: .3, gap: .55, fadeIn: .08, alpha: .78, near: 2.9, lunge: 2, above: 2.6, floor: .03, least: .6} as const;
const MAX = 48;
const PREMULTIPLIED = {transparent: true, depthWrite: false, forceSinglePass: true, blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor} as const;
const TEAM: Record<BallTeam, THREE.Color> = {red: new THREE.Color(BALL_TEAM_COLOURS.red), blue: new THREE.Color(BALL_TEAM_COLOURS.blue)};

export class AimLine {
  readonly mesh: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly position: THREE.BufferAttribute; private readonly uv: THREE.BufferAttribute;
  private readonly ball: BallState = {x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, sx: 0, sy: 0, sz: 0, heat: 0, lastId: null, lastTeam: null, shot: null, held: false, frozenUntil: 0, super: false, size: 1, grav: 1, wall: null, clash: 0};
  private readonly contacts: BallContact[] = [];
  private readonly track: number[] = [];
  /** The stroke's points as laid last frame (where each is along the track, metres) and how many. */
  private readonly cx = new Float32Array(MAX); private readonly cz = new Float32Array(MAX); private readonly cd = new Float32Array(MAX); private laid = 0;
  /** The drawn ball's pace last frame, and the swing (its start) whose ball has been seen leaving. */
  private readonly pace = [0, 0, 0]; private gone = NaN;
  private shown = 0;
  /** For the checks (window.__ballField.aim on this machine): whether it is drawn, its length drawn and all of it (m),
   *  how far it is charged, where it ends drawn and where all of it would. */
  readonly look = {on: false, length: 0, full: 0, charge: 0, end: [0, 0] as [number, number], land: [0, 0] as [number, number]};

  constructor() {
    const geometry = new THREE.BufferGeometry(), index: number[] = [];
    for (let i = 0; i < MAX - 1; i++) { const a = i * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    this.position = new THREE.BufferAttribute(new Float32Array(MAX * 6), 3).setUsage(THREE.DynamicDrawUsage);
    this.uv = new THREE.BufferAttribute(new Float32Array(MAX * 8), 4).setUsage(THREE.DynamicDrawUsage);
    geometry.setIndex(index); geometry.setAttribute('position', this.position); geometry.setAttribute('aRun', this.uv);
    geometry.setDrawRange(0, 0);
    const material = new THREE.ShaderMaterial({
      name: 'Ball aim line', ...PREMULTIPLIED, toneMapped: false, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
      uniforms: {uColor: {value: new THREE.Color()}, uAlpha: {value: 0}, uNoise: {value: noiseTexture()}},
      vertexShader: `attribute vec4 aRun;varying vec4 vRun;void main(){vRun=aRun;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      // The power shot's stroke's dry brush (BallField), quieter: the side's colour under its light, ink at its ragged
      // edges, broken where the brush ran dry; its grain runs along the line (vRun.x, metres), so it stands still as the
      // line grows. vRun.y is across (0-1), vRun.z the stroke's own opacity there.
      fragmentShader: `uniform vec3 uColor;uniform float uAlpha;uniform sampler2D uNoise;varying vec4 vRun;
        void main(){
          float across=abs(vRun.y*2.-1.);
          float n=texture2D(uNoise,vec2(vRun.x*.31,vRun.y*.6)).r,dry=texture2D(uNoise,vec2(vRun.x*.12,vRun.y*2.4+.3)).g;
          float body=1.-smoothstep(.6+n*.3,.74+n*.3,across),ink=smoothstep(.34+n*.2,.56+n*.2,across)*body;
          float A=body*smoothstep(.2,.44,dry+(1.-across)*.3)*vRun.z*uAlpha;
          gl_FragColor=vec4(mix(uColor*.92,uColor*.22,ink*.75)*A,A);
        }`,
    });
    this.mesh = new THREE.Mesh(geometry, material); this.mesh.name = 'Ball aim line'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 7; this.mesh.visible = false;
  }

  /** Every frame (BallField.update). `ball`: the ball as the page draws it now (null: none drawn); `run`: how the page's
   *  own body moves along the floor (m/s); `show`: play on screen, not a replay. */
  update(view: BallView, selfId: string, ball: BallState | null, run: {vx: number; vz: number} | undefined, dt: number, show: boolean) {
    let own = show && ball && (view.phase === 'live' || (view.phase === 'kickoff' && view.mode === 'sky-spike')) ? ownCharge(selfId) : undefined;
    // (Gone the frame the ball is seen leaving: the drawn ball can go a frame or two before the drawn swing's blow - offline
    // it is drawn on its newest snapshot's flight, online the touch's forecast sends it - so a jump in its pace, in its
    // blow's last moments, ends the line for that swing.)
    const kick = ball ? Math.hypot(ball.vx - this.pace[0], ball.vy - this.pace[1], ball.vz - this.pace[2]) : 0;
    if (ball) { this.pace[0] = ball.vx; this.pace[1] = ball.vy; this.pace[2] = ball.vz; }
    if (own && own.left < AIM.leaving && kick > AIM.kick) this.gone = own.swing.cast?.start ?? NaN;
    if (own && own.swing.cast?.start === this.gone) own = undefined;
    const seat = own ? view.seats.find(s => s.id === selfId) : undefined;
    if (!own || !seat || !ball || !this.build(view, seat.team, own, ball, run, this.shown > 0 ? 1 - Math.exp(-dt * AIM.settle) : 1)) { this.hide(); return; }
    this.shown = Math.min(1, this.shown + dt / AIM.fadeIn);
    const u = this.mesh.material.uniforms;
    (u.uColor.value as THREE.Color).copy(TEAM[seat.team]); u.uAlpha.value = AIM.alpha * this.shown;
    this.mesh.visible = true; this.look.on = true; this.look.charge = own.charge;
  }
  hide() { this.mesh.visible = false; this.shown = 0; this.laid = 0; this.look.on = false; this.look.length = this.look.full = 0; }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }

  /** The line for this frame: the ball flown on to the blow, struck there as chargedPath strikes it, its floor track
   *  laid down. False where there is nothing to draw (a ball the swing will not reach, a flight that goes nowhere). */
  private build(view: BallView, team: BallTeam, own: OwnCharge, drawn: BallState, run: {vx: number; vz: number} | undefined, ease: number) {
    const mode = view.mode, a = own.swing, p = a.state, r = ballRadius(mode) * (drawn.size || 1), b = Object.assign(this.ball, drawn);
    // Where the ball will be as the blow lands (its own flight, off the walls and the floor), and whether the swing
    // reaches it there: its edge within `near` of the body along the floor, and as far again as the move's own lunge can
    // still carry the body in the wind-up left (`lunge` at the most); `above` over it. (A body walked off the ball while it
    // winds up - the key held, the stick across - loses the line before the swing misses.)
    for (let t = 0; t < own.left - 1e-6; t += 1 / 60) stepBall(mode, b, Math.min(1 / 60, own.left - t), this.contacts);
    const reach = AIM.near + r + Math.min(AIM.lunge, (a.cast?.move.lunge ?? 0) * own.left);
    if (Math.hypot(b.x - p.x, b.z - p.z) > reach || Math.abs(b.y - (p.y + 1)) > AIM.above) return false;
    const yaw = a.attackYaw ?? a.input.yaw, mx = a.attackMoveX ?? a.input.moveX, mz = a.attackMoveZ ?? a.input.moveZ;
    const serve = mode === 'sky-spike' && b.held && view.phase === 'kickoff' && view.serverId === p.id;
    const touches = mode === 'sky-spike' ? (serve ? 3 : view.touchTeam === team ? view.touches + 1 : 1) : undefined;
    const path = chargedPath(b, {mode, charge: own.charge, move: a.cast?.move, touches, serve, gravity: baseGravity(view.mutator), run: run ? {vx: run.vx, vz: run.vz} : undefined,
      striker: {id: p.id, team, x: p.x, y: p.y, z: p.z, grounded: p.grounded, aimYaw: yaw, awakened: !!p.awakened, chain: p.chain ?? 0,
        forward: mx * Math.sin(yaw) + mz * Math.cos(yaw), lateral: -mx * Math.cos(yaw) + mz * Math.sin(yaw)}});
    // Its floor track: Sky Spike's to where it first comes down (the point is decided there), Goal Rush's as far as the
    // flight goes (into the goal, or a second time onto the floor).
    // (The path is a point every thirtieth of a second: the floor is met between two of them - a sample on the way down,
    // the next already bounced up - so it ends where its last fall carried on would meet the floor.)
    const track = this.track; track.length = 0;
    let full = 0;
    for (let i = 0; i < path.length; i++) {
      const q = path[i], prev = path[i - 1];
      if (mode === 'sky-spike' && i > 1 && prev && (q.y <= r + .02 || q.y > prev.y + 1e-4) && prev.y < path[i - 2].y) {
        const before = path[i - 2], fall = before.y - prev.y, k = fall > 1e-4 ? Math.min(1.5, Math.max(0, (prev.y - r) / fall)) : 0;
        const x = prev.x + (prev.x - before.x) * k, z = prev.z + (prev.z - before.z) * k;
        full += Math.hypot(x - track[track.length - 2], z - track[track.length - 1]); track.push(x, z);
        break;
      }
      if (i > 0) full += Math.hypot(q.x - track[track.length - 2], q.z - track[track.length - 1]);
      track.push(q.x, q.z);
    }
    if (full < AIM.least) return false;
    this.look.land = [track[track.length - 2], track[track.length - 1]];
    this.lay(full * own.charge, full, r, ease);
    return true;
  }

  /** The stroke along the track's first `length` metres: points every `gap`, broad at the ball and tapering to a flick,
   *  coming in over its first half metre (it starts under the ball). Each point eases onto where the new track puts it
   *  (`ease` of the way this frame; 1 on the first): the body steps through its wind-up and the aim moves under the
   *  thumb, and a line remade from scratch every frame shivered a metre at its end. */
  private lay(length: number, full: number, r: number, ease: number) {
    const t = this.track, cx = this.cx, cz = this.cz, cd = this.cd, pos = this.position.array as Float32Array, uv = this.uv.array as Float32Array;
    const gap = Math.max(AIM.gap, length / (MAX - 1)), w0 = AIM.width + AIM.widthPerRadius * r, y = AIM.floor;
    let n = 0, seg = 0, segStart = 0, segLength = Math.hypot(t[2] - t[0], t[3] - t[1]);
    for (let d = 0; n < MAX; d = Math.min(length, d + gap)) {
      // (Walk the polyline to `d`.)
      while (seg < t.length / 2 - 2 && d > segStart + segLength) { segStart += segLength; seg++; segLength = Math.hypot(t[seg * 2 + 2] - t[seg * 2], t[seg * 2 + 3] - t[seg * 2 + 1]); }
      const k = segLength > 1e-6 ? Math.min(1, (d - segStart) / segLength) : 0;
      let x = t[seg * 2] + (t[seg * 2 + 2] - t[seg * 2]) * k, z = t[seg * 2 + 1] + (t[seg * 2 + 3] - t[seg * 2 + 1]) * k;
      if (n < this.laid) { x = cx[n] + (x - cx[n]) * ease; z = cz[n] + (z - cz[n]) * ease; }
      cx[n] = x; cz[n] = z; cd[n] = d; n++;
      if (d >= length) break;
    }
    this.laid = n;
    let tx = 0, tz = 1;
    for (let i = 0; i < n; i++) {
      const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), dx = cx[b] - cx[a], dz = cz[b] - cz[a], l = Math.hypot(dx, dz);
      if (l > 1e-5) { tx = dx / l; tz = dz / l; }
      const d = cd[i], s = length > 0 ? d / length : 0, w = w0 * (1 - .78 * Math.pow(s, 1.5)) * .5, fade = Math.min(1, d / .5) * (1 - .25 * s);
      pos[i * 6] = cx[i] - tz * w; pos[i * 6 + 1] = y; pos[i * 6 + 2] = cz[i] + tx * w;
      pos[i * 6 + 3] = cx[i] + tz * w; pos[i * 6 + 4] = y; pos[i * 6 + 5] = cz[i] - tx * w;
      uv[i * 8] = d; uv[i * 8 + 1] = 0; uv[i * 8 + 2] = fade; uv[i * 8 + 3] = 0;
      uv[i * 8 + 4] = d; uv[i * 8 + 5] = 1; uv[i * 8 + 6] = fade; uv[i * 8 + 7] = 0;
    }
    this.position.clearUpdateRanges(); this.position.addUpdateRange(0, n * 6); this.position.needsUpdate = true;
    this.uv.clearUpdateRanges(); this.uv.addUpdateRange(0, n * 8); this.uv.needsUpdate = true;
    this.mesh.geometry.setDrawRange(0, Math.max(0, n - 1) * 6);
    this.look.length = cd[n - 1] ?? 0; this.look.full = full; this.look.end = [cx[n - 1] ?? 0, cz[n - 1] ?? 0];
  }
}
