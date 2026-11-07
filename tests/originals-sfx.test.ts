import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AUDIO_CUES, cueDuration, planCombatAudio, type AudioCue } from '../src/audio/cuePlan';
import { SFX_PEAKS } from '../src/audio/sfxCues';
import { FAMILIES, MOVE_FAMILY, familyCues } from '../src/audio/sfxFamilies';
import { SIGNATURES, signatureCues } from '../src/audio/sfxSignatures';
import { byNeed, fighterCues } from '../src/audio/roomCues';
import { awakeningSwapAt } from '../src/game/awakening';
import { MOVES } from '../src/game/moves';
import type { AttackSlot, CombatEvent, FighterId } from '../src/game/types';
import { LEGACY_SFX, ORIGINAL_SFX_CUES, ORIGINAL_SFX_CREDITS, ORIGINAL_SFX_SLOTS, UI_SFX, originalAreaCast, originalAreaHit, originalAwakening, originalCues } from '../src/originals/sfx';
import CUES from '../src/originals/sfx.json';
import ROWS from '../src/originals/sfxRows.json';
import CREDITS from '../src/originals/sfxCredits.json';
import MIX from '../src/originals/sfxMix.json';
import CUE_ONSETS from '../src/audio/data/cueOnsets.json';

const BANK = 'public/assets/audio/v2';
const ORIGINALS = `${BANK}/sfx/originals`;
const table = CUES as Record<string, { file: string; seconds: number; peak: number; beat?: number }>;
const cues = Object.keys(table) as AudioCue[];

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]);
}
/** A 48 kHz mono 16-bit WAV's header numbers: its length in seconds. */
function wavInfo(file: string) {
  const b = fs.readFileSync(file);
  let at = 12, rate = 0, channels = 0, bits = 0, data = 0;
  while (at + 8 <= b.length) {
    const id = b.toString('ascii', at, at + 4), size = b.readUInt32LE(at + 4);
    if (id === 'fmt ') { channels = b.readUInt16LE(at + 10); rate = b.readUInt32LE(at + 12); bits = b.readUInt16LE(at + 22); }
    if (id === 'data') { data = size; break; }
    at += 8 + size + (size & 1);
  }
  return { rate, channels, bits, seconds: data / (bits / 8) / channels / rate };
}
const sha256 = (file: string) => createHash('sha256').update(fs.readFileSync(file)).digest('hex');

describe('the game\'s sound effects: files and tables', () => {


  it('registers the replaced cues under their old names and the 228 new ones beside them, each with its length and its beat', () => {
    const added = Object.keys(ORIGINAL_SFX_CUES);
    expect(added.length).toBe(228);
    for (const cue of cues) {
      expect(AUDIO_CUES[cue], cue).toBe(table[cue].file);
      expect(cueDuration(cue), cue).toBeCloseTo(table[cue].seconds - Math.max(0, ((CUE_ONSETS as Record<string, number>)[cue] ?? 0) - .015), 3);
      expect(SFX_PEAKS[cue], cue).toBe(table[cue].beat ?? table[cue].peak);
    }
    for (const cue of added) expect(cues.includes(cue as AudioCue), `${cue} has no row in sfx.json`).toBe(true);
    expect(cues.length - added.length, 'the cues of main\'s the set takes the place of').toBe(231);
  });

  it('plays none of Impact\'s synthesised files left in the moves, nor its crack: each is a recording of the set', () => {
    const last = ['armour-1', 'armour-2', 'beast-bite', 'beast-roar', 'beast-swipe-1', 'beast-swipe-2', 'dark-spark', 'blue', 'cannon-prep', 'domain',
      'el-blood-hit', 'el-blood-rush', 'el-grav-cast', 'el-grav-hit', 'el-petal-cast', 'el-petal-hit', 'el-petal-rush', 'el-plant-cast', 'el-plant-hit',
      'el-psy-cast', 'el-psy-hit', 'el-sand-cast', 'el-sand-hit', 'el-sand-rush', 'el-sand-tail', 'el-sonic-cast', 'el-sonic-hit', 'gear4-bounce',
      'gear4-inflate', 'poof-1', 'poof-2', 'purple-charge', 'sig-grapple', 'snap-1', 'snap-2', 'steam', 'stretch-1', 'stretch-2', 'timestop-resume',
      'timestop-tick'].map(name => `fx-${name}`);
    expect(last.length).toBe(40);
    for (const cue of [...last, 'crack']) expect(AUDIO_CUES[cue as AudioCue], cue).toMatch(/^sfx\/originals\/families\//);
  });

  // The second wave (fix-audio2, 4 November): the thread and acid families were the last of Impact's synthesis in group D's key
  // moves (Strappado's and Kinu's threads, Hakushi's and Kusushi's acid).
  it('plays no synthesised file of Impact\'s in the thread or acid family either', () => {
    for (const cue of ['fx-el-string-cast', 'fx-el-string-rush', 'fx-el-string-hit', 'fx-el-acid-cast', 'fx-el-acid-hit'])
      expect(AUDIO_CUES[cue as AudioCue], cue).toMatch(/^sfx\/originals\/families\/elements\/(thread|acid)-/);
  });


});


const SLOTS: AttackSlot[] = ['light', 'heavy', 'special', 'ultimate', 'area'];
const event = (props: Partial<CombatEvent>): CombatEvent => ({ id: 7, kind: 'cast', serverTime: 1, actorId: 'a', ...props });
const plan = (fighter: string, slot: AttackSlot, kind: CombatEvent['kind'], more: Partial<CombatEvent> = {}, awakened = false) =>
  planCombatAudio(event({ fighter: fighter as FighterId, slot, kind, ...more }), awakened);

describe('the game\'s sound effects: the wiring', () => {

  it('gives the 23 core slots their move rows, each cue of them a registered fx-sig cue fetched with the fighter\'s room', () => {
    expect(Object.keys(ROWS.signatures).length).toBe(23);
    for (const fighter of Object.keys(ROWS.signatures)) {
      const own = signatureCues(fighter as FighterId);
      expect(own.length, fighter).toBeGreaterThan(0);
      for (const cue of own) expect(cue.startsWith('fx-sig-') || cue === 'fx-sig-sunpalm-charge', cue).toBe(true);
      for (const cue of own) expect(fighterCues(fighter as FighterId), `${fighter}: ${cue}`).toContain(cue);
    }
    expect(SIGNATURES.taisei?.heavy?.cast?.map(([cue]) => cue)).toEqual(['fx-sig-taisei-cloudstep']);
    expect(SIGNATURES.taisei?.special?.cast?.[0]?.[0]).toBe('fx-sig-sunpalm-charge');
    expect(SIGNATURES.gaku?.ultimate?.cast?.[0]?.[0]).toBe('fx-sig-gaku-landslide');
  });

  it('fetches a slot\'s area, awakening and swapped sounds with it, and no other fighter\'s', () => {
    for (const fighter of ORIGINAL_SFX_SLOTS) {
      const own = originalCues(fighter);
      // (a by-need cue - `fx-sig-*`, `fx-el-*` - comes with its fighter; a swap onto a shared cue, every match fetches already)
      for (const cue of own) { expect(AUDIO_CUES[cue as AudioCue], cue).toBeDefined(); if (byNeed(cue)) expect(fighterCues(fighter as FighterId), `${fighter}: ${cue}`).toContain(cue); }
      for (const other of ORIGINAL_SFX_SLOTS.filter(id => id !== fighter)) for (const cue of own) if (cue.startsWith('fx-sig-') && !(cue === 'fx-sig-sunpalm-charge'))
        expect(fighterCues(other as FighterId), `${other} does not fetch ${fighter}'s ${cue}`).not.toContain(cue);
    }
  });

  it('re-points the nine area moves to their own element, and plays the family of it', () => {
    const area: Record<string, string> = { taisei: 'lightning', haldor: 'quake', shirokane: 'sand', shiden: 'lightning', nigo: 'fire', jirenga: 'stone', 'jinlin': 'water', gaku: 'sonic', asahi: 'fire' };
    for (const [fighter, family] of Object.entries(area)) {
      expect(MOVE_FAMILY[fighter as FighterId][3], fighter).toBe(family);
      expect(FAMILIES[family as keyof typeof FAMILIES]).toBeDefined();
      for (const cue of familyCues(fighter as FighterId)) expect(AUDIO_CUES[cue], cue).toBeDefined();
    }
    // (Their heavy, special and ultimate rows are untouched.)
    expect(MOVE_FAMILY.haldor.slice(0, 3)).toEqual(['steel', 'quake', 'quake']);
    expect(MOVE_FAMILY.shiden.slice(0, 3)).toEqual([null, null, 'lightning']);
  });

  it('lays each area move\'s own sound on its release and on its last strike, over the element\'s', () => {
    const rows = ROWS.area as unknown as Record<string, { cast: [string, number, string][]; hit: [string, number][] }>;
    expect(Object.keys(rows).length).toBe(17);
    for (const [fighter, row] of Object.entries(rows)) {
      const move = MOVES[fighter as FighterId].area, release = move.contacts[0] ?? 0;
      const cast = plan(fighter, 'area', 'cast');
      // At the row's gain, under the area mix's trim (src/originals/sfxMix.json: the area moves at Impact's level, fix-audio3).
      const mix = (MIX as unknown as { area: Record<string, { cast?: number; strikeLast?: number }> }).area[fighter] ?? {};
      const trimmed = (gain: number, trim?: number) => Math.round(gain * 10 ** ((trim ?? 0) / 20) * 1000) / 1000;
      for (const [cue, gain] of row.cast) {
        const layer = cast.find(l => l.cue === cue);
        expect(layer, `${fighter}: ${cue} at the cast`).toBeDefined();
        expect(layer!.gain, `${fighter}: ${cue}`).toBe(trimmed(gain, mix.cast));
        expect(layer!.phase, `${fighter}: ${cue}`).toBe('cast');
        // Its loudest moment is the release's: it is heard no later than the release, or as near as a long sound can be.
        const crest = (layer!.delay ?? 0) + (SFX_PEAKS[cue] ?? 0) / (layer!.rate ?? 1);
        expect(crest, `${fighter}: ${cue} crests ${crest.toFixed(3)} s in, the release is at ${release}`).toBeLessThanOrEqual(Math.max(release + .05, (SFX_PEAKS[cue] ?? 0) / 1.2 + .05));
      }
      const last = (MOVES[fighter as FighterId].area as { contacts: number[] }).contacts.length;
      const strike = plan(fighter, 'area', 'impact', { contactIndex: 0, strikes: 1 });
      for (const [cue, gain] of row.hit) expect(strike.find(l => l.cue === cue)?.gain, `${fighter}: ${cue} on the last strike`).toBe(trimmed(gain, mix.strikeLast));
      // And not on the strikes before the last of a longer circle.
      for (const [cue] of row.hit) expect(plan(fighter, 'area', 'impact', { contactIndex: 0, strikes: 4 }).some(l => l.cue === cue), `${fighter}: ${cue} before the last`).toBe(false);
      expect(last).toBeGreaterThan(0);
    }
    expect(originalAreaCast('konta')).toEqual([]);
    expect(originalAreaHit('konta')).toEqual([]);
  });

  it('paints the seal on every area cast and sets it off on its release (dark for the dark family)', () => {
    for (const fighter of Object.keys(MOVES) as FighterId[]) {
      const cast = plan(fighter, 'area', 'cast').filter(l => l.cue === 'fx-orig-seal-draw');
      if (!MOVE_FAMILY[fighter]) continue;
      if (fighter !== 'yodaka') expect(cast.length, `${fighter}: the seal drawn`).toBe(1);
      const release = plan(fighter, 'area', 'release', { due: 1.75 }).filter(l => l.cue.startsWith('fx-orig-seal-cast'));
      expect(release.map(l => l.cue), fighter).toEqual([MOVE_FAMILY[fighter][3] === 'dark' ? 'fx-orig-seal-cast-dark' : 'fx-orig-seal-cast']);
    }
  });

  it('lands each transformation sound on the swap, after the slot\'s own and the power\'s entrance', () => {
    const rows = ROWS.awaken as unknown as Record<string, [string, number][]>;
    expect(Object.keys(rows).length).toBe(15); // (the 28's 14, and Kuzu's hound: fix-audio3)
    for (const [fighter, row] of Object.entries(rows)) {
      const layers = plan(fighter, 'light', 'awaken'), swap = awakeningSwapAt(fighter as FighterId);
      for (const [cue, gain] of row) {
        const layer = layers.find(l => l.cue === cue);
        expect(layer, `${fighter}: ${cue}`).toBeDefined();
        expect(layer!.gain).toBe(gain);
        expect(layer!.phase, `${fighter}: ${cue}`).toBe('release');
        const crest = (layer!.delay ?? 0) + (SFX_PEAKS[cue] ?? 0) / (layer!.rate ?? 1);
        // On the swap, as near as it can: a file whose own beat is later than the swap by more than the quickest the plan plays it
        // (onBeat's 1.2x) starts with the event and crests when it must - gorai's and jirenga's in the first set.
        const earliest = (SFX_PEAKS[cue] ?? 0) / 1.2 + .02;
        expect(crest, `${fighter}: ${cue} crests ${crest.toFixed(3)} s in, the swap is at ${swap}`).toBeLessThanOrEqual(Math.max(swap + .12, earliest));
        expect(crest, `${fighter}: ${cue} crests ${crest.toFixed(3)} s in, the swap is at ${swap}`).toBeGreaterThanOrEqual(Math.min(swap, earliest) - .12);
      }
      expect(layers.some(l => l.cue === 'fx-awaken') || fighter === 'taisei' || fighter === 'kuzu', `${fighter} keeps main's generic release under it`).toBe(true);
    }
  });

  it('plays a light\'s own sound on the first blow of the string only', () => {
    const lights = Object.entries(ROWS.signatures as unknown as Record<string, Record<string, { cast?: [string][] }>>).filter(([, slots]) => slots.light);
    expect(lights.length).toBeGreaterThan(4);
    for (const [fighter, slots] of lights) {
      const cue = slots.light.cast?.[0]?.[0];
      if (!cue) continue;
      expect(plan(fighter, 'light', 'cast', { chain: 0 }).some(l => l.cue === cue), `${fighter}: ${cue} on the first blow`).toBe(true);
      expect(plan(fighter, 'light', 'cast', { chain: 1 }).some(l => l.cue === cue), `${fighter}: ${cue} on the second`).toBe(false);
    }
  });

  it('gives Lord ORO his own spirit, hour, barrage and bell, and KoKo his, in their own cues', () => {
    const cues = (fighter: string, slot: AttackSlot, kind: CombatEvent['kind'], more: Partial<CombatEvent> = {}) => plan(fighter, slot, kind, more).map(l => l.cue as string);
    for (const slot of ['heavy', 'special', 'ultimate'] as const) expect(cues('koko', slot, 'cast'), `koko ${slot}`).not.toContain('fx-spirit');
    expect(cues('koko', 'special', 'cast')).toContain('fx-sig-koko-iron-lullaby');
    expect(cues('oro', 'special', 'cast')).toContain('fx-sig-lord-oro-gilded-spirit');
    expect(cues('oro', 'special', 'cast')).toContain('fx-sig-lord-oro-noroma-barrage');
    expect(cues('oro', 'special', 'cast')).not.toContain('fx-barrage');
    expect(cues('oro', 'ultimate', 'cast')).toContain('fx-sig-lord-oro-the-hour');
    expect(cues('oro', 'ultimate', 'cast')).not.toContain('fx-timestop');
    expect(cues('koko', 'ultimate', 'cast')).toContain('fx-timestop');
    const finisher = cues('oro', 'ultimate', 'confirm');
    expect(finisher).toContain('fx-sig-lord-oro-death-knell-fall');
    expect(finisher).toContain('fx-steamroller');
  });

  it('plays Kagari\'s light string as fist and flame, one sound a blow, and only his light string', () => {
    const cues = (fighter: string, slot: AttackSlot, more: Partial<CombatEvent> = {}, awakened = false) => plan(fighter, slot, 'cast', more, awakened).map(l => l.cue as string);
    for (const awakened of [false, true]) for (const chain of [0, 1, 2, 3]) for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const light = cues('kagari', 'light', { chain, id }, awakened);
      expect(light.filter(cue => /^fx-sig-kagari-flare-/.test(cue)).length, `stage ${chain}`).toBe(1);
      for (const cue of light) expect(cue, `stage ${chain}: ${light.join(', ')}`).not.toMatch(/^fx-(swing-(jab|kick|heavy)-\d|fire-whoosh-\d)$/);
    }
    // His heavy, special and ultimate keep their fire whooshes; another fist fighter keeps the shared jab.
    expect([1, 2, 3].flatMap(id => cues('kagari', 'heavy', { id })).some(cue => /^fx-fire-whoosh-/.test(cue))).toBe(true);
    expect([1, 2, 3].flatMap(id => cues('koko', 'light', { id, chain: 1 })).some(cue => /^fx-swing-jab-/.test(cue))).toBe(true);
    for (const cue of originalCues('kagari')) expect(fighterCues('kagari'), cue).toContain(cue);
    // Each stands in where the cue it replaces crested: the plan's timing holds.
    for (const n of [1, 2, 3, 4]) expect(Math.abs(SFX_PEAKS[`fx-sig-kagari-flare-jab-${n}` as AudioCue] - SFX_PEAKS[`fx-swing-jab-${n}` as AudioCue]), `jab ${n}`).toBeLessThan(.003);
    for (const n of [1, 2, 3]) expect(Math.abs(SFX_PEAKS[`fx-sig-kagari-flare-kick-${n}` as AudioCue] - SFX_PEAKS[`fx-swing-kick-${n}` as AudioCue]), `kick ${n}`).toBeLessThan(.003);
    for (const n of [1, 2]) expect(Math.abs(SFX_PEAKS[`fx-sig-kagari-flare-heavy-${n}` as AudioCue] - SFX_PEAKS[`fx-swing-heavy-${n}` as AudioCue]), `heavy ${n}`).toBeLessThan(.003);
  });

  it('gives Tsubute a slingshot\'s pouch and stone in place of the rubber pair, on every move of his', () => {
    const kinds: CombatEvent['kind'][] = ['cast', 'release', 'hit', 'confirm', 'awaken'];
    const all: string[] = [];
    for (const slot of SLOTS) for (const kind of kinds) for (const id of [1, 2, 3]) for (const chain of [0, 1, 3]) all.push(...plan('tsubute', slot, kind, { id, chain }).map(l => l.cue as string));
    for (const branch of ['lh', 'llh', 'lllh', 'llls', 'airHeavy'] as const) all.push(...plan('tsubute', 'heavy', 'cast', { branch }).map(l => l.cue as string));
    for (const cue of all) expect(cue).not.toMatch(/^fx-(stretch|snap)-\d$/);
    for (const cue of ['fx-sig-tsubute-pouch-draw-1', 'fx-sig-tsubute-pouch-draw-2', 'fx-sig-tsubute-stone-loose-1', 'fx-sig-tsubute-stone-loose-2']) {
      expect(all, cue).toContain(cue);
      expect(fighterCues('tsubute'), cue).toContain(cue);
    }
    for (const [own, old] of [['pouch-draw-1', 'stretch-1'], ['pouch-draw-2', 'stretch-2'], ['stone-loose-1', 'snap-1'], ['stone-loose-2', 'snap-2']])
      expect(Math.abs(SFX_PEAKS[`fx-sig-tsubute-${own}` as AudioCue] - SFX_PEAKS[`fx-${old}` as AudioCue]), own).toBeLessThan(.003);
    expect([1, 2, 3].flatMap(id => plan('psyche', 'heavy', 'cast', { id }).map(l => l.cue as string))).toContain('fx-stretch-2');
  });

  it('plays no other original\'s signature under a shared cue: Shiden\'s hits are not Shirokane\'s, nor their awakenings Shiden\'s (the quality round)', () => {
    const cues = (fighter: string, slot: AttackSlot, kind: CombatEvent['kind']) => [1, 2, 3].flatMap(id => plan(fighter, slot, kind, { id }).map(l => l.cue as string));
    for (const fighter of ['shiden', 'setsu']) for (const slot of ['heavy', 'special', 'ultimate'] as AttackSlot[])
      expect(cues(fighter, slot, 'hit'), `${fighter} ${slot}`).not.toContain('fx-shrike-bolt-hit');
    expect(cues('shirokane', 'heavy', 'hit')).toContain('fx-shrike-bolt-hit');   // (his own Storm Cutter)
    for (const fighter of ['shirokane', 'tobari', 'akagane']) expect(cues(fighter, 'light', 'awaken'), fighter).not.toContain('fx-guardian');
    expect(cues('shiden', 'light', 'awaken')).toContain('fx-guardian');     // (his own RAIJIN)
  });

  it('sends a launched body up on the set\'s launcher, rings crossed blades over a parry, and nothing else of the set on a plain blow', () => {
    const launched = planCombatAudio(event({ kind: 'hit', fighter: 'kenzo', slot: 'heavy', reaction: 'launched' }), false).map(l => l.cue as string);
    expect(launched.some(cue => /^fx-orig-launch-[12]$/.test(cue))).toBe(true);
    const plain = planCombatAudio(event({ kind: 'hit', fighter: 'kenzo', slot: 'heavy' }), false).map(l => l.cue as string);
    expect(plain.filter(cue => cue.startsWith('fx-orig-'))).toEqual([]);
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const parry = planCombatAudio(event({ id: seed, kind: 'just-guard', fighter: 'kenzo', slot: 'heavy' }), false).map(l => l.cue as string);
      expect(parry.filter(cue => cue.startsWith('fx-orig-clash-')).length, `a blade parried (event ${seed})`).toBe(1);
      const fist = planCombatAudio(event({ id: seed, kind: 'just-guard', fighter: 'ippon', slot: 'heavy' }), false).map(l => l.cue as string);
      expect(fist.filter(cue => cue.startsWith('fx-orig-clash-')), 'a fist parried').toEqual([]);
    }
  });

  it('plans only registered, measured cues for the originals, never on the voice bus, never louder than 0.9', () => {
    const kinds: CombatEvent['kind'][] = ['cast', 'release', 'hit', 'impact', 'confirm', 'blocked', 'just-guard', 'guard-break', 'awaken'];
    let layers = 0;
    for (const fighter of ORIGINAL_SFX_SLOTS) for (const awakened of [false, true]) for (const slot of SLOTS) for (const kind of kinds)
      for (const layer of plan(fighter, slot, kind, { due: 1.75, strikes: 3, contactIndex: 2, chain: 0 }, awakened)) {
        layers++;
        expect(AUDIO_CUES[layer.cue], `${fighter} ${slot} ${kind}: ${layer.cue}`).toBeDefined();
        expect(Number.isFinite(cueDuration(layer.cue)), layer.cue).toBe(true);
        if (layer.bus !== 'voice') { expect(layer.gain, `${fighter} ${slot} ${kind}: ${layer.cue}`).toBeGreaterThan(0); expect(layer.gain, `${fighter} ${slot} ${kind}: ${layer.cue}`).toBeLessThanOrEqual(.9); }
        if (layer.rate !== undefined && !layer.loop) expect(Math.abs(layer.rate - 1), `${layer.cue} rate`).toBeLessThanOrEqual(.45);
      }
    expect(layers).toBeGreaterThan(2000);
  }, 1_200_000); // the gate's own limit (merge_one.sh --testTimeout=1200000): a wiring check, not a speed one; 120 s timed out under load

  it('wires the splash, FIGHT!, the name card, the K.O. and the victory to the set (main.ts), and leaves the menus\' three unwired', () => {
    const main = fs.readFileSync('src/main.ts', 'utf8');
    for (const key of ['panels', 'stamp', 'cut', 'fight', 'slam', 'cutIn', 'ko', 'victory'] as const) expect(main.includes(`UI_SFX.${key}`), key).toBe(true);
    for (const key of ['panels', 'stamp', 'cut', 'fight', 'slam', 'cutIn', 'ko', 'victory', 'confirm', 'select', 'back'] as const) expect(AUDIO_CUES[UI_SFX[key] as AudioCue], key).toBeDefined();
  });
});
