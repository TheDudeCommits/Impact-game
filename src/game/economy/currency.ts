export const CURRENCY = { name: 'Sumi', mark: '墨' } as const;

export const EARNED_LINE = `${CURRENCY.name} is earned by playing and cannot be bought.`;

/** An amount as the interface writes it: 1,800 墨. */
export const money = (amount: number) => `${Math.round(amount).toLocaleString('en-US')} ${CURRENCY.mark}`;
