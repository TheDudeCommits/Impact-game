import './siegeEnemies';
import {ENEMIES} from '../../survival/enemies';
import {RESTING} from '../../survival/bosses';

export type TrapTheme='wire'|'purify'|'harpoon'|'discharge';
export interface SiegeChapter {
  id:string; title:string; army:number; commanders:readonly string[];
  low:readonly string[]; mid:readonly string[]; trap:TrapTheme;
}
/** A chapter keeps one army and one final commander for ten waves.
 * Every previously scheduled boss remains reachable; no unrelated navy escort. */
export const SIEGE_CHAPTERS:readonly SiegeChapter[]=[
  {id:'naval-blockade',title:'THE DUNE BLOCKADE',army:0,commanders:['caldera'],low:['gantry'],mid:['rime','lumen'],trap:'harpoon'},
  {id:'hollow-moon',title:'THE CINDER MOON',army:2,commanders:['shiun'],low:['zarek','nightfall'],mid:['nihil','dune-oni'],trap:'purify'},
  {id:'ash-siege',title:'SHADOWS OF THE ASH',army:1,commanders:['akagane'],low:['siege-raider-captain'],mid:['siege-raider-brute'],trap:'wire'},
  {id:'emperor-raid',title:'THE WARLORDS’ RAID',army:4,commanders:['gorai','barrow','haldor'],low:['ashwing'],mid:['ashwing'],trap:'harpoon'},
  {id:'zero-mortals',title:'THE BURNING SKY',army:3,commanders:['banjaku','wuming','jinlin'],low:['siege-imp-captain'],mid:['wuming','jinlin'],trap:'discharge'},
  {id:'government-agents',title:'ORDERS TO ERASE',army:5,commanders:['kade'],low:['takane','harrow','kanuki'],mid:['takane','harrow'],trap:'wire'},
  {id:'sugar-isle',title:'THE MOTHER’S COURT',army:6,commanders:['mirabel'],low:['siege-sentinel-captain'],mid:['kuromitsu'],trap:'harpoon'},
  {id:'cursed-night',title:'NIGHT OF HEXES',army:7,commanders:['magatsu'],low:['siege-puppet-captain'],mid:['siege-puppet-brute'],trap:'purify'},
  {id:'ant-invasion',title:'THE JUNKYARD THRONE',army:8,commanders:['imago'],low:['siege-ghoul-captain'],mid:['siege-ghoul-brute'],trap:'wire'},
  {id:'eclipse',title:'UNDER THE FALLEN STAR',army:9,commanders:['vesper'],low:['siege-knight-captain'],mid:['siege-knight-brute'],trap:'purify'},
  {id:'eternal-night',title:'THE ENDLESS NIGHT',army:10,commanders:['oro'],low:['siege-thrall-captain'],mid:['siege-thrall-brute'],trap:'purify'},
];
export const TRIBUNAL_GUARD_BOSSES=new Set(['gantry','rime','lumen','caldera']);
const hash=(n:number)=>{n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);return (n^(n>>>16))>>>0;};
const fielded=(ids:readonly string[])=>ids.filter(id=>!RESTING.has(id));
const CAPTAINS=['tribunal-lieutenant',...['raider','wraith','imp','corsair','lantern','sentinel','puppet','ghoul','knight','thrall'].map(f=>`siege-${f}-captain`)];
export function siegeChapter(wave:number,seed:number){
  const chapter=Math.floor((Math.max(1,Math.floor(wave))-1)/10);
  const deck=SIEGE_CHAPTERS.map((entry,i)=>({entry,key:hash((seed|0)^Math.imul(i+1,2654435761))})).sort((a,b)=>a.key-b.key);
  const definition=deck[chapter%deck.length].entry;
  const commanders=fielded(definition.commanders).length?fielded(definition.commanders):[CAPTAINS[definition.army]];
  const commander=commanders[hash((seed|0)+chapter*104729)%commanders.length];
  return {definition,number:chapter+1,firstWave:chapter*10+1,lastWave:chapter*10+10,commander};
}
export function chapterBoss(wave:number,seed:number,tier:'low'|'mid'|'high'|null){
  if(!tier)return null;
  const chapter=siegeChapter(wave,seed);
  if(tier==='high')return chapter.commander;
  const pool=fielded(chapter.definition[tier]).filter(id=>id!==chapter.commander);
  return pool.length?pool[hash((seed|0)+wave*7919)%pool.length]:CAPTAINS[chapter.definition.army];
}
for(const c of SIEGE_CHAPTERS)for(const id of fielded([...c.commanders,...c.low,...c.mid])){
  if(!ENEMIES[id]?.model||!ENEMIES[id]?.moves.length)throw new Error(`Unplayable chapter encounter: ${c.id}/${id}`);
  if(c.army===0&&!TRIBUNAL_GUARD_BOSSES.has(id))throw new Error(`A boss outside the Tribunal fielded with it: ${id}`);
}
