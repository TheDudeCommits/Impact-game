import * as THREE from 'three';
import type {CombatEvent} from '../game/types';
import {MOVES,type MoveDefinition} from '../game/moves';
import {comboMove} from '../game/combos';
import type {Fighter} from './Fighter';
import {FLIGHTS, chargeWasCancelled} from './CombatEffects';
import {ElectricKit} from './signature/ElectricKit';
import {GLOW} from './signature/GlowBatch';
import {castAge} from './signature/castClock';
import {beats,ultimateEnd} from './signature/ultimateClock';
import {bodyCenter} from './signature/body';
import {struckBody,FIZZLE_REACH} from './signature/struck';

/** Setsu's Aura is electricity, drawn with the shared electric kit
 *  (signature/ElectricKit): glowing, branching bolts re-forked at 30 Hz, a
 *  crackling ball in each charged hand, sparks, and light on everything near.
 *
 *  - Sekkou: both hands gather, bridged by an arc; then the striking hand
 *    carries the charge, and on the blow a bolt drops out of the sky through
 *    it - the move is a lightning strike, not a punch with sparks on it.
 *  - Ikazuchi: the hands crackle through the seal, then the projectile that
 *    CombatEffects throws is wrapped in lightning along its flight and trails
 *    a forked tail. Its position comes from FLIGHTS, as Signal Fire's fire does.
 *  - 'Setsuna: Kazahana': both hands live through the blur, brightest as each
 *    blow lands, leaving streaks where they have been.
 *  - SETSUNA, awakened: arcs hop between the body's own joints on a walk that
 *    changes eight times a second, a rayed crown off the hair, and a faint
 *    light that flickers with it. His hair is white, so the crown tint the
 *    awakening carries barely reads on it; the corona is what says SETSUNA.
 *
 *  Bounded buffers; nothing is allocated in the loop. */
const clean=(n:string)=>n.toLowerCase().replace(/[^a-z0-9]/g,'');
const noise=(n:number)=>{const x=Math.sin(n*12.9898+78.233)*43758.5453;return x-Math.floor(x);};
const salt=(id:string)=>{let h=11;for(let i=0;i<id.length;i++)h=(h*31+id.charCodeAt(i))%9973;return h;};
/** Setsu's electricity is paler than a Storm Talon: nearly white, blue at the edge. */
const SETSU={glow:new THREE.Color(.5,.85,2.5),deep:new THREE.Color(.22,.5,2.2),light:new THREE.Color(.55,.8,1.7),halo:new THREE.Color(.12,.3,1.0)};
type Cast={event:CombatEvent;move:MoveDefinition;ended?:number;trail:string;flight:string;hold?:number;releasedAt?:number;drawn?:number};
export class SetsuEffects{
  private kit:ElectricKit;
  private casts:Cast[]=[];
  private seen=new Set<number>();
  private a=new THREE.Vector3();private b=new THREE.Vector3();private c=new THREE.Vector3();
  private joints=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  constructor(scene:THREE.Scene){this.kit=new ElectricKit(scene,'setsu-lightning',1800);}
  handle(events:CombatEvent[]){
    for(const event of events){
      if(this.seen.has(event.id))continue;this.seen.add(event.id);if(this.seen.size>2048)this.seen.delete(this.seen.values().next().value!);
      // Ikazuchi, and a combo ender thrown as lightning from either slot (game/combos.ts): each flies wrapped in it, on
      // its own move's clock. An ender that is a blow is no Ikazuchi and no Thunderbolt.
      const ender=event.kind==='cast'&&event.fighter==='setsu'&&event.branch?comboMove('setsu',event.branch):undefined;
      const thrown=event.kind==='cast'&&event.fighter==='setsu'&&event.origin&&event.endpoint?(event.branch?ender?.style==='projectile'?ender:undefined:event.slot==='special'?MOVES.setsu.special:undefined):undefined;
      if(thrown){this.casts.push({event,move:thrown,trail:'ikazuchi:'+event.id,flight:`${event.id}:0`});if(this.casts.length>16)this.kit.forget(this.casts.shift()!.trail);}
      if(['hit','blocked','guard-break'].includes(event.kind))for(const c of this.casts)if(c.event.actorId===event.actorId&&event.slot===c.event.slot&&event.fighter==='setsu'&&event.serverTime>c.event.serverTime&&!c.ended)c.ended=event.serverTime;
    }
  }
  private joint(fighter:Fighter,canonical:string,spelled:string,out:THREE.Vector3){
    const bone=fighter.joints.get(canonical)??fighter.bones.get(clean(spelled));
    if(bone)bone.getWorldPosition(out);else out.copy(fighter.group.position).add(this.c.set(0,.9,0));
    return out;
  }
  update(time:number,fighters:ReadonlyMap<string,Fighter>,density:number){
    const kit=this.kit;kit.begin(time,density);
    for(const [id,f] of fighters){
      const s=f.state;if(!s.alive||s.fighter!=='setsu'){kit.forget(id);continue;}
      const t=s.actionTime*s.actionDuration,key=salt(id),floor=s.grounded?f.group.position.y:NaN;
      if(s.action==='heavy'&&!s.branch){
        const move=MOVES.setsu.heavy,contact=move.contacts[0];
        // Gathering on both hands, bridged, then everything on the striking hand
        // from just before contact until the recovery.
        const gather=THREE.MathUtils.smoothstep(t,0,contact*.55)*(1-THREE.MathUtils.smoothstep(t,contact*.8,contact));
        const strike=THREE.MathUtils.smoothstep(t,contact-.12,contact-.02)*(1-THREE.MathUtils.smoothstep(t,contact+.28,s.actionDuration));
        if(gather>.02){kit.ball(f.handR,gather*.75,key,floor,SETSU.glow,SETSU.light,.5);kit.ball(f.handL,gather*.6,key+2,NaN,SETSU.glow,SETSU.light,.45);kit.arc(f.handL,f.handR,kit.tick*3+key,.028*gather,SETSU.deep,gather,1,3,.3);}
        if(strike>.02){kit.ball(f.handR,(.9+.4*strike)*strike,key+1,floor,SETSU.glow,SETSU.light,.34);kit.trail(id,f.handR,strike,key,SETSU.glow);} // round 3e: about the hand (signature/struck)
        // The thunderbolt itself: from the sky, through the hand, onto the blow.
        // Round 3e (ULTFIX): and on into the body it landed on, bursting there;
        // a blow that found nobody spends it at the hand (signature/struck),
        // not in a burst a metre round it over whoever stands out of reach.
        const drop=1-Math.min(1,Math.abs(t-contact+.02)/.1);
        if(drop>0){this.a.copy(f.handR);this.a.y+=6;this.a.x+=Math.sin(key)*.8;this.a.z+=Math.cos(key)*.8;kit.arc(this.a,f.handR,kit.tick*13+key,.07*drop+.02,SETSU.glow,drop,3,4,.2);
          const struck=t>=contact-.03?struckBody(f,fighters):undefined;
          if(struck){bodyCenter(struck,this.b);kit.arc(f.handR,this.b,kit.tick*17+key,.05*drop+.015,SETSU.glow,drop,2,3,.25);kit.flash(this.b,drop,key+9,1.1,SETSU.glow);}
          else kit.flash(f.handR,drop*.7,key+9,FIZZLE_REACH,SETSU.glow);}
      }
      if(s.action==='special'&&!s.branch){
        const release=MOVES.setsu.special.contacts[0];
        // The seal: both hands, building until the release.
        const seal=THREE.MathUtils.smoothstep(t,.08,release*.6)*(1-THREE.MathUtils.smoothstep(t,release,release+.12));
        if(seal>.02){kit.ball(f.handR,seal*.85,key,floor,SETSU.glow,SETSU.light,.5);kit.ball(f.handL,seal*.85,key+3,NaN,SETSU.glow,SETSU.light,.5);kit.arc(f.handL,f.handR,kit.tick*5+key,.03*seal,SETSU.deep,seal,2,3,.32);}
      }
      if(s.action==='ultimate'){
        // Setsuna: Kazahana. Both hands live through the blur, brightest as
        // each blow lands, and the finisher arrives on a full charge.
        // Round 3d (ULTS): the first SETSUNA strike is the opener; the blur
        // after it is the cinematic's (beats), and one that whiffed goes out
        // with the move (ultimateEnd).
        const move=MOVES.setsu.ultimate,end=ultimateEnd(s);let near=0;
        for(let i=0,n=beats(s,move);i<n;i++)near=Math.max(near,1-Math.min(1,Math.abs(t-move.contacts[i])/.14));
        const live=THREE.MathUtils.smoothstep(t,.15,.6)*(1-THREE.MathUtils.smoothstep(t,end-.5,end));
        const power=(.5+.6*near)*live;
        // Round 3e (ULTFIX): the hands' crackle stays about the hands, and each
        // blow bursts in the body it lands on, or fizzles at the hand where it
        // found nobody (the opener that whiffs): see signature/struck.
        kit.ball(f.handR,power,key,floor,SETSU.glow,SETSU.light,.34);kit.ball(f.handL,power*.8,key+5,NaN,SETSU.glow,SETSU.light,.3);
        kit.trail(id,f.handR,live,key,SETSU.glow);
        if(near>.55){const struck=struckBody(f,fighters),k=(near-.55)/.45*live;
          if(struck){bodyCenter(struck,this.b);kit.flash(this.b,k,key+7,1,SETSU.glow);}
          else kit.flash(f.handR,k*.7,key+7,FIZZLE_REACH,SETSU.glow);}
      }else if(s.action!=='heavy'||s.branch)kit.forget(id);
      if(s.awakened){
        // The crackle over the body: arcs hop between the joints on a walk
        // that changes eight times a second, and the crown throws rays.
        const left=(s.awakenedUntil??0)-time;const strength=THREE.MathUtils.clamp(left,0,1);
        if(strength>.02){
          const J=this.joints;
          this.joint(f,'Head','head',J[0]);this.joint(f,'Spine1','spine1',J[1]);this.joint(f,'Hips','hips',J[2]);
          this.joint(f,'LeftHand','lefthand',J[3]);this.joint(f,'RightHand','righthand',J[4]);
          this.joint(f,'LeftForeArm','leftforearm',J[5]);this.joint(f,'RightForeArm','rightforearm',J[6]);
          this.joint(f,'LeftLeg','leftleg',J[7]);this.joint(f,'RightLeg','rightleg',J[8]);
          const tick=Math.floor(time*8);const arcs=Math.round(7*kit.density);
          for(let i=0;i<arcs;i++){
            const from=Math.floor(noise(tick*3.1+i*1.3+key)*J.length),to=Math.floor(noise(tick*5.7+i*2.9+key)*J.length);
            if(from===to||noise(tick*1.9+i*.7)<.35)continue;
            kit.arc(J[from],J[to],kit.tick*7+i,.02*strength,i%2?SETSU.glow:SETSU.deep,strength,1,3,.3);
          }
          // The crown: rays off the hair, standing up in the charge.
          this.a.copy(J[0]).y+=.12;
          for(let ray=0;ray<8;ray++){
            const angle=ray*.785+tick*.5,r=.14+noise(tick*2.3+ray)*.16;
            this.b.copy(this.a).add(this.c.set(Math.cos(angle)*r,.1+noise(tick+ray*1.1)*.22,Math.sin(angle)*r));
            kit.arc(this.a,this.b,kit.tick*3+ray,.014*strength,SETSU.glow,.9*strength,0,2,.35);
          }
          kit.halos.add(J[1],.9,SETSU.halo,.35*strength*(.7+.3*noise(kit.tick)),GLOW,.02);
          // The flicker lights his own body, never the tile: a light volume
          // that reaches the floor draws a lit disc under him, and an
          // awakened fighter never stands on a disc. The sphere stops 0.4 m
          // above his feet - measured from the ground he stands on, or from
          // his own height off it in the air, which only ever makes it smaller.
          kit.lights.add(J[1],Math.min(2.6,J[1].y-f.group.position.y-.4),SETSU.light,.35*strength*(.6+.4*noise(kit.tick*1.7)));
          if(kit.ticked&&noise(kit.tick*.37+key)>.6)kit.painter.emit(J[Math.floor(noise(kit.tick)*9)],2,2.2,kit.tick,.009,.3,.8);
        }
      }
    }
    for(let i=this.casts.length-1;i>=0;i--){
      const c=this.casts[i],e=c.event,move=c.move,actor=fighters.get(e.actorId),age=castAge(c,time,actor,move.contacts[0]);// round 3c: the held cast clock
      const travel=move.range/(move.speed??20),limit=Math.max(move.duration,move.contacts[0]+travel);
      if(age>limit+.2||(c.ended&&time-c.ended>.15)||(!c.ended&&age<move.contacts[0]&&chargeWasCancelled(e,move.contacts[0],actor?.state,time))){kit.forget(c.trail);this.casts.splice(i,1);continue;}
      const flight=FLIGHTS.get(c.flight);
      if(!flight?.released)continue;
      const fade=c.ended?1-(time-c.ended)/.15:1;
      kit.ball(flight.position,(1.15+.2*Math.sin(time*41))*fade,salt(e.actorId)+17,NaN,SETSU.glow,SETSU.light,.75);
      this.a.copy(flight.position).addScaledVector(flight.heading,-1.6*fade);
      kit.arc(this.a,flight.position,kit.tick*9+1,.05*fade,SETSU.deep,fade,2,4,.24);
      for(const side of [-1,1]){this.b.copy(flight.position).addScaledVector(flight.heading,-.7).add(this.c.set(-flight.heading.z*side*.4,.18,flight.heading.x*side*.4));kit.arc(this.b,flight.position,kit.tick*9+side*3,.025*fade,SETSU.glow,.9*fade,1,3,.3);}
      kit.trail(c.trail,flight.position,fade,salt(e.actorId)+19,SETSU.glow);
    }
    kit.end();
  }
  reset(){this.casts=[];this.seen.clear();this.kit.reset();}
  dispose(){this.reset();this.kit.dispose();}
}
