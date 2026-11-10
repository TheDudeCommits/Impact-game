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

/** The page's own touch online, forecast (game/ball/touchForecast) and drawn at once. A ball rolls at the page's
 *  fighter (stood at the centre spot); on the frame the drawn ball is two metres out the page strikes it: it forecasts
 *  the strike from where it drew the ball, and the room - which plays the press `lag` s later in its own time (the
 *  page's view lag, as BallMatch SEEN does) - puts the ball back there and strikes it so (`same`), a little otherwise
 *  (`off`: 12 degrees wide and 10% faster), or not at all (`refused`: somebody else's touch got there first). Snapshots
 *  reach the page thirty a second over a jittery link, through the real timeline and field, as `measure` has them. What
 *  is measured: the frames from the press to the ball leaving, the worst lurch (how far one frame's step differs from
 *  the last's, m - a snap is metres), how far the page's forecast was off when the room's word came, and the ball back
 *  where the room has it at the frame's own time once the lead is eased off. */
async function touchOnline(outcome:'same'|'off'|'refused',lag=.22,seed=5){
  const mode:BallModeId='goal-rush',collision=await createRapierCollision(BALL_STAGE[mode]);
  const m=new BallMatch(mode,{collision,seed,access:'bots',intro:false,practice:true} as never);
  m.add('p','konta','P',false,'red');m.start();
  for(let i=0;i<200&&ballOf(m.snapshot())!.phase!=='live';i++)m.step(1/60);
  const template=m.snapshot(true);collision.dispose?.();
  const field=new BallField(new THREE.Scene()),camera=new THREE.PerspectiveCamera(),timeline=new CombatTimeline({delayMs:60});
  let rnd=seed;const random=()=>((rnd=(rnd*16807)%2147483647)/2147483647);
  // The room's ball, tick by tick: rolling in along the floor from 14 m out at 15 m/s.
  const r=.82,room:BallState={...ballOf(template)!.ball,x:.4,y:r,z:14,vx:0,vy:0,vz:-15,sx:0,sy:0,sz:0,held:false,heat:0,lastId:'bot',lastTeam:'blue',shot:null,super:false,frozenUntil:0,clash:0};
  const t0=template.serverTime,ticks:BallState[]=[];let tick=0,pressAt=-1,struck:BallState|null=null,strikeAt=Infinity;
  const snap=(t:number,b:BallState)=>({...template,serverTime:t,events:[],ball:{...ballOf(template)!,phase:'live',ball:{...b}}}) as typeof template;
  const inbox:{at:number;s:typeof template}[]=[],drawn:THREE.Vector3[]=[],shown:number[]=[];
  let leftAt=-1;
  for(let w=0;w<4000;w+=1000/60){
    while((tick+1)*1000/60<=w){
      tick++;const t=t0+tick/60;
      if(t>=strikeAt&&struck){if(outcome!=='refused')Object.assign(room,struck);struck=null;}
      else stepBall(mode,room,1/60);
      ticks[tick]={...room};
      if(tick%2===0)inbox.push({at:w+50+random()*14,s:snap(t,room)});
    }
    for(let i=inbox.length-1;i>=0;i--)if(inbox[i].at<=w){timeline.push(inbox[i].s,inbox[i].at);field.heard(inbox[i].s);inbox.splice(i,1);}
    const presented=timeline.sample(w);if(!presented)continue;
    field.update(presented.snapshot,'p',camera,1/60,w);
    const p=field.ballPosition();if(!p)continue;
    drawn.push(p.clone());shown.push(presented.time);
    if(pressAt<0&&p.z<2.4&&p.z>0){
      // The press: the strike the page forecasts (up the pitch at 24 m/s), from where it drew the ball.
      pressAt=drawn.length-1;const from=field.drawnState()!,v={vx:3,vy:4,vz:24};
      field.forecastTouch({ball:{...from,...v,lastId:'p',lastTeam:'red',shot:'power'},kind:'strike',room:presented.time+lag});
      const off=outcome==='off'?{vx:v.vz*Math.sin(.21)*1.1+v.vx,vy:v.vy*1.1,vz:v.vz*Math.cos(.21)*1.1}:v;
      struck={...from,...off,lastId:outcome==='refused'?'bot':'p',lastTeam:'red',shot:'power'};strikeAt=presented.time+lag;
    }
    if(pressAt>=0&&leftAt<0&&drawn.length-1>pressAt){const a=drawn[drawn.length-2],b=drawn[drawn.length-1];if(b.z-a.z>.15)leftAt=drawn.length-1-pressAt;}
  }
  // The ball's pace frame to frame (m/s, over the frame's own step of the presented clock, so the clock's own unevenness
  // is not counted) and how much it changes from one frame to the next: a flight's own is gravity's 0.2 m/s; a blend
  // shows as more; a snap as tens.
  let lurch=0;
  const pace=(k:number)=>{const a=drawn[k-1],b=drawn[k],dt=Math.max(1e-3,shown[k]-shown[k-1]);return new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z).divideScalar(dt);};
  for(let k=pressAt+2;k<drawn.length&&shown[k]-shown[pressAt]<.6;k++)lurch=Math.max(lurch,pace(k).distanceTo(pace(k-1)));
  // At the end, where the room has the ball at the frame's own time (the lead eased off).
  const last=drawn.length-1,t=shown[last],k=Math.floor((t-t0)*60+1e-6),truth={...ticks[k]};
  if(!truth.held)for(let left=t-t0-k/60;left>1e-6;left-=1/60)stepBall(mode,truth,Math.min(1/60,left));
  const end=Math.hypot(drawn[last].x-truth.x,drawn[last].y-truth.y,drawn[last].z-truth.z);
  return {outcome,leftAfter:leftAt,lurch:+lurch.toFixed(3),end:+end.toFixed(3),forecasts:field.forecasts.slice()};
}

/** The other side's shot at the page's fighter, put back by the room into the page's time as it comes within
 *  reach (BallMatch SEEN meetSeen: from then on the room's ball is where the page drew it `lag` s before). Drawn as the
 *  snapshots have it, the ball hopped back the lag's worth of flight and came again; drawn through it (BallField
 *  `rewound`), the page's ball flies on as it was. The worst lurch (pace change frame to frame, m/s) and, after the
 *  put-back, how far the drawn ball is from the flight the page was drawing (the one the room now judges its guard on). */
async function rewindOnline(lag=.22,seed=5){
  const mode:BallModeId='goal-rush',collision=await createRapierCollision(BALL_STAGE[mode]);
  const m=new BallMatch(mode,{collision,seed,access:'bots',intro:false,practice:true} as never);
  m.add('p','konta','P',false,'red');m.start();
  const template=m.snapshot(true);collision.dispose?.();
  const field=new BallField(new THREE.Scene()),camera=new THREE.PerspectiveCamera(),timeline=new CombatTimeline({delayMs:60});
  const me=new THREE.Vector3(.4,0,-6);field.bodyOf=id=>id==='p'?me:undefined;field.viewLag=lag;
  let rnd=seed;const random=()=>((rnd=(rnd*16807)%2147483647)/2147483647);
  const room:BallState={...ballOf(template)!.ball,x:.4,y:.82,z:14,vx:0,vy:0,vz:-15,sx:0,sy:0,sz:0,held:false,heat:0,lastId:'bot',lastTeam:'blue',shot:'power',super:false,frozenUntil:0,clash:0};
  const t0=template.serverTime,orig:BallState[]=[{...room}];let tick=0,rewoundAt=-1;
  const snap=(t:number,b:BallState)=>({...template,serverTime:t,events:[],ball:{...ballOf(template)!,phase:'live',ball:{...b}}}) as typeof template;
  const inbox:{at:number;s:typeof template}[]=[],drawn:THREE.Vector3[]=[],shown:number[]=[];
  for(let w=0;w<2500;w+=1000/60){
    while((tick+1)*1000/60<=w){
      tick++;const t=t0+tick/60,o={...orig[tick-1]};stepBall(mode,o,1/60);orig[tick]=o;
      // (The room's ball: its own flight until it comes within reach of the page's fighter, then the flight a lag back.)
      if(rewoundAt<0&&o.z<me.z+5)rewoundAt=tick;
      const b=rewoundAt<0?o:orig[Math.max(0,tick-Math.round(lag*60))];
      if(tick%2===0)inbox.push({at:w+50+random()*14,s:snap(t,b)});
    }
    for(let i=inbox.length-1;i>=0;i--)if(inbox[i].at<=w){timeline.push(inbox[i].s,inbox[i].at);field.heard(inbox[i].s);inbox.splice(i,1);}
    const presented=timeline.sample(w);if(!presented)continue;
    field.update(presented.snapshot,'p',camera,1/60,w);
    const p=field.ballPosition();if(p){drawn.push(p.clone());shown.push(presented.time);}
  }
  const pace=(k:number)=>{const a=drawn[k-1],b=drawn[k],dt=Math.max(1e-3,shown[k]-shown[k-1]);return new THREE.Vector3(b.x-a.x,b.y-a.y,b.z-a.z).divideScalar(dt);};
  let lurch=0,off=0;
  for(let k=2;k<drawn.length;k++){
    const t=shown[k];if(t<t0+.3||t>t0+rewoundAt/60+.5)continue;
    lurch=Math.max(lurch,pace(k).distanceTo(pace(k-1)));
    const i=Math.floor((t-t0)*60+1e-6),o={...orig[i]};for(let left=t-t0-i/60;left>1e-6;left-=1/60)stepBall(mode,o,Math.min(1/60,left));
    if(t>t0+rewoundAt/60)off=Math.max(off,Math.hypot(drawn[k].x-o.x,drawn[k].y-o.y,drawn[k].z-o.z));
  }
  return {lurch:+lurch.toFixed(3),off:+off.toFixed(3)};
}

describe('the other side\'s attack put back into the page\'s time',()=>{
  it('flies on as the page was drawing it, with no hop',async()=>{
    const r=await rewindOnline();
    // (Drawn as the snapshots had it - measured with the page's lag unknown - the ball hopped back: a lurch of 95 m/s in a
    // frame, and from then on it ran 2.8 m behind the flight the room judges the guard on.)
    expect(r.lurch,JSON.stringify(r)).toBeLessThan(2);
    expect(r.off,JSON.stringify(r)).toBeLessThan(.1);
  },60_000);
});

describe('the page\'s own touch online',()=>{
  it('leaves at once, takes the room\'s word without a snap, and is back where the room has it',async()=>{
    for(const outcome of ['same','off','refused'] as const){
      const r=await touchOnline(outcome),f=r.forecasts[0];
      expect(r.leftAfter,JSON.stringify(r)).toBe(1);
      expect(f,JSON.stringify(r)).toBeDefined();
      expect(f.refused,JSON.stringify(r)).toBe(outcome==='refused');
      // (The room's word on a forecast it agrees with changes nothing; a miss is blended in at a pace, never jumped to.)
      expect(r.lurch,JSON.stringify(r)).toBeLessThan(outcome==='same'?1.2:outcome==='off'?6:25);
      if(outcome==='same'){expect(f.miss,JSON.stringify(r)).toBeLessThan(.05);expect(f.lead,JSON.stringify(r)).toBeGreaterThan(.15);}
      expect(r.end,JSON.stringify(r)).toBeLessThan(.05);
    }
  },120_000);
});

describe('the drawn ball',()=>{
  // Before the fix (the ball run on from when its snapshot reached the page): 1.9 m behind on average and up to 4 m on
  // this device at 60 Hz, 0.68 m online. Misses left at a touch are the check's own: its truth does not know the touch.
  it('is where the room has it at the frame\'s time, on this device and online, at 60 to 144 Hz',async()=>{
    const rows=[await measure('goal-rush','local',60,40),await measure('goal-rush','online',60,40),await measure('sky-spike','local',120,40),await measure('sky-spike','online',144,40)];
    for(const r of rows){expect(r.frames,JSON.stringify(r)).toBeGreaterThan(100);expect(r.missMean,JSON.stringify(r)).toBeLessThan(.03);expect(r.missP95,JSON.stringify(r)).toBeLessThan(.08);expect(r.lurchP95,JSON.stringify(r)).toBeLessThan(.08);}
  },240_000);
});
