import type { StageId } from './stages';
import type { PredictionCheckpoint,ReactionCheckpoint } from './simulation';
export type { StageId };
export type FighterId = 'taisei' | 'konta' | 'gummy' | 'kosho' | 'ouga' | 'shirokane' | 'shiden' | 'kenzo' | 'koko' | 'nigo'
  | 'kagari' | 'ward' | 'kuon' | 'oro' | 'gaunt' | 'setsu'
  // The shop's fighters (economy/fighters.ts): locked until bought.
  | 'gorai' | 'haldor' | 'sorrel' | 'dorado' | 'shiun' | 'magatsu' | 'vesper' | 'imago' | 'wuming' | 'jirenga' | 'jinlin'
  | 'gohaku' | 'ippon' | 'sekka' | 'tobari' | 'akagane' | 'asahi' | 'levin' | 'rook' | 'gaku'
  // Integrated for the isolated fighter laboratory; availability is independently gated.
  | 'strix' | 'basilissa' | 'sorayomi' | 'kuzu' | 'shakugo' | 'shanxiao' | 'ampere' | 'pyroclast' | 'full-beam'
  | 'tancho' | 'bellows' | 'mikage' | 'tempo' | 'akaito' | 'shijima' | 'oyashio' | 'adad' | 'senko' | 'buna' | 'suzuran' | 'wataame' | 'kusushi' | 'hakushi' | 'sashigane' | 'gosu' | 'barrow' | 'unari' | 'strappado' | 'ume' | 'hikui' | 'lanthorn' | 'highsun' | 'torsion' | 'kubiwa' | 'onigawara' | 'minase' | 'shakudo' | 'amagoi' | 'hinomoto' | 'shidare' | 'irbis' | 'rakucho' | 'shibuichi' | 'mizuhiki' | 'hisame' | 'hagure' | 'akayuri' | 'madake' | 'kinu' | 'murex' | 'bonsho' | 'rotfalke' | 'hawser' | 'ovid' | 'psyche' | 'tokan' | 'yodaka' | 'tsubute' | 'aqrab' | 'chohan'
  | 'cardo' | 'bruin' | 'aquilo' | 'svanhild';
export type AttackSlot = 'light' | 'heavy' | 'special' | 'ultimate' | 'area';
/** The four slots every fighter had before the area slot: its own file lists these (MOVES adds its area move), and
 *  its card names these four (config.ts FIGHTERS.moves). */
export type CoreSlot = Exclude<AttackSlot, 'area'>;
/** Reaction states are their own actions, not one 'hurt'. A fighting game reads
 *  as a fight because a light jab, a launcher and a guard break look different
 *  on the receiving end and leave you in different situations. */
export type ReactionKind = 'flinch' | 'hurt' | 'launched' | 'knockdown' | 'getup' | 'stun' | 'splat';
export type ActionKind = 'idle' | 'run' | 'jump' | 'dash' | 'guard' | 'awaken' | AttackSlot | ReactionKind | 'defeated' | 'victory';
export type RoomMode = 'training' | 'match';

export interface Vec3 { x: number; y: number; z: number }

/** World coordinates in metres; +Y is up, yaw=0 faces +Z. Times are seconds. */
export interface PlayerState extends Vec3 {
  id: string;
  name: string;
  fighter: FighterId;
  /** The shop's outfit the player wears for this fighter (src/game/economy/outfits.ts), as their room
   *  read it from their account: what every screen draws them in. */
  outfit?: string;
  yaw: number;
  hp: number;
  maxHp: number;
  stamina: number;
  /** Optional mode capacity; ordinary fighters remain at 100. */
  maxStamina?: number;
  ultimate: number;
  action: ActionKind;
  actionStarted: number;
  actionDuration: number;
  actionTime: number;
  /** Input edge that began this attack; stable across prediction and authority. */
  actionSeq?: number;
  /** Which stage of the light rush string the current (or last) light cast
   *  is: 0 is the fighter's own light, 1..RUSH_STAGES-1 the follow-ups that a
   *  light pressed on the previous stage's window carries into, the last one
   *  a finisher that sends the target away. Meaningful while `action` is
   *  'light'; the renderer picks the stage's clip from it. */
  chain?: number;
  /** Lock combat (lockCombat.ts), an experiment: the round of the light string the current (or last) light is in - 0
   *  the first, 1 the second, whose blows are moves of their own. Only a simulation playing lock combat sets it. */
  lockRound?: number;
  /** The combo ender (game/combos.ts) the current heavy or special is - a launcher, a knockdown, a stun, an air strike
   *  or a ground smash - or undefined for the fighter's own. Meaningful while `action` is 'heavy' or 'special'. */
  branch?: import('./combos').ComboKey;
  /** Seconds this action has spent frozen. The action clock is not wall time:
   *  impact freeze and time stop pause it, and moving actionStarted instead
   *  would read on the client as the action having re-triggered every frame. */
  actionFrozen?: number;
  target: string | null;
  alive: boolean;
  isBot: boolean;
  grounded: boolean;
  guarding: boolean;
  /** Hits landed in the current string, for the combo readout. */
  combo?: number;
  /** Impact freeze. Both fighters hold their pose and stop moving. */
  hitstop?: boolean;
  /** The same freeze as a window on the server clock, so the client can put it
   *  where it actually happened. The boolean is sampled on the broadcast grid,
   *  which rounds a light's freeze up to the snapshot interval and makes two
   *  identical hits weigh differently depending on which tick they landed on. */
  hitstopFrom?: number;
  hitstopUntil?: number;
  /** Transformed. The awakening meter buys a window of harder hits, less
   *  damage taken and faster movement; the client swaps the body or lights
   *  the aura. The ultimate is its own meter and its own cost. */
  awakened?: boolean;
  /** Which way the current dash went, for the renderer to play the clip the
   *  right way round. Only meaningful while `action` is 'dash'. */
  dashKind?: 'forward' | 'back' | 'side';
  /** The ball rooms only (AimAssist.sport): the fighter is boosting - a dash run on at the boost's speed, spending
   *  stamina, for as long as the stick holds - for the page's boost trail. Absent everywhere else. */
  boost?: boolean;
  /** Server time the transformation ends, for the meter countdown. */
  awakenedUntil?: number;
  timeStopped?: boolean;
  /** The highest input sequence this fighter's owner has had applied. A client
   *  predicting its own fighter replays everything newer than this. */
  ackSeq?: number;
  /** The transformation meter, 0-100. Separate from `ultimate` since round 13:
   *  the ultimate bar fills from damage DEALT and buys the ultimate; this one
   *  fills from damage TAKEN and buys the awakening. */
  awakening?: number;
  /** Match statistics, carried on the wire so a results screen can be drawn
   *  from the final snapshot by anybody who is still connected. */
  kills?: number;
  damageDealt?: number;
  damageTaken?: number;
  /** A human's skill so far this match (src/game/adaptive.ts; 1 trades evenly with the bots the game had before 28
   *  October 2026). Their page keeps it for the next match. Absent on bots, and in Training. */
  skill?: number;
  /** When each slot can be thrown again (server time). `area` is absent on a state from before the area slot. */
  cooldowns: Record<CoreSlot, number> & { area?: number };
  /** Arcade survival only. Fighters on one side never land a blow on each
   *  other; undefined is a side of one, which is every fighter in a royale. */
  team?: string;
  /** Arcade survival only: which enemy this body is. `fighter` still holds a
   *  roster id, because the simulation's type needs one, and nothing that
   *  reads an enemy may trust it - the renderer, the HUD and the audio all
   *  key an enemy off this instead. */
  enemy?: string;
  /** Arcade survival only: the move a non-roster body is throwing, since one
   *  slot can hold any of a boss's moves (see ArenaSimulation.setMove). */
  move?: string;
  /** Arcade survival only: body scale against a fighter, for the hit volume
   *  and the pushbox. A boss stands two or three times a fighter's height. */
  size?: number;
  /** Arcade survival only: a pushbox wider than `size` gives it, for a giant
   *  whose body is far bigger than the volume a swing has to reach. */
  girth?: number;
  /** Arcade survival only: what is left of the body's poise, 0-1. A blow on a
   *  body with poise hurts it without moving it; emptied, it staggers. */
  poise?: number;
  /** Round 3d (ULTS): held in somebody's ultimate cinematic - this is who.
   *  Stunned, pinned where the opener caught them and out of everybody
   *  else's reach until the finisher lets them go. */
  heldBy?: string;
  /** Round 3d (ULTS): on the thrower of a hit-confirm ultimate, while it
   *  runs: the server time its opener landed, which is when the cinematic
   *  began (`confirmedAt`), or the server time the opener was found to have
   *  missed, which ends the cast a short recovery later (`whiffedAt`). */
  confirmedAt?: number;
  whiffedAt?: number;
  forge?: string;
  status?: ('burn' | 'slow' | 'freeze')[];
}

/** Attack/jump/dash are edge-triggered commands. One movement command per60Hz tick. */
export interface PlayerInput {
  seq: number;
  moveX: number;
  moveZ: number;
  yaw: number;
  jump?: boolean;
  /** Still holding the jump: a jump let go of on the way up is cut short. */
  jumpHeld?: boolean;
  dash?: boolean;
  guard?: boolean;
  /** Spend a full meter on the transformation instead of on an ultimate. */
  awaken?: boolean;
  attack?: AttackSlot;
  aim?: { x: number; z: number };
  targetId?: string | null;
  /** Whether `targetId` is a hard lock (Tab): each attack turns to it within
   *  its reach. False: a soft target the camera is holding, and each attack
   *  goes to the enemy the player faces when it starts
   *  (ArenaSimulation.chooseIntent). Unsaid - a bot, an old client - the
   *  target stands as sent. */
  lock?: boolean;
  /** Lag compensation (ArenaSimulation.rewind): the server time of the frame the page drew the other fighters at when
   *  it sent this - how far in the past, to the server, the opponent it swung at was standing. An old client or a bot
   *  leaves it out, and is resolved against the present. */
  view?: number;
  /** Techniques (techniques.ts): the stick at the press, against the line to the opponent - neutral, toward, away or
   *  across - where the sender says so (a bot, or a page that knows better). Unsaid, the simulation reads it off
   *  `moveX`/`moveZ` for a person and takes neutral for a bot. */
  dir?: 'n' | 'f' | 'b' | 's';
}

/** 'break' is the combo breaker, and it is the one event whose `actorId` is
 *  the fighter it happened *to*: they are the one escaping, and `targetId` is
 *  the attacker whose string was cut. */
export type CombatEventKind = 'cast' | 'release' | 'hit' | 'land' | 'blocked' | 'just-guard' | 'guard-break'
  | 'wall-splat' | 'ground-bounce' | 'projectile-clash' | 'break'
  | 'dodge' | 'tech' | 'awaken' | 'awaken-end' | 'eliminated' | 'respawn' | 'winner' | 'rejected'
  /** A landed finisher left a status on `targetId` (`status`: burn, slow or freeze; VOL.3 part two). */
  | 'status'
  /** Techniques (techniques.ts): a counter stance met a blow - `actorId` stood in it, `targetId` threw the blow it undid. */
  | 'counter'
  /** A just guard answered by stepping out of the blow: `actorId` vanished
   *  from `origin` and reappeared at `endpoint`, behind `targetId`, the
   *  attacker whose swing it read. */
  | 'vanish'
  /** Lock combat (lockCombat.ts): `actorId`'s round of the string has ended on `targetId`, whose escape window closes
   *  at `due` (`reason` 'early': it opened shut, a guard mashed during the round). `round`: which round ended (0 first). */
  | 'lock-gap'
  /** Lock combat: `actorId` pressed guard in the gap after `targetId`'s round. With no `reason` it vanished out
   *  (`origin` to `endpoint`, alongside a 'vanish'); 'early', 'late' or 'stamina' say why it did not; 'counter' is the
   *  attacker vanishing behind the escaper in turn (the counter-vanish). */
  | 'lock-escape'
  /** A dash that homes on a launched or knocked-away target: `actorId` chases
   *  `targetId` from `origin` toward `endpoint`. */
  | 'chase'
  /** Arcade survival: a body's poise ran out and it staggers wide open.
   *  `actorId` is the body, `targetId` whoever broke it. */
  | 'poise-break'
  /** Round 3d (ULTS): a hit-confirm ultimate's opener has landed (or its
   *  stop has caught somebody), and its cinematic plays: `actorId` holds
   *  `targetId`, the primary victim, from `origin` (the thrower) to
   *  `endpoint` (the victim). Everything inside the cinematic - the camera's
   *  shots, its effects, its lines - is keyed to this, not to the cast. */
  | 'confirm'
  /** Round 3d (ULTS): a hit-confirm ultimate's opener found nobody. The
   *  cast ends a short recovery later, the cinematic never plays, and the
   *  bar is spent. */
  | 'whiff'
  | 'impact';
export interface CombatEvent {
  actionSeq?: number;
  radius?: number;
  /** The area slot: on an area move's 'release', the server time its first strike lands (the telegraph's end). */
  due?: number;
  /** The area slot (round 3): on an area move's 'release' and 'impact', the look its strikes are timed to (an Armory
   *  effect id, AreaSpec.fx), and how many strikes the circle lands. */
  look?: string;
  strikes?: number;
  /** The area slot (round 3): on a 'hit', the strike found its body inside the circle's bullseye (all of its damage). */
  bullseye?: boolean;
  /** For a 'status' event: which one. */
  status?: 'burn' | 'slow' | 'freeze';
  id: number;
  kind: CombatEventKind;
  serverTime: number;
  actorId: string;
  targetId?: string;
  fighter?: FighterId;
  slot?: AttackSlot;
  body?: FighterId;
  move?: string;
  origin?: Vec3;
  endpoint?: Vec3;
  damage?: number;
  /** Authoritative phase within a multi-contact move. */
  contactIndex?: number;
  /** Attacker's hit count in the current string, at the moment of this hit. */
  combo?: number;
  /** Rush stage of the light that cast or landed this, when `slot` is light. */
  chain?: number;
  /** The combo ender (game/combos.ts) a heavy or special cast is, where it is one. */
  branch?: import('./combos').ComboKey;
  /** Techniques (techniques.ts styleScale): what this combo's variety made a landed blow worth, where it was more than
   *  itself - the HUD's STYLE beside the hit count. */
  style?: number;
  /** What the hit did to the target, so the client can pick its reaction. */
  reaction?: ReactionKind;
  /** Which side it landed on. One flinch clip reads as a hit that came from
   *  somewhere once the body is bent away from it. */
  fromBehind?: boolean;
  reason?: string;
  /** Lock combat: on a 'hit', a light or heavy that caught its body's own swing before its blow. */
  counter?: boolean;
  /** Lock combat: on a 'hit' and a 'lock-gap', the round of the string (0 the first). */
  round?: number;
  seed?: number;
  /** Arcade survival: the enemy kind of the actor, stamped by the local arena
   *  on every event an enemy threw. Such an event carries no `fighter`. */
  enemy?: string;
  /** Arcade survival: a blow that rolled a critical. */
  critical?: boolean;
  /** On an 'eliminated' in a royale: the health the knockout gave back to whoever scored it (KO_HEAL). */
  heal?: number;
  /** Round 3d (ULTS): on a 'confirm' or a 'whiff', how far into its move it
   *  was decided - seconds from the cast on the move's own clock (holds and
   *  impact freezes left out) - so a cinematic's layers can be laid out from
   *  the confirm on the move's own timeline. */
  castAge?: number;
  /** Round 3e (VARIETY): on a 'hit', the outcome the blow gave the body
   *  (moves.ts Outcome) where its move has one of its own - a hop, a wall
   *  bounce and a true launch all read `reaction: 'launched'`, and this says
   *  which. */
  outcome?: import('./moves').Outcome;
  /** v70: on the 'hit' that threw its body by a true launch, the lift it left on (m/s) - its arc's; the body runs ahead
   *  of that arc and is back on it at the top (moves.ts LAUNCH_LEAD), so a client times the flight by this, not by
   *  the speed it sees. */
  lift?: number;
  /** Round 4b (JUMP): on a 'land', how far the body fell to it (m): a ground smash from the top of a jump. */
  drop?: number;
  /** Ground hits (8 October 2026): on a 'hit', the body was down on the floor (a knockdown, or a wall splat come down
   *  onto it) and the blow a fighter's normal - a ground hit, at moves.ts GROUND_HIT_SCALE of its damage. The body
   *  stays down in the action it was in ('knockdown' or 'splat'); `reaction` reads 'flinch', the flinch it takes there.
   *  An ultimate on a body down is no ground hit and never carries it. */
  downed?: boolean;
}

/** The recipient's record against another player (`id`, their arena id): won and lost, every meeting counted. */
export interface RivalView { id: string; won: number; lost: number }

/** A private royale's "next match, same room" (server/social/RoomAgain.ts): who has said they are in, on the results. */
export interface AgainView { ids: string[]; /** The room's matches so far: each new one is a new match for the rewards. */ match: number }

export interface RoomLobby {
  /** Two fighters, one life each; a separate queue from battle royale. */
  duel?: boolean;
  visibility: 'public' | 'private';
  code?: string;
  hostId: string | null;
  canStart: boolean;
  startsAt: number | null;
  /** Server simulation seconds; only waiting private rooms expire. */
  expiresAt: number | null;
  /** A private room's fighters in all, as its host chose: the seats bots fill at kickoff. */
  size?: number;
  /** A party launched the room (PartyRoom): the party has its own invite, and the room starts by itself. */
  party?: boolean;
  /** A party's room that will start by itself once everyone is in and loaded: no START to press (server PartyStart). */
  autoStart?: boolean;
  /** A private royale's next match in the same room (server/social/RoomAgain.ts): set once a match in it has ended. */
  again?: AgainView;
}

/** Round 5 (SOLOPAUSE): a room's pause as the server has it (src/server/SoloPause.ts), on every snapshot of a room
 *  that can pause. Read on the page through PauseLink (src/game/pauseLink.ts). */
export interface PauseView {
  /** Frozen now: no tick, no bot, no countdown; commands are dropped until it thaws. */
  paused: boolean;
  /** A pause has been taken and waits for this player's commands already in flight. */
  pausing?: boolean;
  /** The room would freeze for its one human now. Never true with two or more humans in it. */
  pausable: boolean;
  /** The serial of the last pause or resume request the room has handled. */
  ack: number;
}

export interface GameSnapshot {
  duel?: import('./duel/DuelSet').DuelView;
  matchId?: string;
  reward?: {report: import('./economy/earn').Report; settlement: import('./economy/account').Settlement};
  trainingLab?: import('./training/TrainingLab').LabView;
  /** Round 5 (SOLOPAUSE): the room's pause, when the room can pause at all. */
  pause?: PauseView;
  /** Rollback checkpoint for the receiving owner, never accepted from a client. */
  prediction?: Record<string,PredictionCheckpoint>;
  /** Owner only, beside `prediction`: the fewest of the recipient's own
   *  commands waiting in the server's input queue at any tick of the last half
   *  second (InputQueue.low). The client's input clock runs slightly slow
   *  while it stands above target (src/game/inputClock.ts). */
  queued?: number;
  /** Public knockback/fall state used to present a locally predicted contact. */
  reactions?:Record<string,ReactionCheckpoint>;
  lobby?: RoomLobby;
  /** Rivalries (server/social/RivalryWatch.ts): the recipient's record against each other player in the room they have
   *  met before, in a Duel or a friends' room - on its snapshots before and after the fight, never during it. */
  rivals?: RivalView[];
  /** The arena being fought in. The server owns it: it also owns collision. */
  stage: StageId;
  trainingBotMode?: 'passive'|'combat';
  /** Couch Training (ArenaSimulation.seatPair): the two people face to face in a Training with no dummy, Player 1's id
   *  first. Unset in every other room, a Training with its dummy among them. */
  trainingPair?: [string, string];
  /** Lock combat (game/lockCombat.ts): this fight plays it - an online room as much as the page's own - and the page's
   *  prediction copy plays it too. Unset under the live rules. */
  lockCombat?: true;
  players: PlayerState[];
  events: CombatEvent[];
  serverTime: number;
  roomMode: RoomMode;
  status: 'waiting' | 'active' | 'finished';
  winnerId: string | null;
  tick: number;
}

/** A collision backend may constrain a desired capsule displacement. */
export interface CollisionMovement extends Vec3 {
  /** Contact with walkable ground after this movement, when supported by the backend. */
  grounded?: boolean;
}
export interface CollisionWorld {
  move(id: string, position: Vec3, displacement: Vec3): CollisionMovement;
  remove?(id: string): void;
  raycast?(origin: Vec3, endpoint: Vec3): Vec3;
  dispose?(): void;
}
