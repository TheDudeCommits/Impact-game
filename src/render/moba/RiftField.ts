import * as THREE from 'three';
import type {GameSnapshot} from '../../game/types';
import {riftOf,RIFT_RULES,type RiftStructure,type RiftUnit} from '../../game/moba/model';
import type {GruntRenderer} from '../horde/GruntRenderer';
import {riftUnitHeight} from '../../game/moba/armyIdentity';
import {RiftArmies} from './RiftArmies';
import {RiftStructures,RIFT_STRUCTURE_HEIGHT} from './RiftStructures';
import {RiftRunes} from './RiftRunes';
import {RIFT_INK} from './palette';
import type {ThreatInk} from '../ThreatOutline';

const transform=new THREE.Object3D(),tint=new THREE.Color(),white=new THREE.Color(0xfff4d9);
const BAR_CAP=RIFT_RULES.unitCap+24,BOLT_CAP=64;
interface Bolt {x:number;y:number;z:number;tx:number;ty:number;tz:number;until:number;color:number;width:number;born?:number;ward?:boolean}
/** View-only adapter. No hits, economy or targeting decisions happen here. */
export class RiftField {
  readonly root=new THREE.Group();
  glows:ReadonlyMap<string,ThreatInk>=new Map();
  private armies:RiftArmies;
  private structures=new RiftStructures();
  private runes=new RiftRunes();
  private back:THREE.InstancedMesh;
  private health:THREE.InstancedMesh;
  private bolts:THREE.InstancedMesh;
  private halos:THREE.InstancedMesh;
  private impacts:THREE.InstancedMesh;
  private boltSlots:Bolt[]=Array.from({length:BOLT_CAP},()=>({x:0,y:0,z:0,tx:0,ty:0,tz:0,until:0,color:0,width:.045}));
  private cursor=0;private lastEvent=-1;private lastTime=-1;
  private target=new THREE.Mesh(new THREE.RingGeometry(.84,1,40).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffdb8d,transparent:true,opacity:.9,depthWrite:false}));
  private range=new THREE.Mesh(new THREE.RingGeometry(RIFT_RULES.towerRange-.15,RIFT_RULES.towerRange,72).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xef7562,transparent:true,opacity:.25,depthWrite:false}));
  private readonly focus=new THREE.Vector3();
  /** The health bars that may be drawn this frame - x, y, z and width; the share of health left; its team; whether it is a
   *  unit at full health (hidden from the viewer's own side unless selected) - kept so that each half of a split screen
   *  draws its own set, turned to its own lens (face): a bar turned to Player 1's camera is edge-on, or its back, in
   *  Player 2's half, and on rival sides each person's own unhurt units are theirs to leave unmarked. */
  private readonly barAt=new Float32Array(BAR_CAP*4);private readonly barShare=new Float32Array(BAR_CAP);
  private readonly barTeam:RiftUnit['team'][]=[];private readonly barQuiet=new Uint8Array(BAR_CAP);private bars=0;
  /** Each half's person (Player 2's on a split screen): where they stand and their side, for the bars they see, and the
   *  nearest enemy tower to them, for the range ring under it. */
  private readonly viewers=[0,1].map(()=>({here:false,x:0,z:0,team:undefined as RiftUnit['team']|undefined,ring:false,rx:0,rz:0,aimed:false}));
  private selected='';
  constructor(scene:THREE.Scene,private readonly crowd:GruntRenderer){
    this.armies=new RiftArmies(crowd);
    this.root.name='Rift War · armies and objectives';scene.add(this.root);this.root.visible=false;this.root.add(this.armies.root,this.structures.root,this.runes.root,this.target,this.range);
    const bar=new THREE.PlaneGeometry(1,.085),backMat=new THREE.MeshBasicMaterial({color:0x182321,depthWrite:false}),hpMat=new THREE.MeshBasicMaterial({color:0xffffff,depthWrite:false});
    this.back=new THREE.InstancedMesh(bar,backMat,BAR_CAP);this.health=new THREE.InstancedMesh(bar,hpMat,BAR_CAP);
    for(const m of [this.back,this.health]){m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.renderOrder=8;this.root.add(m);}
    // WebGL lines remain one device pixel regardless of linewidth. A five-sided
    // pooled tracer stays readable on low resolution with no light or bloom.
    this.bolts=new THREE.InstancedMesh(new THREE.CylinderGeometry(1,1,1,5).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,depthWrite:false}),BOLT_CAP);this.bolts.count=0;this.bolts.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.bolts.frustumCulled=false;this.bolts.name='Rift pooled ward tracers';this.root.add(this.bolts);
    this.halos=new THREE.InstancedMesh(new THREE.CylinderGeometry(.2,1,1,8).rotateX(Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.24,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false}),BOLT_CAP);
    this.impacts=new THREE.InstancedMesh(new THREE.RingGeometry(.65,1,24).rotateX(-Math.PI/2),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide,toneMapped:false}),BOLT_CAP);
    for(const m of [this.halos,this.impacts]){m.count=0;m.frustumCulled=false;m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);this.root.add(m);}
  }
  async load(){await Promise.all([this.armies.load(),this.structures.load()]);}
  setTarget(id:string|null|undefined){this.selected=id??'';}
  /** `also`: a split screen's Player 2 (couch/split.ts), whose half draws the bars they see and their own range ring
   *  (face). */
  update(snapshot:GameSnapshot|undefined,selfId:string,camera:THREE.Camera,_dt:number,also?:string){
    const v=riftOf(snapshot);this.root.visible=!!v;
    if(!v||!snapshot){if(this.lastTime>=0)this.clear();return;}
    const time=snapshot.serverTime;
    if(time<this.lastTime){this.lastEvent=-1;this.cursor=0;for(const bolt of this.boltSlots)bolt.until=0;}
    this.lastTime=time;
    const player=snapshot.players.find(p=>p.id===selfId);this.crowd.focus=player?.alive?this.focus.set(player.x,player.y+1.1,player.z):undefined;
    this.armies.update(v.units,time,_dt,camera,this.glows);this.structures.update(v.structures,time,this.glows,camera);
    const own=snapshot.players.find(p=>p.id===selfId),seat=v.seats.find(p=>p.id===selfId);
    const two=also?snapshot.players.find(p=>p.id===also):undefined,twoSeat=also?v.seats.find(p=>p.id===also):undefined;
    this.runes.update(v.runes,time,own);
    let bars=0;
    const healthBar=(u:RiftUnit|RiftStructure,height:number,width:number)=>{
      if(u.hp<=0||bars>=BAR_CAP||('hidden'in u&&u.hidden))return;
      const k=bars*4;this.barAt[k]=u.x;this.barAt[k+1]=u.y+height;this.barAt[k+2]=u.z;this.barAt[k+3]=width;this.barShare[bars]=Math.max(0,Math.min(1,u.hp/u.maxHp));
      this.barTeam[bars]=u.team;this.barQuiet[bars]=u.hp===u.maxHp&&'state' in u&&u.id!==this.selected?1:0;bars++;
    };
    for(const u of v.units)healthBar(u,riftUnitHeight(u)+.25,u.kind==='boss'?3.2:1.15);
    for(const s of v.structures)healthBar(s,RIFT_STRUCTURE_HEIGHT[s.kind]+.35,s.kind==='core'?4:2.4);
    this.bars=bars;
    this.viewerFor(0,v.structures,own,seat?.team,selfId);this.viewerFor(1,v.structures,two,twoSeat?.team,also);
    this.face(camera,0);
    const selected=this.selected?v.units.find(u=>u.id===this.selected)??v.structures.find(s=>s.id===this.selected):undefined;
    this.target.visible=!!selected&&selected.hp>0;if(selected){this.target.position.set(selected.x,.055,selected.z);this.target.scale.setScalar(selected.radius+1);}
    for(const event of v.events){if(event.id<=this.lastEvent)continue;this.lastEvent=event.id;if(event.hidden||event.kind!=='bolt')continue;
      const actor=v.structures.find(s=>s.id===event.actorId)??v.units.find(s=>s.id===event.actorId),target=v.units.find(s=>s.id===event.targetId)??snapshot.players.find(p=>p.id===event.targetId)??v.structures.find(s=>s.id===event.targetId);
      if(!actor||!target)continue;const ward='tier'in actor,slot=this.boltSlots[this.cursor++%BOLT_CAP];slot.x=actor.x;slot.y=actor.y+(ward?RIFT_STRUCTURE_HEIGHT[actor.kind as RiftStructure['kind']]*.76:riftUnitHeight(actor as RiftUnit)*.68);slot.z=actor.z;slot.tx=target.x;slot.ty=target.y+.8;slot.tz=target.z;slot.until=time+(ward ? .42 : .26);slot.born=time;slot.ward=ward;slot.color=event.team==='heroes'?0xffd471:event.team==='villains'?0xc26aff:0xef8d54;slot.width=ward ? .24 : .09;
    }
    let count=0;for(const b of this.boltSlots){if(b.until<=time)continue;const length=Math.hypot(b.tx-b.x,b.ty-b.y,b.tz-b.z);if(length<.01)continue;const fade=Math.min(1,(b.until-time)/.2),width=b.width*fade;
      transform.position.set((b.x+b.tx)/2,(b.y+b.ty)/2,(b.z+b.tz)/2);transform.lookAt(b.tx,b.ty,b.tz);transform.scale.set(width,width,length);transform.updateMatrix();this.bolts.setMatrixAt(count,transform.matrix);tint.setHex(b.color).lerp(white,.72);this.bolts.setColorAt(count,tint);
      transform.scale.set(width*3,width*3,length);transform.updateMatrix();this.halos.setMatrixAt(count,transform.matrix);tint.setHex(b.color);this.halos.setColorAt(count,tint);
      const radius=(b.ward?1.2:.5)+(time-(b.born??time))*5;transform.position.set(b.tx,.06,b.tz);transform.rotation.set(0,time*2,0);transform.scale.set(radius,fade,radius);transform.updateMatrix();this.impacts.setMatrixAt(count,transform.matrix);this.impacts.setColorAt(count,tint.multiplyScalar(fade));count++;
    }
    for(const m of [this.bolts,this.halos,this.impacts]){m.count=count;m.instanceMatrix.needsUpdate=true;if(m.instanceColor)m.instanceColor.needsUpdate=true;}
  }
  /** The health bars `half`'s person sees, turned to `camera`, and the range ring under their nearest enemy tower: once a
   *  frame from update, and on a split screen as each half is drawn (main.ts splitHalf, its lens then the half's). The
   *  ring is moved after the frame's matrix pass there, so it brings its own matrix up to date. */
  face(camera:THREE.Camera,half:0|1=0){
    const viewer=this.viewers[half];let n=0;
    for(let i=0;i<this.bars;i++){
      const k=i*4,x=this.barAt[k],z=this.barAt[k+2];
      if(viewer.here&&(viewer.x-x)**2+(viewer.z-z)**2>42*42)continue;
      if(this.barQuiet[i]&&this.barTeam[i]===viewer.team)continue;
      const width=this.barAt[k+3],share=this.barShare[i];
      transform.position.set(x,this.barAt[k+1],z);transform.quaternion.copy(camera.quaternion);transform.scale.set(width,1,1);transform.updateMatrix();this.back.setMatrixAt(n,transform.matrix);
      transform.translateX(-(1-share)*width/2);transform.scale.x=width*share;transform.updateMatrix();this.health.setMatrixAt(n,transform.matrix);
      tint.setHex(RIFT_INK[this.barTeam[i]]);this.health.setColorAt(n,tint);n++;
    }
    for(const mesh of [this.back,this.health]){mesh.count=n;mesh.instanceMatrix.needsUpdate=true;}if(this.health.instanceColor)this.health.instanceColor.needsUpdate=true;
    this.range.visible=viewer.ring;
    if(viewer.ring){this.range.position.set(viewer.rx,.039,viewer.rz);this.range.material.opacity=viewer.aimed?.6:.25;this.range.material.color.setHex(viewer.aimed?0xffb27a:0xef7562);this.range.updateMatrixWorld();}
  }
  /** One half's person: where they stand, their side, and their range ring - the nearest tower or guardian of the other
   *  side (one aiming at them first), within 20 m. */
  private viewerFor(half:0|1,structures:readonly RiftStructure[],me:{x:number;z:number}|undefined,team:RiftUnit['team']|undefined,id:string|undefined){
    const viewer=this.viewers[half];viewer.here=!!me;viewer.team=team;if(me){viewer.x=me.x;viewer.z=me.z;}
    let nearest:RiftStructure|undefined,distance=Infinity;
    if(me)for(const s of structures){
      if(s.hidden||s.hp<=0||s.team===team||(s.kind!=='tower'&&s.kind!=='guardian'))continue;
      const d=(s.x-me.x)**2+(s.z-me.z)**2;
      if(!nearest||(s.target===id&&nearest.target!==id)||(s.target===id)===(nearest.target===id)&&d<distance){distance=d;nearest=s;}
    }
    viewer.ring=!!nearest&&distance<20*20;
    if(nearest){viewer.rx=nearest.x;viewer.rz=nearest.z;viewer.aimed=!!id&&nearest.target===id;}
  }
  clear(){this.root.visible=false;this.armies.clear();this.structures.clear();this.runes.clear();this.back.count=this.health.count=this.bolts.count=this.halos.count=this.impacts.count=0;for(const b of this.boltSlots)b.until=0;this.lastEvent=-1;this.lastTime=-1;this.selected='';}
  dispose(){this.clear();this.armies.dispose();this.structures.dispose();this.runes.dispose();this.back.geometry.dispose();for(const m of [this.back,this.health]){(m.material as THREE.Material).dispose();m.dispose();}for(const m of [this.target,this.range,this.bolts,this.halos,this.impacts]){m.geometry.dispose();(m.material as THREE.Material).dispose();}for(const m of [this.bolts,this.halos,this.impacts])m.dispose();this.root.removeFromParent();}
}
