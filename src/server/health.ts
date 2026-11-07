import { ROSTER_PROTOCOL } from '../game/rosterProtocol';
import {SURVIVAL_PROTOCOL} from '../survival/coopNet';
import {RIFT_PROTOCOL,RIFT_RULES} from '../game/moba/model';
import {OBJECTIVE_PROTOCOL} from '../game/objectives/model';
import { LIGHT_CHASE_WINDOW, MOVES, RUSH, RUSH_STAGES, RUSH_WINDOW, SIMULATION_HZ, SNAPSHOT_HZ } from '../game/moves';
import type { FighterId } from '../game/types';
import { errorCounts } from './ops/errorCounts';

/** v21 (7 October 2026): the combo-era stamina bar - Duel, Training, the royale and Bad Blood at 150 (COMBO_STAMINA). */
/** v22 (8 October 2026): Gummy's GRAND TIDE opens with SUNRISE's stretched grab and lands to 10.5 m (PR #101). */
/** v23 (8 October 2026): ground hits - a fighter down on the floor is hit (a normal for GROUND_HIT_SCALE, an ultimate whole), getting up dodges normals only, `floorUntil` rides the reaction keys. */
/** v24 (8 October 2026): ground hits 2 - each ground hit of one stay on the floor worth less, the stay a budget of 5.5% of health (`floorHits`, `floorTaken` ride the reaction keys); Kuon's Flying Kick thrown inside his dome. */
/** v25 (8 October 2026): Ward's THEATRE: Flatline opens with Crossmatch, a swap into touch range inside an 11 m ROOM (PR #112). */
/** v26 (8 October 2026): Taisei's, Konta's, Kagari's and Emperor Jinlin's bombs aimed as they leave the hand and following in flight (PR #117). */
/** v28: Rift authority and shared external-target allegiance/prediction (PR #129). */
/** v29: authored Rift terrain, shifted lane defenses and shared landscape collision. */
/** v31: reconciled Rift evolution, lane barriers, army progression and relic mastery. Client/server pair. */
/** v32 (10 October 2026): hit rate - the rooms' lag compensation (inputs carry `view`; ArenaSimulation.rewind), the
 *  rising strike at a fighter in the air, the step-in and steering kept while chasing and through the active frames,
 *  and every shot aimed as it is let go (scripts/combat/kite_hitrate.mts). */
/** v33 (10 October 2026): parry for people - the Perfect Parry's window 0.16 -> 0.25 s and its whiff lockout 0.45 ->
 *  0.7 s (moves.ts); bots parry no sooner than a person could react to the swing and aim just before the blow with a
 *  person's spread (BOT_REACTION, BOT_PARRY_LEAD), and a bot's block or turtle never opens a parry window
 *  (scripts/combat/parry_humans.mts). */
/** v36 (10 October 2026): statuses (VOL.3 part two): a landed finisher may leave a burn, a slow or a freeze
 *  (MoveDefinition.status, ArenaSimulation.afflict); no roster move carries one yet, the Forge offers them. */
/** v37 (10 October 2026): Magatsu's Mirror Mere is a dome as Kuon's PLANETARIUM is (TIME_STOP_TOURS'
 *  `domain`): a wall is no shelter as it closes, whoever walks in while it stands is caught, and every grunt inside is
 *  struck as it opens. (v34 is PR #96's.) */
/** v40 (11 October 2026): the fighter review's first batch (Taisei, Konta, Gummy, Kenzo, Kosho) - each fighter's own area
 *  move (src/engine/sim/areaMoves.json) and its Armory look (houseKits.json). */
/** v41 (11 October 2026): the fighter review's second batch (Ouga, Shirokane, Shiden, KoKo, Nigo) - their own area
 *  moves and looks. */
/** v42 (11 October 2026): the fighter review's third batch (LORD ORO, Setsu, Kagari, Ward, Kuon) - their own area moves and
 *  looks. */
/** v43 (11 October 2026): the fighter review's fourth batch (Gaunt, Tobari, Bellows, Shakugo, Shidare) - their own area
 *  moves and looks. */
/** v44 (11 October 2026): area moves deal twice what they did (a second, skill-based ultimate, under the ultimates),
 *  strike when their looks strike (areaStrikes.json, the total split across them), and deal the most at the centre:
 *  all of it in the bullseye, half at the rim. Release and impact events carry `look` and `strikes`, hits `bullseye`. */
/** v45 (11 October 2026): the fighter review's fifth batch (Ume, Lanthorn, Highsun, Torsion, Kubiwa) - their own
 *  area moves - and the reviewed area moves' totals set for v44 (their strikes left to their looks). */
/** v46 (11 October 2026): the fighter review's sixth batch (Onigawara, Minase, Psyche, Hawser) - their own area moves
 *  and looks. */
/** v47 (11 October 2026): the fighter review's seventh batch (Rotfalke, Bonsho, Murex, Kinu, Madake) - their own area
 *  moves and looks - and every area move's G card name (AreaSpec.card). */
/** v48 (11 October 2026): the fighter review's eighth batch (Akayuri, Hisame, Mizuhiki, Alphonse) - their own area
 *  moves and looks. */
/** v49 (11 October 2026): the fighter review's ninth batch (Rakucho, Irbis, Hinomoto, Amagoi, Shakudo) - their
 *  own area moves and looks. */
/** v50 (11 October 2026): the fighter review's tenth batch (Hikui, Tokan, Strappado, Unari, Barrow) - their own area
 *  moves and looks. */
/** v51 (11 October 2026): the fighter review's eleventh batch (Sashigane, Gosu, Kusushi, Hakushi, Suzuran) - their own
 *  area moves and looks. */
/** v52 (11 October 2026): the fighter review's twelfth batch (Wataame, Senko, Buna, Oyashio, Adad) - their own area
 *  moves and looks. */
/** v53 (11 October 2026): the fighter review's thirteenth batch (Shijima, Akaito, Tempo, Tancho, Mikage) - their own
 *  area moves and looks. */
/** v54 (11 October 2026): the fighter review's fourteenth batch (Full Beam, Pyroclast, Ampere, Shanxiao, Kuzu) - their own area
 *  moves and looks. */
/** v55 (11 October 2026): the fighter review's fifteenth batch (Basilissa, Sorayomi, Strix, Gorai, Haldor) - their own
 *  area moves and looks. */
/** v56 (11 October 2026): Hagure, monster Ovid and Yodaka manual kits, authored areas and native contact timing; all fighter-review batch15 changes retained. */
/** v57 (11 October 2026): the fighter review's sixteenth batch (Sorrel, Dorado, Shiun, Magatsu, Vesper) - their own area
 *  moves and looks. */
/** v58 (11 October 2026): the fighter review's seventeenth batch (Imago, Wuming, Jirenga, Emperor Jinlin, Gohaku) -
 *  their own area moves and looks. */
/** v59 (11 October 2026): the fighter review's eighteenth batch (Ippon, Sekka, Akagane, Asahi, Levin) - their own area
 *  moves and looks. */
/** v60 (11 October 2026): the fighter review's last batch (Rook, Gaku) - their own area moves and looks. */
/** v65 (12 October 2026): the start of a fight - startMatch turns every seat to face its closest opponent (a person's
 *  starting yaw; bots re-aim on their first think, so the golden baseline does not move). */
/** v66 (12 October 2026): Training's switch - a Training room swaps a fighter or the sparring opponent in place on a
 *  command (ArenaSimulation, TrainingLab). Only a Training room takes it, so the golden baseline does not move; the
 *  area looks' settings in houseKits.json changed with it and move nothing either. */
/** v70 (23 October 2026): the dream loop's throw. A combo ender's struck body is held at most 0.04 s (moves.ts
 *  BIG_ENDER_HOLD; a rush finisher's keeps its hold) where it was held 0.15-0.2, and a true launch throws its body ahead of its arc, back on it
 *  at the top (LAUNCH_LEAD): its flight, top and landing as they were. The hit that throws it says its lift
 *  (CombatEvent.lift), which the client times the tumble by. A v69 client would draw the throw a beat late. */
/** v71 (24 October 2026): the dream loop's slam. A spike (moves.ts `knock`) on a body standing drives it into the floor
 *  where it stands - no lift, its push cut to 0.45, down from the next tick for the move's own time - and strikes the
 *  floor there at once (a 'ground-bounce' event at the blow): it was thrown up and back first and bounced two metres
 *  off. Taisei's, Konta's, Kosho's, KoKo's and Lord ORO's Light x3 + Heavy, and an air spike landing on a standing body. In
 *  the air a spike drives the body into its bounce as before. A v70 client would predict the old throw. */
/** v72 (24 October 2026): the dream loop's air strike. A blow that spikes a body already in the air (the outcome
 *  groundBounce: every fighter's air strike, a rush finisher's spike) drives it at the floor at 16 m/s (moves.ts
 *  AIR_SPIKE_DRIVE) where it drifted down at 6: from an air string's height it reaches the floor in 15 ticks, not 26,
 *  and bounces as before. A v71 client would predict the old drift. */
/** v73 (24 October 2026): two new places and the online Duel's rotation. Dry Harbour and Thornwood Ward at Night join the royale's
 *  deck (src/game/stages.ts ROYALE_STAGES) with their own walls and cover, and an online Duel is dealt the duelling rings in
 *  turn (ONLINE_DUEL_STAGES) instead of always the tournament ring: a page from before them would be sent a stage it has
 *  never heard of. */
/** v74 (24 October 2026): three more places and planned bots. Kuroyuki Hall and the Starfall Crater join the royale's deck,
 *  and another ring the duelling rings and the small royales' rings; and a public match drafts its bots as its countdown starts and says whom (`planned-bots`,
 *  ArenaRoom.planBots), so its pages fetch them meanwhile and a lone page's match on the device keeps them. A page from
 *  before them would be sent a stage it has never heard of. */
export const MOVEMENT_PROTOCOL = 'omni-sequenced-input-v79-techniques';

const timing = (move: { duration: number; contacts: number[] }) => ({ duration: move.duration, contacts: move.contacts });

/** What /health answers: the protocol, the clocks, and every move's timing -
 *  each fighter's rush stages included, under `rush` - so a probe can tell a
 *  stale server from the one it was built against. It lives here rather than
 *  in index.ts because index.ts starts listening the moment it is imported. */
export function healthReport(revision = process.env.BUILD_REVISION ?? 'local') {
  return {
    rosterProtocol:ROSTER_PROTOCOL,
    riftWar:true,riftProtocol:RIFT_PROTOCOL,riftSnapshotHz:RIFT_RULES.snapshotHz,
    survivalProtocol:SURVIVAL_PROTOCOL, duel:true, duelProtocol:1, objectiveModes: ['bad-blood','last-stand'], objectiveProtocol: OBJECTIVE_PROTOCOL, partyProtocol:1, customRooms:true, assetGate:true,
    ok: true, game: 'impact', movementProtocol: MOVEMENT_PROTOCOL, revision, room: 'arena',
    // Errors seen lately, the server's own and the pages' reports: counts only, never a message (ops/errorCounts.ts;
    // the uptime check reads them, .github/workflows/uptime.yml).
    errors: errorCounts(),
    simulationHz: SIMULATION_HZ, snapshotHz: SNAPSHOT_HZ, rushStages: RUSH_STAGES, rushWindow: RUSH_WINDOW,
    lightChaseWindow: LIGHT_CHASE_WINDOW,
    combatTimings: Object.fromEntries((Object.keys(MOVES) as FighterId[]).map(fighter => [fighter, {
      ...Object.fromEntries(Object.entries(MOVES[fighter]).map(([slot, move]) => [slot, timing(move)])),
      rush: RUSH[fighter].map(timing),
    }])),
  };
}
