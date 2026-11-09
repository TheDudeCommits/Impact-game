/** What the engine asks of RotfalkeField.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). RotfalkeField.ts re-exports it. */

export const ROTFALKE_KNIFE = { root: [0, .17, 0], tip: [-.049, .80, 0] } as const;
