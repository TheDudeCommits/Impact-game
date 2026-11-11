import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MODEL_LOOKS } from '../src/render/horde/modelLooks';
import { ENEMIES } from '../src/survival/enemies';
import { WITHHELD_GRUNT_FILES, OWN_GRUNT_MODELS, ownGruntModel } from '../src/originals/survival';
import { launchUnshipped } from '../src/originals/launchShip';
import { RIFT_TROOP_MODELS } from '../src/render/moba/troopAssets';
import { modeOpen } from '../src/originals/launch';

describe('the horde\'s bodies', () => {
  it('give those four bodies of their own, which the kinds that wore them wear too', () => {
    for (const [kind, url] of Object.entries(OWN_GRUNT_MODELS)) {
      expect(MODEL_LOOKS[kind], kind).toBe(url);
      expect(ownGruntModel(url)).toBe(true);
      expect(fs.existsSync(`public${url}`), url).toBe(true);
    }
    // All shipped, asked in one call: launchUnshipped rebuilds the whole package's list (about half a second), so fifteen calls of
    // one file each ran past the test's five seconds.
    expect(launchUnshipped(Object.values(OWN_GRUNT_MODELS).map(url => url.slice(1)))).toEqual([]);
    expect(MODEL_LOOKS['cutthroat-mender']).toBe(OWN_GRUNT_MODELS['cutthroat']);
    expect(MODEL_LOOKS['cutthroat-caller']).toBe(OWN_GRUNT_MODELS['cutthroat']);
    expect(MODEL_LOOKS['bat-wraith']).toBe(OWN_GRUNT_MODELS['ash-wraith']);
    expect(MODEL_LOOKS['wraith-caller']).toBe(OWN_GRUNT_MODELS['ash-caster']);
    expect(MODEL_LOOKS['iron-bulwark']).toBe(OWN_GRUNT_MODELS['iron-warden']);
    expect(MODEL_LOOKS['iron-chaplain']).toBe(OWN_GRUNT_MODELS['iron-warden']);
    // Eleven distinct bodies again, as before the four were stood in (and more since, each its own).
    const kept = ['graft-raider', 'graft-brute', 'husk', 'rift-spawn'].filter(kind => !OWN_GRUNT_MODELS[kind]);
    expect(new Set([...kept, ...Object.keys(OWN_GRUNT_MODELS)].map(kind => MODEL_LOOKS[kind])).size).toBe(kept.length + new Set(Object.values(OWN_GRUNT_MODELS)).size);
    expect(new Set(Object.values(MODEL_LOOKS)).size).toBeGreaterThanOrEqual(11);
  });
  it('wear none of the four that read as withheld', () => {
    const worn = new Set([...Object.values(MODEL_LOOKS), ...Object.values(ENEMIES).map(e => e.model)].filter(Boolean).map(url => url!.slice(1)));
    expect(WITHHELD_GRUNT_FILES.filter(file => worn.has(file))).toEqual([]);
  });
  it('dress the Tribunal as the Salt Court (modes-hordes): three bodies of its own, none of the earlier sailors', () => {
    const salt = (file: string) => `/assets/survival/motion/grunt-salt-${file}.glb`;
    expect(MODEL_LOOKS['tribunal-guard']).toBe(salt('guard'));
    expect(MODEL_LOOKS['tribunal-guard-shield']).toBe(salt('guard'));
    expect(MODEL_LOOKS['tribunal-guard-rifle']).toBe(salt('rifleman'));
    expect(MODEL_LOOKS['tribunal-guard-sniper']).toBe(salt('rifleman'));
    expect(MODEL_LOOKS.automaton).toBe(salt('engine'));
    const marines = ['/assets/survival/motion/grunt-tribunal-guard.glb', '/assets/survival/motion/grunt-tribunal-guard-rifle.glb'];
    expect(Object.entries(MODEL_LOOKS).filter(([, url]) => marines.includes(url!))).toEqual([]);
    for (const file of marines) expect(WITHHELD_GRUNT_FILES).toContain(file.slice(1));
  });
  it('are Tripo troops with the Rift troops\' seven animations', () => {
    for (const url of Object.values(OWN_GRUNT_MODELS)) {
      const b = fs.readFileSync(`public${url}`), n = b.readUInt32LE(12), json = JSON.parse(b.subarray(20, 20 + n).toString());
      const names = (json.animations ?? []).map((a: { name: string }) => a.name.toLowerCase().split(':').at(-1));
      expect(names.sort(), url).toEqual(['fall', 'hurt', 'idle', 'run', 'shoot', 'slash', 'walk']);
      expect(json.skins?.length, url).toBe(1);
      expect(b.length, url).toBeLessThan(3_000_000);
    }
  });
  it('dress the Graft Raiders as the Stitched Grafters: four bodies of their own, none of the earlier raiders', () => {
    const graft = (file: string) => `/assets/survival/motion/grunt-graft-${file}.glb`;
    expect(MODEL_LOOKS['graft-raider']).toBe(graft('raider'));
    expect(MODEL_LOOKS['graft-brute']).toBe(graft('brute'));
    expect(MODEL_LOOKS['graft-leaper']).toBe(graft('leaper'));
    expect(MODEL_LOOKS['graft-doctor']).toBe(graft('doctor'));
    const old = ['/assets/survival/motion/grunt-beast-pirate.glb', '/assets/survival/motion/grunt-beast-graft-brute.glb'];
    expect(Object.entries(MODEL_LOOKS).filter(([, url]) => old.includes(url!))).toEqual([]);
    expect(Object.values(ENEMIES).filter(e => old.includes(e.model)).map(e => e.id)).toEqual([]);
    for (const file of old) expect(WITHHELD_GRUNT_FILES).toContain(file.slice(1));
  });
  it('give the Last Sun the Sunburnt Legion (modes-hordes): four bodies of its own, no husk and no sailor\'s coat', () => {
    const sun = (file: string) => `/assets/survival/motion/grunt-sun-${file}.glb`;
    expect(MODEL_LOOKS['cinder-imp']).toBe(sun('imp'));
    expect(MODEL_LOOKS['cinder-imp-diver']).toBe(sun('imp'));
    expect(MODEL_LOOKS['brood-spawn']).toBe(sun('brood'));
    expect(MODEL_LOOKS['jinlin-soldier']).toBe(sun('trooper'));
    expect(MODEL_LOOKS['jinlin-sniper']).toBe(sun('sniper'));
    // The rest of the horde's husks stay husks.
    expect(MODEL_LOOKS.husk).toBe('/assets/survival/motion/grunt-husk.glb');
    expect(MODEL_LOOKS['pale-sapling']).toBe(MODEL_LOOKS.husk);
  });
  it('give Rift War\'s neutral camp a body again (modes-hordes): the Moss Revenant, a Tripo troop, shipped with the mode (open since rift-war)', () => {
    const url = RIFT_TROOP_MODELS['pale-sapling'];
    expect(url).toBe('/assets/moba/troops/moss-revenant.glb');
    expect(fs.existsSync(`public${url}`)).toBe(true);
    const b = fs.readFileSync(`public${url}`), json = JSON.parse(b.subarray(20, 20 + b.readUInt32LE(12)).toString());
    expect((json.animations ?? []).map((a: { name: string }) => a.name.toLowerCase().split(':').at(-1)).sort()).toEqual(['fall', 'hurt', 'idle', 'run', 'shoot', 'slash', 'walk']);
    expect(modeOpen('rift-war')).toBe(true);
    expect(launchUnshipped([url.slice(1)])).toEqual([]);
  });
  it('leave the retired bodies out of the package and keep the rest', () => {
    expect(launchUnshipped([...WITHHELD_GRUNT_FILES, 'assets/survival/motion/grunt-husk.glb', 'assets/survival/motion/prop-altar.glb'])).toEqual(WITHHELD_GRUNT_FILES);
  });
});
