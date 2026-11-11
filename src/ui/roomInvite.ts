export type RoomInvite={kind:'private'|'coop'|'duel';code:string};
/** A hash carries only the invitation, never account tokens or player names. */
export function inviteUrl(invite:RoomInvite,base=location.href){
  const url=new URL(base);url.search='';url.hash=new URLSearchParams({room:invite.code,kind:invite.kind}).toString();return url.href;
}
/** (A link made here follows the page's own address, wherever the game is played; a bare `#room=...` is read against the
 *  page's own address too.) */
export function readInvite(value:string):RoomInvite|null{
  try{
    const url=new URL(value,typeof location==='object'?location.href:'http://localhost/');
    const params=new URLSearchParams(url.hash.slice(1)),code=params.get('room'),kind=params.get('kind');
    return code&&/^\d{6}$/.test(code)&&(kind==='private'||kind==='coop'||kind==='duel')?{code,kind}:null;
  }catch{return null;}
}
