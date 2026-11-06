import type { FighterId } from '../../game/types';
import { fighterArt, HOME_FIGHTERS } from '../MangaHome';
import { posePoster } from '../HomePreview';

/** Use the full-size fighter art, rather than enlarging the small roster atlas. */
export const resultFighterArt = (fighter: FighterId) => HOME_FIGHTERS.includes(fighter) ? fighterArt(fighter) : posePoster(fighter);
