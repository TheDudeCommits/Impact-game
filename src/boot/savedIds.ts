/** This browser's own records read through the renamed ids' table once, before
 *  anything reads them (src/game/savedIds.ts): a record kept under an id as it was - the account's copy, Arcade's records, a
 *  Forge draft, a setting - is moved to the id it is now. */
import { currentStorage } from '../game/savedIds';

try { if (typeof localStorage !== 'undefined') currentStorage(localStorage); } catch { /* no storage (a private window): nothing kept to read */ }
