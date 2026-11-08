import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ArenaSimulation, validateInput } from '../src/game/simulation';
import { INPUT_BUFFER, MOVES } from '../src/game/moves';
import { AWAKENED_DAMAGE, AWAKENED_RESIST, AWAKENING_COST, AWAKENING_ENTRY, AWAKENING_SECONDS,
  AWAKENINGS, moveFor } from '../src/game/awakening';
import { FIGHTERS } from '../src/config';
import type { FighterId, PlayerInput } from '../src/game/types';
import { GUARDIAN_ASSET, GUARDIAN_USERS } from '../src/render/signature/GuardianShell';
import { ORIGINALS } from '../src/originals/roster';

function bout(fighter: FighterId, gap = 1.6, foe: FighterId = 'taisei') {
  const sim = new ArenaSimulation({ trainingBot: false });
  sim.addPlayer('a', fighter, 'A', false, { x: 0, y: 0, z: 0 });
  sim.addPlayer('b', foe, 'B', false, { x: 0, y: 0, z: gap });
  let seq = 0;
  const input = (id: string, more: Partial<PlayerInput>) => sim.submitInput(id, { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, ...more });
  const step = (seconds: number) => { for (let i = 0; i < Math.round(seconds * 60); i++) sim.step(); };
  /** Fill the awakening meter the way the training tool does, without a
   *  damage exchange. Only that one: the ultimate bar is its own resource now
   *  (see 'two meters' below), and a transformation must not hand it out. */
  const charge = (id: string) => { (sim as unknown as { actors: Map<string, { state: { awakening: number } }> }).actors.get(id)!.state.awakening = 100; };
  /** Fill the ultimate bar, for the tests that spend it. */
  const arm = (id: string) => { (sim as unknown as { actors: Map<string, { state: { ultimate: number } }> }).actors.get(id)!.state.ultimate = 100; };
  return { sim, input, step, charge, arm };
}

const roster = Object.keys(FIGHTERS) as FighterId[];
const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
function gltf(path: string) {
  const file = fs.readFileSync(`public${path}`);
  return JSON.parse(file.subarray(20, 20 + file.readUInt32LE(12)).toString());
}
function clips(id: FighterId): string[] {
  return (gltf(FIGHTERS[id].model).animations ?? []).map((a: { name: string }) => a.name);
}
function meshNames(path: string): string[] {
  return (gltf(path).meshes ?? []).map((m: { name: string }) => m.name);
}

describe('spending the meter on a transformation', () => {
  it('refuses below a full bar and takes the whole bar at full', () => {
    const { sim, input, step, charge } = bout('taisei');
    input('a', { awaken: true });
    step(.1);
    expect(sim.getPlayer('a')!.awakened).toBeFalsy();
    charge('a');
    input('a', { awaken: true });
    step(.05);
    const self = sim.getPlayer('a')!;
    expect(self.awakened).toBe(true);
    expect(self.awakening).toBe(0);
    // And the ultimate bar is untouched: the transformation is bought with
    // its own meter, not the ultimate's.
    expect(self.ultimate).toBe(0);
    expect(self.action).toBe('awaken');
  });

  it('stands still and cannot be touched while the transformation plays', () => {
    const { sim, input, step, charge } = bout('taisei');
    charge('a');
    input('a', { awaken: true });
    step(.05);
    // Walking away mid-transformation is not on offer - and neither is being
    // punished for standing there: the second it costs is invulnerable.
    input('a', { moveX: 1, moveZ: 1 });
    input('b', { attack: 'heavy', targetId: 'a', yaw: Math.PI });
    // Inside the entry window, which is what makes it invulnerable: Taisei's
    // string now finishes at 0.83 against a 0.9 s transformation, so stepping
    // a further 0.06 past it landed after the window had closed.
    step(Math.min(MOVES.taisei.heavy.contacts[MOVES.taisei.heavy.contacts.length - 1] + .06, AWAKENING_ENTRY - .08));
    expect(sim.getPlayer('a')!.hp).toBe(1000);
    expect(sim.snapshot().events.some(e => e.kind === 'dodge' && e.targetId === 'a')).toBe(true);
    expect(Math.hypot(sim.getPlayer('a')!.x, sim.getPlayer('a')!.z)).toBeLessThan(.2);
    expect(sim.getPlayer('a')!.action).toBe('awaken');
    step(.4);
    expect(sim.getPlayer('a')!.action).not.toBe('awaken');
  });

  it('closes on its own clock and says so', () => {
    const { sim, input, step, charge } = bout('taisei');
    charge('a');
    input('a', { awaken: true });
    step(.05);
    const until = sim.getPlayer('a')!.awakenedUntil!;
    expect(until).toBeGreaterThan(sim.serverTime);
    step(AWAKENING_SECONDS - 1);
    expect(sim.getPlayer('a')!.awakened).toBe(true);
    step(1.2);
    expect(sim.getPlayer('a')!.awakened).toBe(false);
    expect(sim.snapshot().events.some(e => e.kind === 'awaken-end' && e.actorId === 'a')).toBe(true);
  });

  it('survives a press made a few frames before it is legal', () => {
    // Out of reach, so no impact freeze shifts the move's own clock.
    const { sim, input, step, charge } = bout('taisei', 14);
    charge('a');
    // Pressed while a light is still running, when awakening is refused
    // outright. A sampled press would be thrown away on that frame.
    input('a', { attack: 'light', targetId: 'b' });
    step(MOVES.taisei.light.duration - .1);
    input('a', { awaken: true });
    const pressed = sim.serverTime;
    expect(sim.getPlayer('a')!.awakened).toBeFalsy();
    step(.15);
    expect(sim.getPlayer('a')!.awakened).toBe(true);
    expect(sim.getPlayer('a')!.actionStarted - pressed).toBeLessThanOrEqual(INPUT_BUFFER);
  });

  it('is cleared by defeat and by the training reset', () => {
    const { sim, input, step, charge } = bout('taisei');
    charge('a');
    input('a', { awaken: true });
    step(.05);
    expect(sim.getPlayer('a')!.awakened).toBe(true);
    sim.trainingCommand('a', 'reset');
    expect(sim.getPlayer('a')!.awakened).toBe(false);
    expect(sim.getPlayer('a')!.awakenedUntil).toBe(0);
  });

  it('only accepts a boolean over the wire', () => {
    expect(validateInput({ seq: 1, moveX: 0, moveZ: 0, yaw: 0, awaken: 'yes' })).toBeNull();
    expect(validateInput({ seq: 1, moveX: 0, moveZ: 0, yaw: 0, awaken: true })?.awaken).toBe(true);
  });
});

describe('what a transformation is worth', () => {
  /** One clean light, with the attacker's transformation on or off. */
  function jab(awaken: boolean, defender = false) {
    const { sim, input, step, charge } = bout('kenzo');
    if (awaken) {
      charge(defender ? 'b' : 'a');
      input(defender ? 'b' : 'a', { awaken: true });
      step(AWAKENING_ENTRY + .1);
    }
    input('a', { attack: 'light', targetId: 'b' });
    step(MOVES.kenzo.light.contacts[0] + .06);
    return 1000 - sim.getPlayer('b')!.hp;
  }

  it('hits harder awakened and softer against someone awakened', () => {
    const plain = jab(false);
    expect(plain).toBeGreaterThan(0);
    expect(jab(true)).toBe(Math.round(plain * AWAKENED_DAMAGE));
    expect(jab(true, true)).toBe(Math.round(plain * AWAKENED_RESIST));
  });

  it('does not hand the ultimate over for free: awakened, it still costs the ultimate bar', () => {
    // The awakened ultimate used to be free, on the grounds that the one bar
    // had already been spent on the transformation. There are two bars now,
    // and the transformation spent the other one.
    const { sim, input, step, charge, arm } = bout('kenzo');
    charge('a');
    input('a', { awaken: true });
    step(AWAKENING_ENTRY + .1);
    expect(sim.getPlayer('a')!.awakened).toBe(true);
    expect(sim.getPlayer('a')!.ultimate).toBe(0);
    input('a', { attack: 'ultimate', targetId: 'b' });
    step(.05);
    expect(sim.getPlayer('a')!.action, 'an empty ultimate bar is an empty ultimate bar').not.toBe('ultimate');
    expect(sim.snapshot(true).events.some(e => e.kind === 'rejected' && e.reason === 'ultimate-meter')).toBe(true);
    // With the bar earned it comes out, and the bar is spent whole.
    arm('a');
    input('a', { attack: 'ultimate', targetId: 'b' });
    step(.05);
    expect(sim.getPlayer('a')!.action).toBe('ultimate');
    expect(sim.getPlayer('a')!.ultimate).toBe(0);
    expect(sim.getPlayer('a')!.awakened, 'and the window is still open').toBe(true);
    // The cooldown outlasts the window, so it is one awakened ultimate, not a stream.
    expect(MOVES.kenzo.ultimate.cooldown).toBeGreaterThan(AWAKENING_SECONDS);
  });

  it('still refuses an ultimate on an empty bar without one', () => {
    const { sim, input, step } = bout('kenzo');
    input('a', { attack: 'ultimate', targetId: 'b' });
    step(.05);
    expect(sim.getPlayer('a')!.action).not.toBe('ultimate');
    expect(sim.snapshot().events.some(e => e.kind === 'rejected' && e.reason === 'ultimate-meter')).toBe(true);
  });

  it('moves faster awakened', () => {
    const run = (awaken: boolean) => {
      const { sim, input, step, charge } = bout('kenzo', 30);
      if (awaken) { charge('a'); input('a', { awaken: true }); step(AWAKENING_ENTRY + .1); }
      const from = sim.getPlayer('a')!.z;
      input('a', { moveZ: 1 });
      step(1);
      return sim.getPlayer('a')!.z - from;
    };
    expect(run(true)).toBeGreaterThan(run(false) * 1.1);
  });
});

describe('HUSH', () => {
  it('becomes a barrage inside stopped time when KoKo is awakened', () => {
    const plain = moveFor('koko', 'ultimate', false), awakened = moveFor('koko', 'ultimate', true);
    expect(plain).toEqual(MOVES.koko.ultimate);
    expect(awakened.contacts.length).toBeGreaterThan(plain.contacts.length + 5);
    expect(awakened.timeStop!.duration).toBeGreaterThan(plain.timeStop!.duration);
    // Every barrage contact lands inside the stop; the finisher lands after it.
    const stop = awakened.contacts[awakened.timeStop!.contact] + awakened.timeStop!.duration;
    const inside = awakened.contacts.filter(c => c < stop);
    expect(inside.length).toBe(awakened.contacts.length - 1);
    expect(awakened.contacts[awakened.contacts.length - 1]).toBeGreaterThan(stop);
    expect(awakened.duration).toBeGreaterThan(awakened.contacts[awakened.contacts.length - 1]);
  });

  it('empties the barrage into a target who cannot move', () => {
    const { sim, input, step, charge, arm } = bout('koko', 2.2);
    charge('a'); arm('a');
    input('a', { awaken: true });
    step(AWAKENING_ENTRY + .1);
    input('a', { attack: 'ultimate', targetId: 'b' });
    const world = moveFor('koko', 'ultimate', true);
    step(world.contacts[0] + .08);
    expect(sim.getPlayer('b')!.timeStopped).toBe(true);
    step(world.timeStop!.duration - .2);
    const hits = sim.snapshot().events.filter(e => e.kind === 'hit' && e.targetId === 'b').length;
    expect(hits).toBeGreaterThanOrEqual(6);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000 - 200);
  });

  it('leaves the unawakened move exactly as it was', () => {
    const { sim, input, step, arm } = bout('koko', 2.2);
    arm('a');
    input('a', { attack: 'ultimate', targetId: 'b' });
    step(MOVES.koko.ultimate.contacts[0] + .08);
    expect(sim.getPlayer('a')!.action, 'the ultimate came out').toBe('ultimate');
    expect(sim.snapshot().events.filter(e => e.kind === 'hit' && e.targetId === 'b').length).toBeLessThanOrEqual(1);
  });

  it('keeps the contacts it started with when the window closes mid-move', () => {
    const { sim, input, step, charge, arm } = bout('koko', 2.2);
    charge('a'); arm('a');
    input('a', { awaken: true });
    // Start the ultimate with barely any window left.
    step(AWAKENING_SECONDS - 1.5);
    input('a', { attack: 'ultimate', targetId: 'b' });
    step(2.6);
    expect(sim.getPlayer('a')!.awakened).toBe(false);
    // The barrage it opened with is still the move being thrown.
    expect(sim.snapshot().events.filter(e => e.kind === 'hit' && e.targetId === 'b').length).toBeGreaterThan(2);
  });
});

describe('the transformation table', () => {
  it('names a form for every fighter', () => {
    expect(Object.keys(AWAKENINGS).sort()).toEqual(roster.sort());
    for (const id of roster) {
      // (Capitals, as the HUD letters them; an apostrophe, straight or curly (BOTTOMLESS, MAGICIAN’S MALICE), and a decimal point (Ovid's CRACKED OPEN).)
      expect(AWAKENINGS[id].name).toMatch(/^[A-Z0-9 ·:.'’-]+$/);
      expect(AWAKENINGS[id].aura).toHaveLength(2);
    }
  });

  it('ships a body for every transformation that needs one, and none that does not', () => {
    for (const id of roster) {
      const look = AWAKENINGS[id];
      // A replacement body swaps the fighter out; a summon is worn over them.
      // An aura is the fighter's own body, and must not carry a second model.
      // Round 4b (FANIM): but a Guardian user's summon is a warrior of its own behind him (signature/GuardianShell),
      // one file for the three of them, and no worn form.
      const loomed = GUARDIAN_USERS.includes(id);
      expect(FIGHTERS[id].formModel !== undefined, `${id} is ${look.kind}`).toBe((look.kind === 'form' || look.kind === 'summon') && !loomed);
      if (loomed) expect(fs.existsSync(`public${GUARDIAN_ASSET}`), `${id}'s Guardian`).toBe(true);
      if (FIGHTERS[id].formModel) expect(fs.existsSync(`public${FIGHTERS[id].formModel}`), `${id} form file`).toBe(true);
      // A worn summon is tinted and translucent; a replacement body is neither.
      expect(look.formTint !== undefined, `${id} tint`).toBe(look.kind === 'summon');
    }
  });

  it('gives every transformation something of its own to show', () => {
    // Visible feedback can be a new body, a mesh swap, hair or energy.
    // SETSUNA and TENGAN do not canonically dye the fighter's hair. Kosho's Ember Leg legs ship as extra
    // meshes inside his own model, named for the renderer; a rebuild that drops
    // them leaves him transforming into himself.
    for (const id of roster) {
      const look = AWAKENINGS[id];
      const swapped = meshNames(FIGHTERS[id].model).filter(n => n.startsWith('awaken-on')).length;
      // A spirit is the exception: KoKo steps out and SwordSpiritEffects puts
      // Iron Spirit where he was standing, so the body is already in the match.
      expect(FIGHTERS[id].formModel !== undefined || GUARDIAN_USERS.includes(id) || swapped > 0 || look.hair !== undefined
        || look.kind === 'spirit' || look.kind === 'aura' && look.aura.length===2, `${id} transforms into nothing`).toBe(true);
    }
    if (!ORIGINALS.kosho) expect(meshNames(FIGHTERS.kosho.model).filter(n => n.startsWith('awaken-on')).length).toBe(2);
    if (!ORIGINALS.kosho) expect(meshNames(FIGHTERS.kosho.model).filter(n => n.startsWith('awaken-off')).length).toBe(2);
    // Kenzo's RAKSHASA is a whole body, not arms hung on the one he fights in, so
    // the extra limbs belong to the form and the base model carries none.
    expect(meshNames(FIGHTERS.kenzo.model).filter(n => n.startsWith('awaken-on')).length).toBe(0);
    const rakshasa = meshNames(FIGHTERS.kenzo.formModel!);
    for (const part of ORIGINALS.kenzo ? [] : ['rakshasa_arm', 'l_face_02', 'r_face_02']) {
      expect(rakshasa.some(n => n.startsWith(part)), `RAKSHASA is missing ${part}`).toBe(true);
    }
  });

  it('leaves the NIGHTFALL holding his sword', () => {
    const scene = gltf(FIGHTERS.nigo.formModel!);
    const nodes: { name?: string; children?: number[] }[] = scene.nodes;
    const parent = new Map<number, number>();
    nodes.forEach((n, i) => (n.children ?? []).forEach(c => parent.set(c, i)));
    const prop = nodes.findIndex(n => /Prop/i.test(n.name ?? '') || n.name === 'weapon_cleaver_R');
    expect(prop, 'the NIGHTFALL rig has no prop bone').toBeGreaterThanOrEqual(0);
    const ancestry: string[] = [];
    for (let at: number | undefined = prop; at !== undefined; at = parent.get(at)) {
      ancestry.push(nodes[at].name ?? '');
    }
    expect(ancestry.some(n => /Hand/i.test(n)), `HAIZAN hangs off ${ancestry.join(' <- ')}`).toBe(true);
  });

  it('keeps flame auras to fire and Golden energy without recoloring unrelated hair', () => {
    for (const id of roster) {
      const look = AWAKENINGS[id];
      // The shop's power-ups burn too (3 October): Rose, Jirenga's full power, the Beast, Imago reborn, the Sun
      // breathing and KOMAINU's aura - each the same body (or a form) with the power pouring off it.
      expect(!!look.flames, `${id} flames`).toBe(['taisei','ouga','kagari','wuming','jirenga','gohaku','imago','asahi','gaku','haldor','sorrel','dorado','ippon','sekka','levin'].includes(id));
      if(['kagari','kuon','setsu'].includes(id))expect(look.hair).toBeUndefined();
    }
  });


  it('only changes a move for a fighter whose transformation is the move', () => {
    for (const id of roster) for (const slot of ['light', 'heavy', 'special', 'ultimate'] as const) {
      const changed = moveFor(id, slot, true) !== MOVES[id][slot];
      // (Round 4b: SUNRISE's Gatling is the dawn barrage - his fists blown up. 13 October 2026: Hawser wakes as the Attack
      // Colossus, another body with a kit of its own, as Konta wakes as Kurobi.)
      expect(changed, `${id} ${slot}`).toBe(id === 'konta' || id === 'hawser' || (id === 'koko' || id === 'oro') && slot === 'ultimate' || id === 'gummy' && slot === 'special');
    }
  });

  it('spends a whole bar, and the bar is the one damage taken fills', () => {
    expect(AWAKENING_COST).toBe(100);
    expect(AWAKENING_ENTRY).toBeLessThan(AWAKENING_SECONDS / 4);
  });
});
