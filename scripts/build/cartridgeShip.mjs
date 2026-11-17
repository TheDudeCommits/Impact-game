// The dude-world cartridge's install (npm run build:cartridge, after the build): dist-cartridge/ and the demo's run-time
// files into the site, at <site>/public/games/impact/ (the site: DUDE_WORLD_SITE, else ~/Claude Games/dude-world/site).
//   node scripts/build/cartridgeShip.mjs          copies the files the demo uses (scripts/cartridge/files.txt) and no others
//   node scripts/build/cartridgeShip.mjs --link   (development) links the checkout's public/assets instead of copying
// Either way assets/audio/v2/files.json lists the sound files there: the sound bank asks for no other (audioFiles.ts).
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const site = process.env.DUDE_WORLD_SITE ?? path.join(os.homedir(), 'Claude Games/dude-world/site');
const out = path.join(site, 'public/games/impact');
const dist = path.join(root, 'dist-cartridge');
const link = process.argv.includes('--link');
if (!fs.existsSync(path.join(dist, 'cartridge.js'))) throw new Error('build the cartridge first: npx vite build --config vite.cartridge.config.ts');
if (!fs.existsSync(path.join(site, 'src/core/cartridge.ts'))) throw new Error(`no dude-world site at ${site}`);

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
  const list = fs.readFileSync(path.join(root, 'scripts/cartridge/files.txt'), 'utf8').split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  let bytes = 0;
  for (const file of list) {
    const from = path.join(root, 'public', file), to = path.join(out, file);
    if (!fs.existsSync(from)) throw new Error(`${file} is not in the checkout (git sparse-checkout add /public/${file})`);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.copyFileSync(from, to);
    bytes += fs.statSync(from).size;
    if (file.startsWith('assets/audio/v2/') && AUDIO.test(file)) sounds.push(file.slice('assets/audio/v2/'.length));
  }
  console.log(`${list.length} run-time files, ${(bytes / 1e6).toFixed(1)} MB`);
}
fs.mkdirSync(path.join(out, 'assets/audio/v2'), { recursive: true });
fs.writeFileSync(path.join(out, 'assets/audio/v2/files.json'), JSON.stringify(sounds.sort()));
const size = dir => fs.readdirSync(dir, { withFileTypes: true }).reduce((n, e) => n + (e.isDirectory() ? size(path.join(dir, e.name)) : e.isFile() ? fs.statSync(path.join(dir, e.name)).size : 0), 0);
console.log(`cartridge in ${out}: code ${(size(dist) / 1e6).toFixed(1)} MB${link ? ' (assets linked from the checkout)' : ''}`);
