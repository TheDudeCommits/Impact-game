import {describe,expect,it} from 'vitest';
import * as THREE from 'three';
import {BallField} from './BallField';
import {CombatTimeline} from '../CombatTimeline';
import {BallMatch} from '../../game/ball/BallMatch';
import {stepBall} from '../../game/ball/physics';
import {BALL_STAGE,ballOf,type BallModeId,type BallState} from '../../game/ball/model';
import {createRapierCollision} from '../../game/rapierCollision';

/** How far the drawn ball strays from the true one, frame by frame, through the page's own path: a real match against
 *  bots, its snapshots into the timeline (on this device: every tick, on a jittery 60 Hz timer; online: 30 a second
 *  over a jittery link), the presented frame into the ball field. The truth is the room's ball run on to the frame's
 *  time. Measured while the ball flies (over 6 m/s): the mean and worst miss (m) and the frame-to-frame lurch (how
 *  far one frame's step differs from the true step, m). */
type Path='local'|'online';
async function measure(mode:BallModeId,path:Path,hz:number,seconds:number,seed=7){
  const collision=await createRapierCollision(BALL_STAGE[mode]);
  const m=new BallMatch(mode,{collision,seed,access:'bots',intro:false} as never);
  m.add('p','konta','P',false,'red');m.pilot('p');m.start();
  const field=new BallField(new THREE.Scene()),camera=new THREE.PerspectiveCamera(),timeline=new CombatTimeline({delayMs:path==='local'?1000/60:60});
  let rnd=seed;const random=()=>((rnd=(rnd*16807)%2147483647)/2147483647);
  const ticks:BallState[]=[];let tick=0;
  const truth=(t:number)=>{const k=Math.min(ticks.length-1,Math.floor(t*60+1e-6)),b={...ticks[k]};if(!b.held)for(let left=t-k/60;left>1e-6;left-=1/60)stepBall(mode,b,Math.min(1/60,left));return b;};
  // The room's ticks: on this device a 60 Hz timer that wanders 4 ms; online the server's own steady 60 Hz.
  const tickAt=(k:number)=>k*1000/60+(path==='local'?(random()-.5)*8:0);
  const inbox:{at:number;snap:ReturnType<BallMatch['snapshot']>}[]=[];
  let localClock=0,shown=0;const misses:number[]=[],lurches:number[]=[];let prevDrawn:THREE.Vector3|null=null,prevTruth:{x:number;y:number;z:number}|null=null;
  const frameMs=1000/hz;
  for(let w=0;w<seconds*1000;w+=frameMs){
    while(tickAt(tick+1)<=w){
      m.step(1/60);tick++;const snap=m.snapshot(true);ticks[Math.round(snap.serverTime*60)]={...ballOf(snap)!.ball};
      if(path==='local')timeline.push(snap,tickAt(tick));
      else if(tick%2===0)inbox.push({at:snap.serverTime*1000+50+random()*14,snap});
    }
    for(let i=inbox.length-1;i>=0;i--)if(inbox[i].at<=w){timeline.push(inbox[i].snap,inbox[i].at);inbox.splice(i,1);}
    let presented;
    if(path==='local'){const newest=timeline.newest??0;localClock=Math.min(newest,Math.max(newest-3/60,localClock+frameMs/1000));presented=timeline.at(localClock-1/60);}
    else presented=timeline.sample(w);
    if(!presented)continue;
    field.update(presented.snapshot,'p',camera,frameMs/1000,w);
    const view=ballOf(presented.snapshot),drawn=field.ballPosition();
    if(!view||!drawn||view.phase!=='live'){prevDrawn=null;continue;}
    const t=truth(presented.time),speed=Math.hypot(t.vx,t.vy,t.vz);
    if(speed>6&&!t.held){
      shown++;misses.push(Math.hypot(drawn.x-t.x,drawn.y-t.y,drawn.z-t.z));
      if(prevDrawn&&prevTruth)lurches.push(Math.hypot(drawn.x-prevDrawn.x-(t.x-prevTruth.x),drawn.y-prevDrawn.y-(t.y-prevTruth.y),drawn.z-prevDrawn.z-(t.z-prevTruth.z)));
      prevDrawn=drawn.clone();prevTruth={x:t.x,y:t.y,z:t.z};
    }else prevDrawn=null;
  }
  collision.dispose?.();
  const q=(a:number[],p:number)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.min(s.length-1,Math.floor(p*s.length))]??0;};
  const mean=(a:number[])=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);
  return {mode,path,hz,frames:shown,missMean:+mean(misses).toFixed(3),missP95:+q(misses,.95).toFixed(3),missMax:+q(misses,1).toFixed(3),lurchMean:+mean(lurches).toFixed(3),lurchP95:+q(lurches,.95).toFixed(3),lurchMax:+q(lurches,1).toFixed(3)};
}

describe('the drawn ball',()=>{
  // Before the fix (the ball run on from when its snapshot reached the page): 1.9 m behind on average and up to 4 m on
  // this device at 60 Hz, 0.68 m online. Misses left at a touch are the check's own: its truth does not know the touch.
  it('is where the room has it at the frame\'s time, on this device and online, at 60 to 144 Hz',async()=>{
    const rows=[await measure('goal-rush','local',60,40),await measure('goal-rush','online',60,40),await measure('sky-spike','local',120,40),await measure('sky-spike','online',144,40)];
    for(const r of rows){expect(r.frames,JSON.stringify(r)).toBeGreaterThan(100);expect(r.missMean,JSON.stringify(r)).toBeLessThan(.03);expect(r.missP95,JSON.stringify(r)).toBeLessThan(.08);expect(r.lurchP95,JSON.stringify(r)).toBeLessThan(.08);}
  },240_000);
});
