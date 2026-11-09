import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {BallField} from './BallField';
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
    update(snap(5,view({x:0,y:1,z:0},{events:[{id:1,at:5,kind:'super',team:'red',x:0,y:1,z:0}]})),1000);
    expect(effects(field)).toBeGreaterThan(0);
    field.clear();expect(effects(field)).toBe(0);expect(field.root.visible).toBe(false);expect(field.ballPosition()).toBeNull();
    field.dispose();
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
