/** The survival cards' pictures (/assets/survival/cards/<name>.webp), less those held back from this build: no file
 *  ships for them, so a card that names one shows its kanji on a plain panel and nothing is asked for. */
export const CARDS_HELD: ReadonlySet<string> = new Set(['killing-intent', 'hound-armor', 'chapter-the-offering', 'finale-panel']);
export const cardArt = (name: string): string | undefined => CARDS_HELD.has(name) ? undefined : `/assets/survival/cards/${name}.webp`;
/** An <img> of the card's picture, or nothing where it is held back. `attrs`: the rest of the tag. */
export const cardImg = (name: string, attrs = ''): string => { const src = cardArt(name); return src ? `<img src="${src}"${attrs ? ' ' + attrs : ''}>` : ''; };
