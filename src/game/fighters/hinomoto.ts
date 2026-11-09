import type {CoreSlot} from '../types';
import type {MoveDefinition} from '../moves';
import type {ComboRow} from '../combos';
/** Classic two-arm old commander. Every flame is tied to a manual attack. */
export const HINOMOTO_MOVES:Record<CoreSlot,MoveDefinition>={
 light:{name:'Ember Stroke',duration:.60,contacts:[.29],damage:25,range:3.0,radius:.79,stamina:12,cooldown:.60,stun:.35,knockback:3.5,lunge:4.1,style:'melee'},
 heavy:{name:'Pyre Cleave',duration:.98,contacts:[.46],damage:65,range:3.1,radius:.87,stamina:29,cooldown:1.26,stun:.83,knockback:8.8,lunge:4.0,style:'melee',outcome:'knockdown'},
 special:{name:'Old Fire',duration:1.35,contacts:[.66],damage:113,range:27,radius:1.08,stamina:35,cooldown:5.0,stun:.87,knockback:8.3,speed:26,style:'projectile',aimOnRelease:true},
 ultimate:{name:'Funeral Pyre',duration:4,contacts:[.50,1.44,3.14],schedule:[44,76,228],damage:44,finisherDamage:212,range:3.1,radius:1.05,stamina:0,cooldown:24,stun:1.18,finisherStun:2.3,knockback:0,finisherKnockback:16,lunge:5.6,close:6,style:'melee',guardBreak:true,confirm:{recovery:.58}},
};
export const HINOMOTO_COMBOS:ComboRow={lh:{name:'Old General\'s Reversal',range:3.05,radius:.87},llh:{name:'Rising Spark',range:3.0,radius:.88},lllh:{name:'Ashen Divider',range:3.2,radius:.92},llls:{name:'Cinder Reprisal',range:3.2,radius:1.02},airHeavy:{name:'Aerial Cleave',range:3.05,radius:.9},airSpecial:{name:'Falling Ember',radius:3.6}};
export const HINOMOTO_CONTACTS={light:.435,heavy:.495,special:.58,ultimate:.125,rush1:.435,rush2:.53,rush3:.495,combos:{lh:.53,llh:.55,lllh:.495,llls:.58,airHeavy:.495,airSpecial:.58}}as const;
export const HINOMOTO_AWAKENING={name:'THE OLD FIRE',clip:'THE OLD FIRE',duration:2.3,entryDuration:.9,beats:{lower:.20,compress:.42,release:.64,settle:.86},manualOnly:true,canonScope:'Unsealed on his own two-armed costume. Heat is presentation only; no passive burn or autonomous attacks.'}as const;
export const hinomotoStrikeJoint=()=> 'RightHand' as const;
/** Measured actual sword endpoints in the exported RightHand joint coordinates: the cane's tip, the heel (where the thin blade
 *  leaves the metal collar) and the grip (the handle under the fist), measured off the cane as it is drawn now, seated in his
 *  fist with one mount in every clip. The earlier points lay along the sword's bind line, 80 degrees off the drawn blade, so
 *  the slash fire (HinomotoBlaze, heel to strike point) and the strike socket (engine/client/sockets.ts) were drawn off it. */
export const HINOMOTO_SWORD_SOCKET={"bone":"RightHand","tip":[0.74318,0.62692,-0.01527],"heel":[0.15409,0.20634,0.02638],"grip":[-0.0063,0.09213,0.03732]}as const;
