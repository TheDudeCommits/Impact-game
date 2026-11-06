import OWN from './ownArt.json';
import { ORIGINAL_IDS } from './roster';

interface OwnArt { busts: Record<string, string>; areaCards: Record<string, string>; modeTiles: Record<string, string> }
export const OWN_ART = OWN as OwnArt;

export const ownAreaCard = (sheet: string) => `${sheet}.webp` in OWN_ART.areaCards;

export const areaCardWithheld = (sheet: string) => ORIGINAL_IDS.some(id => sheet === id || sheet.startsWith(`${id}-`)) && !ownAreaCard(sheet);
