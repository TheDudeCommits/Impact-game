import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CombatEffects, impactClass, screenWorth } from '../src/render/CombatEffects';
import { ClashEffects } from '../src/render/ClashEffects';
import { AwakeningEffects } from '../src/render/AwakeningEffects';
import { VfxKit } from '../src/render/vfx/VfxKit';
import { SPRITE } from '../src/render/vfx/SparkField';
import { DREAM_IMPACT } from '../src/render/dreamFlag';
import { elementFor, PHYSICAL } from '../src/render/vfx/palette';
import { mangaImpactProfile } from '../src/ui/MangaImpact';
import { MOVES } from '../src/game/moves';
import type { Fighter } from '../src/render/Fighter';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';

const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'a', name: 'X', fighter: 'taisei', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: .5, actionTime: 0, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
const event = (props: Partial<CombatEvent>): CombatEvent => ({ id: 1, kind: 'hit', serverTime: 1, actorId: 'a', ...props });

/** The little of a Fighter the effects read, with one real skinned mesh so
 *  the afterimages have a skeleton to freeze. */
function body(id: string, fighter: FighterId, props: Partial<PlayerState> = {}): Fighter {
  const state = player({ id, fighter, ...props });
  const group = new THREE.Group(); group.name = `fighter-${id}`; group.position.set(state.x, state.y, state.z);
  const geometry = new THREE.BoxGeometry(.4, 1.6, .3, 1, 4, 1);
  const count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Array(count * 4).fill(0).map((_, i) => i % 4 === 0 ? (geometry.attributes.position.getY(Math.floor(i / 4)) > 0 ? 1 : 0) : 0), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(new Array(count * 4).fill(0).map((_, i) => i % 4 === 0 ? 1 : 0), 4));
  const root = new THREE.Bone(), chest = new THREE.Bone(); chest.position.y = .8; root.add(chest);
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial()); mesh.name = 'body'; mesh.add(root); mesh.bind(new THREE.Skeleton([root, chest]));
  group.add(mesh);
  const hand = new THREE.Vector3(state.x + .3, 1.3, state.z + .4);
  return { state, group, velocity: new THREE.Vector3(), handR: hand, handL: hand.clone(), bones: new Map(), joints: new Map(),
    chargePosition(out: THREE.Vector3) { return out.copy(hand); }, meleeContactPoint() { return false; }, strikePoint(out: THREE.Vector3) { return out.copy(hand); } } as unknown as Fighter;
}
const sprites = (kit: VfxKit, time: number) => kit.sparks.live(time);
/** A hit spark is a burst fanned along the blow; the beam heads and the
 *  bombs still throw the round starburst; the dream loop's hit (VfxKit.szImpact) is a banded starburst and, on a
 *  finisher, a burst of flame. Any of them is a spark. */
const sparkKinds = (kit: VfxKit, time: number) => kinds(kit, SPRITE.star, time) + kinds(kit, SPRITE.burst, time) + kinds(kit, SPRITE.szstar, time) + kinds(kit, SPRITE.flame, time);
/** Count the sprites of one kind still drawing at `time`, from the field's own record. */
function kinds(kit: VfxKit, kind: number, time: number) {
  const field = kit.sparks as unknown as { data: Float32Array; epoch: number };
  let n = 0;
  for (let o = 0; o < field.data.length; o += 32) { const age = time - field.epoch - field.data[o + 3]; if (field.data[o + 20] === kind && age >= 0 && age < field.data[o + 7]) n++; }
  return n;
}

describe('the impact language', () => {
  it('sizes a blow by what it was worth and where it sits in its move', () => {
    expect(impactClass(event({ slot: 'light', damage: 30 }), MOVES.taisei.light)).toBe(0);
    expect(impactClass(event({ slot: 'heavy', damage: 90 }), MOVES.kenzo.heavy)).toBe(1);
    expect(impactClass(event({ slot: 'special', damage: 135 }), MOVES.taisei.special)).toBe(2);
    // A rush finisher is the blow the string was building to.
    expect(impactClass(event({ slot: 'light', damage: 30, chain: 3 }), MOVES.taisei.light)).toBeGreaterThanOrEqual(2);
    // The last contact of a barrage outranks its ticks.
    const ora = MOVES.koko.special;
    expect(impactClass(event({ slot: 'special', damage: 25, contactIndex: 0 }), ora)).toBe(0);
    expect(impactClass(event({ slot: 'special', damage: 25, contactIndex: ora.contacts.length - 1 }), ora)).toBe(2);
    expect(impactClass(event({ slot: 'ultimate', damage: 200, contactIndex: MOVES.koko.ultimate.contacts.length - 1 }), MOVES.koko.ultimate)).toBe(3);
    // (The feel pass, 15 October) A special's last blow is class 2 whatever it dealt, as every original's is: Delaware
    // Smash: Air Force deals 101.
    expect(impactClass(event({ slot: 'special', damage: 101, contactIndex: 0 }), MOVES.ampere.special)).toBe(2);
    // (The dream loop, 22 October) A combo ender is the blow its string was building to - class 2 at least, whatever it
    // dealt - and the launcher and the knockdown, which send the body away, class 3.
    // (Without it a combo ender is its own blow and keeps its class by damage.)
    expect(impactClass(event({ slot: 'special', damage: 101, contactIndex: 0, branch: 'llls' }), MOVES.ampere.special)).toBe(DREAM_IMPACT ? 2 : 1);
    if (DREAM_IMPACT) {
      expect(impactClass(event({ slot: 'heavy', damage: 42, branch: 'llh' }), MOVES.taisei.heavy)).toBe(3);
      expect(impactClass(event({ slot: 'heavy', damage: 48, branch: 'lh' }), MOVES.taisei.heavy)).toBe(2);
    }
  });

  it('kicks the camera and bites the frame on a last heavy, ultimate or area blow no less than the originals do', () => {
    // (The feel pass, 15 October) Basilissa's Rosestone Heel: its last kick bites as the originals' lightest heavy; the
    // first is its own damage, and a combo ender keeps its damage.
    const femur = MOVES['basilissa'].heavy, last = femur.contacts.length - 1;
    expect(screenWorth(event({ fighter: 'basilissa', slot: 'heavy', damage: 22, contactIndex: last }))).toBe(52);
    expect(screenWorth(event({ fighter: 'basilissa', slot: 'heavy', damage: 22, contactIndex: 0 }))).toBe(22);
    expect(screenWorth(event({ fighter: 'basilissa', slot: 'heavy', damage: 22, contactIndex: last, branch: 'lh' }))).toBe(22);
    expect(screenWorth(event({ fighter: 'koko', slot: 'ultimate', damage: 300, contactIndex: 0 }))).toBe(300);
  });

  it('colours a blow by its element, not one orange for everyone', () => {
    expect(elementFor('kagari', 'special').rim).not.toBe(elementFor('shirokane', 'heavy').rim);
    expect(elementFor('taisei', 'light')).toBe(PHYSICAL);
    expect(elementFor('taisei', 'light', true)).not.toBe(PHYSICAL);
  });

  // Without the dream loop (`?dreamoff`, DREAM_OFF=1): the look it replaced.
  it.runIf(!DREAM_IMPACT)('draws a melee hit as a camera-facing starburst with a core, a ring and streaks', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    try {
      fx.handle([event({ id: 3, fighter: 'taisei', slot: 'heavy', damage: 90, origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1.1, z: 1 } })]);
      fx.update(1.02, 1 / 60, new Map());
      expect(sparkKinds(fx.kit, 1.02)).toBeGreaterThanOrEqual(1);
      expect(kinds(fx.kit, SPRITE.core, 1.02)).toBe(1);
      expect(kinds(fx.kit, SPRITE.ring, 1.02)).toBeGreaterThanOrEqual(1);
      expect(kinds(fx.kit, SPRITE.streak, 1.02)).toBeGreaterThan(3);
      fx.update(2, 1 / 60, new Map());
      expect(sprites(fx.kit, 2)).toBe(0);
    } finally { fx.dispose(); }
  });

  it.runIf(DREAM_IMPACT)('draws a melee hit as a white heart, a banded starburst, laser bolts, embers and a crescent', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    try {
      fx.handle([event({ id: 3, fighter: 'taisei', slot: 'heavy', damage: 90, origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1.1, z: 1 } })]);
      fx.update(1.02, 1 / 60, new Map());
      expect(sparkKinds(fx.kit, 1.02)).toBeGreaterThanOrEqual(1);
      expect(kinds(fx.kit, SPRITE.core, 1.02)).toBe(1);
      expect(kinds(fx.kit, SPRITE.szstar, 1.02), 'the banded starburst, and a second one inside a heavy').toBe(2);
      expect(kinds(fx.kit, SPRITE.bolt, 1.02), 'laser bolts out of the contact').toBeGreaterThanOrEqual(3);
      expect(kinds(fx.kit, SPRITE.streak, 1.02), 'embers').toBeGreaterThan(3);
      expect(kinds(fx.kit, SPRITE.crescent, 1.03), 'a crescent round a heavy').toBeGreaterThanOrEqual(1);
      fx.update(2, 1 / 60, new Map());
      expect(sprites(fx.kit, 2)).toBe(0);
    } finally { fx.dispose(); }
  });

  it('draws a block on the guard\'s orb, never as a flat shield, and a guard break as its shards', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    const attacker = body('a', 'kenzo'), defender = body('d', 'taisei', { z: 1.2, guarding: true }), fighters = new Map([['a', attacker], ['d', defender]]);
    try {
      // A guard carries no fighter on the event: the attacker's body says who it was.
      fx.handle([event({ id: 4, kind: 'blocked', targetId: 'd', slot: 'heavy', damage: 7, origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 1.2 } })], fighters);
      fx.update(1.02, 1 / 60, fighters);
      // Round 5 (GUARD): the orb takes the blow (a dent and a ripple at the contact point); no hex panel, no disc.
      const orb = scene.getObjectByName('guard-aura') as THREE.InstancedMesh;
      expect(orb.count, 'the orb stands round the guard').toBe(1);
      expect((orb.geometry.getAttribute('aHit').array as Float32Array)[3], 'and carries the blow').toBeGreaterThan(.5);
      expect(kinds(fx.kit, SPRITE.ring, 1.02) + kinds(fx.kit, SPRITE.core, 1.02), 'nothing flat beside it').toBe(0);
      expect(sparkKinds(fx.kit, 1.02), 'a guard is not a hit spark').toBe(0);
      fx.handle([event({ id: 5, kind: 'guard-break', targetId: 'd', slot: 'heavy', damage: 50, serverTime: 1.5, origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 1.2 } })], fighters);
      fx.update(1.52, 1 / 60, fighters);
      expect(kinds(fx.kit, SPRITE.shard, 1.52)).toBeGreaterThan(4);
    } finally { fx.dispose(); }
  });

  it('bursts a projectile that reached the end of its flight without touching anyone', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene);
    const ouga = body('a', 'ouga', { action: 'heavy', actionStarted: 1, actionDuration: MOVES.ouga.heavy.duration }), fighters = new Map([['a', ouga]]);
    const move = MOVES.ouga.heavy, end = { x: 0, y: 1.05, z: 10 };
    try {
      fx.handle([event({ id: 6, kind: 'cast', fighter: 'ouga', slot: 'heavy', origin: { x: 0, y: 1.05, z: 0 }, endpoint: end })], fighters);
      const arrival = 1 + move.contacts[0] + 10 / move.speed!;
      for (let t = 1; t < arrival - .05; t += 1 / 30) fx.update(t, 1 / 30, fighters);
      expect(scene.getObjectByName('cast-6')).toBeDefined();
      const before = sparkKinds(fx.kit, arrival + .1);
      fx.update(arrival + .1, 1 / 30, fighters);
      expect(scene.getObjectByName('cast-6'), 'the shot is spent').toBeUndefined();
      expect(sparkKinds(fx.kit, arrival + .12), 'and it went off').toBeGreaterThan(before);
    } finally { fx.dispose(); }
  });

  it('keeps the number of lights in the scene fixed whatever is asking for light', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), clash = new ClashEffects(scene);
    const lights = () => { let n = 0; scene.traverse(o => { if ((o as THREE.Light).isLight) n++; }); return n; };
    try {
      const count = lights();
      expect(count).toBe(4);
      for (let i = 0; i < 20; i++) fx.handle([event({ id: 10 + i, fighter: 'kagari', slot: 'special', damage: 138, serverTime: 1, endpoint: { x: i, y: 1, z: 0 } })]);
      fx.update(1.03, 1 / 60, new Map());
      expect(lights()).toBe(count);
      const lit = fx.kit.lights.lights.filter(l => l.intensity > 0);
      expect(lit.length).toBeGreaterThan(0);
      // Fire lights the floor orange, not the blue every impact used to throw.
      expect(lit[0].color.r).toBeGreaterThan(lit[0].color.b);
    } finally { clash.dispose(); fx.dispose(); }
  });

  it('shares one kit per scene and lets the last user dispose it', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), awakening = new AwakeningEffects(scene);
    expect(fx.kit).toBe(VfxKit.for(scene)); fx.kit.release();
    fx.dispose();
    expect(scene.getObjectByName('vfx-sparks'), 'still held by AwakeningEffects').toBeDefined();
    awakening.dispose();
    expect(scene.getObjectByName('vfx-sparks')).toBeUndefined();
  });

  it('freezes an afterimage in the pose it was taken in', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), taisei = body('a', 'taisei'), fighters = new Map([['a', taisei]]);
    try {
      scene.add(taisei.group);
      const chest = taisei.group.getObjectByName('body')!.children[0].children[0] as THREE.Bone;
      fx.kit.ghosts.spawn(taisei, 0x7fd8ff, 1, .3, .8, new THREE.Vector3(2, 0, 0));
      const ghost = scene.children.find(o => o.name === 'afterimage' && o.visible) as THREE.SkinnedMesh;
      expect(ghost).toBeDefined();
      const frozen = ghost.skeleton.boneMatrices!.slice(16, 32);
      // The captured chest sits where the live one was, moved by the offset.
      expect(frozen[12]).toBeCloseTo(chest.matrixWorld.elements[12] + 2, 5);
      chest.position.y += 1; taisei.group.updateMatrixWorld(true);
      ghost.skeleton.update();
      expect(Array.from(ghost.skeleton.boneMatrices!.slice(16, 32))).toEqual(Array.from(frozen));
      fx.update(1.1, 1 / 60, fighters);
      expect((ghost.material as THREE.ShaderMaterial).uniforms.uOpacity.value).toBeGreaterThan(0);
      fx.update(1.5, 1 / 60, fighters);
      expect(ghost.visible, 'and it goes when it is spent').toBe(false);
    } finally { fx.dispose(); }
  });

  it('leaves a ghost where a vanisher stood and flashes where they reappear', () => {
    const scene = new THREE.Scene(), fx = new CombatEffects(scene), konta = body('a', 'konta', { x: 4 }), fighters = new Map([['a', konta]]);
    const visibleGhosts = () => scene.children.filter(o => o.name === 'afterimage' && o.visible).length;
    try {
      scene.add(konta.group);
      fx.update(1, 1 / 60, fighters);
      fx.handle([event({ id: 30, kind: 'vanish', targetId: 'b', origin: { x: 0, y: 0, z: 0 }, endpoint: { x: 4, y: 0, z: 0 } })], fighters);
      expect(visibleGhosts()).toBe(1);
      const ghost = scene.children.find(o => o.name === 'afterimage' && o.visible) as THREE.SkinnedMesh;
      // Posed at the origin, four metres from where the body is drawn now.
      expect(ghost.skeleton.boneMatrices![12]).toBeCloseTo(0, 5);
      expect(kinds(fx.kit, SPRITE.flare, 1.02)).toBe(1);
      // A chase streams ghosts after the chaser for as long as it homes.
      fx.handle([event({ id: 31, kind: 'chase', serverTime: 2, targetId: 'b', origin: { x: 4, y: 0, z: 0 }, endpoint: { x: 9, y: 0, z: 0 } })], fighters);
      let most = 0;
      for (let t = 2; t < 2.3; t += 1 / 60) { fx.update(t, 1 / 60, fighters); most = Math.max(most, visibleGhosts()); }
      expect(most).toBeGreaterThanOrEqual(DREAM_IMPACT ? 2 : 3);
    } finally { fx.dispose(); }
  });

  it('prints the moments the new combat adds', () => {
    expect(mangaImpactProfile(event({ kind: 'vanish' }))?.word).toBe('シュン');
    expect(mangaImpactProfile(event({ kind: 'chase' }))).not.toBeNull();
    const finisher = mangaImpactProfile(event({ slot: 'light', chain: 3 }))!, jab = mangaImpactProfile(event({ slot: 'light', chain: 1 }))!;
    expect(finisher.strength).toBeGreaterThan(jab.strength);
  });
});
