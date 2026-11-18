/* A room's or a party's code as a player types it: six digits (a match server room) or six of PlayerTwo's letters and
 * digits (a PlayerTwo room, src/network/p2Room.ts P2_CODE: A-Z less I, L, O and 2-9). Every code field, invite link
 * and check reads codes through these. */
import { isP2Code } from '../network/p2Room';

/** What a field keeps of what was typed: letters and digits, upper case, six at most. */
export const cleanCode = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
/** Whether a code is one a room could have: six digits, or a PlayerTwo room's six. */
export const isRoomCode = (code: unknown): code is string => typeof code === 'string' && (/^\d{6}$/.test(code) || isP2Code(code));
/** A code field's attributes: letters and digits, shown in capitals, no autocorrect. */
export const CODE_INPUT = 'inputmode="text" autocapitalize="characters" autocorrect="off" spellcheck="false" pattern="[0-9A-Za-z]{6}" maxlength="6" data-room-code';
