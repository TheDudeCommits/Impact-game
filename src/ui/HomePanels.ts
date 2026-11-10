import { COMMENTARY_OPTIONS } from '../audio/ballCaller';
import { CHASE_CAM_OPTIONS, SPIKE_CAM_OPTIONS } from '../render/ball/ballCamChoice';
import { modeOpen } from '../originals/launch';
import { HUD_SKIN_OPTIONS, MOVE_LAYOUT_OPTIONS, QUALITY_OPTIONS, qualityChoice, VFX_OPTIONS, type CameraStyle, type Settings } from '../config';
import './inkSelect';
import { legalEntry } from './legal';
import { phone } from '../input/device';

const sliders = [
  ['volume','MASTER VOLUME',0,1,.05], ['musicVolume','MUSIC VOLUME',0,1,.05],
  ['sfxVolume','SOUND EFFECTS',0,1,.05], ['voiceVolume','CHARACTER VOICES',0,1,.05],
  ['sensitivity','CAMERA SENSITIVITY',.3,2,.1], ['shake','CAMERA SHAKE',0,1,.1],
  ['vibration','CONTROLLER VIBRATION',0,1,.1],
] as const;
/** The graphics levels, in one list for both settings menus (the home's OPTIONS and the pause menu's): config.ts's, AUTO
 *  first - the machine's pick (render/qualityTier.ts) until the player chooses a level (Settings.qualityChosen). */
export { QUALITY_OPTIONS };
export const CAMERA_OPTIONS:readonly (readonly [Settings['cameraMode'],string,string?])[]=[['dynamic','Dynamic','Recommended'],['smart','Stable','New'],['arena','Arena'],['lockon','Lock-on'],['free','Free']];
export const CAMERA_STYLE_OPTIONS:readonly (readonly [CameraStyle,string,string?])[]=[['classic','Classic','Recommended'],['close','Close'],['chase','Chase']];
/** POWER USE (render/framePolicy.ts). Balanced on a phone is sixty while the phone holds it and an even thirty when not. */
export const POWER_OPTIONS:readonly (readonly [string,string,string])[]=[['auto','Balanced',phone()?'30-60 FPS':'60 FPS'],['cool','Cooler','30 FPS'],['full','Full detail','60 FPS']];
export function homeOptions(settings:Settings) {
  // The game's own picker (inkSelect.ts) where a native select stood.
  const pick=(key:'quality'|'powerMode'|'cameraMode'|'cameraStyle'|'lockStyle'|'hudSkin'|'moveLayout'|'vfx'|'commentary'|'spikeCam'|'chaseCam',label:string,options:readonly (readonly [string,string,string?])[])=>`<label class="home-option home-option-select"><span>${label}</span><ink-select id="home-setting-${key}" data-home-setting="${key}" label="${label[0]}${label.slice(1).toLowerCase()}">${options.map(([value,text,tag])=>`<option value="${value}"${tag?` data-tag="${tag}"`:''}${value===(key==='quality'?qualityChoice(settings):settings[key]??options[0][0])?' selected':''}>${text}</option>`).join('')}</ink-select></label>`;
  return `<nav class="home-options-links" aria-label="Player pages"><button type="button" id="home-career" aria-haspopup="dialog"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M16 6h16v13c0 8-16 8-16 0zM16 10H7v5c0 8 9 10 13 10m12-15h9v5c0 8-9 10-13 10M24 26v10m-10 6h20l-3-6H17z"/></svg><span>CAREER<small>YOUR RECORD</small></span><b>↗</b></button><button type="button" id="home-controls" aria-haspopup="dialog"><svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 12h20c6 0 12 23 7 26-4 3-9-8-12-8H19c-3 0-8 11-12 8-5-3 1-26 7-26zM15 18v10m-5-5h10"/><circle cx="32" cy="20" r="1.5"/><circle cx="37" cy="25" r="1.5"/></svg><span>CONTROLS<small>INPUTS & FIGHTER GUIDE</small></span><b>↗</b></button>${legalEntry()}</nav><p class="home-panel-intro">Changes apply immediately and are saved on this device.</p><div class="home-options-grid">${sliders.map(([key,label,min,max,step])=>`<label class="home-option" for="home-setting-${key}"><span>${label}</span><output for="home-setting-${key}" data-option-value="${key}">${optionValue(key,settings[key])}</output><input id="home-setting-${key}" data-home-setting="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${settings[key]}"></label>`).join('')}${pick('vfx','VISUAL EFFECTS',VFX_OPTIONS)}${pick('quality','GRAPHICS QUALITY',QUALITY_OPTIONS)}${pick('powerMode','POWER USE',POWER_OPTIONS)}${pick('cameraMode','CAMERA',CAMERA_OPTIONS)}${pick('cameraStyle','CAMERA STYLE',CAMERA_STYLE_OPTIONS)}${modeOpen('goal-rush')?pick('spikeCam','SKY SPIKE CAMERA',SPIKE_CAM_OPTIONS)+pick('chaseCam','GOAL RUSH CAMERA',CHASE_CAM_OPTIONS):''}${pick('lockStyle','LOCK-ON STYLE',[['glow','Glow'],['brackets','Brackets']])}${pick('hudSkin','HUD STYLE',HUD_SKIN_OPTIONS)}${pick('moveLayout','MOVE LAYOUT',MOVE_LAYOUT_OPTIONS)}${modeOpen('goal-rush')?pick('commentary','COMMENTARY',COMMENTARY_OPTIONS):''}<label class="home-option home-option-toggle" for="home-setting-cinematics"><span>CINEMATIC CAMERA</span><input id="home-setting-cinematics" data-home-setting="cinematics" type="checkbox" ${settings.cinematics?'checked':''}></label><label class="home-option home-option-toggle" for="home-setting-musicEnabled"><span>PLAY MUSIC</span><input id="home-setting-musicEnabled" data-home-setting="musicEnabled" type="checkbox" ${settings.musicEnabled?'checked':''}></label><label class="home-option home-option-toggle" for="home-setting-homeAnimations"><span>ANIMATED FIGHTERS</span><input id="home-setting-homeAnimations" data-home-setting="homeAnimations" type="checkbox" ${settings.homeAnimations!==false?'checked':''}></label>${errorReportsOption('home-option home-option-toggle','home-setting-errorReports','data-home-setting','SEND ERROR REPORTS',settings)}</div><p class="home-panel-note">Your device's reduced motion preference also pauses fighter animation.</p><button type="button" data-report-bug>REPORT A BUG</button>`;
}
/** SEND ERROR REPORTS (Settings.errorReports), in both menus, with its one line of why: what a report is, in the words
 *  the privacy page uses (public/privacy.html). */
export const ERROR_REPORTS_NOTE='When something breaks, the game tells our server what broke, never who you are.';
export const errorReportsOption=(className:string,id:string,hook:'data-home-setting'|'data-setting',label:string,settings:Pick<Settings,'errorReports'>)=>`<label class="${className} error-reports-option" for="${id}"><span>${label}<small class="option-note">${ERROR_REPORTS_NOTE}</small></span><input id="${id}" ${hook}="errorReports" type="checkbox" ${settings.errorReports!==false?'checked':''}></label>`;
export const optionValue=(key:string,value:number)=>key==='sensitivity'?`${value.toFixed(1)}x`:`${Math.round(value*100)}%`;
