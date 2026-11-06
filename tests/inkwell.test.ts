import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CURRENCY, EARNED_LINE } from '../src/game/economy/currency';
import { cannotBuy, newAccount } from '../src/game/economy/account';
import { lockedOut } from '../src/game/economy/fighters';
import { plausible } from '../src/game/economy/earn';
import { goLabel } from '../src/ui/modes/lockedGo';


/** The words a store uses. (EARNED_LINE's own "cannot be bought" lives in currency.ts and is written into the panel as
 *  an expression, so it is never among the words read here.) */
const COMMERCE = /\b(shops?|stores?|buy|buys|buying|bought|purchas\w*|price[sd]?|pricing|sales?|sell|sells|selling|sold|pay|pays|paid|paying|payments?|wallets?|checkout|cash|money)\b/i;

/** The text of a source file's strings and templates - never its comments, its code or its regular expressions. A
 *  template's expressions are read for the strings inside them and stand as § in its own text. (A scanner of its own:
 *  the project's TypeScript is the native compiler, which has no parser to borrow.) */
function literals(code: string): string[] {
  const out: string[] = [];
  /** Reads code from `i` to the `}` that closes a template's expression (or the end), and answers where it stopped. */
  const scan = (i: number, inTemplate: boolean): number => {
    let depth = 0, last = '';
    while (i < code.length) {
      const c = code[i], next = code[i + 1];
      if (c === '/' && next === '/') { while (i < code.length && code[i] !== '\n') i++; continue; }
      if (c === '/' && next === '*') { i = code.indexOf('*/', i + 2) + 2; continue; }
      if (c === '/' && (!last || '(,=:[!&|?{};+-*%<>~^\n'.includes(last) || /\b(return|typeof|case|of|in)$/.test(code.slice(Math.max(0, i - 8), i).trimEnd()))) {
        // A regular expression: to its closing slash, a character class's slashes aside.
        let inClass = false; i++;
        for (; i < code.length; i++) { const r = code[i]; if (r === '\\') i++; else if (r === '[') inClass = true; else if (r === ']') inClass = false; else if (r === '/' && !inClass) break; else if (r === '\n') break; }
        i++; last = 'r'; continue;
      }
      if (c === "'" || c === '"') {
        let text = ''; i++;
        for (; i < code.length && code[i] !== c; i++) { if (code[i] === '\\') { i++; text += code[i] === 'n' ? '\n' : code[i]; } else text += code[i]; }
        out.push(text); i++; last = 's'; continue;
      }
      if (c === '`') {
        let text = ''; i++;
        while (i < code.length && code[i] !== '`') {
          if (code[i] === '\\') { text += code[i + 1]; i += 2; }
          else if (code[i] === '$' && code[i + 1] === '{') { text += '§'; i = scan(i + 2, true) + 1; }
          else text += code[i++];
        }
        out.push(text); i++; last = 's'; continue;
      }
      if (c === '{') depth++;
      else if (c === '}') { if (inTemplate && depth === 0) return i; depth--; }
      if (!/\s/.test(c)) last = c;
      i++;
    }
    return i;
  };
  scan(0, false);
  return out;
}

/** What a player can read in a source file: the text of its strings and templates, with the markup's own names taken
 *  out - tags and their class, id and data attributes, selectors, kebab-case names, the paths of its imports. What an
 *  attribute says aloud (aria-label, title) is kept. */
function readable(file: string): string[] {
  const out = literals(readFileSync(file, 'utf8')).filter(text => !/^\.{0,2}\/[\w./-]+$/.test(text));
  return out.map(text => {
    const spoken = [...text.matchAll(/(?:aria-label|title|placeholder)="([^"]*)"/g)].map(m => m[1]).join(' | ');
    const shown = text.replace(/<[^<>]*>/g, ' ').replace(/<[^<>]*$/, ' ').replace(/^[^<>]*>/, ' ');
    return `${shown} | ${spoken}`
      .replace(/\[[^\]]*\]/g, ' ')                         // [data-act=buy]
      .replace(/[#.]?[a-z0-9]+(?:-[a-z0-9§]+)+/g, ' ')      // shop-card, can-buy, jump-shop-goal
      .replace(/[#.][a-z]+\b/g, ' ');                       // #shop, .shop
  }).filter(text => /[a-z]/i.test(text));
}
/** Whole strings that are names in the code, not words on the screen. */
const NAMES = new Set(['shop', 'buy', 'shop hidden', 'price', 'pay', 'paid', 'sold', 'wallet']);
const offenders = (file: string) => readable(file).filter(text => !NAMES.has(text.replace(/\|/g, '').trim()) && COMMERCE.test(text)).map(text => `${file}: ${text.trim().slice(0, 120)}`);

/** Everything Account (the Inkwell until 25 October 2026) draws, and every place outside it that names it or shows a cost. */
const PANEL = ['src/ui/shop/Shop.ts', 'src/ui/shop/accountPanel.ts', 'src/ui/shop/payout.ts', 'src/ui/shop/boot.ts', 'src/ui/shop/goal.ts', 'src/ui/shop/signin.ts', 'src/ui/shop/art.ts',
  'src/ui/HomeFighterGuide.ts', 'src/ui/modes/lockedGo.ts'];

describe('Account', () => {
  it("holds the design's line to his words", () => {
    expect(EARNED_LINE).toBe('Sumi is earned by playing and cannot be bought.');
    expect(CURRENCY.name).toBe('Sumi');
  });

  it('is called ACCOUNT wherever a player reads its name: the home button, the panel; its two tabs are UNLOCKS and PROFILE', () => {
    const panel = readFileSync('src/ui/shop/Shop.ts', 'utf8'), boot = readFileSync('src/ui/shop/boot.ts', 'utf8');
    expect(boot).toMatch(/open\.textContent = 'ACCOUNT'/);
    expect(panel).toContain('<span>ACCOUNT</span>');
    expect(panel).toMatch(/const TABS: readonly \[Tab, string\]\[\] = \[\['unlocks', 'UNLOCKS'\], \['profile', 'PROFILE'\]\];/);
    expect(panel).toMatch(/aria-label', 'Account'\)/);
    for (const file of [...PANEL, 'src/engine/client/forgeAccount.ts', 'src/ui/social/PartyUI.ts']) expect(readable(file).filter(text => /\bSHOP\b|\bShop\b/.test(text)), file).toEqual([]);
  });

  it('says the line at the top of the panel, beside a cost in the detail, on the account page and in the fighter guide', () => {
    const panel = readFileSync('src/ui/shop/Shop.ts', 'utf8');
    // Under the heading, outside the tabs' body: on every tab.
    expect(panel).toMatch(/<\/header>\s*<p class="shop-earned" id="shop-earned">\$\{COIN\}<span>\$\{EARNED_LINE\}<\/span><\/p>\s*<div class="shop-body"/);
    // Beside the cost and the balance ("You have ..."), in the block that shows them.
    expect(panel).toMatch(/shop-how is-price.*You have.*<small class="shop-how-earned">\$\{EARNED_LINE\}<\/small>/);
    expect(panel).toMatch(/class="shop-balance" title="\$\{EARNED_LINE\}"/);
    expect(readFileSync('src/ui/shop/accountPanel.ts', 'utf8')).toMatch(/<b>\$\{EARNED_LINE\}<\/b>/);
    const guide = readFileSync('src/ui/HomeFighterGuide.ts', 'utf8');
    expect(guide).toMatch(/Account · \$\{priceOf\(item\)\.toLocaleString\('en-US'\)\} \$\{CURRENCY\.name\}/);
    expect(guide).toMatch(/<p class="guide-unlock">\$\{escape\(unlock\)\}\$\{item\?`<small class="guide-earned">\$\{escape\(EARNED_LINE\)\}<\/small>`:''\}<\/p>/);
    // Its row is in the panel's grid, and it is set in the plain face the sentences use.
    const css = readFileSync('src/ui/shop/shop.css', 'utf8');
    expect(css).toMatch(/\.shop\{[^}]*grid-template-rows:auto auto minmax\(0,1fr\) auto/);
    expect(css).toMatch(/\.shop-earned\{[^}]*background:var\(--s-ink\)/);
  });

  it('uses no word of a store in anything the panel, the payout, the home or the guide shows a player', () => {
    // (The reader reads: it finds the panel's words, and would find a store's.)
    expect(readable('src/ui/shop/Shop.ts').some(text => text.includes('PRESS AGAIN TO UNLOCK'))).toBe(true);
    expect(literals('const a = /["`]/g, b = `<b class="can-buy" data-act="buy">BUY · ${n ? `${n} left` : \'\'}</b>`; // pay').filter(text => COMMERCE.test(text.replace(/<[^<>]*>/g, ' ')))).toHaveLength(1);
    expect(PANEL.flatMap(offenders)).toEqual([]);
  });

  it('unlocks, and never buys: the button, its second press, and what the rules answer', () => {
    const panel = readFileSync('src/ui/shop/Shop.ts', 'utf8');
    expect(panel).toContain('PRESS AGAIN TO UNLOCK · ');
    expect(panel).toMatch(/`UNLOCK · \$\{COIN\}/);
    expect(panel).not.toMatch(/\bBUY\b/);
    const account = newAccount('inkwell1', 1);
    expect(cannotBuy(account, 'skin-gold-leaf', 0)).toBe('That one is not in Account yet.');
    expect(cannotBuy(account, 'fighter-dorado', 0)).toMatch(/^It costs [0-9,]+; you have 0\.$/);
    expect(lockedOut('dorado', account)).toMatch(/is locked: unlock them in Account to play here\./);
    expect(goLabel('duel', 'FIGHT', 'Gorai', true).note).toBe('IN ACCOUNT · OR TRY IN TRAINING');
    const short = plausible({ id: 'inkwell-r1', mode: 'duel', fighter: 'konta', seconds: 1, place: 1, players: 2, kos: 0, damage: 0 } as never, false);
    expect(short).toEqual({ refused: 'A match that short earns nothing.' });
  });

  it('has no way to buy Sumi: the server has no order or checkout route, and the page loads no payment code', () => {
    const api = readFileSync('src/server/economy/api.ts', 'utf8');
    expect([...api.matchAll(/route\('([a-z-]+)'/g)].map(m => m[1]).sort()).toEqual(['buy', 'delete', 'forge-get', 'forge-mine', 'forge-remove', 'forge-save', 'grant', 'hello', 'name', 'progress', 'redeem', 'report', 'signin', 'signout', 'wear']);
    // Nothing the game ships imports a payment or a chain library. (package.json lists three @solana packages: they are
    // optional peers of Privy's sign-in library, which signs players in and nothing else - its wallets are switched off.)
    const files = (dir: string): string[] => readdirSync(dir).flatMap(name => { const path = join(dir, name); return statSync(path).isDirectory() ? (name === 'vendor' ? [] : files(path)) : /\.(ts|tsx|mts)$/.test(name) ? [path] : []; });
    const paying = /from\s+['"](?:@?stripe|@paypal|@paddle|@lemonsqueezy|@coinbase|@moonpay|wagmi|viem|ethers|@solana|@solana-program)[\w./@-]*['"]/;
    expect(files('src').filter(file => paying.test(readFileSync(file, 'utf8')))).toEqual([]);
    expect(readFileSync('src/ui/shop/privy.ts', 'utf8')).toMatch(/embeddedWallets: \{ ethereum: \{ createOnLogin: 'off' \}, solana: \{ createOnLogin: 'off' \} \}/);
  });

  it('is named on the legal and privacy page as the place an account is deleted, with the line that Sumi cannot be bought', () => {
    const page = readFileSync('public/privacy.html', 'utf8');
    expect(page.match(/ACCOUNT → PROFILE → DELETE ACCOUNT/g)).toHaveLength(2);
    expect(page).not.toMatch(/\bSHOP\b/);
    expect(page).toContain(`Nothing is sold for money. ${EARNED_LINE}`);
  });
});
