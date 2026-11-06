import type {BufferGeometry} from 'three';

/** Minase's source body atlas already paints its garment folds. The inferred
 * concavity chains add polygon loops across its broad cloak panels (verified
 * with same-pose crease/shell A/B). Keep face softening, cel colour and the
 * silhouette hull; suppress only the inferred crease channel on this body.
 * Both the base and Sage export deliberately retain this mesh name. */
export function preserveMinasePaintedFolds(fighter:string,meshName:string,geometry:BufferGeometry):void{
  if(fighter!=='minase'||meshName!=='body_minase')return;
  const look=geometry.getAttribute('lookHead');
  if(!look||look.itemSize<3)return;
  for(let i=0;i<look.count;i++)look.setZ(i,0);
  look.needsUpdate=true;
}
