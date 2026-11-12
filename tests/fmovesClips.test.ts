import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import contactFrames from '../src/game/data/contactFrames.json';
import { Fighter } from '../src/render/Fighter';
import type { AttackSlot, FighterId, PlayerState } from '../src/game/types';
import { base, loadRig } from './rigHarness';
import { glbJson, loadRigWithExtras } from './extraClips';
import { ORIGINALS } from '../src/originals/roster';

const NEW: Record<string, { fighter: FighterId; slot: AttackSlot; clip: string; release: number }> = {
  ram: { fighter: 'kosho', slot: 'special', clip: 'COUP DE FEU Spin', release: 1.05 },
  yuragi: { fighter: 'kagari', slot: 'heavy', clip: 'Yuragi Blast', release: .47 },
  taimatsu: { fighter: 'kagari', slot: 'special', clip: 'Taimatsu TAIMATSU', release: .58 },
  cannon: { fighter: 'gaunt', slot: 'special', clip: 'Scrap Cannon Arm Recoil', release: .62 },
};
/** The clips the combo enders cut segments out of, by name and length (comboClips.ts): left as they were. */
const KEPT: [FighterId, string, number][] = [['kosho', 'Banquet Infernal', 1.708], ['kosho', 'Brasier: Coup de Feu', 3.292],
  ['kagari', 'skill_a', 3.292], ['kagari', 'Taimatsu', 1.25], ['kagari', 'Yuragi', 1.042], ['gaunt', 'Scrap Cannon Arm', 2.292]];
const rigs = new Map<FighterId, GLTF>();
beforeAll(async () => { for (const id of ['kosho', 'kagari', 'gaunt'] as FighterId[]) rigs.set(id, await loadRigWithExtras(id)); }, 120_000);
const state = (id: FighterId, over: Partial<PlayerState> = {}): PlayerState => ({ ...base(id), ...over });
/** A body put through `t` seconds of a move at 60 Hz, as the renderer plays it. */
function play(id: FighterId, slot: AttackSlot, t: number, over: Partial<PlayerState> = {}, rig = rigs.get(id)!, form = false) {
  const body = new Fighter(state(id), rig, form); body.dynamics = false;
  for (let f = 0; f < 30; f++) body.update(1 / 60, state(id), true);
  const move = MOVES[id][slot];
  for (let f = 0; f <= Math.ceil(t * 60); f++)
    body.update(1 / 60, state(id, { action: slot, actionStarted: 2, actionDuration: move.duration, actionTime: Math.min(t, f / 60) / move.duration, ...over }), true);
  return body;
}

describe('the new takes', () => {

  it('every slot plays its new take, and lets go on the take\'s own release frame', () => {
    for (const [name, { fighter, slot, clip, release }] of Object.entries(NEW)) {
      expect(FIGHTERS[fighter].clips![['light', 'heavy', 'special', 'ultimate'].indexOf(slot)], name).toBe(clip);
      const fraction = (contactFrames as Record<string, Record<string, number>>)[fighter][slot];
      const length = rigs.get(fighter)!.animations.find(c => c.name === clip)!.duration;
      expect(fraction * length, `${name}: the measured release`).toBeCloseTo(release, 1);
      const body = play(fighter, slot, MOVES[fighter][slot].contacts[0]);
      try {
        const seen = body.motionEvidence();
        expect(seen.clip, name).toBe(clip);
        expect(Math.abs(seen.clipTime! - release), `${name}: on the release frame at the release`).toBeLessThan(.05);
      } finally { body.dispose(); }
    }
  });

  it('keeps the clips the combo enders cut from, at their lengths', () => {
    for (const [id, clip, length] of KEPT) expect(rigs.get(id)!.animations.find(c => c.name === clip)?.duration, `${id} ${clip}`).toBeCloseTo(length, 2);
  });

  it('Gaunt\' GRAVE PLATE, which has no new take, throws its own Scrap Cannon Arm', async () => {
    const form = await loadRig(FIGHTERS.gaunt.formModel!);
    const body = play('gaunt', 'special', MOVES.gaunt.special.contacts[0], { awakened: true }, form, true);
    try { expect(body.motionEvidence().clip).toBe('Scrap Cannon Arm'); } finally { body.dispose(); }
  });
});

describe('Banquet Infernal is one take', () => {
  const HELL = MOVES.kosho.ultimate;
  it('the opener is the take\'s first kick, and the confirm goes on into the same footage', () => {
    // Just after the opener's blow, as the confirm comes in.
    const at = HELL.contacts[0] + .1;
    const opener = play('kosho', 'ultimate', at), before = opener.motionEvidence();
    opener.dispose();
    expect(before.clip).toBe('Banquet Infernal Open');
    const confirmed = play('kosho', 'ultimate', at, { confirmedAt: 2 + HELL.contacts[0] + .08 }), after = confirmed.motionEvidence();
    confirmed.dispose();
    expect(after.clip).toBe('Banquet Infernal Blaze');
    // One take: the footage the cinematic opens on is the footage the opener had reached.
    expect(Math.abs(after.clipTime! - before.clipTime!), 'seconds of footage apart').toBeLessThan(.12);
  });

  it('a whiff leaves the body where the simulation stands it: no slide back home', () => {
    const body = play('kosho', 'ultimate', HELL.contacts[0] + .55, { whiffedAt: 2 + HELL.contacts[0] + .1 });
    try {
      const head = body.motionEvidence().head!;
      // The drawn head over the fighter's own spot (Hachoir's cartwheel carried it two metres out and slid it home).
      expect(Math.hypot(head[0], head[2])).toBeLessThan(.5);
    } finally { body.dispose(); }
  });

  it('lands each blow of the take on a contact of the move: the blaze on the roundhouse at head height', () => {
    const body = play('kosho', 'ultimate', HELL.contacts.at(-1)!, { confirmedAt: 2 + HELL.contacts[0] + .08 });
    try {
      const foot = body.joints.get('RightFoot')!.getWorldPosition(new THREE.Vector3()), hips = body.joints.get('Hips')!.getWorldPosition(new THREE.Vector3());
      expect(body.motionEvidence().clip).toBe('Banquet Infernal Blaze');
      expect(foot.y, 'the roundhouse is up at head height').toBeGreaterThan(hips.y + .5);
    } finally { body.dispose(); }
  });
});
