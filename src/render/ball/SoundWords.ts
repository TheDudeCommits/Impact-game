import * as THREE from 'three';
import {BALL_TEAM_COLOURS, CLASH, type BallEvent, type BallTeam, type BallView} from '../../game/ball/model';
import {VFX} from '../vfxLevel';
import {ATLAS_GLSL, SOUND_WORDS, WORD_CELLS, atlasReady, cellUv, soundAtlas} from './soundWordAtlas';

/** The five moments a sound word is stamped at, and the words each may
 *  take (indexes into SOUND_WORDS; the event's id picks one, so every page of a room stamps the same word):
 *  a SUPER SHOT struck - a heavy blast, a boom; a goal's net - a sharp rip; a PERFECT SPIKE's kill - a heavy smash, a
 *  hard hit; a STUFF BLOCK - a smack, a hard stop; a CLASH breaking - a crack, a hard stop. */
export type WordMoment = 'super' | 'goal' | 'kill' | 'block' | 'clash';
export const MOMENT_WORDS: Readonly<Record<WordMoment, readonly number[]>> = {super: [0, 1], goal: [2], kill: [3, 4], block: [5, 6], clash: [7, 6]};
/** Which wins when two come together (at most one word is ever on screen): the higher. */
const RANK: Readonly<Record<WordMoment, number>> = {goal: 5, super: 4, kill: 3, block: 2, clash: 1};
/** The word's size in the world (m, its height), before the screen's bounds below hold it. */
const HEIGHT: Readonly<Record<WordMoment, number>> = {goal: 2.6, super: 2.5, kill: 2.2, block: 2, clash: 2};
/** A word's life on screen (s): about half a second. */
export const WORD_LIFE = .5;
/** A PERFECT SPIKE's kill: the spike struck this long before the kill at most (s). */
const SPIKE_TO_KILL = 3;
/** Where a word may stand on the screen (normalised device coordinates, -1..1): no higher than TOP, so the score bug and
 *  the banner under it (the top 29% of the screen, ui/hud/ballBanner.ts) are never covered, and its cell's height held
 *  to between minH and maxH of the screen's (15% to 25%: the letters themselves about two thirds of that). */
export const WORD_SCREEN = {top: .42, bottom: -.9, side: .96, minH: .3, maxH: .5, clear: .46} as const;

/** The word for a moment, by the event's id. */
export const wordFor = (moment: WordMoment, id: number) => { const list = MOMENT_WORDS[moment]; return list[Math.abs(id) % list.length]; };

const VERTEX = /* glsl */`
uniform vec3 uAnchor; uniform vec4 uCell; uniform vec2 uSize; uniform float uAge; uniform float uTilt; uniform float uPop; uniform float uSide;
varying vec2 vUv; varying float vAlpha;
void main(){
  vec4 clip = projectionMatrix * viewMatrix * vec4(uAnchor, 1.);
  if (clip.w < .3 || uAge < 0. || uAge > ${WORD_LIFE.toFixed(2)}) { gl_Position = vec4(2., 2., 2., 1.); vAlpha = 0.; vUv = vec2(0.); return; }
  vec2 ndc = clip.xy / clip.w;
  float aspect = projectionMatrix[1][1] / projectionMatrix[0][0];
  float h = clamp(uSize.x * projectionMatrix[1][1] / clip.w, ${WORD_SCREEN.minH.toFixed(2)}, ${WORD_SCREEN.maxH.toFixed(2)}), w = h * uSize.y / aspect;
  // Stamped: in hard and a size too big, settled in a breath, held, and lifted off as it fades.
  float tIn = clamp(uAge / .08, 0., 1.), gone = smoothstep(.34, ${WORD_LIFE.toFixed(2)}, uAge);
  float s = mix(1. + .45 * uPop, 1., 1. - pow(1. - tIn, 3.)) + gone * .1 * uPop;
  vAlpha = clamp(uAge / .035, 0., 1.) * (1. - gone);
  // Beside the moment, a little above it, and inside the screen's bounds.
  vec2 c = ndc + vec2(w * .18, h * .62);
  // (A SUPER SHOT's word on the side its cut-in leaves clear, ui/ball/ballShow.css .bs-cut-ink: the right of an own
  // side's, the left of the other's.)
  if (uSide > .5) c.x = max(c.x, ${WORD_SCREEN.clear.toFixed(2)} + w * .5); else if (uSide < -.5) c.x = min(c.x, -${WORD_SCREEN.clear.toFixed(2)} - w * .5);
  c.x = clamp(c.x, -${WORD_SCREEN.side.toFixed(2)} + w * .5, ${WORD_SCREEN.side.toFixed(2)} - w * .5);
  c.y = clamp(c.y, ${WORD_SCREEN.bottom.toFixed(2)} + h * .5, ${WORD_SCREEN.top.toFixed(2)} - h * .5);
  vec2 q = position.xy * vec2(w, h) * s;
  q.x *= aspect; q = vec2(q.x * cos(uTilt) - q.y * sin(uTilt), q.x * sin(uTilt) + q.y * cos(uTilt)); q.x /= aspect;
  gl_Position = vec4(c + q, 0., 1.);
  vUv = mix(uCell.xy, uCell.zw, uv);
}`;
const FRAGMENT = /* glsl */`
uniform sampler2D uMap; uniform vec3 uFill; uniform vec3 uInk; uniform vec3 uPaper; uniform float uBoost;
varying vec2 vUv; varying float vAlpha;
${ATLAS_GLSL}
void main(){
  vec3 m = texture2D(uMap, vUv).rgb;
  float fill = atlasCut(m.r), ink = atlasCut(m.g), rim = atlasCut(m.b), a = rim * vAlpha;
  if (a < .004) discard;
  // (Burning through an INK FLASH, the colour is deepened as it is pushed over white, so the print keeps it a colour.)
  vec3 c = mix(mix(uPaper, uInk, ink), uBoost > 1. ? pow(uFill, vec3(1.6)) * uBoost : uFill, fill);
  gl_FragColor = vec4(c, a);
}`;

/**
 * The drawn sound words: a katakana sound word stamped in the world at the
 * five biggest hits - a SUPER SHOT struck, a goal's net, a PERFECT SPIKE's kill, a STUFF BLOCK, a CLASH breaking - in the
 * striker's side colour with an ink outline and a paper rim, for about half a second (WORD_LIFE).
 *
 * An effect layer of its own: one quad on its own material over the atlas (soundWordAtlas.ts), placed and stamped in its
 * vertex shader, so each lens of a couch split draws it for itself and nothing is laid out on the page. At most one word
 * is on screen (a bigger moment's takes the place of a smaller one's; a smaller one's waits for nothing and is dropped).
 * It stands beside the moment and never above WORD_SCREEN.top, so the score bug and the banner stay clear (a SUPER SHOT's
 * on the side of the screen its cut-in leaves clear). Drawn over
 * the world (it is lettering on the picture, not a thing in it), under the page's HUD.
 *
 * Inside an INK FLASH (the goal's and the SUPER SHOT's print) the fill burns over white, so the flash's print keeps the
 * side's colour as it keeps the ball's (render/look/LookPost.ts `inkKeep`). Under reduced motion it is not stamped (it
 * fades in and out where it stands). None on Low with the VISUAL EFFECTS reduced or minimal: the atlas is not even
 * asked for there. Client side only: the room's events, each read once; nothing allocates in a frame.
 */
export class SoundWords {
  readonly mesh: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private seen = 0; private seenAt = -Infinity; private match = NaN;
  /** The word up now: its moment's rank and when it was stamped (page seconds). */
  private rank = 0; private stamped = -Infinity;
  /** A CLASH's word waits for the clash to break. */
  private clashAt = Infinity; private clashTeam: BallTeam = 'red'; private clashId = 0; private readonly clashPoint = new THREE.Vector3();
  /** Sky Spike: each hitter's last PERFECT SPIKE (server seconds), for the kill it makes. */
  private readonly spiked = new Map<string, number>();
  /** For the checks: the words stamped since the page loaded, by moment. */
  readonly stampedCount: Record<WordMoment, number> = {super: 0, goal: 0, kill: 0, block: 0, clash: 0};
  /** Where the SUPER SHOT's cut-in leaves the screen clear for its word (BallCeremony, as it shows the cut-in): 1 the
   *  right, -1 the left, 0 no cut-in. */
  superSide: -1 | 0 | 1 = 0;
  /** What was stamped last: the moment, the word and where (for the checks). */
  last: {moment: WordMoment; word: string; team: BallTeam; at: [number, number, number]} | null = null;

  constructor(scene: THREE.Scene, private readonly quality: () => 'high' | 'medium' | 'low' = () => 'high') {
    this.material = new THREE.ShaderMaterial({
      name: 'Ball sound words', transparent: true, depthTest: false, depthWrite: false, toneMapped: false,
      uniforms: {
        uMap: {value: null}, uAnchor: {value: new THREE.Vector3()}, uCell: {value: new THREE.Vector4()}, uSize: {value: new THREE.Vector2(2, 2.3)},
        uAge: {value: -1}, uTilt: {value: 0}, uPop: {value: 1}, uBoost: {value: 1}, uSide: {value: 0},
        uFill: {value: new THREE.Color(BALL_TEAM_COLOURS.red)}, uInk: {value: new THREE.Color(0x08080a)}, uPaper: {value: new THREE.Color(0xfff6e8)},
      },
      vertexShader: VERTEX, fragmentShader: FRAGMENT,
    });
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.name = 'Ball sound words'; this.mesh.frustumCulled = false; this.mesh.renderOrder = 30; this.mesh.visible = false;
    scene.add(this.mesh);
  }

  /** Whether words are drawn at all on this page now: not on Low with the effects turned down. */
  get on() { return !(this.quality() === 'low' && VFX.level !== 'full'); }

  /** Every frame with the presented view (BallCeremony.update): the new events read, the word up now aged. `hidden`: not
   *  drawn this frame (the goal's still panels are being drawn). */
  update(view: BallView | null, now: number, hidden = false) {
    const page = performance.now() / 1000;
    if (!view) { this.mesh.visible = false; return; }
    // (The atlas asked for as a ball match begins, so the first word has it.)
    if (this.on) this.material.uniforms.uMap.value ??= soundAtlas();
    if (view.startedAt !== this.match || now < this.seenAt - 1) { this.match = view.startedAt; this.seen = 0; this.spiked.clear(); this.clashAt = Infinity; this.stamped = -Infinity; this.rank = 0; }
    this.seenAt = now;
    for (const e of view.events) {
      if (e.id <= this.seen) continue;
      this.seen = e.id;
      // Only what is happening now: a page that joins late, or hitches, stamps no backlog.
      if (now - e.at > 1) continue;
      this.event(e, view, page);
    }
    if (this.clashAt <= now) { this.clashAt = Infinity; this.stamp('clash', this.clashTeam, this.clashPoint, this.clashId, page); }
    const age = page - this.stamped;
    const u = this.material.uniforms;
    this.mesh.visible = age >= 0 && age <= WORD_LIFE && !hidden && atlasReady();
    if (!this.mesh.visible) { if (age > WORD_LIFE) this.rank = 0; return; }
    u.uAge.value = age;
    // (The fill burns over white while an INK FLASH holds the page, so the print keeps the side's colour.)
    u.uBoost.value = page < inkUntil ? 1.9 : 1;
  }

  private event(e: BallEvent, view: BallView, page: number) {
    // (The volleyball rules: no word but a SUPER SHOT's - BallMoments VOLLEY_PEAKS.)
    if (view.volley && e.kind !== 'super') return;
    const at = scratch.set(e.x, e.y, e.z);
    switch (e.kind) {
      case 'super': if (e.team) this.stamp('super', e.team, at.setY(e.y + .6), e.id, page); break;
      case 'goal': if (e.team && !view.practice) this.stamp('goal', e.team, at.setY(Math.max(1.2, e.y + .4)), e.id, page); break;
      case 'strike': if (e.perfect && view.mode === 'sky-spike' && e.actorId) this.spiked.set(e.actorId, e.at); break;
      case 'kill': {
        const spiked = e.actorId ? this.spiked.get(e.actorId) : undefined;
        if (e.team && spiked !== undefined && e.at - spiked <= SPIKE_TO_KILL) this.stamp('kill', e.team, at.setY(.9), e.id, page);
        break;
      }
      case 'perfect': if (e.text === 'STUFF BLOCK' && e.team) this.stamp('block', e.team, at.setY(e.y + .4), e.id, page); break;
      case 'clash': if (e.team) { this.clashAt = e.at + CLASH.hold; this.clashTeam = e.team; this.clashId = e.id; this.clashPoint.set(e.x, e.y + .6, e.z); } break;
      default: break;
    }
  }

  /** A word stamped now, unless a bigger moment's is still up (public for the checks and the local stills: a moment
   *  staged where it would happen). */
  stamp(moment: WordMoment, team: BallTeam, at: {x: number; y: number; z: number}, id: number, page = performance.now() / 1000) {
    if (!this.on) return;
    if (page - this.stamped <= WORD_LIFE && RANK[moment] < this.rank) return;
    const u = this.material.uniforms, word = wordFor(moment, id);
    u.uMap.value ??= soundAtlas();
    cellUv(WORD_CELLS[word], u.uCell.value);
    const cell = WORD_CELLS[word];
    (u.uSize.value as THREE.Vector2).set(HEIGHT[moment], cell.w / cell.h);
    (u.uAnchor.value as THREE.Vector3).set(at.x, at.y, at.z);
    (u.uFill.value as THREE.Color).setHex(BALL_TEAM_COLOURS[team]);
    // A stamp's lean: a few degrees, always back against the reading direction, by the event.
    u.uTilt.value = .05 + (Math.abs(id * 37) % 7) * .012;
    u.uPop.value = reduced() ? 0 : 1;
    u.uSide.value = moment === 'super' ? this.superSide : 0;
    this.stamped = page; this.rank = RANK[moment];
    this.stampedCount[moment]++;
    this.last = {moment, word: SOUND_WORDS[word], team, at: [at.x, at.y, at.z]};
  }

  /** Leaving the match. */
  clear() { this.mesh.visible = false; this.stamped = -Infinity; this.rank = 0; this.seen = 0; this.match = NaN; this.spiked.clear(); this.clashAt = Infinity; }
  dispose() { this.mesh.removeFromParent(); this.mesh.geometry.dispose(); this.material.dispose(); }
}

const scratch = new THREE.Vector3();
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
/** Until when (page seconds) an INK FLASH holds the page: BallMoments' prints and the SUPER SHOT's cut-in say so. */
let inkUntil = -Infinity;
/** An INK FLASH printed now for `seconds` (the renderer prints none under reduced motion, nor on the levels with no
 *  impact frame; then neither does this). */
export function inkShown(seconds: number) {
  if (reduced() || !(VFX.impactFrame > 0)) return;
  inkUntil = Math.max(inkUntil, performance.now() / 1000 + seconds + .1);
}
