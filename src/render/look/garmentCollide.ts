import * as THREE from 'three';

/** Round 5b (NIGO2): a long garment's springs kept out of the legs and off the floor.
 *
 *  A long coat hung from the pelvis on spring links (9 x 4 on the first one built) no longer
 *  rides the legs: carried by the calves, the first build's coat bulged into a ball behind every stride. Hanging free,
 *  a stride or a lunge would swing a leg through it instead, and a crouch would sink its hem into the floor. So each
 *  sprung link's tail is pushed out of a capsule round each thigh (UpLeg to Leg) and each shin (Leg to Foot), and up
 *  off the floor under the lower foot: the coat is moved by the legs where they meet it, as cloth is, and never
 *  crossed by them. Capsules are world-space, read once a frame off the posed legs; nothing is allocated per frame. */
export interface GarmentCollide {
  /** Capsule radius round each thigh, world metres (the hakama's bulk plus the coat's clearance). */
  thigh:number;
  /** Capsule radius round each shin, world metres. */
  shin:number;
  /** How far over the sole a tail must stay, world metres. */
  floor:number;
  /** Capsule radius round each foot (Foot to ToeBase), world metres - off unless a profile sets it. Vesper's cape
   *  (7 October 2026) hangs to the floor behind him, and the heel his run kicks up went through it: its links are kept
   *  out of the boots too. Appended after the legs' four, so a garment without it collides exactly as it did. */
  foot?:number;
}

const _closest=new THREE.Vector3(),_away=new THREE.Vector3(),_segment=new THREE.Vector3();

export class LegCapsules {
  private readonly joints:THREE.Object3D[][]=[];
  private readonly radii:number[]=[];
  private readonly from:THREE.Vector3[]=[];
  private readonly to:THREE.Vector3[]=[];
  private readonly feet:THREE.Object3D[]=[];
  private readonly sole:number;
  private floorY=-Infinity;
  private readonly foot=new THREE.Vector3();
  readonly ok:boolean;

  constructor(private readonly root:THREE.Object3D,private readonly spec:GarmentCollide){
    const named=(name:string)=>{let found:THREE.Object3D|undefined;root.traverse(o=>{if(!found&&o.name===name)found=o;});return found;};
    for(const side of ['Left','Right']){
      const hip=named(`${side}UpLeg`),knee=named(`${side}Leg`),ankle=named(`${side}Foot`);
      if(!hip||!knee||!ankle)continue;
      this.joints.push([hip,knee],[knee,ankle]);this.radii.push(spec.thigh,spec.shin);
      this.feet.push(ankle);
    }
    this.ok=this.joints.length===4;
    if(spec.foot)for(const ankle of this.feet){
      const toe=ankle.children.find(child=>/toebase$/i.test(child.name));
      if(toe){this.joints.push([ankle,toe]);this.radii.push(spec.foot);}
    }
    for(let i=0;i<this.joints.length;i++){this.from.push(new THREE.Vector3());this.to.push(new THREE.Vector3());}
    // How high the ankle joints stand over the soles, on the pose the rig was handed over in (the model's floor is
    // its group's origin): the floor under a foot is its joint's height less this.
    root.updateMatrixWorld(true);
    const base=new THREE.Vector3();root.getWorldPosition(base);
    let lowest=Infinity;for(const f of this.feet)lowest=Math.min(lowest,f.getWorldPosition(this.foot).y-base.y);
    this.sole=Number.isFinite(lowest)?Math.max(0,lowest):0;
  }

  update(ground?:number){
    if(!this.ok)return;
    for(let i=0;i<this.joints.length;i++){this.joints[i][0].getWorldPosition(this.from[i]);this.joints[i][1].getWorldPosition(this.to[i]);}
    // The floor is the lower of the model's own origin (its soles' plane) and the plane under the lower foot - a
    // stance that lifts the ankle joints does not lift the floor.
    let lowest=Infinity;for(const f of this.feet)lowest=Math.min(lowest,f.getWorldPosition(this.foot).y);
    this.floorY=Math.min(lowest-this.sole,this.root.getWorldPosition(this.foot).y,ground??Infinity)+this.spec.floor;
  }

  /** Move a link's tail (`tail`, `length` from `head`) out of every capsule and up off the floor, keeping it on the
   *  link's sphere: a link does not stretch, it swings. Returns whether it moved. */
  pushLink(head:THREE.Vector3,tail:THREE.Vector3,length:number){
    if(!this.ok)return false;
    let moved=false;
    // A radial push off a leg, then back onto the sphere; twice over, for a link that lies along a leg.
    for(let pass=0;pass<3;pass++){
      let any=false;
      for(let i=0;i<this.joints.length;i++){
        const a=this.from[i],r=this.radii[i];
        _segment.subVectors(this.to[i],a);
        const span=_segment.lengthSq();
        const t=span>1e-9?THREE.MathUtils.clamp(_away.subVectors(tail,a).dot(_segment)/span,0,1):0;
        _closest.copy(a).addScaledVector(_segment,t);
        _away.subVectors(tail,_closest);
        const d=_away.length();
        if(d>=r)continue;
        // Straight out from the bone; a tail on the bone itself goes out horizontally, away from the head's side.
        if(d>1e-5)_away.divideScalar(d);else{_away.set(head.x-_closest.x,0,head.z-_closest.z);if(_away.lengthSq()<1e-8)_away.set(1,0,0);_away.normalize();}
        tail.copy(_closest).addScaledVector(_away,r);
        any=true;
      }
      if(!any)break;
      moved=true;
      _away.subVectors(tail,head);const reach=_away.length();
      if(reach>1e-6)tail.copy(head).addScaledVector(_away,length/reach);
    }
    // The floor: the link swings out (keeping its way round) until its tail is on it.
    if(tail.y<this.floorY){
      const rise=THREE.MathUtils.clamp((this.floorY-head.y)/length,-1,.95);
      _away.set(tail.x-head.x,0,tail.z-head.z);
      if(_away.lengthSq()<1e-10)_away.set(1,0,0);
      _away.normalize().multiplyScalar(Math.sqrt(1-rise*rise)*length);
      tail.set(head.x+_away.x,head.y+rise*length,head.z+_away.z);
      moved=true;
    }
    return moved;
  }
}
