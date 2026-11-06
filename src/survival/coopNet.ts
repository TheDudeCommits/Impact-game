import { Packr, Unpackr } from 'msgpackr';
import type { GameSnapshot, PlayerState } from '../game/types';
import type { Orb, SurvivalView } from './SurvivalGame';

export const COOP_ROOM = 'survival_arena';
/** Ascension specializations and authoritative rank refunds. */
// 3 (1 November 2026): lock combat - the heroes' light strings play it (game/lockCombat.ts).
export const SURVIVAL_PROTOCOL = 3;
/** Seconds a co-op draft stays open before everyone still choosing takes the
 *  rarest card on offer, and seconds the room waits for everyone's browser to
 *  load the next act before moving the fight there regardless. */
export const DRAFT_SECONDS = 25;
export const TRAVEL_SECONDS = 25;

/** The run, as one fighter in it sees it. */
export interface CoopView extends Omit<SurvivalView, 'orbs'> {
  /** Which run of the room this is: a retry is a new one. */
  run: number;
  /** Whether this fighter is the room's host (who starts and restarts runs). */
  host: boolean;
  /** Bosses and champions standing, and the shadow rivals among them. */
  marked: { bosses: string[]; champions: string[]; rivals: string[] };
  orbs: CoopOrb[];
  /** Seconds left to choose, while a draft is open. */
  draftLeft?: number;
  /** Seconds before the party's pause for the skill tree ends on its own. */
  treeLeft?: number;
  /** While travelling: fighters whose browser is still loading the next act. */
  loading?: number;
}
export type CoopOrb = Pick<Orb, 'id' | 'kind' | 'value' | 'x' | 'y' | 'z' | 'pulled'>;
export interface CoopFrame extends GameSnapshot { survival: CoopView;
  /** The horde, packed (see HordeFrame.pack). */
  horde?: Uint8Array }

/** What an enemy's body leaves out: meters, stamina, cooldowns and tallies are
 *  a roster fighter's, and nothing draws them for the horde. `decode` puts
 *  neutral values back so every body the client handles is a whole PlayerState. */
const ROSTER_ONLY = ['stamina', 'ultimate', 'awakening', 'isBot', 'kills', 'damageDealt', 'damageTaken', 'cooldowns', 'actionSeq', 'ackSeq', 'combo', 'fighter'] as const;
const NEUTRAL: Partial<PlayerState> = { stamina: 100, ultimate: 0, awakening: 0, isBot: false, kills: 0, damageDealt: 0, damageTaken: 0,
  cooldowns: { light: 0, heavy: 0, special: 0, ultimate: 0 } as PlayerState['cooldowns'], combo: 0, fighter: 'taisei' };

/** Feed items worth sending: the newest, which is all a client that polls at
 *  thirty frames a second can have missed. It keeps what it has seen by id. */
const FEED_WINDOW = 24;

export function slimView(view: SurvivalView): Omit<CoopView, 'run' | 'host' | 'marked'> {
  return { ...view,
    orbs: view.orbs.map(orb => ({ id: orb.id, kind: orb.kind, value: Math.round(orb.value * 100) / 100, x: round(orb.x), y: round(orb.y), z: round(orb.z), pulled: orb.pulled })),
    feed: view.feed.slice(-FEED_WINDOW) };
}
const round = (value: number) => Math.round(value * 100) / 100;

const packr = new Packr({ useRecords: true });
const unpackr = new Unpackr({ useRecords: true });

export function encode(frame: CoopFrame): Uint8Array {
  const players = frame.players.map(body => {
    if (!body.enemy) return body;
    const slim: Record<string, unknown> = { ...body };
    for (const key of ROSTER_ONLY) delete slim[key];
    return slim;
  });
  return packr.pack({ ...frame, players });
}

export function decode(bytes: Uint8Array): CoopFrame {
  const frame = unpackr.unpack(bytes) as CoopFrame;
  frame.players = frame.players.map(body => body.enemy ? { ...NEUTRAL, ...body, cooldowns: { ...NEUTRAL.cooldowns!, ...body.cooldowns } } as PlayerState : body);
  return frame;
}

/** The co-op room this page is in, for what is not the run's own traffic: its account (what it wears) and
 *  its emotes (src/ui/shop/boot.ts). network.ts sets it as a co-op room connects, and clears it as it leaves. */
export const COOP_LINK: { room?: { send(type: string, message?: unknown): void; connection: { isOpen: boolean } };
  /** Any match room this page is in (a versus room too): it is told the page's account, for the outfit the player wears. */
  match?: { send(type: string, message?: unknown): void; connection: { isOpen: boolean } };
  /** The token of the account the page plays as (the shop's), sent as a room is joined: a fighter bought in the
   *  shop is let in only for the account that owns them (economy/fighters.ts). */
  token?: string } = {};
