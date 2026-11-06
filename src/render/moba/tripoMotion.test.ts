import {expect,it} from 'vitest';
import {audit} from '../../../scripts/moba/audit-native-motion';
it('keeps all seven shipped Tripo rigs planted and in-place through every standing combat clip',async()=>{
 const rows=await audit();expect(rows).toHaveLength(7);
 for(const rig of rows)for(const clip of rig.clips){
  expect(clip.rootTravel,rig.url+' '+clip.name).toBeLessThan(.001);
  if(clip.name==='die')continue;
  expect(clip.feetMin,rig.url+' '+clip.name).toBeGreaterThan(-.005);
  expect(clip.feetMax,rig.url+' '+clip.name).toBeLessThan(.055);
  expect(clip.feetMax-clip.feetMin,rig.url+' '+clip.name).toBeLessThan(.001);
 }
});
