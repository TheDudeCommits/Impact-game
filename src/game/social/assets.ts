import type {GameSnapshot} from '../types';
/** Stable signature of assets needed by this roster, independent of health, positions and event traffic. */
export const assetSignature=(s:GameSnapshot)=>`${s.stage??'harbor'}:${[...new Set(s.players.filter(p=>!p.enemy).map(p=>p.fighter))].sort().join(',')}`;
