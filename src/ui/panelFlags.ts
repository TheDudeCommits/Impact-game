/** Zone 5 of the mode HUD's layer, and its card in an objective's HUD (the music caption moves aside for it). */
const ZONE5 = '.mode-hud>[data-zone="5"]';
const ZONE5_CARD = `#interface:is([data-hud="last-stand"],[data-hud="bad-blood"],[data-hud="rift-war"]) ${ZONE5}:not(:empty)`;
export const PANEL_FLAGS: ReadonlyArray<readonly [flag: string, selector: string]> = [
  ['pf-sv', '.sv-hud:not(.hidden)'],
  ['pf-atlas', '.ascension:not(.hidden)'],
  ['pf-home', '.manga-home:not(.hidden)'],
  ['pf-settings', '.settings-scrim:not(.hidden)'],
  ['pf-behind', '.settings-scrim.gm-behind'],
  ['pf-rift-sheet', '.rift-battle-map[open], .rift-forge[open]'],
  ['pf-sv-modal', '.sv-hud.modal'],
  ['pf-objective', '.objective-scrim:not(.hidden)'],
  ['pf-lab', '.training-lab[open]'],
  // The end-of-match card (src/ui/results/resultsFrame.css): a holder that is shown and carries its frame.
  ['pf-results', '#results:not(.hidden)>.results-frame, .objective-scrim:not(.hidden)>.results-frame, #sv-results.ux-framed:not(.hidden)'],
  ['pf-sv-results', '#sv-results.ux-framed:not(.hidden)'],
  // The music caption (manga.css, trainingHud.css): aside while an objective's HUD has a card in zone 5; none in Training.
  ['pf-mc-aside', ZONE5_CARD],
  ['pf-mc-training', '#interface[data-hud="training"]'],
];
/** An element whose `class` or `open` changing can move a flag: the panels themselves (and, coming or going, #interface
 *  and the mode HUD's layer, which hold what the music caption's flags ask about). */
const PANELS = '.sv-hud, .ascension, .manga-home, .settings-scrim, .rift-battle-map, .rift-forge, .objective-scrim, .training-lab, #results, #sv-results, #interface, .mode-hud';
/** The holders a results frame is put into and taken out of: their children changing can move `pf-results`. */
const FRAME_HOLDERS = '#results, .objective-scrim';

/** The flags that are up, given how to look a selector up. */
export function panelFlagsUp(has: (selector: string) => boolean) { return PANEL_FLAGS.filter(([, selector]) => has(selector)).map(([flag]) => flag); }

/** What the observer below asks of a node, and of a change it is told of (the browser's own, or a test's stand-ins). */
type Asked = { matches(selector: string): boolean; querySelector(selector: string): unknown; firstElementChild: unknown };
type Change = { type: string; target: unknown; attributeName?: string | null; oldValue?: string | null; addedNodes: Iterable<unknown>; removedNodes: Iterable<unknown> };
const isElement = (node: unknown): node is Asked & { getAttribute(name: string): string | null } => !!node && typeof (node as Asked).matches === 'function';

/** Whether a node put into the page, or taken out of it, is one of the panels or holds one. A node with nothing under
 *  it can only be one, and most of what a fight adds is such a leaf (a damage number, a meter's bubble, a toast's line):
 *  each used to be searched for all ten panels (`querySelector`: 0.3% of the main thread in a royale, 1.4% in Training,
 *  ~/Projects/jump-wt/scratch/night/reports/perf2.md). */
export function carriesPanel(node: Asked) { return node.matches(PANELS) || (node.firstElementChild !== null && node.querySelector(PANELS) !== null); }

/** Whether an attribute the observer was told of holds a different value now than before the write. Writing a class
 *  that is already there (`classList.add('hidden')` on a hidden panel) is reported like any other write, and the HUD did
 *  exactly that to the results holder on every tick of a match: fourteen times a second every flag's selector was
 *  asked of the whole page, for nothing (perf3.md). */
export function attributeChanged(record: { target: unknown; attributeName?: string | null; oldValue?: string | null }) {
  return !isElement(record.target) || !record.attributeName || record.target.getAttribute(record.attributeName) !== (record.oldValue ?? null);
}

/** Whether a change can move a flag: a panel's `class` or `open` really changed; or a results holder's children did; or
 *  a panel came into the page already shown, or left it while it was up (that changes no attribute: a mode that builds
 *  its panel on the way in, the operations' scrim, the rift's sheets, or drops it on the way out). */
export function movesFlag(record: Change) {
  // A text changed: only one directly in zone 5 can change whether it is :empty.
  if (record.type === 'characterData') { const parent = (record.target as { parentNode?: unknown } | null)?.parentNode; return isElement(parent) && parent.matches(ZONE5); }
  if (!isElement(record.target)) return false;
  if (record.type !== 'childList') return (record.attributeName === 'data-hud' || record.target.matches(PANELS)) && attributeChanged(record);
  if (record.target.matches(FRAME_HOLDERS) || record.target.matches(ZONE5)) return true;
  for (const node of record.addedNodes) if (isElement(node) && carriesPanel(node)) return true;
  for (const node of record.removedNodes) if (isElement(node) && carriesPanel(node)) return true;
  return false;
}

let installed: MutationObserver | undefined;
/** Starts keeping the flags (once), and sets them now. */
export function installPanelFlags(root: ParentNode = document, body: HTMLElement = document.body) {
  if (installed) return;
  const sync = () => { const up = new Set(panelFlagsUp(selector => !!root.querySelector(selector))); for (const [flag] of PANEL_FLAGS) if (body.classList.contains(flag) !== up.has(flag)) body.classList.toggle(flag, up.has(flag)); };
  sync();
  installed = new MutationObserver(records => { for (const record of records) if (movesFlag(record)) { sync(); return; } });
  installed.observe(body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['class', 'open', 'data-hud'], attributeOldValue: true });
}
