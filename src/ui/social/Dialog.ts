import {nearest,type Direction} from '../spatialFocus';
import {UI_DIRECTION,type UiAction} from '../../input/gamepad';
import {enterDigit,entryHint,showEntry} from '../padEntry';
export class SocialDialog {
  readonly element=document.createElement('dialog');
  private focus:HTMLElement|null=null;
  private editing:HTMLInputElement|null=null;private digit=0;
  constructor(root:HTMLElement,label:string){this.element.className='social-dialog';this.element.setAttribute('aria-label',label);root.append(this.element);this.element.addEventListener('close',()=>this.focus?.focus({preventScroll:true}));this.element.addEventListener('click',e=>{if((e.target as Element).closest('[data-social-close]'))this.close();});}
  show(){if(this.element.open)return;this.focus=document.activeElement as HTMLElement;document.exitPointerLock?.();this.element.showModal();}
  close(){if(this.editing)showEntry(this.editing,undefined);this.editing=null;this.element.close();}
  get open(){return this.element.open;}
  /** A line for the player while a code is typed with the pad (PartyUI says it in its notice). */
  protected padHint(_text:string){}
  controller(action:UiAction){
    if(!this.open)return false;
    // A code typed with the D-pad (padEntry.ts): A or B ends it, the code kept.
    if(this.editing){const input=this.editing,entry=enterDigit({value:input.value,digit:this.digit},action);this.digit=entry.digit;if(entry.done){showEntry(input,undefined);this.editing=null;this.padHint('');if(action==='confirm')input.form?.querySelector<HTMLElement>('button:not([type="button"]):not(:disabled)')?.focus();}else showEntry(input,entry);return true;}
    if(action==='back'){this.close();return true;}
    const items=[...this.element.querySelectorAll<HTMLElement>('button,input,select')].filter(e=>e.getBoundingClientRect().width&&!(e as HTMLButtonElement).disabled),active=document.activeElement as HTMLElement;
    if(!items.includes(active)){items[0]?.focus();return true;}
    if(active instanceof HTMLSelectElement&&(action==='left'||action==='right')){active.selectedIndex=(active.selectedIndex+(action==='right'?1:active.options.length-1))%active.options.length;active.dispatchEvent(new Event('change',{bubbles:true}));return true;}
    if(action==='confirm'){if(active instanceof HTMLInputElement){active.focus();if(active.inputMode==='numeric'){this.editing=active;this.digit=0;showEntry(active,{value:active.value.replace(/\D/g,'').padEnd(6,'0').slice(0,6),digit:0});this.padHint(entryHint());}}else active.click();return true;}
    const dir:Direction|undefined=UI_DIRECTION[action];if(!dir)return true;const i=nearest(active.getBoundingClientRect(),items.map(e=>e.getBoundingClientRect()),dir);if(i>=0)items[i].focus();return true;
  }
}
