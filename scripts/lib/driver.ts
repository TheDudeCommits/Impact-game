// A scripted player for tests: it steers by the latest snapshot - chases and fights the nearest living fighter, strafing, jumping, dashing and
// guarding now and then - so a match has the traffic of people playing it: moves in flight, hits landing, bodies pushed.
import type { GameSnapshot, PlayerInput, PlayerState } from '../../src/game/types';

export type Style = 'fight' | 'wander' | 'idle';
/** A small seeded generator (the same sequence every run). */
export function seeded(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

export function makeDriver(index: number, style: Style, random: () => number) {
  let plan = { x: 0, z: 0, until: 0 }, nextAttack = 0, guardUntil = 0, seq = 0;
  const alive = (p: PlayerState) => p.alive && !p.enemy;
  return {
    get seq() { return seq; },
    reset() { /* the sequence numbers keep counting across a resync, as the page's do */ },
    /** The next command, given the world as the page last heard it. `now` is the page's clock in ms. */
    next(snapshot: GameSnapshot, me: string, now: number, view: number | null): PlayerInput {
      const self = snapshot.players.find(p => p.id === me)!;
      const others = snapshot.players.filter(p => p.id !== me && alive(p));
      let target: PlayerState | undefined, best = Infinity;
      for (const o of others) { const d = Math.hypot(o.x - self.x, o.z - self.z); if (d < best) { best = d; target = o; } }
      let dx = 0, dz = 0, yaw = self.yaw;
      if (style === 'idle') { /* stands still */ }
      else if (target && best < 40 && style !== 'wander') { dx = target.x - self.x; dz = target.z - self.z; yaw = Math.atan2(dx, dz); if (best < 2.2) { dx = -dx * .2; dz = -dz * .2; } }
      else { if (now > plan.until) plan = { x: (random() - .5) * 2, z: (random() - .5) * 2, until: now + 800 + random() * 1500 }; dx = plan.x; dz = plan.z; yaw = Math.atan2(dx, dz); }
      const len = Math.hypot(dx, dz) || 1;
      // A strafe now and then so the line is not a straight chase.
      const wobble = Math.sin(now / 700 + index) * .5;
      const mx = dx / len - dz / len * wobble, mz = dz / len + dx / len * wobble, ml = Math.hypot(mx, mz) || 1;
      const input: PlayerInput = { seq: seq++, moveX: style === 'idle' ? 0 : mx / ml, moveZ: style === 'idle' ? 0 : mz / ml, yaw };
      if (target && best < 3.2 && now > nextAttack && style !== 'wander' && style !== 'idle') {
        const r = random();
        input.attack = r < .5 ? 'light' : r < .7 ? 'heavy' : r < .85 ? 'special' : r < .93 ? 'area' : 'ultimate';
        if (input.attack === 'area') input.aim = { x: target.x, z: target.z };
        input.targetId = target.id; input.lock = true;
        nextAttack = now + 120 + random() * 420;
      }
      if (random() < .006) input.jump = true;
      if (random() < .004) input.dash = true;
      if (now < guardUntil) input.guard = true; else if (random() < .003) guardUntil = now + 300 + random() * 600;
      if (view !== null) input.view = view;
      return input;
    },
  };
}
