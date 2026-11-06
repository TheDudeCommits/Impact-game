import {describe,expect,it,vi} from 'vitest';
import * as THREE from 'three';
import {FollowCamera} from '../src/render/FollowCamera';
import type {Fighter} from '../src/render/Fighter';
import {base} from './rigHarness';

// Captured Mizuhiki/Minase heavy silhouettes from camera-diagnostic-r2. This
// geometric/controller regression is not a substitute for actual camera review.
const capsuleSelf={x:.12427516147400745,z:.6062245006985637,low:-.020816044862148178,high:1.6707663662302175,radius:.3,spread:.456939883926527};
const capsuleFoe={x:.006542608098870618,z:.1691602359689198,low:.025060431826026602,high:1.667951977551977,radius:.3,spread:.45057670753496476};
type Internal={anchor:THREE.Vector3;boom:number;pull:{value:number};lockBlend:number;shoulder:number;lensY:number;lookPitch:number;tanV:number;tanH:number;foeBox:typeof capsuleFoe;blockers:typeof capsuleSelf[];blockerCount:number;heading:number;yaw:number;offAxis:number;dodgeGoal:number;dodgeWait:number;dodge:{value:number;velocity:number};coverage:(heading:number,pitch:number)=>number;clearView:(dt:number,base:number,pitch:number,close?:boolean)=>void;brain:{goal:number};};
const inside=(f:FollowCamera)=>f as unknown as Internal;
function diagnostic(side=1){
  const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera),c=inside(follow);
  const yaw=2.247329164296668,anchor=new THREE.Vector3(-.029068226822516863,.009999195077458722,1.1496323878584178);
  const dx=-3.6583166502485636-anchor.x,dz=2.7171231423379414-anchor.z;
  Object.assign(c,{boom:-(dx*Math.sin(yaw)+dz*Math.cos(yaw)),shoulder:(-dx*Math.cos(yaw)+dz*Math.sin(yaw))*side,
    lensY:1.6839748789352798,lookPitch:Math.asin(-.14560840928640115),lockBlend:1,
    tanV:Math.tan(25*Math.PI/180),tanH:Math.tan(25*Math.PI/180)*16/9,
    foeBox:{...capsuleFoe,x:capsuleFoe.x*side},blockers:[{...capsuleSelf,x:capsuleSelf.x*side}],blockerCount:1,
    yaw:yaw*side,heading:2.232282110032568*side,offAxis:-1.0256127018634005*side});
  c.anchor.copy(anchor);c.anchor.x*=side;
  return {follow,c,goal:2.0907005356301296*side};
}
const actor=(id:string,z:number)=>{const group=new THREE.Group();group.position.z=z;return{state:{...base('mizuhiki'),id,z},group,velocity:new THREE.Vector3()} as unknown as Fighter;};

describe('close dynamic melee camera coverage',()=>{
  it.each([1,-1])('responds before strong self-fade and selects the measured clear direction on shoulder %s',side=>{
    const {c,goal}=diagnostic(side),before=c.coverage(goal,0);
    expect(before).toBeGreaterThan(.2);expect(before).toBeLessThan(.4);
    // The wrong sign demonstrably worsens this same pair of silhouettes.
    expect(c.coverage(goal+side*.3,0)).toBeGreaterThan(before);
    c.clearView(1/60,goal,0,true);
    expect(c.dodgeGoal*side).toBeLessThan(0);
    expect(c.coverage(goal+c.dodgeGoal,0)).toBeLessThan(before);
    expect(Math.abs(c.offAxis+c.dodgeGoal)).toBeLessThanOrEqual(1.4);
    expect(Math.abs(c.dodgeGoal)).toBeLessThanOrEqual(.72);
  });
  it.each([1,-1])('no longer swings side-on for a close duel or a windup: the view stays where it was, near the line to the opponent (shoulder %s)',side=>{
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);follow.mode='dynamic';follow.cinematics=false;
    const me=actor('self',0),foe=actor('foe',1.6);let input=side*.9;
    for(let n=0;n<240;n++){follow.update(1/60,me,input,0,[],0,foe,true);input=follow.inputYaw;}
    expect(camera.userData.rig.side*side).toBeGreaterThan(.99);
    // Fifty degrees off the line, where the player had it: inside the window, so left there (over the right shoulder
    // to the hundredth of a radian; the lens crossing to the left one settles a few degrees on) - not turned out to 72.
    expect(Math.abs(follow.yaw-side*.9)).toBeLessThan(side>0?.02:.25);expect(Math.abs(follow.yaw)).toBeLessThan(1.1);
    for(const body of [me,foe])for(const height of [.05,1.75]){
      const point=body.group.position.clone().add(new THREE.Vector3(0,height,0)).project(camera);
      expect(Math.abs(point.x)).toBeLessThan(1);expect(Math.abs(point.y)).toBeLessThan(1);
    }
    expect(camera.userData.rig.cover,'the opponent in clear view').toBeLessThan(.1);
    me.state.action='heavy';
    const beforeWindup=follow.yaw;let largestStep=0;
    for(let n=0;n<32;n++){
      const previous=follow.yaw;follow.update(1/60,me,follow.inputYaw,0,[],0,foe,true);
      largestStep=Math.max(largestStep,Math.abs(follow.yaw-previous));
    }
    expect(Math.abs(follow.yaw-beforeWindup),'the windup does not turn the view').toBeLessThan(.02);
    expect(largestStep).toBeLessThan(.005);
    const previous=follow.inputYaw;
    follow.update(1/60,me,previous-side*.2,0,[],0,foe,true);
    expect((follow.inputYaw-previous)*side).toBeLessThan(-.18);
  });
  it('from straight behind, a close duel is turned to no further than shows the opponent past the player\'s own back',()=>{
    const camera=new THREE.PerspectiveCamera(50,16/9,.1,200),follow=new FollowCamera(camera);follow.mode='dynamic';follow.cinematics=false;
    const me=actor('self',0),foe=actor('foe',1.6);let input=0;
    for(let n=0;n<300;n++){follow.update(1/60,me,input,0,[],0,foe,true);input=follow.inputYaw;}
    // Well inside the lock-on composition's own 46-57 degrees, and the simulation's aim cone (80).
    expect(Math.abs(follow.yaw)).toBeGreaterThan(.12);expect(Math.abs(follow.yaw)).toBeLessThan(.85);
    expect(camera.userData.rig.cover).toBeLessThan(.2);
    for(const body of [me,foe])for(const height of [.05,1.75]){
      const point=body.group.position.clone().add(new THREE.Vector3(0,height,0)).project(camera);
      expect(Math.abs(point.x)).toBeLessThan(1);expect(Math.abs(point.y)).toBeLessThan(1);
    }
  });
  it('keeps an inherited dodge inside the same homing cone as the approach framing widens',()=>{
    const {c}=diagnostic();c.offAxis=1.25;c.dodgeGoal=.36;c.dodge.value=.36;c.coverage=()=>.12;
    c.clearView(1/60,1.25,0,true);
    expect(c.offAxis+c.dodgeGoal).toBeLessThanOrEqual(1.4);
    // The follower still eases; it is never directly snapped to the cap.
    expect(c.dodge.value).toBeGreaterThan(.3);
  });
  it('takes a material coverage improvement when full clearance is impossible inside the cone',()=>{
    const {c}=diagnostic();c.offAxis=1.09;c.yaw=0;c.heading=0;
    c.coverage=heading=>Math.max(.235,.33-heading*.32);
    c.clearView(1/60,0,0,true);
    expect(c.dodgeGoal).toBeGreaterThan(.24);
    expect(c.coverage(c.dodgeGoal,0)).toBeLessThan(.33*.75);
    expect(c.coverage(c.dodgeGoal,0)).toBeGreaterThan(.1);
    expect(c.offAxis+c.dodgeGoal).toBeLessThanOrEqual(1.4);
  });
  it('keeps the old threshold outside close dynamic melee',()=>{
    const {c,goal}=diagnostic();c.clearView(1/60,goal,0);
    expect(c.dodgeGoal).toBe(0);expect(c.dodge.value).toBe(0);
  });
  it('a lagging rendered view requests clearance below the entry threshold, then waits for the already-clear goal',()=>{
    const {c}=diagnostic();c.offAxis=0;c.yaw=.6;c.heading=.5;
    // Actual view is obstructed; future base is below entry but not yet clear.
    c.coverage=heading=>Math.max(0,.16+heading*.5);
    c.clearView(1/60,0,0,true);
    const goal=c.dodgeGoal;expect(goal).toBeLessThan(0);expect(c.coverage(goal,0)).toBeLessThan(.1);
    for(let n=0;n<90;n++)c.clearView(1/60,0,0,true);
    expect(c.dodgeGoal,'no repeated outward orbit while the view catches up').toBe(goal);
    // A clear heading alone cannot release while the drawn yaw still lags.
    c.heading=goal;c.clearView(.2,0,0,true);expect(c.dodgeGoal).toBe(goal);
    // Both are now clear; step back only if that intermediate view is clear.
    c.yaw=goal;c.coverage=()=>0;c.clearView(.2,0,0,true);
    expect(Math.abs(c.dodgeGoal)).toBeLessThan(Math.abs(goal));
  });
  it.each(['hitstop','hold'] as const)('does not replan or advance the dodge during %s, then resumes after the hold',freeze=>{
    const follow=new FollowCamera(new THREE.PerspectiveCamera(50,16/9,.1,200));follow.mode='dynamic';follow.cinematics=false;
    const me=actor('self',0),foe=actor('foe',1.4),c=inside(follow);
    for(let n=0;n<180;n++)follow.update(1/60,me,follow.inputYaw,0,[],0,foe,true);
    c.dodgeGoal=.18;c.dodge.value=.06;c.dodge.velocity=.1;
    const spy=vi.spyOn(c,'clearView');
    if(freeze==='hitstop')me.state.hitstop=true;else follow.holdFor(1);
    const before={...c.dodge},goal=c.dodgeGoal;
    for(let n=0;n<3;n++)follow.update(1/60,me,follow.inputYaw,0,[],0,foe,true);
    expect(spy).not.toHaveBeenCalled();expect(c.dodge).toEqual(before);expect(c.dodgeGoal).toBe(goal);
    me.state.hitstop=false;
    for(let n=0;n<60;n++)follow.update(1/60,me,follow.inputYaw,0,[],0,foe,true);
    expect(spy).toHaveBeenCalled();expect(spy.mock.calls.some(call=>call[3]===true)).toBe(true);
  });
  it('early policy applies during grounded approach and windup, leaving distant and airborne framing unchanged',()=>{
    const follow=new FollowCamera(new THREE.PerspectiveCamera(50,16/9,.1,200));follow.mode='dynamic';follow.cinematics=false;
    const me=actor('self',0),foe=actor('foe',2.5),c=inside(follow),spy=vi.spyOn(c,'clearView');
    for(let n=0;n<180;n++)follow.update(1/60,me,follow.inputYaw,0,[],0,foe,true);
    expect(spy.mock.lastCall?.[3]).toBe(true);
    me.state.action='heavy';follow.update(1/60,me,follow.inputYaw,0,[],0,foe,true);expect(spy.mock.lastCall?.[3]).toBe(true);
    foe.state.grounded=false;follow.update(1/60,me,follow.inputYaw,0,[],0,foe,true);expect(spy.mock.lastCall?.[3]).toBe(false);
    foe.state.grounded=true;foe.group.position.z=4;follow.update(1/60,me,follow.inputYaw,0,[],0,foe,true);expect(spy.mock.lastCall?.[3]).toBe(false);
  });
});


describe('close manual fade eligibility',()=>{
  function duel(){
    const follow=new FollowCamera(new THREE.PerspectiveCamera(50,16/9,.1,200));follow.mode='dynamic';follow.cinematics=false;
    const me=actor('self',0),foe=actor('foe',2.5);
    const step=(locked=true)=>follow.update(1/60,me,follow.inputYaw,0,[],0,foe,locked);
    for(let i=0;i<180;i++)step();
    return {follow,me,foe,step};
  }
  it('applies only to locked grounded manual attacks and clears immediately outside that scope',()=>{
    const {follow,me,foe,step}=duel();
    expect(follow.fader.closeManual).toBe(0);
    for(const action of ['light','heavy','special'] as const){me.state.action=action;step();expect(follow.fader.closeManual).toBe(1);}
    step(false);expect(follow.fader.closeManual).toBe(0);
    step();expect(follow.fader.closeManual).toBe(1);
    me.state.grounded=false;step();expect(follow.fader.closeManual).toBe(0);
    me.state.grounded=true;foe.group.position.z=2.8;step();expect(follow.fader.closeManual).toBeCloseTo(.5,5);
    foe.group.position.z=3.01;step();expect(follow.fader.closeManual).toBe(0);
    foe.group.position.z=2.5;me.state.action='ultimate';step();expect(follow.fader.closeManual).toBe(0);
    me.state.action='heavy';follow.mode='lockon';step();expect(follow.fader.closeManual).toBe(0);
    follow.mode='free';step();expect(follow.fader.closeManual).toBe(0);
  });
  it('retains first-contact floor-held hitstop, but not a truly airborne target',()=>{
    const {follow,me,foe,step}=duel();me.state.action='heavy';step();
    foe.state.grounded=false;foe.state.hitstop=true;foe.state.action='launched';me.state.hitstop=true;
    step();expect(follow.fader.closeManual).toBe(1);
    foe.group.position.y=.4;step();expect(follow.fader.closeManual).toBe(0);
    foe.group.position.y=0;foe.state.hitstop=false;step();expect(follow.fader.closeManual).toBe(0);
    foe.state.grounded=true;step();expect(follow.fader.closeManual).toBe(1);
    follow.reset();expect(follow.fader.closeManual).toBe(0);
  });
});
