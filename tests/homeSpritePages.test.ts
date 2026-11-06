import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import manifest from '../public/assets/home/sprites/manifest.json';
import {HOME_ASSETS,HOME_ROSTER} from '../src/ui/MangaHome';

const hash=(file:string)=>createHash('sha256').update(readFileSync(new URL(`../public/assets/home/sprites/${file}`,import.meta.url))).digest('hex');
type Row={id:string;file:string;frameCount?:number;columns?:number;runtimePagesSourceSha256?:string;runtimePages?:{file:string;sha256:string;firstFrame:number;frameCount:number;width:number;height:number;bytes:number}[]};
describe('published progressive sprite library',()=>{
  it('ships every page in order and detects stale pages after a canonical art replacement',()=>{
    for(const row of manifest.fighters as Row[]){
      expect(row.runtimePagesSourceSha256,row.id).toBe(hash(row.file));
      expect(row.runtimePages?.length,row.id).toBeGreaterThan(0);
      let first=0;
      for(const page of row.runtimePages!){
        expect(page.firstFrame,row.id).toBe(first);first+=page.frameCount;
        expect(page.width).toBe(384*(row.columns??4));
        expect(page.height).toBe(512*page.frameCount/(row.columns??4));
        expect(page.sha256,page.file).toBe(hash(page.file));
        if((HOME_ROSTER as readonly string[]).includes(row.id))expect(HOME_ASSETS,page.file).toContain(`/assets/home/sprites/${page.file}`);
      }
      expect(first,row.id).toBe(row.frameCount??16);
    }
  });
  it('retains every drawn cel in its motion timing and keeps quicker source transitions',()=>{
    for(const row of manifest.fighters){
      type Timing={frameTimesMs:number[];loopMs:number};
      const timing=(row as {motionTiming?:Timing;timing?:Timing}).motionTiming??(row as {timing?:Timing}).timing;
      if(!timing)continue;
      expect(timing.frameTimesMs.length,row.id).toBe('frameCount' in row?row.frameCount:16);
      expect(timing.frameTimesMs[0]).toBe(0);
      expect(timing.loopMs).toBeGreaterThan(timing.frameTimesMs.at(-1)!);
      expect(timing.frameTimesMs.every((time,i)=>i===0||time>timing.frameTimesMs[i-1]),row.id).toBe(true);
    }
  });
});
