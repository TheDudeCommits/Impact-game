import {STAGES} from '../stages';
import type {GameSnapshot,StageId} from '../types';
export type CustomMode='royale'|'bad-blood'|'last-stand';
export type Difficulty='easy'|'normal'|'hard';
export interface CustomRules {arena:'auto'|'vote'|StageId; difficulty:Difficulty; seconds:number; goal:number; players:number;}
export interface CustomLobby {mode:CustomMode;rules:CustomRules;votes:Record<string,StageId>;endsAt?:number;}
export const ARENAS:Record<CustomMode,readonly StageId[]>={
  // Round 4b (MAPS): not the harbour - its canal eliminates without warning,
  // and a blind critic asked for it out of the battle royale altogether.
  royale:['sunward-summit','ashfall-weir','mirror-mere','hollowmere-quarry','ash-colosseum','wreckers-causeway','sunfall-arena','zenith-coliseum','warlords-roof','drifting-isle','cinder-flats','dry-harbour','thornwood-ward','kuroyuki-hall','starfall-crater','scrap-pit'],
  'bad-blood':['blood-citadel','warlords-roof','drifting-isle','ash-colosseum','cinder-flats'],
  'last-stand':['hidden-ash'],
};
/** Where a private Duel can be fought (a party's DUEL chooses one; PrivateDuelRoom refuses anything else): the
 *  tournament ring first, as every Duel was until the party could choose, then the other rings and the royale's
 *  famous places - every one of them a stage the arena rooms already run. */
export const DUEL_ARENAS:readonly StageId[]=['sunfall-arena','zenith-coliseum','proving-hall','drifting-isle','ashfall-weir','sunward-summit','mirror-mere','hollowmere-quarry','ash-colosseum','wreckers-causeway','warlords-roof','cinder-flats','dry-harbour','thornwood-ward','kuroyuki-hall','starfall-crater','scrap-pit'];
/** A Duel's stage from a room option: one of DUEL_ARENAS, else the tournament ring. */
export const duelStage=(raw:unknown):StageId=>typeof raw==='string'&&DUEL_ARENAS.includes(raw as StageId)?raw as StageId:'sunfall-arena';
export const DURATIONS=[180,240,300,600] as const;
export function defaultRules(mode:CustomMode):CustomRules{return {arena:'auto',difficulty:'normal',seconds:0,goal:120,players:8};}
/** Strict allowlist: a browser can choose a preset, never inject arbitrary simulation values. */
export function customRules(mode:CustomMode,raw:unknown,base=defaultRules(mode)):CustomRules{
  const r=raw&&typeof raw==='object'?raw as Record<string,unknown>:{};
  return {arena:mode==='last-stand'?'auto':r.arena==='auto'||r.arena==='vote'||ARENAS[mode].includes(r.arena as StageId)?r.arena as CustomRules['arena']:base.arena,
    difficulty:['easy','normal','hard'].includes(String(r.difficulty))?r.difficulty as Difficulty:base.difficulty,
    seconds:mode!=='royale'?0:DURATIONS.includes(r.seconds as never)||mode==='royale'&&r.seconds===0?r.seconds as number:base.seconds,
    goal:[60,120,180].includes(r.goal as number)?r.goal as number:base.goal,
    players:[2,4,8,12].includes(r.players as number)?r.players as number:base.players};
}
export function votedArena(lobby:CustomLobby,fallback:StageId):StageId{
  if(lobby.rules.arena==='auto')return fallback;
  if(lobby.rules.arena!=='vote')return lobby.rules.arena;
  const counts=new Map<StageId,number>();for(const stage of Object.values(lobby.votes))if(ARENAS[lobby.mode].includes(stage))counts.set(stage,(counts.get(stage)??0)+1);
  // Stable list order breaks ties; zero votes retains the ordinary arena choice.
  return [...ARENAS[lobby.mode]].sort((a,b)=>(counts.get(b)??0)-(counts.get(a)??0)).find(s=>counts.has(s))??fallback;
}
export const customOf=(s:GameSnapshot|null|undefined)=>(s as (GameSnapshot&{custom?:CustomLobby})|null|undefined)?.custom;
export const BOT_SKILL:Record<Difficulty,number>={easy:.1,normal:.5,hard:.95};
export const arenaName=(id:StageId)=>STAGES[id].name;
