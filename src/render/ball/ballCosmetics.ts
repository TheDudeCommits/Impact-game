import * as THREE from 'three';
import type { BallEvent, BallState, BallView } from '../../game/ball/model';
import { BALL_TEAM_COLOURS } from '../../game/ball/model';

/** The ball modes' gear, drawn (economy/catalog.ts kinds `ball`, `balltrail`, `goalburst`; game/ball/look.ts
 *  says who wears what). Kept apart from BallField.ts, which hands it three things: the ball's body material (a skin
 *  recolours it: `patchBallSkin` once, `BallGear.dress` each frame), the trail's colour and its particles, and the
 *  goal's (or the point's) burst. Each page draws the ball in the skin its own player wears; the trail is the last
 *  striker's while the ball is theirs; the burst is the scorer's. All in code: nothing to load. */
export const BALL_SKIN_IDS = ['ball-vermilion', 'ball-night-ink', 'ball-indigo', 'ball-jade', 'ball-gold-leaf'] as const;
export const BALL_TRAIL_IDS = ['balltrail-brush', 'balltrail-embers', 'balltrail-petals', 'balltrail-gold-thread'] as const;
export const GOAL_BURST_IDS = ['goalburst-ink-bomb', 'goalburst-paper-storm', 'goalburst-cranes', 'goalburst-thunder'] as const;

const c = (hex: number) => new THREE.Color(hex);
/** A skin: four inks by the ball's own lightness - its seams and edges (ink), its dark panels, the weave's middle, its
 *  light panels - for the football's panels and the woven ball's strips alike. */
const SKINS: Record<(typeof BALL_SKIN_IDS)[number], [THREE.Color, THREE.Color, THREE.Color, THREE.Color]> = {
  'ball-vermilion': [c(0x1a0505), c(0xc81e2a), c(0xd8483a), c(0xfff4e6)],
  'ball-night-ink': [c(0xf4f0e6), c(0xf4f0e6), c(0x3a3a44), c(0x0d0d12)],
  'ball-indigo': [c(0x0a0f24), c(0x1f3a8a), c(0x4a6fb5), c(0xf1ede2)],
  'ball-jade': [c(0x04140c), c(0x127a52), c(0x3fae7f), c(0xeef6ee)],
  'ball-gold-leaf': [c(0x120d02), c(0x0d0b08), c(0xb8862a), c(0xffd877)],
};
/** Where the skin goes in the body shader: after the ball's own colour (`base`) is worked out, before it is lit. */
export const SKIN_ANCHOR = 'vec3 N=normalize(vN),V=normalize(vV)';
/** The body material learns the skin's uniforms (once). False when its shader no longer has the anchor. */
export function patchBallSkin(material: THREE.ShaderMaterial): boolean {
  if (!material.fragmentShader.includes(SKIN_ANCHOR) || material.uniforms.uSkinOn) return !!material.uniforms.uSkinOn;
  Object.assign(material.uniforms, { uSkinOn: { value: 0 }, uSkinInk: { value: new THREE.Color() }, uSkinA: { value: new THREE.Color() }, uSkinB: { value: new THREE.Color() }, uSkinC: { value: new THREE.Color() } });
  material.fragmentShader = `uniform float uSkinOn;uniform vec3 uSkinInk,uSkinA,uSkinB,uSkinC;\n${material.fragmentShader.replace(SKIN_ANCHOR,
    `if(uSkinOn>.5){float sl=dot(base,vec3(.3,.59,.11));base=sl<.04?mix(uSkinInk,uSkinA,sl/.04):sl<.5?mix(uSkinA,uSkinB,(sl-.04)/.46):mix(uSkinB,uSkinC,(sl-.5)/.5);}\n          ${SKIN_ANCHOR}`)}`;
  material.needsUpdate = true;
  return true;
}

/** What BallField lends for particles: a kind by name, where, its flight, its life and size, its colour, and how it
 *  moves (drag, gravity, flutter, stretched along its flight). */
export type Emit = (kind: 'spark' | 'smoke' | 'burst' | 'ring' | 'petal' | 'confetti' | 'splat' | 'bolt' | 'glint' | 'chunk', x: number, y: number, z: number, vx: number, vy: number, vz: number,
  life: number, size0: number, size1: number, colour: THREE.Color, alpha: number, how?: { drag?: number; grav?: number; flutter?: boolean; floor?: boolean; along?: boolean; stretch?: number; spin?: number; axis?: [number, number, number] }) => void;

const INK = c(0x0b0c0e), GOLD = c(0xffc94a), WHITE = c(0xffffff), PAPER = c(0xf3eee4), PINK = c(0xffa6c2), EMBER = c(0xff7a1e), STORM = c(0xb9a6ff);
const TEAM = { red: c(BALL_TEAM_COLOURS.red), blue: c(BALL_TEAM_COLOURS.blue) };

export class BallGear {
  private readonly tint = new THREE.Color();
  private budget = 0;
  /** The skin this page's own player wears, on the ball (every frame; cheap when nothing changed). */
  dress(material: THREE.ShaderMaterial, view: BallView, selfId: string) {
    const u = material.uniforms;
    if (!u.uSkinOn) return;
    const id = view.seats.find(s => s.id === selfId)?.look?.ball, skin = id ? SKINS[id as keyof typeof SKINS] : undefined;
    u.uSkinOn.value = skin ? 1 : 0;
    if (skin) { (u.uSkinInk.value as THREE.Color).copy(skin[0]); (u.uSkinA.value as THREE.Color).copy(skin[1]); (u.uSkinB.value as THREE.Color).copy(skin[2]); (u.uSkinC.value as THREE.Color).copy(skin[3]); }
  }
  /** The trail the ball's last striker wears, if any. */
  private trailOf(view: BallView, b: BallState) { return b.lastId ? view.seats.find(s => s.id === b.lastId)?.look?.trail : undefined; }
  /** The trail's colour: the striker's side's, or their trail's own. */
  trailColour(view: BallView, b: BallState, team: THREE.Color): THREE.Color {
    switch (this.trailOf(view, b)) {
      case 'balltrail-brush': return this.tint.copy(INK).lerp(team, .22);
      case 'balltrail-gold-thread': return this.tint.copy(GOLD);
      case 'balltrail-petals': return this.tint.copy(team).lerp(PINK, .55);
      default: return team;
    }
  }
  /** What the trail throws off as the ball flies (`at`, `v`: where it is drawn and its flight; `r` its radius). */
  trail(emit: Emit, view: BallView, b: BallState, at: THREE.Vector3, v: THREE.Vector3, speed: number, r: number, dt: number, gain: number) {
    const id = this.trailOf(view, b);
    if (!id || b.held || speed < 4) { this.budget = 0; return; }
    const rate = id === 'balltrail-embers' ? 34 : id === 'balltrail-petals' ? 16 : id === 'balltrail-gold-thread' ? 20 : 12;
    this.budget += rate * Math.min(1, speed / 18) * dt * gain;
    const team = b.lastTeam ? TEAM[b.lastTeam] : WHITE, j = () => (Math.random() - .5) * r;
    for (; this.budget >= 1; this.budget--) {
      const x = at.x + j(), y = at.y + j(), z = at.z + j();
      if (id === 'balltrail-brush') emit('splat', x, y, z, -v.x * .05, -v.y * .05 - 1, -v.z * .05, .7, r * .5, r * .9, this.tint.copy(INK).lerp(team, .15), .9, { grav: 6, drag: 1.5, floor: true });
      else if (id === 'balltrail-embers') emit('spark', x, y, z, -v.x * .12 + (Math.random() - .5) * 3, -v.y * .12 + Math.random() * 3, -v.z * .12 + (Math.random() - .5) * 3, .55, r * .26, r * .06, Math.random() < .3 ? GOLD : EMBER, 1, { grav: 4, drag: 1.8, along: true, stretch: 2.5 });
      else if (id === 'balltrail-petals') emit('petal', x, y, z, -v.x * .08 + (Math.random() - .5) * 2, Math.random() * 1.5, -v.z * .08 + (Math.random() - .5) * 2, 1.4, r * .34, r * .3, Math.random() < .5 ? PINK : PAPER, .95, { grav: 2.2, drag: 1.2, flutter: true, floor: true, spin: (Math.random() - .5) * 10 });
      else emit('glint', x, y, z, -v.x * .04, -v.y * .04, -v.z * .04, .35, r * .5, r * .1, GOLD, 1);
    }
  }
  /** A goal (or a Sky Spike point put away) by someone who wears a burst: theirs, on top of the moment's own. */
  burst(emit: Emit, e: BallEvent, view: BallView, gain: number) {
    if (e.kind !== 'goal' && e.kind !== 'kill' && e.kind !== 'ace') return;
    const id = view.seats.find(s => s.id === e.actorId)?.look?.burst;
    if (!id) return;
    const n = (k: number) => Math.max(1, Math.round(k * gain)), team = e.team ? TEAM[e.team] : WHITE, out = view.mode === 'goal-rush' ? -(Math.sign(e.z) || 1) : 0;
    const x = e.x, y = view.mode === 'goal-rush' ? Math.max(1.4, Math.min(e.y, 3.6)) : .4, z = e.z, a = () => Math.random() * Math.PI * 2;
    switch (id) {
      case 'goalburst-ink-bomb':
        emit('burst', x, y, z, 0, 0, 0, .7, 2.5, 10, INK, 1);
        for (let i = 0; i < n(40); i++) { const t = a(), s = 5 + Math.random() * 11; emit('splat', x, y, z, Math.cos(t) * s, 4 + Math.random() * 9, out * Math.abs(Math.sin(t)) * s + (out ? 0 : Math.sin(t) * s), 1.4, .5, 1.3 + Math.random(), INK, 1, { grav: 16, drag: .8, floor: true }); }
        for (let i = 0; i < n(14); i++) { const t = a(), s = 3 + Math.random() * 6; emit('smoke', x, y, z, Math.cos(t) * s, 2 + Math.random() * 4, Math.sin(t) * s, 1.6, 1.4, 3.6, INK, .9, { drag: 2 }); }
        break;
      case 'goalburst-paper-storm':
        for (let i = 0; i < n(150); i++) { const t = a(), s = 4 + Math.random() * 12; emit('confetti', x + (Math.random() - .5) * 3, y, z, Math.cos(t) * s, 8 + Math.random() * 12, out * (2 + Math.random() * 9) + (out ? 0 : Math.sin(t) * s), 3.4, .3, .28, Math.random() < .75 ? PAPER : INK, 1, { grav: 7, drag: 1.6, flutter: true, floor: true, spin: (Math.random() - .5) * 12 }); }
        emit('ring', x, y, z, 0, 0, 0, .6, 3, 13, PAPER, 1);
        break;
      case 'goalburst-cranes':
        // A flock rising out of the net, folding and gliding up and away.
        for (let i = 0; i < n(36); i++) { const t = a(), s = 2 + Math.random() * 4; emit('confetti', x + (Math.random() - .5) * 4, y - 1 + Math.random() * 2, z, Math.cos(t) * s, 5 + Math.random() * 5, out * (3 + Math.random() * 5) + (out ? 0 : Math.sin(t) * s), 3.6, .7, .55, Math.random() < .2 ? team : WHITE, 1, { grav: -1.2, drag: .5, flutter: true, spin: (Math.random() - .5) * 4 }); }
        emit('glint', x, y, z, 0, 0, 0, .4, 7, 3, WHITE, 1);
        break;
      case 'goalburst-thunder':
        // Bolts down the goal from above, a white flash, sparks off the floor.
        for (let i = 0; i < n(6); i++) { const ox = (Math.random() - .5) * 6, top = y + 7 + Math.random() * 3; emit('bolt', x + ox, (top + .2) / 2, z, 0, 0, 0, .22 + Math.random() * .12, 1.2, 1.2, i % 2 ? STORM : WHITE, 1, { axis: [0, 1, 0], stretch: top / 1.2 * .6 }); }
        emit('glint', x, y, z, 0, 0, 0, .35, 10, 4, WHITE, 1); emit('ring', x, .3, z, 0, 0, 0, .7, 2, 16, STORM, 1);
        for (let i = 0; i < n(40); i++) { const t = a(), s = 6 + Math.random() * 10; emit('spark', x, .4, z, Math.cos(t) * s, 3 + Math.random() * 8, Math.sin(t) * s, .5, .4, .1, Math.random() < .5 ? WHITE : STORM, 1, { grav: 12, drag: 1.5, along: true, stretch: 3 }); }
        break;
    }
  }
}
