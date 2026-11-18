/* The operator's import of the match server's book into the economy world, through a page's connection to it. The
 * operator's migration tool makes one file: the signed note that begins the run, a signed ticket for the check, the chunks
 * (importer.ts), and the manifest (each slice's count and digest as the server's copy has it).
 * A page sends the note, then the chunks one at a time (each answered before the next: well under PlayerTwo's message
 * allowance), then asks the world for its digests of every slice and compares them. Nothing in the file opens an
 * account, and the page needs no key: the world checks every chunk's signature.
 *
 * In PlayerTwo's player, with ?economy-import in the game's address: a button to pick the file (src/network/p2Economy.ts
 * shows it). The dry run (migrate.mts dryrun) runs this same code against an emulated world. */
import type { WorldLink } from './p2Economy';

export interface ImportFile {
  run: string;
  begin: string;
  ticket: string;
  chunks: unknown[];
  manifest: { slices: Record<string, { count: number; hash: string }>; records: number };
}
export interface ImportReport { run: string; sent: number; applied: number; errors: string[]; slices: number; mismatched: string[]; worldChunks: number; ms: number }

export async function importEconomy(link: Pick<WorldLink, 'ask'>, file: ImportFile, progress: (line: string) => void = () => {}): Promise<ImportReport> {
  const t0 = Date.now(), errors: string[] = [];
  const begun = await link.ask('$imp', { begin: file.begin }, 15_000);
  if (begun.error) throw new Error(`The world would not begin the import: ${String(begun.error)}`);
  let applied = 0, sent = 0;
  for (const chunk of file.chunks) {
    let answer: Record<string, unknown> | undefined;
    for (let attempt = 0; attempt < 3 && !answer; attempt++) {
      try { answer = await link.ask('$imp', { chunk }, 15_000); } catch (error) { if (attempt === 2) errors.push(`chunk ${sent}: ${(error as Error).message}`); }
    }
    sent++;
    if (answer?.error) errors.push(`chunk ${sent - 1}: ${String(answer.error)}`);
    else if (typeof answer?.applied === 'number') applied += answer.applied;
    if (sent % 25 === 0) progress(`${sent}/${file.chunks.length} chunks, ${applied} records`);
  }
  const slices = Object.keys(file.manifest.slices), mismatched: string[] = [];
  let worldChunks = 0;
  /* (eight slices a call: a slice is at most 300 keys, so a call digests a few MB at most, well inside 100 ms) */
  for (let i = 0; i < slices.length; i += 8) {
    const batch = slices.slice(i, i + 8), answer = await link.ask('$ver', { ticket: file.ticket, slices: batch }, 15_000);
    if (answer.error) throw new Error(`The world would not be checked: ${String(answer.error)}`);
    worldChunks = Number(answer.chunks) || 0;
    const digests = (answer.digests ?? {}) as Record<string, { count: number; hash: string }>;
    for (const slice of batch) { const want = file.manifest.slices[slice], got = digests[slice]; if (!got || got.count !== want.count || got.hash !== want.hash) mismatched.push(slice); }
  }
  progress(`checked ${slices.length} slices: ${mismatched.length} differ`);
  return { run: file.run, sent, applied, errors, slices: slices.length, mismatched, worldChunks, ms: Date.now() - t0 };
}
