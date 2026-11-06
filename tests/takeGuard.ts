import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FIGHTERS } from '../src/config';
import type { FighterId } from '../src/game/types';
import { IDLE_PROFILES } from '../src/render/idle/profile';
import { ORIGINALS } from '../src/originals/roster';

/** The feel pass's guard on a hand-posed take (scripts/fanim/lights.py, heavies.py): an animation-only file
 *  in a fighter's extraModels whose clips replace the clips of the same names. Presentation only: each take keeps the
 *  length of the clip it replaces, so every contact fraction (src/game/data/contactFrames.json) and every hit's timing is
 *  what it was.
 *
 *  And each take keys the joints above the hips wherever the body has a clip that turns them: the export leaves out a
 *  channel held at rest, and in the game a joint no playing clip keys keeps the last pose another clip gave it. Nigo's
 *  own clips turn his Biped root a hundred degrees where his rush file holds it at rest, so a `Rush 1` without the root
 *  channel stood him on his head after `Haizan Cut` (scripts/fanim/restore_still.py puts such channels back). */
export type Take = [FighterId, string, string[], posedFrom?: string[]];

interface Gltf {
  nodes: { name?: string; children?: number[]; rotation?: number[] }[];
  animations?: { name: string; samplers: { input: number; output: number }[]; channels: { sampler: number; target: { node?: number; path: string } }[] }[];
  accessors: { bufferView: number; byteOffset?: number; count: number; type: string; max?: number[] }[];
  bufferViews: { byteOffset?: number; byteStride?: number }[];
}
const files = new Map<string, { json: Gltf; bin: Buffer }>();
const read = (url: string) => {
  let file = files.get(url);
  if (!file) {
    const data = fs.readFileSync(`public${url}`), length = data.readUInt32LE(12);
    const json = JSON.parse(data.subarray(20, 20 + length).toString()) as Gltf, at = 20 + length;
    file = { json, bin: at < data.length ? data.subarray(at + 8, at + 8 + data.readUInt32LE(at)) : Buffer.alloc(0) };
    files.set(url, file);
  }
  return file;
};
const floats = ({ json, bin }: { json: Gltf; bin: Buffer }, index: number) => {
  const accessor = json.accessors[index], view = json.bufferViews[accessor.bufferView];
  const width = accessor.type === 'VEC4' ? 4 : accessor.type === 'VEC3' ? 3 : 1, stride = view.byteStride ?? 4 * width;
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0), out: number[][] = [];
  for (let i = 0; i < accessor.count; i++) out.push(Array.from({ length: width }, (_, j) => bin.readFloatLE(base + i * stride + j * 4)));
  return out;
};
/** Each clip of a file: its length, and the rotations it keys by joint name. */
const clipsOf = (url: string) => {
  const file = read(url), names = file.json.nodes.map(n => n.name ?? '');
  return new Map((file.json.animations ?? []).map(a => {
    const turns = new Map<string, number[][]>();
    for (const c of a.channels) if (c.target.node !== undefined && c.target.path === 'rotation') turns.set(names[c.target.node], floats(file, a.samplers[c.sampler].output));
    return [a.name, { seconds: Math.max(...a.samplers.map(s => file.json.accessors[s.input].max?.[0] ?? 0)), turns }] as const;
  }));
};
const apart = (a: number[], b: number[]) => 2 * Math.acos(Math.min(1, Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3])));
const url = (file: string) => `/assets/fighters/${file}`;

/** The guard, over each take: [fighter, file, the clips it replaces]. */
export function guardTakes(title: string, takes: readonly Take[]) {
  describe(title, () => {
    for (const [fighter, take, names] of takes) {
      it.skipIf(!!ORIGINALS[fighter])(`${fighter}: ${take} keeps each clip's length and keys the joints above the hips`, () => {
        const def = FIGHTERS[fighter], extras = def.extraModels ?? [];
        expect(extras, fighter).toContain(url(take));
        const before = extras.slice(0, extras.indexOf(url(take)));
        const posed = takes.find(row => row[0] === fighter && row[1] === take)?.[3] ?? [], rush = (file: string) => /-rush\d*\.glb$/.test(file);
        const replaced = new Map(clipsOf(def.model));
        for (const file of posed.filter(file => !rush(file))) for (const [name, clip] of clipsOf(url(file))) replaced.set(name, clip);
        for (const extra of before) for (const [name, clip] of clipsOf(extra)) replaced.set(name, clip);
        for (const file of [...def.rushModel ? [def.rushModel] : [], ...posed.filter(rush).map(url)]) for (const [name, clip] of clipsOf(file)) if (!replaced.has(name)) replaced.set(name, clip);
        // Every clip the body plays, for what each joint is ever turned to.
        const players = [def.model, ...extras, ...(def.rushModel ? [def.rushModel] : []), ...(IDLE_PROFILES[fighter]?.model ? [IDLE_PROFILES[fighter]!.model!] : [])];
        const turnsOf = new Map<string, number[][]>();
        for (const file of players) for (const clip of clipsOf(file).values()) for (const [joint, keys] of clip.turns) turnsOf.set(joint, [...(turnsOf.get(joint) ?? []), ...keys]);
        // The joints from the scene's root down to the hips.
        const body = read(def.model).json, parent = new Map<number, number>();
        body.nodes.forEach((node, i) => node.children?.forEach(child => parent.set(child, i)));
        let hips = body.nodes.findIndex(n => n.name === 'Hips');
        if (hips < 0) hips = body.nodes.findIndex(n => /pelvis|hips/i.test(n.name ?? ''));
        expect(hips, `${fighter}: no hips`).toBeGreaterThanOrEqual(0);
        const chain: string[] = [];
        for (let at: number | undefined = hips; at !== undefined; at = parent.get(at)) chain.push(body.nodes[at].name ?? '');
        const mine = clipsOf(url(take));
        for (const name of names) {
          const clip = mine.get(name), old = replaced.get(name);
          expect(clip, `${take}: ${name}`).toBeDefined();
          expect(old, `${fighter}: no ${name} before the take`).toBeDefined();
          expect(Math.abs(clip!.seconds - old!.seconds), `${name}'s length`).toBeLessThan(1 / 30 + 1e-3);
          for (const joint of chain) {
            const held = old!.turns.get(joint);
            if (!held || clip!.turns.has(joint)) continue;
            // Left out: only where nothing the body plays ever turns that joint from where the old clip held it.
            const turned = (turnsOf.get(joint) ?? []).some(q => held.some(h => apart(q, h) > .2 * Math.PI / 180));
            expect(turned, `${fighter} ${name}: ${joint} is turned by another clip but the take does not key it`).toBe(false);
          }
        }
      });
    }
  });
}

/** The guard over a take whose clips are new - no clip of the name before it, as the victories (scripts/fanim/
 *  victories.py) - [fighter, file, its clips, each clip's [shortest, longest] seconds]: each clip is the take's own,
 *  of a sane length, and keys every joint any clip the body plays turns away from its rest - a joint it left out would
 *  keep whatever pose the clip before it gave (scripts/fanim/restore_still.py holds those at rest). */
export function guardNewTakes(title: string, takes: readonly (readonly [FighterId, string, readonly [string, number, number][]])[]) {
  describe(title, () => {
    for (const [fighter, take, clips] of takes) {
      it.skipIf(!!ORIGINALS[fighter])(`${fighter}: ${take}'s clips are new, of their length, and key every joint another clip turns`, () => {
        const def = FIGHTERS[fighter], extras = def.extraModels ?? [];
        expect(extras, fighter).toContain(url(take));
        const before = [def.model, ...extras.slice(0, extras.indexOf(url(take))), ...(def.rushModel ? [def.rushModel] : [])];
        const players = [def.model, ...extras, ...(def.rushModel ? [def.rushModel] : []), ...(IDLE_PROFILES[fighter]?.model ? [IDLE_PROFILES[fighter]!.model!] : [])];
        // Where each joint rests: the body's own nodes.
        const body = read(def.model).json, rest = new Map(body.nodes.map(n => [n.name ?? '', n.rotation ?? [0, 0, 0, 1]] as const));
        const moved = new Set<string>();
        for (const file of players) for (const clip of clipsOf(file).values()) for (const [joint, keys] of clip.turns) {
          const at = rest.get(joint);
          if (at && keys.some(q => apart(q, at as number[]) > .2 * Math.PI / 180)) moved.add(joint);
        }
        const mine = clipsOf(url(take));
        for (const [name, shortest, longest] of clips) {
          for (const file of before) expect(clipsOf(file).has(name), `${fighter}: ${file} already has a ${name}`).toBe(false);
          const clip = mine.get(name);
          expect(clip, `${take}: ${name}`).toBeDefined();
          expect(clip!.seconds, `${name}'s length`).toBeGreaterThanOrEqual(shortest);
          expect(clip!.seconds, `${name}'s length`).toBeLessThanOrEqual(longest);
          const loose = [...moved].filter(joint => !clip!.turns.has(joint));
          expect(loose, `${fighter} ${name}: joints another clip turns that it leaves to whatever pose came before`).toEqual([]);
        }
      });
    }
  });
}

