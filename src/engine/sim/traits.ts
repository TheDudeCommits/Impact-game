import { AIR_NORMAL_FIGHTERS } from '../../game/moves';
import type { AttackSlot, FighterId } from '../../game/types';

export interface BodyTraits {
  /** Its melee moves with an authored lunge still drive in only through the last stride before the blow, as a move
   *  with no authored lunge does. */
  driveMelee?: true;
  /** A melee cast locks its lunge onto the target when one stands close in front (Taisei's Rock and Cloudstep). */
  lockNearMeleeLunge?: true;
  /** Its melee blows send no `release` event: the body's own effects draw them (Taisei's, Konta's). */
  quietMeleeRelease?: true;
  /** Off the floor, its normals are air normals drawn with its own rig. */
  airNormals?: true;
  /** Awakened, it has no air normals: its awakened moves are its spirit's own (KoKo's Iron Spirit). */
  awakenedOwnMoves?: true;
  /** Openers played whole wherever they start, never as air normals: every slot ('all'), or these slots. */
  groundedOpeners?: 'all' | readonly AttackSlot[];
}

const DRIVE_MELEE: readonly FighterId[] = ['kusushi', 'wataame', 'shirokane', 'shiden', 'kenzo', 'nigo', 'kosho', 'kuzu', 'shakugo', 'mikage', 'tempo'];

const TRAITS: Partial<Record<FighterId, BodyTraits>> = {};
const add = (ids: readonly FighterId[], traits: BodyTraits) => { for (const id of ids) TRAITS[id] = { ...TRAITS[id], ...traits }; };
add(DRIVE_MELEE, { driveMelee: true });
add(AIR_NORMAL_FIGHTERS, { airNormals: true });
add(['taisei'], { lockNearMeleeLunge: true, groundedOpeners: 'all' });
add(['taisei', 'konta'], { quietMeleeRelease: true });
add(['koko'], { awakenedOwnMoves: true });
add(['oro'], { groundedOpeners: ['heavy'] });
for (const traits of Object.values(TRAITS)) Object.freeze(traits);

const NONE: BodyTraits = Object.freeze({});
/** A body's traits; none for a body that has none. */
export const traitsOf = (id: FighterId): BodyTraits => TRAITS[id] ?? NONE;
/** Every body that has a trait, for the registry and the tests. */
export const BODY_TRAITS: Readonly<Partial<Record<FighterId, BodyTraits>>> = TRAITS;
