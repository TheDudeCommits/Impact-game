import {TITLE} from '../originals/brand';
export interface ReportContext { fighter:string; mode:string; connection:string; performance:Record<string,number>; loading:unknown; input:string }
/** Only allow-listed runtime facts are exported. No account, storage, room
 * codes, names, URLs with queries, or raw console/network payloads. */
export function reportDetails(context:ReportContext){
  return {game:TITLE,build:import.meta.env.VITE_BUILD_SHA||'development',createdAt:new Date().toISOString(),
    fighter:context.fighter,mode:context.mode,connection:context.connection,input:context.input,
    viewport:{width:innerWidth,height:innerHeight,pixelRatio:devicePixelRatio},
    browser:navigator.userAgent,online:navigator.onLine,
    performance:Object.fromEntries(Object.entries(context.performance).filter(([,v])=>Number.isFinite(v)).map(([k,v])=>[k,Math.round(v*100)/100])),loading:context.loading};
}
/** What happened, for a player with only a pad (28 October 2026: "make sure a player playing on a controller can control
 *  everything"): D← D→ on the box put one of these in it, so a report can be made without a keyboard. */
export const PAD_REPORTS = [
  'The game froze or stopped responding.',
  'A button or a menu did nothing.',
  'Something looked wrong on screen.',
  'The sound was wrong or missing.',
  'The controller did not work as expected.',
  'I was disconnected from a match.',
] as const;
/** The line after `current` going `step`: from an empty box (or a line of the player's own, which is kept) nothing
 *  changes unless the box is empty. */
export function nextReport(current: string, step: 1 | -1): string | undefined {
  const at = PAD_REPORTS.indexOf(current.trim() as typeof PAD_REPORTS[number]);
  if (at < 0 && current.trim()) return undefined;
  return PAD_REPORTS[at < 0 ? (step > 0 ? 0 : PAD_REPORTS.length - 1) : (at + step + PAD_REPORTS.length) % PAD_REPORTS.length];
}
export class BugReport {
  readonly dialog=document.createElement('dialog');
  private details:ReturnType<typeof reportDetails>|undefined;
  private image:string|undefined;
  private returnFocus:HTMLElement|null=null;
  constructor(parent:HTMLElement,private context:()=>ReportContext,private capture:()=>Promise<string>){
    this.dialog.className='jump-report';this.dialog.setAttribute('aria-labelledby','report-title');
    this.dialog.innerHTML=`<header><div><small>${TITLE.toUpperCase()} / SUPPORT</small><h2 id="report-title">REPORT A BUG</h2></div><button type="button" id="report-close" aria-label="Close bug report">×</button></header><p>Tell us what went wrong. Review the details, then download or copy your report to share with the developer.</p><label for="report-description">WHAT HAPPENED?</label><textarea id="report-description" maxlength="2000" rows="4" placeholder="What did you do? What happened, and what should have happened?"></textarea><p class="report-pad-hint">No keyboard? <b>D← D→</b> on the box chooses what happened.</p><p class="report-privacy">No account details, player names or room codes are collected. Nothing is sent automatically.</p><details><summary>REVIEW TECHNICAL DETAILS</summary><pre id="report-details"></pre></details><div class="report-image-tools"><button type="button" id="report-capture">ADD ARENA SCREENSHOT</button><button type="button" id="report-remove" hidden>REMOVE SCREENSHOT</button></div><figure id="report-image" hidden><img alt="Arena screenshot included in this report"><figcaption>The arena only; menus and text overlays are excluded. Review before sharing.</figcaption></figure><footer><button type="button" id="report-copy">COPY DETAILS</button><button type="button" id="report-download">DOWNLOAD REPORT</button></footer><p id="report-status" role="status" aria-live="polite"></p>`;
    parent.append(this.dialog);
    // Native dialog Escape closes only this modal, not the underlying menu.
    this.dialog.addEventListener('keydown',event=>{if(event.key==='Escape')event.stopPropagation();});
    this.button('report-close').onclick=()=>this.dialog.close();
    this.dialog.addEventListener('close',()=>{this.image=undefined;this.returnFocus?.focus();});
    this.button('report-capture').onclick=async()=>{
      const button=this.button('report-capture');button.disabled=true;
      try{const image=await this.capture();if(!this.open)return;this.image=image;this.dialog.querySelector<HTMLImageElement>('img')!.src=image;this.element('report-image').hidden=false;this.element('report-remove').hidden=false;this.status('Screenshot added. It will be included in the download.');}
      catch{this.status('The arena image could not be captured. You can still share the report.');}
      finally{button.disabled=false;}
    };
    this.button('report-remove').onclick=()=>{this.image=undefined;this.element('report-image').hidden=true;this.element('report-remove').hidden=true;this.dialog.querySelector('img')!.removeAttribute('src');this.status('Screenshot removed.');};
    this.button('report-copy').onclick=async()=>{
      if(!this.valid())return;
      try{await navigator.clipboard.writeText(JSON.stringify(this.payload(false),null,2));this.status('Details copied. Download the report to include a screenshot.');}
      catch{this.status('Clipboard access is unavailable. Use Download report instead.');}
    };
    this.button('report-download').onclick=()=>{
      if(!this.valid())return;
      const blob=new Blob([JSON.stringify(this.payload(true),null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download=`jump-report-${(this.details?.build||'dev').slice(0,12)}.json`;link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);this.status('Report downloaded. Share that file with the developer.');
    };
  }
  get open(){return this.dialog.open;}
  show(){
    this.returnFocus=document.activeElement as HTMLElement|null;this.details=reportDetails(this.context());this.image=undefined;
    this.element('report-details').textContent=JSON.stringify(this.details,null,2);this.element('report-image').hidden=true;this.element('report-remove').hidden=true;this.dialog.querySelector('img')!.removeAttribute('src');this.status('');
    this.dialog.showModal();this.element('report-description').focus();
  }
  /** Preserve controller Back and navigation while the modal owns focus. */
  controller(action:string){
    if(!this.open)return false;
    if(action==='back'){this.dialog.close();return true;}
    const items=[...this.dialog.querySelectorAll<HTMLElement>('button,textarea,summary')].filter(el=>el.getBoundingClientRect().width&&!(el as HTMLButtonElement).disabled);
    const at=items.indexOf(document.activeElement as HTMLElement);
    // D← D→ on the box: a line of what happened, for a pad with no keyboard (PAD_REPORTS).
    const box=this.dialog.querySelector<HTMLTextAreaElement>('textarea')!;
    if((action==='left'||action==='right')&&document.activeElement===box){const line=nextReport(box.value,action==='right'?1:-1);if(line!==undefined)box.value=line;return true;}
    if(action==='confirm'){if(at>=0)items[at].click();else items[0]?.focus();}
    else if(action==='previous'||action==='left'||action==='next'||action==='right')items[(at+(action==='previous'||action==='left'?-1:1)+items.length)%items.length]?.focus();
    return true;
  }
  private valid(){if(this.description().length>=8)return true;this.status('Add a short description of the problem first (at least 8 characters).');this.element('report-description').focus();return false;}
  private description(){return this.dialog.querySelector<HTMLTextAreaElement>('textarea')!.value.trim();}
  private payload(withImage:boolean){return {...this.details,description:this.description(),...(withImage&&this.image?{screenshot:this.image}:{})};}
  private element(id:string){return this.dialog.querySelector<HTMLElement>('#'+id)!;}
  private button(id:string){return this.element(id) as HTMLButtonElement;}
  private status(text:string){this.element('report-status').textContent=text;}
}
