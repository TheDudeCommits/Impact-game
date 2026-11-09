/** What the engine asks of ShidareSteelPetalCut.ts outside its effect layer (where a blow
 *  lands: engine/client/sockets.ts, render/Fighter.ts, render/AreaTelegraph.ts), moved out of it unchanged, so that the layer is
 *  fetched only with a room that has the fighter (RosterSignatureSet's lazy factories). ShidareSteelPetalCut.ts re-exports it. */

/** Actual native Sword-bone local blade points from the frozen source mesh.
 * The source joint drives the deliberate awakening drop; do not attach this
 * trail to an unrelated hand proxy. */
export const SHIDARE_BLADE={root:[0,.085,0],tip:[-.05817198056684819,1.0146408727799212,-.11819259418722794]}as const;
