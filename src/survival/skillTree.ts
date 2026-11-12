import { upgrade, UPGRADES } from './upgrades';

export type Branch = 'blade' | 'ki' | 'body';
export interface SkillNode {
  /** The upgrade a rank of it grants. */
  id: string;
  branch: Branch;
  /** 0-3: how deep in its branch (TIER_POINTS). */
  tier: 0 | 1 | 2 | 3;
  /** One line, a few words: what it does. */
  line: string;
  fork?: string;
  /** Which way this side of its fork goes (its path's name, and its kanji). */
  path?: string; pathKanji?: string;
  /** A key passive: a build has one, in whichever branch. */
  keystone?: boolean;
  /** A technique: it changes what one of the fighter's moves does (drawn as a diamond). */
  technique?: boolean;
  /** Shut until bought, once, for this many shards (progress.ts): what runs leave behind. */
  unlock?: number;
  /** A linked technique must be learned before this specialization. */
  requires?: string;
  /** Reuse the parent technique artwork without another texture. */
  art?: string;
}

export const BRANCHES: readonly { id: Branch; name: string; kanji: string; line: string }[] = [
  { id: 'blade', name: 'BLADE', kanji: '剣', line: 'Your own blows' },
  { id: 'ki', name: 'SPIRIT', kanji: '魂', line: 'Specials, ultimate, dash, awakening' },
  { id: 'body', name: 'BODY', kanji: '体', line: 'Survive and endure' },
];

/** Points spent in a branch before its tier opens, and each tier's name. */
export const TIER_POINTS = [0, 3, 7, 12] as const;
export const TIERS: readonly { name: string; kanji: string; numeral: string }[] = [
  { name: 'FOUNDATION', kanji: '基', numeral: '壱' },
  { name: 'TECHNIQUE', kanji: '技', numeral: '弐' },
  { name: 'MASTERY', kanji: '極', numeral: '参' },
  { name: 'SECRET ART', kanji: '奥義', numeral: '肆' },
];

export const SKILL_TREE: readonly SkillNode[] = [
  // ---- BLADE ----
  { id: 'iron-fist', branch: 'blade', tier: 0, line: '+15% damage' },
  { id: 'keen-eye', branch: 'blade', tier: 0, line: '+8% critical chance' },
  { id: 'focus', branch: 'blade', tier: 0, line: 'Moves recharge 10% faster' },
  { id: 'burning-blade', branch: 'blade', tier: 1, line: 'Your hits set foes alight', fork: 'blade-element', path: 'FLAME', pathKanji: '炎', technique: true },
  { id: 'thunder-chain', branch: 'blade', tier: 1, line: 'Hits arc lightning onward', fork: 'blade-element', path: 'THUNDER', pathKanji: '雷', technique: true },
  { id: 'executioner', branch: 'blade', tier: 1, line: '+60% damage to the dying' },
  { id: 'momentum', branch: 'blade', tier: 1, line: 'Long combos hit harder', unlock: 30 },
  { id: 'flying-slash', branch: 'blade', tier: 2, line: 'Long combos throw a crescent', fork: 'blade-reach', path: 'REACH', pathKanji: '飛', technique: true },
  { id: 'rending-cut', branch: 'blade', tier: 2, line: 'Heavies leave a cut that bursts', fork: 'blade-reach', path: 'WOUND', pathKanji: '裂', technique: true },
  { id: 'afterimage', branch: 'blade', tier: 2, line: 'Specials strike twice', fork: 'blade-echo', path: 'ECHO', pathKanji: '残', technique: true },
  { id: 'counter-art', branch: 'blade', tier: 2, line: 'A just guard blasts back', fork: 'blade-echo', path: 'RIPOSTE', pathKanji: '返', technique: true },
  { id: 'limit-break', branch: 'blade', tier: 3, line: '+30% damage, crits +50%', keystone: true },
  { id: 'god-speed', branch: 'blade', tier: 3, line: 'Faster, and moves recharge fast', keystone: true },
  { id: 'searing-edge', branch: 'blade', tier: 2, line: 'Burns deal 80% more damage', requires: 'burning-blade', art: 'burning-blade', fork: 'flame-shape', path: 'SEAR', technique: true },
  { id: 'cinder-cut', branch: 'blade', tier: 2, line: 'Heavy hits leave bursting wounds', requires: 'burning-blade', art: 'rending-cut', fork: 'flame-shape', path: 'CINDER', technique: true },
  { id: 'forked-current', branch: 'blade', tier: 2, line: 'Two more arcs, lighter bolts', requires: 'thunder-chain', art: 'thunder-chain', fork: 'thunder-shape', path: 'FORK', technique: true },
  { id: 'focused-current', branch: 'blade', tier: 2, line: 'Stronger, more reliable lightning', requires: 'thunder-chain', art: 'storm-ki', fork: 'thunder-shape', path: 'FOCUS', technique: true },
  // ---- KI ----
  { id: 'ki-surge', branch: 'ki', tier: 0, line: 'Specials and ultimates +12%' },
  { id: 'cinder-step', branch: 'ki', tier: 0, line: 'Your dash cuts through', technique: true },
  { id: 'burst-point', branch: 'ki', tier: 0, line: 'Special hits burst', technique: true },
  { id: 'blazing-ki', branch: 'ki', tier: 1, line: 'Specials set the ground alight', fork: 'ki-element', path: 'BLAZE', pathKanji: '炎', technique: true },
  { id: 'storm-ki', branch: 'ki', tier: 1, line: 'Specials call lightning down', fork: 'ki-element', path: 'STORM', pathKanji: '雷', technique: true },
  { id: 'ki-vortex', branch: 'ki', tier: 1, line: 'Specials drag the crowd in', technique: true },
  { id: 'overflow', branch: 'ki', tier: 1, line: 'Specials fill your ultimate', unlock: 40 },
  { id: 'ultimate-echo', branch: 'ki', tier: 2, line: 'Your ultimate strikes again', fork: 'ki-ultimate', path: 'ECHO', pathKanji: '響', technique: true },
  { id: 'ultimate-rush', branch: 'ki', tier: 2, line: 'A landed ultimate refills', fork: 'ki-ultimate', path: 'RUSH', pathKanji: '連', technique: true },
  { id: 'awakening-nova', branch: 'ki', tier: 2, line: 'Awakening bursts out of you', fork: 'ki-awaken', path: 'NOVA', pathKanji: '爆', technique: true },
  { id: 'ki-armor', branch: 'ki', tier: 2, line: 'Awakened, you endure', fork: 'ki-awaken', path: 'AEGIS', pathKanji: '鎧' },
  { id: 'shockwave', branch: 'ki', tier: 2, line: 'Every few hits, a shockwave', fork: 'ki-burst', path: 'QUAKE', pathKanji: '震', technique: true },
  { id: 'chain-reaction', branch: 'ki', tier: 2, line: 'The dead burst', fork: 'ki-burst', path: 'RUIN', pathKanji: '爆', technique: true },
  { id: 'limitless', branch: 'ki', tier: 3, line: 'Awakened, moves recharge ×3', keystone: true },
  { id: 'killing-intent', branch: 'ki', tier: 3, line: 'Kills recharge your moves', keystone: true },
  { id: 'phase-strike', branch: 'ki', tier: 2, line: 'Dash damage +70%, stamina −10%', requires: 'cinder-step', art: 'cinder-step', fork: 'dash-shape', path: 'STRIKE', technique: true },
  { id: 'slipstream', branch: 'ki', tier: 2, line: 'Trade dash damage for mobility', requires: 'cinder-step', art: 'god-speed', fork: 'dash-shape', path: 'FLOW', technique: true },
  // ---- BODY ----
  { id: 'tough-body', branch: 'body', tier: 0, line: '+200 maximum health' },
  { id: 'fleet-foot', branch: 'body', tier: 0, line: '+9% speed' },
  { id: 'second-breath', branch: 'body', tier: 0, line: 'Attacks cost less stamina' },
  { id: 'dread-of-the-dead', branch: 'body', tier: 1, line: 'Heal 3% of damage dealt', fork: 'body-way', path: 'BLOOD', pathKanji: '血' },
  { id: 'guardian', branch: 'body', tier: 1, line: 'Take 10% less damage', fork: 'body-way', path: 'IRON', pathKanji: '鉄' },
  { id: 'gravity', branch: 'body', tier: 1, line: 'Orbs come from further' },
  { id: 'training', branch: 'body', tier: 1, line: '+20% experience' },
  { id: 'second-wind', branch: 'body', tier: 1, line: 'Once a round, rise from 25%', unlock: 45 },
  { id: 'soul-harvest', branch: 'body', tier: 2, line: 'Kills heal you', fork: 'body-soul', path: 'REAPER', pathKanji: '魂' },
  { id: 'fighting-spirit', branch: 'body', tier: 2, line: 'Ultimate charges faster', fork: 'body-soul', path: 'SPIRIT', pathKanji: '闘' },
  { id: 'in-the-zone', branch: 'body', tier: 2, line: 'A longer awakening', fork: 'body-wake', path: 'AWAKEN', pathKanji: '覚' },
  { id: 'overdrive', branch: 'body', tier: 2, line: 'Start each fight with ultimate', fork: 'body-wake', path: 'OVERDRIVE', pathKanji: '限' },
  { id: 'iron-reprisal', branch: 'body', tier: 2, line: 'Just guards blast nearby enemies', requires: 'guardian', art: 'counter-art', fork: 'guard-shape', path: 'REPRISAL', technique: true },
  { id: 'anchored-soul', branch: 'body', tier: 2, line: 'Less damage, more stamina', requires: 'guardian', art: 'guardian', fork: 'guard-shape', path: 'ANCHOR' },
  { id: 'undying-will', branch: 'body', tier: 3, line: 'Rise again once when you fall', keystone: true },
  { id: 'grave-plate', branch: 'body', tier: 3, line: 'Rage below half health', keystone: true },
];

export const TREE_NODE = new Map(SKILL_TREE.map(node => [node.id, node]));

export const rankOf = (picks: readonly string[], id: string) => picks.reduce((n, pick) => n + (pick === id ? 1 : 0), 0);
export const maxRank = (id: string) => UPGRADES.find(def => def.id === id)?.max ?? 1;
export const branchPoints = (picks: readonly string[], branch: Branch) => picks.reduce((n, pick) => n + (TREE_NODE.get(pick)?.branch === branch ? 1 : 0), 0);
export const forkOf = (fork: string) => SKILL_TREE.filter(node => node.fork === fork);
/** The side of a node's fork already taken, if another is. */
export function takenInstead(picks: readonly string[], id: string): SkillNode | undefined {
  const node = TREE_NODE.get(id);
  if (!node?.fork) return undefined;
  return forkOf(node.fork).find(other => other.id !== id && rankOf(picks, other.id) > 0);
}
/** The key passive a build has, if it has one. */
export const keystoneOf = (picks: readonly string[]) => SKILL_TREE.find(node => node.keystone && rankOf(picks, node.id) > 0);

/** Why a node cannot take a point now, or undefined when it can. `unlocked`:
 *  the nodes bought with shards (a node with an `unlock` price is shut without). */
export function lockOf(picks: readonly string[], id: string, unlocked: readonly string[] = []): string | undefined {
  const node = TREE_NODE.get(id);
  if (!node) return 'not in the tree';
  if (node.unlock && !unlocked.includes(id)) return `unlock it with ${node.unlock} shards`;
  if (rankOf(picks, id) >= maxRank(id)) return 'mastered';
  const instead = takenInstead(picks, id);
  if (instead) return `the path of ${instead.path?.toLowerCase() ?? upgrade(instead.id).name} was chosen`;
  const key = node.keystone ? keystoneOf(picks) : undefined;
  if (key && key.id !== id) return `one key passive: ${upgrade(key.id).name}`;
  const need = TIER_POINTS[node.tier], spent = branchPoints(picks, node.branch);
  if (spent < need) return `${need - spent} more in ${BRANCHES.find(b => b.id === node.branch)!.name}`;
  if (node.requires && !rankOf(picks, node.requires)) return `learn ${upgrade(node.requires).name} first`;
  return undefined;
}
/** Shut while the other side of its fork or another key passive is owned. */
export function closed(picks: readonly string[], id: string): boolean {
  const node = TREE_NODE.get(id);
  if (!node) return true;
  if (takenInstead(picks, id)) return true;
  if (node.keystone) { const key = keystoneOf(picks); if (key && key.id !== id) return true; }
  return false;
}

/** What a bot (the autopilot, the headless balance runs) spends a point on:
 *  a third in each branch - whichever is furthest behind - and in each branch
 *  down a list. The lists walk one path through every fork (thunder with the
 *  blade, storm with the ki), so a bot's build is a build. Deterministic, so a
 *  seed plays the same. (Scored only by power, it never took health and died
 *  at rank D.) */
const BOT_SHARE: Record<Branch, number> = { ki: .36, blade: .34, body: .3 };
const BOT_ORDER: Record<Branch, readonly string[]> = {
  ki: ['ki-surge', 'burst-point', 'storm-ki', 'cinder-step', 'ki-vortex', 'shockwave', 'ultimate-echo', 'awakening-nova', 'limitless', 'blazing-ki', 'chain-reaction', 'ultimate-rush', 'ki-armor', 'killing-intent'],
  blade: ['iron-fist', 'thunder-chain', 'keen-eye', 'executioner', 'flying-slash', 'focus', 'afterimage', 'limit-break', 'burning-blade', 'rending-cut', 'counter-art', 'god-speed'],
  body: ['tough-body', 'guardian', 'second-breath', 'soul-harvest', 'fleet-foot', 'in-the-zone', 'undying-will', 'gravity', 'training', 'dread-of-the-dead', 'fighting-spirit', 'overdrive', 'grave-plate'],
};
export function botPick(picks: readonly string[]): string | undefined {
  const total = picks.filter(pick => TREE_NODE.has(pick)).length + 1;
  const branches = (Object.keys(BOT_SHARE) as Branch[]).sort((a, b) => (BOT_SHARE[b] * total - branchPoints(picks, b)) - (BOT_SHARE[a] * total - branchPoints(picks, a)));
  for (const branch of branches) {
    const id = BOT_ORDER[branch].find(each => !lockOf(picks, each));
    if (id) return id;
  }
  return SKILL_TREE.find(node => !lockOf(picks, node.id))?.id;
}

/** Check dependencies from the foundations upward. A high-tier node cannot
 * support its own gate when a lower rank is refunded. No mutable server state. */
export function validBuild(picks: readonly string[], unlocked: readonly string[] = []): boolean {
  const ordered = [...picks].sort((a, b) => (TREE_NODE.get(a)?.tier ?? 99) - (TREE_NODE.get(b)?.tier ?? 99));
  const checked: string[] = [];
  for (const id of ordered) { if (lockOf(checked, id, unlocked)) return false; checked.push(id); }
  return true;
}
export function refundLock(picks: readonly string[], id: string, unlocked: readonly string[] = []): string | undefined {
  const index = picks.lastIndexOf(id);
  if (index < 0) return 'No rank to refund';
  const next = [...picks]; next.splice(index, 1);
  return validBuild(next, unlocked) ? undefined : 'Refund dependent skills first';
}
export const skillArt = (id: string) => TREE_NODE.get(id)?.art ?? id;
