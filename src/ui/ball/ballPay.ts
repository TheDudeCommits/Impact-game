/** Where a ball match's pay is drawn. The shop (ui/shop/boot.ts) shows what a
 *  match paid in a toast for seven seconds from the moment it is decided: in a ball match that is under the podium, and it
 *  was gone before the results came. The results card (BallUI) lends it an element of its own instead, kept on the card
 *  for as long as the card is up, beside PLAY AGAIN: what the match earned, the level, and what it brought nearer. */
export const ballPay: { host: () => HTMLElement | undefined } = { host: () => undefined };
