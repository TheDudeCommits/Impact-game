/** Where a D-pad press goes in a menu: to the nearest control that lies that
 *  way on the screen, the way a console menu moves, rather than to the next
 *  one in the document. The home screen puts five mode cards over a sixteen-
 *  fighter grid; stepping through them in document order took thirty presses
 *  to reach PLAY. */
export type Direction = 'up' | 'down' | 'left' | 'right';
export interface Box { left: number; top: number; right: number; bottom: number }

const centre = (b: Box) => ({ x: (b.left + b.right) / 2, y: (b.top + b.bottom) / 2 });
/** The gap between two spans on one axis, 0 when they overlap. */
const spanGap = (a0: number, a1: number, b0: number, b1: number) => Math.max(0, b0 - a1, a0 - b1);
const inside = (inner: Box, outer: Box) => inner.left >= outer.left && inner.right <= outer.right && inner.top >= outer.top && inner.bottom <= outer.bottom;

/** The index of the box to move to from `from`, or -1 when nothing lies that
 *  way. A candidate must sit past `from`'s centre in the direction pressed,
 *  and past its leading edge too (give or take a tilted card's overlap), so
 *  right from the last card in a row goes nowhere rather than down a row.
 *  It is scored by the gap to it along the press, plus three times how far it
 *  sits off to the side (0 when the two overlap across the press), plus a
 *  little for misaligned centres. A control nested inside the one focused,
 *  such as the bot counts inside their mode card, counts from `from`'s centre
 *  and a quarter as far, so down from the card reaches its own buttons first. */
export function nearest(from: Box, boxes: readonly Box[], direction: Direction): number {
  const f = centre(from), horizontal = direction === 'left' || direction === 'right';
  let best = -1, bestScore = Infinity;
  boxes.forEach((box, i) => {
    if (box === from || (box.left === from.left && box.top === from.top && box.right === from.right && box.bottom === from.bottom)) return;
    const c = centre(box);
    const along = direction === 'right' ? c.x - f.x : direction === 'left' ? f.x - c.x : direction === 'down' ? c.y - f.y : f.y - c.y;
    if (along <= 4) return;
    const nested = inside(box, from), parent = inside(from, box);
    const past = direction === 'right' ? box.left >= from.right - 8 : direction === 'left' ? box.right <= from.left + 8
      : direction === 'down' ? box.top >= from.bottom - 8 : box.bottom <= from.top + 8;
    if (!past && !nested && !parent) return;
    const gap = Math.max(0, direction === 'right' ? box.left - from.right : direction === 'left' ? from.left - box.right
      : direction === 'down' ? box.top - from.bottom : from.top - box.bottom);
    const side = horizontal ? spanGap(from.top, from.bottom, box.top, box.bottom) : spanGap(from.left, from.right, box.left, box.right);
    const misaligned = horizontal ? Math.abs(c.y - f.y) : Math.abs(c.x - f.x);
    // Touching or overlapping across the press: how far along it the centre is.
    const reach = gap > 0 ? gap : along * (nested ? .25 : .5);
    const score = reach + side * 3 + misaligned * .15;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}
