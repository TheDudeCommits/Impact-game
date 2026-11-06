import type { FighterId } from '../game/types';
import { ORIGINALS } from './roster';

const RULES: Partial<Record<FighterId, { readonly mirror: boolean; readonly slack?: number }>> = {
  hakushi: { mirror: true, slack: .075 },
  kubiwa: { mirror: true, slack: .075 },
  kuon: { mirror: true, slack: .075 },
  hawser: { mirror: false },
  strix: { mirror: false },
  tempo: { mirror: false },
  svanhild: { mirror: false },
  oyashio: { mirror: false },
  tsubute: { mirror: false },
};

export const finisherMirror = (fighter: FighterId) => ORIGINALS[fighter] ? RULES[fighter] : undefined;

export const roundMirror = (fighter: FighterId, finisher: boolean) => {
  const rule = finisherMirror(fighter);
  return finisher || rule?.mirror === false ? rule : undefined;
};
