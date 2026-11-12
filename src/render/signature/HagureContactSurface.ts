import * as THREE from 'three';
/** Measured native hand-skin points. Palm points stay below the finger roots;
 * the knife point uses the little-finger-side edge. No wrist approximation. */
export const HAGURE_CONTACT_SURFACES = {
  "base": {
    "light": [
      -0.020324474388614153,
      0.048091598384408366,
      -0.030689163804532245
    ],
    "heavy": [
      0.02116269589551445,
      0.047962964048241075,
      -0.03031043857741389
    ],
    "knife": [
      0.042663593190457316,
      0.06505834852358322,
      -0.026601391901106552
    ],
    "right-fist": [
      -0.009417755123082959,
      0.06801653513975424,
      -0.04755360262923801
    ],
    "left-fist": [
      0.02328867014656777,
      0.07686232925999703,
      -0.03624850753014608
    ],
    "ultimate-fist": [
      -0.000011867077880367564,
      0.08627079676839224,
      -0.005434400769657178
    ]
  },
  "moonless": {
    "light": [
      0.02586354473560709,
      0.05192509177487792,
      0.036945940898513885
    ],
    "heavy": [
      -0.025733608968287802,
      0.058142701385370366,
      0.03527937147070248
    ],
    "knife": [
      -0.0463054115296151,
      0.12994985448669485,
      -0.002535001828588346
    ],
    "right-fist": [
      -0.025844726779761518,
      0.14803493306412752,
      0.016025387987262496
    ],
    "left-fist": [
      0.024425686355549092,
      0.14214328882334493,
      0.013205936108653726
    ],
    "ultimate-fist": [
      -0.0267837410539249,
      0.14959222906488925,
      0.012636823615332807
    ]
  }
} as const;
export type HagureSurface = keyof typeof HAGURE_CONTACT_SURFACES.base;
export function hagureSurfaceKind(action:string,clip?:string,index=0):HagureSurface {
 if(action==='ultimate'&&(!clip||clip==='Pack of One'))return (['light','heavy','right-fist','left-fist','ultimate-fist'] as const)[Math.max(0,Math.min(4,index))];
 if(['Mauling Palm','Rush 2','Turnaside Hand','Falling Maul'].includes(clip??''))return 'heavy';
 if(['Howling Spin','Rush 3','Howling Break','Feral Lunge','Moonfall Break'].includes(clip??''))return 'knife';
 if(!clip&&action==='heavy')return 'heavy';
 if(!clip&&action==='special')return 'knife';
 return 'light';
}
/** Caller passes the actual shown body's native hand and form identity. */
export function hagureSurfacePoint(hand:THREE.Object3D,moonless:boolean,action:string,clip:string|undefined,index:number,out:THREE.Vector3){
 const p=HAGURE_CONTACT_SURFACES[moonless?'moonless':'base'][hagureSurfaceKind(action,clip,index)];
 return hand.localToWorld(out.set(p[0],p[1],p[2]));
}
