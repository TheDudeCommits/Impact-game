import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatEffects } from '../src/render/CombatEffects';
import { AwakeningEffects } from '../src/render/AwakeningEffects';
import { SPRITE } from '../src/render/vfx/SparkField';
import { DREAM_IMPACT } from '../src/render/dreamFlag';
import { elementFor, ghostTint, gradeHue, techniqueColour } from '../src/render/vfx/palette';
import { farSide } from '../src/ui/MangaImpact';
import { DamageNumbers } from '../src/ui/DamageNumbers';
import { MOVES } from '../src/game/moves';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'a', name: 'X', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: .5, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
const event = (props: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'hit', serverTime: 1, actorId: 'a', ...props });

/** The little of a Fighter the effects read: a group in the scene, a skinned
 *  body, hands where a test puts them and a pelvis the drawn centre is read
 *  off. */
function body(id: string, fighter: FighterId, props: Partial<PlayerState> = {}, hand = new THREE.Vector3(0, 1.2, .4)): Fighter {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.name = `fighter-${id}`; group.position.set(state.x, state.y, state.z);
  const geometry = new THREE.BoxGeometry(.4, 1.6, .3, 1, 4, 1), count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(count * 4).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0), 4));
  const hips = new THREE.Bone(); hips.position.y = 1;
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); mesh.name = 'body'; mesh.add(hips); mesh.bind(new THREE.Skeleton([hips]));
  group.add(mesh);
  const handR = hand.clone(), handL = hand.clone().setX(hand.x - .3);
  return { state, group, velocity: new THREE.Vector3(), handR, handL, bones: new Map(), joints: new Map([['Hips', hips]]), armed: false,
    chargePosition(out: THREE.Vector3) { return out.copy(handR); }, meleeContactPoint() { return false; }, strikePoint(out: THREE.Vector3) { return out.copy(handR); } } as unknown as Fighter;
}
/** Sprites of one kind alive at `time`, with where they were born and the
 *  anchor they ride, from the field's own record. */
function sprites(fx: CombatEffects, kind: number, time: number) {
  const field = fx.kit.sparks as unknown as { data: Float32Array; epoch: number };
  const out: { x: number; y: number; z: number; size: number; stretch: number; anchor: number; share: number }[] = [];
  for (let o = 0; o < field.data.length; o += 32) {
    const age = time - field.epoch - field.data[o + 3];
    if (field.data[o + 20] === kind && age >= 0 && age < field.data[o + 7]) out.push({ x: field.data[o], y: field.data[o + 1], z: field.data[o + 2], size: field.data[o + 9], stretch: field.data[o + 11], anchor: Math.floor(field.data[o + 21] / 4 + 1e-3), share: field.data[o + 30] });
  }
  return out;
}

describe('round 2: the hit spark sits on the blow and rides the body', () => {
  // Without the dream loop (`?dreamoff`, DREAM_OFF=1): the look it replaced.
  it.runIf(!DREAM_IMPACT)('puts a melee spark on the striking hand, not over the victim\'s torso, and keeps it under a body\'s height (before the dream loop)', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    // Taisei at the origin facing +z; his fist is on Ouga's chest, 0.9 m away.
    const taisei = body('a', 'taisei', {}, new THREE.Vector3(.05, 1.3, .65)), ouga = body('b', 'ouga', { z: .9 });
    const fighters = new Map([['a', taisei], ['b', ouga]]);
    try {
      for (const f of fighters.values()) scene.add(f.group);
      scene.updateMatrixWorld(true);
      fx.handle([event({ id: 2, targetId: 'b', fighter: 'taisei', slot: 'light', chain: 3, damage: 50, origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: .9 } })], fighters);
      const [burst] = sprites(fx, SPRITE.burst, 1.01), [core] = sprites(fx, SPRITE.core, 1.01);
      expect(burst, 'a burst is drawn').toBeDefined();
      // On the fist's side of the victim's body, not at its centre.
      expect(burst.z).toBeLessThan(.9 - .15);
      expect(burst.y).toBeGreaterThan(1.1);
      // A body is 1.8 m tall: the burst stays under 0.6 of that across, and
      // the white heart no bigger than a head.
      expect(burst.size * 2).toBeLessThan(1.8 * .6);
      expect(core.size).toBeLessThan(.4);
      // And it rides the body it struck.
      expect(burst.anchor).toBeGreaterThan(0);
      expect(core.anchor).toBe(burst.anchor);
      ouga.group.position.set(0, 2, 4); scene.updateMatrixWorld(true);
      fx.update(1.05, 1 / 60, fighters);
      const anchors = fx.kit.sparks.mesh.material.uniforms.uAnchor.value as THREE.Vector3[];
      expect(anchors[burst.anchor].z).toBeCloseTo(3.1, 3);
      expect(anchors[burst.anchor].y).toBeCloseTo(2, 3);
    } finally { fx.dispose(); }
  });

  it.runIf(DREAM_IMPACT)('puts a melee spark on the striking hand, not over the victim\'s torso, and keeps it under a body\'s height', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    // Taisei at the origin facing +z; his fist is on Ouga's chest, 0.9 m away.
    const taisei = body('a', 'taisei', {}, new THREE.Vector3(.05, 1.3, .65)), ouga = body('b', 'ouga', { z: .9 });
    const fighters = new Map([['a', taisei], ['b', ouga]]);
    try {
      for (const f of fighters.values()) scene.add(f.group);
      scene.updateMatrixWorld(true);
      fx.handle([event({ id: 2, targetId: 'b', fighter: 'taisei', slot: 'light', chain: 3, damage: 50, origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: .9 } })], fighters);
      // (The dream loop, 22 October) The burst is the banded starburst (VfxKit.szImpact), the bigger one of a heavy's two;
      // round 27b's impact-frame star (VfxKit SZ_SCREEN, its screen share over .35) is the frame's, not the blow's.
      const stars = sprites(fx, SPRITE.szstar, 1.01);
      const [burst] = stars.filter(s => s.share < .35).sort((a, b) => b.size - a.size), [core] = sprites(fx, SPRITE.core, 1.01);
      expect(stars.filter(s => s.share > .35).length, 'no impact frame').toBe(0);
      expect(burst, 'a burst is drawn').toBeDefined();
      // On the fist's side of the victim's body, not at its centre.
      expect(burst.z).toBeLessThan(.9 - .15);
      expect(burst.y).toBeGreaterThan(1.1);
      // A body is 1.8 m tall. This is a string's finisher, drawn as its biggest burst: no more than
      // two and a quarter bodies across (a jab's stays under 0.75 of one, below), and gone inside a quarter of a second,
      // before the veil thins it (VictimVeil); the white heart no bigger than a head. (Round 31: two bodies, while it was
      // drawn over both fighters; drawn behind them - VfxKit SZ.behind - it goes off a quarter bigger,
      // read round the bodies. Round 43: a fifth bigger again - the blind critics wanted a finisher and launcher to
      // "fill most of the frame with a bold flat jagged star" - under two and
      // three quarters bodies.)
      expect(burst.size * 2).toBeLessThan(1.8 * 2.75);
      expect(core.size).toBeLessThan(.4);
      // (The dream loop) A finisher's burst stays where the blow landed while the body is thrown out of it:
      // it rides no body.
      expect(burst.anchor).toBe(0);
      // A jab: under 0.75 of a body across, well under the finisher's - and it rides the body it struck.
      fx.handle([event({ id: 3, targetId: 'b', fighter: 'taisei', slot: 'light', chain: 1, damage: 30, serverTime: 2, origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: .9 } })], fighters);
      const [jab] = sprites(fx, SPRITE.szstar, 2.01).sort((a, b) => b.size - a.size), [jabCore] = sprites(fx, SPRITE.core, 2.01).sort((a, b) => b.size - a.size);
      expect(jab.size * 2).toBeLessThan(1.8 * .75);
      expect(burst.size).toBeGreaterThan(jab.size * 1.5);
      expect(jab.anchor).toBeGreaterThan(0);
      expect(jabCore.anchor).toBe(jab.anchor);
      ouga.group.position.set(0, 2, 4); scene.updateMatrixWorld(true);
      fx.update(2.05, 1 / 60, fighters);
      const anchors = fx.kit.sparks.mesh.material.uniforms.uAnchor.value as THREE.Vector3[];
      expect(anchors[jab.anchor].z).toBeCloseTo(3.1, 3);
      expect(anchors[jab.anchor].y).toBeCloseTo(2, 3);
    } finally { fx.dispose(); }
  });

  it('only pulses chromatic aberration for the heaviest blows', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    let pulses = 0;
    fx.screen = { impactFrame() {}, chromaticPulse() { pulses++; }, speedLines() {} };
    fx.localId = 'a';
    try {
      fx.handle([event({ id: 3, targetId: 'b', fighter: 'taisei', slot: 'heavy', damage: 90, origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1, z: 1 } })]);
      expect(pulses, 'a heavy is not the heaviest blow').toBe(0);
      fx.handle([event({ id: 4, targetId: 'b', fighter: 'taisei', slot: 'ultimate', damage: 290, serverTime: 3, origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1, z: 1 } })]);
      expect(pulses).toBe(1);
    } finally { fx.dispose(); }
  });
});

describe('round 2: beams', () => {
  it('draws the Sunpalm Cannon as wide as most of its hitbox and keeps its head on the body it hit', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), move = MOVES.taisei.special;
    const taisei = body('a', 'taisei', { action: 'special', actionStarted: 1, actionDuration: move.duration }), ouga = body('b', 'ouga', { z: 6 });
    const fighters = new Map([['a', taisei], ['b', ouga]]);
    try {
      for (const f of fighters.values()) scene.add(f.group);
      scene.updateMatrixWorld(true);
      fx.handle([event({ id: 10, kind: 'cast', fighter: 'taisei', slot: 'special', origin: { x: 0, y: 1.2, z: .4 }, endpoint: { x: 0, y: 1.2, z: move.range } })], fighters);
      fx.handle([event({ id: 11, kind: 'release', fighter: 'taisei', slot: 'special', serverTime: 1 + move.contacts[0] })], fighters);
      const release = 1 + move.contacts[0];
      fx.handle([event({ id: 12, kind: 'hit', targetId: 'b', fighter: 'taisei', slot: 'special', damage: 135, serverTime: release + .02, origin: { x: 0, y: 1.2, z: .4 }, endpoint: { x: 0, y: 1.05, z: 6 } })], fighters);
      fx.update(release + .1, 1 / 60, fighters);
      const u = fx.kit.beams.tube.material.uniforms, state = (u.uState.value as THREE.Vector4[])[0], target = (u.uTarget.value as THREE.Vector3[])[0];
      expect(state.w, 'the beam is drawn').toBe(1);
      expect(state.z, 'its tube is most of the hitbox wide').toBeGreaterThan(move.radius * .8);
      expect(target.z).toBeCloseTo(6, 0);
      // Carried down the beam's line by the blow: the head goes with them.
      ouga.group.position.set(0, .3, 10); scene.updateMatrixWorld(true);
      fx.update(release + .3, 1 / 60, fighters);
      expect((u.uTarget.value as THREE.Vector3[])[0].z).toBeCloseTo(10, 0);
      // Thrown clear of it: the beam goes on to the end of its range.
      ouga.group.position.set(6, 4, 12); scene.updateMatrixWorld(true);
      fx.update(release + .5, 1 / 60, fighters);
      expect((u.uTarget.value as THREE.Vector3[])[0].z).toBeCloseTo(move.range, 0);
      // It lights the room in its own colour: the brightest pool light is blue.
      const lit = fx.kit.lights.lights.slice().sort((a, b) => b.intensity - a.intensity)[0];
      expect(lit.intensity).toBeGreaterThan(10);
      expect(lit.color.b).toBeGreaterThan(lit.color.r);
    } finally { fx.dispose(); }
  });

  it('grades the frame toward a signature technique\'s colour when the look pass can', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), grades: number[][] = [];
    fx.screen = { impactFrame() {}, chromaticPulse() {}, speedLines() {}, techniqueGrade: (colour, strength, seconds) => { grades.push([colour, strength, seconds]); } };
    fx.localId = 'a';
    const shirokane = body('a', 'shirokane', { action: 'ultimate', actionStarted: 1 });
    try {
      fx.handle([event({ id: 20, kind: 'cast', fighter: 'shirokane', slot: 'ultimate', origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1, z: 5 } })], new Map([['a', shirokane]]));
      expect(grades).toHaveLength(1);
      expect(grades[0][0], 'VOID SICKLE is violet').toBe(gradeHue('shirokane', 'ultimate'));
      const violet = new THREE.Color(grades[0][0]);
      expect(violet.b).toBeGreaterThan(violet.g); expect(violet.r).toBeGreaterThan(violet.g);
      expect(grades[0][1]).toBe(1);
      // A signature move another layer draws still lights the room.
      fx.update(1 + MOVES.shirokane.ultimate.contacts[0] * .9, 1 / 60, new Map([['a', shirokane]]));
      expect(fx.kit.lights.lights.some(l => l.intensity > 5)).toBe(true);
      // Without the look pass's grade the cast still works.
      fx.screen = { impactFrame() {}, chromaticPulse() {}, speedLines() {} };
      fx.handle([event({ id: 21, kind: 'cast', fighter: 'shirokane', slot: 'special', serverTime: 5, origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1, z: 5 } })], new Map([['a', shirokane]]));
    } finally { fx.dispose(); }
  });
});

describe('round 2: an iai draw and a chase', () => {
  it('draws a dash-through release as poses strung along the dash and one cut down it', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    const kenzo = body('a', 'kenzo', { x: 4 }), fighters = new Map([['a', kenzo]]);
    // MOVES.kenzo.heavy is Mirage Draw; the round-2 sim marks it an iai draw.
    const heavy = MOVES.kenzo.heavy as typeof MOVES.kenzo.heavy & { dashThrough?: boolean }, was = heavy.dashThrough;
    heavy.dashThrough = true;
    try {
      scene.add(kenzo.group); scene.updateMatrixWorld(true);
      fx.update(1, 1 / 60, fighters);
      fx.handle([event({ id: 40, kind: 'release', fighter: 'kenzo', slot: 'heavy', serverTime: 1, origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 4, y: 1.05, z: 0 } })], fighters);
      fx.update(1.05, 1 / 60, fighters);
      const ghosts = scene.children.filter(o => o.name === 'afterimage' && o.visible) as THREE.SkinnedMesh[];
      expect(ghosts.length, 'a blur of poses').toBeGreaterThanOrEqual(2);
      // Set back along the dash, between where he set off and where he is.
      const xs = ghosts.map(g => g.skeleton.boneMatrices![12]).sort((p, q) => p - q);
      expect(xs[0]).toBeGreaterThan(-.01); expect(xs[xs.length - 1]).toBeLessThan(4);
      // One cut as long as the dash.
      const cut = sprites(fx, SPRITE.streak, 1.05).filter(s => s.stretch > 40);
      expect(cut.length).toBeGreaterThanOrEqual(1);
      // Everything gone within a third of a second.
      fx.update(1.4, 1 / 60, fighters);
      expect(scene.children.filter(o => o.name === 'afterimage' && o.visible)).toHaveLength(0);
    } finally { heavy.dashThrough = was; fx.dispose(); }
  });

  it('kicks up no dust under a chase launched in the air', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    const konta = body('a', 'konta', { y: 3, grounded: false }), fighters = new Map([['a', konta]]);
    try {
      scene.add(konta.group);
      fx.handle([event({ id: 41, kind: 'chase', slot: 'light', serverTime: 1, targetId: 'b', origin: { x: 0, y: 3, z: 0 }, endpoint: { x: 3, y: 3.5, z: 0 } })], fighters);
      expect(fx.kit.dust.live(1.05)).toBe(0);
      expect(sprites(fx, SPRITE.ring, 1.05).length).toBeGreaterThan(0);
    } finally { fx.dispose(); }
  });
});

describe('round 2: colours follow the technique', () => {
  it('tints a rush finisher\'s ghosts and sparks by its own element', () => {
    expect(elementFor('kuon', 'light', false, 3).rim).not.toBe(elementFor('kuon', 'light').rim);
    expect(ghostTint('kuon', false, 'light', 3)).not.toBe(ghostTint('kuon'));
    const red = new THREE.Color(ghostTint('kuon', false, 'light', 3));
    expect(red.r, 'Nova is red').toBeGreaterThan(red.b * 2);
    expect(techniqueColour('nigo', 'special')).not.toBe(techniqueColour('taisei', 'special'));
    // The look pass's four signature hues.
    expect(gradeHue('taisei', 'special')).toBe(0x3a8cff); expect(gradeHue('kuon', 'special')).toBe(0x8a4dff);
    expect(gradeHue('nigo', 'ultimate')).toBe(0xd0203a); expect(gradeHue('konta', 'special', true)).toBe(0xff7a1a);
  });
});

describe('round 2: the aura hugs the body', () => {
  it('burns a shell of the fighter\'s own skinned body for a flame transformation, and nothing for one without', () => {
    const scene = new THREE.Scene(), aura = new AwakeningEffects(scene);
    const taisei = body('a', 'taisei', { awakened: true, awakenedUntil: 20 }), shirokane = body('k', 'shirokane', { x: 4, awakened: true, awakenedUntil: 20 });
    const fighters = new Map([['a', taisei], ['k', shirokane]]);
    const shells = () => scene.children.filter(o => o.name === 'aura-shell' && o.visible) as THREE.SkinnedMesh[];
    try {
      for (const f of fighters.values()) scene.add(f.group);
      aura.update(2, 1 / 60, fighters, 1);
      const drawn = shells();
      expect(drawn, 'gold awakening has a shell, the Guardian does not').toHaveLength(1);
      // The live skeleton, not a copy: the shell moves with every frame of the animation.
      expect(drawn[0].skeleton).toBe((taisei.group.getObjectByName('body') as THREE.SkinnedMesh).skeleton);
      expect((drawn[0].material as THREE.Material).side).toBe(THREE.BackSide);
      taisei.state.awakened = false;
      aura.update(2.1, 1 / 60, fighters, 1);
      expect(shells()).toHaveLength(0);
    } finally { aura.dispose(); }
  });
});

describe('round 2: the lettering and the numbers', () => {
  it('prints the sound effect beyond the struck body, overlapping only its edge', () => {
    const victim = { x: 800, y: 450 }, attacker = { x: 600, y: 450 };
    const place = farSide(victim, attacker, 60, 160, 1600, 900);
    expect(place.x).toBeGreaterThan(victim.x + 60);
    // The word's inner edge reaches back over the silhouette's edge, not past its middle.
    expect(place.x - 80).toBeLessThan(victim.x + 60);
    expect(place.x - 80).toBeGreaterThan(victim.x);
    // Straight down the lens there is no far side on screen: upper right.
    const aligned = farSide(victim, { x: 802, y: 452 }, 60, 160, 1600, 900);
    expect(aligned.x).toBeGreaterThan(victim.x); expect(aligned.y).toBeLessThan(victim.y);
    // Never under the portrait bars.
    expect(farSide({ x: 800, y: 60 }, { x: 800, y: 400 }, 60, 160, 1600, 900).y).toBeGreaterThan(900 * .2);
  });

  it('counts a barrage on one body as one number that ticks up', () => {
    const made: { style: Record<string, string>; textContent: string }[] = [];
    const doc = globalThis as unknown as { document?: unknown; innerWidth?: number; innerHeight?: number };
    const saved = doc.document;
    doc.document = { createElement: () => { const e = { style: {} as Record<string, string>, textContent: '' }; made.push(e); return e; } };
    doc.innerWidth = 1600; doc.innerHeight = 900;
    try {
      const numbers = new DamageNumbers({ append() {} } as unknown as HTMLElement), camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 100);
      camera.position.set(0, 1.5, -5); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
      const at = new THREE.Vector3(0, 1, 0);
      for (const damage of [25, 23, 21]) numbers.show(damage, at, true, undefined, 'b');
      numbers.show(40, at, false, undefined, 'c');
      const shown = () => made.filter(e => e.style.display === 'block');
      expect(shown(), 'one count for b, one for c').toHaveLength(2);
      const start = performance.now();
      while (performance.now() - start < 200) { /* let the count roll up */ }
      numbers.update(camera);
      expect(shown().map(e => e.textContent).sort()).toEqual(['40', '69']);
    } finally { doc.document = saved; }
  });
});
