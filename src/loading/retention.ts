import { phone } from '../input/device';

/**
 * What a page keeps of the rooms it has played (launch night, 12 October 2026: "the heap a page gains per match").
 *
 * Measured with scripts/night/load_hitches.mjs `chain --gc` (five twelve-fighter matches in one page, a full collection
 * forced before each reading): the growth is retained, not garbage - the heap at the home screen after a collection went
 * 68, 167, 225, 257, 289, 326 MB. It is whole fighters (the library cached every one it ever loaded on a strong machine:
 * 25, 32, 39, 45, 50 of them), the Armory's effect pools (16 to 46 effects, 72 to 222 instances, 5,900 to 15,200 scene
 * objects), and the decoded sound of every fighter ever in a room (404 to 1,010 buffers, 78 to 204 MB, off the heap).
 */

/** How many fighters a strong machine's library keeps whole between rooms: this room's twelve and the last room's, so a
 *  rematch (or the same party again) loads nothing. Anything else beyond it goes, the longest unused first
 *  (FighterLibrary.evict); the room's own fighters and the selected one never do. Other machines keep sixteen. */
export const LIBRARY_STRONG = 24;
/** Every other machine keeps sixteen; a phone six (the phone pass, November 2026: "iOS memory"). A fighter kept whole is
 *  its parsed model and clips (1.6-3 MB of heap) and its decoded images (three keeps them to rebuild a lost context): on a
 *  phone, whose tab is closed at about a gigabyte, the ten past six are 60-150 MB held for a rematch that would load them
 *  again from the browser's cache in a second or two. The room's own fighters and the selected one are kept whatever the
 *  cap (FighterLibrary.evict). */
export const LIBRARY = 16, LIBRARY_PHONE = 6;
/** The library's cap for this machine: `strong` the governor's strong machine on mains power (ResolutionGovernor.relaxed),
 *  `small` a phone (input/device.ts). */
export const libraryCap = (strong: boolean, small = phone()) => strong ? LIBRARY_STRONG : small ? LIBRARY_PHONE : LIBRARY;

/** Training's switch (main.ts `trainingBench`): how many of the fighters a Training session has just switched away from
 *  keep their bodies on the graphics card, beside the two in the room - so PREVIOUS after NEXT, or the fighter tried a
 *  moment ago, is back in a frame instead of an upload (some hundred milliseconds of images a few a frame). A body is
 *  about one to three 2048 px images on the card: four of them on a strong machine, two elsewhere; the rest are let go
 *  as every room's absent bodies are (FighterLibrary.releaseGpu) and stay whole in the library (LIBRARY_STRONG). */
export const TRAINING_BENCH_STRONG = 4, TRAINING_BENCH = 2;
