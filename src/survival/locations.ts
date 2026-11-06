/** Where a run is fought: the rift's last stands, one every few rounds, each
 *  a stage built in code (src/render/rift) with its own ground, weather and
 *  ruin. Data only: the match server reads it to know which floor it is on. */
import type { StageId } from '../game/stages';
import { loopOf } from './bosses';

export interface LocationDefinition {
  id: string;
  stage: StageId;
  name: string;
  /** The line under the name on the location card. */
  subtitle: string;
  kanji: string;
  /** The chapter card's narration: the first time the run comes here, and
   *  every time after, when the rift has had it longer. */
  line: string; again: string;
}

/** The run's road: ranks F and E in the Burning Village, D and C on the Hill
 *  of Swords, B and A at the Black Fortress, and S - the climax - at the
 *  Eclipse. Past S the Rift drags the fight round all four again, two rounds
 *  in each, deeper every time round. */
const ROAD = [{ place: 0, rounds: 4 }, { place: 1, rounds: 4 }, { place: 2, rounds: 4 }, { place: 3, rounds: 2 }] as const;
export const RIFT_ROUNDS_PER_PLACE = 2;
/** The last round of the road: its boss falling seals the rift (for now). */
export const FINAL_ROUND = ROAD.reduce((sum, leg) => sum + leg.rounds, 0);

export const LOCATIONS: readonly LocationDefinition[] = [
  { id: 'burning-village', stage: 'rift-village', name: 'The Burning Village', subtitle: 'Where the sky first tore open', kanji: '焼村',
    line: 'The rift opened here first. Nobody in this village saw the morning.', again: 'The fires never went out. Something is still feeding them.' },
  { id: 'hill-of-swords', stage: 'rift-swords', name: 'The Drowned Armoury', subtitle: 'Where an army lay down in the water', kanji: '沈甲',
    line: 'A whole army drowned here in its armour. The rift is calling it back up.', again: 'The water has gone down. There are more helms showing than there were.' },
  { id: 'black-fortress', stage: 'rift-fortress', name: 'The Black Fortress', subtitle: 'The last wall between the dark and the living', kanji: '黒砦',
    line: 'The last wall between the dark and the living. It is already falling.', again: 'The wall fell. Whatever holds the gate now is not human.' },
  { id: 'the-offering', stage: 'rift-eclipse', name: 'The Fallen Star', subtitle: 'Where the rift threw down a star', kanji: '堕星',
    line: 'The rift tore a star out of the sky and chained it here. It is not quite dead.', again: 'The chains have slipped. The star is burning hotter than you left it.' },
  { id: 'frozen-shrine', stage: 'rift-frost', name: 'The Frozen Shrine', subtitle: 'Where the last prayers froze', kanji: '凍社',
    line: 'The priests prayed for the rift to close. The cold answered instead.', again: 'The ice has grown. Some of the statues were not statues before.' },
  { id: 'crimson-grove', stage: 'rift-grove', name: 'The Crimson Grove', subtitle: 'Bamboo that drinks blood', kanji: '血竹',
    line: 'The bamboo here grows red. Nobody who came to find out why walked back out.', again: 'The grove is thicker than you left it. It has been fed.' },
  { id: 'ashen-wastes', stage: 'rift-wastes', name: 'The Ashen Wastes', subtitle: 'Where the old gods fell', kanji: '灰原',
    line: 'Something older than the rift died here. The rift wears its bones.', again: 'The ash is still warm. The god is not as dead as it looks.' },
  { id: 'drowned-harbor', stage: 'rift-harbor', name: 'The Drowned Harbor', subtitle: 'The tide brought the dead back in', kanji: '沈港',
    line: 'The sea took the harbour in a single night. The tide brings back what it took.', again: 'The water is higher. The wrecks are closer. Their crews are coming ashore.' },
];

export function dungeonOrder(seed: number, rounds = 64): number[] {
  let s = (Math.floor(seed) % 2147483646 + 2147483646) % 2147483646 + 1;
  const random = () => { s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
  const order: number[] = [];
  while (order.length < rounds) {
    const deck = LOCATIONS.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
    if (order.length && deck[0] === order[order.length - 1]) [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
    order.push(...deck);
  }
  return order;
}

/** The dungeon a round is fought in, for a run's seed: `index` is the round
 *  less one (the dungeon's number on the road), `loop` how many times the
 *  Rift has dragged the party round since S. */
export function dungeonFor(seed: number, round: number) {
  const r = Math.max(1, Math.floor(round));
  const place = dungeonOrder(seed, r)[r - 1];
  return { location: LOCATIONS[place], index: r - 1, loop: loopOf(r), first: true, progress: 0 };
}

/** The place a round is fought; which stop on the road it is (`index`, one
 *  more for every place the run has come to); how many times the Rift has
 *  dragged it round them all since S (`loop`); whether it is the first round
 *  there (the run travels before it); and how far into its stay (`progress`,
 *  0 on arrival, 1 on its last round). */
export function locationFor(round: number) {
  const r = Math.max(1, Math.floor(round));
  let start = 1;
  for (let i = 0; i < ROAD.length; i++) {
    const leg = ROAD[i];
    if (r < start + leg.rounds) {
      const step = r - start;
      return { location: LOCATIONS[leg.place], index: i, loop: 0, first: step === 0, progress: leg.rounds > 1 ? step / (leg.rounds - 1) : 1 };
    }
    start += leg.rounds;
  }
  const past = r - start, stop = Math.floor(past / RIFT_ROUNDS_PER_PLACE), step = past % RIFT_ROUNDS_PER_PLACE;
  return { location: LOCATIONS[stop % LOCATIONS.length], index: ROAD.length + stop, loop: 1 + Math.floor(stop / LOCATIONS.length), first: step === 0,
    progress: step / (RIFT_ROUNDS_PER_PLACE - 1) };
}
