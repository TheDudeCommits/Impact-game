import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {BallField} from './BallField';
import {VfxKit} from '../vfx/VfxKit';
import type {GroundMarks} from '../vfx/GroundMarks';
import {BallArena} from './BallArena';
import {freshBall} from '../../game/ball/physics';
import {GOAL_RULES,SPIKE_RULES,type BallEvent,type BallModeId,type BallState,type BallView} from '../../game/ball/model';
import type {GameSnapshot} from '../../game/types';

// No renderer: the field is built, fed snapshots and read back, never drawn.
const view=(ball:Partial<BallState>,o:{mode?:BallModeId;events?:BallEvent[];startedAt?:number}={}):BallView=>({
  kind:'ball',mode:o.mode??'goal-rush',phase:'live',access:'bots',round:1,hostId:null,capacity:6,fillBots:true,startsAt:null,startedAt:o.startedAt??0,endsAt:240,phaseUntil:0,
  seats:[],score:{red:0,blue:0},ball:{...freshBall(),held:false,...ball},clock:200,overtime:false,touchTeam:null,touches:0,rally:0,servingTeam:'red',serverId:null,
  target:0,fever:false,winner:null,reason:'',mvp:null,events:o.events??[],replay:null,rumble:false,charms:[],effects:[],practice:false,best:0,aim:null,hits:0,streak:0,bestStreak:0});
const snap=(serverTime:number,ball?:BallView)=>({stage:ball?(ball.mode==='goal-rush'?'ball-pitch':'ball-court'):'harbor',players:[],events:[],serverTime,roomMode:'match',status:'active',winnerId:null,tick:0,...(ball?{ball}:{})}) as unknown as GameSnapshot;
const fixture=()=>{const field=new BallField(new THREE.Scene()),camera=new THREE.PerspectiveCamera();return {field,update:(s:GameSnapshot,ms:number,dt=1/60)=>field.update(s,'me',camera,dt,ms)};};
const effects=(field:BallField)=>(Reflect.get(field,'fx') as {alive:number}).alive;

describe('the ball field',()=>{
  it('draws nothing until a snapshot carries a ball, and lets go when it stops',()=>{
    const {field,update}=fixture();
    update(snap(1),1000);expect(field.root.visible).toBe(false);expect(field.ballPosition()).toBeNull();
    update(snap(1,view({x:1,y:3,z:2})),1000);expect(field.root.visible).toBe(true);expect(field.ballPosition()?.toArray()).toEqual([1,3,2]);
    update(snap(1.1),1100);expect(field.root.visible).toBe(false);expect(field.ballPosition()).toBeNull();
  });

  it('runs the ball on along its flight between snapshots, no further than 0.12 s, and blends a correction out',()=>{
    const {field,update}=fixture(),first=snap(1,view({x:1,y:3,z:2,vx:10}));
    update(first,1000);
    update(first,1050);
    const p=field.ballPosition()!;
    expect(p.x).toBeCloseTo(1.5,1);expect(p.y).toBeCloseTo(3-.5*GOAL_RULES.gravity*.05*.05,1);expect(p.y).toBeLessThan(3);expect(p.z).toBeCloseTo(2,5);
    update(first,1500);expect(field.ballPosition()!.x).toBeCloseTo(2.2,1);
    // The next snapshot lands behind where the ball is drawn: no jump on its arrival, its own place soon after.
    const drawn=field.ballPosition()!.clone();
    update(snap(1.0333,view({x:1.33,y:2.99,z:2,vx:10,vy:-.5})),1500);
    expect(field.ballPosition()!.distanceTo(drawn)).toBeLessThan(1e-6);
    update(snap(1.0333,view({x:1.33,y:2.99,z:2,vx:10,vy:-.5})),1500+120);
    expect(field.ballPosition()!.x).toBeCloseTo(1.33+10*.12,1);
  });

  it('runs on the presented clock when the frame carries the same ball under a later time',()=>{
    const {field,update}=fixture(),ball=view({x:0,y:4,z:0,vz:-8});
    update(snap(2,ball),5000);update(snap(2.05,ball),5000);
    expect(field.ballPosition()!.z).toBeCloseTo(-.4,1);
  });

  it('holds a held ball and a stopped one where the room has them',()=>{
    const {field,update}=fixture();
    const held=snap(1,view({x:0,y:SPIKE_RULES.serveHeight,z:3,vx:9,held:true},{mode:'sky-spike'}));
    update(held,1000);update(held,1100);expect(field.ballPosition()!.toArray()).toEqual([0,SPIKE_RULES.serveHeight,3]);
    const stopped=snap(2,view({x:4,y:2,z:-1,vx:20,vy:5,frozenUntil:3},{mode:'sky-spike'}));
    update(stopped,2000);update(stopped,2100);
    expect(field.ballPosition()!.x).toBeCloseTo(4,3);expect(field.ballPosition()!.y).toBeCloseTo(2,3);
  });

  it('snaps to a reset instead of flying across the pitch to it',()=>{
    const {field,update}=fixture();
    update(snap(1,view({x:12,y:1,z:20,vx:2})),1000);
    update(snap(1.033,view({x:0,y:GOAL_RULES.ballRadius,z:0,held:true})),1033);
    expect(field.ballPosition()!.toArray()).toEqual([0,GOAL_RULES.ballRadius,0]);
  });

  it('sizes and makes the ball by its mode',()=>{
    const {field,update}=fixture(),ball=Reflect.get(field,'ball') as THREE.Group;
    update(snap(1,view({y:1})),1000);expect(ball.scale.x).toBeCloseTo(GOAL_RULES.ballRadius);
    update(snap(1,view({y:1},{mode:'sky-spike',startedAt:5})),1100);expect(ball.scale.x).toBeCloseTo(SPIKE_RULES.ballRadius);
  });

  it('plays each moment once however often its snapshot repeats it, and never a stale backlog',()=>{
    const {field,update}=fixture();
    const goal:BallEvent={id:7,at:10,kind:'goal',team:'blue',x:0,y:2,z:28,value:30};
    update(snap(10.02,view({x:0,y:2,z:28},{events:[goal]})),1000);
    const after=effects(field);expect(after).toBeGreaterThan(100);
    update(snap(10.04,view({x:0,y:2,z:28.1},{events:[goal]})),1020,0);
    expect(effects(field)).toBe(after);
    const late=fixture();late.update(snap(20,view({x:0,y:2,z:0},{events:[goal]})),1000);
    expect(effects(late.field)).toBe(0);
  });

  it('lets every effect go on clear',()=>{
    const {field,update}=fixture();
    update(snap(5,view({x:0,y:1,z:0},{events:[{id:1,at:5,kind:'goal',team:'red',x:0,y:1,z:28}]})),1000);
    expect(effects(field)).toBeGreaterThan(0);
    field.clear();expect(effects(field)).toBe(0);expect(field.root.visible).toBe(false);expect(field.ballPosition()).toBeNull();
    field.dispose();
  });
});

// A touch's mark is one of the engine's drawn impacts from the shared kit's sprites (none of the ball's own
// pool of procedural cards), the pitch keeps what a match leaves on it, and the ball has a shape.
describe('the ball field: its marks, its shape, its stroke',()=>{
  const seats=[{id:'me',team:'red',fighter:'konta'},{id:'you',team:'blue',fighter:'konta'}] as unknown as BallView['seats'];
  const players=(x:number)=>[{id:'me',x,y:0,z:0,alive:true},{id:'you',x:6,y:0,z:4,alive:true}] as unknown as GameSnapshot['players'];
  const world=()=>{
    const scene=new THREE.Scene(),field=new BallField(scene),camera=new THREE.PerspectiveCamera();camera.position.set(0,6,-16);camera.updateMatrixWorld();
    const kit=VfxKit.for(scene),marks=Reflect.get(field,'marks') as GroundMarks;
    let ms=1000,t=5;
    /** A frame of the match: `events` born on it, the ball as given, my body at `x`. */
    const frame=(ball:Partial<BallState>,events:Partial<BallEvent>[]=[],o:{mode?:BallModeId;x?:number;replaying?:boolean;startedAt?:number}={})=>{
      ms+=1000/60;t+=1/60;
      const v=view({lastId:'me',lastTeam:'red',...ball},{mode:o.mode,startedAt:o.startedAt,events:events.map((e,i)=>({id:Math.round(t*1000)+i,at:t,kind:'strike',team:'red',actorId:'me',x:ball.x??0,y:ball.y??1,z:ball.z??0,...e}) as BallEvent)});
      v.seats=seats;
      field.update({...snap(t,v),players:players(o.x??0)} as GameSnapshot,'me',camera,1/60,ms,!!o.replaying);
    };
    const sprites=()=>kit.sparks.live(kit.now)+kit.dust.live(kit.now);
    return {field,kit,marks,frame,sprites,laid:()=>field.look.marks,shaper:Reflect.get(field,'shaper') as THREE.Group};
  };
  it('draws one mark a touch, sized by the shot, and none of the old layers',()=>{
    const soft=world();soft.frame({x:0,y:1,z:0,vz:12},[{kind:'strike',value:12}]);
    const plain=world();plain.frame({x:0,y:1,z:0,vz:22},[{kind:'strike',value:22}]);
    const power=world();power.frame({x:0,y:1,z:0,vz:34},[{kind:'strike',value:34}]);
    for(const w of [soft,plain,power]){expect(w.sprites()).toBe(1);expect(effects(w.field)).toBe(0);}
    // The sprite's size at the end of its growth (SparkField's record: the tenth float).
    const size=(w:ReturnType<typeof world>,pool:'sparks'|'dust')=>(Reflect.get(w.kit[pool],'data') as Float32Array)[9];
    expect(size(soft,'dust')).toBeLessThan(size(plain,'sparks'));
    expect(size(plain,'sparks')).toBeLessThan(size(power,'sparks'));
    // A SUPER SHOT's is the biggest: its blast and the shockwave round it.
    const big=world();big.frame({x:0,y:1,z:0,vz:40},[{kind:'super'}]);
    expect(big.sprites()).toBe(2);expect(effects(big.field)).toBe(0);
    expect(size(big,'sparks')).toBeGreaterThan(size(power,'sparks')*1.5);
  });
  it('leaves a guard, a clash, a post and a kill one mark each',()=>{
    for(const [mode,e,most] of [['goal-rush',{kind:'save',text:'SAVE'},1],['goal-rush',{kind:'perfect',text:'PERFECT GUARD'},2],['goal-rush',{kind:'clash',targetId:'you'},1],['goal-rush',{kind:'post',value:30},1],
      ['sky-spike',{kind:'kill',value:1},1],['sky-spike',{kind:'point',value:1},1],['goal-rush',{kind:'wipeout',targetId:'you'},1],['goal-rush',{kind:'demo',targetId:'you'},1]] as const){
      const w=world();w.frame({x:0,y:1,z:0,vz:20},[e as Partial<BallEvent>],{mode});
      expect(w.sprites(),e.kind).toBeGreaterThanOrEqual(1);expect(w.sprites(),e.kind).toBeLessThanOrEqual(most);expect(effects(w.field),e.kind).toBe(0);
    }
  });
  it('remembers on the pitch: a scorch, a dent, a skid, where a goal was struck from - and forgets with the match',()=>{
    const w=world();
    w.frame({x:2,y:1,z:3,vz:40,super:true},[{kind:'super'}]);expect(w.laid()).toBe(1);
    expect(w.marks.mesh.visible).toBe(true);
    // A goal: the stamp where its scorer last struck the ball (the SUPER SHOT above).
    w.frame({x:0,y:2,z:28,held:true},[{kind:'goal',z:28}]);expect(w.laid()).toBe(1);
    const again=world();
    again.frame({x:2,y:1,z:3,vz:30},[{kind:'strike',value:30}]);again.frame({x:2,y:1,z:5,vz:30});
    again.frame({x:0,y:2,z:28,held:true},[{kind:'goal',z:28},{kind:'strike',value:30,x:2,z:3,at:5,id:1}]);expect(again.laid()).toBe(1);
    // A kill dents the court; a point that only drops leaves none.
    const court=world();
    court.frame({x:1,y:.5,z:4},[{kind:'point',value:1}],{mode:'sky-spike'});expect(court.laid()).toBe(0);
    court.frame({x:1,y:.5,z:4},[{kind:'kill',value:1}],{mode:'sky-spike'});expect(court.laid()).toBe(1);
    // A body on the move knocked flat leaves a skid; a replay's frames lay nothing; nothing lies off the floor of play.
    const yard=world();
    for(let i=0;i<12;i++)yard.frame({x:9,y:1,z:9},[],{x:i*.15});
    yard.frame({x:9,y:1,z:9},[{kind:'wipeout',targetId:'me',actorId:'you',team:'blue'}],{x:12*.15});expect(yard.laid()).toBe(1);
    yard.frame({x:9,y:1,z:9},[{kind:'super'}],{x:2,replaying:true});expect(yard.laid()).toBe(1);
    yard.frame({x:60,y:1,z:9},[{kind:'super'}],{x:2});expect(yard.laid()).toBe(1);
    // A new match starts on a clean floor.
    expect(yard.marks.mesh.visible).toBe(true);
    yard.frame({x:0,y:1,z:0},[],{startedAt:77});expect(yard.marks.mesh.visible).toBe(false);
  });
  it('keeps Goal Rush\'s marks inside its boards, and a goal mouth\'s inside its net',()=>{
    const w=world(),data=Reflect.get(w.marks,'data') as Float32Array;
    w.frame({x:GOAL_RULES.halfX+.6,y:1,z:3,vz:40,super:true},[{kind:'super'}]);
    w.frame({x:GOAL_RULES.halfX-4,y:1,z:-GOAL_RULES.halfZ-.8,vz:40,super:true},[{kind:'super'}]);
    w.frame({x:0,y:1,z:GOAL_RULES.halfZ+.8,vz:40,super:true},[{kind:'super'}]);
    expect(w.laid()).toBe(3);
    expect(data[0]).toBeLessThan(GOAL_RULES.halfX);expect(data[0]).toBeGreaterThan(GOAL_RULES.halfX-1);
    expect(data[16+2]).toBeGreaterThan(-GOAL_RULES.halfZ);
    expect(data[32+2]).toBeCloseTo(GOAL_RULES.halfZ+.8,5);
  });
  it('draws a power shot\'s path once: no smoke trail or streaks over its stroke',()=>{
    const fly=(value:number)=>{const w=world();let z=0;w.frame({x:0,y:2,z,vz:34},[{kind:'strike',value}]);for(let i=0;i<20;i++)w.frame({x:0,y:2,z:z+=34/60,vz:34});return effects(w.field);};
    expect(fly(25)).toBeGreaterThan(5);
    expect(fly(34)).toBe(0);
  });
  it('lays fewer marks at a time on Low',()=>{
    const w=world();w.kit.quality='low';
    for(let i=0;i<20;i++)w.frame({x:i-10,y:.5,z:4},[{kind:'kill',value:1}],{mode:'sky-spike'});
    expect(w.marks.limit).toBe(14);
    const data=Reflect.get(w.marks,'data') as Float32Array;let used=0;for(let o=3;o<data.length;o+=16)if(data[o]>-1e8)used++;
    expect(used).toBe(14);
  });
  it('flattens the ball on a blow, lengthens it at speed, and keeps its volume',()=>{
    const w=world(),volume=()=>w.shaper.scale.x*w.shaper.scale.y*w.shaper.scale.z;
    w.frame({x:0,y:3,z:0,vz:5});expect(w.shaper.scale.y).toBeCloseTo(1,5);
    w.frame({x:0,y:3,z:0,vz:34},[{kind:'strike',value:34}]);
    expect(w.shaper.scale.y).toBeLessThan(.8);expect(w.shaper.scale.x).toBeGreaterThan(1.1);expect(volume()).toBeCloseTo(1,5);
    let z=0;for(let i=0;i<40;i++)w.frame({x:0,y:3,z:z+=34/60,vz:34});
    expect(w.shaper.scale.y).toBeGreaterThan(1.1);expect(w.shaper.scale.y).toBeLessThanOrEqual(1.18+1e-6);expect(volume()).toBeCloseTo(1,5);
    // Never slimmer than it can read as a ball, however fast.
    for(let i=0;i<40;i++)w.frame({x:0,y:3,z:z+=90/60,vz:90});
    expect(w.shaper.scale.x).toBeGreaterThan(.9);
  });
  it('shows its spin in the air, and thins to its outline across the lens',()=>{
    const w=world(),lines=Reflect.get(w.field,'spinLines') as THREE.Mesh,body=Reflect.get(w.field,'bodyMaterial') as THREE.ShaderMaterial;
    let z=0;for(let i=0;i<30;i++)w.frame({x:0,y:4,z:z+=1/60,vz:1});
    expect(lines.visible).toBe(false);expect(body.transparent).toBe(false);expect(w.field.look.thin).toBe(0);
    for(let i=0;i<30;i++)w.frame({x:0,y:4,z:z+=1/60,vz:1,sy:6});
    expect(lines.visible).toBe(true);
    // Two metres in front of the lens: all outline, and no longer in the depth buffer's way.
    for(let i=0;i<40;i++)w.frame({x:0,y:6,z:-14,vz:1});
    expect(w.field.look.thin).toBeGreaterThan(.95);expect(body.transparent).toBe(true);expect(body.depthWrite).toBe(false);expect(body.uniforms.uThin.value).toBeGreaterThan(.95);
    for(let i=0;i<60;i++)w.frame({x:0,y:4,z:0,vz:1});
    expect(body.transparent).toBe(false);expect(body.depthWrite).toBe(true);
  });
  it('leaves a power shot\'s path hanging for a second, and an ordinary one\'s not at all',()=>{
    const w=world(),stroke=Reflect.get(w.field,'stroke') as {mesh:THREE.Mesh};
    let z=0;w.frame({x:0,y:2,z,vz:20},[{kind:'strike',value:20}]);for(let i=0;i<20;i++)w.frame({x:0,y:2,z:z+=20/60,vz:20});
    expect(stroke.mesh.visible).toBe(false);
    w.frame({x:0,y:2,z,vz:34},[{kind:'strike',value:34}]);for(let i=0;i<30;i++)w.frame({x:0,y:2,z:z+=34/60,vz:34});
    expect(stroke.mesh.visible).toBe(true);
    // Half a second after the ball has come to rest it still hangs; two seconds after, it is gone.
    for(let i=0;i<30;i++)w.frame({x:0,y:2,z,held:true});expect(stroke.mesh.visible).toBe(true);
    for(let i=0;i<90;i++)w.frame({x:0,y:2,z,held:true});expect(stroke.mesh.visible).toBe(false);
  });
});

describe('the ball arenas',()=>{
  const bounds=(root:THREE.Object3D,name:string)=>{const mesh=root.getObjectByName(name) as THREE.Mesh;mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox!;};
  it('puts the goals and the net where the sim has them',async()=>{
    const pitch=new BallArena('ball-pitch');await pitch.load();
    const nets=bounds(pitch.root,'Goal nets'),R=GOAL_RULES;
    expect(nets.max.z).toBeCloseTo(R.halfZ+R.goalDepth);expect(nets.min.z).toBeCloseTo(-R.halfZ-R.goalDepth);
    expect(nets.max.x).toBeCloseTo(R.goalHalfWidth);expect(nets.max.y).toBeLessThan(R.goalHeight+.2);
    const glass=bounds(pitch.root,'Ink Bowl glass');
    expect(glass.max.x).toBeCloseTo(R.halfX);expect(glass.max.z).toBeCloseTo(R.halfZ);expect(glass.max.y).toBeCloseTo(R.wall);
    expect(pitch.occluders.length).toBeGreaterThan(0);expect(pitch.occluders.every(o=>!o.visible)).toBe(true);
    pitch.dispose();
    const court=new BallArena('ball-court');await court.load();
    const net=bounds(court.root,'Sky Court net'),S=SPIKE_RULES;
    expect(net.max.x).toBeCloseTo(S.courtHalfX+S.netPost);expect(net.max.y).toBeCloseTo(S.netHeight);expect(net.max.z).toBeCloseTo(0);
    expect(court.occluders).toHaveLength(0);
    court.dispose();
  });
});
