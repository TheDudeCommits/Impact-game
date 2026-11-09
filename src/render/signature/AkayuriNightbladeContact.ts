/** What the engine asks of AkayuriNightblade.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). AkayuriNightblade.ts re-exports it. */

export const AKAYURI_BLADE = { root: [-.015, .13500000536441803, .010], tip: [-.01509892135858535767, .9346148371696472, .06012013018131256] } as const;
