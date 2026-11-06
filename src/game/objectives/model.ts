import './siegeEnemies';
import type {FighterId,GameSnapshot,PlayerState,StageId} from '../types';
import type {Contribution,VillageView} from './lastStand';
import type {FighterProgress} from './fighterProgress';
// Protocol 10 adds seeded wave challenges and authoritative completion supplies.
// 11 (1 November 2026): lock combat - the fighters' light strings play it (game/lockCombat.ts).
export const OBJECTIVE_PROTOCOL=11;
export type ObjectiveKind='bad-blood'|'last-stand';
export type ObjectiveTeam='heroes'|'villains'|'defenders';
export type RolePreference=ObjectiveTeam|'auto';
export type ObjectiveAccess='quick'|'bots'|'solo'|'host'|'join';
export type ObjectivePhase='lobby'|'countdown'|'active'|'over';
export interface ObjectiveSeat extends Contribution {duty?:import('./defenderOrders').DefenderOrder;progress?:FighterProgress;id:string;fighter:PlayerState['fighter'];name:string;team:ObjectiveTeam;bot:boolean;disconnected?:boolean;reviveAt?:number;revivesLeft:number;rescue:number;down:boolean;}
export interface ObjectiveView {
  kind:ObjectiveKind;phase:ObjectivePhase;round:number;hostId:string|null;code?:string;access:ObjectiveAccess;
  seats:ObjectiveSeat[];capacity:number;startsAt:number|null;endsAt:number;startedAt:number;winner:ObjectiveTeam|'horde'|'draw'|null;reason:string;
  village?:VillageView;fillBots:boolean;
  /** A party launched the room, and whether it will deploy by itself (server PartyStart). */
  party?:boolean;autoStart?:boolean;
}
export type ObjectiveSnapshot=GameSnapshot&{objective:ObjectiveView};
export const objectiveOf=(snapshot:GameSnapshot|null|undefined):ObjectiveView|undefined=>(snapshot as ObjectiveSnapshot|undefined)?.objective;
export const OBJECTIVE_NAMES:Record<ObjectiveKind,string>={'bad-blood':'BAD BLOOD','last-stand':'LAST STAND'};
export const TEAM_NAMES:Record<ObjectiveTeam|'horde'|'draw',string>={heroes:'HEROES',villains:'VILLAINS',defenders:'DEFENDERS',horde:'THE HORDE',draw:'DRAW'};
export const OBJECTIVE_STAGE:Record<ObjectiveKind,StageId>={'bad-blood':'blood-citadel','last-stand':'hidden-ash'};
export const CAPACITY:Record<ObjectiveKind,number>={'bad-blood':6,'last-stand':4};
export const RULES={countdown:3,quickWait:12,soloWait:3,spawnShield:2,heroReviveSeconds:3,rescueSeconds:4,rescueRadius:3,villainMultiplier:1.3} as const;
/** Owner-confirmed on 4 October 2026. Reformed allies are Heroes; these arc antagonists are Villains. */
export const VILLAINS:readonly FighterId[]=['chohan','aqrab','hagure','hisame','irbis','amagoi','kubiwa','tokan','strappado','unari','barrow','senko','adad','shanxiao','shakugo','strix','oro','gorai','shiun','magatsu','vesper','imago','wuming','jirenga','jinlin','sekka','akagane'];
export const HEROES:readonly FighterId[]=['cardo','bruin','aquilo','svanhild','tsubute','yodaka','psyche','ovid','hawser','rotfalke','bonsho','murex','kinu','madake','akayuri','mizuhiki','shibuichi','rakucho','shidare','hinomoto','shakudo','minase','onigawara','torsion','highsun','ume','lanthorn','hikui','sashigane','gosu','kusushi','hakushi','suzuran','wataame','mikage','tempo','shijima','buna','tancho','bellows','akaito','oyashio','ampere','pyroclast','full-beam','basilissa','kuzu','sorayomi','taisei','konta','gummy','kenzo','kosho','ouga','shirokane','shiden','koko','nigo','kagari','ward','kuon','gaunt','setsu','haldor','sorrel','dorado','gohaku','ippon','tobari','asahi','levin','rook','gaku'];
export const isBadBloodFighter=(fighter:FighterId)=>HEROES.includes(fighter)||VILLAINS.includes(fighter);
export const factionOf=(fighter:FighterId):'heroes'|'villains'=>VILLAINS.includes(fighter)?'villains':'heroes';
export function isObjectiveKind(value:unknown):value is ObjectiveKind{return value==='bad-blood'||value==='last-stand';}
export const isRole=(value:unknown):value is RolePreference=>['heroes','villains','defenders','auto'].includes(String(value));
