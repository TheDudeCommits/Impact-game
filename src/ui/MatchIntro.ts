import {FIGHTERS} from '../config';
import {shownStage} from '../originals/stages';
import type {GameSnapshot, PlayerState} from '../game/types';
import {VsSplash, type VsSide} from './VsSplash';
import {rivalryLine} from './social/rivalry';
import './matchPresentation.css';

/** The match-up page holds the countdown's first seconds, never longer than
 *  this, and ends a little before the countdown does (SLACK covers the art's
 *  decode); a countdown with less left than SHORTEST when it is first seen gets
 *  no page, only its FIGHT card. A roster that changes this soon after the page
 *  went up (a rival arriving as it opens) plays it again from the top. */
const INTRO_SECONDS = 2.7, SLACK = .3, SHORTEST = 1.1, REPLAY_WINDOW = 350;

/** A local presentation of the server's countdown: the VS splash (VsSplash.ts)
 *  over its first seconds, and FIGHT! the moment the match it counted down to
 *  starts. Never extends or starts a match. The element is the page's dialog
 *  layer over the splash: a summary for screen readers and the skip button. */
export class MatchIntro {
  readonly element:HTMLElement;
  readonly splash:VsSplash;
  private seen='';
  private roster='';
  private until=0;
  private shownAt=0;
  private plays=0;
  /** The countdown (its kickoff time) whose FIGHT card is still owed. */
  private owed='';
  constructor(parent:HTMLElement){
    this.splash=new VsSplash(parent);
    this.element=document.createElement('section');this.element.className='match-intro hidden';
    this.element.setAttribute('role','dialog');this.element.setAttribute('aria-modal','true');this.element.setAttribute('aria-label','Match introduction');
    this.element.innerHTML='<p class="intro-summary"></p><button type="button" class="intro-skip" data-skip-intro>SKIP INTRO <span aria-hidden="true">↗</span></button>';
    parent.append(this.element);
    // A tap anywhere on the page skips it; the button is what focus rests on.
    this.element.addEventListener('click',()=>this.close());
    this.element.addEventListener('keydown',event=>{if(event.key==='Tab'){event.preventDefault();this.element.querySelector<HTMLButtonElement>('button')?.focus();}});
  }
  get open(){return !this.element.classList.contains('hidden');}
  /** Leaving the match: the page and any FIGHT card go at once, and no FIGHT is owed. */
  reset(){this.close();this.splash.skip();this.seen='';this.roster='';this.owed='';}
  close(){
    // (Asked every frame there is no countdown: the class is put on only when it is not there, so the page is not written for nothing.)
    const focused=this.element.contains(document.activeElement);if(!this.element.classList.contains('hidden'))this.element.classList.add('hidden');if(focused)(document.activeElement as HTMLElement)?.blur();
    // The page only: a FIGHT card already under way plays out.
    if(this.splash.open)this.splash.skip();
  }
  skip(){if(!this.open)return false;this.close();return true;}
  update(snapshot:GameSnapshot|null,selfId:string,enabled:boolean){
    // Between rounds and on a runback the matchup is already known. Keep the
    // arena and score visible; only the short FIGHT card is owed at the bell.
    if(snapshot?.duel?.phase==='interval'){this.close();this.owed=`duel-${snapshot.duel.set}-${snapshot.duel.round}`;return;}
    // The countdown this intro announced has run out and the match is on.
    if(this.owed&&snapshot?.roomMode==='match'&&snapshot.status==='active'){this.owed='';this.close();if(enabled)void this.splash.fight();return;}
    const starts=snapshot?.lobby?.startsAt;
    if(!enabled||!snapshot||snapshot.roomMode!=='match'||snapshot.status!=='waiting'||starts==null||starts-snapshot.serverTime<.15){this.close();return;}
    const self=snapshot.players.find(p=>p.id===selfId);if(!self)return;
    const key=String(starts);
    if(key!==this.seen){
      this.seen=key;this.owed=key;this.roster='';
      const left=starts-snapshot.serverTime;
      if(left<SHORTEST)return;
      // A backstop: the page closes when its splash has played out (below).
      this.until=performance.now()+(Math.min(INTRO_SECONDS,left-SLACK)+.8)*1000;this.element.classList.remove('hidden');document.exitPointerLock?.();
    }
    if(!this.open)return;
    const now=performance.now();
    if(now>=this.until){this.close();return;}
    const opponents=snapshot.players.filter(p=>p.id!==selfId);
    const roster=snapshot.players.map(p=>p.id+p.fighter+p.name).join('|')+snapshot.stage;
    if(roster===this.roster)return;
    const first=!this.roster;this.roster=roster;
    const stage=shownStage(snapshot.stage)?.name;
    const side=(p:PlayerState,own=false):VsSide=>({fighter:p.fighter,name:FIGHTERS[p.fighter].name,tag:own?`YOU · ${p.name}`:p.isBot?'CHALLENGER':p.name});
    this.element.querySelector('.intro-summary')!.textContent=`${FIGHTERS[self.fighter].name} versus ${opponents.length?opponents.map(p=>FIGHTERS[p.fighter].name).join(', '):'rivals still arriving'}${stage?`, ${stage}`:''}. ${snapshot.players.length} fighter${snapshot.players.length===1?'':'s'} ready.`;
    // The page plays once; a roster settling as it opens starts it again, later changes only reach the summary.
    if(first||now-this.shownAt<REPLAY_WINDOW){
      if(first)this.shownAt=now;
      const play=++this.plays,seconds=Math.min(INTRO_SECONDS,starts-snapshot.serverTime-SLACK);
      void this.splash.play({left:side(self,true),rights:opponents.slice(0,11).map(p=>side(p)),stage,seconds,rivalry:rivalryLine(snapshot,selfId)||undefined}).then(()=>{if(play===this.plays)this.close();});
    }
    this.element.querySelector<HTMLButtonElement>('button')!.focus({preventScroll:true});
  }
}
