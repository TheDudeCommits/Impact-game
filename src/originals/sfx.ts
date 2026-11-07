import type { AudioCue } from '../audio/cueTypes';
import SFX from './sfx.json';
import ROWS from './sfxRows.json';
import CREDITS from './sfxCredits.json';
import { ORIGINAL_SFX_CUES as NEW_CUES } from './sfxCues';
import MIX from './sfxMix.json';

export const ORIGINAL_SFX_ON = (globalThis as { __IMPACT_BASE_SFX__?: boolean }).__IMPACT_BASE_SFX__ !== true;
export const ORIGINAL_SFX_CUES = (ORIGINAL_SFX_ON ? NEW_CUES : {}) as typeof NEW_CUES;

interface CueRow { file: string; seconds: number; peak: number; beat?: number; loop?: boolean }
interface SignatureRow { what: string; cast?: readonly (readonly [cue: string, gain: number, when: 'contact' | 'vanish' | 'appear' | number])[]; hit?: readonly (readonly [cue: string, gain: number])[] }
const CUES = SFX as Record<string, CueRow>;
const SIGNATURE_ROWS = ROWS.signatures as unknown as Record<string, Record<string, SignatureRow>>;
const AREA_ROWS = ROWS.area as unknown as Record<string, { cast: readonly (readonly [string, number, string | number])[]; hit: readonly (readonly [string, number])[] }>;
const AWAKEN_ROWS = ROWS.awaken as unknown as Record<string, readonly (readonly [string, number])[]>;
const DESCRIBE = (ROWS as unknown as { describe?: Record<string, string> }).describe ?? {};

export const LEGACY_SFX: Readonly<Record<string, string>> = {};
const RETIRED: Readonly<Record<string, string>> = { 'fx-sig-taisei-it': 'fx-sig-taisei-cloudstep', 'swing-a': 'fx-swing-kick-1', 'swing-b': 'fx-dash' };

export function applyOriginalSfx(cues: Record<string, string>, durations: Record<string, number>, peaks: Record<string, number>) {
  if (!ORIGINAL_SFX_ON) return cues;
  for (const [cue, row] of Object.entries(CUES)) { cues[cue] = row.file; durations[cue] = row.seconds; peaks[cue] = row.beat ?? row.peak; }
  for (const [cue, file] of Object.entries(LEGACY_SFX)) cues[cue] = file;
  for (const [cue, like] of Object.entries(RETIRED)) { cues[cue] = cues[like]; durations[cue] = durations[like]; peaks[cue] = peaks[like]; }
  return cues;
}

export function applyOriginalSignatures(table: Partial<Record<string, Partial<Record<string, unknown>>>>) {
  if (!ORIGINAL_SFX_ON) return table;
  for (const [fighter, slots] of Object.entries(SIGNATURE_ROWS)) {
    const rows = (table[fighter] ??= {}) as Record<string, unknown>;
    for (const [slot, row] of Object.entries(slots)) rows[slot] = { what: row.what, ...(row.cast ? { cast: row.cast } : {}), ...(row.hit ? { hit: row.hit } : {}) };
  }
  for (const rows of Object.values(table)) for (const row of Object.values(rows ?? {}) as { what: string; cast?: readonly (readonly unknown[])[]; hit?: readonly (readonly unknown[])[] }[]) {
    const described = [...row.cast ?? [], ...row.hit ?? []].map(([cue]) => DESCRIBE[cue as string]).find(Boolean);
    if (described) row.what = described;
  }
  return table;
}

const AREA_FAMILY: Readonly<Record<string, string>> = {
  taisei: 'lightning', haldor: 'quake', shirokane: 'sand', shiden: 'lightning', nigo: 'fire', jirenga: 'stone',
  'jinlin': 'water', gaku: 'sonic', asahi: 'fire',
  gummy: 'sand',
};
/** src/audio/sfxFamilies.ts MOVE_FAMILY (a fighter is one row: heavy, special, ultimate, area). */
export function applyOriginalFamilies(table: Partial<Record<string, readonly (string | null)[]>>) {
  if (!ORIGINAL_SFX_ON) return table;
  const rows = table as Record<string, readonly (string | null)[]>;
  for (const [fighter, area] of Object.entries(AREA_FAMILY)) if (rows[fighter]) rows[fighter] = [rows[fighter][0], rows[fighter][1], rows[fighter][2], area];
  return table;
}

/** The area move's own sound at its cast (its loudest moment on the release, as the element gathering is) and at its last
 *  strike: `[cue, gain]` rows, none for a slot with no area sound of its own. */
export const originalAreaCast = (fighter: string): readonly (readonly [cue: string, gain: number])[] => ORIGINAL_SFX_ON ? (AREA_ROWS[fighter]?.cast ?? []).map(([cue, gain]) => [cue, gain] as const) : [];
export const originalAreaHit = (fighter: string): readonly (readonly [cue: string, gain: number])[] => ORIGINAL_SFX_ON ? AREA_ROWS[fighter]?.hit ?? [] : [];
/** The transformation's own sound (its loudest moment on the swap): `[cue, gain]` rows. */
export const originalAwakening = (fighter: string): readonly (readonly [cue: string, gain: number])[] => ORIGINAL_SFX_ON ? AWAKEN_ROWS[fighter] ?? [] : [];

/** Where a shared cue now holds another original's sound, a slot plays its own in its place (MAP.md section 3, "swaps in a
 *  slot's own rows"). `fx-stand` is a neutral spirit; KoKo's is the iron one and Lord ORO's the gilded one. `fx-timestop` and
 *  `fx-barrage` are KoKo's Hush and GAN GAN barrage; Lord ORO has his own hour and NOROMA barrage (same beats). */
const HAND_SWAPS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  koko: { 'fx-stand': 'fx-sig-koko-iron-lullaby' },
  oro: { 'fx-stand': 'fx-sig-lord-oro-gilded-spirit', 'fx-timestop': 'fx-sig-lord-oro-the-hour', 'fx-barrage': 'fx-sig-lord-oro-noroma-barrage' },
  tsubute: { 'fx-stretch-1': 'fx-sig-tsubute-pouch-draw-1', 'fx-stretch-2': 'fx-sig-tsubute-pouch-draw-2', 'fx-snap-1': 'fx-sig-tsubute-stone-loose-1', 'fx-snap-2': 'fx-sig-tsubute-stone-loose-2' },
  // The fighter quality round (3 November, evening; qa-b's captures): two of the set's signatures sat under cues main shares.
  // `fx-shrike-bolt-hit` is Shirokane's Storm Cutter hit: Shiden's heavy, special and ultimate hits (and Setsu's) played it, so theirs
  // is the set's own lightning strike. `fx-guardian` is Shiden's RAIJIN: Shirokane's, Tobari's and Akagane's awakenings played it
  // under their own, so theirs is the neutral spirit rising (`fx-stand`, energy/spirit-rise), Shiden alone keeping his.
  shiden: { 'fx-shrike-bolt-hit': 'fx-lightning' },
  setsu: { 'fx-shrike-bolt-hit': 'fx-lightning' },
  shirokane: { 'fx-guardian': 'fx-stand' },
  tobari: { 'fx-guardian': 'fx-stand' },
  akagane: { 'fx-guardian': 'fx-stand' },
};
function rowSwaps() {
  const everywhere: Record<string, Record<string, string>> = {}, inSlot: Record<string, Record<string, Record<string, string>>> = {};
  for (const row of (ROWS as unknown as { special?: { slot: string; cue: string; swap?: string; in?: string }[] }).special ?? []) {
    if (!row.swap) continue;
    for (const cue of row.swap.split('|')) {   // a family's files, which the plan picks from by seed: 'fx-fire-whoosh-2|fx-fire-whoosh-1'
      if (row.in) ((inSlot[row.slot] ??= {})[row.in] ??= {})[cue] = row.cue;
      else (everywhere[row.slot] ??= {})[cue] = row.cue;
    }
  }
  return { everywhere, inSlot };
}
const FROM_ROWS = rowSwaps();

const HAND_SLOT_SWAPS: Readonly<Record<string, Readonly<Partial<Record<string, Readonly<Record<string, string | null>>>>>>> = {
  kagari: {
    light: {
      'fx-swing-jab-1': 'fx-sig-kagari-flare-jab-1', 'fx-swing-jab-2': 'fx-sig-kagari-flare-jab-2', 'fx-swing-jab-3': 'fx-sig-kagari-flare-jab-3', 'fx-swing-jab-4': 'fx-sig-kagari-flare-jab-4',
      'fx-swing-kick-1': 'fx-sig-kagari-flare-kick-1', 'fx-swing-kick-2': 'fx-sig-kagari-flare-kick-2', 'fx-swing-kick-3': 'fx-sig-kagari-flare-kick-3',
      'fx-swing-heavy-1': 'fx-sig-kagari-flare-heavy-1', 'fx-swing-heavy-2': 'fx-sig-kagari-flare-heavy-2',
      'fx-fire-whoosh-1': null, 'fx-fire-whoosh-2': null,
    },
  },
};
const SWAPS: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.fromEntries(
  [...new Set([...Object.keys(HAND_SWAPS), ...Object.keys(FROM_ROWS.everywhere)])].map(f => [f, { ...FROM_ROWS.everywhere[f], ...HAND_SWAPS[f] }]));
const SLOT_SWAPS: Readonly<Record<string, Readonly<Partial<Record<string, Readonly<Record<string, string | null>>>>>>> = Object.fromEntries(
  [...new Set([...Object.keys(HAND_SLOT_SWAPS), ...Object.keys(FROM_ROWS.inSlot)])].map(f => {
    const slots = { ...FROM_ROWS.inSlot[f] } as Record<string, Record<string, string | null>>;
    for (const [slot, row] of Object.entries(HAND_SLOT_SWAPS[f] ?? {})) slots[slot] = { ...slots[slot], ...row };
    return [f, slots];
  }));
/** `layers` as `fighter` plays them in `slot` (planSfx's last step; `slot` is 'awaken' for the awakening itself). */
export function swapCues<T extends { cue: string }>(fighter: string | undefined, layers: T[], slot?: string): T[] {
  if (!ORIGINAL_SFX_ON) return layers.filter(layer => !layer.cue.startsWith('fx-orig-')); // (a main-bank test: no new cue is registered)
  const swaps = fighter ? SWAPS[fighter] : undefined, inSlot = fighter && slot ? SLOT_SWAPS[fighter]?.[slot] : undefined;
  if (!swaps && !inSlot) return layers;
  const out: T[] = [];
  for (const layer of layers) {
    const own = inSlot && layer.cue in inSlot ? inSlot[layer.cue] : swaps?.[layer.cue] ?? layer.cue;
    if (own) out.push(own === layer.cue ? layer : { ...layer, cue: own });
  }
  return out;
}

/** Every sound of `fighter`'s that the signature table does not name (signatureCues has those): the area move's, the
 *  awakening's and the slot's swaps. A room fetches them with the fighter (roomCues.ts; they are `fx-sig-*`, by need). */
export function originalCues(fighter: string): string[] {
  if (!ORIGINAL_SFX_ON) return [];
  const swapped = [...Object.values(SWAPS[fighter] ?? {}), ...Object.values(SLOT_SWAPS[fighter] ?? {}).flatMap(row => Object.values(row ?? {}).filter((cue): cue is string => !!cue))];
  return [...new Set([...originalAreaCast(fighter).map(([cue]) => cue), ...originalAreaHit(fighter).map(([cue]) => cue), ...originalAwakening(fighter).map(([cue]) => cue), ...swapped])];
}

/** The slots that have rows of their own (the tests', and the importer's check). */
export const ORIGINAL_SFX_SLOTS: readonly string[] = [...new Set([...Object.keys(SIGNATURE_ROWS), ...Object.keys(AREA_ROWS), ...Object.keys(AWAKEN_ROWS), ...Object.keys(SWAPS), ...Object.keys(SLOT_SWAPS)])];

interface AreaMix { draw?: number; seal?: number; cast?: number; release?: number; strike?: number; strikeLast?: number }
const AREA_MIX = (MIX as unknown as { area: Record<string, AreaMix> }).area;
const MIX_KEEP: readonly string[] = (MIX as unknown as { keep?: string[] }).keep ?? [];
const RAW_MIX = (globalThis as { __IMPACT_RAW_MIX__?: boolean }).__IMPACT_RAW_MIX__ === true;
/** planSfx's last step: an area move's layers as the mix table sets them. */
export function mixCues<T extends { cue: string; gain: number }>(event: { kind: string; slot?: string; fighter?: string; contactIndex?: number; strikes?: number }, layers: T[]): T[] {
  const mix = ORIGINAL_SFX_ON && !RAW_MIX && event.slot === 'area' && event.fighter ? AREA_MIX[event.fighter] : undefined;
  if (!mix) return layers;
  const last = (event.contactIndex ?? 0) >= Math.max(1, event.strikes ?? 1) - 1;
  const trim = event.kind === 'cast' ? mix.cast : event.kind === 'release' ? mix.release : event.kind === 'impact' ? (last ? mix.strikeLast : mix.strike) : undefined;
  const scale = trim ? 10 ** (trim / 20) : 1;
  return layers.map(layer => {
    const own = layer.cue === sfxNew.sealDraw ? mix.draw : layer.cue === sfxNew.sealCast || layer.cue === sfxNew.sealCastDark ? mix.seal : undefined;
    const gain = Math.round((own ?? layer.gain) * scale * 1000) / 1000;
    return gain === layer.gain ? layer : { ...layer, gain };
  });
}

/** The shared sounds of the match's presentation and the plan's new cases (the 25 `fx-orig-*` cues of no fighter's). */
export const UI_SFX = {
  panels: 'fx-orig-ui-vs-panels', stamp: 'fx-orig-ui-vs-stamp', cut: 'fx-orig-ui-vs-cut', fight: 'fx-orig-ui-fight', slam: 'fx-orig-ui-round-bell',
  cutIn: 'fx-orig-ui-cut-in', ko: 'fx-orig-ui-ko', victory: 'fx-orig-ui-victory',
  confirm: 'fx-orig-ui-confirm', select: 'fx-orig-ui-select', back: 'fx-orig-ui-back',
} as const;
export const sfxNew = {
  launch: (seed: number, fighter?: string): { cue: AudioCue; gain: number; delay: number } | undefined => ORIGINAL_SFX_ON ? { cue: (['fx-orig-launch-1', 'fx-orig-launch-2'] as const)[seed % 2], gain: fighter && MIX_KEEP.includes(fighter) ? .35 : (MIX as { launch: number }).launch, delay: .02 } : undefined,
  clash: (seed: number) => (['fx-orig-clash-1', 'fx-orig-clash-2', 'fx-orig-clash-3', 'fx-orig-clash-4'] as const)[seed % 4],
  sealDraw: 'fx-orig-seal-draw', sealCast: 'fx-orig-seal-cast', sealCastDark: 'fx-orig-seal-cast-dark',
} as const;

/** The credit lines the set's licences ask for (CC BY recordings), as src/ui/legal.ts's list holds them. Empty until the
 *  rebuilt set says which recordings it keeps: the importer reminds when a file carries one. */
export const ORIGINAL_SFX_CREDITS = CREDITS.credits as unknown as readonly { work: string; by?: string; sources: readonly (readonly [string, string])[]; licence: string; licenceUrl?: string; changes?: string; files: readonly string[] }[];
