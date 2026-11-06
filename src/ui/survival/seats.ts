/** Each fighter of a party has a colour, the same on every screen: their frame
 *  (render/survival/heroGlow), their marker over the fight (allyMarks) and
 *  their arrow on the map. The fighter's own frame is warm white on their own
 *  screen; the colours are for picking the others out. */
export const SEAT_COLOURS = [0x3ad8ff, 0xff4ad8, 0x9dff3a, 0xffb02e] as const;
/** The viewer's own frame. */
export const SELF_COLOUR = 0xfff0c8;
/** The viewer's frame this run: warm white, or the aura their fighter's
 *  mastery earned and they chose to wear (survival/progress.ts AURAS). */
export const SELF_AURA = { colour: SELF_COLOUR };
/** A fighter down, waiting for a hand up. */
export const DOWN_COLOUR = 0xff2a3a;

export const seatColour = (seat: number | undefined) => SEAT_COLOURS[((seat ?? 0) % SEAT_COLOURS.length + SEAT_COLOURS.length) % SEAT_COLOURS.length];
export const css = (hex: number) => `#${hex.toString(16).padStart(6, '0')}`;
