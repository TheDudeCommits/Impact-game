import { CHOHAN_COMBOS } from './fighters/chohan';
import { AQRAB_COMBOS } from './fighters/aqrab';
import { TSUBUTE_COMBOS } from './fighters/tsubute';
import { PSYCHE_COMBOS } from './fighters/psyche';
import { YODAKA_COMBOS } from './fighters/yodaka';
import { OVID_COMBOS } from './fighters/ovid';
import { HAWSER_COMBOS } from './fighters/hawser';
import { ROTFALKE_COMBOS } from './fighters/rotfalke';
import { BONSHO_COMBOS } from './fighters/bonsho';
import { MUREX_COMBOS } from './fighters/murex';
import { KINU_COMBOS } from './fighters/kinu';
import { MADAKE_COMBOS } from './fighters/madake';
import { AKAYURI_COMBOS } from './fighters/akayuri';
import { HAGURE_COMBOS } from './fighters/hagure';
import { HISAME_COMBOS } from './fighters/hisame';
import { MIZUHIKI_COMBOS } from './fighters/mizuhiki';
import { SHIBUICHI_COMBOS } from './fighters/shibuichi';
import { RAKUCHO_COMBOS } from './fighters/rakucho';
import { IRBIS_COMBOS } from './fighters/irbis';
import { SHIDARE_COMBOS } from './fighters/shidare';
import { HINOMOTO_COMBOS } from './fighters/hinomoto';
import { AMAGOI_COMBOS } from './fighters/amagoi';
import { SHAKUDO_COMBOS } from './fighters/shakudo';
import { MINASE_COMBOS } from './fighters/minase';
import { ONIGAWARA_COMBOS } from './fighters/onigawara';
import { CARDO_COMBOS } from './fighters/cardo';
import { BRUIN_COMBOS } from './fighters/bruin';
import { AQUILO_COMBOS } from './fighters/aquilo';
import { SVANHILD_COMBOS } from './fighters/svanhild';
import { KUBIWA_COMBOS } from './fighters/kubiwa';
import { TORSION_COMBOS } from './fighters/torsion';
import { HIGHSUN_COMBOS } from './fighters/highsun';
import { LANTHORN_COMBOS } from './fighters/lanthorn';
import { HIKUI_COMBOS } from './fighters/hikui';
import { UME_COMBOS } from './fighters/ume';
import { TOKAN_COMBOS } from './fighters/tokan';
import { STRAPPADO_COMBOS } from './fighters/strappado';
import { UNARI_COMBOS } from './fighters/unari';
import { BARROW_COMBOS } from './fighters/barrow';
import { SASHIGANE_COMBOS } from './fighters/sashigane';
import { GOSU_COMBOS } from './fighters/gosu';
import { KUSUSHI_COMBOS } from './fighters/kusushi';
import { HAKUSHI_COMBOS } from './fighters/hakushi';
import { SUZURAN_COMBOS } from './fighters/suzuran';
import { WATAAME_COMBOS } from './fighters/wataame';
import { SENKO_COMBOS } from './fighters/senko';
import { BUNA_COMBOS } from './fighters/buna';
import { OYASHIO_COMBOS } from './fighters/oyashio';
import { ADAD_COMBOS } from './fighters/adad';
import { SHIJIMA_COMBOS } from './fighters/shijima';
import { AKAITO_COMBOS } from './fighters/akaito';
import { TEMPO_COMBOS } from './fighters/tempo';
import { TANCHO_COMBOS } from './fighters/tancho';
import { BELLOWS_COMBOS } from './fighters/bellows';
import { MIKAGE_COMBOS } from './fighters/mikage';
import { FULL_BEAM_COMBOS } from './fighters/full-beam';
import { PYROCLAST_COMBOS } from './fighters/pyroclast';
import { AMPERE_COMBOS } from './fighters/ampere';
import { SHANXIAO_COMBOS } from './fighters/shanxiao';
import { KUZU_COMBOS } from './fighters/kuzu';
import { SHAKUGO_COMBOS } from './fighters/shakugo';
import { STRIX_COMBOS } from './fighters/strix';
import { BASILISSA_COMBOS } from './fighters/basilissa';
import { SORAYOMI_COMBOS } from './fighters/sorayomi';
import type { AttackSlot, FighterId } from './types';
import { HITSTOP, MOVES, type MoveDefinition, type Outcome } from './moves';
import { SHOP_COMBOS } from './combosShop';
import { isTechnique, techniqueMove, TECHNIQUE_SLOT, type TechniqueKey } from './techniques';
import { VOL1_COMBOS } from './combosVol1';

/** A fighter's six: each one's name (its own where it has one), and anything of its own over the template;
 *  `awakened`, what changes in the awakened form (Black Vespers's powers are Black Vespers's, not the Hawk's). */
export type ComboEnder = { name: string } & Partial<MoveDefinition>;
export type ComboRow = Record<EnderKey, ComboEnder> & { awakened?: Partial<Record<EnderKey, ComboEnder>> };

export type EnderKey = 'lh' | 'llh' | 'lllh' | 'llls' | 'airHeavy' | 'airSpecial';
/** A branch a cast is thrown as: one of a fighter's six enders, or one of the techniques every style has
 *  (techniques.ts, 2 November 2026). */
export type ComboKey = EnderKey | TechniqueKey;
export const COMBO_KEYS: readonly EnderKey[] = ['lh', 'llh', 'lllh', 'llls', 'airHeavy', 'airSpecial'];
/** One of the six enders, not a technique: what a fighter's own ender tables (names, clips, effects) are keyed by. */
export const isEnderKey = (key: unknown): key is EnderKey => (COMBO_KEYS as readonly unknown[]).includes(key);
/** What starts each one, for the move list. */
export const COMBO_INPUTS: Record<EnderKey, readonly ('jump' | AttackSlot)[]> = {
  lh: ['light', 'heavy'], llh: ['light', 'light', 'heavy'], lllh: ['light', 'light', 'light', 'heavy'],
  llls: ['light', 'light', 'light', 'special'], airHeavy: ['jump', 'heavy'], airSpecial: ['jump', 'special'],
};
/** What each one does, for the move list. */
export const COMBO_ROLES: Record<EnderKey, string> = {
  lh: 'Blowback', llh: 'Launcher', lllh: 'Knockdown', llls: 'Stun', airHeavy: 'Air strike', airSpecial: 'Ground smash',
};
/** The slot each one is thrown from, and whose cooldown it spends. */
export const COMBO_SLOT: Record<ComboKey, 'light' | 'heavy' | 'special'> = {
  lh: 'heavy', llh: 'heavy', lllh: 'heavy', llls: 'special', airHeavy: 'heavy', airSpecial: 'special', ...TECHNIQUE_SLOT,
};

/** The roster's template, before a fighter's tempo and its own numbers. Measured against the string it ends: a finisher
 *  is 42-54 damage over 0.55-0.7 s, a heavy 58 over 0.9 s on a 1.2 s cooldown, a special about 126 on 4.5 s. An ender
 *  costs less than the heavy and lands faster - it comes out of a string already paid for - and the stun and the smash
 *  sit on the special's cooldown, below what a special deals. */
const TEMPLATE: Record<EnderKey, MoveDefinition> = {
  lh: { name: '', duration: .7, contacts: [.28], damage: 46, range: 2.5, radius: .8, stamina: 16, cooldown: 1.2, stun: .55,
    knockback: 7.5, style: 'melee', lunge: 6, outcome: 'wallBounce', hitstop: HITSTOP.heavy },
  llh: { name: '', duration: .72, contacts: [.27], damage: 40, range: 2.4, radius: .85, stamina: 16, cooldown: 1.2, stun: .6,
    knockback: 1.6, style: 'melee', lunge: 5, outcome: 'launch', lift: 8.6, hitstop: HITSTOP.heavy },
  lllh: { name: '', duration: .86, contacts: [.36], damage: 64, range: 2.6, radius: .9, stamina: 20, cooldown: 1.4, stun: .8,
    knockback: 6, style: 'melee', lunge: 6, outcome: 'knockdown', hitstop: HITSTOP.heavy },
  llls: { name: '', duration: .9, contacts: [.36], damage: 54, range: 2.6, radius: 1, stamina: 24, cooldown: 4, stun: .9,
    knockback: 1.2, style: 'melee', lunge: 5, outcome: 'dizzy', hitstop: HITSTOP.heavy },
  airHeavy: { name: '', duration: .62, contacts: [.24], damage: 48, range: 2.4, radius: .95, stamina: 16, cooldown: 1, stun: .6,
    knockback: 3, style: 'melee', lunge: 3, outcome: 'groundBounce', hitstop: HITSTOP.heavy, fling: true },
  airSpecial: { name: '', duration: .8, contacts: [.22], damage: 70, range: 0, radius: 3.4, stamina: 24, cooldown: 4, stun: .7,
    knockback: 7, style: 'field', plunge: 30, outcome: 'knockdown', hitstop: HITSTOP.heavy },
};

/** The fighters' rows: the shop's twenty in combosShop.ts, the main game's sixteen in combosVol1.ts. */
const ROWS: Partial<Record<FighterId, ComboRow>> = { chohan:CHOHAN_COMBOS,aqrab:AQRAB_COMBOS,tsubute:TSUBUTE_COMBOS,yodaka:YODAKA_COMBOS,ume:UME_COMBOS,lanthorn:LANTHORN_COMBOS,highsun:HIGHSUN_COMBOS,torsion:TORSION_COMBOS,kubiwa:KUBIWA_COMBOS,onigawara:ONIGAWARA_COMBOS,cardo:CARDO_COMBOS,minase:MINASE_COMBOS,aquilo:AQUILO_COMBOS,'psyche':PSYCHE_COMBOS,'ovid':OVID_COMBOS,hawser:HAWSER_COMBOS,rotfalke:ROTFALKE_COMBOS,bonsho:BONSHO_COMBOS,murex:MUREX_COMBOS,kinu:KINU_COMBOS,'madake':MADAKE_COMBOS,akayuri:AKAYURI_COMBOS,hagure:HAGURE_COMBOS,hisame:HISAME_COMBOS,svanhild:SVANHILD_COMBOS,mizuhiki:MIZUHIKI_COMBOS,'shibuichi':SHIBUICHI_COMBOS,'rakucho':RAKUCHO_COMBOS,irbis:IRBIS_COMBOS,shidare:SHIDARE_COMBOS,hinomoto:HINOMOTO_COMBOS,amagoi:AMAGOI_COMBOS,'shakudo':SHAKUDO_COMBOS,hikui:HIKUI_COMBOS,tokan:TOKAN_COMBOS,strappado:STRAPPADO_COMBOS,unari:UNARI_COMBOS,barrow:BARROW_COMBOS,sashigane:SASHIGANE_COMBOS,gosu:GOSU_COMBOS,kusushi:KUSUSHI_COMBOS,hakushi:HAKUSHI_COMBOS,suzuran:SUZURAN_COMBOS,wataame:WATAAME_COMBOS,bruin:BRUIN_COMBOS,senko:SENKO_COMBOS,buna:BUNA_COMBOS, oyashio:OYASHIO_COMBOS,adad:ADAD_COMBOS, akaito: AKAITO_COMBOS, shijima: SHIJIMA_COMBOS, tempo:TEMPO_COMBOS, tancho: TANCHO_COMBOS, bellows: BELLOWS_COMBOS, mikage: MIKAGE_COMBOS, 'full-beam': FULL_BEAM_COMBOS, pyroclast: PYROCLAST_COMBOS, ampere: AMPERE_COMBOS, ...SHOP_COMBOS, ...VOL1_COMBOS, shanxiao: SHANXIAO_COMBOS, kuzu: KUZU_COMBOS, shakugo: SHAKUGO_COMBOS, strix: STRIX_COMBOS, sorayomi: SORAYOMI_COMBOS, 'basilissa': BASILISSA_COMBOS };

const cache = new Map<string, MoveDefinition>();
/** The fighter's own tempo: its light against the roster's (0.46 s). A heavy body's enders come out as much slower. */
function tempo(fighter: FighterId) { return Math.min(1.3, Math.max(.85, MOVES[fighter].light.duration / .46)); }
export function hasCombos(fighter: FighterId) { return !!ROWS[fighter]; }
export function comboMove(fighter: FighterId, key: ComboKey, awakened = false): MoveDefinition | undefined {
  // A technique (techniques.ts) is every fighter's, in their style.
  if (isTechnique(key)) return MOVES[fighter] ? techniqueMove(fighter, key) : undefined;
  const base = ROWS[fighter]?.[key]; if (!base) return undefined;
  const form = awakened ? ROWS[fighter]?.awakened?.[key] : undefined, row = form ? { ...base, ...form } : base;
  const id = `${fighter}:${key}:${form ? 1 : 0}`; const known = cache.get(id); if (known) return known;
  const t = TEMPLATE[key], k = tempo(fighter);
  const move: MoveDefinition = { ...t, duration: +(t.duration * k).toFixed(3), contacts: t.contacts.map(c => +(c * k).toFixed(3)), ...row, ender: true };
  cache.set(id, move);
  return move;
}

/** The ender a press makes: `stage` is the light stage running or just ended (-1 for none), `airborne` whether the
 *  fighter is off the floor. Undefined: the slot's own move. */
export function comboKeyFor(fighter: FighterId, slot: AttackSlot, stage: number, airborne: boolean): ComboKey | undefined {
  if (!ROWS[fighter] || (slot !== 'heavy' && slot !== 'special')) return undefined;
  if (airborne) return slot === 'heavy' ? 'airHeavy' : 'airSpecial';
  if (slot === 'heavy') return stage === 0 ? 'lh' : stage === 1 ? 'llh' : stage === 2 ? 'lllh' : undefined;
  return stage === 2 ? 'llls' : undefined;
}

/** What an outcome reads as on the move list. */
export const OUTCOME_WORDS: Partial<Record<Outcome, string>> = {
  launch: 'Launches', knockdown: 'Knocks down', dizzy: 'Stuns', wallBounce: 'Blows back', groundBounce: 'Spikes', hop: 'Pops up',
  stagger: 'Staggers', spin: 'Spins out', crumple: 'Crumples',
};
