import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';

/** The lion chi is presentation: all contacts require a manual attack. */
export const SUZURAN_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Chime Strike', duration: .42, contacts: [.152], damage: 22, range: 2.15, radius: .56,
    stamina: 8, cooldown: .44, stun: .30, knockback: 2.8, lunge: 4.1, style: 'melee' },
  heavy: { name: 'Shumoku', duration: .8, contacts: [.432], damage: 62, range: 2.5, radius: .74,
    stamina: 24, cooldown: 1.08, stun: .69, knockback: 7.1, lunge: 4.5, style: 'melee', outcome: 'launch' },
  special: { name: 'Kyoumei-Ha', duration: 1.05, contacts: [.588], damage: 108, range: 22, radius: .85,
    stamina: 31, cooldown: 4.5, stun: .75, knockback: 7.8, style: 'beam', aimOnRelease: true },
  ultimate: { name: 'Great Bell: Last Toll', duration: 3.7, contacts: [.36, .88, 1.38, 1.9, 2.48, 3.1],
    schedule: [25, 25, 26, 27, 28, 333], damage: 25, finisherDamage: 165, range: 2.7, radius: .90,
    stamina: 0, cooldown: 24, stun: 1.0, finisherStun: 2.3, knockback: 0, finisherKnockback: 16,
    lunge: 6, close: 6, style: 'melee', guardBreak: true, confirm: { recovery: .56 } },
};
export const SUZURAN_COMBOS: ComboRow = {
  lh: { name: 'Backswing', range: 2.35, radius: .65 },
  llh: { name: 'Handstroke', range: 2.4, radius: .75 },
  lllh: { name: 'Full Peal', range: 2.65, radius: .84 },
  llls: { name: 'Overtone', range: 2.9, radius: .84 },
  airHeavy: { name: 'Bell Drop', range: 2.4, radius: .79 },
  airSpecial: { name: 'Sunken Bell', radius: 3.1 },
};
export type SuzuranStrikeSide='Left'|'Right'|'Both';
const SUZURAN_ULT_SIDES:readonly SuzuranStrikeSide[]=['Left','Right','Left','Right','Left','Both'];
/** Matches authored palm targets, including the separate rush/air clips.
 * Event contactIndex wins; during charge animation choose the nearest strike.
 */
export function suzuranStrikeSide(action:string,elapsed=0,clip?:string,contactIndex?:number):SuzuranStrikeSide{
 if(action==='ultimate'&&(!clip||clip==='Great Bell: Last Toll')){
  const index=contactIndex===undefined?[.62,1.13,1.64,2.19,2.79].filter(t=>elapsed>=t).length:Math.max(0,Math.min(5,Math.floor(contactIndex)));
  return SUZURAN_ULT_SIDES[index];
 }
 if(clip==='Shumoku'||clip==='Rush 3'||clip==='Bell Drop'||clip==='Sunken Bell')return 'Both';
 if(clip==='Rush 1'||clip==='Kyoumei-Ha'||clip==='Overtone'||clip==='Handstroke')return 'Right';
 if(clip==='Chime Strike'||clip==='Rush 2'||clip==='Backswing'||clip==='Full Peal')return 'Left';
 return action==='heavy'?'Both':action==='special'?'Right':'Left';
}
export const SUZURAN_AWAKENING = {
  name: 'YOIN', clip: 'YOIN Release', duration: 1.5, entryDuration: .9,
  beats: { seal: .162, focus: .288, unfold: .459, release: .63 }, manualOnly: true,
  canonScope: 'Gameplay focus state; no new body transformation.',
} as const;
export const SUZURAN_CINEMATIC = {
  opener: { clip: 'Great Bell: Last Toll', at: .10 },
  cine: { from: .10, at: .861111, windows: [[.10, .34, .244444], [.34, .48, .383333], [.48, .62, .527778], [.62, .79, .688889], [.79, 1, .861111]] },
} as const;
