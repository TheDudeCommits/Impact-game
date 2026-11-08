import { TITLE } from '../originals/brand';
/** Where a takedown request or a question about a player's data goes, and the pages beside the game. Kept apart from
 *  legal.ts (which brings its stylesheet) so the build's credits page (scripts/build/credits.ts) reads the same. */
export const CONTACT = 'Hello@Dude.work';
export const GAME_NAME = TITLE;
/** What the game is and is not (LEGAL, 8 October 2026), on the LEGAL page and the credits page alike. */
export const FAN_MADE = `${TITLE} is a free, open-source, non-commercial game. Its fighters, their names, their art, music and voices are original, made for it.`; // (as public/terms.html says it)
export const UNOFFICIAL = 'an arena fighter of original characters';
export const SITE_TITLE = `${GAME_NAME} · ${UNOFFICIAL}`;
/** The pages beside the game, relative to the game's own page, so they resolve inside a build served under a folder of
 *  its own (Player Two serves each build under `/~<build>/`) as they do at a site's root. Where the host will not show them
 *  as pages of their own, pageViewer.ts opens them over the game. */
export const PRIVACY_PAGE = 'privacy.html';
export const TERMS_PAGE = 'terms.html';
export const CREDITS_PAGE = 'credits.html';
/** The game's source code: SOURCE CODE ↗ beside LEGAL & PRIVACY and CREDITS (the first-visit notice, Options' CREDITS &
 *  LEGAL page) and in the static pages' footers. */
export const REPO_PAGE = 'https://github.com/TheDudeCommits/Impact-game';
