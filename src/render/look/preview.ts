import { STAGES, type StageId } from '../../game/stages';

/** Dev preview only: `?look=<stageId>` draws that stage - its scenery and its
 *  look - in place of whichever themed stage the server chose, which in
 *  training is always the training hall. It exists so the per-stage lighting can
 *  be judged without assembling a matchmade lobby of the right series. Only
 *  what is drawn changes: the simulation, the collision and the prediction all
 *  stay on the server's stage. The harbour is never substituted, because it
 *  is the lobby and main.ts owns its visibility. Stripped from production
 *  builds by the DEV guard. */
export function previewStage(stage: StageId): StageId {
  if (!import.meta.env?.DEV || typeof location === 'undefined' || stage === 'harbor') return stage;
  const wanted = new URLSearchParams(location.search).get('look');
  return wanted && wanted !== 'harbor' && wanted in STAGES ? wanted as StageId : stage;
}
