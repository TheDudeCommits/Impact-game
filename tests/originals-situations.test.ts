import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { AUDIO_CUES } from '../src/audio/cuePlan';
import { cueFighter } from '../src/audio/CombatAudio';
import { SITUATION_RULES, VOICE_SITUATIONS, allSituationLines, situationLines, situationSamples, type VoiceSituation } from '../src/audio/voiceSituations';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';
import { fighterShown } from '../src/originals/launch';
import { QUALITY_LINES } from '../src/originals/situations';
import VOICES from '../src/originals/voices.json';

const cues = VOICES.cues as Record<string, { file: string; seconds: number; voice: string }>;
const fighters = Object.keys(FIGHTERS) as FighterId[];

describe('the game\'s situation lines', () => {
  it('ask for no Rift-boss file: the game ships none of them', () => {
    for (const row of allSituationLines()) expect(String(row.line), `${row.fighter} ${row.kind}`).not.toMatch(/^rift:/);
    expect(situationSamples(fighters)).toEqual([]);
  });

  it('are each a registered cue of the fighter who says it, its own recorded line, on disk', () => {
    for (const { fighter, kind, line } of allSituationLines()) {
      expect(line in AUDIO_CUES, `${fighter} ${kind}: ${line}`).toBe(true);
      expect(cueFighter(line), `${line} is ${fighter}'s`).toBe(fighter);
    }
    for (const [fighter, kinds] of Object.entries(QUALITY_LINES)) for (const [kind, list] of Object.entries(kinds)) for (const cue of list) {
      const row = cues[cue];
      expect(row, `${fighter} ${kind}: ${cue} is routed (src/originals/voices.json)`).toBeDefined();
      expect(fs.existsSync(`public/assets/audio/v2/${row.file}`), row.file).toBe(true);
      expect(row.seconds, `${cue} fits ${kind}`).toBeLessThanOrEqual(SITUATION_RULES[kind as VoiceSituation].longest);
      expect(situationLines(fighter as FighterId, kind as VoiceSituation), `${fighter} ${kind}`).toContain(cue);
    }
  });

  it('leave no shown fighter silent in a kind where Impact\'s fighter of the slot speaks (the 21 pairs its Rift rows held)', () => {
    const impact: Record<string, VoiceSituation[]> = {
      shiun: ['bell', 'taunt', 'kill', 'hurt-heavy', 'ko'], shakugo: ['bell', 'low', 'ko'], barrow: ['bell', 'taunt', 'parry', 'low', 'hurt-heavy', 'ko'],
      oro: ['taunt', 'hurt'], 'wuming': ['low', 'ko'], 'jinlin': ['bell', 'hurt-heavy', 'ko'], vesper: ['bell', 'taunt', 'hurt-heavy', 'loss'],
      irbis: ['bell', 'taunt'], jirenga: ['bell', 'hurt-heavy', 'ko'], gorai: ['bell', 'taunt', 'ko'], onigawara: ['bell', 'taunt', 'hurt-heavy', 'ko'],
      akagane: ['bell', 'taunt', 'low', 'ko'], imago: ['bell', 'hurt-heavy', 'loss'], magatsu: ['bell', 'taunt', 'kill', 'low'], haldor: ['bell', 'hurt', 'ko'],
      tokan: ['bell', 'taunt', 'low', 'hurt', 'ko'], senko: ['bell', 'taunt', 'parry', 'low', 'loss'],
    };
    const silent: string[] = [];
    for (const [fighter, kinds] of Object.entries(impact)) {
      if (!fighterShown(fighter as FighterId)) continue;
      for (const kind of kinds) if (!situationLines(fighter as FighterId, kind).length) silent.push(`${fighter} ${kind}`);
    }
    expect(silent).toEqual(EXPECTED_SILENT);
  });

  it('give each of group D\'s 34 fighters a line in all ten kinds, where Impact\'s fighters of those slots leave 85 silent (the second wave)', () => {
    const groupD = ['strix', 'kuzu', 'bonsho', 'strappado', 'gosu', 'shibuichi', 'tokan', 'cardo', 'pyroclast', 'shanxiao', 'ampere', 'highsun', 'oyashio',
      'lanthorn', 'hakushi', 'kinu', 'ovid', 'senko', 'madake', 'minase', 'mizuhiki', 'sorayomi', 'psyche', 'amagoi', 'yodaka', 'murex', 'torsion',
      'kusushi', 'hinomoto', 'bruin', 'akaito', 'tempo', 'sashigane', 'chohan'] as FighterId[];
    const silent = groupD.flatMap(fighter => VOICE_SITUATIONS.filter(kind => !situationLines(fighter, kind).length).map(kind => `${fighter} ${kind}`));
    expect(silent).toEqual([]);
  });
});

/** None: the 15 pairs a Rift row alone held (12, and Tokan's and Senko's three since they opened) each have a new line of the
 *  fighter's own (QUALITY_LINES). */
const EXPECTED_SILENT: string[] = [];
void VOICE_SITUATIONS;
