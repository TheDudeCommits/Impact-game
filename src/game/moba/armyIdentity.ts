import {GRUNTS} from '../../survival/horde/kinds';
import {RIFT_BODY_HEIGHT,type RiftUnit,type RiftStructure} from './model';
const find=(id:string)=>GRUNTS.findIndex(g=>g.id===id);
const DAWN={melee:find('cutthroat'),ranged:find('tribunal-guard-rifle'),siege:find('automaton'),super:find('tribunal-guard-shield')};
const ECLIPSE={melee:find('ash-wraith'),ranged:find('ash-caster'),siege:find('great-wraith'),super:find('graft-brute')};
export const riftGruntKind=(unit:Pick<RiftUnit,'team'|'kind'>)=>unit.kind==='boss'?find('rift-spawn'):unit.kind==='camp'?find('pale-sapling'):(unit.team==='heroes'?DAWN:ECLIPSE)[unit.kind];
export const RIFT_TROOP_HEIGHTS:Record<string,number>={'cutthroat':1.95,'tribunal-guard-rifle':1.9,automaton:3.2,'tribunal-guard-shield':2.5,'ash-wraith':2.1,'ash-caster':2.15,'great-wraith':3.6,'graft-brute':2.8};
export const riftUnitHeight=(unit:Pick<RiftUnit,'team'|'kind'|'empowered'>)=>{const def=GRUNTS[riftGruntKind(unit)];return (RIFT_TROOP_HEIGHTS[def.id]??def.height)*(unit.empowered?1.15:1);};
export const riftUnitName=(unit:Pick<RiftUnit,'team'|'kind'>)=>unit.kind==='boss'?'Rift Guardian':unit.kind==='camp'?'Moss Revenant':(unit.team==='heroes'?{melee:'Dawn Sentinel',ranged:'Seal Weaver',siege:'Temple Guardian',super:'Dawn Vindicator'}:{melee:'Eclipse Reaver',ranged:'Curse Hexer',siege:'Oni Siege Brute',super:'Eclipse Executioner'})[unit.kind];

/** The same height drives authoritative contacts and owner prediction. */
export function riftCombatHeight(body:{team:RiftUnit['team'];kind:RiftUnit['kind']|RiftStructure['kind'];empowered?:boolean}){
  const kind=body.kind;
  return kind==='core'||kind==='tower'||kind==='guardian'||kind==='barracks'?RIFT_BODY_HEIGHT[kind]:riftUnitHeight({team:body.team,kind,empowered:body.empowered??false});
}
