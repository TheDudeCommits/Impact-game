// The dude-world live build's install (npm run build:cartridge, after the build): dist-cartridge/ and the duel's run-time
// files into the site, at <site>/public/games/impact/ (the site: DUDE_WORLD_SITE, else ~/Claude Games/dude-world/site).
//   node scripts/build/cartridgeShip.mjs          copies the files the live duel uses (scripts/cartridge/live-files.txt) and no others
//   node scripts/build/cartridgeShip.mjs --link   (development) links the checkout's public/assets instead of copying
// Either way assets/audio/v2/files.json lists the sound files there: the sound bank asks for no other (audioFiles.ts).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

/** A WAV's length: [sample frames, sample rate], from its fmt and data chunks. */
function wavFrames(wav, name) {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${name} is not a WAV`);
  let rate = 0, align = 0;
  for (let at = 12; at + 8 <= wav.length;) {
    const id = wav.toString('ascii', at, at + 4), size = wav.readUInt32LE(at + 4);
    if (id === 'fmt ') { rate = wav.readUInt32LE(at + 12); align = wav.readUInt16LE(at + 20); }
    if (id === 'data') { if (!rate || !align) break; return [Math.floor(size / align), rate]; }
    at += 8 + size + (size & 1);
  }
  throw new Error(`${name}: no fmt/data chunk`);
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const site = process.env.DUDE_WORLD_SITE ?? path.join(os.homedir(), 'Claude Games/dude-world/site');
const out = path.join(site, 'public/games/impact');
const dist = path.join(root, 'dist-cartridge');
const link = process.argv.includes('--link');
if (!fs.existsSync(path.join(dist, 'live.js'))) throw new Error('build it first: npx vite build --config vite.cartridge.config.ts');
if (!fs.existsSync(path.join(site, 'src/core/live.ts'))) throw new Error(`no dude-world site at ${site}`);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.cpSync(dist, out, { recursive: true });

const sounds = [];
const AUDIO = /\.(wav|m4a|mp3|ogg)$/i;
if (link) {
  // Every top-level folder of public/assets linked in (audio/ and audio/v2/ as folders of links, for files.json).
  const assets = path.join(root, 'public/assets');
  const linkChildren = (from, to, skip = new Set()) => {
    fs.mkdirSync(to, { recursive: true });
    for (const name of fs.readdirSync(from)) if (!skip.has(name) && !fs.existsSync(path.join(to, name))) fs.symlinkSync(path.join(from, name), path.join(to, name));
  };
  linkChildren(assets, path.join(out, 'assets'), new Set(['audio']));
  linkChildren(path.join(assets, 'audio'), path.join(out, 'assets/audio'), new Set(['v2']));
  linkChildren(path.join(assets, 'audio/v2'), path.join(out, 'assets/audio/v2'));
  const walk = (dir, rel = '') => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const r = rel ? `${rel}/${e.name}` : e.name; if (e.isDirectory()) walk(path.join(dir, e.name), r); else if (AUDIO.test(e.name)) sounds.push(r); } };
  if (fs.existsSync(path.join(assets, 'audio/v2'))) walk(path.join(assets, 'audio/v2'));
} else {
  const list = fs.readFileSync(path.join(root, 'scripts/cartridge/live-files.txt'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  // The sound bank's WAVs go as the deploy's AAC copies (CombatAudio's packed bank: public/assets/audio/v2/packed.json names
  // each copy's WAV length, [frames, rate], and the bank trims the encoder's delay to it - aacTrim.ts), about an eighth of
  // their size. macOS's afconvert writes them (its AAC primes 2112 frames, as aacTrim.ts expects).
  const packed = {};
  let bytes = 0, wavBytes = 0, copies = 0;
  for (const file of list) {
    const from = path.join(root, 'public', file), to = path.join(out, file);
    if (!fs.existsSync(from)) throw new Error(`${file} is not in the checkout (git sparse-checkout add /public/${file})`);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const inBank = file.startsWith('assets/audio/v2/') && /\.wav$/i.test(file) && !link;
    if (inBank) {
      const wav = fs.readFileSync(from), m4a = to.replace(/\.wav$/i, '.m4a');
      packed[file.slice('assets/audio/v2/'.length)] = wavFrames(wav, file);
      execFileSync('afconvert', ['-f', 'm4af', '-d', 'aac', '-b', '96000', from, m4a]);
      bytes += fs.statSync(m4a).size; wavBytes += wav.length; copies++;
    } else { fs.copyFileSync(from, to); bytes += fs.statSync(from).size; }
    if (file.startsWith('assets/audio/v2/') && AUDIO.test(file)) sounds.push(file.slice('assets/audio/v2/'.length));
  }
  fs.mkdirSync(path.join(out, 'assets/audio/v2'), { recursive: true });
  fs.writeFileSync(path.join(out, 'assets/audio/v2/packed.json'), JSON.stringify({ files: packed }));
  console.log(`${list.length} run-time files, ${(bytes / 1e6).toFixed(1)} MB (${copies} of the sound bank's WAVs as AAC: ${(wavBytes / 1e6).toFixed(1)} MB of WAV)`);
}
fs.mkdirSync(path.join(out, 'assets/audio/v2'), { recursive: true });
fs.writeFileSync(path.join(out, 'assets/audio/v2/files.json'), JSON.stringify(sounds.sort()));
const size = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : e.isFile() ? fs.statSync(path.join(dir, e.name)).size : 0), 0);
console.log(`cartridge in ${out}: code ${(size(dist) / 1e6).toFixed(1)} MB${link ? ' (assets linked from the checkout)' : ''}`);

// The live build's checks (the world's rules, docs/LIVE.md): one three.js (the world's: none of its code bundled), no
// renderer or GL context of the game's own, every stylesheet a scoped string (no .css file nothing loads); and what the
// first load weighs - live.js and what the duel's chunk imports statically (the rest comes as it is asked for).
{
  const files = [];
  const walk = dir => { for (const e of fs.readdirSync(dir, { withFileTypes: true })) { const p = path.join(dir, e.name); if (e.isDirectory()) walk(p); else files.push(p); } };
  walk(dist);
  const fail = [], js = files.filter(f => f.endsWith('.js'));
  for (const f of files) if (f.endsWith('.css')) fail.push(`a stylesheet left as a file: ${path.relative(dist, f)}`);
  for (const f of js) {
    const t = fs.readFileSync(f, 'utf8');
    // (three's own chunk defines BRDF_Lambert; the toon look's shader edits only call it)
    if (/vec3 BRDF_Lambert\(|THREE\.WebGLRenderer:/.test(t)) fail.push(`${path.relative(dist, f)}: a copy of three.js`);
    if (/new [A-Za-z_$.]*WebGLRenderer\(/.test(t)) fail.push(`${path.relative(dist, f)}: makes a WebGLRenderer`);
    if (/getContext\(\s*["'`](webgl2?|experimental-webgl)/.test(t)) fail.push(`${path.relative(dist, f)}: asks for a GL context`);
  }
  const seen = new Set();
  const closure = f => { if (seen.has(f)) return; seen.add(f); const t = fs.readFileSync(f, 'utf8'); for (const m of t.matchAll(/\bfrom\s*["'](\.\.?\/[^"']+)["']|\bimport\s*["'](\.\.?\/[^"']+)["']/g)) closure(path.resolve(path.dirname(f), m[1] ?? m[2])); };
  closure(path.join(dist, 'live.js'));
  const game = js.find(f => /[\\/]livegame-[^\\/]+\.js$/.test(f));
  if (game) closure(game);
  const bytes = list => list.reduce((n, f) => n + fs.statSync(f).size, 0);
  console.log(`live: first load ${(bytes([...seen]) / 1e6).toFixed(2)} MB of JS in ${seen.size} files (of ${(bytes(js) / 1e6).toFixed(1)} MB in ${js.length}: the rest loads on demand)`);
  if (fail.length) { console.error(`live: FAIL\n  ${fail.join('\n  ')}`); process.exitCode = 1; }
  else console.log('live: ok - one three.js (the world\'s), no renderer or GL context of its own, every stylesheet a scoped string');
}
