import { beforeEach } from 'vitest';
import HELD_BACK from './heldBack.json';

/** Tests that read files or places held back from the public repository until they are replaced (README.md):
 *  skipped by name, file by file, while they are away. Take a test off the list when what it reads is back. */
const held = HELD_BACK as Record<string, string[]>;
beforeEach(context => {
  const file = context.task.file?.name?.replace(/\\/g, '/') ?? '';
  const names = Object.entries(held).find(([path]) => file.endsWith(path))?.[1];
  if (names?.includes(context.task.name)) context.skip();
});
