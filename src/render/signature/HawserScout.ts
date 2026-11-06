import * as T from 'three';
import type {CombatEvent} from '../../game/types';
import type {Fighter} from '../Fighter';
import type {Flight} from '../CombatEffects';
import type {VfxKit} from '../vfx/VfxKit';
import {bodyCentre} from '../vfx/VfxKit';
import {HAWSER_MOVES,HAWSER_SWORD_SOCKETS} from '../../game/fighters/hawser';
import {SIGNATURE,involvesLocal} from './context';
import {MoveStage,STAGE,stageLook,type StageLook} from './MoveStage';
import {CastBook,Cuts,arc,hash,sheenAhead,type Gather} from './StageCraft';
const UP=new T.Vector3(0,1,0);
const clamp=(x:number)=>Math.max(0,Math.min(1,x));
/** The regiment's steel in linear light: white, a breath of the Slipped Moorings's green at its edge (Levin's steel is drawn
 *  under that green; Mizuhiki's is the cold blue). And a Fuse Lance's blast: fire with a white heart to every stroke. */
const BLADE=stageLook(0xffffff,0xdaf5e6,0x4aa874),SPEAR:StageLook={...STAGE.fire,heart:.5};
const HEAVY=HAWSER_MOVES.heavy,SPECIAL=HAWSER_MOVES.special,ULT=HAWSER_MOVES.ultimate;
const ATTACKS:ReadonlySet<string>=new Set(['light','heavy','special','ultimate']);
type Blade='LeftBlade'|'RightBlade';
export class HawserScout{
 private readonly stage:MoveStage;private readonly book=new CastBook('hawser',ULT.contacts.length);private readonly cuts=new Cuts(24,BLADE);private disposed=false;
 /** The last swing whose cuts were left in the air, by fighter: one pair a blow. */
 private swung=new Map<string,number>();
 private a=new T.Vector3();private b=new T.Vector3();private c=new T.Vector3();private m=new T.Vector3();private p=new T.Vector3();private heading=new T.Vector3();private lat=new T.Vector3();private axis=new T.Vector3();private u=new T.Vector3();private v=new T.Vector3();private side=new T.Vector3();
 constructor(scene:T.Scene,kit:Pick<VfxKit,'budget'>&Partial<VfxKit>){this.stage=MoveStage.for(scene,kit);}
 /** A blow of the Scout's that landed (the Colossus's are HawserColossus's): what it leaves, once. */
 handle(e:CombatEvent,fighters?:ReadonlyMap<string,Fighter>){
  if(this.disposed)return;
  const blow=this.book.take(e,fighters);if(!blow)return;
  const st=this.stage,{point,ground,dir,side,floor,t}=blow,tilt=e.id%2?1:-1;
  if(e.slot==='light'){
   const chain=e.chain??0;
   // The kick lands as a kick; the Overhand Cut goes straight up through them; every other cut a crescent across them.
   if(chain===2){st.burst(point,BLADE,.34,t,{dir,floor,clean:true});return;}
   if(chain===3){st.burst(point,BLADE,.6,t,{dir,floor,clean:true});this.cuts.add(point,UP,this.c.copy(dir).multiplyScalar(-.3),1.5,.11,BLADE,t,.3);this.slash(point,side,dir,.3*tilt,1.2,.07,t+.03,.26);return;}
   st.burst(point,BLADE,.3,t,{dir,floor,clean:true});this.slash(point,side,dir,.5*tilt,.8,.055,t,.2);
   return;
  }
  if(e.slot==='heavy'){
   if(e.branch){
    // An ender thrown from the heavy (the two-bladed cut, the launcher, the sweep, the cut out of the air): the
    // blast and both blades across the body.
    st.burst(point,BLADE,.75,t,{dir,floor});this.slash(point,side,dir,.75,1.7,.12,t,.34);this.slash(point,side,dir,-.75,1.7,.12,t+.03,.34);
    return;
   }
   // The Fuse Lance: it sticks, and it blows.
   // (Sized to leave the struck body readable, and the burn it leaves out before they are back on their feet in it:
   // at 1.2 with a 2.2 m shatter and 1.6 s of burning floor the blast and then the flames hid them for 0.58 s - fx_presence.)
   st.burst(point,SPEAR,1,t,{dir,floor});st.shatter(point,dir,SPEAR,1.6,t,.3);st.scar(ground,SPEAR,1,t+.05,.75);
   return;
  }
  if(e.slot==='special'){
   if(e.branch==='airSpecial'){
    // The Squib Burst: he comes down on them out of the air, and the gas goes out along the floor.
    st.burst(point,BLADE,1.9,t,{floor});st.shock(ground,BLADE,3.6,t,.45);for(let i=0;i<3;i++)this.slash(point,side,dir,(i-1)*1.05,1.9,.13,t+i*.05,.34);this.lines(ground,dir,side,t,3.2,st.n(8,4),blow.seq);
    return;
   }
   if(e.branch){st.burst(point,BLADE,1,t,{dir,floor});this.slash(point,side,dir,.2*tilt,1.6,.1,t,.3);this.slash(point,side,dir,-.9*tilt,1.3,.08,t+.04,.3);return;}
   // The Snap Line landing, on its victim and past them (he has gone through): the blast, three more cuts behind the
   // one he left, the floor shaken and the gas hanging in lines where he passed.
   const past=this.m.copy(point).addScaledVector(dir,.7);
   st.burst(this.c.copy(point).addScaledVector(dir,.4),BLADE,1.6,t,{dir,floor});
   this.slash(past,side,dir,.7,2,.15,t,.4);this.slash(past,side,dir,-.7,2,.15,t+.04,.4);this.slash(past,side,dir,.15,1.6,.1,t+.1,.34);
   for(let i=-1;i<=1;i+=2)this.cuts.add(this.c.copy(point).addScaledVector(dir,i>0?3:2.4).addScaledVector(side,i*.3).setY(point.y+i*.2),this.axis.copy(dir),undefined,2.6,.09,BLADE,t+.02,.8);
   st.shock(this.c.copy(ground).addScaledVector(dir,2.2),BLADE,3.2,t,.45);st.scar(this.c.copy(ground).addScaledVector(dir,2.6),BLADE,2.2,t+.05,2.2);
   return;
  }
  if(e.slot!=='ultimate'||e.branch)return;
  const actor=blow.actor,yaw=(actor?.state.yaw??Math.atan2(dir.x,dir.z))+blow.index*1.26;
  if(blow.index===0){st.burst(point,BLADE,.9,t,{dir,floor});this.slash(point,side,dir,.6,1.6,.11,t,.3);this.slash(point,side,dir,-.6,1.6,.11,t+.03,.3);return;}
  if(!blow.final){
   // A pass of the spin landing: a cut from the side it has come round to, brighter than the whirl's.
   this.side.set(Math.cos(yaw),0,-Math.sin(yaw));
   st.glow(point,.5,BLADE.main,.9);st.glow(point,.2,BLADE.core,1.2);this.slash(this.c.copy(point).setY(point.y+(blow.index%2?.3:-.15)),this.side,dir,blow.index%2?.7:-.7,2+.15*blow.index,.13,t,.3);
   if(blow.index===3)st.burst(point,BLADE,1,t,{dir,floor,clean:true});
   return;
  }
  // The last pass: cuts all round them, both blades crossed the width of the frame, the air broken, the floor shaken.
  for(let i=0;i<5;i++){const turn=yaw+i*Math.PI*2/5;this.side.set(Math.cos(turn),0,-Math.sin(turn));this.slash(this.c.copy(point).setY(point.y+(i%2?.25:-.2)),this.side,dir,i%2?.6:-.6,3,.15,t+i*.03,.42);}
  this.cuts.add(point,this.axis.copy(side).multiplyScalar(.74).addScaledVector(UP,.67).normalize(),undefined,4.2,.22,BLADE,t,.5);this.cuts.add(point,this.axis.copy(side).multiplyScalar(.74).addScaledVector(UP,-.67).normalize(),undefined,4.2,.22,BLADE,t+.03,.5);
  st.burst(point,BLADE,2.3,t,{dir,floor});st.shatter(point,dir,BLADE,5,t,.7);st.shock(ground,BLADE,8,t,.6);st.scar(ground,BLADE,2.6,t+.2,2);
  if(involvesLocal(e.actorId,e.targetId))SIGNATURE.screen?.impactFrame?.(.4,point);
 }
 /** One of his cuts: a crescent across the lens of whoever threw it, tipped by `lean` (radians), bowed back toward him. */
 private slash(point:T.Vector3,side:T.Vector3,dir:T.Vector3,lean:number,size:number,width:number,at:number,life:number){this.cuts.add(point,this.axis.copy(side).multiplyScalar(Math.cos(lean)).addScaledVector(UP,Math.sin(lean)).normalize(),this.p.copy(dir).multiplyScalar(-size*.2),size,width,BLADE,at,life);}
 /** Gas left in lines along the floor round where he came down. */
 private lines(ground:T.Vector3,dir:T.Vector3,side:T.Vector3,t:number,reach:number,count:number,seed:number){for(let i=0;i<count;i++){const ang=i*2.399963+seed;this.axis.copy(dir).multiplyScalar(Math.cos(ang)).addScaledVector(side,Math.sin(ang));this.cuts.add(this.c.copy(ground).addScaledVector(this.axis,reach*.55).setY(ground.y+.25+.3*hash(seed+i)),this.axis,undefined,reach*.45,.07,BLADE,t+.02*i,.7);}}
 /** One of his blades, heel to tip, on the blade's own joint (a body without one: the reach past the hand). */
 private blade(f:Fighter,name:Blade,heel:T.Vector3,tip:T.Vector3){
  const joint=(f.shownBody??f).bones?.get(name.toLowerCase()),socket=HAWSER_SWORD_SOCKETS[name];
  if(joint){heel.fromArray(socket.heel).applyMatrix4(joint.matrixWorld);tip.fromArray(socket.tip).applyMatrix4(joint.matrixWorld);return;}
  heel.copy((name==='LeftBlade'?f.handL:f.handR)??f.group.position);tip.copy(heel).addScaledVector(this.heading,.85);
 }
 /** Both blades lit: a white stroke down each. */
 private lit(f:Fighter,k:number,wide:number){for(const name of['LeftBlade','RightBlade']as const){this.blade(f,name,this.a,this.b);this.stage.streak(this.a,this.b,.05*wide,BLADE.main,.5*k);this.stage.streak(this.a,this.b,.018*wide,BLADE.core,1.1*k);
  // (A heavier move's blades carry a point of light at their tips.)
  if(wide>1.2)this.stage.glow(this.b,.09*wide,BLADE.core,.8*k);}}
 private hip(f:Fighter,sign:number,out:T.Vector3){const joint=(f.shownBody??f).joints?.get('Hips');if(joint)joint.getWorldPosition(out);else{out.copy(f.group.position);out.y+=.9;}return out.addScaledVector(this.lat,-sign*.25).setY(out.y-.1);}
 /** Gas streaming off both hips behind him: the gear's jets, as lines left in the air (out to either side and thin: from
  *  the lens behind him gas straight off his hips would be all of him). */
 private jets(f:Fighter,k:number,seed:number){
  const st=this.stage,heading=this.heading;
  for(const sign of[-1,1]){this.hip(f,sign,this.a);for(let i=0;i<3;i++){this.b.copy(this.a).addScaledVector(heading,-(1.1+1.5*k)*(.6+.4*hash(seed+i*2.3+sign))).addScaledVector(this.lat,-sign*(.35+.2*i));this.b.y+=(i-1)*.12-.1;st.streak(this.a,this.b,.03,BLADE.main,.7*k);}}
 }
 /** Two cuts left in the air at the blades' reach as a blow is thrown, once a blow: both blades, every cut is two. */
 private swing(f:Fighter,key:number,time:number,size:number,lean:number,life:number){
  if(this.swung.get(f.state.id)===key)return;this.swung.set(f.state.id,key);
  const feet=f.group.position,at=this.c.copy(feet).addScaledVector(this.heading,1.15);at.y+=1.1;
  this.slash(at,this.lat,this.heading,lean,size,.09,time,life);this.slash(this.m.copy(at).setY(at.y-.25),this.lat,this.heading,-lean,size*.88,.07,time+.03,life);
 }
 update(time:number,fighters:ReadonlyMap<string,Fighter>,flights:ReadonlyMap<string,Flight>){
  if(this.disposed)return;const st=this.stage.open(time);
  for(const f of fighters.values()){const s=f.state;if(s.fighter!=='hawser'||!s.alive||s.awakened||s.whiffedAt!==undefined||!ATTACKS.has(s.action))continue;this.pose(f,time,s.actionTime*s.actionDuration);}
  this.book.each(fighters,ULT.duration,this.gather);
  for(const flight of flights.values()){
   if(flight.fighter!=='hawser'||flight.awakened||flight.slot!=='heavy'||flight.branch||!flight.released)continue;
   // The Fuse Lance in the air: a white-hot shaft a metre long, its head burning, fire and smoke behind it.
   const at=flight.position,h=this.heading.copy(flight.heading);if(h.lengthSq()<1e-6)continue;h.normalize();const seed=Math.floor(time*30);
   st.streak(this.a.copy(at).addScaledVector(h,-1),this.b.copy(at).addScaledVector(h,.25),.05,SPEAR.main,1);st.streak(this.a.copy(at).addScaledVector(h,-.8),this.b,.02,SPEAR.core,1.4);
   st.glow(this.b,.22,SPEAR.core,.9);st.glow(this.b,.5,SPEAR.main,.5);
   for(let i=0;i<3;i++){this.a.copy(at).addScaledVector(h,-1-.5*i);this.c.copy(this.a).addScaledVector(h,-.7-.3*hash(seed+i));this.c.y+=(hash(seed+i*3.1)-.5)*.3;st.streak(this.a,this.c,.07+.03*i,SPEAR.rim,.5-.13*i);}
   st.light(this.c.copy(at).setY(at.y+.2),3.2,SPEAR,.35);
  }
  this.cuts.draw(st,time);st.close();
 }
 /** What his steel and his gear do through a move, drawn every frame it holds. */
 private pose(f:Fighter,time:number,elapsed:number){
  const st=this.stage,s=f.state,seq=s.actionSeq??0,seed=seq*4.9,yaw=s.yaw??f.group.rotation.y,heading=this.heading.set(Math.sin(yaw),0,Math.cos(yaw)),feet=f.group.position;this.lat.set(heading.z,0,-heading.x);
  const k=Math.sin(clamp(s.actionTime)*Math.PI);
  if(s.action==='light'){
   // Both blades lit through the swing; the cuts are left as the blow is thrown, whether or not it lands. The kick has none.
   const chain=s.chain??0,contact=s.actionDuration*.36;this.lit(f,k,1);
   if(chain!==2&&elapsed>=contact)this.swing(f,seq*8+chain,time,chain===3?1.5:1.05,chain%2?-.5:.5,.22);
   st.light(this.b.copy(feet).addScaledVector(heading,1).setY(feet.y+1.1),2,BLADE,.18*k);
   return;
  }
  if(s.action==='heavy'){
   if(s.branch){
    // An ender: the blades lit, and both brought across at their reach.
    const contact=s.actionDuration*.39;this.lit(f,.6+.4*k,1.3);if(elapsed>=contact)this.swing(f,seq*8+5,time,1.9,.75,.3);
    st.light(this.b.copy(feet).addScaledVector(heading,1.2).setY(feet.y+1.1),2.6,BLADE,.25*k);
    return;
   }
   // The Fuse Lance: the launcher on his right forearm lit through the wind-up, and a flash as it fires.
   const hand=f.handR?this.a.copy(f.handR):this.a.copy(feet).setY(feet.y+1.2),release=HEAVY.contacts[0];
   if(elapsed<release){const w=clamp(elapsed/release);st.glow(hand,.12+.12*w,SPEAR.main,.4+.4*w);st.glow(hand,.05+.05*w,SPEAR.core,.6+.4*w);st.light(hand,1.6+.8*w,SPEAR,.2*w);}
   else if(elapsed<release+.14){const w=1-(elapsed-release)/.14;st.glow(hand,.5,SPEAR.core,.9*w);st.streak(hand,this.b.copy(hand).addScaledVector(heading,1.6),.09,SPEAR.main,w);st.light(hand,3.4,SPEAR,.45*w);}
   return;
  }
  if(s.action==='special'){
   if(s.branch){this.lit(f,.6+.4*k,1.3);if(s.branch==='airSpecial')this.jets(f,.5+.5*k,seed);else if(elapsed>=s.actionDuration*.4)this.swing(f,seq*8+6,time,1.6,.2,.3);return;}
   const release=SPECIAL.contacts[0];
   if(elapsed<release){
    // The gear's lines fire out ahead and up as he crouches, and draw him through them; gas off both hips.
    const w=clamp(elapsed/release),line=clamp((elapsed-.1)/(release*.6-.1));this.lit(f,.6+.4*w,1.3);this.jets(f,.4+.6*w,seed);
    for(const sign of[-1,1]){this.hip(f,sign,this.a);this.b.copy(feet).addScaledVector(heading,7*line).addScaledVector(this.lat,-sign*1.6).setY(feet.y+3.4*Math.min(1,line*1.5));st.streak(this.a,this.b,.022,BLADE.main,.8*Math.min(1,line*3));}
    sheenAhead(st,feet,heading,2.2+1.6*w,BLADE,.7*w);st.light(this.b.copy(feet).addScaledVector(heading,3.6).setY(feet.y+.8),3+.9*w,BLADE,.5*w);
   }else if(elapsed<release+.3){
    // The cut left where he went through them, two blades, and a second after; lit while it hangs.
    const w=1-(elapsed-release)/.3;this.lit(f,w,1.3);
    if(this.swung.get(s.id)!==seq*8+7){this.swung.set(s.id,seq*8+7);const at=this.c.copy(feet).addScaledVector(heading,-1.4);at.y+=1.05;this.slash(at,this.lat,heading,.15,2.2,.16,time,.4);this.slash(this.m.copy(at).setY(at.y-.25),this.lat,heading,-.55,1.8,.12,time+.04,.36);}
    st.light(this.b.copy(feet).addScaledVector(heading,-1.4).setY(feet.y+1.1),5.6,BLADE,.62*w);
   }
   return;
  }
  // The ultimate's opener, until it confirms: both blades lit, and the slash that opens it.
  if(s.confirmedAt===undefined&&!s.branch&&elapsed<ULT.contacts[0]+.2){this.lit(f,.6+.4*k,1.3);if(elapsed>=ULT.contacts[0])this.swing(f,seq*8+4,time,1.7,.6,.3);}
 }
 /** Slipped Moorings from the confirm to the last pass: the room to night, white arcs whirling round him as he turns
  *  (his blades' reach, each in its own tilted plane, faster as it builds), gas off his hips, his blades lit. Round
  *  him, in separate arcs: he is read through them, and his victim stands outside. */
 private readonly gather=(actor:Fighter,g:Gather,elapsed:number,victim:Fighter|undefined)=>{
  const final=ULT.contacts[ULT.contacts.length-1];if(elapsed>=final+.1||actor.state.awakened)return;
  const st=this.stage,time=st.time,opener=ULT.contacts[0],build=clamp((elapsed-opener)/(final-opener)),rise=clamp((elapsed-opener)/.25),seed=g.seq*3.5;
  const yaw=actor.state.yaw??actor.group.rotation.y;this.heading.set(Math.sin(yaw),0,Math.cos(yaw));this.lat.set(this.heading.z,0,-this.heading.x);
  st.dim(.3+.4*build,g.actor,g.target);this.lit(actor,1,1.4);this.jets(actor,.5+.5*build,seed);
  const centre=bodyCentre(actor,this.m);
  for(let i=0,n=st.n(4,3);i<n;i++){
   const turn=i*1.571+seed,tilt=.2+.45*Math.sin(i*2.3+seed),from=time*(9+7*build)*(i%2?1:-1)+i*1.7,r=(1.25+.35*i/n)*rise;
   this.u.set(Math.cos(turn),0,Math.sin(turn));this.v.set(-Math.sin(turn)*Math.sin(tilt),Math.cos(tilt),Math.cos(turn)*Math.sin(tilt));
   arc(st,centre,this.u,this.v,r,from,from+2.2,.07,BLADE.main,.5+.4*build);arc(st,centre,this.u,this.v,r,from+.3,from+1.9,.026,BLADE.core,1.3);
  }
  if(victim)st.light(bodyCentre(victim,this.c),3.6+1.6*build,BLADE,.3+.25*build);
  if(build>.8)st.speed(.5*(build-.8)/.2,g.actor,g.target);
 };
 reset(){this.swung.clear();this.book.reset();this.cuts.reset();this.stage.reset();}
 dispose(){if(this.disposed)return;this.reset();this.disposed=true;this.stage.release();}
}
