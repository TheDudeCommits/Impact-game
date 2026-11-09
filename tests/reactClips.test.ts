import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Fighter } from '../src/render/Fighter';
import { assembleFighter, popBase } from './popHarness';
import { DASHES, DASH_TICKS, REHIT, allPops, buildBody, localRun, victimRun, type Press } from './reactHarness';
import { ArenaSimulation } from '../src/game/simulation';
import { BLOCK_STUN, HITSTOP } from '../src/game/moves';
import type { AttackSlot, FighterId, PlayerState } from '../src/game/types';
import { ORIGINALS } from '../src/originals/roster';

/** Round 3e (REACT): the third blind critic's second and third defects.
 *  "Re-hits restart the shared 'slammed' clip from frame 0 without blending:
 *  Gaunt took 11 hits and showed 12 hand and 12 head pops in 6.5 s, up to 178 cm
 *  in one frame", "Dash-entry pops on every fighter tested", "Gummy's Signal Fire
 *  is a 66 cm head jump" - and "That clip comes from another rig". Measured
 *  the critic's way (tests/reactHarness.ts: the right hand and the head in the
 *  body's own space every drawn frame, a pop being over 8 cm / 6 cm and three
 *  times the median of the four frames around it plus 2 cm). */
describe('a body taking a string never jumps a frame', () => {
  it.each(['gaunt', 'gummy', 'taisei', 'kagari', 'kenzo', 'koko'] as FighterId[])('%s, through seven lights, a launch, a juggle and a second launch', async id => {
    const body = await buildBody(id, 'b'), taisei = await buildBody('taisei', 'a');
    try {
      let pops = 0; const where: string[] = [];
      for (const seed of [7, 8]) {
        const { samples, events } = victimRun(body, taisei, REHIT, 30 + 400, { seed });
        expect(events.filter(e => e.kind === 'hit' && e.targetId === 'b').length, 'the string landed').toBeGreaterThanOrEqual(8);
        const found = allPops(samples);
        pops += found.length; where.push(...found.map(p => `seed ${seed} ${p.key} ${p.cm} cm ${p.action} ${p.clip}`));
      }
      expect(pops, where.join('; ')).toBeLessThanOrEqual(id === 'koko' || (id === 'taisei' && ORIGINALS.taisei) ? 2 : 1);
    } finally { body.dispose(); taisei.dispose(); }
  }, 120_000);
});

describe('a dash is taken into, not cut to', () => {
  it.each(['nigo', 'gaunt', 'koko', 'setsu', 'gummy', 'kagari'] as FighterId[])('%s dashes out of a run, a strafe, a backpedal, standing and a light without a one-frame jump into it', async id => {
    const body = await buildBody(id, 'a'), taisei = await buildBody('taisei', 'b');
    try {
      const samples = localRun(body, taisei, DASHES, DASH_TICKS, 6, { seed: 7 });
      // The entry: the frame the dash starts and the blend into its pose.
      const entry = allPops(samples).filter(p => /->dash$/.test(p.action) && (!p.action.startsWith('dash') || (p.blend ?? 1) < 1));
      // Before round 3e: 7-13 each (Nigo's worst 79 cm).
      expect(entry.map(p => `${p.key} ${p.cm} cm ${p.action} ${p.clip}`)).toEqual([]);
    } finally { body.dispose(); taisei.dispose(); }
  }, 120_000);
});

describe('Signal Fire lands', () => {
  it('Gummy comes down out of the leap over a sixth of a second, not two frames', async () => {
    const body = await buildBody('gummy', 'a'), taisei = await buildBody('taisei', 'b');
    try {
      const samples = localRun(body, taisei, [{ tick: 40, attack: 'special' }], 40 + 200, 4.4, { seed: 7 });
      let fall = 0;
      for (let i = 1; i < samples.length; i++) if (samples[i].action === 'special' && samples[i].hips && samples[i - 1].hips) fall = Math.max(fall, samples[i - 1].hips![1] - samples[i].hips![1]);
      // Was 0.59 m in one frame at the release (the head 62 cm).
      expect(fall, 'the hips\' largest drop in a frame, metres').toBeLessThan(.2);
      expect(allPops(samples).filter(p => p.key === 'head')).toEqual([]);
    } finally { body.dispose(); taisei.dispose(); }
  }, 120_000);
});

describe('a borrowed reaction is held to the body it is played on', () => {
  const lengths = (id: FighterId) => assembleFighter(id).then(({ source, rush }) => {
    const body = new Fighter(popBase(id, 'a'), source, false, rush), f = body as unknown as { findClip(n: string[]): THREE.AnimationClip; mixer: THREE.AnimationMixer; joints: Map<string, THREE.Bone> };
    const joints = [...f.joints].filter(([name, bone]) => name !== 'Hips' && bone.position.length() > .02);
    const rest = joints.map(([, bone]) => bone.position.length());
    const clip = f.findClip([id === 'taisei' ? 'adapted_hit' : 'Hit 01']);
    let worst = 0, at = '';
    for (let t = 0; t <= clip.duration; t += 1 / 30) {
      f.mixer.stopAllAction(); const action = f.mixer.clipAction(clip); action.reset().play(); action.time = t; action.timeScale = 0; f.mixer.update(0);
      joints.forEach(([name, bone], i) => { const s = Math.abs(bone.position.length() / rest[i] - 1); if (s > worst) { worst = s; at = name; } });
    }
    body.dispose();
    return { worst, at };
  });
  it.each(['taisei', 'ouga', 'shirokane', 'koko'] as FighterId[])('%s\'s hit recoil keeps its own forearm and hand', async id => {
    // Were 61, 45, 42 and 39% - the right hand pulled into the forearm.
    const { worst, at } = await lengths(id);
    expect(worst, `worst joint ${at}`).toBeLessThan(.005);
  }, 120_000);
  it.skipIf(!!ORIGINALS.gummy)('Gummy, whose own run stretches him, keeps his', async () => {
    expect((await lengths('gummy')).worst).toBeGreaterThan(.1);
  }, 120_000);
});

describe('blockstun is the guard, all of it', () => {
  // The impact freeze of a blocked blow carried the defender's stun and not
  // its blockstun guard (`blockedUntil`), so the guard pose ran out a freeze's
  // length before the stun did, and for those ticks the server reported a
  // 'hurt' nothing hurt: every guarded blow flinched on screen (3 of Kenzo's
  // light's 11 ticks, 5 of Kosho's heavy's 17). Each tick of blockstun is
  // 'guard' now, and it lasts as long as it did.
  const run = (fighter: FighterId, slot: AttackSlot, presses: number[]) => {
    const sim = new ArenaSimulation({ trainingBot: false });
    sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'gaunt', 'B', false, { x: 0, y: 0, z: 1.9 });
    const b = (sim as unknown as { actors: Map<string, { stunUntil: number }> }).actors.get('b')!;
    const blocked = new Set<number>(), stunned: string[] = [];
    let seq = 0;
    try {
      for (let tick = 0; tick < 150; tick++) {
        sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', lock: true, attack: presses.includes(tick) ? slot : undefined });
        sim.submitInput('b', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'a', guard: true });
        sim.step();
        for (const e of sim.snapshot().events) if (e.kind === 'blocked' && e.targetId === 'b') blocked.add(e.id);
        if (blocked.size && sim.serverTime < b.stunUntil) stunned.push(sim.getPlayer('b')!.action);
      }
    } finally { sim.dispose(); }
    return { blocks: blocked.size, stunned };
  };
  it.each([['kenzo', 'light', [30]], ['gummy', 'light', [30, 42, 54]], ['kosho', 'heavy', [30]]] as [FighterId, AttackSlot, number[]][])('%s\'s %s into a held guard', (fighter, slot, presses) => {
    const { blocks, stunned } = run(fighter, slot, presses);
    expect(blocks, 'blows the guard took').toBe(presses.length);
    expect(stunned.filter(action => action !== 'guard'), 'ticks of blockstun drawn otherwise').toEqual([]);
    // Blockstun and the block's freeze, as long as they were.
    expect(Math.abs(stunned.length / blocks - (BLOCK_STUN[slot] + HITSTOP[slot] * .6) * 60), 'ticks of blockstun a block').toBeLessThanOrEqual(1);
  });
});

describe('an ultimate\'s blows answered where they land weigh what its schedule says', () => {
  it('Setsu\'s barrage ticks weigh 13, the finisher 414', async () => {
    const { MOVES } = await import('../src/game/moves');
    const move = MOVES.setsu.ultimate;
    expect(move.schedule, 'the move carries a schedule (ULTFIX)').toBeDefined();
    const victim = await buildBody('ouga', 'v'), setsu = await buildBody('setsu', 'k');
    try {
      setsu.update(1 / 60, { ...popBase('setsu', 'k'), action: 'ultimate', actionStarted: 1, actionDuration: move.duration, actionTime: .3, actionSeq: 5 }, true, 1 / 60);
      const answer = (victim as unknown as { answerTouch(o: Fighter, m: typeof move, i: number, s: number, slot: 'ultimate', hx: number, hz: number, p: THREE.Vector3, g: boolean): void }).answerTouch.bind(victim);
      const weights = [1, 8].map(index => { answer(setsu, move, index, 5, 'ultimate', 0, 1, new THREE.Vector3(0, 1.2, 0), false); return Fighter.touchLog.at(-1)!.damage; });
      expect(weights).toEqual([move.schedule![1], move.schedule![8]]);
    } finally { victim.dispose(); setsu.dispose(); }
  }, 120_000);
});

describe('a short throw is not drawn as a launch (VARIETY\'s outcomes)', () => {
  it('Shirokane\'s crumple folds Gaunt to the floor instead of flipping him over', async () => {
    const victim = await buildBody('gaunt', 'b'), shirokane = await buildBody('shirokane', 'a');
    try {
      const f = victim as unknown as { launchPitch: number; state: PlayerState };
      let most = 0, launched = false;
      const update = victim.update.bind(victim);
      victim.update = (dt, state, interpolated, real) => { update(dt, state, interpolated, real); if (state.action === 'launched') { launched = true; most = Math.max(most, Math.abs(f.launchPitch)); } };
      const { events } = victimRun(victim, shirokane, [{ tick: 30, attack: 'heavy' }], 160, { seed: 7 });
      expect(events.some(e => e.kind === 'hit' && e.targetId === 'b' && e.outcome === 'crumple'), 'the server crumpled him').toBe(true);
      expect(launched).toBe(true);
      // A launch from the floor goes over (a whole turn); a crumple tips back
      // towards lying down and no further. It turned 190 degrees before.
      expect(THREE.MathUtils.radToDeg(most), 'degrees the hips were tipped').toBeLessThan(100);
    } finally { victim.dispose(); shirokane.dispose(); }
  }, 120_000);
});

describe('a launch its blow gave no heading to starts its own', () => {
  it('Black Pyre crumples Taisei after a string has launched him, without laying him down in a frame', async () => {
    // A field centred on the body (Black Pyre's crumple) has no way across the
    // ground, and its launch used to be drawn on the last one's layer - landed
    // and on its back: a 104 cm head drop on the frame it was first drawn.
    const script: Press[] = [30, 42, 54, 66, 78].map(tick => ({ tick, attack: 'light' as const }));
    script.push({ tick: 240, attack: 'special' });
    for (const seed of [7, 8]) {
      const victim = await buildBody('taisei', 'b'), shiden = await buildBody('shiden', 'a');
      try {
        const { samples, events } = victimRun(victim, shiden, script, 450, { seed });
        const thrown = events.filter(e => e.kind === 'hit' && e.targetId === 'b' && e.reaction === 'launched').map(e => e.slot);
        expect(thrown, 'the string and then the burn threw him').toEqual(['light', 'light', 'special']);
        expect(allPops(samples).map(p => `seed ${seed} ${p.key} ${p.cm} cm ${p.action}`)).toEqual([]);
      } finally { victim.dispose(); shiden.dispose(); }
    }
  }, 120_000);
});


describe('a blow on a reaction the server has not started again', () => {
  it('is cross-faded: the recoil\'s clock going back moves the hand no more than the recoil does', async () => {
    // Gummy's re-hit in the browser: a blow lands on a hurt the server has not
    // started again yet, and the recoil's clock (`reactionSince`) goes back
    // from the blow before's to the action's - 0.13 s of clip in one frame, a
    // hand 42 cm, with no blend.
    const body = await buildBody('gummy', 'l');
    try {
      const dt = 1 / 60, base = popBase('gummy', 'l');
      const hurt = (seconds: number): PlayerState => ({ ...base, action: 'hurt', actionStarted: 1, actionDuration: 1.2, actionTime: seconds / 1.2 });
      for (let i = 0; i < 20; i++) body.update(dt, { ...base, action: 'idle' }, true, dt);
      // A blow answered a touch's lead ahead of its hurt.
      body.impact(true, 'light', 'melee', 0, new THREE.Vector3(0, 0, -1), 15, 1.2, { chain: 0, reaction: 'hurt' });
      for (let i = 0; i < 9; i++) body.update(dt, { ...base, action: 'idle' }, true, dt);
      let last: number[] | undefined, before = 0, after = 0;
      for (let i = 0; i < 45; i++) {
        if (i === 6) body.impact(true, 'light', 'melee', 1, new THREE.Vector3(0, 0, -1), 15, 1.2, { chain: 1, reaction: 'hurt' });
        body.update(dt, hurt((i + 1) * dt), true, dt);
        const hand = body.motionEvidence().handR!;
        if (last) { const step = Math.hypot(hand[0] - last[0], hand[1] - last[1], hand[2] - last[2]); if (i < 6) before = Math.max(before, step); else after = Math.max(after, step); }
        last = hand;
      }
      expect(after * 100, 'the largest step after the blow, cm').toBeLessThan(Math.max(8, before * 100 * (ORIGINALS.gummy ? 1.9 : 1.5)));
    } finally { body.dispose(); }
  }, 120_000);
});
