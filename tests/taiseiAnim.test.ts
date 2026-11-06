import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Fighter } from '../src/render/Fighter';
import { MOVES } from '../src/game/moves';
import { guardTakes, type Take } from './takeGuard';
import { buildBody, victimRun, type Press } from './reactHarness';
import { popBase } from './popHarness';


// Scissors and Paper (taisei-fanim6.glb, the same script): the trunk stood up over a planted stance and leaned into the blow,
// where RoaN's takes dived 38-43 degrees at the target and leaned 43 degrees back and 45 to the side over the palm.
// Three combo enders re-posed over their Meshy takes (scripts/fanim/taisei.py): the Monkey King Fist (Straight Palm) thrown from
// a chambered fist and finished in his guard, never the take's arms out level; the Blackout Flash's open hands at his brow;
// the Double Axe Handle's clasped fists raised and brought down. Each keeps its take's length, so every segment and
// contact (src/render/comboClips.ts) is unchanged; tests/combosVol1Chain.test.ts holds them to a smooth chain.
const TAKES: Take[] = [['taisei', 'taisei-fanim5.glb', ['Straight Palm', 'Flare Hammer']], ['taisei', 'taisei-fanim6.glb', ['Rush 1', 'Rush 2']]];
guardTakes('Taisei\'s enders and string re-posed', TAKES);

describe('Taisei\'s smear frame is his swing, not his lunge', () => {
  it('the Rock lunging at 5-6 m/s never smears a foot that is on the floor', async () => {
    const body = await buildBody('taisei', 'a'), style = Fighter.animStyle;
    Fighter.animStyle = 'twos';
    try {
      const move = MOVES.taisei.light, dt = 1 / 60;
      for (let f = 0; f < 30; f++) body.update(dt, popBase('taisei', 'a'), true, dt);
      body.targetPoint = new THREE.Vector3(0, 1.3, 1.6); body.targetDistance = 1.6;
      let z = 0, smeared = 0;
      const smears: string[] = [];
      for (let f = 0; f < Math.ceil(move.duration * 60); f++) {
        const t = f * dt;
        // The lunge: the body carried forward at up to 6 m/s through the wind-up, as the simulation carries it.
        if (t < move.contacts[0] + .02) z += 6 * dt * Math.min(1, t / .05);
        Fighter.beginFrame(1000 + f * 1000 / 60);
        body.update(dt, { ...popBase('taisei', 'a'), z, action: 'light', chain: 0, actionSeq: 1, actionStarted: 1, actionDuration: move.duration, actionTime: t / move.duration }, true, dt);
        const motion = body.smear.motion.value, point = body.smear.point.value;
        if (motion.w <= 0) continue;
        smeared++;
        const feet = ['RightFoot', 'LeftFoot'].map(name => body.joints.get(name)!.getWorldPosition(new THREE.Vector3()));
        const onFoot = feet.some(foot => foot.distanceTo(new THREE.Vector3(point.x, point.y, point.z)) < .02);
        if (onFoot && point.y - body.group.position.y < .25) smears.push(`frame ${f}: a foot on the floor smeared ${motion.w.toFixed(2)} m`);
      }
      expect(smears).toEqual([]);
      expect(smeared, 'the punching hand still smears').toBeGreaterThan(0);
    } finally { Fighter.animStyle = style; body.dispose(); }
  }, 120_000);
});

describe('Taisei launched flies back-down to the floor', () => {
  it('the knockback clip is laid over the whole flight: never the somersault run backwards, never run back', async () => {
    const script: Press[] = [30, 46, 62, 78].map(tick => ({ tick, attack: 'light' as const }));
    const victim = await buildBody('taisei', 'b'), ouga = await buildBody('ouga', 'a');
    try {
      const { samples } = victimRun(victim, ouga, script, 260, { seed: 7 });
      const flight = samples.filter(s => s.action === 'launched' && !s.grounded);
      expect(flight.length, 'he was launched').toBeGreaterThan(20);
      expect(flight.filter(s => s.clip === 'adapted_jump_spin').length, 'frames of the somersault').toBe(0);
      const knock = flight.filter(s => s.clip === 'ultimate-knockback-air').map(s => s.ct ?? 0);
      for (let i = 1; i < knock.length; i++) expect(knock[i], `the throw ran back at frame ${i}`).toBeGreaterThanOrEqual(knock[i - 1] - 1e-6);
    } finally { victim.dispose(); ouga.dispose(); }
  }, 120_000);
  it('a launching blow does not turn him over on top of the clip\'s flight (the layer\'s somersault): he lands on his back', async () => {
    // Filmed in the game, the layer's somersault on top of the clip's own flight was still short of its landing at
    // the floor: stood upright there, his legs went 20-60 cm through the tile before the knockdown laid him flat.
    // A heavy's launch off the floor is the case that turns a body over; Ouga (no spread flight) still does.
    for (const [id, turns] of [['taisei', 0], ['ouga', 1]] as const) {
      const body = await buildBody(id, 'b');
      try {
        body.update(1 / 60, popBase(id, 'b'), true, 1 / 60);
        body.impact(true, 'heavy', 'melee', 0, new THREE.Vector3(0, 0, 1), 54, 1, { reaction: 'launched', chain: 0 });
        expect((body as unknown as { launchTurns: number }).launchTurns, `${id}: whole turns`).toBe(turns);
      } finally { body.dispose(); }
    }
  }, 120_000);
});

describe('Taisei shakes off a stun on his feet', () => {
  it('the get-up after a stun is his stance, never the rise off the floor', async () => {
    // Ouga's Rage Volley (L,L,L,Special) dazes him; the simulation ends a daze with the get-up.
    const script: Press[] = [30, 46, 62].map(tick => ({ tick, attack: 'light' as const }));
    script.push({ tick: 78, attack: 'special' });
    const victim = await buildBody('taisei', 'b'), ouga = await buildBody('ouga', 'a');
    try {
      const { samples } = victimRun(victim, ouga, script, 330, { seed: 7 });
      expect(samples.some(s => s.action === 'stun'), 'he was dazed').toBe(true);
      const rise = samples.filter(s => s.action === 'getup');
      expect(rise.length, 'he got up').toBeGreaterThan(0);
      expect(rise.filter(s => s.clip === 'down_end').length, 'frames of the rise off the floor').toBe(0);
    } finally { victim.dispose(); ouga.dispose(); }
  }, 120_000);
});
