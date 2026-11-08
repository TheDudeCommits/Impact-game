import type { CoreSlot } from '../types';
import type { MoveDefinition } from '../moves';
import type { ComboRow } from '../combos';
import type { AwakeningDefinition } from '../awakening';

/** Basilissa fights on foot: long, upright kicks
 * and rose casts. Every damaging action is explicitly requested by the player. Petrification is represented by
 * bounded stun and stone VFX, never permanent crowd control. Empress is a gameplay sequence label. */
export const BASILISSA_MOVES: Record<CoreSlot, MoveDefinition> = {
  light: { name: 'Thorn Kiss', duration: .44, contacts: [.152], damage: 19, range: 12, radius: .32,
    stamina: 10, cooldown: .44, stun: .26, knockback: 2.6, speed: 32, style: 'projectile', aimOnRelease: true },
  heavy: { name: 'Rosestone Heel', duration: 1, contacts: [.28, .52, .78], damage: 22, finisherDamage: 33,
    range: 2.25, radius: .72, stamina: 25, cooldown: 1.3, stun: .34, finisherStun: .65,
    knockback: 1.5, finisherKnockback: 8, lunge: 4.2, style: 'melee', outcome: 'wallBounce' },
  special: { name: 'Sandrose Volley', duration: 1.28, contacts: [.54], damage: 116, range: 28, radius: 1.1,
    stamina: 32, cooldown: 4.6, stun: .85, knockback: 5, speed: 31, style: 'projectile', aimOnRelease: true },
  ultimate: { name: 'The Stone Garden', duration: 2.85, contacts: [.42, 1.86], schedule: [52, 253],
    damage: 52, finisherDamage: 230, range: 2.35, radius: .9, stamina: 0, cooldown: 23,
    stun: 1.3, finisherStun: 2.3, knockback: 0, finisherKnockback: 16, lunge: 5.8,
    close: 5.8, style: 'melee', guardBreak: true, confirm: { recovery: .5 } },
};

export const BASILISSA_COMBOS: ComboRow = {
  lh: { name: 'Thorn Sweep', range: 2.25, radius: .8 },
  llh: { name: 'Thornrise Heel', range: 2.1, radius: .72 },
  lllh: { name: 'Crown Heel Drop', range: 2.15, radius: .8 },
  llls: { name: 'Sandrose Barrage', range: 15, radius: .8, style: 'projectile', speed: 31, aimOnRelease: true },
  airHeavy: { name: 'Petal Air Kick', range: 2.25, radius: .8 },
  airSpecial: { name: 'Rosefall Landing', radius: 3.0 },
};

/** Her resolve state: a gather, a haughty flourish of the head and hair, a palm
 * dismissal. Its heart/stone presentation is a separate authored effect. */
export const BASILISSA_AWAKENING: AwakeningDefinition = {
  name: 'STONE CROWN', kind: 'aura', aura: [0xffe5ef, 0xe54b94], auraGlow: .22,
  clips: ['STONE CROWN'], swapAt: .38,
};
