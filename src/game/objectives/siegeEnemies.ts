import {ENEMIES,type EnemyDefinition,type EnemyClips,type EnemyMove} from '../../survival/enemies';
/** Last Stand additions only. Never overwrite the shared Arcade Survival kits. */
const clips:EnemyClips={idle:['idle'],run:['run'],walk:['walk'],hit:['hit'],down:['knockdown'],getup:['getup'],death:['die'],taunt:['roar'],guard:['roar']};
const own=(name:string)=>`/assets/objectives/enemies/${name}.glb`;
const attack=(name:string,heavy=false):EnemyMove=>({name,slot:heavy?'heavy':'light',clip:[heavy?'kick':'punch'],clipSeconds:heavy?1.4333:2.2,duration:heavy?1.4:1.1,contacts:[heavy?.72:.54],damage:heavy?48:25,range:heavy?2.7:2,radius:heavy?.8:.55,stamina:0,cooldown:heavy?2.8:1.3,stun:.35,knockback:heavy?7:3,style:'melee',lunge:heavy?3:2,minRange:0,maxRange:heavy?3.2:2.4});
const projectile=(name:string,element:EnemyMove['element']):EnemyMove=>({name,slot:'special',clip:['cast'],clipSeconds:2.5,duration:2.2,contacts:[1.42],damage:24,range:18,radius:.45,stamina:0,cooldown:8,stun:.3,knockback:3,style:'projectile',speed:27,minRange:4,maxRange:16,element});
interface Family {id:string;name:string;series:string;model:string;motion?:'humanoid';gunner?:string;heavy?:string;heavyNative?:boolean;native?:'cipher';element?:EnemyMove['element'];height?:number;}
const families:Family[]=[
 {id:'raider',name:'Ash raider',series:'Hidden Ash',model:own('ash-raider'),motion:'humanoid',element:'steel',height:1.9},
 {id:'wraith',name:'Cinder wraith',series:'Cinder Requiem',model:own('ash-wraith-stalker'),motion:'humanoid',heavy:own('ash-wraith-golem'),heavyNative:true,element:'void-ray'},
 {id:'imp',name:'Glare imp',series:'Last Sun',model:own('cell-scout'),element:'ki',height:1.45},
 {id:'corsair',name:'Dune corsair',series:'Dust Sea',model:own('beast-raider'),element:'sound'},
 {id:'sentinel',name:'Court sentinel',series:'Dust Sea',model:own('chess-guard'),motion:'humanoid',element:'steel'},
 {id:'lantern',name:'Lantern agent',series:'Dust Sea',model:own('cipher-agent'),native:'cipher',element:'steel'},
 {id:'puppet',name:'Hex puppet',series:'Hex Fallout',model:own('cursed-spirit'),motion:'humanoid',element:'dark'},
 {id:'ghoul',name:'Scrap ghoul',series:'Salvage Wilds',model:own('scrap-ghoul'),motion:'humanoid',element:'jade'},
 {id:'knight',name:'Barrow knight',series:'Grave Hound',model:own('apostle-beast'),motion:'humanoid',element:'blood'},
 {id:'thrall',name:'Gilded thrall',series:'Gilded Ruin',model:own('vampire-guard'),native:'cipher',element:'blood'},
];
export const SIEGE_ENEMY_IDS:string[]=[];
for(const f of families)for(const rank of ['fodder','gunner','brute','captain','medic','sapper'] as const){
 const id=`siege-${f.id}-${rank}`,heavy=rank==='brute'||rank==='captain';
 if(ENEMIES[id])throw new Error(`Last Stand enemy collides with shared kit: ${id}`);
 let moves=[attack(f.name+' strike'),attack(f.name+' heavy',true)];
 let stateClips=clips;
 if(f.native==='cipher'){
  stateClips={...ENEMIES.takane.clips,down:['_slammed'],getup:['_jump_end'],blown:['_slammed'],land:['_slammed'],dash:['_dodge','_boost'],jump:['_boost'],fall:['_slammed']};moves=ENEMIES.takane.moves.slice(0,2).map(m=>({...m,damage:m.damage*.58,rest:undefined,callout:false,cooldown:2.2}));
 }
 // Use the performance suited to the body: a fighter jabs, a clawed creature
 // rakes, a blade wielder slashes. Keep the authoritative attack windows.
 if(!f.native){
  const monster=['wraith','puppet','ghoul','knight','thrall'].includes(f.id);
  const blades=['raider','corsair','sentinel'].includes(f.id);
  const light=monster?'claw':blades?'slash':'jab';
  const heavyClip=f.id==='wraith'&&heavy?'hammer':monster?'combo':blades?'charged-slash':'uppercut';
  const seconds:Record<string,number>={claw:2.2,slash:1.2333,jab:1.4,hammer:1.5667,combo:2.3,'charged-slash':1.8,uppercut:1.0333};
  moves=moves.map((m,i)=>({...m,clip:[i?heavyClip:light],clipSeconds:seconds[i?heavyClip:light]}));
  stateClips={...clips,taunt:['cast'],walk:monster?['walk-monster','walk']:['walk'],run:monster?['run-sprint','run']:['run-charge','run'],blown:['launched','hit'],land:['knockdown'],fall:['launched']};
 }
 if(rank==='gunner'){
  const shot=projectile(f.id==='raider'?'Thrown knives':f.id==='wraith'?'Cinder bolt':f.id==='imp'?'Sun bolt':'Ranged assault',f.element);
  if(f.native==='cipher')shot.clip=['_combo_b'];
  moves=[shot,moves[0]];
 }
 const def:EnemyDefinition={id,name:`${f.name}${rank==='fodder'?'':rank==='gunner'?' · ranged':rank==='brute'?' · breaker':` · ${rank}`}`,series:f.series,role:rank==='gunner'?'gunner':heavy?'brute':'fodder',brain:rank==='gunner'?'gunner':heavy?'brute':'swarm',model:heavy?(f.heavy??f.model):rank==='gunner'?(f.gunner??f.model):f.model,motion:heavy&&f.heavyNative?undefined:f.motion,height:(f.height??1.95)*(heavy?1.22:1),hp:heavy?600:rank==='gunner'?130:180,size:heavy?1.25:1,poise:heavy?180:undefined,speed:heavy?.62:.8,knockbackIn:heavy?.5:1,stunIn:heavy?.8:1,moves,clips:stateClips,xp:heavy?6:1,score:heavy?260:60,cost:heavy?4:1,color:0xc0a785};
 // The compact native Golem has the same named retargeted clips as the library.
 ENEMIES[id]=def;SIEGE_ENEMY_IDS.push(id);
}
