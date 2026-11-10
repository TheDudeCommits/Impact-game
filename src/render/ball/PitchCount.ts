import * as THREE from 'three';
import {BALL_TEAM_COLOURS, GOAL_RULES, SPIKE_RULES, type BallTeam, type BallView} from '../../game/ball/model';
import type {BallArenaId} from '../../game/ball/arenas';
import {drawingHalf} from '../lenses';
import {ATLAS_GLSL, COUNT_CELLS, MATCH_POINT_CELL, atlasReady, cellUv, soundAtlas, type AtlasCell} from './soundWordAtlas';

/** Goal Rush's last ten seconds: the numeral's size on the pitch (m across a digit; 10 is wider), drawn this many times
 *  as long along the way it is read as it is wide, as a road's painted words are: the gameplay lens sees the pitch at a
 *  slant, and an unstretched numeral read as a squat blot from it. */
export const COUNT_WIDTH = 7, COUNT_STRETCH = 1.9;
/** The places on the pitch a numeral may lie (x, z): a grid of fifteen, three across and five along. Each second's lies
 *  at the one its lens sees best placed (nearest COUNT_AIM on its screen) and that holds the numeral whole inside the
 *  lines the way it lies, for that second. */
export const COUNT_SPOTS: readonly (readonly [number, number])[] = [-11, -5.5, 0, 5.5, 11].flatMap(z => [-6, 0, 6].map(x => [x, z] as const));
/** Where on its lens's screen a numeral is best laid (normalised device coordinates): the middle, a little low - over the
 *  local player's head, under the play. */
const COUNT_AIM = [0, -.12] as const;
/** The numerals' fill: the show's gold (ballShow.css, the MVP's), a colour neither side wears, with the ink outline and
 *  the paper rim round it; on a pale pitch the outline draws the figure, on the dark slate the rim does. The Wreck Yard's
 *  sand is the gold's own colour: there the fill is the paper. */
const COUNT_FILL = 0xf2c14e, COUNT_FILLS: Partial<Record<BallArenaId, number>> = {'dust-yard': 0xfff6e8};
/** Sky Spike's MATCH POINT: its size on the court (m across; MATCH_POINT_STRETCH times that along the way it is read),
 *  and how far back from the net into the side's half its middle lies (a share of the half's depth: in front of the
 *  broadcast lens's near edge, which cuts off the back of the near court). */
export const MATCH_POINT_SIZE = 5.8, MATCH_POINT_STRETCH = 1.25, MATCH_POINT_BACK = .32;

/** What the floor shows now: a numeral of Goal Rush's last ten seconds (10 down to 1), Sky Spike's MATCH POINT for a
 *  side, or nothing. Pure, for the checks. */
export type FloorMark = {kind: 'count'; n: number} | {kind: 'match-point'; team: BallTeam | 'both'} | null;
export function floorMark(view: Pick<BallView, 'mode' | 'phase' | 'practice' | 'clock' | 'overtime' | 'score' | 'target'>): FloorMark {
  if (view.practice) return null;
  if (view.mode === 'goal-rush') {
    if (view.overtime || (view.phase !== 'live' && view.phase !== 'kickoff') || !(view.clock > 0) || view.clock > 10) return null;
    // (Rounded up as the score bug rounds it, BallHud: the numeral on the pitch and the clock agree.)
    return {kind: 'count', n: Math.min(10, Math.max(1, Math.ceil(view.clock)))};
  }
  if (view.phase !== 'live' && view.phase !== 'kickoff') return null;
  const team = matchPointOf(view);
  return team ? {kind: 'match-point', team} : null;
}
/** Sky Spike: the side one point from winning the match (the next point wins it for them), 'both' at the cap's last
 *  point (14-14 to 15: the next point wins it for either), or none. */
export function matchPointOf(view: Pick<BallView, 'score' | 'target'>): BallTeam | 'both' | null {
  const target = view.target || SPIKE_RULES.target, cap = Math.max(target, SPIKE_RULES.cap + (target - SPIKE_RULES.target));
  const won = (s: number, o: number) => s >= cap || (s >= target && s - o >= 2);
  const on = (team: BallTeam) => { const s = view.score[team], o = view.score[team === 'red' ? 'blue' : 'red']; return !won(s, o) && !won(o, s) && won(s + 1, o); };
  const red = on('red'), blue = on('blue');
  return red && blue ? 'both' : red ? 'red' : blue ? 'blue' : null;
}

/** The four ways a mark can lie, each its reading direction on the floor (the way its top points). */
const AXES = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const;
/** A lens turns this far past the halfway line between two ways (as a cosine) before its mark turns with it. */
const TURN_PAST = .26;

const VERTEX = /* glsl */`
uniform vec3 uCentre; uniform vec2 uSize; uniform vec2 uFace; uniform vec4 uCell; uniform float uAge; uniform float uPop; uniform float uStretch;
varying vec2 vUv;
void main(){
  // Stamped onto the floor: a size too big for a breath, then settled.
  float s = 1. + .22 * uPop * (1. - smoothstep(0., .16, uAge));
  vec2 p = position.xy * uSize * vec2(1., uStretch) * s;
  // Its top along uFace (the lens's way on the floor), its right across it, so the lens reads it upright.
  vec2 right = vec2(-uFace.y, uFace.x);
  vec3 world = uCentre + vec3(right.x * p.x + uFace.x * p.y, 0., right.y * p.x + uFace.y * p.y);
  vUv = mix(uCell.xy, uCell.zw, uv);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.);
}`;
const FRAGMENT = /* glsl */`
uniform sampler2D uMap; uniform vec3 uFill; uniform vec3 uInk; uniform vec3 uPaper; uniform float uLevel;
varying vec2 vUv;
${ATLAS_GLSL}
void main(){
  vec3 m = texture2D(uMap, vUv).rgb;
  float fill = atlasCut(m.r), ink = atlasCut(m.g), rim = atlasCut(m.b), a = rim * uLevel;
  if (a < .004) discard;
  gl_FragColor = vec4(mix(mix(uPaper, uInk, ink), uFill, fill), a);
}`;

/**
 * The last ten seconds of a Goal Rush match counted
 * down in large brush numerals on the pitch itself, and Sky Spike's match point marked on the court in the same hand.
 *
 * An effect layer of its own, one quad on its own material over the lettering atlas (soundWordAtlas.ts), lying on the floor:
 * the ball and the bodies are drawn over it (it tests the depth and writes none). Goal Rush's numerals, in every arena,
 * 7 m across and stretched along the way they are read, in the show's gold (paper on the Wreck Yard's sand) with the ink
 * outline and the paper rim. Each
 * second's stamps in as the clock reaches it, at whichever of COUNT_SPOTS its lens sees best placed, held
 * through a kickoff (the clock stops), gone as the clock runs out or a goal stops play. Sky Spike's MATCH POINT lies in
 * the court of the side one point from the win, a third of the way back from the net, in that side's colour, from the serve's walk-up to the
 * point's end (at the cap's last point, when either side wins it with the next, in ink on the court nearer each lens).
 *
 * Each lens reads it upright, and a couch split's each half (`drawingHalf`) places it for itself as it is drawn for it: a
 * numeral lies along the floor's axis nearest that lens's way, at that lens's best spot, for its second; MATCH POINT along
 * the nearest axis, turning to another only once the lens has turned well past the halfway line, so it never flickers
 * between two. Nothing is laid out on the page; nothing allocates in a frame.
 */
export class PitchCount {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private key = ''; private since = -Infinity; private level = 0;
  /** Each lens's way the mark lies (an index into AXES), its spot (an index into COUNT_SPOTS) and the mark it placed them
   *  for (a numeral's are chosen once, for its second), by the lens (the camera, and the half of a couch split it draws:
   *  the big screens' broadcast camera draws the place too, and reads its own). */
  private readonly lenses = new Map<number, {way: number; spot: number; placed: string}>();
  private readonly forward = new THREE.Vector3(); private readonly probe = new THREE.Vector3();
  private count = false; private both = false;
  /** For the checks: what lies on the floor now. */
  shown: FloorMark = null;

  constructor(scene: THREE.Scene) {
    this.material = new THREE.ShaderMaterial({
      name: 'Ball floor count', transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
      uniforms: {
        uMap: {value: null}, uCentre: {value: new THREE.Vector3()}, uSize: {value: new THREE.Vector2(1, 1)}, uFace: {value: new THREE.Vector2(0, 1)},
        uCell: {value: new THREE.Vector4()}, uAge: {value: 1}, uPop: {value: 1}, uLevel: {value: 0}, uStretch: {value: 1},
        uFill: {value: new THREE.Color(0x0b0c0e)}, uInk: {value: new THREE.Color(0x0b0c0e)}, uPaper: {value: new THREE.Color(0xfff6e8)},
      },
      vertexShader: VERTEX, fragmentShader: FRAGMENT,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.name = 'Ball floor count'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 2; this.mesh.visible = false;
    // Each lens's way and spot, as the mark is drawn for it.
    this.mesh.onBeforeRender = (_r, _s, camera) => this.forLens(camera, drawingHalf());
    scene.add(this.mesh);
  }

  /** Every frame with the presented view (BallCeremony.update). `hidden`: not drawn this frame (a ceremony holds the
   *  lens). */
  update(view: BallView | null, dt: number, hidden = false) {
    const mark = view ? floorMark(view) : null, page = performance.now() / 1000;
    if (view && view.mode === 'goal-rush' ? view.clock <= 12 : !!mark) this.material.uniforms.uMap.value ??= soundAtlas();
    const key = !mark ? '' : mark.kind === 'count' ? `count:${mark.n}` : `mp:${mark.team}:${view!.startedAt}`;
    if (key && key !== this.key) this.place(mark!, view!, page);
    if (key) this.key = key;
    this.shown = mark;
    const u = this.material.uniforms;
    // In at once with its stamp; out over a third of a second.
    this.level = mark ? 1 : Math.max(0, this.level - dt / .3);
    if (!mark && this.level <= 0) this.key = '';
    u.uLevel.value = this.level * (mark?.kind === 'match-point' || this.key.startsWith('mp:') ? .88 : .76);
    u.uAge.value = page - this.since;
    this.mesh.visible = this.level > 0 && !hidden && atlasReady() && !!u.uMap.value;
  }

  private place(mark: NonNullable<FloorMark>, view: BallView, page: number) {
    const u = this.material.uniforms, cell: AtlasCell = mark.kind === 'count' ? COUNT_CELLS[mark.n] : MATCH_POINT_CELL;
    cellUv(cell, u.uCell.value);
    const centre = u.uCentre.value as THREE.Vector3, size = u.uSize.value as THREE.Vector2;
    this.count = mark.kind === 'count';
    if (mark.kind === 'count') {
      // (10 is as tall as a digit, and wider.)
      size.set(COUNT_WIDTH * cell.w / 256, COUNT_WIDTH * cell.h / 256); u.uStretch.value = COUNT_STRETCH;
      (u.uFill.value as THREE.Color).setHex((view.arena && COUNT_FILLS[view.arena]) ?? COUNT_FILL);
    } else {
      // (Both one point from it: in ink, on the court nearer each lens, forLens.)
      this.both = mark.team === 'both';
      centre.set(0, .03, (mark.team === 'red' ? -1 : 1) * SPIKE_RULES.courtHalfZ * MATCH_POINT_BACK);
      size.set(MATCH_POINT_SIZE, MATCH_POINT_SIZE); u.uStretch.value = MATCH_POINT_STRETCH;
      (u.uFill.value as THREE.Color).setHex(mark.team === 'both' ? 0x0b0c0e : BALL_TEAM_COLOURS[mark.team]);
    }
    u.uPop.value = reduced() ? 0 : 1;
    this.since = page; this.level = 1;
  }

  /** As the mark is drawn for a lens (`half` of a couch split, or the one view's 0): which way it lies and, a numeral,
   *  where - chosen for that lens once a numeral, kept for its second. */
  private forLens(camera: THREE.Camera, half: 0 | 1) {
    const id = camera.id * 2 + half;
    let lens = this.lenses.get(id);
    if (!lens) { lens = {way: 0, spot: 0, placed: ''}; if (this.lenses.size < 16) this.lenses.set(id, lens); }
    const u = this.material.uniforms, f = this.forward.set(0, 0, -1).transformDirection(camera.matrixWorld);
    const fl = Math.hypot(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl;
    const nearest = (from: number, past: number) => {
      let best = from, score = fx * AXES[from][0] + fz * AXES[from][1] + past;
      for (let i = 0; i < 4; i++) { const d = fx * AXES[i][0] + fz * AXES[i][1]; if (d > score) { score = d; best = i; } }
      return best;
    };
    if (this.count) {
      if (lens.placed !== this.key) {
        lens.placed = this.key;
        lens.way = nearest(lens.way, 0);
        // (Its half-sizes on the floor the way it lies: across, then along the way it is read.)
        const size = u.uSize.value as THREE.Vector2, w = size.x / 2, l = size.y * u.uStretch.value / 2, alongX = AXES[lens.way][0] !== 0;
        const hx = alongX ? l : w, hz = alongX ? w : l;
        let best = 2 * 3 + 1, score = Infinity;
        // (Its near end and its far end on the screen too, not only its middle: a numeral is 15 m long.)
        const [ax, az] = AXES[lens.way], onScreen = (x: number, z: number, low: number, high: number) => {
          const p = this.probe.set(x, 0, z).applyMatrix4(camera.matrixWorldInverse);
          if (p.z > -2) return null;
          p.applyMatrix4(camera.projectionMatrix);
          return Math.abs(p.x) <= 1 && p.y >= low && p.y <= high ? p : null;
        };
        COUNT_SPOTS.forEach(([x, z], i) => {
          if (Math.abs(x) + hx > GOAL_RULES.halfX - .4 || Math.abs(z) + hz > GOAL_RULES.halfZ - .4) return;
          if (!onScreen(x - ax * l, z - az * l, -.98, .45) || !onScreen(x + ax * l, z + az * l, -.98, .45)) return;
          const p = onScreen(x, z, -.8, .3);
          if (!p || Math.abs(p.x) > .8) return;
          const d = Math.abs(p.x - COUNT_AIM[0]) * .6 + Math.abs(p.y - COUNT_AIM[1]);
          if (d < score) { score = d; best = i; }
        });
        lens.spot = best;
      }
      const [x, z] = COUNT_SPOTS[lens.spot];
      (u.uCentre.value as THREE.Vector3).set(x, .03, z);
    } else {
      lens.way = nearest(lens.way, TURN_PAST);
      if (this.both) (u.uCentre.value as THREE.Vector3).set(0, .03, (camera.position.z < 0 ? -1 : 1) * SPIKE_RULES.courtHalfZ * MATCH_POINT_BACK);
    }
    const way = lens.way;
    (u.uFace.value as THREE.Vector2).set(AXES[way][0], AXES[way][1]);
    this.material.uniformsNeedUpdate = true;
  }

  clear() { this.key = ''; this.level = 0; this.shown = null; this.mesh.visible = false; for (const lens of this.lenses.values()) lens.placed = ''; }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.material.dispose(); }
}

const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
