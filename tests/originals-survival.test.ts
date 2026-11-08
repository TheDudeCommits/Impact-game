import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import { ENEMIES, SHADOW_RIVALS } from '../src/survival/enemies';
import { BOSSES } from '../src/survival/bosses';
import { AWAKENINGS, SIGNATURES } from '../src/survival/signatures';
import { RELICS } from '../src/survival/relics';
import { UPGRADES } from '../src/survival/upgrades';
import { rankText } from '../src/survival/skillText';
import { SKILL_TREE } from '../src/survival/skillTree';
import { GRUNTS } from '../src/survival/horde/kinds';
import { LOCATIONS } from '../src/survival/locations';
import { BOSS_LINE_FILES, BOSS_VOICES } from '../src/audio/bossVoices';
import { Horde } from '../src/survival/horde/Horde';

const sha = (file: string) => createHash('sha256').update(readFileSync(file)).digest('hex');
const walk = (dir: string): string[] => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? walk(path) : [path]; });


const shown: [string, string][] = [];
const show = (where: string, text: string | undefined) => { if (text) shown.push([where, text]); };

for (const def of Object.values(ENEMIES)) {
  show(`${def.id} name`, def.name); show(`${def.id} title`, def.title);
  for (const move of def.moves) show(`${def.id} move`, move.name);
}
for (const entry of BOSSES) { show(`${entry.id} epithet`, entry.epithet); show(`${entry.id} universe`, entry.universe); }
for (const [id, awakening] of Object.entries(AWAKENINGS)) show(`${id} awakening`, awakening.name);
for (const [id, signatures] of Object.entries(SIGNATURES)) for (const sig of signatures) {
  show(`${id} signature`, sig.name);
  if (sig.kind === 'pull') show(`${id} release`, sig.release);
}
for (const relic of RELICS) { show(`relic ${relic.id}`, relic.name); show(`relic ${relic.id} text`, relic.text); }
for (const def of UPGRADES) {
  show(`upgrade ${def.id}`, def.name);
  for (let held = 0; held < def.max; held++) show(`upgrade ${def.id} card`, def.describe(held, 12));
}
for (const node of SKILL_TREE) {
  show(`tree ${node.id}`, node.line);
  for (let rank = 1; rank <= (UPGRADES.find(def => def.id === node.id)?.max ?? 1); rank++) show(`tree ${node.id} rank`, rankText(node.id, rank, 12));
}
for (const kind of GRUNTS) { show(`grunt ${kind.id}`, kind.name); for (const move of kind.moves) show(`grunt ${kind.id} move`, move.name); }
for (const place of LOCATIONS) for (const text of [place.name, place.subtitle, place.line, place.again]) show(`place ${place.id}`, text);

describe('Arcade Survival in the the game', () => {



  it('turns the shadow rivals into shadows of the sixteen VOL.1 originals', () => {
    expect(SHADOW_RIVALS).toHaveLength(16);
    for (const id of SHADOW_RIVALS) expect(ENEMIES[id].name, id).toBe(`Shadow ${FIGHTERS[ENEMIES[id].rival as keyof typeof FIGHTERS].name}`); // each shadow named as the roster names its fighter
  });




  it('keeps a run going when a time stop\'s tour asks the horde for nobody (the earlier crash with the kuon slot\'s ultimate)', () => {
    const horde = new Horde(() => .5, { strike: () => {}, killed: () => {}, summon: () => {} } as unknown as ConstructorParameters<typeof Horde>[1]);
    expect(horde.locate(undefined as unknown as string)).toBeUndefined();
    expect(horde.slotOf(undefined as unknown as string)).toBeUndefined();
  });


});
