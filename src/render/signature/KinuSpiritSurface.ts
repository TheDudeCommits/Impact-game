import type {Object3D,Vector3} from 'three';

/** The spirit's actual armored knuckles; measured on the accepted native GLB.
 * Wrist origins sit roughly13cm behind these contact surfaces. */
export const KINU_STAND_SURFACES = {
  "right": [
    0.02441114839091396,
    0.1325946772682668,
    -0.019559541021090143
  ],
  "left": [
    -0.02459577698600035,
    0.13133310084461103,
    -0.02064003833535688
  ],
  "rightFinish": [
    -0.002648994644525282,
    0.13831051513026438,
    -0.0038598099491509164
  ],
  "leftFinish": [
    0.0018358536200524522,
    0.13791695172432672,
    -0.004767784545848586
  ]
} as const;

/** Caller supplies the actual displayed spirit hand, never the human command hand.
 * The final cross has a different leading knuckle, without changing the rig. */
export function kinuSpiritSurfacePoint(hand:Object3D,clip:string|undefined,index:number,out:Vector3):Vector3 {
  const left=hand.name==='LeftHand';
  const finish=(clip==='Broken Shackles'&&index===7)||(clip==='BUCHI BUCHI Barrage'&&index===2);
  const p=left?(finish?KINU_STAND_SURFACES.leftFinish:KINU_STAND_SURFACES.left):(finish?KINU_STAND_SURFACES.rightFinish:KINU_STAND_SURFACES.right);
  return hand.localToWorld(out.set(p[0],p[1],p[2]));
}
