import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { FIGHTERS } from '../src/config';
import { MOVES } from '../src/game/moves';
import type { FighterId, PlayerState } from '../src/game/types';
import { strikeOffsets } from '../src/engine/sim/areaDamage';
import { areaAnimOf } from '../src/engine/sim/areaMoves';
import authored from '../src/engine/sim/areaMoves.json';
import { bindClips, Fighter } from '../src/render/Fighter';
import { AREA_CASTS, areaCastAnim, castHold, newCastHold } from '../src/originals/areaCasts';
import { base, loadRig } from './rigHarness';

const glbJson = (file: string) => { const b = fs.readFileSync(`public${file}`), n = b.readUInt32LE(12); return JSON.parse(b.subarray(20, 20 + n).toString()); };
const clipSeconds = (file: string, name: string): number | undefined => {
  const j = glbJson(file), a = (j.animations ?? []).find((x: { name: string }) => x.name === name);
  if (!a) return undefined;
  return Math.max(...a.samplers.map((s: { input: number }) => j.accessors[s.input].max?.[0] ?? 0));
};
const ids = Object.keys(AREA_CASTS) as FighterId[];

describe('the authored area casts', () => {
  it('ship each take in the file its body joins, at its own length, past the move\'s last strike', () => {
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const def = FIGHTERS[id], cast = AREA_CASTS[id]!, move = MOVES[id].area!;
      const last = move.contacts[0] + move.area!.telegraph + Math.max(...strikeOffsets(move));
      for (const [which, take, files] of [['base', cast.base, def.extraModels ?? []], ['form', cast.form, def.formExtraModels ?? []]] as const) {
        if (!take) continue;
        const found = files.map(f => clipSeconds(f, take.clip)).find(s => s !== undefined);
        expect(found, `${id} ${which}: ${take.clip} in ${files.join(', ')}`).toBeDefined();
        expect(Math.abs(found! - take.seconds), `${id} ${which} length`).toBeLessThan(1 / 60 + 1e-3);
        expect(take.seconds, `${id} ${which} runs past the last strike`).toBeGreaterThan(last + .2);
      }
      if (cast.form) expect(def.formModel, `${id} has a form`).toBeDefined();
    }
  });
  it('leave the move\'s data as main wrote it: only how the cast is drawn changes', () => {
    for (const id of ids) {
      const entry = (authored as Record<string, { duration?: number; contacts?: number[] }>)[id];
      const move = MOVES[id].area!;
      expect(move.duration).toBe(entry?.duration ?? .62);
      expect(move.contacts).toEqual(entry?.contacts ?? [.38]);
      const cast = AREA_CASTS[id]!, anim = areaCastAnim({ ...base(id), action: 'area', awakened: !cast.base } as PlayerState)!;
      expect(anim).toEqual({ fighter: id, slot: 'special', clip: cast.base?.clip ?? cast.form!.clip, full: true });
      // A form-only take leaves the unawakened cast as main draws it.
      if (!cast.base) expect(areaCastAnim({ ...base(id), action: 'area' } as PlayerState)).toBeUndefined();
    }
    expect(areaCastAnim({ ...base('taisei'), action: 'area' })).toBeUndefined();
    expect(areaAnimOf('taisei', MOVES.taisei.area).fighter).toBe('taisei');
  });
});

describe('the hold after the move', () => {
  const take = AREA_CASTS['madake']!.base!, move = MOVES['madake'].area!;
  const area = (t: number): PlayerState => ({ ...base('madake'), action: 'area', actionStarted: 1, actionDuration: move.duration, actionTime: t / move.duration });
  const idle = (): PlayerState => ({ ...base('madake'), action: 'idle', actionStarted: 1 + move.duration });
  it('draws the area action on to the take\'s end while he stands, and lets go at once when he does anything', () => {
    const hold = newCastHold();
    for (let t = 0; t < move.duration; t += 1 / 60) expect(castHold(hold, area(t), 1 / 60, 0, false).action).toBe('area');
    let t = move.duration, drawn: PlayerState = idle();
    while (t < take.seconds - .05) { drawn = castHold(hold, idle(), 1 / 60, 0, false); expect(drawn.action, `at ${t.toFixed(2)}`).toBe('area'); t += 1 / 60; }
    expect(drawn.actionDuration).toBe(take.seconds);
    expect(drawn.actionTime * take.seconds).toBeGreaterThan(take.seconds - .1);
    for (let i = 0; i < 6; i++) drawn = castHold(hold, idle(), 1 / 60, 0, false);
    expect(drawn.action).toBe('idle');
    // Moving off, or another action, ends it.
    const moved = newCastHold();
    castHold(moved, area(.6), 1 / 60, 0, false);
    expect(castHold(moved, idle(), 1 / 60, 0, false).action).toBe('area');
    expect(castHold(moved, idle(), 1 / 60, 2, false).action).toBe('idle');
    expect(castHold(moved, idle(), 1 / 60, 0, false).action).toBe('idle');
    const struck = newCastHold();
    castHold(struck, area(.6), 1 / 60, 0, false);
    expect(castHold(struck, { ...idle(), action: 'flinch' }, 1 / 60, 0, false).action).toBe('flinch');
    expect(castHold(struck, idle(), 1 / 60, 0, false).action).toBe('idle');
  });
  it('is never asked of a forged player\'s area move or of a fighter with no take', () => {
    const hold = newCastHold();
    castHold(hold, { ...base('taisei'), action: 'area', actionStarted: 1, actionDuration: .62, actionTime: .9 }, 1 / 60, 0, false);
    expect(castHold(hold, { ...base('taisei'), action: 'idle' }, 1 / 60, 0, false).action).toBe('idle');
  });
});

describe('Madake\'s Autumn Stag in the renderer', () => {
  let body: GLTF;
  beforeAll(async () => {
    const def = FIGHTERS['madake'];
    body = await loadRig(def.model);
    for (const url of def.extraModels ?? []) {
      const clips = bindClips(body.scene, (await loadRig(url)).animations, 'Madake'), names = new Set(clips.map(c => c.name));
      body.animations = [...body.animations.filter(c => !names.has(c.name)), ...clips];
    }
  }, 120_000);
  it('plays the take from the cast through the strikes, then hands back to the stance', () => {
    const take = AREA_CASTS['madake']!.base!, move = MOVES['madake'].area!;
    const f = new Fighter({ ...base('madake'), id: 'm' }, body);
    const seen: { t: number; clip?: string }[] = [];
    for (let t = -.3; t < take.seconds + .5; t += 1 / 60) {
      const state: PlayerState = t >= 0 && t < move.duration
        ? { ...base('madake'), id: 'm', action: 'area', actionStarted: 1, actionDuration: move.duration, actionTime: t / move.duration }
        : { ...base('madake'), id: 'm', action: 'idle', actionStarted: t < 0 ? 0 : 1 + move.duration };
      f.update(1 / 60, state, true);
      seen.push({ t, clip: f.displayedClipName });
    }
    const at = (t: number) => seen.reduce((a, b) => Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a).clip;
    expect(at(.3)).toBe(take.clip);
    // Past the move's end (0.62 s), through every strike: still the take.
    for (const s of strikeOffsets(move)) expect(at(move.contacts[0] + move.area!.telegraph + s + .02)).toBe(take.clip);
    expect(at(take.seconds + .3)).not.toBe(take.clip);
    f.dispose();
  });
});
