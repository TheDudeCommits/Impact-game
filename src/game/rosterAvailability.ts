import type { FighterId } from './types';

/** Gameplay availability is separate from ownership. The existing roster is the
 * released baseline; merely adding a model, move definition or shop item must
 * never promote a candidate to an ordinary game or random opponent pool. */
export const RELEASED_FIGHTERS = [
  'taisei', 'konta', 'gummy', 'kenzo', 'kosho', 'ouga', 'shirokane', 'shiden',
  'koko', 'nigo', 'kagari', 'ward', 'kuon', 'oro', 'gaunt', 'setsu',
  'gorai', 'haldor', 'sorrel', 'dorado', 'shiun', 'magatsu', 'vesper', 'imago',
  'wuming', 'jirenga', 'jinlin', 'gohaku', 'ippon', 'sekka', 'tobari', 'akagane',
  'asahi', 'levin', 'rook', 'gaku', 'strix', 'sorayomi', 'basilissa', 'kuzu', 'shakugo',
  'shanxiao', 'ampere', 'pyroclast', 'full-beam', 'tancho', 'bellows', 'akaito', 'mikage', 'tempo', 'shijima', 'senko', 'adad', 'buna', 'oyashio', 'suzuran', 'wataame', 'kusushi', 'sashigane', 'gosu', 'hakushi', 'barrow', 'unari', 'strappado', 'tokan', 'hikui', 'ume', 'lanthorn', 'highsun',
  'torsion', 'kubiwa', 'onigawara',
  'minase', 'shakudo', 'amagoi',
  'hinomoto', 'shidare', 'irbis',
  'shibuichi', 'rakucho', 'hisame',
  'mizuhiki', 'bonsho',
  'akayuri', 'madake', 'psyche',
  'rotfalke', 'kinu', 'hawser', 'murex',
  'hagure', 'ovid', 'yodaka',
  'tsubute', 'aqrab', 'chohan',
  'cardo', 'bruin', 'aquilo', 'svanhild',
] as const satisfies readonly FighterId[];
const released: ReadonlySet<string> = new Set(RELEASED_FIGHTERS);

/** Deliberate laboratory-only registrations. Promotion requires an independent
 * blind review receipt for the exact kit/assets, followed by owner release
 * approval. A candidate's presence here does not permit ordinary Training. */
const REVIEW_ROSTER = ['cardo','bruin','aquilo','svanhild','chohan','aqrab','tsubute','strix', 'sorayomi', 'basilissa', 'kuzu', 'shakugo', 'shanxiao', 'ampere', 'pyroclast', 'full-beam', 'bellows', 'tancho', 'mikage', 'tempo', 'akaito', 'shijima', 'oyashio', 'adad', 'senko', 'buna', 'suzuran', 'wataame', 'kusushi', 'hakushi', 'sashigane', 'gosu', 'barrow', 'unari', 'ume', 'hikui', 'strappado', 'tokan', 'lanthorn', 'highsun', 'torsion', 'kubiwa', 'onigawara', 'minase', 'shakudo', 'amagoi', 'hinomoto', 'shidare', 'irbis', 'rakucho', 'shibuichi', 'mizuhiki', 'hisame', 'hagure', 'akayuri', 'madake', 'kinu', 'murex', 'bonsho', 'rotfalke', 'hawser', 'ovid', 'psyche', 'yodaka'] as const satisfies readonly FighterId[];
export const LABORATORY_FIGHTERS = REVIEW_ROSTER.filter(id => !released.has(id));
export type LaboratoryFighterId = typeof LABORATORY_FIGHTERS[number];
const laboratory: ReadonlySet<string> = new Set(LABORATORY_FIGHTERS);
export function isReleasedFighter(value: unknown): value is FighterId {
  return typeof value === 'string' && released.has(value);
}
export function isLaboratoryFighter(value: unknown): value is LaboratoryFighterId {
  return typeof value === 'string' && laboratory.has(value);
}
export function requireReleasedFighter(value: unknown): asserts value is FighterId {
  if (!isReleasedFighter(value)) throw new Error('This fighter is not available.');
}
