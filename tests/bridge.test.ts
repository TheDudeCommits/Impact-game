import { describe, expect, it } from 'vitest';
import { bridgeDeckHeight, BRIDGE_DECK_THICKNESS, HARBOR_BRIDGES } from '../src/game/environmentLayout';
import { createRapierCollision } from '../src/game/rapierCollision';
import { ArenaSimulation } from '../src/game/simulation';
import type { PlayerInput, Vec3 } from '../src/game/types';

async function walker(position: Vec3) {
  const collision = await createRapierCollision();
  const sim = new ArenaSimulation({ trainingBot: false, collision });
  sim.addPlayer('walker', 'taisei', 'Walker', false, position);
  let seq = 0;
  return {
    sim, collision,
    /** Facing wherever they are walking, which is what a player does and what
     *  the directional speed cap is measured against - a fighter holding a
     *  bearing while travelling the other way is backpedalling, at 0.6 speed,
     *  and these tests are about the bridge rather than about that. */
    step(input: Partial<PlayerInput> = {}) {
      const yaw = Math.atan2(input.moveX ?? 0, input.moveZ ?? 0);
      sim.submitInput('walker', { seq: seq++, moveX: 0, moveZ: 0, yaw, ...input, ...(input.yaw === undefined ? { yaw } : {}) });
      sim.step();
      return sim.getPlayer('walker')!;
    },
  };
}

describe('authored arched bridge collision', () => {
  for (const bridge of HARBOR_BRIDGES) {
    for (const direction of [-1, 1]) {
      it(`walks over bridge ${bridge.x} in direction ${direction} without losing downhill ground contact`, async () => {
        const startZ = bridge.z - direction * 12;
        const endZ = bridge.z + direction * 12;
        const { sim, step } = await walker({ x: bridge.x, y: .01, z: startZ });
        try {
          let peak = 0, frames = 0;
          let p = sim.getPlayer('walker')!;
          while (direction * (endZ - p.z) > 0 && frames++ < 260) {
            p = step({ moveZ: direction });
            peak = Math.max(peak, p.y);
            expect(p.alive).toBe(true);
            expect(p.grounded).toBe(true);
            expect(Math.abs(p.x - bridge.x)).toBeLessThan(.03);
            expect(Math.abs(p.y - bridgeDeckHeight(p.z - bridge.z, bridge.scale))).toBeLessThan(.08);
          }
          expect(direction * (p.z - endZ)).toBeGreaterThan(0);
          expect(frames).toBeLessThan(220);
          expect(peak).toBeGreaterThan(2.70);
          expect(peak).toBeLessThan(2.80);
          expect(p.y).toBeLessThan(.04);
        } finally { sim.dispose(); }
      });
    }

    it(`supports slow guarded movement on bridge ${bridge.x}`, async () => {
      const { sim, step } = await walker({ x: bridge.x, y: .01, z: bridge.z + 12 });
      try {
        let p = sim.getPlayer('walker')!;
        for (let frame = 0; frame < 800 && p.z > bridge.z - 12; frame++) {
          p = step({ moveZ: -1, guard: true });
          expect(p.grounded).toBe(true);
          expect(p.alive).toBe(true);
        }
        expect(p.z).toBeLessThan(bridge.z - 12);
      } finally { sim.dispose(); }
    });

    it(`clears bridge ${bridge.x}'s approach with the downward-biased probe that stalled on the old stair boxes`, async () => {
      const collision = await createRapierCollision();
      const p = { x: bridge.x, y: .01, z: bridge.z + 12 };
      let peak = 0;
      try {
        for (let frame = 0; frame < 1000 && p.z > bridge.z - 12; frame++) {
          const movement = collision.move('probe', p, { x: 0, y: -.1, z: -.05 });
          p.x += movement.x; p.y += movement.y; p.z += movement.z;
          peak = Math.max(peak, p.y);
        }
        expect(p.z).toBeLessThan(bridge.z - 12);
        expect(peak).toBeGreaterThan(2.7);
        expect(p.y).toBeLessThan(.04);
      } finally { collision.dispose!(); }
    });

    it(`retains the side railing on bridge ${bridge.x}`, async () => {
      const height = bridgeDeckHeight(0, bridge.scale);
      const { sim, step } = await walker({ x: bridge.x, y: height + .02, z: bridge.z });
      try {
        let p = step();
        for (let frame = 0; frame < 90; frame++) p = step({ moveX: 1 });
        expect(p.x - bridge.x).toBeGreaterThan(1.2);
        expect(p.x - bridge.x).toBeLessThan(1.32);
        expect(p.y).toBeCloseTo(height + .01, 1);
        expect(p.grounded).toBe(true);
      } finally { sim.dispose(); }
    });

    it(`lets a fighter jump off bridge ${bridge.x} and land back on its deck`, async () => {
      const height = bridgeDeckHeight(0, bridge.scale);
      const { sim, step } = await walker({ x: bridge.x, y: height + .02, z: bridge.z });
      try {
        step();
        const jumping = step({ jump: true, jumpHeld: true });
        expect(jumping.grounded).toBe(false);
        expect(jumping.y).toBeGreaterThan(height + .1);
        let peak = jumping.y, p = jumping;
        // Held for the rise: a jump let go of on the way up is the short hop.
        for (let frame = 0; frame < 90; frame++) {
          p = step(frame < 30 ? { jumpHeld: true } : undefined);
          peak = Math.max(peak, p.y);
        }
        expect(peak).toBeGreaterThan(height + 1.5);
        expect(p.grounded).toBe(true);
        expect(p.y).toBeCloseTo(height + .01, 1);
      } finally { sim.dispose(); }
    });

    it(`does not extend bridge ${bridge.x}'s deck support across the open canal`, async () => {
      const { sim, step } = await walker({ x: bridge.x + 6.5, y: 4, z: bridge.z });
      try {
        let p = step();
        expect(p.grounded).toBe(false);
        expect(p.y).toBeLessThan(4);
        for (let frame = 0; frame < 90 && p.alive; frame++) p = step();
        expect(p.alive).toBe(false);
        expect(sim.snapshot().events.some(e => e.kind === 'eliminated' && e.actorId === 'water')).toBe(true);
      } finally { sim.dispose(); }
    });

    it(`clips rays to bridge ${bridge.x}'s thin deck and leaves the space beneath its arch open`, async () => {
      const collision = await createRapierCollision();
      const height = bridgeDeckHeight(0, bridge.scale);
      try {
        const top = collision.raycast!({ x: bridge.x, y: 6, z: bridge.z }, { x: bridge.x, y: 0, z: bridge.z });
        expect(top.y).toBeCloseTo(height, 4);
        const underside = collision.raycast!({ x: bridge.x, y: 1, z: bridge.z }, { x: bridge.x, y: 4, z: bridge.z });
        expect(underside.y).toBeCloseTo(height - BRIDGE_DECK_THICKNESS * bridge.scale, 4);
        const end = { x: bridge.x + 1, y: 1, z: bridge.z };
        expect(collision.raycast!({ x: bridge.x - 1, y: 1, z: bridge.z }, end)).toEqual(end);
        const quay = collision.raycast!({ x: bridge.x + 3, y: 4, z: bridge.z }, { x: bridge.x + 3, y: -1, z: bridge.z });
        expect(quay.y).toBeCloseTo(0, 4);
      } finally { collision.dispose!(); }
    });
  }

  it('keeps simple collision backends without grounded reporting compatible with floor contact and jumping', () => {
    const sim = new ArenaSimulation({ trainingBot: false, collision: {
      move: (_id, p, d) => ({ ...d, y: Math.max(-p.y, d.y) }),
    } });
    try {
      sim.addPlayer('walker', 'taisei', 'Walker', false, { x: 0, y: 0, z: 0 });
      sim.step();
      expect(sim.getPlayer('walker')!.grounded).toBe(true);
      sim.submitInput('walker', { seq: 0, moveX: 0, moveZ: 0, yaw: 0, jump: true, jumpHeld: true });
      sim.step();
      expect(sim.getPlayer('walker')!.grounded).toBe(false);
      expect(sim.getPlayer('walker')!.y).toBeGreaterThan(.1);
    } finally { sim.dispose(); }
  });
});
