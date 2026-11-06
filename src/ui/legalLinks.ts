import { TITLE } from '../originals/brand';
/** Where a takedown request or a question about a player's data goes, and the pages beside the game. Kept apart from
 *  legal.ts (which brings its stylesheet) so the build's credits page (scripts/build/credits.ts) reads the same. */
export const CONTACT = 'Hello@Dude.work';
export const GAME_NAME = TITLE;
/** What the game is and is not (LEGAL, 8 October 2026), on the LEGAL page and the credits page alike. */
export const FAN_MADE = `${TITLE} is a free, open-source, non-commercial game. Its fighters, their names, their art, music and voices are original, made for it.`; // (as public/terms.html says it)
export const UNOFFICIAL = 'an arena fighter of original characters';
export const SITE_TITLE = `${GAME_NAME} · ${UNOFFICIAL}`;
export const PRIVACY_PAGE = '/privacy.html';
export const TERMS_PAGE = '/terms.html';
export const CREDITS_PAGE = '/credits.html';
