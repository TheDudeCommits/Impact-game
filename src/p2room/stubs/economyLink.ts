/* The room bundle's src/server/cluster/economyLink.ts: no cluster in a PlayerTwo room; the economy is ../economy.ts. */
export type { RoomEconomy } from '../economy';
export const NAME_SIZES = [18, 20] as const;
export const remoteEconomy = () => undefined;
/** A page's `account` message: the pass it joined with already says what is worn. */
export function freshAccount(_token: unknown, run: () => void, _stillHere: () => boolean) { run(); }
