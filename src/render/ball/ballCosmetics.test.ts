import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {BallField} from './BallField';
import {BALL_SKIN_IDS,BALL_TRAIL_IDS,GOAL_BURST_IDS,BallGear,SKIN_ANCHOR,patchBallSkin} from './ballCosmetics';
import {freshBall} from '../../game/ball/physics';
import {ITEM} from '../../game/economy/catalog';
import type {BallEvent,BallSeat,BallView} from '../../game/ball/model';
import type {GameSnapshot} from '../../game/types';

const seat=(id:string,look:BallSeat['look'],team:'red'|'blue'='red'):BallSeat=>({id,name:id,fighter:'taisei',team,bot:false,goals:0,assists:0,saves:0,shots:0,touches:0,kills:0,aces:0,blocks:0,digs:0,points:0,look});
const view=(seats:BallSeat[],o:{events?:BallEvent[];lastId?:string}={}):BallView=>({
  kind:'ball',mode:'goal-rush',phase:'live',access:'bots',round:1,hostId:null,capacity:6,fillBots:true,startsAt:null,startedAt:0,endsAt:240,phaseUntil:0,
  seats,score:{red:0,blue:0},ball:{...freshBall(),held:false,y:3,vx:20,lastId:o.lastId??null,lastTeam:'red'},clock:200,overtime:false,touchTeam:null,touches:0,rally:0,servingTeam:'red',serverId:null,
  target:0,fever:false,winner:null,reason:'',mvp:null,events:o.events??[],replay:null,rumble:false,charms:[],effects:[],practice:false,best:0,aim:null,hits:0,streak:0,bestStreak:0});
const snap=(serverTime:number,ball:BallView)=>({stage:'ball-pitch',players:[],events:[],serverTime,roomMode:'match',status:'active',winnerId:null,tick:0,ball}) as unknown as GameSnapshot;
const bodyOf=(field:BallField)=>Reflect.get(field,'bodyMaterial') as THREE.ShaderMaterial;
const alive=(field:BallField)=>(Reflect.get(field,'fx') as {alive:number}).alive;

describe('the ball modes\' gear, drawn',()=>{
  it('draws an item of the shop for every skin, trail and burst it knows, and no others',()=>{
    for(const [kind,ids] of [['ball',BALL_SKIN_IDS],['balltrail',BALL_TRAIL_IDS],['goalburst',GOAL_BURST_IDS]] as const)for(const id of ids)expect(ITEM.get(id)?.kind,id).toBe(kind);
  });
  it('recolours the ball for the page\'s own player\'s skin, and only theirs',()=>{
    const field=new BallField(new THREE.Scene()),camera=new THREE.PerspectiveCamera(),body=bodyOf(field);
    expect(body.fragmentShader).toContain('uSkinOn');expect(body.uniforms.uSkinOn).toBeTruthy();
    field.update(snap(1,view([seat('me',{ball:'ball-gold-leaf'}),seat('you',{ball:'ball-jade'},'blue')])),'me',camera,1/60,1000);
    expect(body.uniforms.uSkinOn.value).toBe(1);expect((body.uniforms.uSkinC.value as THREE.Color).getHex()).toBe(0xffd877);
    field.update(snap(1.1,view([seat('me',undefined),seat('you',{ball:'ball-jade'},'blue')])),'me',camera,1/60,1100);
    expect(body.uniforms.uSkinOn.value).toBe(0);
    // A material whose shader has moved on is left alone.
    expect(patchBallSkin(new THREE.ShaderMaterial({fragmentShader:'void main(){}'}))).toBe(false);
    expect(SKIN_ANCHOR.length).toBeGreaterThan(10);
  });
  it('colours the striker\'s trail and throws its particles off the ball while it is theirs',()=>{
    const gear=new BallGear(),team=new THREE.Color(1,0,0),v=view([seat('me',{trail:'balltrail-gold-thread'})],{lastId:'me'});
    expect(gear.trailColour(v,v.ball,team).getHex()).toBe(0xffc94a);
    expect(gear.trailColour(view([seat('me',undefined)],{lastId:'me'}),v.ball,team)).toBe(team);
    const kinds:string[]=[];
    for(let i=0;i<30;i++)gear.trail((kind)=>{kinds.push(kind);},v,v.ball,new THREE.Vector3(0,3,0),new THREE.Vector3(20,0,0),20,.62,1/30,1);
    expect(kinds.length).toBeGreaterThan(5);expect(new Set(kinds)).toEqual(new Set(['glint']));
  });
  it('bursts the scorer\'s goal burst on their goal, and nothing for a goal by someone who wears none',()=>{
    const field=new BallField(new THREE.Scene()),camera=new THREE.PerspectiveCamera();
    const goal=(id:string):BallEvent=>({id:1,at:1,kind:'goal',team:'red',actorId:id,x:0,y:1.5,z:26.5});
    const plain=new BallField(new THREE.Scene());
    field.update(snap(1,view([seat('me',{burst:'goalburst-paper-storm'})],{events:[goal('me')]})),'me',camera,1/60,1000);
    plain.update(snap(1,view([seat('me',undefined)],{events:[goal('me')]})),'me',camera,1/60,1000);
    expect(alive(field)).toBeGreaterThan(alive(plain)+50);
  });
});
