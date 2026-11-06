/** Where a player's rift progress lives on this device: this browser's storage
 *  (progress.ts is the rules). Since 2 November 2026 it is a copy - for offline
 *  play and a quick start - of what the player's account keeps on the server
 *  (src/ui/progress/sync.ts sends what changes, and writes the account's back).
 *  Nothing here may stop a run: storage that is missing, full or refused reads
 *  as a fresh profile, and a write that fails is dropped. */
import type { FighterId } from '../game/types';
import { AURAS, auraOf, buy, emptyProgress, factsOf, masteryOf, settle, startPointsAt, type AuraId, type RiftProgress, type RunFacts, type Settled } from './progress';
import type { RunResult } from './SurvivalGame';

/** What changed here, told to whoever keeps it with the player's account (src/ui/progress/sync.ts) once this
 *  browser's copy is written. Nothing it does can stop a run: what it throws is dropped. */
export type RiftEvent = { kind: 'run'; facts: RunFacts } | { kind: 'buy'; node: string } | { kind: 'aura'; fighter: FighterId; aura: AuraId };
export const riftEvents: { on?: (event: RiftEvent) => void } = {};
const tell = (event: RiftEvent) => { try { riftEvents.on?.(event); } catch { /* Kept here all the same. */ } };

const KEY = 'rift-survival-progress';
let cached: RiftProgress | undefined;

function storage(): Storage | undefined { try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; } }

/** A saved profile, checked field by field (an old or hand-edited one fills in what it lacks). */
function revive(raw: unknown): RiftProgress {
  const fresh = emptyProgress();
  if (!raw || typeof raw !== 'object') return fresh;
  const r = raw as Partial<RiftProgress>;
  const num = (n: unknown, fallback = 0) => typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : fallback;
  const list = (l: unknown) => Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : [];
  const record = <T>(o: unknown, each: (v: unknown) => T | undefined) => {
    const out: Record<string, T> = {};
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) { const t = each(v); if (t !== undefined) out[k] = t; }
    return out;
  };
  return {
    version: 1,
    shards: num(r.shards), earned: num(r.earned),
    mastery: record(r.mastery, v => typeof v === 'number' && v >= 0 ? v : undefined),
    aura: record(r.aura, v => typeof v === 'string' && v in AURAS ? v as AuraId : undefined),
    codex: record(r.codex, v => {
      if (!v || typeof v !== 'object') return undefined;
      const c = v as { beaten?: unknown; finished?: unknown; fastest?: unknown };
      return { beaten: num(c.beaten), finished: num(c.finished), ...(typeof c.fastest === 'number' ? { fastest: c.fastest } : {}) };
    }),
    places: list(r.places), challenges: list(r.challenges), unlocked: list(r.unlocked),
    runs: num(r.runs), best: { round: num(r.best?.round), score: num(r.best?.score) },
  };
}

export function loadProgress(): RiftProgress {
  if (cached) return cached;
  try { cached = revive(JSON.parse(storage()?.getItem(KEY) || 'null')); } catch { cached = emptyProgress(); }
  return cached;
}
function save(progress: RiftProgress) {
  cached = progress;
  try { storage()?.setItem(KEY, JSON.stringify(progress)); } catch { /* Progress is a nicety; the run still counts. */ }
}

/** A run finished: what it earned, and the profile after it. */
export function settleRun(result: RunResult): Settled {
  const settled = settle(loadProgress(), result);
  save(settled.progress);
  tell({ kind: 'run', facts: factsOf(result) });
  return settled;
}
/** A node bought with shards: the profile after, or undefined when it could not be. */
export function buyNode(node: string) {
  const after = buy(loadProgress(), node);
  if (after) { save(after); tell({ kind: 'buy', node }); }
  return after;
}
/** A fighter's aura worn from now on (one they have earned). */
export function wearAura(fighter: FighterId, aura: AuraId) {
  const p = loadProgress(), level = masteryOf(p.mastery[fighter]).level;
  if (AURAS[aura].level > level) return p;
  const after = { ...p, aura: { ...p.aura, [fighter]: aura } };
  save(after);
  tell({ kind: 'aura', fighter, aura });
  return after;
}
/** The account's progress as the server holds it (src/ui/progress/sync.ts): this browser's copy from now on. */
export function adoptProgress(progress: RiftProgress) { save(progress); }

/** What a fighter brings into a run from their progress: the nodes bought,
 *  the skill points their mastery starts them with, the colour of their frame. */
export function carried(fighter: FighterId) {
  const p = loadProgress();
  return { unlocked: [...p.unlocked], bonus: startPointsAt(masteryOf(p.mastery[fighter]).level), aura: AURAS[auraOf(p, fighter)].color };
}

/** Tests: forget the cached profile (the storage is read again). */
export function forgetProgress() { cached = undefined; }
