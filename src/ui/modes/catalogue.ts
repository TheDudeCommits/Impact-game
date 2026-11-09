import type { GameSnapshot } from '../../game/types';
import { siteUrl } from '../../loading/siteBase'; // asset addresses inside the page's own folder
import {riftOf} from '../../game/moba/model';
import {ballOf, GOAL_FIGHT, GOAL_RULES, SPIKE_RULES} from '../../game/ball/model';
import { objectiveOf, RULES } from '../../game/objectives/model';
import { KO_HEAL, MAX_PLAYERS, MIN_MATCH_FIELD } from '../../game/moves';
import type { HomeMode } from '../MangaHome';
import { GUARD_HINT } from '../guardGuide';
import { phone } from '../../input/device';
import { DUEL_KICKER, LAST_STAND } from '../../originals/stages';
import { gateModes } from '../../originals/launch';

export type ModeId = 'duel' | 'royale' | 'training' | 'arcade' | 'last-stand' | 'bad-blood' | 'rift-war' | 'goal-rush' | 'sky-spike';
export type VariantId = 'offline' | 'couch' | 'online' | 'friends';
export const VARIANT_ORDER: readonly VariantId[] = ['offline', 'couch', 'online', 'friends'];
export const MODE_ORDER: readonly ModeId[] = ['duel', 'goal-rush', 'sky-spike', 'royale', 'training', 'arcade', 'last-stand', 'bad-blood', 'rift-war'];

/** Round 5 corrections (the blind critic): one vocabulary for the ways to play, in every mode, on the cards, the
 *  sheets and PLAY's line - BOTS · ONLINE · FRIENDS - with each mode's own one-line subtitle under the word. A mode
 *  played alone (Training, Arcade's solo run) has no bots: its first way is SOLO. */
export const WAY_WORDS: Readonly<Record<VariantId, string>> = { offline: 'BOTS', couch: 'COUCH', online: 'ONLINE', friends: 'FRIENDS' };
export interface ModeVariant {
  /** The way's word, on the sheet's tab, the home card and PLAY's line: BOTS, ONLINE, FRIENDS (SOLO alone). */
  label: string;
  /** The same word on the home card, where three share one line. */
  card: string;
  /** The mode's own subtitle under the word: ONE BOT RIVAL, REAL PLAYERS ONLY, PRIVATE 1 V 1. */
  tag: string;
  /** Played on this device: the menu pauses it. Undefined: a room on the match server, which runs on. */
  onDevice?: boolean;
  /** One sentence: what happens if you choose it. */
  note: string;
  /** The primary button: FIGHT, FIND MATCH, HOST ROOM, DEPLOY, START RUN. */
  go: string;
}
export interface ModeInfo {
  id: ModeId;
  name: string;
  /** One line: what you are trying to do. */
  goal: string;
  /** The goal in a few words, for the home's mode line. */
  tagline: string;
  /** How a match is won, or how a run ends. */
  win: string;
  facts: { players: string; length: string; lives: string };
  /** Three bullets, the first-time explainer's panels and the menu's HOW TO PLAY. */
  howTo: readonly [string, string, string];
  variants: Partial<Record<VariantId, ModeVariant>>;
  /** The home card's art: /assets/home/modes/<art>.webp. */
  art: string;
  /** The sheet's own cover where a mode has one (the operations' painted covers), and its kicker line. */
  cover?: string;
  kicker?: string;
  /** The three explainer panels' pictures: an image and its focus (background-position), or the fighter's own move card. */
  panels: readonly [Panel, Panel, Panel];
  /** Bump when the rules change: the first-time explainer shows again (rift-modes-seen). */
  rulesVersion: number;
}

export type Panel = { src: string; at?: string } | { move: 'ultimate' | 'special' | 'awakening' };
const art = (id: string, at?: string): Panel => ({ src: siteUrl(`/assets/home/modes/${id}.webp`), at });
const revive = RULES.heroReviveSeconds, villains = RULES.villainMultiplier;
export const MODES: Readonly<Record<ModeId, ModeInfo>> = {
  // The ball modes: every kind of attack is allowed in both, on the ball only.
  'goal-rush': {
    // (rulesVersion 2: the stances, the tackle and the boost are taught, so the first-time
    // explainer shows once more.)
    id: 'goal-rush', name: 'GOAL RUSH', art: 'goal-rush', rulesVersion: 2, kicker: 'THE INK BOWL · 3 V 3 FOOTBALL',
    tagline: 'Blast the ball into their goal.',
    goal: 'Three against three in a walled bowl. Play the ball with every move you have, or fight for it: outscore the other side.',
    win: `Lead when the ${Math.round(GOAL_RULES.matchSeconds / 60)} minutes run out (the match ends when the ball next touches the ground). Tied: the next goal wins.`,
    facts: { players: '3 V 3', length: `${Math.round(GOAL_RULES.matchSeconds / 60)} MIN + OVERTIME`, lives: `WIPE-OUTS · ${GOAL_FIGHT.seconds} S` },
    howTo: [
      'Every swing hits the ball where you look: {light} passes to a team-mate, {heavy} shoots, a launcher pops it high. Jump (twice) and strike to volley it in. {dash} on the run BOOSTS on the gold bar.',
      '{target} switches stance. BALL: your swings play the ball and never hurt anyone. FIGHT: you lock on to the one on the ball and every move is theirs. Knock them down: a TACKLE wins it back.',
      `Passes and big hits heat the ball; a hot one flies faster. Touch it to charge {ultimate}: your SUPER SHOT, bulldozing all but a perfect guard. Its goal counts ${GOAL_RULES.superGoal}.`,
    ],
    panels: [art('goal-rush', '30% 40%'), art('goal-rush', '60% 50%'), { move: 'ultimate' }],
    variants: {
      offline: { label: 'BOTS', card: 'BOTS', tag: 'YOU + 2 BOTS VS 3', onDevice: true, note: 'A full 3 v 3 on this device, bots on both sides.', go: 'KICK OFF' },
      couch: { label: 'COUCH', card: 'COUCH', tag: '2 PLAYERS + BOTS', onDevice: true, note: 'Player 2 on this device, the screen split in two: on your team or the other. Bots fill both sides.', go: 'KICK OFF' },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'REAL PLAYERS + BOTS', note: 'Matched with other players; bots fill empty seats.', go: 'FIND MATCH' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'PRIVATE ROOM', note: 'A private room for up to six, three a side.', go: 'HOST ROOM' },
    },
  },
  'sky-spike': {
    // (rulesVersion 2: the PERFECT SPIKE's timing and the dig are taught.)
    id: 'sky-spike', name: 'SKY SPIKE', art: 'sky-spike', rulesVersion: 2, kicker: 'THE SKY COURT · 3 V 3 TAKRAW',
    tagline: 'Spike it into their court.',
    goal: 'Three against three across a net. Keep the ball off your floor and smash it into theirs with every move you have.',
    win: `First to ${SPIKE_RULES.target}, win by two (${SPIKE_RULES.cap} caps it). A point in a FEVER rally counts double.`,
    facts: { players: '3 V 3', length: '~5–8 MIN', lives: `FIRST TO ${SPIKE_RULES.target}` },
    howTo: [
      `{light} keeps the ball on your side: a BUMP, then a SET floating high at the net. ${SPIKE_RULES.touches} touches a side, the last has to go over; a ball that hits you is bumped for you.`,
      'From a step behind the set, {jump} as it peaks and swing {heavy} at the top of your jump: a PERFECT SPIKE, faster and hotter. Swing early and it is an ordinary spike. {guard} in the air at the net BLOCKS.',
      `A hard ball into your court: {dash} at it to DIVE and dig it up for your side. Past rally ${SPIKE_RULES.fever} it is a FEVER rally, worth double. {ultimate}: a SUPER SHOT into their emptiest corner.`,
    ],
    panels: [art('sky-spike', '30% 40%'), art('sky-spike', '60% 50%'), { move: 'ultimate' }],
    variants: {
      offline: { label: 'BOTS', card: 'BOTS', tag: 'YOU + 2 BOTS VS 3', onDevice: true, note: 'A full 3 v 3 on this device, bots on both sides.', go: 'SERVE' },
      couch: { label: 'COUCH', card: 'COUCH', tag: '2 PLAYERS + BOTS', onDevice: true, note: 'Player 2 on this device, the screen split in two: on your team or the other. Bots fill both sides.', go: 'SERVE' },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'REAL PLAYERS + BOTS', note: 'Matched with other players; bots fill empty seats.', go: 'FIND MATCH' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'PRIVATE ROOM', note: 'A private room for up to six, three a side.', go: 'HOST ROOM' },
    },
  },
  'rift-war': {
    id:'rift-war',name:'RIFT WAR',art:'rift-war',rulesVersion:1,kicker:'THE TORN PLAIN · THREE-LANE WAR',
    tagline:'Push the lanes. Break their core.',goal:'Heroes against Villains. Lead your army through three lanes and destroy the enemy core.',
    win:'Break a lane’s towers and barracks, defeat the core guardians, then destroy the core.',
    facts:{players:'5 V 5',length:'~15–25 MIN',lives:'RESPAWNS'},
    howTo:['Fight alongside your grunts. Land the finishing blow for gold and stay near defeated enemies to gain experience.','Spend gold on equipment at your fountain. Recall returns you there after a channel; damage or movement interrupts it.','Push towers with your wave. Break barracks to strengthen your army, or rally for the Rift Guardian’s team blessing.'],
    panels:[art('rift-war','20% 50%'),art('rift-war','50% 50%'),art('rift-war','80% 50%')],
    variants:{offline:{label:'BOTS',card:'BOTS',tag:'YOUR TEAM + BOT RIVALS',onDevice:true,note:'A full 5 v 5 on this device. Pick your faction and pause any time.',go:'DEPLOY'},couch:{label:'COUCH',card:'COUCH',tag:'2 PLAYERS · SPLIT SCREEN',onDevice:true,note:'Player 2 on this device, the screen split in two: on your faction or leading the other. Bots fill both teams.',go:'DEPLOY'},online:{label:'ONLINE',card:'ONLINE',tag:'PUBLIC 5 V 5',note:'Find other fighters. Bots fill vacant seats when the queue countdown ends.',go:'FIND WAR'},friends:{label:'FRIENDS',card:'FRIENDS',tag:'PRIVATE 5 V 5',note:'Share a room code. Pick Heroes or Villains; bots fill the remaining positions.',go:'HOST WAR'}},
  },
  duel: {
    tagline: 'One rival. First to two.',
    // (1 November 2026: lock combat online - the strings line says how it plays, so the explainer is shown again.)
    id: 'duel', name: 'DUEL', art: 'duel', rulesVersion: 4, kicker: DUEL_KICKER,
    panels: [art('duel', '30% 30%'), { move: 'ultimate' }, art('duel', '75% 60%')],
    goal: 'One rival. Best of three. Win two rounds.',
    win: "Knock out your rival in two rounds to win the set.",
    facts: { players: '1 V 1', length: '~3–7 MIN', lives: 'FIRST TO TWO' },
    howTo: [
      '{target} locks the camera on your rival; press it again to let go.',
      // (One key and a count: four LIGHT buttons in a row ran a touch screen's panel four lines long.)
      // (2 November 2026, techniques: a string mixed with the stick's moves is worth more than one mashed.)
      '{light} strings; the stick with {light} or {heavy} makes a technique. Mix them: STYLE pays. Caught? {guard} as a round ends.',
      // The guard in the PARRY stream's own words (ui/guardGuide.ts): the pause key guide's line.
      `{guard} ${GUARD_HINT}.`,
    ],
    variants: {
      offline: { label: 'BOTS', card: 'BOTS', tag: 'ONE BOT RIVAL', onDevice: true, note: 'A bot rival on this device. Pause any time.', go: 'FIGHT' },
      couch: { label: 'COUCH', card: 'COUCH', tag: '2 PLAYERS · THIS DEVICE', onDevice: true, note: 'Player 2 on this device: a second controller, or the keyboard split in two. One shared camera, or the screen split in two. Pause any time.', go: 'FIGHT' },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'REAL PLAYERS ONLY', note: 'Matched with a real player. Never a bot.', go: 'FIND MATCH' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'PRIVATE 1 V 1', note: 'A private 1 v 1. Share the code; both of you pick a fighter.', go: 'HOST ROOM' },
    },
  },
  royale: {
    tagline: 'Last fighter standing wins.',
    id: 'royale', name: 'BATTLE ROYALE', art: 'players', rulesVersion: 3, kicker: 'EVERYONE AGAINST EVERYONE',
    panels: [art('players', '50% 35%'), { move: 'special' }, { move: 'ultimate' }],
    goal: 'Everyone against everyone. Last fighter standing wins.',
    win: 'Be the last one standing. One life each.',
    facts: { players: `4–${MAX_PLAYERS} FIGHTERS`, length: '~3–6 MIN', lives: 'ONE LIFE' },
    howTo: [
      // (9 October 2026: each KO heals its scorer - KO_HEAL - so the explainer is shown again, rulesVersion 3.)
      `Pick your fights: finish fighters who are hurt. Every KO heals you ${Math.round(KO_HEAL * 100)}%.`,
      'Stay in the action. Fighters who hide get hunted.',
      'Your meter carries from fight to fight. Save {ultimate} for the one that matters.',
    ],
    variants: {
      offline: { label: 'BOTS', card: 'BOTS', tag: 'BOTS IN EVERY SEAT', note: 'Fight bots on this device. Choose how many fighters and pause any time.', go: 'FIGHT', onDevice: true },
      couch: { label: 'COUCH', card: 'COUCH', tag: '2 PLAYERS + BOTS', note: 'Player 2 on this device, the screen split in two: you both drop in with the bots, and the last one standing wins.', go: 'FIGHT', onDevice: true },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'REAL PLAYERS + BOTS', note: `Real players first; bots fill the field to ${MIN_MATCH_FIELD} when the countdown ends.`, go: 'FIND MATCH' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'PRIVATE ROOM', note: 'Your room, your rules. Seats your friends leave empty are filled with bots.', go: 'HOST ROOM' },
    },
  },
  training: {
    tagline: 'Learn your fighter.',
    id: 'training', name: 'TRAINING GROUND', art: 'training', rulesVersion: 2, kicker: 'NO STAKES',
    panels: [{ move: 'special' }, art('training', '50% 30%'), { move: 'awakening' }],
    goal: 'Learn your fighter. No stakes.',
    win: 'Nothing to win: practise until it is second nature.',
    facts: { players: 'YOU + A DUMMY', length: 'NO CLOCK', lives: 'NO KNOCKOUTS' },
    howTo: [
      'Work down the move list. Each move ticks off when it lands.',
      'Open LABORATORY to choose your opponent, record a dummy sequence, or practise a punishment drill.',
      '{quick2} resets positions; {quick3} fills meters. The laboratory can slow or freeze combat and advance one frame.',
    ],
    variants: { offline: { label: 'SOLO', card: 'SOLO', tag: 'YOU AND A DUMMY', onDevice: true, note: 'You and a sparring dummy, on this device.', go: 'TRAIN' },
      couch: { label: 'COUCH', card: 'COUCH', tag: '2 PLAYERS · FACE TO FACE', onDevice: true, note: 'You and Player 2 on this device, face to face, each with your own move list. One shared camera, or the screen split in two.', go: 'TRAIN' } },
  },
  arcade: {
    tagline: 'Survive the endless horde.',
    id: 'arcade', name: 'ARCADE SURVIVAL', art: 'arcade', rulesVersion: 1, kicker: 'THE RIFT · ENDLESS HORDE',
    panels: [{ src: '/assets/survival/intro/2.webp', at: '50% 40%' }, art('arcade', '50% 30%'), { src: '/assets/survival/intro/4.webp', at: '50% 50%' }],
    goal: 'Hold the rift against an endless horde, round after round.',
    win: "Beat each round's guardian to go deeper. The run ends when you fall.",
    facts: { players: 'SOLO OR 2–4 CO-OP', length: '~10–30 MIN', lives: 'CO-OP REVIVES' },
    howTo: [
      'Clear the horde to fill the rift bar. When it is full, the guardian comes.',
      'Level up to choose a power. Spend skill points with {tree}.',
      'Chain knockouts and keep your style up to raise your score.',
    ],
    variants: {
      offline: { label: 'SOLO', card: 'SOLO', tag: 'YOUR OWN RUN', onDevice: true, note: 'Your run, on this device. Pause any time.', go: 'START RUN' },
      couch: { label: 'COUCH', card: 'COUCH', tag: '2-PLAYER CO-OP', onDevice: true, note: 'Two heroes on this device against the horde: a second controller, or the keyboard split in two. One shared camera, or the screen split in two.', go: 'START RUN' },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'JOIN A CO-OP PARTY', note: 'Join any open party; mid-run, you drop in between rounds.', go: 'FIND PARTY' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'CO-OP ROOM', note: 'Up to 4 fighters. Fall, and a friend can pick you back up.', go: 'HOST ROOM' },
    },
  },
  'last-stand': {
    tagline: 'Defend the gate, wave after wave.',
    id: 'last-stand', name: 'LAST STAND', art: 'last-stand', rulesVersion: 1,
    cover: '/assets/ui/objectives/last-stand-deployment.webp', kicker: LAST_STAND.kicker,
    panels: [art('last-stand', '50% 30%'), { src: '/assets/ui/objectives/last-stand-deployment.webp', at: '60% 70%' }, { src: '/assets/ui/objectives/defences.webp', at: '0% 50%' }],
    goal: LAST_STAND.goal,
    win: 'Hold as many waves as you can. The stand ends if the village falls or every defender is down.',
    facts: { players: '1–4 DEFENDERS', length: 'ENDLESS', lives: 'ALLIES REVIVE YOU' },
    howTo: [
      'Stop raiders before they reach the gate. The village bar is your life.',
      `Stand beside a fallen ally for ${RULES.rescueSeconds} seconds to revive them.`,
      'Kills earn shared funds. Spend them with the Quartermaster inside the gate ({interact}).',
    ],
    variants: {
      offline: { label: 'BOTS', card: 'BOTS', tag: 'BOT DEFENDERS', onDevice: true, note: 'You and three bot defenders, on this device.', go: 'DEPLOY' },
      couch: { label: 'COUCH', card: 'COUCH', tag: '2 DEFENDERS + 2 BOTS', onDevice: true, note: 'Defend the village together on this device, the screen split in two, with two bot defenders.', go: 'DEPLOY' },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'FIND A SQUAD', note: 'Defend with other players; bots fill empty seats.', go: 'FIND MATCH' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'PRIVATE ROOM', note: 'A private room. Share the code; you choose whether bots fill empty seats.', go: 'HOST ROOM' },
    },
  },
  'bad-blood': {
    tagline: 'Heroes vs empowered Villains.',
    id: 'bad-blood', name: 'BAD BLOOD', art: 'bad-blood', rulesVersion: 1,
    cover: '/assets/ui/objectives/bad-blood-deployment.webp', kicker: 'THE FALLEN CITADEL · TEAM ELIMINATION',
    panels: [{ src: '/assets/ui/objectives/bad-blood-deployment.webp', at: '70% 40%' }, art('bad-blood', '50% 30%'), { move: 'ultimate' }],
    goal: 'Three Heroes against three empowered Villains.',
    win: 'Knock out the whole other team.',
    facts: { players: '3 V 3', length: '~2–5 MIN', lives: 'HEROES RETURN ONCE' },
    howTo: [
      `Villains have ${villains}× power and one life.`,
      `A fallen Hero returns after ${revive} seconds, once. If every Hero is down at once, the Heroes lose.`,
      'Stick together and focus one target.',
    ],
    variants: {
      offline: { label: 'BOTS', card: 'BOTS', tag: 'BOTS ON BOTH SIDES', onDevice: true, note: 'Both teams filled with bots, on this device.', go: 'FIGHT' },
      couch: { label: 'COUCH', card: 'COUCH', tag: '2 PLAYERS + BOTS', onDevice: true, note: 'Player 2 on this device, the screen split in two: on your side or the other, by their fighter. Bots fill both teams.', go: 'FIGHT' },
      online: { label: 'ONLINE', card: 'ONLINE', tag: 'REAL PLAYERS + BOTS', note: 'Matched with other players; bots fill empty seats.', go: 'FIND MATCH' },
      friends: { label: 'FRIENDS', card: 'FRIENDS', tag: 'PRIVATE ROOM', note: 'A private room for up to six, three a side.', go: 'HOST ROOM' },
    },
  },
};

gateModes(MODES);

/** Today's home cards (MangaHome HOME_MODES) folded into the catalogue: the three battle royale cards are one mode. */
export const MODE_OF_HOME: Readonly<Record<HomeMode, { mode: ModeId; variant?: VariantId }>> = {
  // Overnight UX (8 October 2026): the rail's Battle Royale card (legacy id 'bots') opens on the way used last, as every
  // other card does; pinned to BOTS, a player back from a friends room or ONLINE ("server updated, press PLAY") was put
  // on BOTS. A first visit still opens on BOTS, the first way.
  duel: { mode: 'duel' }, players: { mode: 'royale', variant: 'online' }, bots: { mode: 'royale' },
  private: { mode: 'royale', variant: 'friends' }, training: { mode: 'training' }, arcade: { mode: 'arcade' },
  'last-stand': { mode: 'last-stand' }, 'bad-blood': { mode: 'bad-blood' }, 'rift-war': {mode:'rift-war'},
  'goal-rush': { mode: 'goal-rush' }, 'sky-spike': { mode: 'sky-spike' },
};

/** Which mode a running match is (`survival`: the arcade's run is on, solo or co-op). */
export function modeOfSnapshot(snapshot: GameSnapshot, survival: boolean): ModeId {
  if (survival) return 'arcade';
  if (riftOf(snapshot)) return 'rift-war';
  const ball = ballOf(snapshot);
  if (ball) return ball.mode;
  const objective = objectiveOf(snapshot);
  if (objective) return objective.kind;
  if (snapshot.roomMode === 'training') return 'training';
  if (snapshot.lobby?.duel) return 'duel';
  return 'royale';
}

const phoneModes = new Map<ModeId, ModeInfo>();
export function modeHere(mode: ModeId): ModeInfo {
  const info = MODES[mode];
  if (!info.variants.couch || !phone()) return info;
  let mine = phoneModes.get(mode);
  if (!mine) { const { couch: _couch, ...variants } = info.variants; mine = { ...info, variants }; phoneModes.set(mode, mine); }
  return mine;
}
