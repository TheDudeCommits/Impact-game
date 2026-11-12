import type { FighterId } from './types';

export interface LockBorrow { name: string; from: FighterId; clip: string; file: string }
const take = (name: string, from: FighterId, clip: string, file: string): LockBorrow => ({ name, from, clip, file: `/assets/fighters/${file}.glb` });
export const LOCK_ROUND_BORROW: Partial<Record<FighterId, readonly [LockBorrow | null, LockBorrow | null, LockBorrow | null]>> = {
  banjaku: [take('Pride Elbow', 'ouga', 'Elbow Palm', 'ouga-enders1'), take('Power Palm', 'taisei', 'Straight Palm', 'taisei-fanim5'), take('Justice Backfist', 'shanxiao', 'Mauler Backfist', 'shanxiao-night1')],
  'gohaku': [take('Beast Straight', 'taisei', 'DZ Rush 1', 'taisei-fanim8'), take('Beast Hook', 'taisei', 'DZ Rush 2', 'taisei-fanim8'), take('Beast Rising Kick', 'ouga', 'Rising Kick', 'ouga-enders1')],
  'jinlin': [take('Golden Elbow', 'ouga', 'Elbow Palm', 'ouga-enders1'), take('Golden Tail Sweep', 'gummy', 'Sickle Sweep', 'gummy-enders2'), take('Golden Hammer', 'taisei', 'Flare Hammer', 'taisei-enders2')],
  'wuming': [take('Black Cross', 'taisei', 'DZ Rush 2', 'taisei-fanim8'), take('Black Rising Kick', 'ouga', 'Rising Kick', 'ouga-enders1'), take('Black Palm', 'taisei', 'Straight Palm', 'taisei-fanim5')],
  gaku: [take('Lion-Dog Jab', 'ampere', 'Live Line Jab', 'ampere-night1'), take('Stray Cross', 'ampere', 'Live Line Cross', 'ampere-night1'), take('Hunter Sweep', 'gummy', 'Sickle Sweep', 'gummy-enders2')],
  tobari: [take('Crow Scrap Kunai', 'shirokane', 'Scrap Kunai', 'shirokane-fanim2'), take('Crow Clan Rising Slash', 'shirokane', 'Rising Slash', 'shirokane-enders1'), take('Kunai Palm', 'shiden', 'Slash Palm', 'shiden-enders1')],
  akagane: [take('WAR FAN Rising Swing', 'shiden', 'Rising Slash', 'shiden-enders1'), take('Crow Clan Elbow', 'ouga', 'Elbow Palm', 'ouga-enders1'), take('Crow Clan Sweep', 'gummy', 'Sickle Sweep', 'gummy-enders2')],
  shiun: [take('Crossing Cadence', 'shidare', 'Crossing Petals', 'shidare-night1'), take('ASHSTEP Rising Reap', 'kenzo', 'Rising Cross', 'kenzo-enders1'), take('Downbeat Cut', 'shiden', 'Slash Palm', 'shiden-enders1')],
  'rook': [take('Shadow Slash', 'levin', 'Shave', 'levin-fanim2'), take('Rookery Lift Off', 'levin', 'Lift Off', 'levin-fanim2'), take('Shadow Reverse Quill', 'levin', 'Nick', 'levin-fanim2')],
  hawser: [null, null, take('Rising Billet', 'shiden', 'Rising Slash', 'shiden-enders1')],
  shirokane: [null, null, take('Hailstone Palm', 'shiden', 'Slash Palm', 'shiden-enders1')],
  magatsu: [null, take('Hex Elbow', 'ouga', 'Elbow Palm', 'ouga-enders1'), take('Calamity Kick', 'ouga', 'Rising Kick', 'ouga-enders1')],
  vesper: [null, take('Hawk Rising Cross', 'kenzo', 'Rising Cross', 'kenzo-enders1'), take('Falcon Crossing Cut', 'shidare', 'Crossing Petals', 'shidare-night1')],
  imago: [null, take('Royal Tail Sweep', 'gummy', 'Sickle Sweep', 'gummy-enders2'), take('Royal Elbow', 'ouga', 'Elbow Palm', 'ouga-enders1')],
  sekka: [null, take('Destructive Cross', 'ampere', 'Live Line Cross', 'ampere-night1'), take('Rising Leg Strike', 'ouga', 'Rising Kick', 'ouga-enders1')],
  asahi: [null, take('Crossing Cut', 'shidare', 'Crossing Petals', 'shidare-night1'), take('Ashfall Waltz: Turn', 'kenzo', 'Rising Cross', 'kenzo-enders1')],
  levin: [null, take('Spinning Blade Cut', 'kenzo', 'Rising Cross', 'kenzo-enders1'), take('Scout Cross Cut', 'shidare', 'Crossing Petals', 'shidare-night1')],
};
