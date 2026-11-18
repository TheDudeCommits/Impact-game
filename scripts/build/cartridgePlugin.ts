// The cartridge build's own pass over the game's code (vite.cartridge.config.ts): the game runs inside Amir's dude-world as a
// cartridge (src/cartridge), on the world's page, renderer and frame loop, and leaves nothing behind when it goes. Its code
// is the game's own, unchanged in the repository; as it is bundled for the world this pass points its calls on the page's
// globals at the cartridge runtime (src/cartridge/runtime.ts), which notes everything and takes it all back at the end:
//   requestAnimationFrame / cancelAnimationFrame           -> run from the world's frame (one loop)
//   setTimeout, setInterval, requestIdleCallback (+ clears) -> noted, cleared on unmount
//   x.addEventListener / removeEventListener (and bare)     -> noted when outside the game's own interface, removed on unmount
//   new MutationObserver / ResizeObserver / ...             -> disconnected on unmount
//   fetch, localStorage, sessionStorage                     -> the demo's files only (offline); the host's save/load
//   window.x = / Object.assign(window, ...) / defineProperty -> the game's window globals, deleted on unmount
//   document.body, document.documentElement                 -> the game's own page roots inside host.ui
//   location.reload(), history.replaceState/pushState       -> never the world's page
//   '/assets/...' in strings and templates                  -> the host's base (where the demo's files are served)
// and its stylesheets are scoped under [data-game="impact"] (html, body, :root and #app onto the runtime's roots) and
// handed to the runtime, which puts them in on mount and takes them out on unmount.
import path from 'node:path';
import type { Plugin } from 'vite';
import MagicString from 'magic-string';
import { parseAst } from 'rolldown/parseAst';

type Node = { type: string; start: number; end: number; [key: string]: unknown };

const SCOPE = '[data-game="impact"]';
const GLOBALS: Record<string, string> = {
  requestAnimationFrame: 'raf', cancelAnimationFrame: 'caf',
  setTimeout: 'setTimeout', clearTimeout: 'clearTimeout', setInterval: 'setInterval', clearInterval: 'clearInterval',
  requestIdleCallback: 'requestIdleCallback', cancelIdleCallback: 'cancelIdleCallback',
  fetch: 'fetch', localStorage: 'local', sessionStorage: 'session',
};
const WINDOWS = new Set(['window', 'globalThis', 'self']);
const OBSERVERS = new Set(['MutationObserver', 'ResizeObserver', 'IntersectionObserver', 'PerformanceObserver']);
/** '/assets/' at the start of a template (FIRST), or inside any part of one after a quote, a bracket, an equals sign or a
 *  space (markup and styles it writes: src="/assets/...", url('/assets/...')). */
const FIRST = /(^|["'(=\s])\/assets\//g, INSIDE = /(["'(=\s])\/assets\//g;

const isNode = (value: unknown): value is Node => !!value && typeof value === 'object' && typeof (value as Node).type === 'string';
function walk(node: Node, visit: (node: Node, parent: Node | null) => void, parent: Node | null = null) {
  visit(node, parent);
  for (const key of Object.keys(node)) {
    if (key === 'type' || key === 'start' || key === 'end') continue;
    const value = node[key];
    if (Array.isArray(value)) { for (const each of value) if (isNode(each)) walk(each, visit, node); }
    else if (isNode(value)) walk(value, visit, node);
  }
}
/** Every name the module binds anywhere (a declaration, a parameter, an import): those are its own, not the page's. */
function boundNames(ast: Node): Set<string> {
  const names = new Set<string>();
  const pattern = (p: unknown) => {
    if (!isNode(p)) return;
    if (p.type === 'Identifier') names.add(p.name as string);
    else if (p.type === 'ObjectPattern') for (const prop of p.properties as Node[]) pattern(prop.type === 'RestElement' ? prop.argument : prop.value);
    else if (p.type === 'ArrayPattern') for (const each of p.elements as Node[]) pattern(each);
    else if (p.type === 'AssignmentPattern') pattern(p.left);
    else if (p.type === 'RestElement') pattern(p.argument);
  };
  walk(ast, node => {
    if (node.type === 'VariableDeclarator') pattern(node.id);
    else if (node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression') { pattern(node.id); for (const p of node.params as Node[]) pattern(p); }
    else if (node.type === 'CatchClause') pattern(node.param);
    else if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') pattern(node.id);
    else if (node.type === 'ImportSpecifier' || node.type === 'ImportDefaultSpecifier' || node.type === 'ImportNamespaceSpecifier') pattern(node.local);
  });
  return names;
}
/** Whether an Identifier is read as a variable here (not a property's name, a key, a label or a binding). */
function referenced(node: Node, parent: Node | null): boolean {
  if (!parent) return true;
  switch (parent.type) {
    case 'MemberExpression': return parent.object === node || !!parent.computed;
    case 'Property': return parent.value === node || (!!parent.computed && parent.key === node);
    case 'MethodDefinition': case 'PropertyDefinition': case 'AccessorProperty': return !!parent.computed && parent.key === node;
    case 'LabeledStatement': case 'BreakStatement': case 'ContinueStatement': return false;
    case 'ImportSpecifier': case 'ImportDefaultSpecifier': case 'ImportNamespaceSpecifier': case 'ExportSpecifier': return false;
    case 'VariableDeclarator': return parent.init === node;
    case 'FunctionDeclaration': case 'FunctionExpression': case 'ArrowFunctionExpression': return parent.body === node;
    default: return true;
  }
}
const memberName = (node: Node): string | undefined => {
  if (node.type !== 'MemberExpression') return undefined;
  const p = node.property as Node;
  if (!node.computed && p.type === 'Identifier') return p.name as string;
  if (node.computed && p.type === 'Literal' && typeof p.value === 'string') return p.value;
  return undefined;
};
const isIdent = (node: unknown, names: Set<string> | string): boolean => isNode(node) && node.type === 'Identifier' && (typeof names === 'string' ? node.name === names : names.has(node.name as string));

/** The module's code with the page's globals pointed at the cartridge runtime, or null where it uses none. */
export function cartridgeCode(code: string, runtime: string, json = false): string | null {
  if (!/requestAnimationFrame|cancelAnimationFrame|setTimeout|setInterval|clearTimeout|clearInterval|IdleCallback|fetch|Storage|EventListener|Observer|window|globalThis|self\.|document\.|location|history|\/assets\//.test(code)) return null;
  let ast: Node;
  try { ast = parseAst(code) as unknown as Node; } catch { return null; }
  const s = new MagicString(code), own = boundNames(ast);
  let used = false;
  const put = (start: number, end: number, text: string) => { s.overwrite(start, end, text); used = true; };
  const done = new Set<Node>();
  walk(ast, (node, parent) => {
    if (done.has(node)) return;
    // '/assets/...' addresses: inside the host's base.
    if (node.type === 'Literal' && typeof node.value === 'string' && node.value.startsWith('/assets/')) {
      if (parent && (parent.type === 'ImportDeclaration' || parent.type === 'ExportNamedDeclaration' || parent.type === 'ExportAllDeclaration' || parent.type === 'ImportExpression')) return;
      const value = `(__rt.base+${JSON.stringify(node.value.slice(1))})`;
      if (parent?.type === 'Property' && parent.key === node && !parent.computed) put(node.start, node.end, `[${value}]`);
      else put(node.start, node.end, value);
      return;
    }
    if (node.type === 'TemplateLiteral' && parent?.type !== 'TaggedTemplateExpression') {
      // At the start (`/assets/${id}.webp`), or inside markup or a style it writes (src="/assets/...", url('/assets/...')).
      (node.quasis as Node[]).forEach((quasi, i) => {
        const raw = (quasi.value as { raw: string }).raw;
        for (const m of raw.matchAll(i === 0 ? FIRST : INSIDE)) { const at = quasi.start + m.index! + m[1].length; put(at, at + 1, '${__rt.base}'); }
      });
      return;
    }
    // A string that writes markup or a style with an '/assets/' address inside it.
    if (node.type === 'Literal' && typeof node.value === 'string' && /["'(=\s]\/assets\//.test(node.value) && !(parent?.type === 'Property' && parent.key === node)) {
      const parts = node.value.split(/(?<=["'(=\s])\/assets\//);
      put(node.start, node.end, `(${parts.map(part => JSON.stringify(part)).join('+__rt.base+"assets/"+')})`);
      return;
    }
    // x.addEventListener(...) / x.removeEventListener(...) -> __rt.on(x, ...) / __rt.off(x, ...)
    if (node.type === 'CallExpression') {
      const callee = node.callee as Node, args = node.arguments as Node[];
      const name = memberName(callee);
      // A JSON module's big values come as JSON.parse("..."): its '/assets/' strings (and keys) rebased as it is read.
      if (json && name === 'parse' && isIdent(callee.object, 'JSON')) { s.appendLeft(node.start, '__rt.json('); s.appendLeft(node.end, ')'); used = true; return; }
      if ((name === 'addEventListener' || name === 'removeEventListener') && args.length && (callee.object as Node).type !== 'Super') {
        let dot = code.lastIndexOf('.', (callee.property as Node).start);
        if (code[dot - 1] === '?') dot--; // (x?.addEventListener: the whole ?. goes)
        s.appendLeft(callee.start, `__rt.${name === 'addEventListener' ? 'on' : 'off'}(`);
        put(dot, args[0].start, ', ');
        used = true;
        return;
      }
      if (isIdent(callee, 'addEventListener') || isIdent(callee, 'removeEventListener')) {
        if (!own.has(callee.name as string) && args.length) { put(callee.start, args[0].start, `__rt.${callee.name === 'addEventListener' ? 'on' : 'off'}(window, `); done.add(callee); }
        return;
      }
      // location.reload() / history.replaceState() / pushState(): never the world's page.
      if (name === 'reload' && (isIdent(callee.object, 'location') || memberName(callee.object as Node) === 'location')) { put(callee.start, callee.end, '__rt.reload'); done.add(callee); return; }
      if ((name === 'replaceState' || name === 'pushState') && (isIdent(callee.object, 'history') || memberName(callee.object as Node) === 'history')) { put(callee.start, callee.end, `__rt.history.${name}`); done.add(callee); return; }
      // Object.assign(window, {...}) / Object.defineProperty(window, 'name', {...}): the game's globals.
      if (callee.type === 'MemberExpression' && isIdent(callee.object, 'Object') && args.length >= 2 && isIdent(args[0], WINDOWS)) {
        if (name === 'assign' && args.length === 2) { put(callee.start, args[1].start, '__rt.assignGlobals('); done.add(args[0]); return; }
        if (name === 'defineProperty' && args.length === 3) { put(callee.start, args[1].start, '__rt.defineGlobal('); done.add(args[0]); return; }
      }
      return;
    }
    // new MutationObserver(...) and the like: disconnected on unmount.
    if (node.type === 'NewExpression' && isIdent(node.callee, OBSERVERS) && !own.has((node.callee as Node).name as string)) {
      s.appendLeft(node.start, '__rt.keep('); s.appendLeft(node.end, ')'); used = true; return;
    }
    // window.x = value: the game's own global.
    if (node.type === 'AssignmentExpression' && node.operator === '=' && (node.left as Node).type === 'MemberExpression' && isIdent((node.left as Node).object, WINDOWS)) {
      const name = memberName(node.left as Node);
      if (name && !(name in GLOBALS) && name !== 'location' && name !== 'onerror' && !/^on[a-z]+$/.test(name)) {
        put(node.start, (node.right as Node).start, `__rt.global(${JSON.stringify(name)}, `); s.appendLeft(node.end, ')');
        done.add(node.left as Node); return;
      }
    }
    // window.requestAnimationFrame, globalThis.setTimeout, window.localStorage ...
    if (node.type === 'MemberExpression' && isIdent(node.object, WINDOWS)) {
      const name = memberName(node);
      if (name && name in GLOBALS) { put(node.start, node.end, `__rt.${GLOBALS[name]}`); done.add(node.object as Node); done.add(node.property as Node); }
      return;
    }
    // document.body / document.documentElement: the game's own roots (a comparison with the page's own is left alone).
    if (node.type === 'MemberExpression' && isIdent(node.object, 'document')) {
      const name = memberName(node);
      if ((name === 'body' || name === 'documentElement') && !(parent?.type === 'BinaryExpression' && /^[!=]==?$/.test(parent.operator as string))) {
        put(node.start, node.end, name === 'body' ? '__rt.body' : '__rt.html'); done.add(node.object as Node); done.add(node.property as Node);
      }
      return;
    }
    if (node.type === 'Identifier' && (node.name as string) in GLOBALS && !own.has(node.name as string) && referenced(node, parent)) {
      const to = `__rt.${GLOBALS[node.name as string]}`;
      if (parent?.type === 'Property' && parent.shorthand) put(node.start, node.end, `${node.name}: ${to}`);
      else put(node.start, node.end, to);
    }
  });
  if (!used) return null;
  s.prepend(`import { rt as __rt } from ${JSON.stringify(runtime)};\n`);
  return s.toString();
}

// ---- stylesheets ------------------------------------------------------------------------------------------------------

/** `text` split at `sep` where it is outside brackets, parentheses and quotes. */
function splitTop(text: string, sep: string): string[] {
  const out: string[] = []; let depth = 0, quote = '', from = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = ''; continue; }
    if (c === '"' || c === "'") quote = c;
    else if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === sep && depth === 0) { out.push(text.slice(from, i)); from = i + 1; }
  }
  out.push(text.slice(from));
  return out;
}
/** html, body, :root and #app as the runtime's roots: html and :root -> .ik-html, body -> .ik-body, #app -> #ik-app. */
const roots = (selector: string) => selector
  .replace(/:root(?![\w-])/g, '.ik-html')
  .replace(/#app(?![\w-])/g, '#ik-app')
  .replace(/(^|[\s>+~(,])(html|body)(?=$|[\s>+~),.:#[])/g, (_, before: string, tag: string) => `${before}.ik-${tag}`);
/** The subject of a selector (its last compound) is one of the roots, unqualified: the page's own box. */
const bareRoot = (selector: string) => /(^|[\s>+~])(\.ik-html|\.ik-body|#ik-app)$/.test(selector.trim());

export function scopeSelector(selector: string): string {
  return splitTop(selector, ',').map(each => { const one = each.trim(); return one ? `${SCOPE} ${roots(one)}` : one; }).join(',');
}

type CssNode = { type: string; selector?: string; name?: string; prop?: string; parent?: CssNode; nodes?: CssNode[]; remove(): void; walkRules?(cb: (rule: CssNode) => void): void };
/** A PostCSS plugin that scopes every rule of the game's stylesheets under [data-game="impact"]. The page's own boxes (the
 *  bare html, body, :root and #app) lose their background: the world's canvas is under them, where the game's own
 *  canvas used to be over them. */
export function scopeCss() {
  return {
    postcssPlugin: 'impact-cartridge-scope',
    Once(root: CssNode) {
      root.walkRules!(rule => {
        for (let p = rule.parent; p; p = p.parent) if (p.type === 'atrule' && /keyframes$/i.test(p.name ?? '')) return;
        const scoped = scopeSelector(rule.selector!);
        rule.selector = scoped;
        if (splitTop(scoped, ',').some(bareRoot)) for (const decl of [...(rule.nodes ?? [])]) if (decl.type === 'decl' && /^background(-color|-image)?$/.test(decl.prop ?? '')) decl.remove();
      });
    },
  };
}

// ---- the plugin -------------------------------------------------------------------------------------------------------

export default function cartridgePlugin(root: string): Plugin[] {
  const src = path.join(root, 'src') + path.sep, pub = path.join(root, 'public') + path.sep;
  const runtime = path.join(root, 'src/cartridge/runtime.ts');
  const ours = (id: string) => id.startsWith(path.join(root, 'src/cartridge') + path.sep);
  const game = (id: string) => (id.startsWith(src) && !ours(id)) || (id.startsWith(pub) && id.endsWith('.json'));
  const CSS = '\0impact-css:';
  const PRIVY = '\0impact-no-sign-in';
  return [{
    name: 'impact-cartridge-offline', enforce: 'pre',
    // Sign-in (ui/shop/privy.ts: Privy's React SDK and its wallets, megabytes of it) is never offered in the demo: the
    // module it loads on demand is a stub that says so, and none of that SDK is bundled.
    resolveId(source, importer) { return importer && /[\\/]src[\\/]ui[\\/]shop[\\/]signin\.ts$/.test(importer) && source === './privy' ? PRIVY : null; },
    load(id) { return id === PRIVY ? `export function mount() { return Promise.reject(new Error('Sign-in is off in this demo.')); }\n` : null; },
  }, {
    name: 'impact-cartridge-css', enforce: 'pre',
    // The game's `import './x.css'`: the scoped text, handed to the runtime (put in on mount, out on unmount). (And the
    // live build's own, src/cartridge/liveHud.ts: the game's stylesheets it puts together, scoped the same way.)
    async resolveId(source, importer) {
      if (!importer || !(game(importer.split('?', 1)[0]) || ours(importer.split('?', 1)[0])) || !/\.css$/.test(source)) return null;
      const resolved = await this.resolve(source, importer, { skipSelf: true });
      return resolved ? `${CSS}${resolved.id}.js` : null; // (not ending in .css: Vite's own CSS pass is for the ?inline text)
    },
    load(id) {
      if (!id.startsWith(CSS)) return null;
      const file = id.slice(CSS.length, -'.js'.length);
      return `import css from ${JSON.stringify(file + '?inline')};\nimport { rt } from ${JSON.stringify(runtime)};\nrt.addCss(css);\n`;
    },
  }, {
    name: 'impact-cartridge-code', enforce: 'post',
    transform(code, id) {
      const file = id.split('?', 1)[0];
      if (id.includes('?') || id.startsWith('\0') || !game(file) || !/\.(m?[jt]sx?|json)$/.test(file)) return null;
      const out = cartridgeCode(code, runtime, file.endsWith('.json'));
      return out === null ? null : { code: out, map: null };
    },
  }];
}
