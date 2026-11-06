import * as THREE from 'three';
import type { SpringProfile } from '../SecondaryMotion';

// Round 5b (RIG2): long garments hung off the pelvis - Tobari's cloak, Vesper's cape, Shiun's coat - drape and
// stay outside the legs.
//
// scripts/rig/hem_chains.py takes the garment off the thighs and shins (where it tore into webs, or wrapped each leg
// like a trouser leg) and hangs it on chains of its own off Hips: `Detail_CLOTH_<garment>_hem_<sector>_<level>`,
// one chain a sector round the pelvis, each ending in an unweighted `HemEnd_<garment>_<sector>`. Hung off the
// pelvis, though, a chain's authored direction is the pelvis's: lean into a run and the whole skirt leans with the
// hips and sticks out behind like a tube, and nothing keeps a knee from coming through the front of it. Two things
// are done here, around SecondaryMotion's spring (which still gives the swing, the lag and the trail):
//   - before it, each chain's authored direction is turned most of the way from the pelvis's down to the world's
//     (the garment hangs; none when the body is not upright - lying, flipping - where the clip's pose stands), and
//     out of the legs where a leg is in its way;
//   - inside it, every solved link is turned out of the legs again (a leg pushes cloth, it does not pass through).
// Nothing here allocates per frame.

/** One garment's hem: its spring and how it drapes. */
export interface HemSpec {
  /** The spring the hem chains swing on (over SecondaryMotion's default, in place of the fighter's own profile). */
  profile:Partial<SpringProfile>;
  /** How far each chain's authored direction is turned from the pelvis's down toward the world's, 0..1. */
  hang:number;
  /** The leg's radius at the thigh, metres; the knee, shin and foot are graded down from it. */
  legRadius:number;
  /** How far outside a leg's surface the cloth is kept, metres. */
  clearance:number;
  /** The largest turn a leg may push a link through, degrees. */
  maxPush:number;
  /** The furthest any link may stand off the hung skirt's axis, degrees: a knee lifted to the hips pushes the cloak's
   *  front out level over it, and no further - pushed again from there, "out" pointed up and the hem stood up as a
   *  board over the belt. */
  maxLift:number;
  /** Round 5b (RIG3): leg sample points added to SAMPLES for this garment ([segment, fraction, radius share]): a skirt
   *  fitted close round the upper thighs meets them above the default's first point. */
  extra?:[number,number,number][];
}

const DEFAULT_SPEC:HemSpec={profile:{},hang:.8,legRadius:.075,clearance:.02,maxPush:70,maxLift:80};

/** Per garment (the `<garment>` in the chain names). */
export const HEM_SPECS:Record<string,Partial<HemSpec>>={
  // The Crow Cloak cloak: heavy, closed, to mid-shin. It hangs, swings behind a dash and a turn, and the knees push its
  // front out in a run instead of coming through it.
  tobari:{profile:{stiffness:16,drag:.45,gravity:3,maxAngle:24,tipLoose:.7,spread:.2,trail:.08,flutter:.1},hang:.85,legRadius:.075,clearance:.02},
  // Vesper's cape behind him: lighter, so it swings wider and trails further. (7 October 2026, vesper-mx2.glb.) The
  // heel a run kicks up behind him pushes it out of the way but not up level as a tail: the middle chains rose to 26 cm
  // under the hips at 70 degrees' push; at 40, 41-44 cm. (8 October 2026, vesper-mx3: to mid-calf, on thirteen chains
  // of even links, not six of three.) The legs keep it off them over a wider reach (`legRadius`, `clearance`,
  // `maxPush`): his boots stood out through it in most frames of a run; the chains answer further apart (`spread`), so
  // it folds. (A cap on its swing, droop 45 and maxLift 55, lost a blind judge on this cape 2 pairs to 7: it puffed
  // into a tent round his legs.)
  vesper:{profile:{stiffness:12,drag:.4,gravity:3,maxAngle:24,tipLoose:.65,spread:.4,trail:.1,flutter:.2},hang:.9,legRadius:.16,clearance:.05,maxPush:60,maxLift:65},
  // Round 5b (RIG3): Shiden's navy wrap skirt (shiden-arp2.glb, scripts/rig/garment.py): closed, waist to knee, under
  // the rope belt, eight chains of three links (each to its own sector's hem: the wrap's front edge hangs higher) with
  // the rope's two loops on them. Lighter than the Crow Cloak cloak, over baggy trousers (8.5-11 cm at the thigh).
  // `chains` gives each link its own rest axis (SecondaryMotion): without one every link shared the last one's.
  shiden:{profile:{stiffness:16,drag:.45,gravity:3,maxAngle:24,tipLoose:.7,spread:.2,trail:.08,flutter:.12,chains:[{match:/^Detail_CLOTH_shiden_hem_/,profile:{}}]},hang:.85,legRadius:.1,clearance:.02,extra:[[0,.2,1],[0,.3,1]]},
  // Round 5b (RIG3): Rook's long coat (rook-mx2.glb, scripts/rig/garment.py): ankle length, open in front
  // and slit up the back, on eight chains of four links - none across the slit or the front - over slim trousers (10 cm
  // at the thigh). Light, long cloth: it trails a run and a dash and swings round on a turn. Ankle-length, it is kept on
  // the floor in a lunge as Vesper's cape is (look/garmentCollide.ts).
  'rook':{profile:{stiffness:14,drag:.45,gravity:3,maxAngle:26,tipLoose:.65,spread:.3,trail:.1,flutter:.18,chains:[{match:/^Detail_CLOTH_rook_hem_/,profile:{legs:{thigh:.1,shin:.08,floor:.015}}}]},hang:.85,legRadius:.1,clearance:.03,maxPush:60,maxLift:70},
  // Round 5b (RIG3): Akagane's armour skirt (akagane-ff2.glb, scripts/rig/garment.py): closed, belt to knee, its tassets
  // over it, on eight chains of three links over baggy trousers (11 cm at the thigh). Plates on cloth: stiffer and
  // steadier than a robe, it swings less, flutters little and settles quickly.
  akagane:{profile:{stiffness:18,drag:.5,gravity:3,maxAngle:22,tipLoose:.75,spread:.15,trail:.06,flutter:.05,chains:[{match:/^Detail_CLOTH_akagane_hem_/,profile:{}}]},hang:.8,legRadius:.11,clearance:.02},
  // Round 5b (RIG3): the sash of Magatsu's Heian form (magatsu-heian-mx2.glb, scripts/rig/garment.py), wound round his
  // waist and flaring out over the hakama, on eight chains of two links. It keeps most of its modelled flare (a low
  // `hang`), swings and trails; the bulky hakama (13-19 cm at the thigh) push it out.
  'magatsu-heian':{profile:{stiffness:18,drag:.5,gravity:2.6,maxAngle:22,tipLoose:.7,spread:.25,trail:.07,flutter:.15,chains:[{match:/^Detail_CLOTH_magatsu-heian_hem_/,profile:{}}]},hang:.3,legRadius:.15,clearance:.02,maxLift:85},
  // Black Vespers's cape (vesper-black-vespers-mx2.glb, scripts/rig/vesper_rig.py): a heavier, wider shell from the hips round to
  // his sides, open in front; his armoured legs are slim.
  'vesper-black-vespers':{profile:{stiffness:14,drag:.45,gravity:3,maxAngle:22,tipLoose:.7,spread:.08,trail:.09,flutter:.1},hang:.9,legRadius:.085,clearance:.025,maxPush:40,maxLift:60},
  wataame:{profile:{stiffness:26,drag:.6,gravity:2.6,maxAngle:14,tipLoose:.65,spread:.25,trail:.05,flutter:.08,chains:[{match:/^Detail_CLOTH_wataame_hem_/,profile:{legs:{thigh:.065,shin:.055,floor:.015},droop:100}}]},hang:.92,legRadius:.06,clearance:.012,maxPush:55,maxLift:60},
  amagoi:{profile:{stiffness:20,drag:.5,gravity:3.2,maxAngle:16,tipLoose:.6,spread:.12,trail:.06,flutter:.08,chains:[{match:/^Detail_CLOTH_amagoi_hem_/,profile:{legs:{thigh:.075,shin:.06,floor:.015},droop:100}}]},hang:.9,legRadius:.07,clearance:.015},
  'shakudo':{profile:{stiffness:16,drag:.45,gravity:3,maxAngle:22,tipLoose:.65,spread:.25,trail:.08,flutter:.14,chains:[{match:/^Detail_CLOTH_shakudo_hem_/,profile:{legs:{thigh:.1,shin:.12,floor:.015,foot:.12},droop:100}}]},hang:.88,legRadius:.1,clearance:.03,maxPush:90,maxLift:85,extra:[[1,.5,1.1],[1,.8,1.4],[1,1,1.7],[2,.5,1.5],[2,1,1.2]]},
  torsion:{profile:{stiffness:22,drag:.55,gravity:2.6,maxAngle:16,tipLoose:.6,spread:.25,trail:.06,flutter:.12,chains:[{match:/^Detail_CLOTH_torsion_hem_/,profile:{legs:{thigh:.065,shin:.05,floor:.015},droop:100}}]},hang:.9,legRadius:.055,clearance:.012,maxPush:55,maxLift:60},
};

const LEGS=[['LeftUpLeg','LeftLeg','LeftFoot','LeftToeBase'],['RightUpLeg','RightLeg','RightFoot','RightToeBase']] as const;
/** Sample points along each leg: [segment (0 thigh, 1 shin, 2 foot), fraction along it, radius as a share of the
 *  thigh's]. */
const SAMPLES:[number,number,number][]=[[0,.45,1],[0,.75,.95],[0,1,.9],[1,.35,.8],[1,.7,.72],[1,1,.68],[2,.5,.6],[2,1,.5]];
/** Leg points this near a chain's head are left to the belt: the cloth there is fitted round the hips by the model,
 *  and a turn about the head cannot move it anyway (a hip joint 15 cm under the belt turned a whole chain 30 degrees). */
const TOP=.2,TOP_MIN=.12;

interface Link {
  bone:THREE.Bone;
  /** The rest local rotation (no clip keys a hem chain). */
  rest:THREE.Quaternion;
  /** Unit direction from this link's head to the next joint, in the link's own frame. */
  axis:THREE.Vector3;
  /** World metres from this link's head to the chain's end. */
  reach:number;
  /** World metres from this link's head to the next joint. */
  length:number;
  chain:Chain;
}

interface Chain {
  links:Link[];
  /** World metres from the root's head to the chain's end. */
  reach:number;
  /** The way out from the pelvis to this chain, in the pelvis's frame (horizontal at rest). */
  out:THREE.Vector3;
  /** Half the width of cloth this chain carries, metres. */
  half:number;
  /** This frame's way out, world. */
  outWorld:THREE.Vector3;
}

const _q=new THREE.Quaternion(),_q2=new THREE.Quaternion(),_hipsQ=new THREE.Quaternion(),_hipsInv=new THREE.Quaternion();
const _hang=new THREE.Quaternion(),_turn=new THREE.Quaternion();
const _v=new THREE.Vector3(),_v2=new THREE.Vector3(),_d=new THREE.Vector3(),_n=new THREE.Vector3(),_side=new THREE.Vector3();
const _head=new THREE.Vector3(),_down=new THREE.Vector3();
const WORLD_DOWN=new THREE.Vector3(0,-1,0);
const CHAIN=/^Detail_CLOTH_([A-Za-z0-9-]+)_hem_(\d+)_(\d+)$/;

export class HemDrape {
  readonly garment:string;
  readonly spec:HemSpec;
  /** How much of `spec.hang` holds this frame, 0..1 (1: all of it). Torsion's flight (signature/TorsionFlight.ts)
   *  lets it go at a glide and a dash, so her dress streams back along her body instead of hanging to the floor. */
  hangScale=1;
  private chains:Chain[]=[];
  private links=new Map<THREE.Bone,Link>();
  private hips:THREE.Object3D;
  private legs:THREE.Bone[][]=[];
  /** The skirt's own down at rest, in the pelvis's frame. */
  private down=new THREE.Vector3();
  /** This frame's leg sample points (world) and radii. */
  private points:THREE.Vector3[]=[];
  private radii:number[]=[];
  private count=0;
  /** The leg points sampled (SAMPLES, and the spec's `extra`). */
  private samples:[number,number,number][]=SAMPLES;
  /** This frame's hung skirt axis, world (see maxLift). */
  private axis=new THREE.Vector3(0,-1,0);

  /** The hem chains under `root`, or undefined if it has none. */
  static find(root:THREE.Object3D):HemDrape|undefined{
    const found:{bone:THREE.Bone;garment:string;sector:number;level:number}[]=[];
    root.traverse(o=>{
      const m=(o as THREE.Bone).isBone?CHAIN.exec(o.name):null;
      if(m)found.push({bone:o as THREE.Bone,garment:m[1],sector:Number(m[2]),level:Number(m[3])});
    });
    if(!found.length)return undefined;
    const legs:THREE.Bone[][]=[];
    for(const names of LEGS){
      const leg:THREE.Bone[]=[];
      for(const name of names){
        let bone:THREE.Bone|undefined;
        root.traverse(o=>{if(!bone&&(o as THREE.Bone).isBone&&(o.name===name||o.name.endsWith(name)))bone=o as THREE.Bone;});
        if(bone)leg.push(bone);
      }
      if(leg.length>=3)legs.push(leg);
    }
    // Round 5b (RIG3): a rig whose thigh joint sits down the thigh (Shiden's Auto-Rig Pro export puts LeftUpLeg at
    // mid-thigh) carries its hip socket on a thigh twist bone above it: the thigh is measured from there, or its upper
    // half - where a run's thigh meets the skirt - is never sampled.
    root.updateMatrixWorld(true);
    for(const leg of legs){
      const twist=leg[0].children.find(c=>(c as THREE.Bone).isBone&&/thigh.?twist/i.test(c.name)) as THREE.Bone|undefined;
      if(twist&&twist.getWorldPosition(_v).y>leg[0].getWorldPosition(_v2).y)leg[0]=twist;
    }
    return new HemDrape(root,found,legs);
  }

  private constructor(root:THREE.Object3D,found:{bone:THREE.Bone;garment:string;sector:number;level:number}[],legs:THREE.Bone[][]){
    this.garment=found[0].garment;
    this.spec={...DEFAULT_SPEC,...HEM_SPECS[this.garment],profile:{...HEM_SPECS[this.garment]?.profile}};
    this.legs=legs;
    root.updateMatrixWorld(true);
    const sectors=new Map<number,THREE.Bone[]>();
    for(const f of found.sort((a,b)=>a.level-b.level)){
      if(!sectors.has(f.sector))sectors.set(f.sector,[]);
      sectors.get(f.sector)!.push(f.bone);
    }
    const first=found.find(f=>f.level===0)!.bone;
    this.hips=first.parent!;
    this.hips.getWorldQuaternion(_hipsQ);
    _hipsInv.copy(_hipsQ).invert();
    const hipsAt=this.hips.getWorldPosition(new THREE.Vector3());
    const down=new THREE.Vector3();
    const heads:{chain:Chain;angle:number;radius:number}[]=[];
    for(const bones of sectors.values()){
      const chain:Chain={links:[],reach:0,out:new THREE.Vector3(),half:.1,outWorld:new THREE.Vector3()};
      const ends:THREE.Vector3[]=bones.map(b=>b.getWorldPosition(new THREE.Vector3()));
      const last=bones[bones.length-1];
      const end=last.children.find(c=>(c as THREE.Bone).isBone);
      const tip=end?end.getWorldPosition(new THREE.Vector3()):ends[ends.length-1].clone().add(ends[ends.length-1].clone().sub(ends[0]).multiplyScalar(.5/Math.max(1,bones.length-1)));
      ends.push(tip);
      let reach=0;
      for(let i=bones.length-1;i>=0;i--){
        const length=ends[i].distanceTo(ends[i+1]);
        reach+=length;
        const axis=ends[i+1].clone().sub(ends[i]).normalize().applyQuaternion(bones[i].getWorldQuaternion(new THREE.Quaternion()).invert());
        chain.links.unshift({bone:bones[i],rest:bones[i].quaternion.clone(),axis,reach,length,chain});
      }
      chain.reach=reach;
      for(const link of chain.links)this.links.set(link.bone,link);
      down.add(_v.subVectors(tip,ends[0]).normalize());
      // The way out: from the pelvis's axis to the chain, flattened.
      _v.subVectors(ends[0],hipsAt).setY(0);
      const radius=Math.max(.05,_v2.subVectors(tip,hipsAt).setY(0).length());
      chain.out.copy(_v.lengthSq()>1e-8?_v.normalize():_v.set(0,0,-1)).applyQuaternion(_hipsInv);
      heads.push({chain,angle:Math.atan2(chain.out.x,chain.out.z),radius});
      this.chains.push(chain);
    }
    this.down.copy(down.lengthSq()>1e-8?down.normalize():WORLD_DOWN).applyQuaternion(_hipsInv);
    // Each chain carries the cloth half way to its neighbours round the pelvis.
    heads.sort((a,b)=>a.angle-b.angle);
    for(let i=0;i<heads.length;i++){
      const here=heads[i];
      let gap=Math.PI*2;
      for(const j of [i-1,i+1]){
        if(heads.length<2)break;
        const other=heads[(j+heads.length)%heads.length];
        let d=Math.abs(other.angle-here.angle);
        if(d>Math.PI)d=Math.PI*2-d;
        if(d>1e-4)gap=Math.min(gap,d);
      }
      here.chain.half=Math.max(.04,Math.min(.25,here.radius*Math.min(gap,Math.PI/2)*.5));
    }
    this.samples=this.spec.extra?[...SAMPLES,...this.spec.extra]:SAMPLES;
    const per=this.legs.length*this.samples.length;
    for(let i=0;i<per;i++){this.points.push(new THREE.Vector3());this.radii.push(0);}
  }

  /** Before the spring: the legs read, and each chain's authored direction hung and pushed out of them. */
  before(){
    // The legs' and the pelvis's matrices as the pose stands now (the leg pass and the floor may have moved them
    // since the last full update); everything below reads matrixWorld directly.
    for(const leg of this.legs)leg[leg.length-1].updateWorldMatrix(true,false);
    this.hips.updateWorldMatrix(true,false);
    this.readLegs();
    this.hips.matrixWorld.decompose(_v,_hipsQ,_v2);
    _hipsInv.copy(_hipsQ).invert();
    // Hang: turn the skirt's down toward the world's, by `hang` while the body is upright.
    _down.copy(this.down).applyQuaternion(_hipsQ);
    const upright=THREE.MathUtils.smoothstep(_down.dot(WORLD_DOWN),.3,.75);
    _turn.setFromUnitVectors(_down,WORLD_DOWN);
    _hang.slerpQuaternions(_q.identity(),_turn,this.spec.hang*this.hangScale*upright);
    this.axis.copy(_down).applyQuaternion(_hang);
    for(const chain of this.chains){
      chain.outWorld.copy(chain.out).applyQuaternion(_hipsQ).applyQuaternion(_hang);
      const root=chain.links[0];
      // World rotation the root would have, hung: hang * hips * rest.
      _q.copy(_hang).multiply(_hipsQ).multiply(root.rest);
      _d.copy(root.axis).applyQuaternion(_q);
      _head.copy(root.bone.position).applyMatrix4(this.hips.matrixWorld);
      const push=this.pushAngle(_head,_d,root.length,root.reach,chain);
      if(push>0){
        _side.crossVectors(_d,_n).normalize();
        _q.premultiply(_turn.setFromAxisAngle(_side,push));
        _d.copy(root.axis).applyQuaternion(_q);
        _v.copy(_d);
        if(this.capLift(_v))_q.premultiply(_turn.setFromUnitVectors(_d,_v));
      }
      // Local = hips^-1 * world.
      root.bone.quaternion.copy(_q2.copy(_hipsInv).multiply(_q));
    }
  }

  /** Inside the spring, after a link is solved: its direction (world, unit) turned out of the legs, in place. */
  collide(bone:THREE.Bone,head:THREE.Vector3,direction:THREE.Vector3){
    const link=this.links.get(bone);
    if(!link)return;
    const push=this.pushAngle(head,direction,link.length,link.reach,link.chain);
    if(push>0){
      _side.crossVectors(direction,_n).normalize();
      direction.applyAxisAngle(_side,push).normalize();
    }
    this.capLift(direction);
  }

  /** Turn `direction` (unit, world) back to `maxLift` off the hung axis if it stands further off; true if it did. */
  private capLift(direction:THREE.Vector3){
    const limit=THREE.MathUtils.degToRad(this.spec.maxLift),dot=THREE.MathUtils.clamp(direction.dot(this.axis),-1,1);
    if(Math.acos(dot)<=limit)return false;
    _v2.copy(direction).addScaledVector(this.axis,-dot);
    const across=_v2.length();
    if(across<1e-6)return false;
    direction.copy(this.axis).multiplyScalar(Math.cos(limit)).addScaledVector(_v2.divideScalar(across),Math.sin(limit)).normalize();
    return true;
  }

  private readLegs(){
    let k=0;
    const thigh=this.spec.legRadius;
    for(const leg of this.legs){
      for(const [segment,fraction,share] of this.samples){
        const a=leg[Math.min(segment,leg.length-1)],b=leg[Math.min(segment+1,leg.length-1)];
        _v.setFromMatrixPosition(a.matrixWorld);
        _v2.setFromMatrixPosition(b.matrixWorld);
        this.points[k].copy(_v).lerp(_v2,a===b?0:fraction);
        this.radii[k]=thigh*share;
        k++;
      }
    }
    this.count=k;
  }

  /** The turn (radians) that takes a link from `head` along `direction` for `span` metres out past every leg point
   *  in its strip of cloth, toward the chain's way out; `reach` is the rest of its chain from that head. Only the
   *  link's own span is cleared: the next link clears its own from where this one leaves it, so cloth hangs from the
   *  belt and bends out over a knee, rather than tilting as one cone from the belt. Leaves the way out, square to
   *  the link, in _n. */
  private pushAngle(head:THREE.Vector3,direction:THREE.Vector3,span:number,reach:number,chain:Chain){
    _n.copy(chain.outWorld).addScaledVector(direction,-chain.outWorld.dot(direction));
    const nl=_n.length();
    if(nl<1e-3)return 0;
    _n.divideScalar(nl);
    _side.crossVectors(direction,_n);
    const clearance=this.spec.clearance;
    // Measured from the chain's own head for the root, and from the link's for a deeper one: the band near the
    // root's head is the belt's.
    const top=Math.max(TOP_MIN,TOP*chain.reach)-(chain.reach-reach);
    let best=0;
    for(let i=0;i<this.count;i++){
      const p=this.points[i],r=this.radii[i];
      _v.subVectors(p,head);
      const along=_v.dot(direction);
      if(along<Math.max(.03,top)||along>span+r)continue;
      if(Math.abs(_v.dot(_side))>chain.half+r)continue;
      const need=_v.dot(_n)+r+clearance;
      if(need<=0)continue;
      best=Math.max(best,Math.atan2(need,along));
    }
    return Math.min(best,THREE.MathUtils.degToRad(this.spec.maxPush));
  }
}
