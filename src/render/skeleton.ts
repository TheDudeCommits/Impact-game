import ALIASES from '../game/data/skeletonAliases.json';

/**
 * One skeleton for the roster, at runtime.
 *
 * The rigs do not agree on what to call a joint. Nine of the ten answer to the
 * Mixamo names, Taisei's rebuild called them `DEF_Pelvis` and `DEF_Thigh.L`, and
 * a Mixamo export calls them `mixamorig:LeftUpLeg_056`. The renderer used to
 * ask for spellings directly - `bones.get(fighter === 'taisei' ? 'defpelvis' :
 * 'hips')` - which silently returns undefined on a rig that spells it a third
 * way, and an undefined pelvis takes the foot planting and every procedural
 * layer down with it without raising anything.
 *
 * The same three passes scripts/skeleton_map.py runs, against the same table.
 */
const key = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

/** Decorations an exporter adds without changing which joint is meant.
 *
 *  Both spellings of the Mixamo prefix, and the colonless one matters more
 *  than it looks: three.js sanitises a node name before binding to it, so
 *  `mixamorig:Hips_01` in the file is `mixamorigHips_01` by the time the
 *  renderer sees it. Resolving against the file's spelling alone found all 22
 *  joints in a test reading the glTF and none at all in the running game.
 *  Longest first, so `mixamorig1:` is not eaten by `mixamorig`. */
const PREFIXES = ['mixamorig1:', 'mixamorig:', 'mixamorig1', 'mixamorig', 'armature|', 'bip01 ', 'bip001 '];

/** `mixamorig:LeftUpLeg_056` -> `leftupleg`. Only a separated numeric tail is
 *  dropped: a bare trailing digit belongs to the name, and eating it would
 *  collapse `Spine1` onto `Spine`. */
function loose(name: string) {
  let out = name.toLowerCase();
  for (const prefix of PREFIXES) if (out.startsWith(prefix)) { out = out.slice(prefix.length); break; }
  for (;;) {
    const match = out.match(/^(.*)[_.](\d+)$/);
    if (!match) break;
    out = match[1];
  }
  return key(out);
}

export type Canonical = keyof typeof ALIASES;

/**
 * Canonical bone name -> this rig's spelling of it, for those it has.
 *
 * Exact spellings claim their bone before any alias is tried, and the loose
 * pass refuses anything ambiguous: `DEF_Spine_001` and `DEF_Spine_002` both
 * strip to `def_spine`, and handing one of them to `Spine` on a coin flip is
 * a silently wrong pairing - an elbow where a shoulder goes - which is worse
 * than not resolving it at all.
 */
export function resolveSkeleton(names: Iterable<string>): Map<string, string> {
  const have = new Map<string, string>(), byLoose = new Map<string, string[]>();
  for (const name of names) {
    if (!have.has(key(name))) have.set(key(name), name);
    const l = loose(name);
    byLoose.set(l, [...(byLoose.get(l) ?? []), name]);
  }
  const found = new Map<string, string>(), taken = new Set<string>();
  const claim = (canonical: string, actual: string) => { found.set(canonical, actual); taken.add(actual); };
  const table = ALIASES as Record<string, string[]>;
  for (const canonical of Object.keys(table)) {
    const actual = have.get(key(canonical));
    if (actual !== undefined) claim(canonical, actual);
  }
  for (const [canonical, spellings] of Object.entries(table)) {
    if (found.has(canonical)) continue;
    for (const spelling of spellings) {
      const actual = have.get(key(spelling));
      if (actual !== undefined && !taken.has(actual)) { claim(canonical, actual); break; }
    }
  }
  for (const [canonical, spellings] of Object.entries(table)) {
    if (found.has(canonical)) continue;
    for (const spelling of [canonical, ...spellings]) {
      const options = (byLoose.get(loose(spelling)) ?? []).filter(n => !taken.has(n));
      if (options.length === 1) { claim(canonical, options[0]); break; }
    }
  }
  return found;
}
