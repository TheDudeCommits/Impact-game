import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { Prediction } from '../src/game/prediction';
import { THREE_BLOW_STRING, withMove } from './retiredMoves';
import type { PlayerInput } from '../src/game/types';
import { SHOOT, ballAssist } from '../src/game/ball/model';

/** A server and a client of it, with a latency you choose in whole ticks. */
function wire(latencyTicks = 6) {
  const server = new ArenaSimulation({ trainingBot: false });
  server.addPlayer('me', 'kenzo', 'Me', false, { x: 0, y: 0, z: 0 });
  server.addPlayer('them', 'taisei', 'Them', false, { x: 0, y: 0, z: 6 });
  const prediction = new Prediction();
  prediction.start('me', server.snapshot(false,true));
  let seq = 0;
  const queue: { at: number; input: PlayerInput }[] = [];
  let tick = 0;
  /** One client frame: make an input, predict it, and post it to the server. */
  const press = (more: Partial<PlayerInput> = {}) => {
    const input: PlayerInput = { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, ...more };
    prediction.submit(input);
    queue.push({ at: tick + latencyTicks, input });
    return input;
  };
  /** One server tick, delivering whatever has arrived. */
  const advance = () => {
    tick++;
    while (queue.length && queue[0].at <= tick) server.submitInput('me', queue.shift()!.input);
    server.step();
  };
  const deliver = () => prediction.reconcile(server.snapshot(false,true));
  return { server, prediction, press, advance, deliver };
}

describe('a handover survives a long frame', () => {
  it('carries the whole difference on the frame the server takes the body', () => {
    // The offset that keeps the body where it was drawn when ownership flips
    // used to be added and then decayed in the same call: on a 0.2 s frame -
    // five frames a second, which is where the live build runs - 97% of it
    // was gone on the frame it was created, and the body popped by the whole
    // round trip of divergence. Decay first, then bank.
    const { server, prediction, press, advance, deliver } = wire(8);
    for (let i = 0; i < 40; i++) { press({ moveZ: 1 }); advance(); if (i % 3 === 2) deliver(); }
    const authoritative = server.getPlayer('me')!;
    // Let whatever misprediction the run banked bleed out first, so the only
    // difference left is the handover's own.
    let shown = prediction.sample(1 / 60, authoritative)!;
    for (let i = 0; i < 40; i++) shown = prediction.sample(1 / 60, authoritative)!;
    // The server takes the body a metre behind where it is drawn, on a long
    // frame. What is on screen must not move.
    const taken = prediction.sample(.2, { ...authoritative, action: 'hurt', z: shown.z - 1 })!;
    expect(Math.abs(taken.z - shown.z), 'the body stayed where it was drawn').toBeLessThan(.05);
  });
});

describe('the local copy collides where the server does', () => {
  it('does not roughen the drawn body when the pair touch', () => {
    // Round 13 moved the local copy's opponents to their DRAWN positions
    // every frame, so the push-apart happened from a place the server never
    // agreed with, and every snapshot reconciled the difference into the
    // player's own body: measured, the largest one-frame change of drawn
    // velocity at touching distance went from 223 to 1970 m/s^2. The remote
    // bodies stay where the snapshot put them; this pins the roughness.
    const { server, prediction, press, advance, deliver } = wire(6);
    const them = server.actors.get('them')!;
    let theirSeq = 0;
    const drawn: number[] = [];
    for (let i = 0; i < 300; i++) {
      // The opponent walks at the player, who walks at them.
      server.submitInput('them', { seq: theirSeq++, moveX: 0, moveZ: -1, yaw: Math.PI });
      press({ moveZ: 1 });
      advance();
      if (i % 2 === 1) deliver();
      drawn.push((prediction.sample(1 / 60, server.getPlayer('me')!) ?? server.getPlayer('me')!).z);
    }
    expect(Math.abs(them.state.z - server.getPlayer('me')!.z), 'the pair met').toBeLessThan(1.3);
    let worst = 0;
    for (let f = 2; f < drawn.length; f++) worst = Math.max(worst, Math.abs((drawn[f] - drawn[f - 1]) - (drawn[f - 1] - drawn[f - 2])) * 3600);
    expect(worst, `the drawn body's velocity jumped ${worst.toFixed(0)} m/s^2 in one frame`).toBeLessThan(400);
  });
});

describe('a change of stage drops the old walls', () => {
  it('stops colliding with the previous stage the moment the stage changes', () => {
    // A wall that refuses every step, standing in for the harbour's colliders.
    const wall = { move: () => ({ x: 0, y: 0, z: 0 }) };
    const { server, prediction, press, advance } = wire(6);
    prediction.setStage('harbor', wall);
    for (let i = 0; i < 12; i++) { press({ moveZ: 1 }); advance(); }
    expect(prediction.sample(1 / 60, server.getPlayer('me')!)!.z, 'held by the wall').toBeLessThan(.01);
    // The server moves the fight to another stage; its world has not loaded here yet.
    prediction.setStage('proving-hall');
    for (let i = 0; i < 12; i++) { press({ moveZ: 1 }); advance(); }
    expect(prediction.sample(1 / 60, server.getPlayer('me')!)!.z, 'the harbour wall is gone').toBeGreaterThan(.2);
  });
});

describe('your own fighter answers the frame you press', () => {
  it('moves locally before the server has heard about it', () => {
    const { server, prediction, press, advance } = wire(8);
    for (let i = 0; i < 6; i++) { press({ moveZ: 1 }); advance(); }
    const shown = prediction.sample(1 / 60, server.getPlayer('me')!)!;
    expect(shown, 'the local copy owns the body').not.toBeNull();
    expect(shown.z, 'it has already set off').toBeGreaterThan(0);
    expect(server.getPlayer('me')!.z, 'and the server has not seen a thing yet').toBe(0);
  });

  it('starts a swing on the press rather than a round trip later', () => {
    const { server, prediction, press, advance } = wire(8);
    press({ attack: 'light' });
    advance();
    const shown = prediction.sample(1 / 60, server.getPlayer('me')!)!;
    expect(shown.action).toBe('light');
    expect(server.getPlayer('me')!.action, 'the server is still idle').toBe('idle');
    // And it announced the cast, which is what lets the sound land on time.
    expect(prediction.takeCasts().some(event => event.kind === 'cast' && event.slot === 'light')).toBe(true);
  });

  it('stays with the server once it catches up', () => {
    const { server, prediction, press, advance, deliver } = wire(6);
    for (let i = 0; i < 90; i++) {
      press({ moveZ: 1, moveX: i > 45 ? 1 : 0 });
      advance();
      if (i % 3 === 2) deliver();
    }
    const local = prediction.sample(1 / 60, server.getPlayer('me')!)!;
    const authority = server.getPlayer('me')!;
    // Ahead of the server by about the latency, and no further: the replay is
    // what keeps a prediction from drifting off on its own.
    const ahead = Math.hypot(local.x - authority.x, local.z - authority.z);
    expect(ahead).toBeGreaterThan(0);
    expect(ahead, 'a prediction, not a different fight').toBeLessThan(1.5);
  });

  it('hands the body back the moment the server says it was hit', () => {
    const { server, prediction, press, advance, deliver } = wire(4);
    for (let i = 0; i < 10; i++) { press({ moveZ: 1 }); advance(); deliver(); }
    expect(prediction.sample(1 / 60, server.getPlayer('me')!)).not.toBeNull();
    const hurt = { ...server.getPlayer('me')!, action: 'knockdown' as const, hp: 640 };
    const shown = prediction.sample(1 / 60, hurt)!;
    // Nothing local predicts being hit: the reaction, the health and the clock
    // are all the server's. What the local copy still owns is the last of the
    // gap between the two, so the handover is not a visible jump.
    expect(shown.action, 'the server decides what being hit looks like').toBe('knockdown');
    expect(shown.hp).toBe(640);
    expect(Math.hypot(shown.x - hurt.x, shown.z - hurt.z), 'and it is drawn where the server says, give or take the handover')
      .toBeLessThan(1.5);
    const dead = { ...server.getPlayer('me')!, alive: false };
    expect(prediction.sample(1 / 60, dead), 'a dead fighter is the server\u2019s outright').toBeNull();
  });

  // A standing attacker's heavy string, so the runner is pinned against the
  // body that hits them, as the case was built. Round 3 made Taisei's heavy
  // Cloudstep, which catches a runner in the open instead; the
  // retired three-blow string is put back for this one.
  it('does not teleport the body on the frame a hit takes it over, or on the way out', () => withMove('taisei', 'heavy', THREE_BLOW_STRING, () => {
    // A real hit, not a synthetic one: the reaction has to go through the same
    // reconcile the drawn frame does, or the test proves nothing about either.
    const server = new ArenaSimulation({ trainingBot: false });
    server.addPlayer('me', 'kenzo', 'Me', false, { x: 0, y: 0, z: 0 });
    server.addPlayer('them', 'taisei', 'Them', false, { x: 0, y: 0, z: 1.2 });
    const prediction = new Prediction();
    prediction.start('me', server.snapshot(false,true));
    const queue: { at: number; input: PlayerInput }[] = [];
    const drawn: { x: number; z: number }[] = [];
    let seq = 0, tick = 0, reacted = false;
    for (let i = 0; i < 110; i++) {
      // Running flat out past somebody who hits us halfway through.
      const input: PlayerInput = { seq: seq++, moveX: 0, moveZ: 1, yaw: 0 };
      prediction.submit(input);
      queue.push({ at: tick + 9, input });
      tick++;
      while (queue.length && queue[0].at <= tick) server.submitInput('me', queue.shift()!.input);
      if (i === 20) server.submitInput('them', { seq: 0, moveX: 0, moveZ: 0, yaw: Math.PI, targetId: 'me', attack: 'heavy' });
      server.step();
      if (i % 3 === 2) prediction.reconcile(server.snapshot(false,true));
      const authority = server.getPlayer('me')!;
      if (!authority.alive) break;
      reacted ||= ['hurt', 'flinch', 'launched', 'knockdown', 'getup', 'stun', 'splat'].includes(authority.action);
      const shown = prediction.sample(1 / 60, authority) ?? authority;
      drawn.push({ x: shown.x, z: shown.z });
    }
    expect(reacted, 'the hit actually landed').toBe(true);
    let worst = 0;
    for (let i = 1; i < drawn.length; i++) worst = Math.max(worst, Math.hypot(drawn[i].x - drawn[i - 1].x, drawn[i].z - drawn[i - 1].z));
    // At a run a frame is 0.125 m, and knockback adds to it. What is not
    // allowed is the whole round trip's worth of travel arriving in one frame,
    // which is what handing the body over used to do - in both directions.
    expect(worst, `the drawn body jumped ${(worst * 100).toFixed(0)} cm in one frame`).toBeLessThan(.4);
  }));

  it('keeps health and meter authoritative even while it owns the body', () => {
    const { server, prediction, press, advance, deliver } = wire(4);
    for (let i = 0; i < 8; i++) { press({ moveZ: 1 }); advance(); }
    deliver();
    const authority = { ...server.getPlayer('me')!, hp: 412, ultimate: 77 };
    const shown = prediction.sample(1 / 60, authority)!;
    expect(shown.hp).toBe(412);
    expect(shown.ultimate).toBe(77);
  });

  it('does not drop a swing for a snapshot that has not heard about it', () => {
    const { server, prediction, press, advance, deliver } = wire(10);
    press({ attack: 'light' });
    advance();
    expect(prediction.action, 'started locally').toBe('light');
    // A snapshot from before the press reached the server: it acknowledges the
    // input - the sequence is there - and still reports an idle fighter.
    const stale = server.snapshot(false,true);
    const me = stale.players.find(p => p.id === 'me')!;
    me.ackSeq = 999;
    delete stale.prediction; // Legacy pose-only acknowledgement compatibility.
    prediction.reconcile(stale);
    expect(prediction.action, 'and kept').toBe('light');
    // And the hold expires on the move's own clock rather than lasting until
    // something contradicts it - a swing that is over is over.
    for (let i = 0; i < 150; i++) { press(); advance(); deliver(); }
    expect(['idle', 'run']).toContain(prediction.action);
  });

  it('is nothing at all until it is started, and nothing again once stopped', () => {
    const prediction = new Prediction();
    expect(prediction.enabled).toBe(false);
    const server = new ArenaSimulation({ trainingBot: false });
    server.addPlayer('me', 'kenzo', 'Me');
    prediction.start('me', server.snapshot(false,true));
    expect(prediction.enabled).toBe(true);
    prediction.stop();
    expect(prediction.enabled).toBe(false);
    expect(prediction.sample(1 / 60, server.getPlayer('me')!)).toBeNull();
  });

  it('does not run a second copy of the sparring bot inside the client', () => {
    // The local copy adds every remote actor as a human on purpose: a
    // predicted bot thinks, swings and fires events the server never asked
    // for. Assigning the snapshot's state straight over the top put the flag
    // back, so the client fought a private match against a bot the server
    // knew nothing about - and because training's passive setting lives on
    // the server, the local one ignored it. Twelve of thirty-five captured
    // frames were a reaction that never happened.
    const server = new ArenaSimulation({ roomMode: 'training', trainingBot: true });
    server.addPlayer('me', 'kenzo', 'Me', false, { x: 0, y: 0, z: 0 });
    server.startMatch();
    server.trainingCommand('me', 'passive');
    const prediction = new Prediction();
    prediction.start('me', server.snapshot(false,true));
    let seq = 0;
    const seen = new Set<string>();
    for (let i = 0; i < 600; i++) {
      const input: PlayerInput = { seq: seq++, moveX: 0, moveZ: i < 300 ? 1 : -1, yaw: 0 };
      prediction.submit(input);
      server.submitInput('me', input);
      server.step();
      if (i % 3 === 2) prediction.reconcile(server.snapshot(false,true));
      const shown = prediction.sample(1 / 60, server.getPlayer('me')!);
      if (shown) seen.add(shown.action);
    }
    expect(server.getPlayer('me')!.hp, 'a passive bot does nothing').toBe(1000);
    for (const reaction of ['hurt', 'flinch', 'launched', 'knockdown', 'getup', 'stun', 'splat'])
      expect([...seen], `the client invented a ${reaction}`).not.toContain(reaction);
  });
});

describe('the ball rooms\' SHOOT, wound up', () => {
  /** A server and a client of it with the ball rooms' sports feel (SportFeel.strike: a heavy is SHOOT), `latencyTicks` apart. */
  function sport(latencyTicks = 8) {
    const server = new ArenaSimulation({ trainingBot: false });
    server.assist = ballAssist('goal-rush');
    server.addPlayer('me', 'kenzo', 'Me', false, { x: 0, y: 0, z: 0 });
    const prediction = new Prediction();
    prediction.start('me', server.snapshot(false, true));
    prediction.setExternalTargets(undefined, ballAssist('goal-rush'));
    let seq = 0, tick = 0;
    const queue: { at: number; input: PlayerInput }[] = [];
    /** One frame: the input predicted, posted, a server tick; and the swing as the page draws it - its clip, its clock. */
    const frame = (more: Partial<PlayerInput> = {}) => {
      const input: PlayerInput = { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, ...more };
      prediction.submit(input); queue.push({ at: tick + latencyTicks, input });
      tick++;
      while (queue.length && queue[0].at <= tick) server.submitInput('me', queue.shift()!.input);
      server.step();
      const shown = prediction.sample(1 / 60, server.getPlayer('me')!)!;
      return { action: shown.action, strike: shown.strike, clock: (shown.actionTime ?? 0) * (shown.actionDuration ?? 0) };
    };
    return { frame };
  }
  it('keeps a tap wound into a charge on the press\'s clock across the split; an ordinary second cast still starts its own', () => {
    const { frame } = sport();
    const drawn = [frame({ attack: 'heavy', heavyHeld: true })];
    for (let i = 1; i < 30; i++) drawn.push(frame({ heavyHeld: true }));
    // The quick strike, then past SHOOT.hold the fighter's own heavy (a charge), one swing.
    const split = drawn.findIndex(d => d.strike === 'charge');
    expect(split, 'wound up at the split').toBeGreaterThan(Math.round(SHOOT.hold * 60) - 2);
    expect(drawn[split - 1].strike).toBe('tap');
    // Its drawn clock runs on from the press through the split, never back to the start.
    for (let i = 1; i < 30 && drawn[i].action === 'heavy'; i++) expect(drawn[i].clock, `frame ${i}`).toBeGreaterThan(drawn[i - 1].clock);
    expect(drawn[split].clock, 'the press\'s age at the split').toBeGreaterThan(SHOOT.hold - .05);
    // A second press, after the first is over: a cast of its own, drawn from its start.
    for (let i = 0; i < 90; i++) frame();
    const again = frame({ attack: 'heavy' });
    expect(again.action).toBe('heavy');
    expect(again.clock, 'a new swing starts at its own beginning').toBeLessThan(.05);
  });
});
