import {FIGHTERS} from '../config';
import {SECOND} from '../game/couchSeat';
import type {GameSnapshot,PlayerState} from '../game/types';
import {shownStage} from '../originals/stages';
import {mangaPortrait} from './MangaHome';
import {rankPlayers} from './hudMath';
import {resultsFrame,clock} from './results/ResultsFrame';
import {FALLS} from './results/placement';
import './matchPresentation.css';
import {rivalryLine} from './social/rivalry';
import {againCard,roomAgainOn} from './social/roomAgain';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const number=(n=0)=>Math.max(0,Math.round(n)).toLocaleString('en-US');
/** Round 5 (UX), WP1: what main.ts's again-label (Hud.resultAgainLabel) means, as PLAY AGAIN's own line. */
const AGAIN:Record<string,string>={'FIND NEXT DUEL':'A NEW OPPONENT','DUEL AGAIN':'THE SAME BOT RIVAL','NEW FRIEND DUEL':'A NEW FRIEND ROOM','NEW PRIVATE ROOM':'A NEW PRIVATE ROOM','PLAY AGAIN':'SAME SETTINGS'};
/** A standings row's two lines: who, then their fighter. Overnight UX (8 October 2026): a bot on this device is named
 *  for its fighter's id (LocalRoyale: "jinlin", "gaku"), which the table showed as it was, in lower case; such a
 *  bot reads as its fighter, then BOT. A room's bots keep their names (Rival, Challenger) and players theirs, unless
 *  they never chose one. */
export function standingNames(p:Pick<PlayerState,'name'|'fighter'|'isBot'>):[string,string]{
  const fighter=FIGHTERS[p.fighter]?.name??p.fighter,name=(p.name??'').trim();
  if(p.isBot&&(!name||name.toLowerCase()===p.fighter.replaceAll('-',' ')||name===fighter))return [fighter,'BOT'];
  // A player who kept the name box's default (MangaHome: "Fighter") reads as their fighter, as the card's kicker does.
  if(!p.isBot&&(!name||name==='Fighter'))return [fighter,'PLAYER'];
  return [name,`${fighter}${p.isBot?' · BOT':''}`];
}
/** The battle royale and the duel, on the one results frame (src/ui/results/ResultsFrame.ts). */
export function matchResults(snapshot:GameSnapshot,viewer:PlayerState,fallen:string[],againLabel:string,roomGone=false){
  // Couch (couch/couch.ts): two people at this screen, so the card is the better placed of them - the winner, whichever of
  // them it is - and the standings say which row is whose (a royale's bots are no one's).
  const couch=snapshot.players.some(p=>p.id===SECOND&&!p.isBot),ranked=rankPlayers(snapshot.players,snapshot.winnerId,fallen);
  const pair=couch?ranked.filter(p=>p.id===viewer.id||p.id===SECOND):[];
  const self=pair[0]??viewer,seat=(p:PlayerState)=>p.id===SECOND?'P2':'P1',place=ranked.findIndex(p=>p.id===self.id)+1;
  const placing=pair.map(p=>`${seat(p)} #${ranked.findIndex(q=>q.id===p.id)+1}`).join(' · ');
  const winner=ranked.find(p=>p.id===snapshot.winnerId),won=winner?.id===self.id,duel=!!snapshot.lobby?.duel;
  const name=(p:PlayerState)=>p.isBot||p.name==='Fighter'?FIGHTERS[p.fighter].name:p.name;
  const stage=shownStage(snapshot.stage)?.name??'THE ARENA',time=snapshot.duel?.startedAt!=null?snapshot.serverTime-snapshot.duel.startedAt:FALLS.seconds(snapshot.serverTime);
  // A rival gone before the set was won (DuelSet.forfeit); one who leaves after losing it - during the winner's
  // finale, say - leaves a set won on rounds.
  const rivalLeft=duel&&won&&snapshot.players.length<2&&(snapshot.duel?.scores[self.id]??0)<(snapshot.duel?.firstTo??2);
  // The way it was played: a private room, a field of bots (one human), or online.
  const others=snapshot.players.filter(p=>p.id!==self.id),humans=others.filter(p=>!p.isBot).length;
  const way=couch?'COUCH':snapshot.lobby?.visibility==='private'?(duel?'FRIEND':'PRIVATE ROOM'):others.length&&!humans&&!rivalLeft?(duel?'VS BOT':'VS BOTS'):'ONLINE';
  const outcome=couch?(won?`${seat(self)} WINS`:duel?'DRAW':'MATCH OVER'):won?'VICTORY':duel?'DEFEAT':self.alive?'MATCH OVER':'KNOCKED OUT';
  // A Duel's RUN IT BACK asks its room for the next set. A room gone (Hud.roomGone: closed after the end, or lost) has no
  // next set to give: the card offers PLAY AGAIN's own way instead, as main.ts plays it without the room.
  const runback=duel&&!!snapshot.duel&&!roomGone;
  // A friends' royale's next match in the same room (ui/social/roomAgain.ts), while the room is there to hold it.
  const nextHere=!roomGone&&roomAgainOn(snapshot)?againCard(snapshot,self.id):undefined;
  const line=couch?(won?`${seat(self)} · ${FIGHTERS[self.fighter].name} ${duel?'won the best-of-three set.':'is the last one standing.'}`:duel?'':`${placing} of ${ranked.length}.`):rivalLeft?'Your rival left the duel.':won?(duel?'You won the best-of-three set.':'Last fighter standing.'):winner?(duel?`${name(winner)} won the best-of-three set.`:`Winner: ${name(winner)}${winner.isBot?' (bot)':''}.`):'';
  const standings=`<div class="results-table-scroll"><table class="results-table"><thead><tr><th scope="col">#</th><th scope="col">FIGHTER</th><th scope="col">KOs</th><th scope="col">DEALT</th><th scope="col">TAKEN</th></tr></thead><tbody id="results-rows">${ranked.map((p,i)=>`<tr class="${p.id===self.id?'you ':''}${p.id===snapshot.winnerId?'winner':''}"><td class="place">${i+1}</td><td class="who"><span class="standings-portrait">${mangaPortrait(p.fighter)}</span><div><strong>${escape(standingNames(p)[0])}${couch?(pair.includes(p)?` · ${seat(p)}`:''):p.id===self.id?' · YOU':''}</strong><small>${escape(standingNames(p)[1])}</small></div></td><td class="num">${number(p.kills)}</td><td class="num">${number(p.damageDealt)}</td><td class="num">${number(p.damageTaken)}</td></tr>`).join('')}</tbody></table></div>`;
  return resultsFrame({
    mast:`${duel?'DUEL':'BATTLE ROYALE'} · ${way}`,where:`${stage.toUpperCase()}${time?` · ${clock(time)}`:''}`,
    fighter:self.fighter,fighterName:FIGHTERS[self.fighter].name,kicker:self.name&&self.name!=='Fighter'?`${self.name} · ${FIGHTERS[self.fighter].name.toUpperCase()}`:FIGHTERS[self.fighter].name.toUpperCase(),
    // R1 (12 October 2026): the kanji cut into the back - 勝 the win, 敗 a duel lost or a fighter knocked out, 終 a
    // royale that ended with you still standing.
    outcome,line,notes:couch?[]:[rivalryLine(snapshot,self.id,3),nextHere?.note??''],won,kanji:won?'勝':outcome==='MATCH OVER'?'終':'敗',
    key:duel?{value:snapshot.duel?`${snapshot.duel.scores[self.id]??0}–${Math.max(0,...Object.entries(snapshot.duel.scores).filter(([id])=>id!==self.id).map(([,n])=>n))}`:won?'1–0':'0–1',label:'ROUNDS WON'}:{value:`#${place}`,label:`OF ${ranked.length} FIGHTERS`},
    stats:[[number(self.kills),'KOs'],[number(self.damageDealt),'DAMAGE DEALT'],[number(self.damageTaken),'DAMAGE TAKEN']],
    // Hud.results keeps this fold's open state (it expects one): a duel's is the two of them.
    details:{summary:duel?'THE FIGHT':'FULL STANDINGS',html:standings},
    again:nextHere?{label:nextHere.label,sub:nextHere.sub,attrs:'id="results-again"',disabled:nextHere.disabled}:{label:runback?'RUN IT BACK':'PLAY AGAIN',sub:runback?(couch?'SAME FIGHTERS · NO RELOAD':snapshot.duel!.runback.includes(self.id)?'WAITING FOR YOUR RIVAL':'SAME RIVAL · NO RELOAD'):AGAIN[againLabel]??'SAME SETTINGS',attrs:'id="results-again"',disabled:!roomGone&&!!snapshot.duel?.runback.includes(self.id)},
    training:'id="results-practice"',home:'id="results-leave"',
  });
}
