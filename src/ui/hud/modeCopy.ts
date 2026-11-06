import { RULES, type ObjectiveSeat } from '../../game/objectives/model';
import type { VillageView } from '../../game/objectives/lastStand';
import type { VillageStructure } from '../../game/objectives/villageStructures';
import { siegeBossTier } from '../../game/objectives/siegePacing';

/**
 * Round 5, WP3: what the Arcade, Last Stand and Bad Blood HUDs say, as pure functions of the run or the operation (no
 * DOM), so the words are tested (modeCopy.test.ts) and the modules only decide when to write them.
 */

// ---- Last Stand (§7.5) ----------------------------------------------------------------------------------------------

/** The next wave from `wave` on that brings a boss (siegePacing's tiers: every third, fifth and tenth). */
export function nextBossWave(wave: number) { for (let w = Math.max(1, wave); w < wave + 12; w++) if (siegeBossTier(w)) return w; return 0; }

/** The plaque's headline: "WAVE 3 · 24 LEFT", or "NEXT WAVE · 6s" between waves. */
export function wavePlaque(city: Pick<VillageView, 'phase' | 'wave' | 'remaining' | 'nextWaveAt'>, now: number) {
  const preparing = city.phase === 'preparation';
  return preparing
    ? { lead: 'NEXT WAVE', accent: ` · ${Math.max(0, Math.ceil(city.nextWaveAt - now))}s` }
    : { lead: `WAVE ${city.wave}`, accent: ` · ${city.remaining} LEFT` };
}

/** The plaque's second line: what the wave holds, the boss's mood, a rally, or how far the next boss is. */
export function waveLine(city: Pick<VillageView, 'phase' | 'wave' | 'plan' | 'bossPhase' | 'director'>, now: number, clearedAt: number, bossUp: boolean) {
  if (city.phase === 'preparation') {
    const next = city.wave + 1;
    if (city.wave > 0 && now - clearedAt < 4) return `WAVE ${city.wave} CLEARED · REGROUP & REPAIR`;
    if (siegeBossTier(next)) return `WAVE ${next} · BOSS WAVE`;
    return city.plan ? `WAVE ${next} · ${city.plan.total} RAIDERS` : '';
  }
  if (bossUp) return city.bossPhase === 2 ? 'DESPERATION · STAY TOGETHER' : city.bossPhase === 1 ? 'BOSS ENRAGED · WATCH THE WIND-UP' : 'BOSS AT THE GATES';
  if (city.director?.state === 'rally') return 'RALLY · RESCUE & REGROUP';
  const boss = nextBossWave(city.wave);
  return boss ? `NEXT BOSS · WAVE ${boss}` : '';
}

/** An ally's plate tag: RECONNECTING, RETURNING · 2s, ✚ REVIVING 40%, ✚ DOWN, or nothing while they fight. */
export function allyState(seat: Pick<ObjectiveSeat, 'disconnected' | 'reviveAt' | 'rescue'>, down: boolean, now: number) {
  if (seat.disconnected) return 'RECONNECTING';
  if (seat.reviveAt !== undefined) return `RETURNING · ${Math.max(1, Math.ceil(seat.reviveAt - now))}s`;
  if (down) return seat.rescue > 0 ? `✚ REVIVING ${Math.floor(seat.rescue * 100)}%` : '✚ DOWN';
  return '';
}

/** Which approach feeds each structure: west, the gate (the guardhouse behind it), east. */
export const LANE_OF: Readonly<Record<string, number>> = { 'village-west': 0, 'village-keep': 1, 'village-east': 2 };
/** The structure struck most recently in the last 2.5 s, other than `skip`: the lane alert's subject. */
export function struckStructure(structures: readonly VillageStructure[], now: number, skip?: VillageStructure): VillageStructure | undefined {
  let pick: VillageStructure | undefined;
  for (const s of structures) if (s !== skip && s.hp > 0 && s.hitAt > now - 2.5 && (!pick || s.hitAt > pick.hitAt)) pick = s;
  return pick;
}
/** A lane alert's second line: "UNDER ATTACK · 6 RAIDERS". */
export function underAttack(raiders: number) { return raiders ? `UNDER ATTACK · ${raiders} RAIDER${raiders === 1 ? '' : 'S'}` : 'UNDER ATTACK'; }

/** Personal progress under the plate: a level's news for a moment, else the next full heal. */
export function levelNote(progress: { level: number; leveledAt: number; healedAt: number }, now: number) {
  if (progress.healedAt >= 0 && now - progress.healedAt < 4) return 'HEALTH RESTORED';
  if (progress.leveledAt >= 0 && now - progress.leveledAt < 3) return 'LEVEL UP · POWER UP';
  return `FULL HEAL AT LV ${Math.floor(progress.level / 5) * 5 + 5}`;
}

// ---- Bad Blood (§7.6) -----------------------------------------------------------------------------------------------

export const POWER = `${RULES.villainMultiplier}×`;
export type BadgeKind = 'power' | 'ready' | 'returning' | 'used';
/** Your badge's kind: a Villain's power, or a Hero's return (ready, under way, or spent). */
export function badgeKind(seat: Pick<ObjectiveSeat, 'team' | 'revivesLeft' | 'reviveAt'>, alive: boolean): BadgeKind {
  if (seat.team === 'villains') return 'power';
  if (seat.reviveAt !== undefined && !alive) return 'returning';
  return seat.revivesLeft > 0 ? 'ready' : 'used';
}
export function badgeCopy(kind: BadgeKind, seat: Pick<ObjectiveSeat, 'reviveAt'>, now: number) {
  switch (kind) {
    case 'power': return `${POWER} POWER · ONE LIFE`;
    case 'returning': return `↻ RETURNING · ${Math.max(1, Math.ceil((seat.reviveAt ?? now) - now))}s`;
    case 'ready': return '↻ 1 RETURN READY';
    default: return 'RETURN USED · LAST LIFE';
  }
}
/** The target plate's tag: what knocking this fighter out will mean. */
export function targetTag(seat: Pick<ObjectiveSeat, 'team' | 'revivesLeft'>) {
  return seat.team === 'villains' ? `VILLAIN · ${POWER} · ONE LIFE` : seat.revivesLeft > 0 ? 'HERO · ↻ RETURN READY' : 'HERO · LAST LIFE';
}
export type FaceState = 'ready' | 'up' | 'returning' | 'out';
/** A face on the team bar: a Hero with a return in hand, a fighter up, one on the way back, one out. */
export function faceState(seat: Pick<ObjectiveSeat, 'team' | 'revivesLeft' | 'reviveAt'>, alive: boolean): FaceState {
  if (alive) return seat.team === 'heroes' && seat.revivesLeft > 0 ? 'ready' : 'up';
  return seat.reviveAt !== undefined ? 'returning' : 'out';
}
export function faceMark(state: FaceState, seat: Pick<ObjectiveSeat, 'reviveAt'>, now: number) {
  return state === 'returning' ? `${Math.max(1, Math.ceil((seat.reviveAt ?? now) - now))}s` : state === 'ready' ? '↻' : state === 'out' ? '×' : '';
}
/** What a return under way asks of your side. */
export function returnAsk(side: 'heroes' | 'villains', heroesStanding: number) {
  return side === 'heroes' ? 'KEEP ONE HERO STANDING' : heroesStanding === 1 ? 'KO THE LAST HERO TO STOP IT' : '';
}

// ---- Arcade Survival (§7.4) -----------------------------------------------------------------------------------------

/** The KO chain: kills less than three seconds apart (the survival HUD's own count), shown from ten. */
export class KoChain {
  static readonly GAP = 3000; static readonly FADE = 2200; static readonly SHOWN = 10;
  n = 0; live = false; fading = false;
  private kills = -1; private at = -Infinity;
  update(kills: number, now: number) {
    // A new run (its count starts again) starts the chain again.
    if (this.kills < 0 || kills < this.kills) { this.kills = kills; this.n = 0; this.at = -Infinity; }
    if (kills > this.kills) { if (now - this.at > KoChain.GAP) this.n = 0; this.n += kills - this.kills; this.at = now; }
    this.kills = kills;
    this.live = now - this.at < KoChain.GAP && this.n >= KoChain.SHOWN;
    this.fading = this.live && now - this.at > KoChain.FADE;
    return this;
  }
}
/** The skill tree prompt's detail: "2 POINTS". */
export const pointsCopy = (points: number) => `${points} POINT${points === 1 ? '' : 'S'}`;
