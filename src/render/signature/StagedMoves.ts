import * as THREE from 'three';
import type { AttackSlot, CombatEvent, FighterId } from '../../game/types';
import { moveFor } from '../../game/awakening';
import type { MoveDefinition } from '../../game/moves';
import { homeRosterWip } from '../../ui/HomeRosterOrder';
import type { Fighter } from '../Fighter';
import type { Flight } from '../CombatEffects';
import { bodyCentre, type VfxKit } from '../vfx/VfxKit';
import { elementFor, PHYSICAL, type Element } from '../vfx/palette';
import { FIRE } from './FlameSprites';
import { MoveStage, stageLook, type StageLook } from './MoveStage';
import { blowFloor } from './blowFloor';


export const STAGED_BY_MODULE: ReadonlySet<FighterId> = new Set<FighterId>(['bellows', 'barrow', 'tsubute',
  'onigawara',
  'cardo', 'bruin', 'aquilo', 'svanhild',
  'shidare',
  'irbis',
  'shijima',
  'hinomoto',
  'mikage',
  'shanxiao',
  'hagure',
  'torsion',
  'hawser',
  'mizuhiki',
  'strix',
  'strappado',
  'aqrab',
  'senko',
  'shakugo',
  'tokan',
  'adad',
  'buna',
  'basilissa',
  'sorayomi',
  'psyche',
  'oyashio',
  'chohan',
  'tempo',
  'akaito',
  'sashigane',
  'ampere',
  'pyroclast',
  'tancho',
  'full-beam',
  'yodaka',
  'kuzu',
  'rakucho',
  'hikui',
  'akayuri',
  'hisame',
  'rotfalke',
  'murex',
  'shakudo',
  'minase',
  'madake',
  'amagoi',
  'hakushi',
  'kusushi',
  'kubiwa',
  'suzuran',
  'ume',
  'bonsho',
  'unari',
  'lanthorn',
  'highsun',
  'shibuichi',
  'kinu',
  'gosu',
  'wataame',
  'ovid',
]);
/** `?stage=off` in the page's address draws no baseline: a fighter's module and casting are then seen alone, which is
 *  how a move is measured before and after (scripts/night/fx_presence.mjs, `QUERY=stage=off`). */
const OFF = typeof location !== 'undefined' && /[?&]stage=off\b/.test(location.search);
/** Whether `id` gets the baseline: a WIP fighter not staged by its own module. Never an original. */
export const stagedBaseline = (id: FighterId) => !OFF && homeRosterWip(id) && !STAGED_BY_MODULE.has(id);

/** How big the baseline's parts are, in metres (MoveStage's own scale: a heavy's blast 1.1, a special's 1.6-2.2). Under
 *  what an authored move takes, so a module that adds its own body on top is not drowned by its floor. */
export const BASELINE = Object.freeze({
  charge: { special: .26, ultimate: .34 },
  burst: { heavy: .8, special: 1.4, opener: 1, blow: 1.3, finisher: 2.2 },
  scar: { special: 1.2, finisher: 2 },
  shock: 5,
});

const FIRE_ELEMENT = elementFor('bellows', 'special');
const looks = new WeakMap<Element, StageLook>();
/** A move's look from the colours its hit sparks are drawn in: the pale spike its heart, the saturated rim its body.
 *  The roster's shared fire burns in flames; every other element is light alone. */
export function lookOf(el: Element): StageLook {
  let look = looks.get(el);
  if (!look) { look = { ...stageLook(el.spike, el.rim, el.rim, { flame: el === FIRE_ELEMENT ? FIRE : -1 }), element: el }; looks.set(el, look); }
  return look;
}

const SLOTS: readonly AttackSlot[] = ['heavy', 'special', 'ultimate'] as AttackSlot[];
type Kit = Pick<VfxKit, 'budget'> & Partial<VfxKit>;

export class StagedMoves {
  private readonly stage: MoveStage;
  private readonly seen = new Float64Array(64).fill(-1);
  private readonly seenTimes = new Float64Array(64).fill(-1);
  private cursor = 0;
  private disposed = false;
  /** The moves' definitions, base and awakened, looked up once (moveFor builds an object for an awakened move). */
  private readonly moves: Partial<Record<AttackSlot, MoveDefinition>>[] = [{}, {}];
  private readonly p = new THREE.Vector3();
  private readonly ground = new THREE.Vector3();
  private readonly dir = new THREE.Vector3();
  constructor(readonly fighter: FighterId, scene: THREE.Scene, kit: Kit) { this.stage = MoveStage.for(scene, kit); }

  private move(slot: AttackSlot, awakened: boolean) { const set = this.moves[awakened ? 1 : 0]; return set[slot] ??= moveFor(this.fighter, slot, awakened); }

  handle(e: CombatEvent, fighters?: ReadonlyMap<string, Fighter>) {
    if (this.disposed || e.fighter !== this.fighter || e.kind !== 'hit' || !e.slot || !SLOTS.includes(e.slot)) return;
    for (let i = 0; i < this.seen.length; i++) if (this.seen[i] === e.id && this.seenTimes[i] === e.serverTime) return;
    const index = this.cursor++ % this.seen.length; this.seen[index] = e.id; this.seenTimes[index] = e.serverTime;
    const actor = fighters?.get(e.actorId), target = e.targetId ? fighters?.get(e.targetId) : undefined;
    if (!target && !e.endpoint) return;
    const awakened = !!actor?.state.awakened, el = elementFor(this.fighter, e.slot, awakened, 0, e.branch);
    // A plain fist or a plain cut is a blow, not a technique: its own spark is all it wants.
    if (e.slot === 'heavy' && (el === PHYSICAL || el.rim === 0xb8c8d8)) return;
    const look = lookOf(el), st = this.stage, t = e.serverTime, point = this.p;
    if (target) bodyCentre(target, point); else point.set(e.endpoint!.x, e.endpoint!.y, e.endpoint!.z);
    const floor = blowFloor(actor, target, point.y - 1), dir = this.dir;
    if (actor) { dir.subVectors(point, actor.group.position).setY(0); if (dir.lengthSq() < .01) dir.set(Math.sin(actor.state.yaw ?? 0), 0, Math.cos(actor.state.yaw ?? 0)); dir.normalize(); } else dir.set(0, 0, 1);
    const ground = this.ground.set(point.x, floor, point.z);
    if (e.slot === 'heavy') { st.burst(point, look, BASELINE.burst.heavy, t, { dir, floor }); return; }
    if (e.slot === 'special') { st.burst(point, look, BASELINE.burst.special, t, { dir, floor }); st.scar(ground, look, BASELINE.scar.special, t + .05, 1.5); return; }
    // An ultimate: each blow a blast, the last the biggest, with the floor shaken and left burning.
    const contacts = this.move('ultimate', awakened).contacts.length, last = e.branch === undefined && (e.contactIndex ?? 0) >= contacts - 1;
    if (!last) { st.burst(point, look, e.contactIndex ? BASELINE.burst.blow : BASELINE.burst.opener, t, { dir, floor }); return; }
    st.burst(point, look, BASELINE.burst.finisher, t, { dir, floor });
    st.shock(ground, look, BASELINE.shock, t, .5);
    st.scar(ground, look, BASELINE.scar.finisher, t + .1, 2);
  }

  update(time: number, fighters: ReadonlyMap<string, Fighter>, flights: ReadonlyMap<string, Flight>) {
    if (this.disposed) return;
    const st = this.stage.open(time);
    for (const f of fighters.values()) {
      const s = f.state;
      if (s.fighter !== this.fighter || !s.alive || s.whiffedAt !== undefined || s.branch || (s.action !== 'special' && s.action !== 'ultimate')) continue;
      const move = this.move(s.action, !!s.awakened), release = move.contacts[0] ?? 0, elapsed = s.actionTime * s.actionDuration;
      if (release <= .08 || elapsed >= release) continue;
      // The charge in the hand through the wind-up, where the fighter's own charge socket is.
      const hand = typeof f.chargePosition === 'function' ? f.chargePosition(this.p) : this.p.copy(f.handR);
      st.charge(hand, lookOf(elementFor(this.fighter, s.action, !!s.awakened)), BASELINE.charge[s.action], elapsed / release, (s.actionSeq ?? 0) * 7.3);
    }
    for (const flight of flights.values()) {
      if (flight.fighter !== this.fighter || !flight.released || flight.slot === 'light' || flight.slot === 'area') continue;
      // A shot in the air lights what it passes, whatever its module draws it as.
      const look = lookOf(elementFor(this.fighter, flight.slot, !!flight.awakened, 0, flight.branch)), big = flight.slot === 'heavy' ? .7 : 1;
      st.glow(flight.position, .6 * big, look.main, .5); st.glow(flight.position, .22 * big, look.core, .7);
      st.light(this.p.copy(flight.position).setY(flight.position.y + .2), 4.6 * big, look, .45);
    }
    st.close();
  }
  reset() { this.seen.fill(-1); this.seenTimes.fill(-1); this.cursor = 0; this.stage.reset(); }
  dispose() { if (this.disposed) return; this.disposed = true; this.stage.release(); }
}
