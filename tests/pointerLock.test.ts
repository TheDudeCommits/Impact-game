import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/** iPhone Safari has no Pointer Lock API: `document.exitPointerLock` is undefined there, so a bare call throws. Found on
 *  19 October 2026, the morning of the public announcement, in WebKit with Playwright's iPhone 15 (the pause menu opened
 *  half drawn), and by reading the code: `returnToLobby` stopped before it left the room or showed the lobby, which also
 *  broke the lone-queue switch to an on-device match, the results card's callback, the match intro and every social
 *  dialog. Every call is `document.exitPointerLock?.()` now, as SurvivalHud and RiftWarUI already wrote it. */
function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(file);
    return /\.(ts|js)$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [file] : [];
  });
}

describe('pointer lock on a browser without it (iPhone Safari)', () => {
  it('never calls document.exitPointerLock without the optional call', () => {
    const bare = sources('src').flatMap(file => fs.readFileSync(file, 'utf8').split('\n').flatMap((line, i) => /exitPointerLock\(\)/.test(line) ? [`${file}:${i + 1}`] : []));
    expect(bare).toEqual([]);
  });
});
