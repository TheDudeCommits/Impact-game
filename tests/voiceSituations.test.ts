import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.hoisted(() => { (globalThis as { __IMPACT_BASE_VOICE__?: boolean }).__IMPACT_BASE_VOICE__ = true; });
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SITUATION_VOICE_CUES } from '../src/audio/situationVoiceCues';
import cutLines from '../src/audio/data/situationLines.json';
import { CombatAudio, cueFighter } from '../src/audio/CombatAudio';
import { AUDIO_CUES } from '../src/audio/cuePlan';
import { planReaction, planVoice, resetVoiceMemory, voiceRoll, type VoiceScene } from '../src/audio/voicePlan';
import { DODGE_SHARE, LOW_AGAIN, LOW_HEALTH, SITUATION_RULES, VOICE_SITUATIONS, allSituationLines, isRift, lineSeconds, listedSituationLines, ownSituationLines, riftUrl,
  situationLines, situationSamples, situationSources, type VoiceSituation } from '../src/audio/voiceSituations';
import { FIGHTER_QUIPS } from '../src/audio/quipCues';
import { FIGHTERS } from '../src/config';
import type { CombatEvent, FighterId, PlayerState } from '../src/game/types';
import voiceManifest from '../public/assets/audio/v2/voice/manifest.json';
import baseManifest from '../public/assets/audio/v2/manifest.json';
const BOSS_VOICES = new URL('../public/assets/audio/survival/boss-voices.json', import.meta.url);
const bossManifest = existsSync(BOSS_VOICES) ? JSON.parse(readFileSync(BOSS_VOICES, 'utf8')) : { assets: [] };
import riftLevels from '../src/audio/data/riftLineLevels.json';
import VOICES from '../src/originals/voices.json';

const root = new URL('..', import.meta.url);
const hit = (id: number, time: number, props: Partial<CombatEvent> = {}): CombatEvent => ({ id, kind: 'hit', serverTime: time, actorId: 'foe', targetId: 'me', reaction: 'flinch', ...props });
const scene = (target: FighterId, targetHealth = 1, actor: FighterId = 'taisei'): VoiceScene => ({ actor, target, targetHealth });
/** The cutting batches give fighters lines a dozen at a time (scripts/voice/situation_batch.py), so "a fighter with no line"
 *  and "a fighter who still borrows a quip" are read from the data here, never named: Taisei and Konta were the examples
 *  until 13 October 2026, when the first batch gave them their own lines and made six of these tests false. */
const NEVER_BORROWED = ['hurt', 'hurt-heavy', 'ko', 'bell', 'taunt', 'win', 'loss'] as const;
const ROSTER = Object.keys(FIGHTERS) as FighterId[];
const quips = FIGHTER_QUIPS as Record<string, { advantage?: string; resolve?: string } | undefined>;
/** Nothing to say in any kind that is never borrowed: no cry, no bell, no taunt, no result line. */
const SILENT = ROSTER.find(f => NEVER_BORROWED.every(kind => situationLines(f, kind).length === 0))!;
/** No parry line of their own: a perfect guard says their resolve quip. */
const PARRY_BORROWER = ROSTER.find(f => !!quips[f]?.resolve && ownSituationLines(f, 'parry').length === 0 && situationLines(f, 'parry').join() === quips[f]!.resolve)!;
/** No kill line of their own: a knockout scored says their advantage quip. */
const KILL_BORROWER = ROSTER.find(f => !!quips[f]?.advantage && ownSituationLines(f, 'kill').length === 0 && situationLines(f, 'kill').join() === quips[f]!.advantage)!;
/** The first event id from `from` that a speaker's roll for a kind says yes (or no) to. */
const rolled = (speaker: string, kind: VoiceSituation, from: number, yes = true, share = 1) => {
  let id = from;
  while ((voiceRoll(speaker, `r${id}:${kind}`, 6) < SITUATION_RULES[kind].chance * share) !== yes) id++;
  return id;
};

describe('the situations\' lines', () => {
  const rows = allSituationLines(), listed = listedSituationLines();
  const voiceRows = new Map((voiceManifest as { assets: { id: string; source?: string; sourceFile?: string; sourceAsset?: string }[] }).assets.map(row => [row.id, row]));
  const baseRows = new Map((baseManifest as { assets: { id: string; source?: string }[] }).assets.map(row => [row.id, row]));
  const bossRows = new Map((bossManifest as { assets: { id: string; boss: string; file: string; source?: string }[] }).assets.map(row => [row.id, row]));

  it('are the fighter\'s own: a cue named for them, or a line of their own Rift boss', () => {
    expect(listed.length).toBeGreaterThan(100);
    for (const { fighter, kind, line } of listed) {
      expect(fighter in FIGHTERS, fighter).toBe(true);
      if (isRift(line)) {
        if (!bossRows.size) continue;
        const row = bossRows.get(`boss-${line.slice(5)}`);
        expect(row, line).toBeDefined();
        expect(row!.boss, `${line} is ${fighter}'s`).toBe(fighter);
        expect(row!.file).toBe(riftUrl(line));
        expect(existsSync(new URL('public' + riftUrl(line), root)), line).toBe(true);
        expect((riftLevels as Record<string, number[]>)[line.slice(5)], `${line} has a measured level`).toBeDefined();
      } else {
        expect(line in AUDIO_CUES, line).toBe(true);
        expect(cueFighter(line), `${line} is ${fighter}'s (${kind})`).toBe(fighter);
      }
    }
  });
  it('keep the provenance row they always had, and no row was written for them', () => {
    for (const { line } of rows) {
      if (isRift(line) && !bossRows.size) continue;
      if (!isRift(line) && !voiceRows.size && !baseRows.size) continue;
      const row = isRift(line) ? bossRows.get(`boss-${line.slice(5)}`) : voiceRows.get(line) ?? baseRows.get(line);
      expect(row, line).toBeDefined();
      expect(row!.source ?? (row as { sourceFile?: string }).sourceFile ?? (row as { sourceAsset?: string }).sourceAsset, `${line} names where it came from`).toBeTruthy();
    }
  });
  const OVER_CAP: Record<string, string> = {
  };
  it('are no longer than their kind allows', () => {
    const over: string[] = [];
    for (const { fighter, kind, line } of listed) {
      expect(lineSeconds(line), `${fighter} ${kind} ${line}`).toBeGreaterThan(.2);
      if (lineSeconds(line) > SITUATION_RULES[kind].longest) over.push(`${line}: ${kind} (${lineSeconds(line).toFixed(2)} / ${SITUATION_RULES[kind].longest})`);
    }
    expect(over.sort(), 'lines over their situation\'s cap (list them in OVER_CAP, with the reason)').toEqual(Object.entries(OVER_CAP).map(([cue, why]) => `${cue}: ${why}`).sort());
  });
  it('are each in one kind only, and no Rift line a roster call was already cut from is said twice', () => {
    const seen = new Map<string, string>();
    for (const { fighter, kind, line } of listed) {
      expect(seen.get(`${fighter}|${line}`), `${fighter} ${line}`).toBeUndefined();
      seen.set(`${fighter}|${line}`, kind);
    }
    const recut = new Set<string>();
    for (const row of voiceRows.values()) for (const name of JSON.stringify(row).match(/boss-[a-z0-9-]+/g) ?? []) recut.add(name);
    if (voiceRows.size) expect(recut.size).toBeGreaterThan(30);
    for (const { line } of listed) if (isRift(line)) expect(recut.has(`boss-${line.slice(5)}`), line).toBe(false);
  });
  it('borrow only the fighter\'s own quips and lighter cries, and leave a fighter with nothing silent', () => {
    for (const fighter of Object.keys(FIGHTERS) as FighterId[]) {
      const quips = FIGHTER_QUIPS[fighter];
      if (quips?.advantage) expect(situationLines(fighter, 'kill')).toContain(quips.advantage);
      if (quips?.resolve) { expect(situationLines(fighter, 'low')).toContain(quips.resolve); expect(situationLines(fighter, 'parry')).toContain(quips.resolve); }
      for (const kind of ['hurt', 'bell', 'taunt', 'win', 'loss'] as const) expect(situationLines(fighter, kind)).toEqual(ownSituationLines(fighter, kind));
      for (const kind of VOICE_SITUATIONS) for (const { line, from } of situationSources(fighter, kind)) {
        if (!isRift(line)) expect(cueFighter(line), `${fighter} ${kind} ${line}`).toBe(fighter);
        if (from === 'cry') expect(['ko', 'hurt-heavy']).toContain(kind);
      }
    }
    // Tsubute has one pain cry and no heavier one: it is his heavier cry and his knockout too. A fighter with none is silent.
    expect(SILENT, 'a fighter the cutting batches have not reached yet').toBeDefined();
    expect(situationLines('tsubute', 'hurt')).toEqual(['vo-tsubute-hurt']);
    expect(situationLines('tsubute', 'hurt-heavy')).toEqual(['vo-tsubute-hurt']);
    expect(situationLines('tsubute', 'ko')).toEqual(['vo-tsubute-hurt']);
    for (const kind of NEVER_BORROWED) expect(situationLines(SILENT, kind)).toEqual([]);
  });
  it('are loaded with the room: a Rift line is one of the room\'s one-shots, a cue is one of the fighter\'s', () => {
    expect(situationSamples(['taisei'])).toEqual([]);
    const shiun = situationSamples(['shiun']);
    expect(shiun).toContain('/assets/audio/survival/boss-shiun-impossible.m4a');
    for (const url of shiun) expect(url).toMatch(/^\/assets\/audio\/survival\/boss-shiun-[a-z-]+\.m4a$/);
    expect(new Set(situationSamples(['shiun', 'shiun', 'taisei'])).size).toBe(shiun.length);
  });
  it('cut for a situation (step three) are recorded as every cue is, in their kind, from a window nothing else was cut from', () => {
    // scripts/voice/situation_batch.py writes the cue table and data/situationLines.json from the manifest's rows that
    // carry a `situation`: the three cannot disagree, and each row is a whole provenance row.
    type CutRow = { id: string; fighter: string; situation?: string; kind: string; duration: number; source?: string; sourceFile?: string; sourceWindow?: number[][];
      runtimeSha256?: string; sourceSha256?: string; license?: string; audition?: string; whisper?: { free: string }; bed?: number; sourceClipped?: number };
    const all = (voiceManifest as { assets: CutRow[] }).assets, cut = all.filter(row => row.situation);
    if (!all.length) return;
    expect(Object.keys(SITUATION_VOICE_CUES).sort()).toEqual(cut.map(row => row.id).sort());
    const listedCuts = Object.entries(cutLines as Record<string, Record<string, string[]>>).flatMap(([fighter, kinds]) => Object.entries(kinds).flatMap(([kind, cues]) => cues.map(cue => `${fighter}|${kind}|${cue}`)));
    expect(listedCuts.sort()).toEqual(cut.map(row => `${row.fighter}|${row.situation}|${row.id}`).sort());
    for (const row of cut) {
      const kind = row.situation as VoiceSituation;
      expect(VOICE_SITUATIONS, row.id).toContain(kind);
      expect(cueFighter(row.id), row.id).toBe(row.fighter);
      expect(situationLines(row.fighter as FighterId, kind), row.id).toContain(row.id);
      expect(row.duration, row.id).toBeLessThanOrEqual(SITUATION_RULES[kind].longest);
      if (!(row.id in VOICES.cues)) expect(row.duration, row.id).toBeCloseTo(lineSeconds(row.id as never), 3);
      expect(row.source, row.id).toMatch(/^https:\/\//);
      expect(row.sourceFile, row.id).toBeTruthy(); expect(row.sourceWindow?.length, row.id).toBe(1);
      expect(row.runtimeSha256, row.id).toMatch(/^[0-9a-f]{64}$/); expect(row.sourceSha256, row.id).toMatch(/^[0-9a-f]{64}$/);
      expect(row.audition, row.id).toContain('no human listening acceptance');
      expect(row.whisper?.free, row.id).toBeDefined();
      expect(row.bed, row.id).toBeLessThanOrEqual(-12); expect(row.sourceClipped, row.id).toBeLessThanOrEqual(8);
      const file = new URL(`public/assets/audio/v2/voice/${row.id}.wav`, root);
      expect(existsSync(file), row.id).toBe(true);
      expect(createHash('sha256').update(readFileSync(file)).digest('hex'), row.id).toBe(row.runtimeSha256);
      // No two cues share a source window: nothing else cut from the same recording overlaps this one.
      const [start, length] = row.sourceWindow![0];
      for (const other of all) {
        if (other.id === row.id || other.sourceFile !== row.sourceFile) continue;
        for (const [from, span] of other.sourceWindow ?? []) expect(start < from + span && from < start + length, `${row.id} overlaps ${other.id}`).toBe(false);
      }
    }
  });
  it('are written down: the document\'s table is the rules', () => {
    const doc = readFileSync(new URL('docs/audio/VOICE_SITUATIONS.md', root), 'utf8');
    for (const kind of VOICE_SITUATIONS) {
      const row = doc.split('\n').find(line => line.startsWith(`| \`${kind}\` |`));
      expect(row, kind).toBeDefined();
      const cells = row!.split('|').map(cell => cell.trim()), rule = SITUATION_RULES[kind];
      expect([parseFloat(cells[3]) / 100, +cells[4], +cells[5], +cells[6], +cells[7], +cells[8]], kind).toEqual([rule.chance, rule.rest, rule.again, rule.delay, rule.priority, rule.longest]);
    }
    expect(doc).toContain(`${LOW_HEALTH * 100}%`);
  });
});

describe('what a body says when it is acted on (planReaction)', () => {
  beforeEach(() => resetVoiceMemory());
  const cues = (event: CombatEvent, who: VoiceScene) => planVoice(event, false, who).map(layer => layer.url ?? layer.cue);

  it('says nothing without knowing who is in the event, and nothing for a fighter with no line', () => {
    expect(planVoice(hit(rolled('me', 'hurt', 1), 10))).toEqual([]);
    expect(planVoice(hit(rolled('me', 'hurt', 1), 10), false, scene(SILENT))).toEqual([]);
    expect(planVoice({ id: 3, kind: 'eliminated', serverTime: 10, actorId: 'foe', targetId: 'me' })).toEqual([]);
  });
  it('cries out on about a quarter of the hits taken, never twice inside 1.2 s, and plans an event the same twice', () => {
    let voiced = 0; const times: number[] = [];
    for (let i = 0; i < 600; i++) {
      const event = hit(1000 + i, 10 + i * 2), layers = planVoice(event, false, scene('tsubute'));
      expect(planVoice(event, false, scene('tsubute'))).toEqual(layers);
      if (layers.length) { voiced++; times.push(event.serverTime); expect(layers).toEqual([expect.objectContaining({ cue: 'vo-tsubute-hurt', bus: 'voice', speaker: 'me', yields: 'all', voicePriority: -1, phase: 'impact' })]); }
    }
    // The same cry again needs 4 s, which hits 2 s apart respect too: a little under the bare quarter.
    expect(voiced / 600).toBeGreaterThan(.15); expect(voiced / 600).toBeLessThan(.3);
    resetVoiceMemory();
    const flurry: number[] = [];
    for (let i = 0; i < 400; i++) if (planVoice(hit(5000 + i, 10 + i * .25), false, scene('tsubute')).length) flurry.push(10 + i * .25);
    expect(flurry.length).toBeGreaterThan(5);
    for (let i = 1; i < flurry.length; i++) expect(flurry[i] - flurry[i - 1]).toBeGreaterThanOrEqual(SITUATION_RULES.hurt.again);
  });
  it('cries heavier when it is thrown, once for the launch and the wall it meets', () => {
    const launch = hit(rolled('me', 'hurt-heavy', 1), 10, { reaction: 'launched' });
    expect(planVoice(launch, false, scene('shiun'))).toEqual([expect.objectContaining({ url: '/assets/audio/survival/boss-shiun-careless.m4a', speaker: 'me', yields: 'all', voicePriority: -.5 })]);
    // The splat is the thrown body's own event: it names itself as the actor.
    expect(planVoice({ id: rolled('me', 'hurt-heavy', 500), kind: 'wall-splat', serverTime: 10.4, actorId: 'me', fighter: 'shiun' }, false, { actor: 'shiun' })).toEqual([]);
    expect(planVoice({ id: rolled('me', 'hurt-heavy', 900), kind: 'wall-splat', serverTime: 40, actorId: 'me', fighter: 'shiun' }, false, { actor: 'shiun' })).toHaveLength(1);
    // A flinch is not a heavier cry, and Shiun has no lighter one.
    resetVoiceMemory();
    expect(planVoice(hit(rolled('me', 'hurt', 1), 10), false, scene('shiun'))).toEqual([]);
  });
  it('says the low-health line once a life, in place of that hit\'s cry', () => {
    expect(cues(hit(1, 10), scene('tokan', .31))).not.toContain('/assets/audio/survival/boss-tokan-you-did-it.m4a');
    const low = planVoice(hit(2, 20), false, scene('tokan', .3));
    expect(low).toHaveLength(1);
    expect(situationLines('tokan', 'low')).toContain(low[0].url ? `rift:${low[0].url.match(/boss-(.+)\.m4a$/)![1]}` : low[0].cue);
    expect(low[0]).toMatchObject({ speaker: 'me', yields: 'self', voicePriority: 1, delay: .2 });
    // Still low and still being hit: a cry now and then, never the line again inside LOW_AGAIN - and once more after it,
    // as the local player's resolve quip came back every 90 s (nothing they used to hear is taken away).
    for (let i = 0; i < 20; i++) for (const layer of planVoice(hit(100 + i, 22 + i * 4), false, scene('tokan', .1))) expect(layer.yields).toBe('all');
    expect(planVoice(hit(300, 20 + LOW_AGAIN - 1), false, scene('tokan', .1)).every(layer => layer.yields === 'all')).toBe(true);
    expect(planVoice(hit(301, 20 + LOW_AGAIN), false, scene('tokan', .1))[0]).toMatchObject({ yields: 'self', voicePriority: 1 });
    // A new life, or health won back, arms it again.
    planVoice({ id: 900, kind: 'respawn', serverTime: 2000, actorId: 'me' }, false, {});
    expect(planVoice(hit(901, 2001), false, scene('tokan', .2))[0]).toMatchObject({ yields: 'self', voicePriority: 1 });
    expect(planVoice(hit(902, 2040), false, scene('tokan', .2)).every(layer => layer.yields === 'all')).toBe(true);
    planVoice(hit(903, 2050), false, scene('tokan', .9));
    expect(planVoice(hit(904, 2060), false, scene('tokan', .2))[0]).toMatchObject({ yields: 'self', voicePriority: 1 });
  });
  it('at a knockout: the victim\'s cry always, then the killer\'s line - for everyone, and never for a fall nobody scored', () => {
    const ko = (id: number, time: number, actorId = 'foe', targetId = 'me'): CombatEvent => ({ id, kind: 'eliminated', serverTime: time, actorId, targetId });
    const layers = planVoice(ko(1, 10), false, { actor: 'magatsu', target: 'shiun', targetHealth: 0 });
    expect(layers).toHaveLength(2);
    expect(layers[0]).toMatchObject({ url: '/assets/audio/survival/boss-shiun-impossible.m4a', speaker: 'me', voicePriority: 1.5, phase: 'impact' });
    expect(layers[0].yields).toBeUndefined();
    expect(layers[1]).toMatchObject({ speaker: 'foe', yields: 'self', delay: .6, voicePriority: 1 });
    expect([...situationLines('magatsu', 'kill')].map(line => isRift(line) ? riftUrl(line) : line)).toContain(layers[1].url ?? layers[1].cue);
    // The killer rests 8 s; the next victim still cries out.
    expect(planVoice(ko(2, 14, 'foe', 'other'), false, { actor: 'magatsu', target: 'shiun' }).map(layer => layer.speaker)).toEqual(['other']);
    expect(planVoice(ko(3, 18.1, 'foe', 'third'), false, { actor: 'magatsu', target: 'shiun' }).map(layer => layer.speaker)).toEqual(['third', 'foe']);
    // A self-knockout and a fall with no scorer have no killer's line; a fighter with no cry is silent.
    expect(planVoice(ko(4, 100, 'me', 'me'), false, { actor: 'shiun', target: 'shiun' }).map(layer => layer.speaker)).toEqual(['me']);
    expect(planVoice(ko(5, 200, '', 'me'), false, { target: 'shiun' }).map(layer => layer.speaker)).toEqual(['me']);
    expect(planVoice(ko(6, 300, 'nobody', 'quiet'), false, { target: SILENT })).toEqual([]);
    // Every fighter with an advantage quip has a kill line: it was the local player's alone.
    resetVoiceMemory();
    expect(KILL_BORROWER, 'a fighter whose kill line is still their advantage quip').toBeDefined();
    expect(planVoice(ko(7, 10, 'p9', 'p3'), false, { actor: KILL_BORROWER, target: SILENT })).toEqual([expect.objectContaining({ cue: quips[KILL_BORROWER]!.advantage, speaker: 'p9' })]);
  });
  it('on a blow read - a perfect guard, the vanish out of it, a dodge - the reader speaks, once a moment', () => {
    const guard = (id: number, time: number): CombatEvent => ({ id, kind: 'just-guard', serverTime: time, actorId: 'foe', targetId: 'me', fighter: 'oro' });
    const vanish = (id: number, time: number): CombatEvent => ({ id, kind: 'vanish', serverTime: time, actorId: 'me', targetId: 'foe', fighter: PARRY_BORROWER });
    // Every perfect guard, whatever the event's id: the local player's always spoke (QuipDirector), and everyone's does now.
    expect(SITUATION_RULES.parry.chance).toBe(1);
    expect(PARRY_BORROWER, 'a fighter whose perfect guard still says their resolve quip').toBeDefined();
    for (let id = 1; id < 40; id++) { resetVoiceMemory(); expect(planVoice(guard(id, 10), false, scene(PARRY_BORROWER)), `event ${id}`).toEqual([expect.objectContaining({ cue: quips[PARRY_BORROWER]!.resolve, speaker: 'me', yields: 'self', delay: .15 })]); }
    // The vanish out of the same guard is the same moment: one line, not two. Then rested 20 s, and the same line 30 s.
    expect(planVoice(vanish(900, 10), false, { actor: PARRY_BORROWER, target: 'oro' })).toEqual([]);
    expect(planVoice(guard(901, 25), false, scene(PARRY_BORROWER))).toEqual([]);
    expect(planVoice(guard(902, 41), false, scene(PARRY_BORROWER))).toHaveLength(1);
    // A vanish alone speaks too.
    resetVoiceMemory();
    expect(planVoice(vanish(903, 11), false, { actor: PARRY_BORROWER, target: 'oro' })).toHaveLength(1);
    // A dodge speaks a quarter of the time: an id it does not speak on, and one it does.
    resetVoiceMemory();
    expect(planVoice({ id: rolled('me', 'parry', 1, false, DODGE_SHARE), kind: 'dodge', serverTime: 10, actorId: 'foe', targetId: 'me' }, false, scene(PARRY_BORROWER))).toEqual([]);
    expect(planVoice({ id: rolled('me', 'parry', 500, true, DODGE_SHARE), kind: 'dodge', serverTime: 20, actorId: 'foe', targetId: 'me' }, false, scene(PARRY_BORROWER))).toHaveLength(1);
    let spoke = 0; for (let id = 1000; id < 1400; id++) { resetVoiceMemory(); spoke += planVoice({ id, kind: 'dodge', serverTime: 10, actorId: 'foe', targetId: 'me' }, false, scene(PARRY_BORROWER)).length; }
    expect(spoke / 400).toBeGreaterThan(.17); expect(spoke / 400).toBeLessThan(.33);
  });
  it('never speaks for an enemy of the Rift, whatever fighter its event carries', () => {
    expect(planReaction({ id: 1, kind: 'eliminated', serverTime: 10, actorId: 'horde', targetId: 'me', fighter: 'magatsu' }, { target: 'shiun' }).map(layer => layer.speaker)).toEqual(['me']);
    expect(planReaction({ id: rolled('boss', 'hurt-heavy', 1), kind: 'wall-splat', serverTime: 10, actorId: 'boss', fighter: 'shiun' }, {})).toEqual([]);
    expect(planReaction({ id: rolled('boss', 'parry', 1), kind: 'vanish', serverTime: 10, actorId: 'boss', targetId: 'me', fighter: 'shiun' }, { target: 'taisei' })).toEqual([]);
  });
  it('plans a cast\'s own voice exactly as before, whatever a situation has just said', () => {
    // Nothing a fighter used to say goes unsaid because of a situation line: the same casts, planned with a knockout, a
    // perfect guard and a low-health hit between them, are voiced as they are with none.
    const casts: CombatEvent[] = [];
    for (let i = 0; i < 120; i++) casts.push({ id: i + 1, kind: 'cast', serverTime: 40 + i * .45, actorId: 'me', fighter: 'taisei', slot: i % 9 === 8 ? 'heavy' : i % 13 === 12 ? 'special' : 'light', chain: i % 4, actionSeq: i + 1 });
    const alone = casts.map(event => planVoice(event));
    expect(alone.filter(layers => layers.length).length).toBeGreaterThan(20);
    resetVoiceMemory();
    const among = casts.map((event, i) => {
      if (i % 10 === 3) planVoice({ id: 9000 + i, kind: 'eliminated', serverTime: event.serverTime - .1, actorId: 'me', targetId: 'foe' }, false, { actor: 'taisei', target: 'konta' });
      if (i % 10 === 6) planVoice({ id: 9000 + i, kind: 'just-guard', serverTime: event.serverTime - .1, actorId: 'foe', targetId: 'me' }, false, scene('taisei'));
      if (i % 10 === 8) planVoice(hit(9000 + i, event.serverTime - .1), false, scene('taisei', .2));
      return planVoice(event);
    });
    expect(among).toEqual(alone);
  });
});

describe('the situations in the mix', () => {
  class Param { value = 1; setValueAtTime() {} linearRampToValueAtTime() {} setTargetAtTime() {} cancelScheduledValues() {} cancelAndHoldAtTime() {} }
  class Node { gain = new Param(); pan = new Param(); connect() { return this; } disconnect() {} }
  class Source extends Node { buffer?: unknown; playbackRate = new Param(); loop = false; loopStart = 0; loopEnd = 0; onended?: () => void; starts: number[] = []; stops: number[] = []; start(t: number) { this.starts.push(t); } stop(t: number) { this.stops.push(t); } }
  class Context { static last: Context; currentTime = 10; state = 'running'; destination = new Node(); sources: Source[] = []; constructor() { Context.last = this; }
    createGain() { return new Node(); } createStereoPanner() { return new Node(); } createBufferSource() { const x = new Source(); this.sources.push(x); return x; }
    createDynamicsCompressor() { return Object.assign(new Node(), { threshold: new Param(), knee: new Param(), ratio: new Param(), attack: new Param(), release: new Param() }); }
    resume() { return Promise.resolve(); } close() { return Promise.resolve(); } decodeAudioData() { return Promise.resolve({ duration: 1 }); } }
  const player = (props: Partial<PlayerState> = {}): PlayerState => ({ id: 'self', name: 'Tsubute', fighter: 'tsubute', x: 0, y: 0, z: 0, yaw: 0, hp: 1000, maxHp: 1000, stamina: 100, ultimate: 100,
    action: 'idle', actionStarted: 1, actionTime: .05, actionDuration: 1, target: null, alive: true, isBot: false, grounded: true, guarding: false, cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 }, ...props }) as PlayerState;
  let fetched: string[] = [];
  async function create(options: { byRoom?: boolean } = {}, prepare: string[] = []) {
    fetched = [];
    vi.stubGlobal('AudioContext', Context);
    vi.stubGlobal('fetch', async (url: string) => { fetched.push(url); return { ok: !url.endsWith('packed.json'), headers: { get: () => 'audio/wav' }, arrayBuffer: async () => new ArrayBuffer(8) }; });
    const audio = new CombatAudio(options);
    if (prepare.length) void audio.prepare(prepare);
    await audio.unlock(); await audio.ready(2000);
    return audio;
  }
  type Sound = { bus: string; owner: string; stopping: boolean; priority: number; start: number };
  const voices = (audio: CombatAudio) => [...(audio as unknown as { sounds: Set<Sound> }).sounds].filter(sound => sound.bus === 'voice' && !sound.stopping);
  const cast = (id: number, actorId: string, fighter: FighterId, slot: 'heavy' | 'special' = 'special'): CombatEvent => ({ id, kind: 'cast', serverTime: 10, actorId, fighter, slot, actionSeq: id });
  beforeEach(() => resetVoiceMemory());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('a cry is its body\'s own, and a hit cry never cuts that body\'s call', async () => {
    const audio = await create(), me = player({ action: 'special', actionStarted: 10 }), foe = player({ id: 'foe', fighter: 'taisei', x: 2 });
    audio.handle([hit(rolled('self', 'hurt', 1), 10, { targetId: 'self' })], 'self', [player(), foe]);
    expect(voices(audio).map(sound => sound.owner)).toEqual(['self']);
    audio.reset(); resetVoiceMemory();
    // Mid-call: the cry is dropped, the call plays on.
    audio.handle([cast(50, 'self', 'tsubute')], 'self', [me, foe]);
    const call = voices(audio); expect(call).toHaveLength(1);
    audio.handle([hit(rolled('self', 'hurt', 100), 10.2, { targetId: 'self' })], 'self', [me, foe]);
    expect(voices(audio)).toEqual(call);
    audio.dispose();
  });
  it('a hit cry never takes a speaker\'s place: with two voices speaking it is dropped, local fighter or not', async () => {
    const audio = await create(), players = [player(), player({ id: 'a', fighter: 'taisei', x: 2, action: 'special', actionStarted: 10 }), player({ id: 'b', fighter: 'ouga', x: 3, action: 'special', actionStarted: 10 })];
    audio.handle([cast(1, 'a', 'taisei')], 'self', players);
    audio.handle([hit(rolled('self', 'hurt', 100), 10.1, { actorId: 'a', targetId: 'self' })], 'self', players);
    expect(voices(audio).map(sound => sound.owner).sort()).toEqual(['a', 'self']);
    audio.reset(); resetVoiceMemory();
    audio.handle([cast(2, 'a', 'taisei'), cast(3, 'b', 'ouga')], 'self', players);
    expect(voices(audio).map(sound => sound.owner).sort()).toEqual(['a', 'b']);
    audio.handle([hit(rolled('self', 'hurt', 200), 10.1, { actorId: 'a', targetId: 'self' })], 'self', players);
    expect(voices(audio).map(sound => sound.owner).sort()).toEqual(['a', 'b']);
    audio.dispose();
  });
  it('the knockout cry cuts the victim\'s own line, and the killer\'s line waits behind their call', async () => {
    const audio = await create(), shiun = player({ id: 'v', fighter: 'shiun', x: 2, action: 'special', actionStarted: 10 }), me = player({ fighter: 'taisei', action: 'special', actionStarted: 10 });
    await (audio as unknown as { loadSample(url: string): Promise<void> }).loadSample('/assets/audio/survival/boss-shiun-impossible.m4a');
    audio.handle([cast(1, 'v', 'shiun'), cast(2, 'self', 'taisei')], 'self', [me, shiun]);
    const before = voices(audio); expect(before.map(sound => sound.owner).sort()).toEqual(['self', 'v']);
    audio.handle([{ id: 3, kind: 'eliminated', serverTime: 10.5, actorId: 'self', targetId: 'v' }], 'self', [me, { ...shiun, hp: 0 }]);
    const after = voices(audio);
    // Shiun's spell is cut by his cry; Taisei is still calling his Sunpalm Cannon, so his kill line is dropped, not queued.
    expect(after.filter(sound => sound.owner === 'v')).toHaveLength(1);
    expect(after.find(sound => sound.owner === 'v')).not.toBe(before.find(sound => sound.owner === 'v'));
    expect(after.filter(sound => sound.owner === 'self')).toEqual(before.filter(sound => sound.owner === 'self'));
    audio.dispose();
  });
  it('a taunt rests 8 s, and a fighter with no taunt says nothing', async () => {
    const audio = await create(), now = vi.spyOn(performance, 'now');
    now.mockReturnValue(1000);
    audio.handle([], 'self', [player(), player({ id: 'quiet', fighter: SILENT, x: 1 })]);
    expect(audio.say('taunt', 'self')).toBeCloseTo(lineSeconds('vo-tsubute-try-this'));
    expect(voices(audio).map(sound => sound.owner)).toEqual(['self']);
    audio.reset(); audio.handle([], 'self', [player(), player({ id: 'quiet', fighter: SILENT, x: 1 })]);
    // (`reset` is a new match: the rest starts over.) Said again at once, then rested.
    expect(audio.say('taunt', 'self')).toBeDefined();
    for (const sound of voices(audio)) sound.stopping = true;
    now.mockReturnValue(1000 + 7900); expect(audio.say('taunt', 'self')).toBeUndefined();
    now.mockReturnValue(1000 + 8100); expect(audio.say('taunt', 'self')).toBeDefined();
    expect(audio.say('taunt', 'quiet')).toBeUndefined();
    expect(audio.say('taunt', 'nobody')).toBeUndefined();
    now.mockRestore(); audio.dispose();
  });
  it('at the bell the local fighter speaks, then the nearest opponent, and nobody else', async () => {
    // (The bank opens on real timers - its batches are spaced by them - and the bell is then timed on fake ones.)
    const audio = await create();
    vi.useFakeTimers();
    const players = [player({ fighter: 'chohan' }), player({ id: 'far', fighter: 'hawser', x: 12 }), player({ id: 'near', fighter: 'yodaka', x: 3 }), player({ id: 'mate', fighter: 'hikui', x: 1, team: 'a' })];
    players[0].team = 'a';
    audio.handle([], 'self', players);
    audio.bell(.9);
    expect(voices(audio).map(sound => sound.owner)).toEqual(['self']);
    await vi.advanceTimersByTimeAsync((.9 + lineSeconds('vo-chohan-no-time') + .25) * 1000 + 20);
    expect(voices(audio).map(sound => sound.owner)).toEqual(['self', 'near']);
    await vi.advanceTimersByTimeAsync(10000);
    expect(voices(audio).map(sound => sound.owner)).toEqual(['self', 'near']);
    audio.dispose();
  });
  it('the result: a winner with a win line of their own says it; one with none is left to their home line; the loser\'s line follows', async () => {
    const audio = await create();
    audio.preload(['/assets/audio/survival/boss-imago-checkmate.m4a']); await audio.ready(2000);
    audio.handle([], 'self', [player({ fighter: 'imago' })]);
    // Amagoi has a win line: it is said, as `quote` says a home line - the victory's own owner, on the voice bus - and the
    // finale is timed on it. The local Imago lost: "checkmate" follows it.
    expect(audio.winSeconds('amagoi')).toBeCloseTo(lineSeconds('vo-amagoi-quip-victory'));
    expect(audio.winLine('amagoi', .8)).toBeCloseTo(lineSeconds('vo-amagoi-quip-victory'));
    audio.lossLine(.8 + lineSeconds('vo-amagoi-quip-victory') + .4);
    expect(voices(audio).map(sound => sound.owner)).toEqual(['victory', 'defeat']);
    const [win, loss] = voices(audio);
    expect(win.priority).toBe(8); // `quote`'s: 7, and a voice line's 1.
    expect(loss.start - win.start).toBeCloseTo(lineSeconds('vo-amagoi-quip-victory') + .4, 2);
    audio.reset();
    // A fighter with none - most of the roster still: nothing is said here, nothing times the finale, and main.ts says
    // their home line as it always did (tests/victoryQuote.test.ts holds that statement).
    expect(audio.winLine(SILENT, 1.9)).toBeUndefined();
    expect(audio.winSeconds(SILENT)).toBeUndefined();
    expect(voices(audio)).toEqual([]);
    // A fighter with two win lines says each in its turn, and the finale is timed on the one being said.
    const first = audio.winLine('shibuichi', 1.9)!;
    expect(audio.winSeconds('shibuichi')).toBeCloseTo(first);
    audio.dispose();
  });
  it('a win line that is not ready is not said and does not time the finale: the home line is', async () => {
    const audio = await create({ byRoom: true }, ['taisei']);   // Amagoi is not in this room: his cues are not loaded.
    audio.handle([], 'self', [player({ fighter: 'taisei' })]);
    expect(audio.winSeconds('amagoi')).toBeUndefined();
    expect(audio.winLine('amagoi', .8)).toBeUndefined();
    expect(voices(audio)).toEqual([]);
    audio.dispose();
  });
  it('a room\'s Rift lines are fetched and decoded with it, behind the loading screen, and let go with their fighter', async () => {
    const audio = await create({ byRoom: true }, ['shiun', 'taisei']);
    const rift = fetched.filter(url => url.includes('/survival/boss-'));
    expect(rift.sort()).toEqual(situationSamples(['shiun']).sort());
    const samples = (audio as unknown as { samples: Map<string, unknown> }).samples;
    for (const url of situationSamples(['shiun'])) expect(samples.has(url), url).toBe(true);
    await audio.prepare(['magatsu']); await audio.ready(2000);
    for (const url of situationSamples(['magatsu'])) expect(samples.has(url), url).toBe(true);
    audio.retain(['magatsu', 'taisei']);
    for (const url of situationSamples(['shiun'])) expect(samples.has(url), url).toBe(false);
    for (const url of situationSamples(['magatsu'])) expect(samples.has(url), url).toBe(true);
    audio.dispose();
  });
});
