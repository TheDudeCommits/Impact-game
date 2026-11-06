import { HALO } from './halo';
import type { ProtoId, ProtoSkin, Side } from './proto';

export const PROTOS: readonly ProtoSkin[] = [HALO];
export const PROTO_IDS: readonly ProtoId[] = PROTOS.map(p => p.id);
/** Every prototype's plate for one side (inked.ts puts them in the plate containers; each shows under its own skin). */
export const protoPlatesHtml = (side: Side) => PROTOS.map(p => p.plate(side)).join('');
/** Every prototype's clock (Hud.ts puts them beside the default one). */
export const protoClocksHtml = () => PROTOS.map(p => p.clock()).join('');
export { ProtoHud } from './proto';
