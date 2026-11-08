import { describe, expect, it } from 'vitest';
import { ArenaSimulation } from '../src/game/simulation';
import { CHASE_SECONDS, MOVES } from '../src/game/moves';
import type { AttackSlot, FighterId, PlayerInput } from '../src/game/types';
import { THREE_BLOW_STRING, withMove } from './retiredMoves';

function bout(fighter:FighterId,gap=1.6){
  const sim=new ArenaSimulation({trainingBot:false});
  sim.addPlayer('a',fighter,'A',false,{x:0,y:0,z:0});
  sim.addPlayer('b','taisei','B',false,{x:0,y:0,z:gap});
  let seq=0;
  const input=(id:string,more:Partial<PlayerInput>)=>sim.submitInput(id,{seq:seq++,moveX:0,moveZ:0,yaw:0,...more});
  const step=(seconds:number)=>{for(let i=0;i<Math.round(seconds*60);i++)sim.step();};
  return {sim,input,step};
}

describe('combo and cancel rules', () => {
  it('cancels a landed light into a heavy before the light would finish', () => {
    const {sim,input,step}=bout('kenzo');
    const light=MOVES.kenzo.light;
    input('a',{attack:'light',targetId:'b'});
    step(light.contacts[0]+.06);
    // The light has connected, so the chain is open.
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
    input('a',{attack:'heavy',targetId:'b'});
    step(.05);
    expect(sim.getPlayer('a')!.action).toBe('heavy');
  });

  it('keeps a whiffed light fully committed', () => {
    // Nothing was hit, so there is nothing to cancel out of - which is what
    // stops chain-cancelling from becoming a way to spam through whiffs.
    const {sim,input,step}=bout('kenzo',14);
    input('a',{attack:'light',targetId:'b'});
    step(MOVES.kenzo.light.contacts[0]+.06);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
    input('a',{attack:'heavy',targetId:'b'});
    sim.step();
    expect(sim.getPlayer('a')!.action).toBe('light');
  });

  it('lets a landed heavy carry on into anything', () => {
    // A heavy of three blows, after the first of which the target is still on
    // their feet. Round 3: Taisei's is Cloudstep now and every heavy
    // in the roster launches, so the retired three-blow string is put back.
    withMove('taisei','heavy',THREE_BLOW_STRING,()=>{
    const {sim,input,step}=bout('taisei');
    input('a',{attack:'heavy',targetId:'b'});
    step(MOVES.taisei.heavy.contacts[0]+.06);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
    // A heavy used to route into a special or an ultimate and nothing else,
    // which for eight of the ten fighters meant a landed heavy bought nothing
    // a player could reach: measured, connecting with one was about a second
    // of dead air. Both fighters are in impact freeze at the moment of
    // contact, so the input is buffered and fires on the frame it ends.
    input('a',{attack:'light',targetId:'b'});
    step(.12);
    expect(sim.getPlayer('a')!.action).toBe('light');
    });
    const launch=bout('kenzo');
    launch.input('a',{attack:'heavy',targetId:'b'});
    launch.step(MOVES.kenzo.heavy.contacts[0]+.06);
    expect(launch.sim.getPlayer('b')!.action).toBe('launched');
    launch.input('a',{attack:'light',targetId:'b'});
    launch.step(.12);
    expect(launch.sim.getPlayer('a')!.action).toBe('dash');
    launch.step(CHASE_SECONDS);
    expect(launch.sim.getPlayer('a')!.action).toBe('light');
    expect(launch.sim.getPlayer('a')!.grounded).toBe(false);
  });

  it('gives a whiffed heavy nothing at all', () => {
    // The route is opened by connecting, not by pressing: `cancellable` wants
    // the move to have landed and to be past its first contact.
    const {sim,input,step}=bout('kenzo',14);
    input('a',{attack:'heavy',targetId:'b'});
    step(MOVES.kenzo.heavy.contacts[0]+.06);
    expect(sim.getPlayer('b')!.hp).toBe(1000);
    input('a',{attack:'light',targetId:'b'});
    step(.12);
    expect(sim.getPlayer('a')!.action).toBe('heavy');
  });

  it('gives movement back during recovery instead of freezing the whole move', () => {
    const {sim,input,step}=bout('kenzo');
    const heavy=MOVES.kenzo.heavy;
    input('a',{attack:'heavy',targetId:'b'});
    step(heavy.contacts[heavy.contacts.length-1]+.12);
    const before=sim.getPlayer('a')!.x;
    input('a',{moveX:1});
    step(.25);
    expect(Math.abs(sim.getPlayer('a')!.x-before)).toBeGreaterThan(.2);
  });

  it('steps a melee attacker into the strike even with no authored lunge', () => {
    // Gummy's light carries no lunge, so before this he swung from standstill.
    expect(MOVES.gummy.light.lunge).toBeUndefined();
    const {sim,input,step}=bout('gummy',3.2);
    const before=sim.getPlayer('a')!.z;
    input('a',{attack:'light',targetId:'b'});
    step(MOVES.gummy.light.contacts[0]);
    expect(sim.getPlayer('a')!.z).toBeGreaterThan(before+.1);
  });

  it('still refuses a chain the route does not allow', () => {
    const {sim,input,step}=bout('kenzo');
    sim.actors.get('a')!.state.ultimate=100;
    input('a',{attack:'ultimate',targetId:'b'});
    const ultimate=MOVES.kenzo.ultimate;
    step(ultimate.contacts[0]+.06);
    for(const slot of ['light','heavy','special'] as AttackSlot[]){
      input('a',{attack:slot,targetId:'b'});
      sim.step();
      expect(sim.getPlayer('a')!.action).toBe('ultimate');
    }
  });
});

describe('impact and reactions', () => {
  it('freezes both fighters on contact and resumes them together', () => {
    const {sim,input,step}=bout('kenzo');
    input('a',{attack:'light',targetId:'b'});
    // The attacker resolves the contact inside its own tick, so its freeze
    // starts on the next one - sixteen milliseconds behind the target's.
    step(MOVES.kenzo.light.contacts[0]+.04);
    const attacker=sim.getPlayer('a')!,victim=sim.getPlayer('b')!;
    expect(victim.hp).toBeLessThan(1000);
    // The frame they collided on is held by both, which is what makes a hit
    // read as a collision rather than two animations passing through.
    expect(attacker.hitstop).toBe(true);
    expect(victim.hitstop).toBe(true);
    const frozen={a:attacker.actionTime,az:attacker.z,bz:victim.z};
    sim.step();
    expect(sim.getPlayer('a')!.actionTime).toBe(frozen.a);
    expect(sim.getPlayer('a')!.z).toBe(frozen.az);
    expect(sim.getPlayer('b')!.z).toBe(frozen.bz);
    step(.2);
    expect(sim.getPlayer('a')!.hitstop).toBe(false);
    expect(sim.getPlayer('a')!.actionTime).toBeGreaterThan(frozen.a);
  });

  it('answers a jab, a heavy and a broken guard with different reactions', () => {
    // Konta's barrage: Taisei's heavy was the string here until round 3 made
    // it Cloudstep, a single blow.
    const jab=bout('konta');
    jab.input('a',{attack:'light',targetId:'b'});
    // Just past the first blow of the string, read from the table.
    jab.step(MOVES.konta.light.contacts[0]+.06);
    // A mid-string tick of a multi-hit move only flinches.
    expect(jab.sim.getPlayer('b')!.action).toBe('flinch');

    const launch=bout('kenzo');
    launch.input('a',{attack:'heavy',targetId:'b'});
    launch.step(MOVES.kenzo.heavy.contacts[0]+.2);
    expect(launch.sim.getPlayer('b')!.action).toBe('launched');
    expect(launch.sim.getPlayer('b')!.grounded).toBe(false);

    // A guard that holds. One heavy no longer breaks it - that made blocking
    // strictly worse than eating the hit - so the answer to a blocked heavy is
    // a defender still on their feet and still guarding.
    const broken=bout('kenzo');
    const guard=(fight:ReturnType<typeof bout>,seconds:number)=>{
      // Guard has to be held: an input older than a third of a second is stale.
      for(let frame=0;frame<Math.round(seconds*60);frame++){
        // Facing the attacker: a guard only covers the front.
        if(frame%12===0)fight.input('b',{guard:true,yaw:Math.PI});
        fight.sim.step();
      }
    };
    broken.input('a',{attack:'heavy',targetId:'b'});
    guard(broken,MOVES.kenzo.heavy.contacts[0]+.2);
    expect(broken.sim.getPlayer('b')!.action).toBe('guard');
    // That a guard still opens under sustained pressure is simulation.test's
    // 'two heavies break it', which drives the stamina path directly.
  });

  it('carries a launch through landing, knockdown and getting up', () => {
    const {sim,input,step}=bout('kenzo');
    input('a',{attack:'heavy',targetId:'b'});
    const seen:string[]=[];
    // Long enough to cover the launch, the landing and the wake-up, impact
    // freeze included: the freeze holds every timer it pauses.
    for(let frame=0;frame<210;frame++){
      const victim=sim.getPlayer('b')!;
      if(seen[seen.length-1]!==victim.action)seen.push(victim.action);
      sim.step();
    }
    const order=seen.filter(a=>['launched','knockdown','getup','idle'].includes(a));
    expect(order.indexOf('launched')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('knockdown')).toBeGreaterThan(order.indexOf('launched'));
    expect(order.indexOf('getup')).toBeGreaterThan(order.indexOf('knockdown'));
    // Getting up cannot be meatied: the wake-up is invulnerable.
    const rising=sim.actors.get('b')!;
    expect(sim.getPlayer('b')!.action).toBe('idle');
    step(.1);
    expect(rising.state.alive).toBe(true);
  });

  it('lets a launched fighter recover in the air instead of eating the knockdown', () => {
    const teched=bout('kenzo'),dropped=bout('kenzo');
    for(const bout_ of [teched,dropped]){
      bout_.input('a',{attack:'heavy',targetId:'b'});
      bout_.step(MOVES.kenzo.heavy.contacts[0]+.3);
      expect(bout_.sim.getPlayer('b')!.action).toBe('launched');
    }
    teched.input('b',{dash:true});
    teched.step(.05);
    expect(teched.sim.snapshot().events.some(e=>e.kind==='tech'&&e.actorId==='b')).toBe(true);
    // Recovering costs stamina, so it is a resource and not a free escape.
    expect(teched.sim.getPlayer('b')!.stamina).toBeLessThan(dropped.sim.getPlayer('b')!.stamina);
    teched.step(.9);dropped.step(.9);
    expect(teched.sim.getPlayer('b')!.action).toBe('idle');
    expect(['knockdown','getup']).toContain(dropped.sim.getPlayer('b')!.action);
  });

  it('scales damage down across a string and counts the combo', () => {
    // Konta's three-blow barrage (Taisei's heavy was the string until round 3).
    const {sim,input,step}=bout('konta');
    input('a',{attack:'light',targetId:'b'});
    step(1.4);
    const hits=sim.snapshot().events.filter(e=>e.kind==='hit'&&e.actorId==='a');
    expect(hits).toHaveLength(3);
    expect(hits[1].damage!).toBeLessThan(hits[0].damage!);
    expect(hits[2].damage!).toBeLessThan(hits[1].damage!);
    expect(hits.map(e=>e.combo)).toEqual([1,2,3]);
    expect(sim.getPlayer('a')!.combo).toBe(3);
    // The string lapses on its own; a later hit starts counting again.
    step(2);
    expect(sim.getPlayer('a')!.combo).toBe(0);
  });
});

describe('attack armour', () => {
  // The committed fighter casts away from the interrupter on purpose.
  //
  // Armour is a question about whether being hit takes a fighter out of their
  // move. It is not a question about who connects first, and it stopped being
  // possible to ask it cleanly once Taisei's Sunpalm Cannon was sped up: his beam
  // now contacts at 1.35 s against Kenzo's projectile at 1.55, so the committed
  // fighter interrupted the interrupter and nothing landed. Facing him away
  // leaves exactly one blow in the exchange - the one being tested.
  const casting=(fighter:FighterId,slot:AttackSlot)=>{
    const {sim,input,step}=bout(fighter,2.2);
    sim.actors.get('b')!.state.ultimate=100;
    input('b',{attack:slot,yaw:0});
    step(.1);
    expect(sim.getPlayer('b')!.action).toBe(slot);
    return {sim,input,step};
  };
  const interrupt=(fighter:FighterId,committed:AttackSlot,incoming:AttackSlot)=>{
    const {sim,input,step}=casting(fighter,committed);
    sim.actors.get('a')!.state.ultimate=100;
    input('a',{attack:incoming,targetId:'b'});
    step(MOVES.kenzo[incoming].contacts[0]+.35);
    expect(sim.getPlayer('b')!.hp).toBeLessThan(1000);
    return sim.getPlayer('b')!.action===committed;
  };

  it('never lets a light or a heavy break a committed move', () => {
    expect(interrupt('kenzo','special','light')).toBe(true);
    expect(interrupt('kenzo','special','heavy')).toBe(true);
  });

  it('lets a special break anything except an ultimate', () => {
    expect(interrupt('kenzo','heavy','special')).toBe(false);
    expect(interrupt('kenzo','special','special')).toBe(false);
    // An ultimate is a commitment both ways: a special will not take it away.
    expect(interrupt('kenzo','ultimate','special')).toBe(true);
  });

  it('only lets an ultimate interrupt an ultimate', () => {
    expect(interrupt('kenzo','ultimate','ultimate')).toBe(false);
  });
});

describe('air combat', () => {
  // Put a fighter in the air where the test needs them; getting there by
  // jumping is a separate concern from what happens once they are up.
  const lift=(sim:ArenaSimulation,id:string,y:number)=>{
    const actor=sim.actors.get(id)!;
    actor.state.y=y; actor.state.grounded=false; actor.vy=0;
  };
  // One juggle hit, with both fighters held at height until it connects so the
  // pair do not simply fall out of each other's reach mid-swing.
  const juggleHit=(bout_:ReturnType<typeof bout>,y=6)=>{
    const {sim,input}=bout_;
    sim.actors.get('a')!.state.cooldowns.light=0;
    lift(sim,'a',y); lift(sim,'b',y);
    const before=sim.getPlayer('b')!.hp;
    input('a',{attack:'light',targetId:'b'});
    for(let frame=0;frame<90;frame++){
      sim.step();
      if(sim.getPlayer('b')!.hp!==before)return sim.actors.get('b')!.vy;
      lift(sim,'a',y); lift(sim,'b',y);
    }
    return 0;
  };

  it('lifts an airborne target again on every hit, by less each time', () => {
    const arena=bout('kenzo');
    const lifts=[juggleHit(arena),juggleHit(arena),juggleHit(arena),juggleHit(arena)];
    // Every juggle hit sends them up again, but never as far as the one before.
    expect(lifts[0]).toBeGreaterThan(0);
    for(let i=1;i<lifts.length;i++)expect(lifts[i]).toBeLessThan(lifts[i-1]);
    // And the budget runs out, so a juggle cannot be held indefinitely.
    expect(arena.sim.actors.get('b')!.juggleHits).toBe(4);
    expect(juggleHit(arena)).toBe(0);
  });

  it('gives back the floor once a juggled fighter lands', () => {
    const arena=bout('kenzo');
    expect(juggleHit(arena)).toBeGreaterThan(0);
    expect(arena.sim.actors.get('b')!.juggleHits).toBe(1);
    arena.step(3);
    expect(arena.sim.getPlayer('b')!.grounded).toBe(true);
    expect(arena.sim.actors.get('b')!.juggleHits).toBe(0);
  });

  it('aims an air dash at the locked opponent so a launch can be chased', () => {
    const chase=bout('kenzo'),straight=bout('kenzo');
    for(const [arena,locked] of [[chase,true],[straight,false]] as const){
      // Past the opening dash cooldown before anyone leaves the ground.
      arena.step(.5);
      lift(arena.sim,'a',1);
      Object.assign(arena.sim.actors.get('b')!.state,{y:6,grounded:false,z:5});
      arena.input('a',{dash:true,targetId:locked?'b':null});
      arena.step(.22);
    }
    // Locked on, the dash climbs toward them; unlocked it stays a ground dash.
    expect(chase.sim.getPlayer('a')!.y).toBeGreaterThan(3);
    expect(straight.sim.getPlayer('a')!.y).toBeLessThan(chase.sim.getPlayer('a')!.y);
  });

  it('holds a move that started in the air up long enough to finish it', () => {
    // (5 October) Kenzo's special off the floor is his ground smash now, which drops (combos.ts), and (round 4b,
    // JUMP) his air strike dives from the new heights (tests/jumpArc.test.ts): his air light holds.
    const casting=bout('kenzo'),falling=bout('kenzo');
    for(const arena of [casting,falling])lift(arena.sim,'a',6);
    casting.input('a',{attack:'light',targetId:'b'});
    casting.step(.4); falling.step(.4);
    // Same airtime, but the caster is still up where the move can play out.
    expect(casting.sim.getPlayer('a')!.y).toBeGreaterThan(falling.sim.getPlayer('a')!.y+.5);
    expect(casting.sim.getPlayer('a')!.action).toBe('light');
  });
});

describe('input buffering', () => {
  it('fires a jump pressed during a move as soon as the move allows it', () => {
    const chasing=bout('kenzo'),still=bout('kenzo');
    for(const arena of [chasing,still]){
      arena.input('a',{attack:'heavy',targetId:'b'});
      // Up to the moment the heavy connects and launches them.
      arena.step(MOVES.kenzo.heavy.contacts[0]+.05);
    }
    // Pressed on reaction to the hit, which is still inside the move: the
    // recovery window does not open for another tenth of a second.
    // Held: a tap is the short hop (round 15), and this is about when the
    // jump fires, not how high.
    chasing.input('a',{jump:true,jumpHeld:true});
    chasing.step(.02);
    expect(chasing.sim.getPlayer('a')!.grounded).toBe(true);
    chasing.step(.5); still.step(.52);
    expect(chasing.sim.getPlayer('a')!.y).toBeGreaterThan(.5);
    expect(still.sim.getPlayer('a')!.grounded).toBe(true);
  });

  it('keeps a follow-up press alive until the running move can take it', () => {
    // Every light's cooldown outlasts its own duration, so a flat 0.18 s
    // buffer ran out before the press could ever be legal: measured, a second
    // jab pressed anywhere between 0.05 s and 0.93 s of Kenzo's was dropped in
    // silence. The press now waits for the move that is running.
    const roster:FighterId[]=['kenzo','koko','nigo','shirokane','shiden','kosho','ouga','taisei','gummy','konta','setsu','oro','kagari','ward','kuon','gaunt'];
    for(const fighter of roster)for(const delay of [.05,.2,.5,.91]){
      const {sim,input,step}=bout(fighter);
      input('a',{attack:'light',targetId:'b'});
      step(delay);
      input('a',{attack:'light',targetId:'b'});
      const light=MOVES[fighter].light;
      step(light.duration+light.cooldown);
      const casts=sim.snapshot(true).events.filter(e=>e.kind==='cast'&&e.actorId==='a');
      expect(casts.length,`${fighter} at ${delay}s`).toBe(2);
    }
  });

  it('announces a cooldown once however long the press waits on it', () => {
    const {sim,input,step}=bout('kenzo');
    sim.actors.get('a')!.state.ultimate=100;
    input('a',{attack:'ultimate',targetId:'b'});
    // Round 3d: into the ultimate's recovery, past its finisher. The press
    // waits on the move and then on the cooldown; one made before the
    // cinematic's four impact freezes would run out first, since a hold is
    // dated from the move's length as it stood when the button went down.
    step(MOVES.kenzo.ultimate.contacts.at(-1)!+.5);
    // Twenty seconds of cooldown: this one is never coming out, and the retry
    // runs every tick until the press expires. The HUD turns each refusal into
    // a notice, so only the first one is sent.
    input('a',{attack:'ultimate',targetId:'b'});
    step(MOVES.kenzo.ultimate.duration+.4);
    const refusals=sim.snapshot(true).events.filter(e=>e.kind==='rejected'&&e.actorId==='a');
    expect(refusals).toHaveLength(1);
    expect(refusals[0].reason).toBe('cooldown');
  });

  it('drops a queued swing when the player dashes away from it', () => {
    const {sim,input,step}=bout('kenzo');
    input('a',{attack:'light',targetId:'b'});
    // Pressed again before the first one lands, so it is queued rather than
    // a cancel out of a connected blow; then the dash.
    step(MOVES.kenzo.light.contacts[0]-.06);
    input('a',{attack:'light',targetId:'b'});
    step(.05);
    input('a',{dash:true});
    step(MOVES.kenzo.light.duration+MOVES.kenzo.light.cooldown);
    const casts=sim.snapshot(true).events.filter(e=>e.kind==='cast'&&e.actorId==='a');
    expect(casts,'a change of mind is not a swing a second later').toHaveLength(1);
  });

  it('spends a refused attack instead of retrying it into a stream of notices', () => {
    const {sim,input,step}=bout('kenzo');
    // No meter, so the ultimate is refused on resources rather than blocked.
    input('a',{attack:'ultimate',targetId:'b'});
    step(.3);
    const refusals=sim.snapshot().events.filter(e=>e.kind==='rejected'&&e.actorId==='a');
    expect(refusals).toHaveLength(1);
    expect(refusals[0].reason).toBe('ultimate-meter');
  });
});

describe('air dash reach', () => {
  it('stops beside a close target instead of flying past it', () => {
    const {sim,input,step}=bout('kenzo');
    step(.5);
    Object.assign(sim.actors.get('a')!.state,{y:1,grounded:false});
    Object.assign(sim.actors.get('b')!.state,{y:2.4,z:1.2,grounded:false});
    input('a',{dash:true,targetId:'b'});
    step(.22);
    const chaser=sim.getPlayer('a')!,target=sim.getPlayer('b')!;
    // Close enough to swing at, rather than three metres above and behind.
    expect(Math.hypot(chaser.x-target.x,chaser.y-target.y,chaser.z-target.z)).toBeLessThan(1.8);
  });
});

describe('dash cancel', () => {
  it('lets an attack come straight out of a dash', () => {
    const {sim,input,step}=bout('kenzo');
    step(.5);
    input('a',{dash:true});
    step(.05);
    expect(sim.getPlayer('a')!.action).toBe('dash');
    // Pressed mid-dash: a dash lasts longer than the input buffer, so refusing
    // it here means the press is simply lost.
    input('a',{attack:'light',targetId:'b'});
    step(.05);
    expect(sim.getPlayer('a')!.action).toBe('light');
  });

  it('will not let a dash erase the recovery of a move that hit nothing', () => {
    // `recovering` opens four frames after the last active frame whether or
    // not anything was there, and the dash branch then deleted the cast
    // outright - so a whiff cost nothing. Measured over the whole roster, the
    // frames until the next attack came out after swinging at empty air, with
    // and without a dash: Kenzo's heavy 73 against 43, his Phoenix 164 against
    // 98, Gummy's ultimate 470 against 305. A twenty-second ultimate thrown at
    // nothing had one frame of recovery and 7.8 frames of invulnerability on
    // the way out. Spacing and whiff punishing are the read layer that makes a
    // fight a fight.
    const swing = (dash: boolean) => {
      const sim = new ArenaSimulation({ trainingBot: false });
      sim.addPlayer('a', 'kenzo', 'A', false, { x: 0, y: 0, z: 0 });
      // Far enough that nothing can connect.
      sim.addPlayer('b', 'taisei', 'B', false, { x: 0, y: 0, z: 40 });
      let seq = 0;
      sim.submitInput('a', { seq: seq++, moveX: 0, moveZ: 0, yaw: 0, attack: 'heavy' });
      const heavy = MOVES.kenzo.heavy;
      const after = Math.round(heavy.contacts[heavy.contacts.length - 1] * 60) + 4;
      for (let i = 0; i < 400; i++) {
        const press: Record<string, unknown> = { seq: seq++, moveX: 0, moveZ: 0, yaw: 0 };
        if (dash && i === after) press.dash = true;
        if (i > after) press.attack = 'light';
        sim.submitInput('a', press as never);
        sim.step();
        for (const e of sim.snapshot(true).events)
          if (e.kind === 'cast' && e.actorId === 'a' && e.slot === 'light') { sim.dispose(); return i; }
      }
      sim.dispose();
      return -1;
    };
    const waited = swing(false), dashed = swing(true);
    expect(waited, 'the whiff has a recovery at all').toBeGreaterThan(40);
    expect(dashed, `dashing cut the whiff recovery from ${waited} frames to ${dashed}`).toBeGreaterThanOrEqual(waited);
  });

  it('still refuses an attack while stunned', () => {
    const {sim,input,step}=bout('kenzo');
    // `bout` always makes 'b' Taisei, so it is Taisei's heavy that has to land -
    // this was timed off Kenzo's, which happened to be late enough before the
    // string was re-timed.
    input('b',{attack:'heavy',targetId:'a',yaw:Math.PI});
    const string=MOVES.taisei.heavy;
    // The finisher lands on the frame the contact falls in, so the step has to
    // clear it rather than land on it: 0.06 rounded to exactly the frame
    // before.
    step(string.contacts[string.contacts.length-1]+.1);
    expect(sim.getPlayer('a')!.action).toBe('launched');
    input('a',{attack:'light',targetId:'b'});
    step(.05);
    expect(sim.getPlayer('a')!.action).toBe('launched');
  });
});
