import type { ModeId } from './catalogue';

/** What GO says (ModeSheet). Overnight UX (8 October 2026): with a fighter the account has not unlocked (a VOL.2
 *  face, economy/fighters.ts) GO read FIGHT · ON THIS DEVICE and then opened the shop instead of a match (shop/boot.ts
 *  lockedStart). It says what it does: UNLOCK, in Account (the shop's name since 25 October 2026; the Inkwell before), or try them in
 *  Training, which takes every fighter. */
export function goLabel(mode: ModeId, go: string, fighter: string, locked: boolean, invite?: string): { label: string; note?: string } {
  if (locked && mode !== 'training') return { label: `UNLOCK ${fighter.toUpperCase()}`, note: 'IN ACCOUNT · OR TRY IN TRAINING' };
  // Opened by a friend's invite (on FRIENDS): GO joins their room. On a phone the big button said HOST ROOM - a room of
  // your own - while JOIN sat under it at the sheet's foot, half off the screen (overnight UX, 9 October 2026).
  if (invite !== undefined) return { label: 'JOIN ROOM', note: /^\d{6}$/.test(invite) ? `YOUR FRIEND'S ROOM · ${invite}` : "YOUR FRIEND'S ROOM" };
  return { label: go };
}
