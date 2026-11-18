import type { PadFamily, UiAction } from '../input/gamepad';
import { padName } from '../input/glyphs';

export interface DigitEntry { value: string; digit: number }

/** What each place turns through: the digits (a match server room's code), then PlayerTwo's letters (its rooms' codes:
 *  A-Z less I, L and O). */
export const CODE_RING = '0123456789ABCDEFGHJKMNPQRSTUVWXYZ';

/** The entry after one press. Presses that are not a direction, A or B change nothing. */
export function enterDigit(entry: DigitEntry, action: UiAction, length = 6): DigitEntry & { done: boolean } {
  const digits = entry.value.toUpperCase().replace(/[^0-9A-Z]/g, '').padEnd(length, '0').slice(0, length).split('').map(c => CODE_RING.includes(c) ? c : '0');
  let digit = ((Math.trunc(entry.digit) % length) + length) % length;
  if (action === 'confirm' || action === 'back') return { value: digits.join(''), digit, done: true };
  if (action === 'left' || action === 'right') digit = (digit + (action === 'right' ? 1 : length - 1)) % length;
  else if (action === 'previous' || action === 'next') { const n = CODE_RING.length; digits[digit] = CODE_RING[(CODE_RING.indexOf(digits[digit]) + (action === 'previous' ? 1 : n - 1)) % n]; }
  return { value: digits.join(''), digit, done: false };
}

/** What the presses do while a code is typed, in the pad's own names (Hud writes whose pad it is on #interface[data-pad]). */
export function entryHint(family: PadFamily = (typeof document === 'object' ? document.querySelector<HTMLElement>('#interface')?.dataset.pad as PadFamily : undefined) ?? 'generic') {
  return `${padName(family, 'up')} ${padName(family, 'down')} CHANGE THE DIGIT · ${padName(family, 'left')} ${padName(family, 'right')} NEXT DIGIT · ${padName(family, 'south')} DONE`;
}
/** A field being typed into with the pad: its value and the digit shown as the one being turned (selected), and
 *  `data-pad-editing` while it lasts (controller.css draws it). */
export function showEntry(input: HTMLInputElement, entry: DigitEntry | undefined) {
  if (!entry) { delete input.dataset.padEditing; return; }
  input.dataset.padEditing = '';
  if (input.value !== entry.value) { input.value = entry.value; input.dispatchEvent(new Event('input', { bubbles: true })); }
  try { input.setSelectionRange(entry.digit, entry.digit + 1); } catch { /* a type that has no selection */ }
}
