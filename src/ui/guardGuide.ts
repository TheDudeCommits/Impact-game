export const GUARD_GUIDE = [
  { name: 'Block', how: 'Hold', line: 'Hold guard: every side is covered. Each blow costs stamina, more from behind, and chips a little.' },
  { name: 'Perfect Parry', how: 'Before the hit', line: 'Press guard as a blow comes in, just before it lands: no damage, stamina back, and the attacker staggers - punish. Mashing locks it out.' },
  { name: 'Guard Break', how: 'Red moves', line: 'An empty stamina bar, or a red move, breaks a held guard. Parry red moves; ultimates can only be dodged.' },
] as const;

/** The key guide's few words for the guard button. */
export const GUARD_HINT = 'Block · tap before the hit: Parry';

/** One line for the home Controls panel, under the bindings. */
export const GUARD_SUMMARY = 'Guard: hold to Block · press just before a blow lands to Perfect Parry · red moves break a held guard';

/** The three lessons as loading-screen tips, the guard key put in the first two. */
export function guardTips(key: string) {
  return [
    `${key} <b>BLOCK</b> - ${GUARD_GUIDE[0].line.replace('Hold guard: ', 'hold it and ')}`,
    `${key} <b>PERFECT PARRY</b> - ${GUARD_GUIDE[1].line.replace('Press guard ', 'press it ')}`,
    `<b>GUARD BREAK</b> - ${GUARD_GUIDE[2].line}`,
  ];
}
