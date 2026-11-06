import { applyOriginalMusic, applyOriginalSeries, originalUniverse, soundtrackQueue, type SoundtrackContext } from '../originals/apply';
import { gateMusic } from '../originals/launch';
import { ORIGINAL_RIFT, ORIGINAL_SCORE, SOUNDTRACK as ORIGINAL_SOUNDTRACK } from '../originals/score';
export type MusicPhase = 'lobby' | 'combat' | 'results';
/** The worlds whose fighters fight to a theme of their own (src/originals/score.ts ORIGINAL_SCORE). */
export type AnimeSeries = 'last-sun' | 'konta' | 'dust-sea' | 'gilded-ruin' | 'cinder-requiem' | 'hex-fallout' | 'grave-hound' | 'salvage-wilds';
export interface MusicTrack { id: string; title: string; artist: string; series: AnimeSeries | 'rift'; category: 'opening' | 'ending' | 'score' | 'film-theme'; url: string; scope: 'homescreen' | 'gameplay'
  stinger?: boolean
  boss?: boolean }

/** A piece of the original score (src/originals/score.ts), under the key its `replaces` names. */
function piece(source:{readonly url:string;readonly title:string;readonly artist:string;readonly replaces:readonly string[]},series:MusicTrack['series']):MusicTrack {
  return {id:source.replaces[0],title:source.title,artist:source.artist,series,category:'score',scope:'gameplay',url:source.url};
}
const [SKYBORN,GALE,SET_SAIL,CINDER,GILDED,NULL,GRAVE,STATIC]=ORIGINAL_SCORE;
const [UNBOUND,RITE,APEX,LAST_LIGHT,NIGHT_WATCH]=ORIGINAL_RIFT;
/** The original score: each world's theme, and the pieces written for the Rift (Arcade Survival). */
export const MUSIC_TRACKS:Record<string,MusicTrack>=Object.fromEntries([
  piece(SKYBORN,'last-sun'),piece(GALE,'konta'),piece(SET_SAIL,'dust-sea'),piece(CINDER,'cinder-requiem'),
  piece(GILDED,'gilded-ruin'),piece(NULL,'hex-fallout'),piece(GRAVE,'grave-hound'),piece(STATIC,'salvage-wilds'),
  piece(UNBOUND,'rift'),piece(RITE,'rift'),piece(APEX,'rift'),piece(LAST_LIGHT,'rift'),piece(NIGHT_WATCH,'rift'),
].map(track=>[track.id,track]));
/** Arcade survival's last stand: one dark, heavy playlist for the whole run,
 *  whatever universe the round's boss is from, so the score does not lurch
 *  every forty seconds. */
export const SURVIVAL_MUSIC:readonly MusicTrack[]=[
  MUSIC_TRACKS['originals-rift-unbound'],
  MUSIC_TRACKS['originals-cinder-requiem'],
  MUSIC_TRACKS['originals-rite-of-ashes'],
  MUSIC_TRACKS['originals-set-sail'],
  MUSIC_TRACKS['originals-apex-of-the-rift'],
  MUSIC_TRACKS['originals-last-light'],
];
/** The pseudo-fighter a survival run asks the music for: 'rift', or while a
 *  run is on 'rift:<series>:<moment>' (riftMoment). A live binding on
 *  purpose: the frame loop reads it each frame, so the run changes the score
 *  by changing it. */
export let RIFT_SCORE='rift';
/** Where the run is: the series of the round's boss (none: the Rift's own
 *  scores), and whether its horde is being cut through or the boss fought. */
export function riftMoment(series:AnimeSeries|undefined,moment:'hunt'|'boss',round=0){RIFT_SCORE=`rift:${series??'rift'}:${moment}:${round}`;}
export function riftMomentReset(){RIFT_SCORE='rift';}
/** Each world's music for a round of its boss: the horde to its theme, the boss to its theme and the Rift's darkest
 *  pieces - every piece of the score in the rotation somewhere. */
const RIFT_SONGS:Record<AnimeSeries,{hunt:readonly string[];boss:readonly string[]}>={
  'dust-sea':{hunt:['originals-set-sail'],boss:['originals-set-sail']},
  'cinder-requiem':{hunt:['originals-cinder-requiem'],boss:['originals-cinder-requiem','originals-last-light']},
  'last-sun':{hunt:['originals-skyborn-ascent'],boss:['originals-skyborn-ascent']},
  konta:{hunt:['originals-gale-runner'],boss:['originals-rite-of-ashes','originals-long-night-watch']},
  'gilded-ruin':{hunt:['originals-gilded-hour'],boss:['originals-gilded-hour']},
  'hex-fallout':{hunt:['originals-endless-null'],boss:['originals-endless-null']},
  'grave-hound':{hunt:['originals-grave-road'],boss:['originals-rift-unbound']},
  'salvage-wilds':{hunt:['originals-static-trail'],boss:['originals-apex-of-the-rift']},
};
const riftTrack=(id:string)=>MUSIC_TRACKS[id]??SURVIVAL_MUSIC.find(t=>t.id===id);
/** A universe as the bosses name it (BossEntry.universe), as a series of the soundtrack. */
export function seriesOfUniverse(universe:string|undefined):AnimeSeries|undefined{
  const original=originalUniverse(universe??''); if(original)return original as AnimeSeries;
  return (universe??'').toUpperCase().includes('KONTA')?'konta':undefined;
}
import { FIGHTER_SERIES as CARD_SERIES } from '../game/fighterSeries';
/** The soundtrack's series for each series a card names: a fighter's music is its card's series (src/config.ts, read
 *  here as the server's copy, src/game/fighterSeries.ts), so it is written in one place. */
const SOUNDTRACK:Readonly<Record<string,AnimeSeries>>={
  'Last Sun':'last-sun',Konta:'konta','Hidden Ash':'konta','Dust Sea':'dust-sea','Gilded Ruin':'gilded-ruin',
  'Cinder Requiem':'cinder-requiem','Hex Fallout':'hex-fallout','Grave Hound':'grave-hound','Salvage Wilds':'salvage-wilds',
};
export const FIGHTER_SERIES:Record<string,AnimeSeries>=Object.fromEntries(Object.entries(CARD_SERIES).flatMap(([id,series])=>SOUNDTRACK[series]?[[id,SOUNDTRACK[series]]]:[]));
/** The fighters whose world has no theme of its own (Blast Radius's, Black Snow's, Beacon Ward's...): they
 *  fight to the battle scores. */
const SCORED_FIGHTERS=new Set<string>(Object.keys(CARD_SERIES).filter(id=>!FIGHTER_SERIES[id]));
/** The home screen's rotation (src/originals/score.ts SOUNDTRACK.home). */
export const HOME_MUSIC_IDS:readonly string[]=ORIGINAL_SOUNDTRACK.home.map(track=>track.id);
applyOriginalMusic(MUSIC_TRACKS);
gateMusic(MUSIC_TRACKS, SURVIVAL_MUSIC);
const phases:Record<AnimeSeries,Record<Exclude<MusicPhase,'lobby'>,string>>={
  'last-sun':{combat:'originals-skyborn-ascent',results:'originals-skyborn-ascent'},
  konta:{combat:'originals-gale-runner',results:'originals-gale-runner'},
  'dust-sea':{combat:'originals-set-sail',results:'originals-set-sail'},
  'gilded-ruin':{combat:'originals-gilded-hour',results:'originals-gilded-hour'},
  'cinder-requiem':{combat:'originals-cinder-requiem',results:'originals-cinder-requiem'},
  'hex-fallout':{combat:'originals-endless-null',results:'originals-endless-null'},
  'grave-hound':{combat:'originals-grave-road',results:'originals-grave-road'},
  'salvage-wilds':{combat:'originals-static-trail',results:'originals-static-trail'},
};
applyOriginalSeries(MUSIC_TRACKS, FIGHTER_SERIES, phases, SCORED_FIGHTERS);
/** Home has an exclusive playlist. In-game queues match the player and current opponent. */
export function selectMusicTracks(localFighter:string,opponentFighter:string|undefined,phase:MusicPhase,context?:SoundtrackContext):MusicTrack[]{
  const queue=fighterTracks(localFighter,opponentFighter,phase);
  return phase==='lobby'?queue:soundtrackQueue(MUSIC_TRACKS,queue,localFighter,phase,context);
}
function fighterTracks(localFighter:string,opponentFighter:string|undefined,phase:MusicPhase):MusicTrack[]{
  if(phase==='lobby')return HOME_MUSIC_IDS.map(id=>MUSIC_TRACKS[id]);
  if(localFighter==='rift'||localFighter.startsWith('rift:')){
    if(phase==='results')return [SURVIVAL_MUSIC[5],...SURVIVAL_MUSIC.slice(0,5)];
    const [,series,moment,round]=localFighter.split(':');
    const turn=Number(round)||0;
    // A boss from no series of the soundtrack's (Gorm the Glutted) gets the rest of it by turns.
    const songs=RIFT_SONGS[series as AnimeSeries]??RIFT_SONGS[(['gilded-ruin','hex-fallout','grave-hound','salvage-wilds'] as const)[turn%4]];
    const spin=<T,>(list:readonly T[])=>list.map((_,i)=>list[(i+turn)%list.length]);
    // Its own first (a different one leading each round), then the Rift's
    // scores, then every other piece in the game: all of them in the rotation.
    const own=(moment==='boss'?[...spin(songs.boss),...spin(songs.hunt)]:[...spin(songs.hunt),...spin(songs.boss)]).map(riftTrack)
      .filter((t,i,all):t is MusicTrack=>!!t&&all.findIndex(o=>o?.id===t.id)===i);
    const seen=new Set(own.map(t=>t.id));
    const scores=SURVIVAL_MUSIC.filter(t=>!seen.has(t.id));
    for(const t of scores)seen.add(t.id);
    const rest=Object.values(RIFT_SONGS).flatMap(each=>[...each.boss,...each.hunt]).map(riftTrack).filter((t):t is MusicTrack=>!!t&&!seen.has(t.id));
    return [...own,...scores,...rest.filter((t,i,all)=>all.findIndex(o=>o.id===t.id)===i)];
  }
  const series=[...new Set([FIGHTER_SERIES[localFighter],opponentFighter?FIGHTER_SERIES[opponentFighter]:undefined])].filter((s):s is AnimeSeries=>Boolean(s));
  // A fight between fighters whose world has no theme is fought to the battle scores the Rift plays, not in silence.
  // (Only theirs: a fighter the game does not know still gets nothing.)
  if(!series.length&&[localFighter,opponentFighter].some(f=>f!==undefined&&SCORED_FIGHTERS.has(f)))return [...SURVIVAL_MUSIC];
  const primary=series.map(s=>MUSIC_TRACKS[phases[s][phase]]);
  const seen=new Set(primary.map(t=>t.id));
  const remainder=series.flatMap(s=>Object.values(MUSIC_TRACKS).filter(t=>t.scope==='gameplay'&&t.series===s&&!seen.has(t.id)));
  return [...primary,...remainder];
}
