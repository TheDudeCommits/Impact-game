import type { FighterId } from '../game/types';
import { FIGHTERS } from '../config';

/** Homepage editorial curation, deliberately independent of gameplay factions.
 * The rival wing includes villains, antagonistic rivals and morally grey leads;
 * placement is a browsing aid, not a story or moral verdict. */
export type HomeRosterWing = 'heroes' | 'rivals';
export interface HomeRosterPage {
  left: FighterId[]; right: FighterId[];
  /** Membership order is left wing followed by right wing, not interleaved rows. */
  fighters: FighterId[];
}
export interface HomeAnimeOption { id: string; label: string; count: number }
export const HOME_PAGE_CAPACITY = 16;
export const HOME_PAGE_ROWS = 2;
export const HOME_ORIGINAL_FIGHTERS = [
  'taisei','konta','gummy','kenzo','kosho','ouga','shirokane','shiden',
  'koko','nigo','kagari','ward','kuon','oro','gaunt','setsu',
] as const satisfies readonly FighterId[];
/** Historical36 and the explicitly removable expansion WIP stamps never depend on sort position. */
export const HOME_BASELINE_FIGHTERS = [
  'taisei','konta','gummy','kenzo','kosho','ouga','shirokane',
  'shiden','koko','nigo','kagari','ward','kuon','oro',
  'gaunt','setsu','gorai','haldor','sorrel','dorado','shiun',
  'magatsu','vesper','imago','wuming','jirenga','jinlin','gohaku',
  'ippon','sekka','tobari','akagane','asahi','levin','rook',
  'gaku',
] as const satisfies readonly FighterId[];
export const HOME_EXPANSION_FIGHTERS = [
  'chohan',
  'aqrab',
  'tsubute',
  'kuzu','kubiwa','ampere','full-beam','pyroclast','tancho','bellows',
  'shakudo','shanxiao','amagoi','madake','minase','hakushi','ume',
  'suzuran','kusushi','strappado','barrow','strix','basilissa','tokan',
  'shakugo','sorayomi','psyche','tempo','sashigane','akaito','mikage',
  'onigawara','hinomoto','irbis','shidare','shijima','unari','bonsho',
  'mizuhiki','hawser','wataame','hikui','akayuri','hisame','rotfalke',
  'murex','kinu','gosu','rakucho','highsun','lanthorn',
  'buna','oyashio','adad','senko','shibuichi','torsion',
  'hagure','ovid','yodaka',
  'cardo','bruin','aquilo','svanhild',
] as const satisfies readonly FighterId[];
export const HOME_HERO_ORDER = [
  'taisei','gummy','konta','nigo','kuon','gohaku','kenzo',
  'shirokane','shijima','tempo','ippon','kosho','minase','mikage',
  'akaito','ampere','full-beam','pyroclast','tancho','asahi','yodaka','kagari',
  'sorrel','dorado','haldor','sorayomi','tsubute','psyche','oyashio','buna',
  'rook','kuzu','hakushi','madake','kusushi','ume','suzuran',
  'koko','gosu','kinu','levin','mizuhiki','hinomoto','sashigane',
  'gaku','bonsho','torsion','shakudo','shibuichi','lanthorn','highsun',
  'wataame','akayuri','rotfalke','murex','ovid',
  'cardo','aquilo','svanhild','bruin',
] as const satisfies readonly FighterId[];
export const HOME_RIVAL_ORDER = [
  'ouga','shiden','magatsu','chohan','jinlin','tobari','shiun','wuming',
  'akagane','irbis','shanxiao','amagoi','oro','jirenga','hagure','unari',
  'vesper','gorai','barrow','strappado','aqrab','ward','strix','basilissa',
  'shakugo','tokan','senko','adad','kubiwa','hawser','imago',
  'setsu','gaunt','hikui','onigawara','shidare','rakucho','hisame',
  'bellows','sekka',
] as const satisfies readonly FighterId[];

export const HOME_GRADUATED_FIGHTERS: readonly (typeof HOME_EXPANSION_FIGHTERS)[number][] = ['sashigane','kinu','akayuri','akaito','kuzu','hakushi','mizuhiki','shanxiao','kusushi','ume','kubiwa','amagoi','psyche','senko','shakugo','adad','onigawara','mikage','wataame','minase','full-beam','pyroclast','tancho','bellows','tempo','chohan','barrow','strix','aqrab','bonsho','hikui','shijima','suzuran','madake','sorayomi','rotfalke','highsun','lanthorn','shibuichi','unari','rakucho','hagure','ovid','murex','gosu','yodaka','tsubute','shidare','hawser','strappado','ampere','tokan','hisame','oyashio','buna','irbis','hinomoto','torsion'];

const wip: ReadonlySet<FighterId> = new Set(HOME_EXPANSION_FIGHTERS);
const rivals: ReadonlySet<FighterId> = new Set(HOME_RIVAL_ORDER);
const RESTAMPED: ReadonlySet<FighterId> = new Set();
/** One of the expansion's fighters, graduated or not. */
export function homeRosterWip(id: FighterId): boolean { return wip.has(id); }
export function homeWipStamp(id: FighterId, graduated: ReadonlySet<FighterId> = RESTAMPED): boolean { return wip.has(id) && !graduated.has(id); }
export function homeWing(id: FighterId): HomeRosterWing {
  // Editorial classification remains independent of gameplay factions.
  return rivals.has(id) ? 'rivals' : 'heroes';
}

const SERIES_ALIASES: Readonly<Record<string, string>> = {
  'Last Sun Super': 'Last Sun',
  'Salvage Wilds': 'Salvage Wilds',
  'Slag Hill Brotherhood': 'Slag Hill',
  'Slag Hill: Brotherhood': 'Slag Hill',
};
export function homeSeries(id: FighterId): string {
  const series = FIGHTERS[id].series;
  return SERIES_ALIASES[series] ?? series;
}
/** Editorial tie-break only; counts always take precedence. No popularity metric is claimed. */
const ANIME_FAMILIARITY = [
  'Last Sun','Hidden Ash','Dust Sea','Cinder Requiem','Hex Fallout','Beacon Ward',
  'Ropewalk','Black Snow','Salvage Wilds','Gilded Ruin',
  'Scrap Pact','Blast Radius','Slag Hill','Red Cradle',
  'Carcass Coast','Quiet Hunger','Gatefall','Grave Hound','Penance Road','Ghost Wake','Crimson Ledger','Lantern Ward',
];
const familiarity = new Map(ANIME_FAMILIARITY.map((name, index) => [name, index]));
/** Option id matches homeSeries(id), so filters require no separate slug mapping. */
export function homeAnimeOptions(roster: readonly FighterId[]): HomeAnimeOption[] {
  const counts = new Map<string, number>();
  for (const id of new Set(roster)) {
    const series = homeSeries(id);
    counts.set(series, (counts.get(series) ?? 0) + 1);
  }
  return [...counts].sort(([a, ac], [b, bc]) => bc - ac
    || (familiarity.get(a) ?? Infinity) - (familiarity.get(b) ?? Infinity)
    || a.localeCompare(b)).map(([id, count]) => ({ id, count, label: `${id} (${count})` }));
}

/** Retain editorial order for any filtered subset; future explicit lab entries
 * fall back to caller order, never silently promote an absent fighter. */
function orderedWing(roster: readonly FighterId[], wing: HomeRosterWing): FighterId[] {
  const supplied = new Set(roster), order = wing === 'heroes' ? HOME_HERO_ORDER : HOME_RIVAL_ORDER;
  const result: FighterId[] = order.filter(id => supplied.has(id));
  const included = new Set(result);
  for (const id of supplied) if (!included.has(id) && homeWing(id) === wing) {
    result.push(id); included.add(id);
  }
  return result;
}
/** Put heroes sharing the right wing in its innermost columns. On the left,
 * any overflow rivals occupy the outside edge. Keep each group's own order. */
function arrangeWing(ids: FighterId[], right: boolean): FighterId[] {
  const inner = ids.filter(id => homeWing(id) === 'heroes');
  const outer = ids.filter(id => homeWing(id) === 'rivals');
  if (!inner.length || !outer.length) return ids;
  const result: FighterId[] = Array(ids.length);
  const columns = Array.from({ length: ids.length }, (_, i) => i)
    .sort((a,b) => a % 4 - b % 4 || a - b);
  const first = right ? inner : outer, rest = right ? outer : inner;
  first.forEach((id,i) => { result[columns[i]] = id; });
  let next = 0;
  for (let i = 0; i < result.length; i++) if (!result[i]) result[i] = rest[next++];
  return result;
}

/** Two equal four-column wings. The original sixteen are a fixed first volume
 * in the full roster; filtered results are independently repaginated. */
export function homeRosterPages(roster: readonly FighterId[]): HomeRosterPage[] {
  const pages: HomeRosterPage[] = [];
  const supplied = new Set(roster);
  const add = (pool: readonly FighterId[]) => {
    const heroes = orderedWing(pool, 'heroes'), opponents = orderedWing(pool, 'rivals');
    while (heroes.length || opponents.length) {
      const count = Math.min(HOME_PAGE_CAPACITY, heroes.length + opponents.length);
      const leftCount = Math.ceil(count / 2), rightCount = count - leftCount;
      const left = heroes.splice(0, leftCount);
      const right = opponents.splice(0, rightCount);
      if (left.length < leftCount) left.push(...opponents.splice(0, leftCount - left.length));
      if (right.length < rightCount) right.unshift(...heroes.splice(0, rightCount - right.length));
      const leftWing = arrangeWing(left, false), rightWing = arrangeWing(right, true);
      pages.push({ left: leftWing, right: rightWing, fighters: [...leftWing, ...rightWing] });
    }
  };
  if (HOME_ORIGINAL_FIGHTERS.every(id => supplied.has(id))) {
    add(HOME_ORIGINAL_FIGHTERS);
    HOME_ORIGINAL_FIGHTERS.forEach(id => supplied.delete(id));
  }
  add([...supplied]);
  return pages;
}
