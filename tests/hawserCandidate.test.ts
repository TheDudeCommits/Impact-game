import fs from'node:fs';import{createHash}from'node:crypto';import{describe,it,expect}from'vitest';import*as T from'three';import{loadRig}from'./rigHarness';
import{HAWSER_AWAKENING,HAWSER_SWORD_SOCKETS,HAWSER_COLOSSUS_KNUCKLES,HAWSER_COLOSSUS_MOVES,HAWSER_COLOSSUS_RUSH,hawserBlade,hawserTrunkFist}from'../src/game/fighters/hawser';
import{FIGHTERS}from'../src/config';import{MOVES,RUSH,contactGap,meleeReach}from'../src/game/moves';import{moveFor,rushMove}from'../src/game/awakening';import{comboMove,COMBO_KEYS}from'../src/game/combos';import{joinClips}from'../src/render/clipMatch';
import{ORIGINALS}from'../src/originals/roster';
const SCOUT='/assets/fighters/hawser-scout1.glb',COLOSSUS='/assets/fighters/hawser-colossus1.glb';
const sha=(path:string)=>createHash('sha256').update(fs.readFileSync('public'+path)).digest('hex');
describe('the two bodies',()=>{
 it.skipIf(!!ORIGINALS.hawser)('freezes the built Scout (scripts/roster-expansion/hawser_scout_build.sh writes these bytes) and the reviewed Colossus',()=>{
  expect(FIGHTERS.hawser.model).toBe(SCOUT);expect(FIGHTERS.hawser.formModel).toBe(COLOSSUS);
  expect(sha(SCOUT)).toBe('d121e37710dc0d57df759d8d5495b5eadbd9bb316231dfd83c15c10f64257984');
  expect(sha(COLOSSUS)).toBe('f784c866ab23dc4fed5d9a8cf25ad8ec23167fe246797263812e1200280f8d5b');
  expect(fs.existsSync('public/assets/fighters/hawser-adult1.glb'),'adult Hawser has left the game').toBe(false);
 });
 it.skipIf(!!ORIGINALS.levin)('the Scout\'s clips are Levin\'s takes, each as long as Levin\'s own, with both blades keyed in every one',async()=>{
  const g=await loadRig(SCOUT);let levin=(await loadRig(FIGHTERS.levin.model)).animations;
  for(const url of FIGHTERS.levin.extraModels!.filter(url=>!/-night\d/.test(url)))levin=joinClips(levin,(await loadRig(url)).animations);
  const from:Record<string,string>={'Fray':'Shave','Fuse Lance':'Fuse Lance','Snap Line':'Zipline','Slipped Moorings':'SOJI: Clean Sweep','Rush 1':'Nick','Rush 2':'Heel Tap','Rush 3':'Lift Off','Cross Lay':'Crosshatch','Squib Burst':'awaken-captain','Hawser Victory':'victory'};
  for(const name of['_Idle','Run','Walk','Dash','jump','Jump Fall','Jump spin','Block','Hit 01','shake','stun','slammed','down_end','Die fall','blownback_end'])from[name]=name;
  expect(g.animations.map(c=>c.name).sort()).toEqual([...Object.keys(from),'Freedom Awakens'].sort());
  for(const clip of g.animations){
   if(from[clip.name])expect(clip.duration,clip.name).toBeCloseTo(levin.find(c=>c.name===from[clip.name])!.duration,3);
   for(const blade of['LeftBlade','RightBlade'])expect(clip.tracks.some(t=>t.name===blade+'.quaternion'),clip.name+' keys '+blade).toBe(true);
   for(const track of clip.tracks)if(track instanceof T.QuaternionKeyframeTrack)for(let i=0;i<track.values.length;i+=4)expect(Math.abs(Math.hypot(...Array.from(track.values.slice(i,i+4)))-1),clip.name+' '+track.name).toBeLessThan(.0001);
  }
  expect(g.animations.find(c=>c.name==='Freedom Awakens')!.duration).toBeCloseTo(HAWSER_AWAKENING.duration,3);
  expect(FIGHTERS.hawser.clips).toEqual(['Fray','Fuse Lance','Snap Line','Slipped Moorings']);expect(FIGHTERS.hawser.rushClips).toEqual(['Rush 1','Rush 2','Rush 3']);
 });
 it.skipIf(!!ORIGINALS.hawser)('keeps the Colossus\'s arm skin on the arm bones the clips drive, and its third-drive fist (scripts/night/rmodel/hawser_colossus_arms.py)',async()=>{
  const g=await loadRig(COLOSSUS),night=await loadRig(FIGHTERS.hawser.formExtraModels!.find(u=>/night1-form/.test(u))!),biped=['Bip001_LUpArmTwist_037','Bip001_L_ForeTwist_035','Dummy001_L_Clavicle_036','Bip001_RUpArmTwist_082','Bip001_R_ForeTwist_080','Dummy001_R_Clavicle_081'];
  for(const c of[...g.animations,...night.animations]){expect(c.tracks.filter(t=>biped.includes(t.name.split('.')[0])).map(t=>t.name),c.name).toEqual([]);expect(c.tracks.some(t=>t.name==='rfx_R_fa1.quaternion'),c.name).toBe(true);}
  g.scene.traverse(o=>{if(!(o instanceof T.SkinnedMesh))return;const bones=o.skeleton.bones.map(b=>b.name),j=o.geometry.attributes.skinIndex,w=o.geometry.attributes.skinWeight;for(let i=0;i<j.count;i++)for(let k=0;k<4;k++)if(w.getComponent(i,k)>0)expect(biped).not.toContain(bones[j.getComponent(i,k)]);});
  const clip=g.animations.find(c=>c.name==='Advancing Rage')!,mixer=new T.AnimationMixer(g.scene);
  mixer.clipAction(clip).play();mixer.setTime(clip.duration*.55238);g.scene.updateMatrixWorld(true);
  const position=(n:string)=>g.scene.getObjectByName(n)!.getWorldPosition(new T.Vector3()),forearm=position('RightHand').sub(position('RightForeArm')),palm=position('RightHandMiddle1').sub(position('RightHand'));
  expect(forearm.angleTo(palm)).toBeLessThan(.3);
  mixer.stopAllAction();mixer.uncacheRoot(g.scene);
 });
});
describe('the Scout throws Levin\'s kit a little less strong',()=>{
 const nine=(damage:number)=>Math.round(damage*.9);
 it.skipIf(!!ORIGINALS.hawser)('every slot: Levin\'s move on Levin\'s clock and reach, nine tenths of its damage, under a name of his own',()=>{
  for(const slot of['light','heavy','special','ultimate']as const){
   const{name,damage,finisherDamage,schedule,reach,...mine}=MOVES.hawser[slot],{name:his,damage:d,finisherDamage:f,schedule:s,...levin}=MOVES.levin[slot];
   expect(mine,slot).toEqual(levin);expect(damage,slot).toBe(nine(d));
   // (A Fuse Lance is the regiment's weapon and is called what it is; the other three are his own names.)
   if(slot!=='heavy')expect(name,slot).not.toBe(his);
   if(s)expect(schedule).toEqual(s.map(nine));
   // (A projectile has no reach to bring.) His lunge stops and his cut lands where Levin's does.
   if(MOVES.levin[slot].style==='melee'){expect(reach,slot).toBeGreaterThan(0);expect(meleeReach('hawser',slot,MOVES.hawser[slot])).toBe(meleeReach('levin',slot,MOVES.levin[slot]));expect(contactGap('hawser',slot,MOVES.hawser[slot])).toBe(contactGap('levin',slot,MOVES.levin[slot]));}
   expect(f===undefined).toBe(finisherDamage===undefined);
  }
  // In arcade survival a side throws `damage` a contact and `finisherDamage` the last: nine tenths of Levin's 368.
  const ult=MOVES.hawser.ultimate;expect(ult.damage*(ult.contacts.length-1)+ult.finisherDamage!).toBe(nine(368));expect(ult.schedule![0]).toBe(ult.damage);
  expect(FIGHTERS.hawser.moves).toEqual((['light','heavy','special','ultimate']as const).map(slot=>MOVES.hawser[slot].name));
 });
 it('the string and the six enders: Levin\'s, at nine tenths',()=>{
  RUSH.hawser.forEach((stage,i)=>{const{name,damage,reach,...mine}=stage,{name:his,damage:d,...levin}=RUSH.levin[i];expect(mine).toEqual(levin);expect(damage).toBe(nine(d));expect(name).not.toBe(his);expect(meleeReach('hawser','light',stage)).toBe(meleeReach('levin','light',RUSH.levin[i]));});
  for(const key of COMBO_KEYS){const{name,damage,...mine}=comboMove('hawser',key)!,{name:his,damage:d,...levin}=comboMove('levin',key)!;expect(mine,key).toEqual(levin);expect(damage,key).toBe(nine(d));expect(name,key).not.toBe(his);}
 });
 it('his area move is Levin\'s circle at nine tenths, cast with the two-bladed cut and his own cry',()=>{
  const{name,damage,finisherDamage,area,...mine}=MOVES.hawser.area,{name:his,damage:d,finisherDamage:f,area:levin,...rest}=MOVES.levin.area;
  expect(mine).toEqual(rest);expect(name).toBe('Tug of War');expect(name).not.toBe(his);
  const total=(m:{damage:number;finisherDamage?:number;area?:{strikes?:readonly number[]}})=>m.damage*((m.area?.strikes?.length??1)-1)+(m.finisherDamage??m.damage);
  expect(total(MOVES.hawser.area)).toBe(nine(total(MOVES.levin.area)));expect(area!.telegraph).toBe(levin!.telegraph);expect(area!.anim).toEqual({clip:'Cross Lay'});expect(area!.voice).toBe('vo-hawser-strike');expect(area!.ja).toBe('綱引き');expect(area!.fx).toBe('breath_moon');
 });
});
describe('the YUGE throws a kit of its own',()=>{
 it('each slot is the Colossus\'s move whole: nothing of the Scout\'s rides under it',()=>{
  for(const slot of['light','heavy','special','ultimate']as const){
   const awake=moveFor('hawser',slot,true),own=HAWSER_COLOSSUS_MOVES[slot];
   expect(JSON.parse(JSON.stringify(awake)),slot).toEqual(JSON.parse(JSON.stringify(own)));expect(awake.name).not.toBe(MOVES.hawser[slot].name);expect(awake.style).toBe('melee');
   for(const key of['reach','chargeIn','dashThrough','speed']as const)expect(awake[key],slot+' '+key).toBeUndefined();
   // Its fists reach as far as their range, as they did: no blade's measured reach.
   expect(meleeReach('hawser',slot,awake)).toBeCloseTo(own.range+.45,6);
  }
  expect(moveFor('hawser','heavy',true).outcome).toBe('launch');expect(moveFor('hawser','special',true).guardBreak).toBeUndefined();expect(moveFor('hawser','ultimate',true).schedule).toEqual([34,52,78,212]);
  expect(FIGHTERS.hawser.formShortMoves).toHaveLength(4);expect([...FIGHTERS.hawser.shortMoves!,...FIGHTERS.hawser.formShortMoves!].every(label=>label.length<=16)).toBe(true);
 });
 it('its string carries where the Scout\'s launches, and its enders and its area move are its own',()=>{
  expect([1,2,3].map(stage=>rushMove('hawser',stage,true).name)).toEqual([...HAWSER_COLOSSUS_RUSH.names]);expect([1,2,3].map(stage=>rushMove('hawser',stage,true).damage)).toEqual([...HAWSER_COLOSSUS_RUSH.damage]);
  expect(rushMove('hawser',3,true).outcome).toBe('wallBounce');expect(rushMove('hawser',3,false).outcome).toBe('launch');expect(rushMove('hawser',1,true).reach).toBeUndefined();expect(rushMove('hawser',1,true).range).toBe(HAWSER_COLOSSUS_MOVES.light.range);
  for(const key of COMBO_KEYS){const base=comboMove('hawser',key)!,awake=comboMove('hawser',key,true)!;expect(awake.name,key).not.toBe(base.name);expect(awake.damage,key).toBeGreaterThan(base.damage);}
  // (The fists' enders on the clock adult Hawser's had: the template's times .44 / .46.)
  expect(comboMove('hawser','lh',true)).toMatchObject({name:'Knot Hook',duration:.67,contacts:[.268],damage:46,range:2.7,radius:.77});
  const rumbling=moveFor('hawser','area',true);expect(rumbling).toMatchObject({name:'The Uprooting',damage:224,radius:4.4,outcome:'knockdown',knockback:10});expect(rumbling.area).toMatchObject({telegraph:.85,fx:'tectonic',voice:'vo-hawser-uprooting',ja:'地鳴らし',anim:{clip:'Freedom Hammer'}});expect(rumbling.area!.strikes).toBeUndefined();
 });
 it('keeps the hand bite and the reveal on the awakening\'s clock, and picks the blade or the fist that lands each blow',()=>{
  expect(HAWSER_AWAKENING.entryDuration*HAWSER_AWAKENING.formRevealFraction).toBeCloseTo(.594);
  expect(hawserTrunkFist('Rising Rebellion')).toBe('LeftHand');expect([0,1,2,3].map(i=>hawserTrunkFist('Advancing Rage',i))).toEqual(['RightHand','LeftHand','RightHand','RightHand']);expect(hawserTrunkFist('Forward Will')).toBe('RightHand');
  expect(hawserBlade('Fray')).toBe('RightBlade');expect(hawserBlade('Fuse Lance')).toBe('LeftBlade');expect(hawserBlade('_Idle')).toBe('RightBlade');
  expect([0,1,2,3,4,5,6].map(i=>hawserBlade('Slipped Moorings',i))).toEqual(['RightBlade','LeftBlade','LeftBlade','LeftBlade','RightBlade','RightBlade','RightBlade']);expect(hawserBlade('Slipped Moorings',undefined,.5)).toBe('LeftBlade');expect(hawserBlade('Slipped Moorings',undefined,.95)).toBe('RightBlade');
 });
});
