import type { FighterId } from '../../game/types';
import type { ArtOverride, PackDefinition, PackMode } from './pack';

let active: PackDefinition | undefined;

/** Set by applyPack and restorePack (./apply.ts) alone. */
export function setActivePack(pack: PackDefinition | undefined) { active = pack; }
/** The pack on the page, if any. */
export const activePack = () => active;
/** The roster the page offers: the pack's slots when one is on (a pack is default-deny), else undefined. */
export const activePackRoster = (): readonly FighterId[] | undefined => active ? (Object.keys(active.slots) as FighterId[]).filter(id => !!active!.slots[id]) : undefined;
/** Whether the pack on the page fills this slot: its body then is the pack's, whatever outfit the player wears. */
export const packHas = (id: string | undefined) => !!active && !!id && !!active.slots[id as FighterId];
/** A picture of the pack's for a slot (SlotOverride.art), where the game draws one by fighter id; undefined keeps the
 *  game's own. */
export const packArt = (id: string | undefined, kind: keyof ArtOverride): string | undefined => active && id ? active.slots[id as FighterId]?.art?.[kind] : undefined;
/** Whether a slot's own signature effects are kept off while the pack is on (SlotOverride.quiet). */
export const packQuiets = (id: string | undefined) => !!active && !!id && !!active.slots[id as FighterId]?.quiet;

/** The mode a start asks for, in the pack's terms (src/ui/modes/catalogue.ts), from main.ts's start arguments. */
export function startMode(mode: string, access?: { kind: string; objective?: string; travel?: { mode?: string } }): PackMode | undefined {
  if (!access || access.kind === 'public') return mode === 'training' ? 'training' : 'royale';
  switch (access.kind) {
    case 'duel': return 'duel';
    case 'bots': return 'royale';
    case 'survival': case 'coop-create': case 'coop-join': return 'arcade';
    case 'objective': return access.objective === 'bad-blood' ? 'bad-blood' : 'last-stand';
    case 'rift-war': return 'rift-war';
    case 'party': return (access.travel?.mode as PackMode | undefined) ?? undefined;
    default: return undefined;
  }
}
/** Why the pack on the page does not play a start, or undefined when it does (or no pack is on). */
export function packRefuses(mode: string, access?: { kind: string; objective?: string; travel?: { mode?: string } }): string | undefined {
  if (!active?.modes) return undefined;
  const wanted = startMode(mode, access);
  if (wanted && active.modes.includes(wanted)) return undefined;
  const plays = active.modes.map(each => each.replace(/-/g, ' ').toUpperCase()).join(', ');
  return `The ${active.name} pack plays ${plays} in this build. Pick ${active.modes.includes('training') ? 'TRAINING GROUND' : plays} to fight with it.`;
}
