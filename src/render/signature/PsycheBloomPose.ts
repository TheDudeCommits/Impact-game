import * as T from 'three';
import type {Fighter} from '../Fighter';
import {psycheReceiverArm} from './PsycheReceiver';

/** The actual exported native palm-surface vertex551, in all eight morphs.
 * No invented fist or wrist-origin proxy is used as the contact surface. */
export const PSYCHE_PALM_SURFACES:readonly (readonly [number,number,number])[] = [
 [-.044798851,.049214363,.122490853],[-.044799000,.049214482,.182153821],
 [-.044799000,.049214602,.241816878],[-.044799089,.049214602,.301480204],
 [-.044798791,.049214721,.361143023],[-.044798851,.049214602,.420806170],
 [-.044799179,.049214840,.480469406],[-.045028061,.049950480,.481149435],
];
export const PSYCHE_ARM_COMMANDS:Readonly<Record<string,{duration:number;peak:number;clutch?:boolean;count:number}>>={
 'Moth Palm':{duration:.5,peak:.44,count:2},'Rush 1':{duration:.5,peak:.44,count:2},
 'Rush 2':{duration:.6,peak:.44,count:2},'Rush 3':{duration:.783333333,peak:.56,count:4,clutch:true},
 'Clasping Wings':{duration:.9,peak:.56,count:4,clutch:true},
 'Wing Twist':{duration:.683333333,peak:.56,count:3,clutch:true},
 'Rising Swarm':{duration:.816666667,peak:.52,count:4,clutch:true},
 'Grasping Swarm':{duration:.933333333,peak:.56,count:4,clutch:true},
 'Swarm Push':{duration:1.033333333,peak:.58,count:2},
 'Aerial Wing':{duration:.783333333,peak:.44,count:2},
 'Moth Descent':{duration:.916666667,peak:.56,count:4},
 'Ruin Palm':{duration:1.2,peak:.58,count:1},
 'Silk Cocoon':{duration:3.75,peak:.14,count:2},
 'VIOLET SWARM':{duration:2.3,peak:.64,count:6},
};
export const psycheArmClamp=(n:number)=>Math.max(0,Math.min(1,n));
const smooth=(n:number)=>{const t=psycheArmClamp(n);return t*t*(3-2*t);};
const one=new T.Vector3(1,1,1),axis=new T.Vector3(),native=new T.Vector3(),point=new T.Vector3(),q=new T.Quaternion();
export interface PsycheArmPose {matrix:T.Matrix4;root:T.Vector3;palm:T.Vector3;weights:number[];presence:number;clutch:number;scale:number}
export function newPsycheArmPose():PsycheArmPose{return{matrix:new T.Matrix4(),root:new T.Vector3(),palm:new T.Vector3(),weights:Array(7).fill(0),presence:0,clutch:0,scale:1};}
export function psycheArmMorph(out:PsycheArmPose,extension:number,clutch:number){
 out.weights.fill(0);const stage=psycheArmClamp(extension)*6,lo=Math.min(6,Math.floor(stage)),blend=stage-lo,c=psycheArmClamp(clutch);
 if(lo>0)out.weights[lo-1]=(1-blend)*(1-c);if(lo<6)out.weights[lo]=blend*(1-c);out.weights[6]=c;
 out.palm.fromArray(PSYCHE_PALM_SURFACES[0]);
 for(let i=0;i<7;i++)if(out.weights[i]){native.fromArray(PSYCHE_PALM_SURFACES[i+1]).sub(point.fromArray(PSYCHE_PALM_SURFACES[0]));out.palm.addScaledVector(native,out.weights[i]);}
 out.clutch=c;
}
/** Build one world-space matrix from native anatomy. The visible vertex and
 * shared Fighter contact use the same matrix and morph interpolation. */
export function psychePlaceArm(out:PsycheArmPose,root:T.Vector3,end:T.Vector3,extension:number,presence:number,clutch=0,alignClutch=false){
 out.root.copy(root);out.presence=psycheArmClamp(presence);psycheArmMorph(out,extension,clutch);
 native.fromArray(PSYCHE_PALM_SURFACES[6]);if(alignClutch)native.lerp(point.fromArray(PSYCHE_PALM_SURFACES[7]),psycheArmClamp(clutch));const nativeLength=native.length();axis.subVectors(end,root);out.scale=axis.length()/nativeLength;
 q.setFromUnitVectors(native.multiplyScalar(1/nativeLength),axis.normalize());one.setScalar(out.scale*Math.max(.001,out.presence));out.matrix.compose(root,q,one);out.palm.applyMatrix4(out.matrix);return out;
}
type Receiver=Pick<Fighter,'state'|'group'|'model'|'shownBody'|'drawnJoint'>;
type Actor=Pick<Fighter,'state'|'group'>&{readonly displayedOpponent?:Receiver};
const root=new T.Vector3(),end=new T.Vector3();
/** Explicit source clock: do not substitute gameplay seconds for retimed clips. */
export function psycheArmPose(f:Actor,out:PsycheArmPose,clip:string,seconds:number,index=0,contactIndex?:number,receiver=f.displayedOpponent){
 const c=PSYCHE_ARM_COMMANDS[clip];out.presence=0;if(!c||!f.state.alive||f.state.whiffedAt!==undefined)return out;
 const phase=psycheArmClamp(seconds/c.duration),side=index%2===0?1:-1,row=Math.floor(index/2);
 let peak=c.peak,clutch=0;
 if(clip==='Silk Cocoon')peak=contactIndex===2?.82:contactIndex===1?.43:phase<.285?.14:phase<.625?.43:.82;
 const grow=smooth(phase/Math.max(.05,peak*.48)),retract=1-smooth((phase-peak-.10)/Math.max(.1,1-peak-.10));
 let presence=grow*retract,extension=smooth(phase/peak)*retract;
 if(c.clutch||clip==='Silk Cocoon'&&peak>.14)clutch=smooth((phase-peak+.08)/.08)*retract;
 if(clip==='Silk Cocoon'){
  // One continuously grown contact arm through the three beats. Selecting a
  // new stage must not reset extension or pop its fingers at .285/.625.
  const release=1-smooth((phase-.88)/.12);
  presence=smooth(phase/.0672)*release;extension=smooth(phase/.14)*release;
  clutch=smooth((phase-.28)/.15)*release;
 }
 // Ordinary blooms attach to the real receiver-facing skin. Their entire
 // native arm (including the contact vertex) uses this placement; no hidden
 // endpoint is moved independently. Special/entry/final Clutch stay intact.
 if(clip!=='Silk Cocoon'&&clip!=='Ruin Palm'&&clip!=='VIOLET SWARM'&&psycheReceiverArm(f,receiver,clip,index,root,end)){
  // Aim using the actual full-extension/clutch surface, continuously. This
  // avoids a separate endpoint correction when the fingers close.
  return psychePlaceArm(out,root,end,extension,presence,clutch,true);
 }
 root.set(side*(.47+row*.13),.95+row*.28,.39);
 // Preserve the primary surface exactly. The paired decorative hands frame
 // the outside of the torso/shoulders instead of stacking inside its centre.
 end.set(index===0?0:side*(row?.32:.28),1.10+row*.32,1.30);
 if(clip==='Rush 2'||clip==='Wing Twist'){root.x*=-1;end.x*=-1;}
 if(clip==='Rising Swarm'){root.y=.35;end.y=1.34;}
 if(clip==='Moth Descent'){root.y=1.52;end.y=.28;end.z=1.17;}
 if(clip==='Ruin Palm'){root.set(.38,1.09,.25);end.set(0,1.16,1.32);}
 if(clip==='VIOLET SWARM'){
  const theta=(index/5-.5)*Math.PI*.86;root.set(side*.29,1.24,-.30);end.set(Math.sin(theta)*1.47,1.24+Math.cos(theta)*1.44,-.36);
 }
 root.applyMatrix4(f.group.matrixWorld);end.applyMatrix4(f.group.matrixWorld);
 return psychePlaceArm(out,root,end,extension,presence,clutch);
}
const contactPose=newPsycheArmPose();
/** Integration hook for strikePoint/chargePoint/meleeContactPoint. */
export function psycheStrikePoint(f:Actor,out:T.Vector3,clip?:string,sourceSeconds=0,index?:number,receiver=f.displayedOpponent){
 if(!clip||!PSYCHE_ARM_COMMANDS[clip])return false;psycheArmPose(f,contactPose,clip,sourceSeconds,0,index,receiver);out.copy(contactPose.palm);return contactPose.presence>.001;
}
