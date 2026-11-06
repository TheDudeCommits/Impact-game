import { inPlayerTwo, inviteLink } from '../../boot/playerTwo';
import { GAME_URL, inviteNow, prefetchInvite } from '../../social/invite';
import { joinableNow } from '../../social/presence';

let playerTwoLink: string | undefined, asked = false;
/** Player Two's links, asked for now so the press has them. Nothing outside Player Two. */
export function prefetchResultLink() {
  const join = joinableNow();
  if (join) prefetchInvite(join);
  if (!inPlayerTwo() || asked) return;
  asked = true;
  void inviteLink({}, GAME_URL).then(link => { playerTwoLink = link; });
}
export function resultLink(): string {
  const join = joinableNow(), room = join && inviteNow(join);
  if (room) return room;
  return inPlayerTwo() ? playerTwoLink ?? GAME_URL : GAME_URL;
}
