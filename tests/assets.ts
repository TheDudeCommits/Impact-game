import fs from 'node:fs';

/** Whether an asset is in this checkout: a site path (`/assets/...`) or a repository path (`public/assets/...`). Some
 *  assets are held back from the public repository until they are replaced (README.md), so a test that reads one skips
 *  while it is absent. */
export const hasAsset = (file: string) => fs.existsSync(file.startsWith('public/') ? file : `public${file.startsWith('/') ? '' : '/'}${file}`);
