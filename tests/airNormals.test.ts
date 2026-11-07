import { beforeAll, describe, expect, it } from 'vitest';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { AWAKENINGS, moveFor } from '../src/game/awakening';
import { comboMove, hasCombos } from '../src/game/combos';
import { AIR_NORMAL_FIGHTERS, AIR_NORMALS, AIR_RUSH_NAMES, airRushName, MOVES } from '../src/game/moves';
import { Prediction } from '../src/game/prediction';
import { ArenaSimulation } from '../src/game/simulation';
import { InputQueue } from '../src/server/InputQueue';
import { AIR_STRING_CLIPS, Fighter, bindClips } from '../src/render/Fighter';
import { loadRig, base } from './rigHarness';
import { loadRigWithExtras } from './extraClips';
import type { AttackSlot, CombatEvent, FighterId, GameSnapshot, PlayerInput } from '../src/game/types';

/** Round 3b (POLISH): an attack thrown off the ground is announced as the
 *  air kick the rig was lent only where that kick is what is drawn. Taisei's
 *  Cloudstep started in the air read "Falling Kick" while it
 *  teleported and kicked them in the back exactly as it does from the floor. */
const AIR_NAME: Record<'light' | 'heavy', string> = { light: AIR_RUSH_NAMES[0], heavy: AIR_NORMALS.heavy! };
const FORMS: [awakened: boolean, slot: 'light' | 'heavy'][] = [[false, 'light'], [false, 'heavy'], [true, 'light'], [true, 'heavy']];

/** What the simulation announces for a light (the string's first stage) or a
 *  heavy thrown while off the floor. */
function announced(fighter: FighterId, slot: AttackSlot, awakened: boolean) {
  const sim = new ArenaSimulation({ trainingBot: false, seed: 5 });
  try {
    sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
    sim.addPlayer('b', 'kosho', 'B', false, { x: 0, y: 0, z: 1.8 });
    const a = sim.actors.get('a')!;
    if (awakened) Object.assign(a.state, { awakened: true, awakenedUntil: 1e9 });
    const events: CombatEvent[] = [];
    for (let i = 0; i < 8; i++) {
      Object.assign(a.state, { y: 3, grounded: false }); a.vy = 0;
      sim.submitInput('a', { seq: i, moveX: 0, moveZ: 0, yaw: 0, targetId: 'b', attack: i === 2 ? slot : undefined });
      sim.submitInput('b', { seq: i, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'a' });
      sim.step(); events.push(...sim.snapshot(true).events);
    }
    const cast = events.find(e => e.kind === 'cast' && e.actorId === 'a');
    expect(cast, `${fighter} ${slot} was cast`).toBeDefined();
    expect(cast!.chain ?? 0).toBe(0);
    return cast!.move!;
  } finally { sim.dispose(); }
}

const bodies = new Map<FighterId, GLTF>(), rushes = new Map<FighterId, GLTF['animations']>(), forms = new Map<FighterId, GLTF>();
beforeAll(async () => {
  for (const id of AIR_NORMAL_FIGHTERS) {
    const body = await loadRigWithExtras(id);
    bodies.set(id, body);
    const rush = FIGHTERS[id].rushModel;
    if (rush) rushes.set(id, bindClips(body.scene, (await loadRig(rush)).animations, id));
    if (FIGHTERS[id].formModel) forms.set(id, await loadRig(FIGHTERS[id].formModel!));
  }
}, 120_000);

/** The clip on whatever body is on screen for that cast: the fighter's own,
 *  or a replacement body (a 'form'). Round 3d: an awakened spirit-caller is no
 *  longer replaced by the spirit - it looms over them and they fight on in
 *  their own body - so for KoKo and LORD ORO it is their own body, awakened. */
function drawn(id: FighterId, slot: AttackSlot, awakened: boolean) {
  const kind = awakened ? AWAKENINGS[id].kind : 'aura';
  const state = { ...base(id), awakened };
  const body = new Fighter(state, bodies.get(id)!, false, rushes.get(id));
  try {
    const form = forms.get(id);
    if (form) body.attachForm(form);
    for (let i = 0; i < 40; i++) body.update(1 / 60, state, true);
    const move = moveFor(id, slot, awakened);
    for (let i = 0; i < 20; i++) body.update(1 / 60, { ...state, y: 3, grounded: false, action: slot, chain: 0, actionSeq: 3,
      actionStarted: 2, actionDuration: move.duration, actionTime: (i + 1) / 60 / move.duration }, true);
    const evidence = body.motionEvidence();
    if (kind === 'form') { expect(evidence.formVisible, `${id}'s ${AWAKENINGS[id].name} is on screen`).toBe(true); return String(evidence.formClip); }
    return String(evidence.clip);
  } finally { body.dispose(); }
}

describe('air normals', () => {
  it.each(AIR_NORMAL_FIGHTERS)('%s is announced as the air kick exactly when the air kick is what is drawn', id => {
    for (const [awakened, slot] of FORMS) {
      // (5 October) A heavy thrown off the floor by a fighter with combo enders is the air strike (combos.ts), announced
      // by its own name and drawn with its own clip (render/comboClips.ts) - never the lent kick, never the slot's move.
      if (slot === 'heavy' && hasCombos(id)) { expect(announced(id, slot, awakened), `${id} air strike`).toBe(comboMove(id, 'airHeavy', awakened)!.name); continue; }
      const clip = drawn(id, slot, awakened), name = announced(id, slot, awakened);
      const label = `${id}${awakened ? ' awakened' : ''}, ${slot} off the floor: draws "${clip}", announced "${name}"`;
      // Round 4b (COMBAT): the light off the floor is its air string's own opener on the fighter's own body - its own
      // clip, by its own name (AIR_RUSH), never the grounded jab - except in a form that replaces the body, and awakened
      // KoKo's, whose blows off the floor are Iron Spirit's.
      if (slot === 'light' && !(awakened && (AWAKENINGS[id].kind === 'form' || id === 'koko'))) {
        expect(clip, label).toBe(AIR_STRING_CLIPS[id]![0].clip);
        expect(name, label).toBe(airRushName(id, 0));
        expect(name, label).not.toBe(moveFor(id, 'light', awakened).name);
        continue;
      }
      // Round 3b (HITFEEL): a light's air attack is announced by the name the
      // fighter's own air string gives it (AIR_RUSH), where it has one.
      if (/air attack/i.test(clip)) expect(name, label).toBe(slot === 'light' ? airRushName(id, 0) ?? AIR_NAME.light : AIR_NAME[slot]);
      else expect(name, label).toBe(moveFor(id, slot, awakened).name);
    }
  });

  it('announces a heavy thrown from the air as the fighter\'s air strike: never the lent kick, never the slot\'s move', () => {
    // (5 October) The main game's sixteen have combo enders: Jump + Heavy is the air strike (combos.ts). Taisei's Instant
    // Transmission and LORD ORO's knife throw are thrown from the floor.
    for (const awakened of [false, true]) expect(announced('taisei', 'heavy', awakened)).toBe(comboMove('taisei', 'airHeavy', awakened)!.name);
    expect(announced('taisei', 'heavy', false)).not.toBe(MOVES.taisei.heavy.name);
    expect(announced('oro', 'heavy', false)).toBe(comboMove('oro', 'airHeavy')!.name);
    for (const id of ['konta', 'kosho', 'gummy', 'koko', 'ouga', 'kenzo'] as const) {
      expect(announced(id, 'heavy', false), id).toBe(comboMove(id, 'airHeavy')!.name);
      expect(announced(id, 'heavy', false), id).not.toBe(AIR_NORMALS.heavy);
    }
  });

  it('jumps into the air strike and names it the same on the server and in the client\'s copy, under WAN batching', () => {
    // (5 October) Taisei's Jump + Heavy is his air strike (combos.ts), which reaches as a blow does rather than as a teleport.
    const strike = comboMove('taisei', 'airHeavy')!.name;
    const server = new ArenaSimulation({ trainingBot: false, seed: 4 });
    server.addPlayer('me', 'taisei', 'Me', false, { x: 0, y: 0, z: 0 });
    server.addPlayer('foe', 'konta', 'Foe', false, { x: 0, y: 0, z: 2.2 });
    const prediction = new Prediction(), queue = new InputQueue();
    prediction.start('me', server.snapshot(true, true));
    const upload: { tick: number; input: PlayerInput }[] = [], download: { tick: number; s: GameSnapshot }[] = [];
    const served: CombatEvent[] = [], predicted: CombatEvent[] = [];
    let maxCorrection = 0;
    try {
      for (let tick = 0; tick < 150; tick++) {
        const input: PlayerInput = { seq: tick, moveX: 0, moveZ: 0, yaw: 0, targetId: 'foe', jump: tick === 4, jumpHeld: tick >= 4 && tick < 30, attack: tick === 16 ? 'heavy' : undefined };
        prediction.submit(input); predicted.push(...prediction.takeCasts());
        upload.push({ tick: tick + 9, input });
        while (upload.length && upload[0].tick <= tick) queue.push(upload.shift()!.input);
        const next = queue.take(); if (next) server.submitInput('me', next);
        server.submitInput('foe', { seq: tick, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'me' });
        server.step(1 / 60, new Set(next ? [] : ['me']));
        if (tick % 2 === 0) {
          const snapshot = server.snapshot(true, true);
          served.push(...snapshot.events);
          download.push({ tick: tick + 9, s: snapshot });
        }
        while (download.length && download[0].tick <= tick) {
          const before = prediction.diagnostics.position!; prediction.reconcile(download.shift()!.s); const after = prediction.diagnostics.position!;
          maxCorrection = Math.max(maxCorrection, Math.hypot(before.x - after.x, before.y - after.y, before.z - after.z));
        }
      }
      const cast = served.find(e => e.kind === 'cast' && e.actorId === 'me' && e.slot === 'heavy');
      expect(cast?.move, 'the server names it').toBe(strike);
      expect(predicted.filter(e => e.slot === 'heavy').map(e => e.move), 'and so does the client, once').toEqual([strike]);
      expect(served.filter(e => e.kind === 'hit' && e.actorId === 'me').length, 'one blow at most').toBeLessThanOrEqual(1);
      expect(maxCorrection).toBeLessThan(.001);
    } finally { prediction.stop(); server.dispose(); }
  });
});
