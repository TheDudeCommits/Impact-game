// Vendored from the VFX Armory @ 734f147f3 by scripts/engine/armory/vendor.mts; do not edit.
// @ts-nocheck
import {ease} from '../elemental/ElementalVisuals';
import type {ShadowHandRig} from './ShadowHandRig';
import type {ShadowPose} from './ShadowColossusTimeline';
export function animateShadowHand(hand:ShadowHandRig,t:number,p:ShadowPose):void{
  const side=hand.side,rise=side===-1?p.left:p.right,recoil=ease((t-5.55)/.13)*(1-ease((t-5.85)/.35));
  const distance=6.6-p.grasp*1.7-p.crush*3.05+p.release*2.25+recoil*.45;
  hand.root.position.set(side*distance,-18*(1-rise)-p.crush*1.6-p.sink*9,.35+side*.45);
  hand.root.rotation.set(.04*Math.sin(t*.6+side),-side*(.68+p.target*(Math.PI*.5-.68)),side*(.025+recoil*.03));
  hand.wrist.rotation.set(-.21*(1-p.target)+p.grasp*.06,side*.045*p.grasp,side*.07*(1-p.open));
  const curl=(.57*(1-p.open)+p.grasp*.36+p.crush*.55)*(1-p.release)+p.release*.18;
  for(let f=0;f<5;f++){const digit=hand.fingers[f],spread=[-.11,-.035,.04,.12,0][f];digit.root.rotation.z=digit.thumb?.86-p.grasp*.18:spread*(.35+p.open*.85)*(1-p.crush*.5);digit.root.rotation.y=digit.thumb?-.42+p.grasp*.2:0;
    for(let j=0;j<3;j++){const limit=digit.thumb?[.85,1.05,.8][j]:[1.13,1.33,1.02][j],motion=Math.sin(t*(.7+f*.06)+f*1.7+side)*.012*(1-p.crush);digit.joints[j].rotation.x=Math.max(.015,Math.min(limit,curl*limit+motion));digit.joints[j].rotation.z=j===0&&!digit.thumb?spread*p.open*.25:0;}
  }
  hand.root.updateWorldMatrix(true,true);
}
