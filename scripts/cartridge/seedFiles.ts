// The dude-world demo's files, as far as the roster's own tables name them (the rest is what the slice asks for as it
// runs: scripts/cartridge/files.txt). Prints repository paths under public/assets/, one a line.
//   npx tsx scripts/cartridge/seedFiles.ts <tree.txt: `git ls-tree -r --name-only HEAD`>
import fs from 'node:fs';
import { ORIGINALS } from '../../src/originals/roster.ts';
import { cueFighter } from '../../src/originals/launch.ts';
import VOICES from '../../src/originals/voices.json' with { type: 'json' };

const FIGHTERS = ['taisei', 'kenzo', 'kuon', 'shiden', 'setsu'];
const tree = fs.readFileSync(process.argv[2], 'utf8').split('\n').filter(Boolean);
const out = new Set<string>();
const add = (url?: string) => { if (url) out.add(`public${url.split('?')[0]}`); };
for (const id of FIGHTERS) {
  const f = ORIGINALS[id as keyof typeof ORIGINALS]!;
  for (const url of [f.model, f.rushModel, ...(f.extraModels ?? []), f.formModel, ...(f.formExtraModels ?? []), f.idleModel, f.portrait]) add(url);
  for (const [cue, line] of Object.entries((VOICES as { cues: Record<string, { file: string }> }).cues)) if (cueFighter(cue) === id) add(`/assets/audio/v2/${line.file}`);
  const home = (VOICES as { home: Record<string, { file: string }> }).home[id]; if (home) add(home.file);
  const own = new RegExp(`^public/assets/(audio/home|fighters/takes|home/fighters|home/portraits|home/sprites|hud/busts|ui/moves)/${id}[-._]`);
  const sig = `public/assets/audio/v2/cc0/signatures/${id}/`;
  for (const path of tree) if (own.test(path) || path.startsWith(sig)) out.add(path);
}
const missing = [...out].filter(path => !tree.includes(path));
if (missing.length) console.error('not in the repository:', missing.join(' '));
console.log([...out].filter(path => tree.includes(path)).sort().join('\n'));
