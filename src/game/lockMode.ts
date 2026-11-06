import { locks } from './lockCombat';
import type { FighterId } from './types';

export function lockCombatOn(): boolean {
  if (import.meta.env?.VITE_LOCK_COMBAT === '0') return false;
  try { return new URLSearchParams(location.search).get('combat') !== 'live'; } catch { return true; }
}

export const lockPreview = () => import.meta.env?.VITE_LOCK_COMBAT === '1' && lockCombatOn();

/** Whether a fight this page runs for `fighter` plays lock combat. */
export const lockCombatFor = (fighter: FighterId) => lockCombatOn() && locks(fighter);
