/** The credits page, /credits.html, opened from Options' CREDITS row (src/ui/legal.ts) in a new tab.
 *
 *  It is CREDITS.md at the repository's root (the third-party assets the game ships, with their authors, sources and
 *  licences), drawn as a page, followed by the npm packages in the client bundle with their own licence texts
 *  (vite.config.ts hands them over at build; the dev server lists package.json's). One record, so the page and the
 *  repository never disagree. */
import fs from 'node:fs';
import path from 'node:path';
import { CONTACT, FAN_MADE, PRIVACY_PAGE, REPO_PAGE, SITE_TITLE, TERMS_PAGE } from '../../src/ui/legalLinks';
import { UNOPENABLE_SOURCES } from '../../src/ui/legalCredits';

/** An npm package the client bundle carries. */
export interface Software { readonly name: string; readonly version: string; readonly license: string; readonly author?: string; readonly url?: string; readonly text?: string }

/** The npm package a module of the bundle comes from, read from its folder (none when it isn't one). */
function packageAt(dir: string): Software | undefined {
  let pkg: { name?: string; version?: string; license?: string | { type?: string }; licenses?: { type?: string }[]; author?: string | { name?: string }; homepage?: string; repository?: string | { url?: string } };
  try { pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')); } catch { return undefined; }
  if (!pkg.name || !pkg.version) return undefined;
  const license = typeof pkg.license === 'string' ? pkg.license : pkg.license?.type ?? pkg.licenses?.map(l => l.type).filter(Boolean).join(' OR ') ?? 'See its licence';
  const author = (typeof pkg.author === 'string' ? pkg.author : pkg.author?.name)?.replace(/\s*[<(].*$/, '').trim() || undefined;
  const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  const fromRepo = repo?.replace(/^git\+/, '').replace(/^git:\/\//, 'https://').replace(/^github:/, 'https://github.com/').replace(/\.git$/, '').replace(/^([\w-]+\/[\w.-]+)$/, 'https://github.com/$1');
  const url = [pkg.homepage, fromRepo].find(u => u && /^https?:\/\//.test(u)) ?? `https://www.npmjs.com/package/${pkg.name}`;
  const licenceFile = fs.readdirSync(dir).find(f => /^(licen[cs]e|copying|notice)([.-]|$)/i.test(f));
  const text = licenceFile ? fs.readFileSync(path.join(dir, licenceFile), 'utf8').trim() : undefined;
  return { name: pkg.name, version: pkg.version, license, author, url, text };
}
const byName = (a: Software, b: Software) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version);
/** The npm packages whose code the bundle carries, from the module ids of its chunks (vite.config.ts, at build). */
export function bundledPackages(moduleIds: Iterable<string>): Software[] {
  const dirs = new Set<string>();
  for (const id of moduleIds) {
    const match = /^(.*[\\/]node_modules[\\/](?:@[^\\/]+[\\/])?[^\\/]+)[\\/]/.exec(id.replace(/^\0/, '').split('?')[0]);
    if (match) dirs.add(match[1]);
  }
  const seen = new Map<string, Software>();
  for (const dir of dirs) { const pkg = packageAt(dir); if (pkg) seen.set(`${pkg.name}@${pkg.version}`, pkg); }
  return [...seen.values()].sort(byName);
}
/** The dev server's stand-in: the packages package.json names for the game (the build lists what it bundles). */
export function declaredPackages(root = process.cwd()): Software[] {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { dependencies?: Record<string, string> };
  return Object.keys(pkg.dependencies ?? {}).filter(name => name !== 'tsx').map(name => packageAt(path.join(root, 'node_modules', name))).filter((p): p is Software => !!p).sort(byName);
}


const esc = (text: string) => text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** A source a visitor cannot open (legalCredits.ts UNOPENABLE_SOURCES) is named, not linked. */
const link = (url: string | undefined, html: string) => url && !UNOPENABLE_SOURCES.has(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener">${html}</a>` : html;

/** CREDITS.md as the repository has it now (empty when there is none). */
export function readCredits(root = process.cwd()): string {
  const file = path.join(root, 'CREDITS.md');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
}

/** One line of Markdown's inline marks: links, bold, italics and code; everything else escaped. */
export function inline(text: string): string {
  const out: string[] = [];
  const re = /\[([^\]]+)\]\(([^\s)]+)\)|<(https?:\/\/[^>\s]+)>|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\b_([^_\s][^_]*)_\b|(https?:\/\/[^\s<>|]+[^\s<>|.,;:)])/g;
  let at = 0;
  for (const m of text.matchAll(re)) {
    out.push(esc(text.slice(at, m.index)));
    if (m[1] !== undefined) out.push(/^(https?:\/\/|mailto:|\/)/.test(m[2]) ? link(m[2], inline(m[1])) : inline(m[1]));
    else if (m[3] !== undefined) out.push(link(m[3], esc(m[3])));
    else if (m[8] !== undefined) out.push(link(m[8], esc(m[8])));
    else if (m[4] !== undefined) out.push(`<code>${esc(m[4])}</code>`);
    else if (m[5] !== undefined) out.push(`<b>${inline(m[5])}</b>`);
    else out.push(`<i>${inline((m[6] ?? m[7])!)}</i>`);
    at = m.index! + m[0].length;
  }
  out.push(esc(text.slice(at)));
  return out.join('');
}

/** The Markdown CREDITS.md is written in, as HTML: headings, paragraphs, lists, tables, quotes and rules. */
export function markdown(source: string): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n'), html: string[] = [];
  const cells = (row: string) => row.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
  for (let i = 0; i < lines.length;) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) { const level = Math.min(6, heading[1].length + 1); html.push(`<h${level}>${inline(heading[2])}</h${level}>`); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { html.push('<hr>'); i++; continue; }
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const head = cells(line); i += 2;
      const rows: string[][] = [];
      while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
      html.push(`<div class="table"><table><thead><tr>${head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const item = /^\s*(?:[-*+]|(\d+)[.)])\s+(.*)$/.exec(line);
    if (item) {
      const ordered = item[1] !== undefined, items: string[] = [];
      while (i < lines.length) {
        const next = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(lines[i]);
        if (next) { items.push(next[1]); i++; }
        else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) { items[items.length - 1] += ` ${lines[i].trim()}`; i++; }
        else break;
      }
      html.push(`<${ordered ? 'ol' : 'ul'}>${items.map(t => `<li>${inline(t)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) quote.push(lines[i++].replace(/^>\s?/, ''));
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      continue;
    }
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|\s*[-*+]\s|\s*\d+[.)]\s|\s*\||>)/.test(lines[i])) para.push(lines[i++].trim());
    if (!para.length) { html.push(`<p>${inline(lines[i++].trim())}</p>`); continue; }
    html.push(`<p>${inline(para.join(' '))}</p>`);
  }
  return html.join('\n');
}

function softwareSection(software: readonly Software[], number: string) {
  if (!software.length) return '';
  const rows = software.map(pkg => `<li class="pkg" ><div><b>${link(pkg.url, esc(pkg.name))}</b> <span class="ver">${esc(pkg.version)}</span>${pkg.author ? ` <span class="by">by ${esc(pkg.author)}</span>` : ''} <span class="lic">${esc(pkg.license)}</span></div>${pkg.text ? `<details><summary>Licence text</summary><pre>${esc(pkg.text)}</pre></details>` : ''}</li>`);
  return `<section id="software" data-section><h2><small>${number}</small>Software</h2><p class="lede">The open-source packages the game’s code is built with, each under its own licence.</p><ul class="pkgs">${rows.join('')}</ul></section>`;
}

const STYLE = `:root{color-scheme:light;--ink:#111;--paper:#fff;--red:#cc202b;--grey:#55534e;--rule:#11111124;font-family:Arial,Helvetica,sans-serif;color:var(--ink);background:var(--paper)}
*{box-sizing:border-box}[hidden]{display:none!important}
body{margin:0;border:8px solid var(--ink);min-height:100vh;background:radial-gradient(#11111112 .7px,transparent .9px) 0 0/5px 5px}
main{max-width:1180px;margin:auto;padding:40px 36px 72px}
a{color:inherit;text-decoration-thickness:1px;text-underline-offset:3px}a:hover{color:var(--red)}a:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid var(--red);outline-offset:3px}
.back{display:inline-block;font:12px 'Barlow Condensed',Impact,sans-serif;letter-spacing:.1em;margin-bottom:34px}
.eyebrow{font:11px 'Barlow Condensed',Impact,sans-serif;letter-spacing:.16em;color:var(--red);margin:0 0 10px}
h1{font:400 clamp(44px,9vw,84px)/.9 'Barlow Condensed',Impact,'Arial Narrow',sans-serif;margin:0 0 18px;letter-spacing:.01em}
.intro{font-size:18px;line-height:1.5;max-width:760px;margin:0 0 22px}
.short{border:3px solid var(--ink);box-shadow:6px 6px 0 var(--red);background:#fff;padding:16px 20px;margin:0 0 30px;max-width:860px}
.short p{margin:0 0 8px;font-size:14px;line-height:1.55}.short p:last-child{margin:0}
.toc{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 16px;padding:0;list-style:none}
.toc a{display:inline-block;font:12px 'Barlow Condensed',Impact,sans-serif;letter-spacing:.08em;text-decoration:none;border:2px solid var(--ink);padding:7px 10px;background:#fff}
.toc a small{color:var(--red);margin-left:6px;font-size:11px}.toc a:hover{background:var(--ink);color:#fff}
.find{position:sticky;top:0;z-index:2;background:#fff;border-bottom:2px solid var(--ink);padding:10px 0;display:flex;gap:12px;align-items:center}
.find input{flex:1;min-width:0;font:16px Arial,Helvetica,sans-serif;padding:10px 12px;border:2px solid var(--ink);border-radius:0;background:#fff;color:var(--ink)}
.find output{font-size:12px;color:var(--grey);white-space:nowrap}
h2{font:400 26px/1.1 'Barlow Condensed',Impact,sans-serif;letter-spacing:.03em;margin:46px 0 6px;padding-bottom:8px;border-bottom:3px solid var(--ink)}
h2 small{color:var(--red);margin-right:10px;font-size:15px}
.sub{font:400 15px 'Barlow Condensed',Impact,sans-serif;letter-spacing:.05em;margin:24px 0 10px}
.lede{font-size:14px;line-height:1.55;color:var(--grey);max-width:780px;margin:8px 0 16px}
.cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(310px,1fr));gap:14px;align-items:start}
.card{border:2px solid var(--ink);background:#fff;padding:14px 16px;min-width:0}
.card h3{font:400 18px/1.15 'Barlow Condensed',Impact,sans-serif;letter-spacing:.02em;margin:0 0 2px;overflow-wrap:anywhere}
.series{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--red);margin:0 0 8px}
.gnote{font-size:12.5px;color:var(--grey);margin:0 0 8px}
.card ul{list-style:none;margin:0;padding:0}
.card li{font-size:13.5px;line-height:1.45;padding:7px 0;border-top:1px solid var(--rule);overflow-wrap:anywhere}
.card li:first-child{border-top:0;padding-top:3px}
.role{display:block;font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--grey);margin-bottom:1px}
.lic{display:inline-block;font-size:11px;font-weight:700;border:1px solid var(--ink);padding:0 5px;text-decoration:none;white-space:nowrap;line-height:1.5}
a.lic:hover{background:var(--ink);color:#fff}
.changes,.note{display:block;font-size:12.5px;line-height:1.45;color:var(--grey);margin-top:2px}
details{margin:6px 0 0}summary{cursor:pointer;font-size:12.5px;color:var(--grey)}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:11.5px/1.5 ui-monospace,Menlo,Consolas,monospace;background:#f6f5f2;border:1px solid var(--rule);padding:10px 12px;max-height:300px;overflow:auto;margin:6px 0 0}
.pkgs{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:0 22px}
.pkg{padding:8px 0;border-top:1px solid var(--rule);font-size:13.5px;line-height:1.45;min-width:0;overflow-wrap:anywhere}
.ver,.by{color:var(--grey);font-size:12.5px}
footer{margin-top:52px;padding-top:16px;border-top:1px solid var(--rule);font-size:13px;line-height:1.6;color:var(--grey)}
@media(max-width:600px){body{border-width:5px}main{padding:24px 16px 56px}.intro{font-size:16px}.cards,.pkgs{grid-template-columns:1fr}.find{flex-wrap:wrap}.find output{width:100%}}
.md h2{margin-top:36px}.md h3{font:400 18px/1.15 'Barlow Condensed',Impact,sans-serif;margin:24px 0 8px}.md p,.md li{font-size:14px;line-height:1.55;max-width:860px}
.table{overflow-x:auto}.md table{border-collapse:collapse;font-size:13.5px;margin:8px 0 18px;min-width:520px}.md th,.md td{border:1px solid var(--rule);padding:6px 9px;text-align:left;vertical-align:top}.md th{background:#f6f5f2}
.md code{font:12.5px ui-monospace,Menlo,Consolas,monospace;background:#f6f5f2;padding:0 3px}blockquote{margin:12px 0;padding:4px 14px;border-left:3px solid var(--red);color:var(--grey)}`;

export interface CreditsBuild {
  /** The day it was built, as people write it ("11 October 2026"). */
  readonly date: string;
  /** The game's source commit it was built from. */
  readonly commit?: string;
  /** The npm packages to credit: the bundle's at build (`bundledPackages`), package.json's in the dev server. */
  readonly software: readonly Software[];
}

/** The page. */
export function creditsPage(build: CreditsBuild, credits = readCredits()): string {
  const parts: string[] = [];
  const body = credits.trim() ? markdown(credits.replace(/^#\s+.*\n+/, '')) : '<p>No third-party asset is listed yet.</p>';
  parts.push(`<section id="assets" class="md">${body}</section>`);
  if (build.software.length) parts.push(softwareSection(build.software, '02'));
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#cc202b">
<title>Credits — ${esc(SITE_TITLE)}</title>
<meta name="description" content="The artists, musicians, sound designers and programmers whose shared work the game is built with.">
<link rel="icon" href="favicon.svg" type="image/svg+xml">
<style>${STYLE}</style>
</head>
<body>
<main>
<a class="back" href="index.html">← BACK TO THE GAME</a>
<h1>CREDITS</h1>
<div class="short"><p>${esc(FAN_MADE)}</p><p>Creators: to correct or add a credit, email <a href="mailto:${CONTACT}">${CONTACT}</a>. Rights holders: to request the removal of any material, email the same address.</p></div>
${parts.join('\n')}
<footer>Updated ${esc(build.date)}${build.commit ? ` · build ${esc(build.commit.slice(0, 9))}` : ''} · <a href="${PRIVACY_PAGE}">Privacy</a> · <a href="${TERMS_PAGE}">Terms of use</a> · <a href="${REPO_PAGE}">Source code</a> · <a href="mailto:${CONTACT}">${CONTACT}</a> · <a href="index.html">Back to the game</a></footer>
</main>
</body>
</html>
`;
}
