// Round 3e (ULTFIX): how far each lightning technique is drawn, against how
// far its blow reaches - headless, off the effect classes themselves.
//
// The thrower stands at the origin facing +z, the striking hand where the
// move's own contact frame puts it (src/game/data/contactReach.json, the
// measured reach). A second body stands just out of the blow's reach (MISS,
// 0.25 m past it: nothing lands) or inside it (HIT: the blow is entered in
// the ledger of landed blows, as the simulation would). Through the contact
// window the effect is updated frame by frame and every lightning segment
// and spark it draws is read back: the furthest point along +z that is drawn
// with any real intensity is its drawn reach. The body's near surface is the
// blow's reach less a body's radius: a drawn reach past a MISS body's surface
// is lightning drawn over a body that took nothing.
//
//   npx tsx scripts/probe_effect_reach.mts [out.json]
import { writeFileSync } from 'node:fs';
import * as THREE from 'three';
import { MOVES, PLAYER_RADIUS, meleeReach } from '../src/game/moves';
import contactReach from '../src/game/data/contactReach.json';
import { LANDED } from '../src/game/landedBlows';
import { NinjaEffects } from '../src/render/NinjaEffects';
import { SetsuEffects } from '../src/render/SetsuEffects';
import { WardEffects } from '../src/render/WardEffects';
import type { Fighter } from '../src/render/Fighter';
import type { AttackSlot, CombatEvent, FighterId, PlayerState } from '../src/game/types';

const REACH = contactReach as Partial<Record<FighterId, Partial<Record<AttackSlot, number>>>>;
type Case = { fighter: FighterId; slot: AttackSlot; hand: 'handR' | 'handL' };
const CASES: Case[] = [
  { fighter: 'shiden', slot: 'heavy', hand: 'handL' },
  { fighter: 'shirokane', slot: 'heavy', hand: 'handR' },
  { fighter: 'shirokane', slot: 'ultimate', hand: 'handR' },
  { fighter: 'setsu', slot: 'heavy', hand: 'handR' },
  { fighter: 'setsu', slot: 'ultimate', hand: 'handR' },
  { fighter: 'ward', slot: 'special', hand: 'handL' },
  { fighter: 'ward', slot: 'ultimate', hand: 'handL' },
];

const state = (id: string, fighter: FighterId, props: Partial<PlayerState>): PlayerState => ({ id, name: id, fighter, x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000,
  stamina: 100, ultimate: 0, action: 'idle', actionStarted: 0, actionDuration: 0, actionTime: 0, target: null, alive: true, isBot: false, grounded: true,
  guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props });
function body(s: PlayerState, hand: THREE.Vector3): Fighter {
  const group = new THREE.Group(); group.position.set(s.x, s.y, s.z);
  return { state: s, group, handR: hand.clone(), handL: hand.clone(), bones: new Map(), joints: new Map(),
    chargePosition(out: THREE.Vector3) { return out.copy(hand); }, meleeContactPoint(_i: number, out: THREE.Vector3) { out.copy(hand); return true; },
    strikePoint(out: THREE.Vector3) { return out.copy(hand); } } as unknown as Fighter;
}
type Drawn = { bolts: { data: Float32Array; count: number }; glows: { data: Float32Array; count: number } };
/** A body's height: lightning above a head or under the floor is not over it. */
const LOW = .1, HIGH = 2;
/** The furthest point along +z drawn with real intensity at a body's height:
 *  the lightning's segments (not the thin sparks thrown off it, which fly
 *  past, nor the bolt from the sky above a head), clipped to the band, and
 *  its stars and flares out to half their radius. */
function furthest(kit: Drawn) {
  let z = -Infinity;
  const b = kit.bolts, g = kit.glows;
  for (let i = 0; i < b.count; i++) {
    const o = i * 12, d = b.data;
    if (d[o + 7] < .15 || d[o + 3] < .015) continue;
    const ay = d[o + 1], by = d[o + 5], az = d[o + 2], bz = d[o + 6];
    // The part of the segment inside the band.
    const lo = Math.max(LOW, Math.min(ay, by)), hi = Math.min(HIGH, Math.max(ay, by));
    if (lo > hi) continue;
    const at = (y: number) => Math.abs(by - ay) < 1e-6 ? Math.max(az, bz) : az + (bz - az) * (y - ay) / (by - ay);
    z = Math.max(z, at(lo), at(hi), ay >= LOW && ay <= HIGH ? az : -Infinity, by >= LOW && by <= HIGH ? bz : -Infinity);
  }
  for (let i = 0; i < g.count; i++) { const o = i * 12, d = g.data; if (d[o + 7] < .15 || d[o + 1] < LOW || d[o + 1] > HIGH) continue; z = Math.max(z, d[o + 2] + d[o + 3] * .5); }
  return z;
}

export function measure(c: Case, landed: boolean) {
  const move = MOVES[c.fighter][c.slot], contact = move.contacts[0];
  const handReach = REACH[c.fighter]?.[c.slot] ?? .6, reach = meleeReach(c.fighter, c.slot, move);
  const victimAt = landed ? reach - .2 : reach + .25;
  const scene = new THREE.Scene(), fx = c.fighter === 'setsu' ? new SetsuEffects(scene) : c.fighter === 'ward' ? new WardEffects(scene) : new NinjaEffects(scene);
  const me = state('me', c.fighter, { action: c.slot, actionStarted: 1, actionDuration: move.duration, actionSeq: 41, target: 'foe' });
  const foe = state('foe', 'gummy', { z: victimAt, yaw: Math.PI });
  const hand = new THREE.Vector3(.1, 1.25, handReach);
  const fighters = new Map([['me', body(me, hand)], ['foe', body(foe, new THREE.Vector3(0, 1.2, victimAt - .4))]]);
  LANDED.reset();
  if (landed) LANDED.deliver([{ id: 1, kind: 'hit', serverTime: 1 + contact, actorId: 'me', targetId: 'foe', fighter: c.fighter, slot: c.slot, actionSeq: 41, contactIndex: 0, damage: 50 } as CombatEvent]);
  // Past the opener of an ultimate its verdict: the confirm on a hit.
  if (c.slot === 'ultimate' && landed) me.confirmedAt = 1 + contact + .03;
  let drawn = -Infinity;
  for (let t = contact - .06; t <= contact + .16; t += 1 / 60) {
    me.actionTime = t / move.duration;
    if (c.slot === 'ultimate' && !landed && t > contact + .1) me.whiffedAt = 1 + contact + .1;
    if (fx instanceof SetsuEffects || fx instanceof WardEffects) fx.update(1 + t, fighters, 1); else fx.update(1 + t, 1 / 60, fighters, 1);
    drawn = Math.max(drawn, furthest((fx as unknown as { kit: Drawn }).kit));
  }
  LANDED.reset();
  return { hand: +handReach.toFixed(3), reach: +reach.toFixed(3), surface: +(victimAt - PLAYER_RADIUS).toFixed(3), drawn: +drawn.toFixed(3) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows: Record<string, unknown> = {};
  console.log('move                     hand   hit reach  | MISS: body surface  drawn to  over it | HIT: body surface  drawn to');
  for (const c of CASES) {
    const miss = measure(c, false), hit = measure(c, true);
    const name = `${c.fighter} ${c.slot} ${MOVES[c.fighter][c.slot].name}`;
    rows[name] = { miss, hit };
    console.log(`${name.slice(0, 24).padEnd(24)} ${String(miss.hand).padStart(6)} ${String(miss.reach).padStart(8)}   | ${String(miss.surface).padStart(8)}  ${String(miss.drawn).padStart(10)} ${(miss.drawn - miss.surface).toFixed(2).padStart(8)} | ${String(hit.surface).padStart(8)} ${String(hit.drawn).padStart(10)}`);
  }
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(rows, null, 1) + '\n');
}
