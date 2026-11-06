import fs from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';

/** Where the list is served: every sound file under public/assets/audio/v2/, by its path there. The sound bank
 *  (src/audio/CombatAudio.ts) asks for no cue whose file is not on it, so a checkout without some sounds (some are held
 *  back from the public repository: README.md) makes no request for them. */
export const AUDIO_FILES_URL = '/assets/audio/v2/files.json';

/** The sound files under `dir`, by their path relative to it (forward slashes). */
export function audioFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (at: string) => {
    if (!fs.existsSync(at)) return;
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(wav|m4a|mp3|ogg)$/i.test(entry.name)) out.push(path.relative(dir, full).split(path.sep).join('/'));
    }
  };
  walk(dir);
  return out.sort();
}

export default function audioFilesPlugin(): Plugin {
  let dir = '';
  return {
    name: 'impact-audio-files',
    configResolved(config) { dir = path.join(config.publicDir, 'assets/audio/v2'); },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== AUDIO_FILES_URL) return next();
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(JSON.stringify(audioFiles(dir)));
      });
    },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: AUDIO_FILES_URL.slice(1), source: JSON.stringify(audioFiles(dir)) });
    },
  };
}
