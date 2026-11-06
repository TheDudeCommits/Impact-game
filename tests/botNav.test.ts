import { beforeAll, describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { buildCollision, createRapierCollision, type RapierCollisionWorld } from '../src/game/rapierCollision';
import { NavGrid } from '../src/game/botNav';
import { MOVES } from '../src/game/moves';
import type { CombatEvent, FighterId } from '../src/game/types';

/** Round 3e (VARIETY): bots that find their way round the harbour, and a
 *  royale that keeps flowing. The third blind critic: "For about 135 s the
 *  nearest bot stood idle 3 m away on a ledge; in 170 s the six surviving
 *  bots dealt and took no damage." See src/game/botNav.ts and
 *  scripts/probe_br_flow.mts. */
const ROSTER = Object.keys(MOVES) as FighterId[];
let harbour: RapierCollisionWorld;
beforeAll(async () => { harbour = await createRapierCollision('harbor'); });

describe('the navigation grid', () => {
  const grid = NavGrid.for('harbor');
  it('is open on the quays, shut in the canal, in the buildings and at the lane\'s walls', () => {
    expect(grid.walkable(0, 0), 'the square').toBe(true);
    expect(grid.walkable(0, 40), 'the north quay').toBe(true);
    expect(grid.walkable(0, -35), 'the canal').toBe(false);
    expect(grid.walkable(-14, -4), 'the shop').toBe(false);
    expect(grid.walkable(-8.6, -12), 'the lane\'s masonry').toBe(false);
    expect(grid.walkable(27, -35), 'the bridge').toBe(true);
  });
  it('routes round a building rather than through it, and across the canal by a bridge', () => {
    const route = grid.path(-5, -14, -10.5, -14)!;
    expect(route, 'a way round the lane wall').not.toBeNull();
    expect(grid.length(route), 'round the end of it').toBeGreaterThan(8);
    for (const cell of route) expect(grid.open[cell]).toBe(1);
    const over = grid.path(0, 10, 0, -60)!;
    expect(over, 'the far bank').not.toBeNull();
    // By a bridge: on its deck or on the footing beside it, between the rails
    // and the low wall - the only floor across the water.
    expect(over.some(c => Math.abs(Math.abs(grid.centreX(c)) - 27) < 5 && Math.abs(grid.centreZ(c) + 35) < 3), 'by a bridge').toBe(true);
  });
  it('is the same grid on every machine: built from the stage\'s boxes, not from physics', () => {
    const again = NavGrid.build('harbor');
    expect(Buffer.from(again.open).equals(Buffer.from(grid.open))).toBe(true);
    // A themed stage is a clear floor: open all over but for a body's width
    // along its walls.
    const hall = NavGrid.for('proving-hall');
    for (let j = 1; j < hall.nz - 1; j++) for (let i = 1; i < hall.nx - 1; i++) expect(hall.open[j * hall.nx + i], `${i},${j}`).toBe(1);
  });
});

/** A sparring bot and a human where we put them, on the harbour, with its walls. */
function sparring(bot: FighterId, botAt: [number, number], me: [number, number, number], collision = harbour) {
  const sim = new ArenaSimulation({ roomMode: 'training', stage: 'harbor', collision, seed: 31 });
  sim.addPlayer('me', 'taisei', 'Me', false);
  const sparringBot = sim.actors.get('sparring-bot')!;
  sparringBot.state.fighter = bot; sparringBot.botSkill = .8;
  sim.place('sparring-bot', { x: botAt[0], y: 0, z: botAt[1] });
  sim.place('me', { x: me[0], y: me[1], z: me[2] }, Math.PI);
  const events: CombatEvent[] = [];
  let seq = 0;
  const step = (seconds: number, each?: () => void) => {
    for (let i = 0; i < Math.round(seconds * 60); i++) {
      sim.submitInput('me', { seq: seq++, moveX: 0, moveZ: 0, yaw: Math.PI });
      each?.(); sim.step(); events.push(...sim.snapshot(true).events);
    }
  };
  return { sim, step, events, bot: sim.actors.get('sparring-bot')! };
}

describe('a bot finds its way', () => {
  it('walks round the lane wall to somebody standing behind it, instead of into it', () => {
    // Five metres apart through a masonry frontage three metres thick.
    const fight = sparring('kenzo', [-5, -14], [-10.5, 0, -14]);
    let reached = -1, t = 0;
    fight.step(20, () => {
      t += 1 / 60;
      const b = fight.sim.getPlayer('sparring-bot')!, me = fight.sim.getPlayer('me')!;
      if (reached < 0 && Math.hypot(b.x - me.x, b.z - me.z) < 3) reached = t;
    });
    expect(reached, 'it got there').toBeGreaterThan(0);
    expect(reached, `in ${reached.toFixed(1)} s`).toBeLessThan(10);
    expect(fight.events.some(e => e.kind === 'hit' && e.actorId === 'sparring-bot'), 'and fought').toBe(true);
  });

  it('does not run into the ledge under somebody out of its reach: it stands off and throws what flies', () => {
    // On top of a crate stack 1.8 m high, which nobody can jump.
    const fight = sparring('taisei', [-9.1, 4.2], [-9.1, 1.8, 8.2]);
    let pressing = 0;
    fight.step(12, () => {
      const b = fight.sim.getPlayer('sparring-bot')!;
      const v = fight.bot.input;
      if (b.action === 'run' && Math.hypot(v.moveX, v.moveZ) > .5 && Math.hypot(b.x + 9.1, b.z - 8.2) < 3.2) pressing++;
    });
    expect(pressing / 60, 'seconds spent running into the crates').toBeLessThan(2);
    expect(fight.events.some(e => e.kind === 'cast' && e.actorId === 'sparring-bot' && e.slot === 'special'), 'the Sunpalm Cannon at them').toBe(true);
  });

  it('keeps out of the canal', () => {
    // A target across the water; the bot is on the quay edge.
    const fight = sparring('gummy', [5, -26], [5, 0, -48]);
    fight.step(15);
    expect(fight.sim.getPlayer('sparring-bot')!.alive, 'not drowned').toBe(true);
    expect(fight.events.some(e => e.kind === 'eliminated' && e.targetId === 'sparring-bot')).toBe(false);
  });
});

describe('a royale that keeps flowing', () => {
  /** Eight bots on the harbour; the critic's measures, per bot. */
  function royale(seed: number, seconds: number) {
    const collision = buildCollision('harbor');
    const sim = new ArenaSimulation({ roomMode: 'match', stage: 'harbor', seed, collision });
    for (let i = 0; i < 8; i++) sim.addPlayer('bot-' + i, ROSTER[(seed + i * 3) % ROSTER.length], 'Bot', true);
    sim.startMatch();
    const tracks = new Map<string, { x: number; z: number; run: boolean }[]>();
    let lastBlow = 0, quiet = 0, hits = 0;
    try {
      while (sim.serverTime < seconds && sim.status === 'active') {
        sim.step();
        for (const e of sim.snapshot(true).events) if (e.kind === 'hit' || e.kind === 'blocked') { lastBlow = sim.serverTime; hits++; }
        quiet = Math.max(quiet, sim.serverTime - lastBlow);
        if (sim.tick % 30) continue;
        for (const p of sim.playerStates()) {
          if (!p.alive) continue;
          const track = tracks.get(p.id) ?? []; tracks.set(p.id, track);
          track.push({ x: p.x, z: p.z, run: p.action === 'run' });
        }
      }
      // The critic's "stuck": running for 3 s with under half a metre to show.
      let stuck = 0;
      for (const track of tracks.values()) for (let k = 6; k < track.length; k++) {
        const w = track.slice(k - 6, k + 1);
        if (w.every(s => s.run) && Math.hypot(w[6].x - w[0].x, w[6].z - w[0].z) < .5) stuck += .5;
      }
      return { stuck, quiet, hits, status: sim.status, alive: sim.playerStates().filter(p => p.alive).length, state: sim.playerStates().map(p => `${p.id}:${p.hp}:${p.x.toFixed(3)}`).join() };
    } finally { sim.dispose(); }
  }

  it('has nobody running on the spot, and a blow landing somewhere every few seconds', () => {
    const r = royale(3, 75);
    expect(r.stuck, 'bot-seconds running on the spot').toBeLessThan(3);
    expect(r.quiet, 'the longest stretch with nothing landing, while two are standing').toBeLessThan(25);
    expect(r.hits, 'blows').toBeGreaterThan(80);
  }, 60_000);

  it('plays the same match twice from the same seed', () => {
    const a = royale(5, 20), b = royale(5, 20);
    expect(a.state).toBe(b.state);
    expect(a.hits).toBe(b.hits);
  }, 60_000);
});

describe('the character controller', () => {
  it('takes a step along the floor that it used to refuse when it carried the tick\'s fall', () => {
    // Replayed from the exact floats of a refusal measured in an eight-bot
    // match in the Proving Hall: a capsule 1.7 mm up, inside the controller's
    // skin, asked for 3 cm along the open floor and a tick of gravity.
    const hall = buildCollision('proving-hall');
    try {
      const got = hall.move('probe', { x: 3.4610079872461768, y: 0.0016639614550513215, z: -2.048217769783849 },
        { x: -0.028018881106253044, y: -0.006388888888888888, z: 0.010973712852882874 });
      expect(Math.hypot(got.x, got.z)).toBeGreaterThan(.029);
      expect(got.grounded).toBe(true);
    } finally { hall.dispose?.(); }
  });
  it('still refuses a step into a wall', () => {
    const hall = buildCollision('proving-hall');
    try {
      // The hall's north bound is at z = 7.
      const got = hall.move('probe', { x: 0, y: 0, z: 7 - .46 }, { x: 0, y: -0.0064, z: .1 });
      expect(got.z).toBeLessThan(.02);
    } finally { hall.dispose?.(); }
  });
});
