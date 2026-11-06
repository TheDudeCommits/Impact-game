import type { FighterId } from '../../game/types';

export type PartnerPick = FighterId | 'random';

/** What Player 2 can step through, in order: RANDOM, then every fighter `open` to them, in the roster's order. Player
 *  1's own fighter and a locked one are not (ModeSheet's `partnerOpen`). */
export function partnerChoices(order: readonly FighterId[], open: (id: FighterId) => boolean): PartnerPick[] {
  return ['random', ...order.filter(open)];
}

/** Player 2's pick as the sheet shows it and the start uses it: the one saved, while it is still open to them; else the
 *  first fighter open to them after Player 1's own in the roster (round the end); else RANDOM. */
export function partnerShown(saved: PartnerPick | undefined, player1: FighterId, order: readonly FighterId[], open: (id: FighterId) => boolean): PartnerPick {
  if (saved === 'random') return 'random';
  if (saved && order.includes(saved) && open(saved)) return saved;
  const at = order.indexOf(player1);
  for (let k = 1; k <= order.length; k++) { const id = order[(Math.max(0, at) + k) % order.length]; if (open(id)) return id; }
  return 'random';
}

/** `step` along the choices from `current` (left -1, right +1), round the ends; from a pick no longer there, the first. */
export function stepPartner(choices: readonly PartnerPick[], current: PartnerPick, step: number): PartnerPick {
  if (!choices.length) return current;
  const at = choices.indexOf(current);
  if (at < 0) return choices[0];
  return choices[((at + step) % choices.length + choices.length) % choices.length];
}
