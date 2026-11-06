import type { FighterId } from '../game/types';
import { gateHomeVoices, HOME_VOICE_ASSETS as voiceManifest } from '../originals/launch';

/** Only recorded, packaged lines are requested; adding a fighter needs no parallel code edit. */
export const HOME_VOICES:Partial<Record<FighterId,string>> = Object.fromEntries(
  voiceManifest.assets.map(asset=>[asset.fighter,asset.file]),
);
gateHomeVoices(HOME_VOICES);
const PLAYBACK_SOURCES = new Map(voiceManifest.assets.map(asset=>{
  const hash = 'runtimeSha256' in asset && typeof asset.runtimeSha256 === 'string'
    ? asset.runtimeSha256.slice(0,12) : '';
  return [asset.fighter, hash ? `${asset.file}?v=${hash}` : asset.file];
}));
/** Each line's length, where the manifest records it (the finale times the winner's pose on it: ui/results/finale.ts). */
export const HOME_VOICE_SECONDS:Partial<Record<FighterId,number>> = Object.fromEntries(
  voiceManifest.assets.flatMap(asset=>{const seconds=(asset as {durationSeconds?:number}).durationSeconds;return typeof seconds==='number'&&seconds>0?[[asset.fighter,seconds]]:[];}),
);

/** A single interruptible menu voice. Hover/focus/click share one request. */
export class HomeVoice {
  onActivity=(active:boolean)=>{};
  private audio:HTMLAudioElement;
  private wanted?:FighterId;
  private current?:FighterId;
  private timer?:ReturnType<typeof setTimeout>;
  private ticket=0;
  private began=0;
  private blocked=false;
  private audible=false;
  constructor(parent:HTMLElement) {
    this.audio=document.createElement('audio');this.audio.hidden=true;this.audio.preload='none';
    this.audio.dataset.homeVoice='';parent.append(this.audio);
    this.audio.addEventListener('playing',()=>{
      if(!this.current||this.audio.paused)return;
      this.activity(true);
      window.dispatchEvent(new CustomEvent('home-voice-playing',{detail:{fighter:this.current,audio:this.audio}}));
    });
    this.audio.addEventListener('ended',()=>{this.current=undefined;this.activity(false);});
    this.audio.addEventListener('pause',()=>this.activity(false));
    this.audio.addEventListener('error',()=>this.activity(false));
    window.addEventListener('pointerdown',this.activate);
    window.addEventListener('keydown',this.activate);
    document.addEventListener('visibilitychange',this.visibility);
  }
  setMix(master:number,voice:number){
    this.audio.volume=Math.max(0,Math.min(1,master*voice));
    if(!this.audio.volume)this.stop();
  }
  preview(fighter:FighterId,immediate=false){
    if(document.hidden||!this.audio.volume)return;
    // A pointer entry followed by focus and click is one interaction. A later
    // deliberate click replays the line; moving onto another fighter replaces it.
    if(this.wanted===fighter&&this.timer){if(immediate)this.play(fighter);return;}
    if(this.current===fighter&&!this.audio.paused&&!this.audio.ended&&(!immediate||performance.now()-this.began<350))return;
    this.stop();this.wanted=fighter;
    if(immediate)this.play(fighter);
    else this.timer=setTimeout(()=>this.play(fighter),100);
  }
  private activate=()=>{if(this.wanted&&(this.blocked||this.timer))this.play(this.wanted);};
  private visibility=()=>{if(document.hidden)this.stop();};
  private play(fighter:FighterId){
    clearTimeout(this.timer);this.timer=undefined;
    const source=PLAYBACK_SOURCES.get(fighter);
    if(!source){this.stop();return;}
    const ticket=++this.ticket;this.blocked=false;this.audio.pause();
    this.wanted=fighter;this.current=fighter;this.began=performance.now();
    if(this.audio.getAttribute('src')!==source)this.audio.src=source;
    this.audio.currentTime=0;this.audio.dataset.fighterVoice=fighter;
    void this.audio.play().catch(error=>{
      if(ticket!==this.ticket)return;
      this.activity(false);this.current=undefined;
      // First-hover audio needs a browser activation. Keep only the latest
      // requested fighter and retry inside the next real click or key gesture.
      this.blocked=error?.name==='NotAllowedError';
      if(!this.blocked)this.wanted=undefined;
    });
  }
  stop(){
    clearTimeout(this.timer);this.timer=undefined;++this.ticket;
    this.wanted=undefined;this.current=undefined;this.blocked=false;
    this.audio.pause();this.activity(false);
  }
  private activity(value:boolean){if(this.audible===value)return;this.audible=value;this.onActivity(value);}
  dispose(){this.stop();window.removeEventListener('pointerdown',this.activate);window.removeEventListener('keydown',this.activate);document.removeEventListener('visibilitychange',this.visibility);this.audio.remove();}
}
