import crypto from 'node:crypto';

/** What a code gives. `allAccess`: everything in the game, present and future (`Account.allAccess`). */
export interface CodeGrant { allAccess?: true; items?: readonly string[]; sumi?: number }
export interface CodeDef {
  id: string;
  /** codeHash of the code. */
  hash: string;
  /** What the player is told it unlocked. */
  says: string;
  grants: CodeGrant;
  /** Only an account signed in with a login whose verified email is this one may redeem it. */
  email?: string;
  /** How many accounts may redeem it in all (none: any number). Each account redeems a code once. */
  limit?: number;
  /** Redeemable by a guest account too (signing in later keeps what it unlocked: a guest is folded into its login). */
  guests?: true;
}

/** A code as it is compared: trimmed, case and width folded. */
export const normalCode = (code: unknown) => String(code ?? '').normalize('NFKC').trim().toLowerCase();
export const codeHash = (code: unknown) => crypto.createHash('sha256').update(`jump-code:${normalCode(code)}`).digest('hex');

/** Codes kept in the source, as hashes. None of them may grant all access: that code lives only in the server's
 *  variables (`envCodes`), so its words can't be read off the repository or worked back from a hash in it. */
export const CODES: readonly CodeDef[] = [];

export const ALL_ACCESS_ID = 'owner-all-access';
/** The fewest characters the all-access code's words may have, trimmed: shorter words are guessed, ten tries an hour or not. */
export const ALL_ACCESS_MIN = 8;

export function envCodes(env: Record<string, string | undefined> = process.env): CodeDef[] {
  const words = normalCode(env.ALL_ACCESS_CODE);
  return words.length >= ALL_ACCESS_MIN ? [{ id: ALL_ACCESS_ID, hash: codeHash(words),
    says: 'All access: every fighter, outfit and item in the shop is unlocked on this account.',
    grants: { allAccess: true }, guests: true }] : [];
}
