import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CombatAudio } from '../src/audio/CombatAudio';
import { AUDIO_CUES, planCombatAudio, cueDuration } from '../src/audio/cuePlan';
import { resetVoiceMemory } from '../src/audio/voicePlan';
import { moveFor } from '../src/game/awakening';
import { MOVES } from '../src/game/moves';
import { barrageWindow } from '../src/game/timeStopBarrage';
import { CombatEffects, FLIGHTS } from '../src/render/CombatEffects';
import { GummyEffects } from '../src/render/GummyEffects';
import { SwordSpiritEffects } from '../src/render/SwordSpiritEffects';
import type { Fighter } from '../src/render/Fighter';
import type { AttackSlot, CombatEvent, FighterId, PlayerState } from '../src/game/types';

/**
 * Round 13: three specials became projectiles, HUSH got its GAN track,
 * Kenzo's light stopped speaking in Gummy's voice, and Nigo was heard.
 */

const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'self', name: 'X', fighter: 'nigo', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100, action: 'idle', actionStarted: .5, actionTime: .05, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
const event = (props: Partial<CombatEvent> = {}): CombatEvent => ({ id: 1, kind: 'cast', serverTime: 1, actorId: 'self', fighter: 'nigo', slot: 'special', origin: { x: 0, y: 1, z: 0 }, endpoint: { x: 0, y: 1, z: 10 }, ...props });

// The same Web Audio stand-in tests/audioMix.test.ts uses.
class Param { value = 1; setValueAtTime() {} linearRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} cancelAndHoldAtTime() {} }
class Node { gain = new Param(); pan = new Param(); connect() { return this; } disconnect() {} }
class Source extends Node { buffer?: unknown; playbackRate = new Param(); loop = false; loopStart = 0; loopEnd = 0; onended?: () => void; starts: number[] = []; stops: number[] = []; start(t: number) { this.starts.push(t); } stop(t: number) { this.stops.push(t); } }
class Context { static last: Context; currentTime = 10; state = 'running'; destination = new Node(); sources: Source[] = []; constructor() { Context.last = this; } createGain() { return new Node(); } createStereoPanner() { return new Node(); } createBufferSource() { const x = new Source(); this.sources.push(x); return x; } createDynamicsCompressor() { return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() }); } resume() { return Promise.resolve(); } close() { return Promise.resolve(); } decodeAudioData() { return Promise.resolve({ duration: 3 }); } }
async function audio() { vi.stubGlobal('AudioContext', Context); vi.stubGlobal('fetch', async () => ({ ok: true, headers: { get: () => 'audio/wav' }, arrayBuffer: async () => new ArrayBuffer(8) })); const a = new CombatAudio(); await a.unlock(); return a; }
/** A source stopped once is playing to its end; stopped twice, it was cut. */
const cut = (s: Source) => s.stops.length > 1;
afterEach(() => vi.unstubAllGlobals());

describe('GAN GAN on HUSH', () => {
  // Round 3: the loop is scheduled over barrageWindow (src/game/timeStopBarrage.ts)
  // from its first blow through its last. The call is cut so it has ended by
  // then rather than pushing the barrage late: one man, one phrase at a time.
  // Round 3d (ULTS): the stop is a hit-confirm opener, so the call goes out
  // with the cast and the barrage is the cinematic's - planned from the tour's
  // first blow, a release that only comes once the stop has caught somebody.
  const first = (awakened: boolean) => { const world = moveFor('koko', 'ultimate', awakened); return { world, index: world.timeStop!.contact + 1, at: world.contacts[world.timeStop!.contact + 1] }; };
  const tour = (awakened: boolean, props: Partial<CombatEvent> = {}) => {
    const { index, at } = first(awakened);
    return event({ id: 3, kind: 'release', fighter: 'koko', slot: 'ultimate', contactIndex: index, serverTime: 1 + at, ...props });
  };
  for (const awakened of [false, true]) {
    it(`covers the ${awakened ? 'awakened' : 'base'} barrage from its first blow through its last`, () => {
      const { world, at } = first(awakened), window = barrageWindow(world)!;
      const cast = planCombatAudio(event({ fighter: 'koko', slot: 'ultimate' }), awakened);
      expect(cast.some(l => l.loop && l.bus === 'voice'), 'nothing of the barrage with the cast').toBe(false);
      const barrage = planCombatAudio(tour(awakened), awakened).find(l => l.loop && l.bus === 'voice');
      expect(barrage, 'the barrage cue is planned').toBeDefined();
      const from = at + (barrage!.delay ?? 0);
      expect(from).toBeLessThanOrEqual(window.start);
      expect(from).toBeGreaterThan(window.start - .1);
      expect(from + barrage!.duration!).toBeGreaterThanOrEqual(window.end);
      expect(barrage!.loop, 'looped, so a window longer than the file is still covered').toBe(true);
      const call = cast.find(l => l.bus === 'voice' && !l.loop && !l.delay)!;
      expect(call, 'the line still plays').toBeDefined();
      expect(call.duration ?? cueDuration(call.cue), 'and has ended before the barrage').toBeLessThanOrEqual(from);
    });
  }
  it('is timed differently for the two forms', () => {
    const base = planCombatAudio(tour(false), false).find(l => l.loop && l.bus === 'voice')!;
    const awakened = planCombatAudio(tour(true), true).find(l => l.loop && l.bus === 'voice')!;
    expect(awakened.duration!).toBeGreaterThan(base.duration!);
  });
  it('is not stopped by the callout, and outlives the releases after it', async () => {
    const a = await audio();
    const jo = (props: Partial<PlayerState> = {}) => [player({ id: 'jo', fighter: 'koko', action: 'ultimate', actionStarted: 1, actionDuration: MOVES.koko.ultimate.duration, ...props })];
    a.handle([event({ actorId: 'jo', fighter: 'koko', slot: 'ultimate' })], 'jo', jo());
    const c = Context.last;
    const plan = planCombatAudio(event({ actorId: 'jo', fighter: 'koko', slot: 'ultimate' }));
    const line = c.sources[plan.findIndex(l => l.bus === 'voice' && !l.loop)];
    expect(cut(line)).toBe(false);
    // Time stops on the opener, which the server reports as a release; the
    // call has been said by the tour's first blow (its source has ended).
    a.handle([event({ id: 2, kind: 'release', actorId: 'jo', fighter: 'koko', slot: 'ultimate', contactIndex: 0, serverTime: 1 + MOVES.koko.ultimate.contacts[0] })], 'jo', jo({ actionTime: .18 }));
    line.onended?.();
    a.handle([tour(false, { actorId: 'jo' })], 'jo', jo({ actionTime: .3 }));
    const barrage = c.sources.find(s => s.loop)!;
    expect(barrage, 'a looped source was scheduled').toBeDefined();
    expect(cut(line)).toBe(false); expect(cut(barrage)).toBe(false);
    a.handle([tour(false, { id: 4, actorId: 'jo', contactIndex: first(false).index + 1, serverTime: 1.2 + first(false).at })], 'jo', jo({ actionTime: .35 }));
    expect(cut(barrage), 'the barrage runs on through the blows after it').toBe(false);
    a.dispose();
  });
});

describe('a cast announced ahead of the server is not cancelled by the snapshot it was announced against', () => {
  it('keeps every layer of a predicted cast until authority answers', async () => {
    const a = await audio();
    a.handle([event({ id: 1_000_000_001, serverTime: 5 })], 'self', [player()]);
    const c = Context.last;
    expect(c.sources.length).toBeGreaterThan(1);
    expect(c.sources.some(cut), 'nothing was cut on the announcing call').toBe(false);
    // The server agrees a round trip later.
    a.handle([], 'self', [player({ action: 'special', actionStarted: 4.93, actionDuration: 2.6 })]);
    expect(c.sources.some(cut)).toBe(false);
    // And the cast is still tracked: a hit taken afterwards cancels it.
    a.handle([], 'self', [player({ action: 'hurt', actionStarted: 5.4 })]);
    expect(c.sources.every(cut), 'interrupted after confirmation, every cast layer stops').toBe(true);
    a.dispose();
  });
  it('waits through neutral states but not through authority overruling it', async () => {
    const a = await audio();
    a.handle([event({ id: 1_000_000_002, serverTime: 5 })], 'self', [player()]);
    const c = Context.last;
    a.handle([], 'self', [player({ action: 'run', actionStarted: 4.9 })]);
    expect(c.sources.some(cut), 'a run that started before the press is not a refusal').toBe(false);
    a.handle([], 'self', [player({ action: 'hurt', actionStarted: 4.95 })]);
    expect(c.sources.every(cut), 'being hit instead is').toBe(true);
    a.dispose();
  });
  it('gives up a press the server never answers', async () => {
    const a = await audio();
    const clock = vi.spyOn(performance, 'now');
    clock.mockReturnValue(100_000);
    a.handle([event({ id: 1_000_000_003, serverTime: 5 })], 'self', [player()]);
    const c = Context.last;
    clock.mockReturnValue(100_000 + 600);
    a.handle([], 'self', [player()]);
    expect(c.sources.some(cut)).toBe(false);
    clock.mockReturnValue(100_000 + 1400);
    a.handle([], 'self', [player()]);
    expect(c.sources.every(cut), 'a rejected press stops making its noise').toBe(true);
    clock.mockRestore();
    a.dispose();
  });
});

/** RMS of a 16-bit PCM WAV, in dBFS, walking the RIFF chunks. */
function rmsDb(file: string) {
  const b = readFileSync(new URL('../public/assets/audio/v2/' + file, import.meta.url));
  let at = 12, dataAt = 0, length = 0;
  while (at + 8 <= b.length) { const id = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4); if (id === 'data') { dataAt = at + 8; length = size; break; } at += 8 + size + (size & 1); }
  let sum = 0; const n = Math.floor(length / 2);
  for (let i = 0; i < n; i++) { const v = b.readInt16LE(dataAt + i * 2) / 32768; sum += v * v; }
  return 10 * Math.log10(sum / n);
}

describe('Nigo is heard', () => {
  it('uses recorded attack calls for Nightfang and NIGHTFALL without a Unsealed call on normal slashes', () => {
    // Round 3: his light stages may carry a wordless effort; never a named call.
    for(const slot of ['light','heavy'] as AttackSlot[])for(let id=1;id<40;id++)expect(planCombatAudio(event({id,fighter:'nigo',slot,serverTime:id*3})).filter(l=>l.bus==='voice'&&/unsealed|haizan|nightfang|nightfall/.test(l.cue))).toEqual([]);
    for (const slot of ['special', 'ultimate'] as AttackSlot[]) {
      const voice = planCombatAudio(event({ fighter: 'nigo', slot })).filter(l => l.bus === 'voice');
      expect(voice.length, `${slot} has a voice line`).toBe(1);
      expect(rmsDb(AUDIO_CUES[voice[0].cue]), `${voice[0].cue} is not silent`).toBeGreaterThan(-30);
    }
  });
  it('says NIGHTFALL with the black wave, and keeps it once the server agrees', async () => {
    // Round 3d (ULTS): the wave is the opener, let go at 0.5, so the call is
    // made with the cast rather than delayed to a release three seconds on.
    const a = await audio();
    a.handle([event({ id: 1_000_000_004, slot: 'ultimate', serverTime: 5 })], 'self', [player()]);
    const c = Context.last, plan = planCombatAudio(event({ slot: 'ultimate' }));
    const line = c.sources[plan.findIndex(l => l.bus === 'voice')];
    expect(line, 'the NIGHTFALL line was scheduled').toBeDefined();
    expect(line.starts[0]).toBeLessThan(10 + MOVES.nigo.ultimate.contacts[0]);
    a.handle([], 'self', [player({ action: 'ultimate', actionStarted: 4.95, actionDuration: MOVES.nigo.ultimate.duration })]);
    expect(cut(line)).toBe(false);
    a.dispose();
  });
});


/** The little of a Fighter the effects read. */
function body(id: string, fighter: FighterId, action: PlayerState['action'], started: number, x = 0, z = 0): Fighter {
  const state = player({ id, fighter, action, actionStarted: started, actionDuration: MOVES[fighter][action as AttackSlot]?.duration ?? 1, x, z });
  const group = new THREE.Group(); group.position.set(x, 0, z);
  const handR = new THREE.Vector3(x + .3, 1.3, z + .4), handL = new THREE.Vector3(x - .3, 1.3, z + .4), foot = new THREE.Vector3(x + .2, .1, z + .5);
  return { state, group, handR, handL, bones: new Map(), joints: new Map(),
    chargePosition(out: THREE.Vector3) { return out.copy(handR); },
    meleeContactPoint(_i: number, out: THREE.Vector3) { if (fighter === 'kosho') { out.copy(foot); return true; } return false; },
  } as unknown as Fighter;
}

describe('the new specials', () => {
  // Round 4b (GUMMY): the special was Signal Fire, a burning fist thrown; it is the SUNSET BARRAGE now - fists down the
  // line at the body it is for, drawn by GummyEffects (signature/GatlingFists), no projectile and no ball of light.
  it('throws the SUNSET BARRAGE as fists down the line to the body it is for, gone with the move', () => {
    const scene = new THREE.Scene(), effects = new CombatEffects(scene), fists = new GummyEffects(scene);
    const gummy = body('l', 'gummy', 'special', 1), victim = body('v', 'kenzo', 'idle', 0, 0, 7), fighters = new Map([['l', gummy], ['v', victim]]);
    gummy.state.target = 'v';
    const move = MOVES.gummy.special, c = move.contacts;
    effects.handle([event({ actorId: 'l', fighter: 'gummy', slot: 'special', serverTime: 1, origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 16 } })], fighters);
    expect(scene.getObjectByName('cast-1'), 'no ki projectile or beam drawn for it').toBeUndefined();
    const drawn = scene.getObjectByName('gatling-fists') as THREE.InstancedMesh;
    expect(drawn).toBeDefined();
    const at = (t: number) => { gummy.state.actionTime = t / move.duration; fists.update(1 + t, fighters, 1); };
    // Before the first fist: nothing out.
    at(.1); expect(drawn.count).toBe(0); expect(drawn.visible).toBe(false);
    // Through the barrage: fists out, every one between his shoulders and the far side of the body it is for.
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    for (const t of [c[0] + .02, (c[0] + c[c.length - 1]) / 2, c[c.length - 1] - .05]) {
      at(t);
      expect(drawn.count, `fists out at ${t.toFixed(2)} s`).toBeGreaterThan(2);
      for (let i = 0; i < drawn.count; i++) { drawn.getMatrixAt(i, m); p.setFromMatrixPosition(m); expect(p.z).toBeGreaterThan(-.2); expect(p.z).toBeLessThan(7.5); expect(Math.abs(p.x)).toBeLessThan(1.6); }
    }
    // Some of them have reached the body.
    at((c[2] + c[3]) / 2);
    let reached = 0; for (let i = 0; i < drawn.count; i++) { drawn.getMatrixAt(i, m); p.setFromMatrixPosition(m); if (p.z > 5) reached++; }
    expect(reached).toBeGreaterThan(0);
    // After the move: none.
    at(move.duration + .2); expect(drawn.count).toBe(0);
    effects.dispose(); fists.dispose();
  });

  it('throws COUP DE FEU as an orange crescent from the foot', () => {
    const scene = new THREE.Scene(), effects = new CombatEffects(scene), fire = new GummyEffects(scene);
    const kosho = body('s', 'kosho', 'special', 1), fighters = new Map([['s', kosho]]);
    const release = MOVES.kosho.special.contacts[0];
    effects.handle([event({ actorId: 's', fighter: 'kosho', slot: 'special', serverTime: 1, origin: { x: .2, y: .1, z: .5 }, endpoint: { x: .2, y: 1, z: 14.5 } })], fighters);
    const cast = scene.getObjectByName('cast-1')!, crescent = cast.getObjectByName('ram-crescent') as THREE.Mesh;
    expect(crescent).toBeDefined();
    effects.update(1.5, 1 / 60, fighters);
    expect(crescent.visible, 'the crescent is not shown while the kick winds up').toBe(false);
    const foot = new THREE.Vector3(); kosho.meleeContactPoint(0, foot);
    expect(cast.position.distanceTo(foot), 'charged on the foot, not the hand').toBeLessThan(.01);
    const t = 1 + release + .2; kosho.state.actionTime = (release + .2) / MOVES.kosho.special.duration;
    effects.update(t, 1 / 60, fighters);
    expect(crescent.visible).toBe(true);
    expect((crescent.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xff8a1a);
    fire.update(t, fighters, 1);
    expect((scene.getObjectByName('signal-fire-fire') as THREE.InstancedMesh).count).toBeGreaterThan(0);
    effects.dispose(); fire.dispose();
  });

  it('extends Needle Finger from the hand at the contact and retracts it, stopping on the body it struck', () => {
    const move = MOVES.koko.heavy, contact = move.contacts[0], flight = move.range / move.speed!;
    expect(SwordSpiritEffects.fingerReach(contact - .01)).toBe(0);
    expect(SwordSpiritEffects.fingerReach(contact + .1)).toBeCloseTo(4, 5);
    expect(SwordSpiritEffects.fingerReach(contact + flight)).toBeCloseTo(move.range, 5);
    const back = SwordSpiritEffects.fingerReach(contact + flight + .15);
    expect(back).toBeGreaterThan(0); expect(back).toBeLessThan(move.range);
    expect(SwordSpiritEffects.fingerReach(contact + flight + .5)).toBe(0);
    // A hit at 3.6 m: the finger goes no further.
    const hitAt = contact + 3.6 / move.speed!;
    expect(SwordSpiritEffects.fingerReach(hitAt + .03, hitAt)).toBeCloseTo(3.6, 5);
    expect(SwordSpiritEffects.fingerReach(hitAt + .3, hitAt)).toBeLessThan(3.6);
    // In the scene, from the actor's hand while no spirit is loaded.
    const scene = new THREE.Scene(), spirit = new SwordSpiritEffects(scene);
    const koko = body('j', 'koko', 'heavy', 1), fighters = new Map([['j', koko]]);
    spirit.handle([event({ actorId: 'j', fighter: 'koko', slot: 'heavy', serverTime: 1, origin: { x: 0, y: 1.05, z: 0 }, endpoint: { x: 0, y: 1.05, z: 9 } })]);
    const finger = scene.getObjectByName('needle-finger')!;
    spirit.update(1.2, 1 / 60, fighters); koko.state.actionTime = .2 / move.duration;
    expect(finger.visible, 'nothing before the contact').toBe(false);
    const t = 1 + contact + .1; koko.state.actionTime = (contact + .1) / move.duration;
    spirit.update(t, 1 / 60, fighters);
    expect(finger.visible).toBe(true);
    expect(finger.position.distanceTo(koko.handR), 'anchored to the hand').toBeLessThan(.01);
    const tip = finger.getObjectByName('needle-finger-tip')!;
    expect(tip.getWorldPosition(new THREE.Vector3()).distanceTo(koko.handR)).toBeCloseTo(4, 1);
    spirit.dispose();
  });

  it('lands Needle Finger in violet, and the rest of the roster as before', () => {
    const scene = new THREE.Scene(), effects = new CombatEffects(scene);
    effects.handle([event({ id: 3, kind: 'hit', actorId: 'j', fighter: 'koko', slot: 'heavy', serverTime: 2, damage: 88, endpoint: { x: 0, y: 1, z: 4 }, origin: { x: 0, y: 1, z: 0 } })]);
    const burst = scene.getObjectByName('combat-energy-burst')!;
    const streaks = burst.getObjectByName('impact-outward-streaks') as THREE.InstancedMesh;
    expect((streaks.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x9d63ff);
    effects.handle([event({ id: 4, kind: 'hit', actorId: 'g', fighter: 'taisei', slot: 'special', serverTime: 2, damage: 135, endpoint: { x: 5, y: 1, z: 4 }, origin: { x: 5, y: 1, z: 0 } })]);
    const taisei = scene.children.filter(o => o.name === 'combat-energy-burst').pop()!;
    expect(((taisei.getObjectByName('impact-outward-streaks') as THREE.InstancedMesh).material as THREE.MeshBasicMaterial).color.getHex()).toBe(0x08baff);
    // KoKo's casts are still the spirit's business, not the generic path's.
    effects.handle([event({ id: 5, actorId: 'j', fighter: 'koko', slot: 'heavy', serverTime: 3 })]);
    expect(scene.getObjectByName('cast-5')).toBeUndefined();
    effects.dispose();
  });
});
