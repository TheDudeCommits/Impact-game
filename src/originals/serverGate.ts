import './launch';
import { DUEL_FALLBACK, FALLBACK_STAGE, launchStage, modeOpen, partyModeOpen, stageSafe } from './launch';
import { SERVER_GATE } from './server';

const MODE_NAME = { arcade: 'Arcade Survival', 'last-stand': 'Last Stand', 'bad-blood': 'Bad Blood' } as const;

Object.assign(SERVER_GATE, {
  // A place the gate has not cleared is swapped for the client's own fallback: a Duel's is the citadel's courtyard, any
  // other room's the harbour.
  roomStage: (stage, duel = false) => launchStage(stage, duel ? DUEL_FALLBACK : FALLBACK_STAGE),
  // A royale whose field one series brings stays where it was dealt unless that series' place is cleared.
  movedStage: (stage, current) => stage && stageSafe(stage) ? stage : current,
  closedMode: mode => modeOpen(mode) ? undefined : `${MODE_NAME[mode]} is not open yet.`,
  partyModeAllowed: mode => partyModeOpen(mode),
} satisfies typeof SERVER_GATE);
