/** The entry `step` along from `current`, round the ends. From nowhere (`current` not in the list) RB starts at the
 *  first and LB at the last. Undefined for an empty list. */
export function stepRound<T>(list: readonly T[], current: T | undefined, step: 1 | -1): T | undefined {
  if (!list.length) return undefined;
  const at = current === undefined ? -1 : list.indexOf(current);
  if (at < 0) return step > 0 ? list[0] : list[list.length - 1];
  return list[(at + step + list.length) % list.length];
}
