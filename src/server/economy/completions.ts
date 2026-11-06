import type { Settlement } from '../../game/economy/account';
import type { Report } from '../../game/economy/earn';

/** Stored in the same durable ledger line as the credited account. Never
 * constructed from an HTTP result body. Retained beyond the account's recent list. */
export interface Completion {
  matchId: string; pk: string; completedAt: number; report: Report; settlement: Settlement;
}
