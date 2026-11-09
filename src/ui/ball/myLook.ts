import { owns } from '../../game/economy/account';
import { lookOfWorn, type BallLook } from '../../game/ball/look';
import { account } from '../shop/account';

/** The ball gear this browser's account wears and owns (game/ball/look.ts), for a match played on this device: a room
 *  online reads it off the account itself. */
export const myBallLook = (): BallLook | undefined => { const a = account.account; return lookOfWorn(a?.worn, id => owns(a, id)); };
