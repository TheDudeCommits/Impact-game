import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { LOOM, SPIRIT_CALLERS, SwordSpiritEffects, spiritClips } from '../src/render/SwordSpiritEffects';
import type { GhostShell } from '../src/render/signature/GhostShell';
import { loomTop } from '../src/render/loomRegistry';
import { Fighter } from '../src/render/Fighter';
import { FIGHTERS } from '../src/config';
import { AWAKENINGS, AWAKENING_ENTRY, moveFor } from '../src/game/awakening';
import { MOVES } from '../src/game/moves';
import type { FighterId, PlayerState } from '../src/game/types';
import { base, loadRig } from './rigHarness';
import { bindClips } from '../src/render/Fighter';
import { ORIGINALS } from '../src/originals/roster';

const sources = new Map<FighterId, GLTF>(), rush = new Map<FighterId, THREE.AnimationClip[]>(), bodies = new Map<FighterId, GLTF>();
beforeAll(async () => {
  for (const [id, user] of Object.entries(SPIRIT_CALLERS)) {
    const fighter = id as FighterId, source = await loadRig(user!.asset);
    sources.set(fighter, source);
    const rushModel=FIGHTERS[fighter].rushModel, own=user!.punches?(await loadRig(user!.punches)).animations:[], staged=own.filter(c=>/^Rush \d$/.test(c.name));
    if (ORIGINALS[fighter]) {
      const rest = bindClips(source.scene, own.filter(c => !staged.includes(c)), user!.name), names = new Set(rest.map(c => c.name));
      source.animations = [...source.animations.filter(c => !names.has(c.name)), ...rest];
    }
    const stages=[...(rushModel?(await loadRig(rushModel)).animations:[]).filter(c=>!staged.some(s=>s.name===c.name)),...staged];
    const bound = spiritClips(fighter, source, stages.length?stages:undefined);
    if (bound) rush.set(fighter, bound);
    bodies.set(fighter, await loadRig(FIGHTERS[fighter].model));
  }
}, 120000);

type Inner = { sources: Map<FighterId, GLTF>; rushClips: Map<FighterId, THREE.AnimationClip[]>; spirits: Map<string, Fighter>; shells: Map<string, GhostShell>; fists: Map<FighterId, THREE.InstancedMesh> };
function effectsFor(fighter: FighterId, scene = new THREE.Scene()) {
  const effects = new SwordSpiritEffects(scene), inner = effects as unknown as Inner;
  inner.sources.set(fighter, sources.get(fighter)!); inner.rushClips.set(fighter, rush.get(fighter)!);
  return { effects, inner, scene };
}
/** A stand-in for a fighter the effects read: its state, and its root where
 *  the state puts it. */
function body(fighter: FighterId, props: Partial<PlayerState>, id = 'u'): Fighter {
  const state = { ...base(fighter), id, ...props } as PlayerState;
  const group = new THREE.Group(), model = new THREE.Group();
  group.add(model); group.position.set(state.x, state.y, state.z);
  return { state, group, model, handR: new THREE.Vector3(.3, 1.3, .4), handL: new THREE.Vector3(-.3, 1.3, .4), bones: new Map(), joints: new Map(),
    chargePosition(out: THREE.Vector3) { return out.set(.3, 1.3, .4); }, meleeContactPoint() { return false; }, update() {}, dispose() {} } as unknown as Fighter;
}
/** Where `spirit` is in its user's frame: metres ahead, to the left, and up. */
function offset(spirit: Fighter, user: Fighter) {
  const s = user.state, p = spirit.group.position, dx = p.x - s.x, dz = p.z - s.z;
  return { ahead: dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw), left: dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw), up: p.y - s.y };
}
/** How far the spirit is turned from facing `foe`, radians. */
function offFacing(spirit: Fighter, foe: Fighter) {
  const want = Math.atan2(foe.state.x - spirit.group.position.x, foe.state.z - spirit.group.position.z), d = spirit.group.rotation.y - want;
  return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
}
const clipOf = (spirit: Fighter) => (spirit as unknown as { active?: THREE.AnimationAction }).active?.getClip().name;
/** What the spirit is drawn with: whether its shell is on, and whether any
 *  of its meshes is still drawn in the model's own materials. */
function look(scene: THREE.Scene, name: string) {
  const spirit = scene.getObjectByName(name)!;
  let ghost = 0, own = 0, looming = 0;
  spirit.traverse(o => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || !mesh.visible || /contact-shadow/.test(mesh.name)) return;
    const material = mesh.material as THREE.ShaderMaterial;
    if (/GhostShell/.test(material.name)) { ghost++; if (material.defines?.GHOST_LOOM !== undefined) looming++; }
    else if (!/-ink$|outline/i.test(mesh.name)) own++;
  });
  return { visible: spirit.visible, ghost, own, looming };
}
/** Awaken `u` at `from` and run the effects `seconds` into the window at 60
 *  fps, the transformation first, as the simulation plays it. */
function awaken(effects: SwordSpiritEffects, u: Fighter, seconds: number, from = 0, others: Fighter[] = []) {
  const s = u.state;
  Object.assign(s, { awakened: true, awakenedUntil: from + 18, action: 'awaken', actionStarted: from, actionDuration: AWAKENING_ENTRY, actionTime: 0 });
  const map = new Map<string, Fighter>([[s.id, u], ...others.map(o => [o.state.id, o] as [string, Fighter])]);
  for (let t = 0; t <= seconds; t += 1 / 60) {
    if (t < AWAKENING_ENTRY) s.actionTime = t / AWAKENING_ENTRY;
    else if (s.action === 'awaken') Object.assign(s, { action: 'idle', actionStarted: from + t, actionDuration: 0, actionTime: 0 });
    effects.update(from + t, 1 / 60, map);
  }
  return map;
}

describe('the spirit looms over its awakened user', () => {
  it.each(['koko', 'oro'] as FighterId[])('%s: the same printed shell, summoned for a swing or looming', fighter => {
    const { effects, inner, scene } = effectsFor(fighter), name = SPIRIT_CALLERS[fighter]!.name;
    try {
      const summoner = body(fighter, { action: 'special', actionStarted: 0, actionDuration: 3.1, actionTime: .4 });
      for (let i = 0; i < 20; i++) effects.update(i / 60, 1 / 60, new Map([['u', summoner]]));
      const summoned = look(scene, name), shell = inner.shells.get('u');
      expect(summoned.visible).toBe(true);
      expect(summoned.ghost, 'drawn as a shell').toBeGreaterThan(0);
      expect(summoned.own, 'none of its own textured surfaces').toBe(0);
      expect(inner.spirits.get('u')!.group.scale.x, 'summoned at its own size').toBeCloseTo(1, 6);
      const u = body(fighter, { action: 'idle' });
      awaken(effects, u, 2.5, 2);
      const looming = look(scene, name);
      expect(looming.visible).toBe(true);
      expect(looming.ghost, 'the manifestation, not the textured model').toBeGreaterThan(0);
      expect(looming.own).toBe(0);
      expect(inner.shells.get('u'), 'one shell for both').toBe(shell);
      expect(looming.looming, 'the looming variant (windows, dissolve) of the same print').toBeGreaterThan(0);
    } finally { effects.dispose(); }
  });

  it.each(['koko', 'oro'] as FighterId[])('%s: bigger than the summoned spirit, behind its user and to their left, hovering', fighter => {
    const { effects, inner } = effectsFor(fighter);
    try {
      const u = body(fighter, { action: 'idle', x: 2, z: -1, yaw: .7 });
      awaken(effects, u, 2.5);
      const spirit = inner.spirits.get('u')!, scale = spirit.group.scale.x, at = offset(spirit, u);
      const defined = AWAKENINGS[fighter].formScale!;
      expect(AWAKENINGS[fighter].kind).toBe('spirit');
      expect(defined).toBeGreaterThanOrEqual(1.4); expect(defined).toBeLessThanOrEqual(1.8);
      expect(scale).toBeGreaterThan(1.4); expect(scale).toBeLessThan(1.8);
      expect(at.ahead, 'behind them').toBeLessThan(-.3);
      expect(at.left, 'to their left (the lock-on lens rides their right shoulder)').toBeGreaterThan(.05);
      expect(at.left, 'overlapping them: one silhouette').toBeLessThan(.75);
      expect(at.up, 'off the floor').toBeGreaterThan(.1);
      expect(spirit.group.visible).toBe(true);
      // No floor disc: its contact shadow stays off.
      expect(spirit.group.getObjectByName('contact-shadow')!.visible).toBe(false);
      // How high it reaches over them, for the lock-on camera: to its neck.
      expect(loomTop('u')).toBeGreaterThan(2.2);
      expect(loomTop('u')).toBeLessThan(3.4);
    } finally { effects.dispose(); }
    expect(loomTop('u'), 'cleared with the effects').toBe(0);
  });

  it.each(['koko', 'oro'] as FighterId[])('%s: the user stays in the fight, in their own body', fighter => {
    const state = { ...base(fighter), awakened: true, awakenedUntil: 1e9 } as PlayerState;
    const user = new Fighter(state, bodies.get(fighter)!);
    try {
      for (let i = 0; i < 20; i++) user.update(1 / 60, state, true);
      expect(user.model.visible, 'no longer hidden for the spirit to take over').toBe(true);
    } finally { user.dispose(); }
  });

  it('is alive: it breathes, bobs and sways at rest, on one state rewritten in place', () => {
    const { effects, inner } = effectsFor('koko');
    try {
      const u = body('koko', { action: 'idle' });
      const map = awaken(effects, u, 2);
      const spirit = inner.spirits.get('u')!, state = spirit.state;
      let low = Infinity, high = -Infinity, small = Infinity, big = -Infinity, left = Infinity, right = -Infinity;
      for (let t = 2; t < 6; t += 1 / 60) {
        effects.update(t, 1 / 60, map);
        const p = spirit.group.position, s = spirit.group.scale.x, o = offset(spirit, u);
        low = Math.min(low, p.y); high = Math.max(high, p.y); small = Math.min(small, s); big = Math.max(big, s); left = Math.min(left, o.left); right = Math.max(right, o.left);
      }
      expect(high - low, 'it bobs').toBeGreaterThan(.05);
      expect(high - low, 'gently').toBeLessThan(.2);
      expect(big / small - 1, 'it breathes').toBeGreaterThan(.015);
      expect(right - left, 'it sways').toBeGreaterThan(.03);
      expect(spirit.state, 'one state, rewritten in place').toBe(state);
    } finally { effects.dispose(); }
  });

  it('holds still with its user in somebody else\'s stopped time', () => {
    const { effects, inner } = effectsFor('koko');
    try {
      const u = body('koko', { action: 'idle' });
      const map = awaken(effects, u, 2);
      const spirit = inner.spirits.get('u')!;
      u.state.timeStopped = true;
      for (let t = 2; t < 2.3; t += 1 / 60) effects.update(t, 1 / 60, map);
      let low = Infinity, high = -Infinity, small = Infinity, big = -Infinity;
      for (let t = 2.3; t < 3.3; t += 1 / 60) { effects.update(t, 1 / 60, map); low = Math.min(low, spirit.group.position.y); high = Math.max(high, spirit.group.position.y); small = Math.min(small, spirit.group.scale.x); big = Math.max(big, spirit.group.scale.x); }
      expect(spirit.state.timeStopped, 'its state says so').toBe(true);
      expect(high - low, 'no bob').toBeLessThan(.002);
      expect(big - small, 'no breath').toBeLessThan(.001);
    } finally { effects.dispose(); }
  });

  // Round 3b (integrator, from POLISH): the spirit that fought for its user
  // stood in its idle through every light string - its file has no clip under
  // the light's name, nor the rush stages'. It throws the user's own rush, and
  // now it does so looming over them, coming round to strike.
  it.each([['koko', 'Straight Punch'], ['oro', 'Gilded Punch']] as [FighterId, string][])('%s: it throws the light and every rush stage, come round to the victim', (fighter, light) => {
    const { effects, inner } = effectsFor(fighter);
    try {
      const u = body(fighter, { action: 'idle', yaw: 0 }), foe = body('konta', { x: .4, z: 2.2, yaw: Math.PI }, 'foe');
      awaken(effects, u, 2, 0, [foe]);
      const spirit = inner.spirits.get('u')!, rest = offset(spirit, u);
      const expected = [light, 'Rush 1', 'Rush 2', 'Rush 3'];
      for (let stage = 0; stage < 4; stage++) {
        const contact = (stage ? MOVES[fighter].light : moveFor(fighter, 'light', true)).contacts[0];
        Object.assign(u.state, { action: 'light', chain: stage, actionSeq: 10 + stage, actionStarted: 3 + stage, actionDuration: .6, actionTime: 0, target: 'foe' });
        let turned = Infinity, ahead = -Infinity;
        for (let i = 0; i < 24; i++) {
          u.state.actionTime = i / 40;
          effects.update(3 + stage + i / 60, 1 / 60, new Map([['u', u], ['foe', foe]]));
          if (i / 40 * .6 >= contact) { ahead = Math.max(ahead, offset(spirit, u).ahead); turned = Math.min(turned, offFacing(spirit, foe)); }
        }
        expect(clipOf(spirit), `stage ${stage}`).toBe(expected[stage]);
        expect(ahead, `stage ${stage}: come round from behind`).toBeGreaterThan(rest.ahead + .3);
        expect(turned, `stage ${stage}: turned to the victim`).toBeLessThan(.35);
      }
    } finally { effects.dispose(); }
  });

  it.each(['koko', 'oro'] as FighterId[])('%s: the special\'s barrage, thrown by the looming spirit', fighter => {
    const { effects, inner } = effectsFor(fighter);
    try {
      const u = body(fighter, { action: 'idle', yaw: 0 }), foe = body('konta', { x: 0, z: 2.3, yaw: Math.PI }, 'foe');
      awaken(effects, u, 2, 0, [foe]);
      // The fist trails load with the spirit's file (SwordSpiritEffects.load); here, a stand-in batch.
      const batch = new THREE.InstancedMesh(new THREE.BoxGeometry(.1, .1, .1), new THREE.MeshBasicMaterial(), 96); batch.count = 0; inner.fists.set(fighter, batch);
      const special = MOVES[fighter].special;
      Object.assign(u.state, { action: 'special', actionSeq: 20, actionStarted: 2.5, actionDuration: special.duration, actionTime: 0, target: 'foe' });
      let fists = 0;
      for (let i = 0; i < 90; i++) { u.state.actionTime = (i / 60) / special.duration; effects.update(2.5 + i / 60, 1 / 60, new Map([['u', u], ['foe', foe]])); fists = Math.max(fists, inner.fists.get(fighter)?.count ?? 0); }
      const spirit = inner.spirits.get('u')!;
      expect(clipOf(spirit)).toMatch(/Barrage/);
      expect(spirit.group.scale.x, 'the looming spirit, not a summoned one').toBeGreaterThan(1.4);
      expect(fists, 'the wall of fists').toBeGreaterThan(20);
    } finally { effects.dispose(); }
  });

  it.each(['koko', 'oro'] as FighterId[])('%s: the awakened time stop: the looming spirit tours the field with its user, throwing the barrage', fighter => {
    const { effects, inner } = effectsFor(fighter);
    try {
      const u = body(fighter, { action: 'idle', yaw: 0 }), a = body('konta', { x: 0, z: 2.2, yaw: Math.PI }, 'a'), b = body('gummy', { x: 3, z: 3, yaw: Math.PI }, 'b');
      awaken(effects, u, 2, 0, [a, b]);
      const move = moveFor(fighter, 'ultimate', true), spirit = inner.spirits.get('u')!;
      Object.assign(u.state, { action: 'ultimate', actionSeq: 30, actionStarted: 3, actionDuration: move.duration, actionTime: 0, target: 'a' });
      let barrage = 0, far = 0;
      // Round 3d (ULTS): the barrage is the stop's cinematic, once the stop has
      // caught somebody (the confirm, as the tour is planned just after it);
      // the tour moves on to the second victim half way through its blows.
      const stopAt = move.contacts[move.timeStop!.contact], across = (move.contacts[1] + move.contacts[move.contacts.length - 2]) / 2;
      for (let t = 0; t < move.duration; t += 1 / 60) {
        if (t > stopAt) u.state.confirmedAt = 3 + stopAt + .02;
        // The tour: at the first victim, then across to the second.
        const second = t > across;
        u.state.x = second ? 2.9 : 0; u.state.z = second ? 1.1 : 0; u.state.yaw = second ? Math.atan2(3 - 2.9, 3 - 1.1) : 0; u.group.position.set(u.state.x, 0, u.state.z);
        u.state.actionTime = t / move.duration;
        effects.update(3 + t, 1 / 60, new Map([['u', u], ['a', a], ['b', b]]));
        if (spirit.state.action === 'special') barrage++;
        far = Math.max(far, Math.hypot(spirit.group.position.x - u.state.x, spirit.group.position.z - u.state.z));
      }
      expect(barrage, 'the barrage through the tour').toBeGreaterThan(60);
      expect(spirit.group.scale.x, 'the looming spirit does the tour').toBeGreaterThan(1.4);
      expect(far, 'it goes with its user across the field').toBeLessThan(1.2);
    } finally { effects.dispose(); }
  });

  it.each(['koko', 'oro'] as FighterId[])('%s: it rises out of its user, and breaks up going back in as the window closes', fighter => {
    const { effects, inner } = effectsFor(fighter);
    try {
      const u = body(fighter, { action: 'idle', yaw: 0 }), shell = () => inner.shells.get('u')!;
      awaken(effects, u, .1);
      const spirit = inner.spirits.get('u')!;
      expect(!spirit.group.visible || shell().dissolve > .9, 'not out yet as the transformation starts').toBe(true);
      const early = shell().dissolve;
      for (let t = .1; t < .6; t += 1 / 60) { u.state.actionTime = Math.min(1, t / AWAKENING_ENTRY); effects.update(t, 1 / 60, new Map([['u', u]])); }
      const rising = { dissolve: shell().dissolve, scale: spirit.group.scale.x, back: -offset(spirit, u).ahead };
      expect(rising.dissolve, 'assembling').toBeLessThan(early);
      expect(rising.dissolve).toBeGreaterThan(.05);
      expect(rising.scale, 'growing out of its user').toBeLessThan(AWAKENINGS[fighter].formScale! - .05);
      expect(rising.back, 'still close to them').toBeLessThan(LOOM.back);
      const casters = () => { let n = 0; spirit.model.traverse(o => { if ((o as THREE.Mesh).isMesh && o.castShadow) n++; }); return n; };
      expect(casters(), 'no whole shadow under a spirit still assembling').toBe(0);
      Object.assign(u.state, { action: 'idle', actionDuration: 0, actionTime: 0 });
      for (let t = .6; t < 3; t += 1 / 60) effects.update(t, 1 / 60, new Map([['u', u]]));
      expect(shell().dissolve, 'whole').toBeLessThan(.01);
      expect(casters(), 'and its shadow once it is').toBeGreaterThan(0);
      expect(spirit.group.scale.x).toBeGreaterThan(AWAKENINGS[fighter].formScale! * .97);
      // The window runs out at 18 s.
      for (let t = 3; t < 17.6; t += 1 / 30) effects.update(t, 1 / 30, new Map([['u', u]]));
      expect(shell().dissolve, 'breaking up as the window closes').toBeGreaterThan(.2);
      u.state.awakened = false;
      for (let t = 17.6; t < 19; t += 1 / 60) effects.update(t, 1 / 60, new Map([['u', u]]));
      expect(spirit.group.visible, 'gone with the window').toBe(false);
      expect(loomTop('u')).toBe(0);
    } finally { effects.dispose(); }
  });

  it('keeps the target and its user readable through it (the shell\'s windows)', () => {
    const { effects, inner } = effectsFor('koko');
    try {
      const u = body('koko', { action: 'idle', yaw: 0, target: 'foe' }), foe = body('konta', { x: .3, z: 3, yaw: Math.PI }, 'foe');
      awaken(effects, u, 2.5, 0, [foe]);
      const shell = inner.shells.get('u')! as unknown as { loomSubjects: unknown[]; loomKeep: number[]; windows(r: unknown, c: THREE.Camera): void; loom: { uLoomRect: { value: THREE.Vector4[] }; uLoomAt: { value: THREE.Vector2[] } } };
      expect(shell.loomSubjects[0], 'the target').toBe(foe);
      expect(shell.loomSubjects[1], 'its own user').toBe(u);
      expect(shell.loomKeep[0]).toBeLessThan(.3);
      expect(shell.loomKeep[1]).toBeLessThan(.6);
      // The lock-on lens: behind the user's right shoulder, looking past them.
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 200);
      camera.position.set(-1.05, 1.45, -3.1); camera.lookAt(.2, 1, 1.6); camera.updateMatrixWorld();
      shell.windows({ info: { render: { frame: 1 } } }, camera);
      const rect = shell.loom.uLoomRect.value[0], at = shell.loom.uLoomAt.value[0];
      const centre = new THREE.Vector3(foe.state.x, 1, foe.state.z).project(camera);
      expect(centre.x).toBeGreaterThan(rect.x); expect(centre.x).toBeLessThan(rect.z);
      expect(centre.y).toBeGreaterThan(rect.y); expect(centre.y).toBeLessThan(rect.w);
      expect(at.x, 'thinned only in front of the target').toBeGreaterThan(4); expect(at.x).toBeLessThan(6.5);
      expect(at.y).toBeCloseTo(LOOM.keepTarget, 6);
    } finally { effects.dispose(); }
  });

  it('fades out for a lens inside it or beside its body, from its thighs to its neck', () => {
    const { effects, inner } = effectsFor('koko');
    try {
      const u = body('koko', { action: 'idle', yaw: 0 });
      awaken(effects, u, 2.5);
      const spirit = inner.spirits.get('u')!, shell = inner.shells.get('u')! as unknown as { entries: { mesh: THREE.Mesh }[]; body: THREE.ShaderMaterial };
      spirit.group.updateMatrixWorld(true);
      const renderer = { info: { render: { frame: 7 } }, getCurrentViewport() {} } as unknown as THREE.WebGLRenderer;
      const opacityFrom = (x: number, y: number, z: number) => {
        const camera = new THREE.PerspectiveCamera(50, 16 / 9, .1, 100); camera.position.set(x, y, z); camera.lookAt(0, 1, 2); camera.updateMatrixWorld();
        const first = shell.entries[0].mesh; first.onBeforeRender(renderer, new THREE.Scene(), camera, first.geometry, first.material as THREE.Material, null as unknown as THREE.Group);
        return shell.body.uniforms.uOpacity.value as number;
      };
      const p = spirit.group.position;
      expect(opacityFrom(p.x + .3, p.y + .9, p.z - .2), 'a lens by its knee').toBeLessThan(.05);
      expect(opacityFrom(p.x + .5, p.y + 2.6, p.z + .3), 'by its shoulder').toBeLessThan(.05);
      expect(opacityFrom(1.05 * -1, 1.45 * 1.4, -3.1 * 1.4), 'the lock-on lens, stood back for it').toBeGreaterThan(.6);
    } finally { effects.dispose(); }
  });

  it('links its programs at load: the loading screen\'s spirits wear the looming shell', () => {
    const scene = new THREE.Scene(), { effects, inner } = effectsFor('koko', scene);
    inner.sources.set('oro', sources.get('oro')!); inner.rushClips.set('oro', rush.get('oro')!);
    try {
      effects.update(0, 0, new Map([['warm-koko', body('koko', {}, 'warm-koko')], ['warm-oro', body('oro', {}, 'warm-oro')]]));
      for (const id of ['warm-koko', 'warm-oro']) {
        expect(inner.shells.get(id)!.enabled, id).toBe(true);
        let looming = 0;
        inner.spirits.get(id)!.model.traverse(o => { const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined; if (m?.defines?.GHOST_LOOM !== undefined) looming++; });
        expect(looming, `${id}: every pass compiled with the window and dissolve`).toBeGreaterThan(2);
      }
      // And a looming speck among the ghost warm-up's.
      let speck = 0;
      scene.getObjectByName('ghost-shell-warm')!.traverse(o => { const m = (o as THREE.Mesh).material as THREE.ShaderMaterial | undefined; if (m?.defines?.GHOST_LOOM !== undefined) speck++; });
      expect(speck).toBeGreaterThan(0);
    } finally { effects.dispose(); }
  });

  it('keeps the time-stop bubble where the clock stopped while the user crosses the field', () => {
    const scene = new THREE.Scene(), effects = new SwordSpiritEffects(scene);
    const move = moveFor('koko', 'ultimate', false), stopAt = move.contacts[0];
    const koko = body('koko', { action: 'ultimate', actionStarted: 0, actionDuration: move.duration, x: 0, z: 0 });
    try {
      const at = (elapsed: number, x: number) => { koko.state.actionTime = elapsed / move.duration; koko.state.x = x; koko.group.position.x = x; effects.update(elapsed, 1 / 60, new Map([['u', koko]])); };
      at(stopAt + .05, 0);
      const dome = scene.getObjectByName('dead-stop-time-stop')!;
      expect(dome.position.x).toBeCloseTo(0, 6);
      // He moves four metres across it: the bubble stays.
      for (let i = 1; i <= 20; i++) at(stopAt + .05 + i / 60, i * .2);
      expect(dome.position.x).toBeCloseTo(0, 6);
    } finally { effects.dispose(); }
  });
});
