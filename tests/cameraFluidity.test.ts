import {describe,expect,it} from 'vitest';
import * as T from 'three';
import {Targeting} from '../src/game/Targeting';
import {ArenaSimulation} from '../src/game/simulation';
import {createRapierCollision} from '../src/game/rapierCollision';
import {FollowCamera} from '../src/render/FollowCamera';
import type {Fighter} from '../src/render/Fighter';
import {base} from './rigHarness';

const actor=(id:string,x=0,z=0)=>{
  const group=new T.Group();group.position.set(x,0,z);
  return {state:{...base('kenzo'),id,x,z},group,velocity:new T.Vector3()} as unknown as Fighter;
};

describe('a camera follows the intended engagement',()=>{
  it('keeps an attack on its committed target until recovery',()=>{
    const targeting=new Targeting(),self={...base('kenzo'),id:'self',action:'heavy' as const,target:'foe'};
    const foe={...base('taisei'),id:'foe',z:3},interloper={...base('konta'),id:'other',x:1,z:1};
    const hit={id:1,kind:'hit' as const,actorId:'other',targetId:'self',serverTime:1};
    expect(targeting.update([self,foe,interloper],self,[hit],1)).toBe('foe');
    expect(targeting.update([self,foe,interloper],{...self,action:'idle'},[],1.1)).toBe('other');
  });
  it('does not abandon a nearby engagement for a distant beam windup',()=>{
    const targeting=new Targeting(),self={...base('kenzo'),id:'self'};
    const foe={...base('taisei'),id:'foe',z:2},sniper={...base('taisei'),id:'sniper',z:28};
    targeting.update([self,foe,sniper],self,[],0);
    expect(targeting.update([self,foe,{...sniper,action:'special',target:'self'}],self,[],1)).toBe('foe');
  });
  it('does not hand the navigation camera to a different target',()=>{
    const camera=new T.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
    const self=actor('self'),first=actor('first',0,3),second=actor('second',-24,-8);
    for(let i=0;i<180;i++)follow.update(1/60,self,0,0,[],0,first,true);
    const before=camera.quaternion.clone();
    follow.update(1/60,self,follow.yaw,0,[],0,second,true);
    expect(T.MathUtils.radToDeg(before.angleTo(camera.quaternion)),'first frame should not cut').toBeLessThan(2);
    for(let i=0;i<240;i++)follow.update(1/60,self,follow.yaw,0,[],0,second,true);
    const error=follow.yaw;
    expect(Math.abs(Math.atan2(Math.sin(error),Math.cos(error)))).toBeLessThan(.03);
  });
});

describe('the player remains readable at walls with scenery cutaway',()=>{
  it.each(['middle','wall','corner','drive'] as const)('%s keeps full-body framing and continuous camera travel',async name=>{
    const material=new T.MeshBasicMaterial(),walls:T.Mesh[]=[];
    for(const [x,z,hx,hz] of [[-7.5,0,1,9],[7.5,0,1,9],[0,-8,8.5,1],[0,8,8.5,1]]){
      const wall=new T.Mesh(new T.BoxGeometry(hx*2,12,hz*2),material);
      wall.position.set(x,6,z);wall.updateMatrixWorld(true);walls.push(wall);
    }
    const collision=await createRapierCollision('proving-hall');
    const sim=new ArenaSimulation({roomMode:'training',trainingBot:false,stage:'proving-hall',collision,seed:17017});
    try{
      const spawn=name==='wall'?[5.7,0,5.7,2.2]:name==='corner'?[5.9,6.4,4.1,4.6]:[0,0,0,2.5];
      sim.addPlayer('self','kenzo','Self',false,{x:spawn[0],y:0,z:spawn[1]});
      sim.addPlayer('foe','taisei','Foe',true,{x:spawn[2],y:0,z:spawn[3]});sim.startMatch();
      const self=actor('self'),foe=actor('foe');
      const camera=new T.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);
      let previous:T.Vector3|undefined,worst=0;
      for(let i=0;i<900;i++){
        const s=sim.getPlayer('self')!,f=sim.getPlayer('foe')!;
        if(!s.alive||!f.alive)break;
        const yaw=Math.atan2(f.x-s.x,f.z-s.z);
        sim.submitInput('self',{seq:i,moveX:name==='wall'?0:name==='drive'?1:name==='corner'?.7:.5,
          moveZ:name==='wall'?Math.cos(i/55):name==='drive'?1:name==='corner'?.7:.8,
          attack:name!=='drive'&&i%45===0?'light':undefined,yaw,targetId:'foe'});
        sim.step();sim.snapshot(true);
        for(const body of [self,foe]){const state=sim.getPlayer(body.state.id)!;body.state=state;body.group.position.set(state.x,state.y,state.z);}
        // Camera azimuth is user input; target bearing belongs only to attack aim.
        follow.update(1/60,self,0,0,walls,0,foe,true);
        if(i>=180){
          expect(Math.abs(self.group.position.x)).toBeLessThanOrEqual(6.5);
          expect(Math.abs(self.group.position.z)).toBeLessThanOrEqual(7);
          for(const y of [.05,1.85]){
            const point=self.group.position.clone().add(new T.Vector3(0,y,0)).project(camera);
            expect(Math.abs(point.x)).toBeLessThan(.95);expect(Math.abs(point.y)).toBeLessThan(.95);
          }
          expect(camera.position.distanceTo(self.group.position)).toBeGreaterThan(4);
          if(previous)worst=Math.max(worst,camera.position.distanceTo(previous)*60);
        }
        previous=camera.position.clone();
      }
      expect(worst,'following travel should not teleport the shot').toBeLessThan(30);
    }finally{sim.dispose();walls.forEach(w=>w.geometry.dispose());material.dispose();}
  });
});
