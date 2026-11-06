import { BOSS_LINES } from './bossLines';

type Moment = 'entrance' | 'rage' | 'hurt' | 'defeat' | 'attack';
type OwnLines = Partial<Record<Moment, string[]>> & { moves?: Record<string, string[]> };
export const ORIGINAL_BOSS_LINES = BOSS_LINES as Readonly<Record<string, OwnLines>>;

export function applyOriginalBossVoices(own: Record<string, unknown>, voices: Record<string, { timbre: string; pitch: number; own?: Partial<Record<Moment, readonly string[]>>; moves?: Record<string, readonly string[]> }>) {
  for (const id of Object.keys(own)) delete own[id];
  if (voices.kurobi?.timbre === 'fox') voices.kurobi.timbre = 'beast';
  if (voices.lumen) voices.lumen.pitch = 1.32;
  for (const [id, lines] of Object.entries(ORIGINAL_BOSS_LINES)) {
    const voice = voices[id];
    if (!voice) continue;
    const { moves, ...moments } = lines;
    voice.own = Object.fromEntries(Object.entries(moments).map(([moment, urls]) => [moment, [...urls as string[]]]));
    if (moves) voice.moves = Object.fromEntries(Object.entries(moves).map(([move, urls]) => [move, [...urls]]));
  }
}

export const ORIGINAL_GRUNT_BODIES: Readonly<Record<string, string>> = {
  // (modes-hordes, 4 November 2026: the Last Sun's three and the Automaton have bodies of their own now, OWN_GRUNT_MODELS.)
  'great-wraith': 'apostle-spawn', 'white-pale-sapling': 'husk',
};

const MOTION = (file: string) => `/assets/survival/motion/grunt-${file}.glb`;
const MODES_HORDES: Readonly<Record<string, string>> = {
  'tribunal-guard': MOTION('salt-guard'), 'tribunal-guard-rifle': MOTION('salt-rifleman'), automaton: MOTION('salt-engine'),
  'beast-pirate': MOTION('graft-raider'), 'beast-graft-brute': MOTION('graft-brute'), 'beast-leaper': MOTION('graft-leaper'),
  'beast-medic': MOTION('graft-doctor'),
  saibaman: MOTION('sun-imp'), 'brood-spawn': MOTION('sun-brood'), 'jinlin-soldier': MOTION('sun-trooper'), 'jinlin-sniper': MOTION('sun-sniper'),
};

export const OWN_GRUNT_MODELS: Readonly<Record<string, string>> = {
  'rogue-ninja': '/assets/survival/motion/grunt-cutthroat.glb', 'ash-wraith': '/assets/survival/motion/grunt-ash-wraith.glb',
  'hollow-void-ray': '/assets/survival/motion/grunt-ash-caster.glb', 'chess-soldier': '/assets/survival/motion/grunt-iron-warden.glb',
  ...MODES_HORDES,
};
/** horde/modelLooks.ts: a body of those four is a Tripo troop's, drawn natively and with its kind's gear in its hands. */
export const ownGruntModel = (url: string) => Object.values(OWN_GRUNT_MODELS).includes(url);

export const WITHHELD_GRUNT_FILES = ['rogue-ninja', 'hollow-void-ray', 'chess-soldier', 'tribunal-guard', 'tribunal-guard-rifle', 'beast-pirate', 'beast-graft-brute']
  .map(kind => `assets/survival/motion/grunt-${kind}.glb`);

/** src/render/horde/modelLooks.ts MODEL_LOOKS: every kind that wore one of those bodies (its own, or one worn through
 *  horde/kinds.ts WEARS) wears its own original body, or its stand-in's (a stand-in that has a body of its own now
 *  passes that on: the Tusker, in the Graft Brute's). */
export function applyOriginalGruntBodies(looks: Partial<Record<string, string>>, wears: Readonly<Record<string, string>>) {
  const url = (kind: string) => { const body = ORIGINAL_GRUNT_BODIES[kind] ?? kind; return OWN_GRUNT_MODELS[body] ?? looks[body]; };
  for (const kind of Object.keys(looks)) {
    const own = OWN_GRUNT_MODELS[kind] ?? OWN_GRUNT_MODELS[wears[kind]];
    if (own) { looks[kind] = own; continue; }
    const body = ORIGINAL_GRUNT_BODIES[kind] ? kind : wears[kind] && ORIGINAL_GRUNT_BODIES[wears[kind]] ? wears[kind] : undefined;
    if (body) looks[kind] = url(body);
  }
}
