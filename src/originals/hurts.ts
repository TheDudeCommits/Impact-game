import { ORIGINALS } from './roster';

const HURTS = '/assets/fighters/wukong-hurts1.glb';
export const ORIGINAL_HURT_DONOR = ORIGINALS.taisei?.extraModels?.includes(HURTS) ? { fighter: 'taisei' as const, file: HURTS, files: [HURTS] } : undefined;
