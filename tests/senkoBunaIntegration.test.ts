import { PINNED_RELEASED, PINNED_ROSTER_PROTOCOL } from './rosterPin';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import { AWAKENINGS } from '../src/game/awakening';
import { LABORATORY_FIGHTERS, RELEASED_FIGHTERS } from '../src/game/rosterAvailability';
import { ROSTER_PROTOCOL } from '../src/game/rosterProtocol';
import { factionOf, isBadBloodFighter } from '../src/game/objectives/model';
import { mayPlay } from '../src/game/economy/fighters';
import { ArenaSimulation } from '../src/game/simulation';
import { hasRosterSignature, RosterSignatureSet } from '../src/render/signature/RosterSignatureSet';
import { HOME_VOICES } from '../src/audio/HomeVoice';
import type { VfxKit } from '../src/render/vfx/VfxKit';
import type { CombatEvent, FighterId } from '../src/game/types';
import { fighterShown } from '../src/originals/launch';

const fighters = ['senko', 'buna'] as const;
function manualUltimate(fighter: FighterId, distance: number, attack: boolean) {
  const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false, seed: 97 });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: distance });
  sim.actors.get('a')!.state.ultimate = 100;
  const events: CombatEvent[] = [];
  try {
    for (let i = 0; i < 300; i++) {
      sim.submitInput('a', { seq: i + 1, moveX: 0, moveZ: 0, yaw: 0, targetId: distance < 3 ? 'b' : null, attack: attack && i === 0 ? 'ultimate' : undefined });
      sim.step(1 / 60); events.push(...sim.drainEvents());
    }
    return events.filter(e => e.actorId === 'a');
  } finally { sim.dispose(); }
}

describe('Senko and Buna reviewed integration', () => {
  it('admits both reviewed fighters within roster63 and protocol v9', () => {
    expect(RELEASED_FIGHTERS).toHaveLength(PINNED_RELEASED);
    expect(ROSTER_PROTOCOL).toBe(PINNED_ROSTER_PROTOCOL);
    for (const id of fighters) {
      expect(LABORATORY_FIGHTERS).not.toContain(id);
      expect(RELEASED_FIGHTERS as readonly string[]).toContain(id);
      expect(mayPlay(id,{items:{[`fighter-${id}`]:{at:0}}})).toBe(fighterShown(id));expect(mayPlay(id,undefined)).toBe(false);
      expect(hasRosterSignature(id)).toBe(true);
      expect(isBadBloodFighter(id)).toBe(true);
      expect(factionOf(id)).toBe(id === 'senko' ? 'villains' : 'heroes');
    }
  });
  it.each(fighters)('%s has the current frozen artwork, rig and voice assets available', id => {
    const config = FIGHTERS[id];
    for (const path of [config.model, config.portrait, `/assets/home/fighters/${id}.webp`, `/assets/ui/moves/${id}.webp`, ...(fighterShown(id) ? [HOME_VOICES[id]!] : [])]) expect(fs.existsSync('public' + path), path).toBe(true);
    const manifest = JSON.parse(fs.readFileSync('public/assets/home/sprites/manifest.json', 'utf8'));
    const row = manifest.fighters.find((entry: {id:string}) => entry.id === id);
    expect(row).toBeDefined();
    // A stale manifest can silently keep an older costume cached after replacement.
    for (const [pathKey, hashKey] of [['file', 'sha256'], ['poster', 'posterSha256']] as const) {
      const data = fs.readFileSync('public/assets/home/sprites/' + row[pathKey]);
      expect(createHash('sha256').update(data).digest('hex')).toBe(row[hashKey]);
    }
    expect(config.clips).toHaveLength(4);
    expect(AWAKENINGS[id].clips?.length).toBeGreaterThan(0);
  });
  it.each(fighters)('%s applies only the manual confirmed damage and recovers on a miss', id => {
    const hits = manualUltimate(id, 2, true).filter(e => e.kind === 'hit' && e.targetId === 'b');
    expect(hits.map(e => e.contactIndex)).toEqual(id === 'senko' ? [0, 1, 2, 3] : [0, 1, 2]);
    expect(hits.reduce((n, e) => n + (e.damage ?? 0), 0)).toBe(id === 'senko' ? 290 : 300);
    for (const events of [manualUltimate(id, 18, true), manualUltimate(id, 2, false)]) expect(events.filter(e => e.kind === 'hit' || e.kind === 'confirm')).toHaveLength(0);
    const move = MOVES[id].ultimate;
    expect(move.damage * (move.contacts.length - 1) + move.finisherDamage!).toBe(id === 'senko' ? 290 : 300);
  });
});
