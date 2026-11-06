import { afterEach, describe, expect, it, vi } from 'vitest';
import { build } from 'vite';
import { fileURLToPath } from 'node:url';
import { laboratoryFighter, isLaboratoryPreviewFighter, selectLaboratoryFighter } from './fighterLab';
import { isReleasedFighter } from './game/rosterAvailability';
import { mayPlay } from './game/economy/fighters';
import { LocalTraining, Network } from './network';
import { LocalDuel } from './game/duel/LocalDuel';
import { LocalRoyale } from './game/LocalRoyale';
import { LocalObjective } from './game/objectives/LocalObjective';
import { LocalRift } from './game/moba/LocalRift';

// Keep a real integrated kit as an unreleased fixture so the admission boundary
// remains exercised after every current candidate has shipped.
vi.mock('./game/rosterAvailability', async importOriginal => {
  const actual = await importOriginal<typeof import('./game/rosterAvailability')>();
  const isReleasedFighter = (value: unknown) => value !== 'strix' && actual.isReleasedFighter(value);
  return { ...actual, RELEASED_FIGHTERS: actual.RELEASED_FIGHTERS.filter(id => id !== 'strix'), LABORATORY_FIGHTERS: ['strix'],
    isReleasedFighter, isLaboratoryFighter: (value: unknown) => value === 'strix',
    requireReleasedFighter: (value: unknown) => { if (!isReleasedFighter(value)) throw new Error('This fighter is not available.'); },
  };
});

function route(mode: string, search: string) {
  vi.stubEnv('MODE', mode);
  vi.stubGlobal('location', { search });
}
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('explicit offline fighter laboratory capability', () => {
  it.each(['production', 'development', 'test', 'fighter-lab-preview'])('%s never accepts a candidate URL, even with DEV true', mode => {
    route(mode, '?fighter-lab=strix'); vi.stubEnv('DEV', true);
    expect(laboratoryFighter()).toBeUndefined();
  });
  it.each(['', '?fighter-lab=', '?fighter-lab=taisei', '?fighter-lab=unknown', '?fighter-lab=__proto__', '?fighter-lab=strix&fighter-lab=strix'])('requires one registered laboratory ID: %s', search => {
    route('fighter-lab', search); expect(laboratoryFighter()).toBeUndefined();
  });
  it('admits only the requested candidate to local Training in the explicit packaged mode', async () => {
    route('fighter-lab', '?fighter-lab=strix&online-training'); vi.stubEnv('DEV', false);
    expect(laboratoryFighter()).toBe('strix'); expect(LocalTraining.wanted()).toBe(true);
    const practice = new LocalTraining();
    try {
      await practice.connect('strix', 'Reviewer');
      expect(practice.snapshot?.roomMode).toBe('training');
      expect(practice.snapshot?.players.find(player => player.id === practice.id)?.fighter).toBe('strix');
      expect(practice.local).toBe(true);
      expect(practice.snapshot?.players.filter(player => player.isBot).every(player => isReleasedFighter(player.fighter))).toBe(true);
    } finally { await practice.leave(); }
  });
  it('never promotes the candidate into ownership, other local modes, or network Training', async () => {
    route('fighter-lab', '?fighter-lab=strix');
    expect(isReleasedFighter('strix')).toBe(false);
    expect(mayPlay('strix', { items: {}, allAccess: true })).toBe(false);
    await expect(new Network('https://test.invalid').connect('strix', 'training', 'Reviewer')).rejects.toThrow('not available');
    await expect(new LocalDuel().connect('strix', 'Reviewer')).rejects.toThrow('not available');
    await expect(new LocalRoyale().connect('strix', 'Reviewer')).rejects.toThrow('not available');
    await expect(new LocalObjective().connect('strix', 'Reviewer', 'last-stand', 'bots')).rejects.toThrow('not available');
    await expect(new LocalRift().connect('strix', 'Reviewer')).rejects.toThrow('not available');
  });
  it('lets the laboratory homepage choose a registered candidate without granting ordinary ownership',()=>{
    route('fighter-lab','');
    vi.stubGlobal('location',{href:'https://lab.invalid/?quality=low',search:''});
    const replaceState=vi.fn();vi.stubGlobal('history',{state:null,replaceState});
    expect(isLaboratoryPreviewFighter('strix')).toBe(true);
    expect(selectLaboratoryFighter('strix')).toBe(true);
    expect(String(replaceState.mock.calls[0][2])).toBe('https://lab.invalid/?quality=low&fighter-lab=strix');
    expect(selectLaboratoryFighter('taisei')).toBe(false);
    expect(selectLaboratoryFighter('unknown')).toBe(false);
    expect(mayPlay('strix',{items:{},allAccess:true})).toBe(false);
    route('production','?fighter-lab=strix');
    expect(isLaboratoryPreviewFighter('strix')).toBe(false);
    expect(selectLaboratoryFighter('strix')).toBe(false);
    expect(replaceState).toHaveBeenCalledTimes(1);
  });
});

/** Exercise Vite's real compile-time replacement, not a mock of the build flag.
 * No public assets are copied and no output directory is written. */
async function bundled(mode: string) {
  const result = await build({ configFile: false, mode, publicDir: false, logLevel: 'silent',
    build: { write: false, minify: true, lib: {
      entry: fileURLToPath(new URL('./fighterLab.ts', import.meta.url)), formats: ['es'], fileName: 'fighter-lab-gate',
    } } });
  return (Array.isArray(result) ? result : [result]).flatMap(output => 'output' in output ? output.output : [])
    .filter(chunk => chunk.type === 'chunk').map(chunk => chunk.code).join('\n');
}
describe('packaged laboratory build boundary', () => {
  it('dead-strips the query selector from ordinary production', async () => {
    const code = await bundled('production');
    expect(code).not.toContain('fighter-lab'); expect(code).not.toContain('URLSearchParams');
  });
  it('retains the exact registered-ID selector only for fighter-lab', async () => {
    const code = await bundled('fighter-lab');
    expect(code).toContain('fighter-lab'); expect(code).toContain('URLSearchParams'); expect(code).toContain('strix');
  });
});
