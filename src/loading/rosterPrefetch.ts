/** One homepage volume is the maximum speculative model budget, even as the
 * released roster grows. Explicit selection and room loading stay uncapped. */
export const BACKGROUND_FIGHTER_LIMIT = 16;

export function rosterPrefetch<T>(roster: readonly T[], preferred?: T): readonly T[] {
  const index = preferred === undefined ? 0 : roster.indexOf(preferred);
  // A laboratory candidate has no released volume. Its explicit load is enough.
  if (index < 0) return [];
  const start = Math.floor(index / BACKGROUND_FIGHTER_LIMIT) * BACKGROUND_FIGHTER_LIMIT;
  return roster.slice(start, start + BACKGROUND_FIGHTER_LIMIT);
}
