/**
 * The ball modes' camera options. The fighters are small on screen (in Sky Spike yours about 115 px tall at 1080p and the
 * far side about 70 px; in Goal Rush everyone but you a speck), and a camera players know is not changed under them. So
 * each answer is an option beside today's camera, off until the player picks it (Settings.spikeCam, Settings.chaseCam; the
 * pause menu and the home's settings show them), and with it off the lens is exactly the one it was
 * (camDefaults.test.ts):
 * - SKY SPIKE CAMERA: CLASSIC, today's broadcast stand, or COURT-SIDE, the same fixed heading from under half its height
 *   on a longer lens (SpikeCam.ts `SIDE`).
 * - GOAL RUSH CAMERA: CLASSIC, today's chase rig, or CLOSE, the same rig on a narrower lens stood a little higher
 *   (BallChase.ts `CLOSE`).
 * On this machine `?spikecam=side|classic`, `?chasecam=close|classic` and `?trim=0|1` (the sides' trim on the bodies,
 * TeamTrim.ts) override the settings for a visit, so a before and an after are filmed from one build.
 */
export type SpikeCamStyle = 'classic' | 'side';
export type ChaseCamStyle = 'classic' | 'close';
/** What each menu offers, the default first; the third word is the note in the open list. */
export const SPIKE_CAM_OPTIONS: readonly (readonly [SpikeCamStyle, string, string?])[] = [['classic', 'Classic', 'Default'], ['side', 'Court-side', 'Bigger fighters']];
export const CHASE_CAM_OPTIONS: readonly (readonly [ChaseCamStyle, string, string?])[] = [['classic', 'Classic', 'Default'], ['close', 'Close', 'Bigger fighters']];
export const spikeCamOf = (value: unknown): SpikeCamStyle => value === 'side' ? 'side' : 'classic';
export const chaseCamOf = (value: unknown): ChaseCamStyle => value === 'close' ? 'close' : 'classic';

/** What a visit's address asks for (this machine only; elsewhere nothing). */
export function ballCamAsk(search: string, host: string): {spike?: SpikeCamStyle; chase?: ChaseCamStyle; trim?: boolean} {
  if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) return {};
  const q = new URLSearchParams(search), spike = q.get('spikecam'), chase = q.get('chasecam'), trim = q.get('trim');
  return {
    spike: spike === 'side' || spike === 'classic' ? spike : undefined,
    chase: chase === 'close' || chase === 'classic' ? chase : undefined,
    trim: trim === '0' || trim === 'off' ? false : trim === '1' || trim === 'on' ? true : undefined,
  };
}
const asked = typeof location === 'object' ? ballCamAsk(location.search, location.hostname) : {};

/** The camera a Sky Spike match is filmed with: the address's on this machine, else the player's setting. */
export const spikeCamChoice = (settings: {spikeCam?: unknown}): SpikeCamStyle => asked.spike ?? spikeCamOf(settings.spikeCam);
/** The lens a Goal Rush match's BALL stance is filmed with: the address's on this machine, else the player's setting. */
export const chaseCamChoice = (settings: {chaseCam?: unknown}): ChaseCamStyle => asked.chase ?? chaseCamOf(settings.chaseCam);
/** Whether the sides' trim is drawn on the bodies in a ball match: always, but for `?trim=0` on this machine (and a
 *  check's own switch there, `askTeamTrim`, for one moment drawn both ways). */
export const teamTrimOn = (): boolean => asked.trim ?? true;
export const askTeamTrim = (on: boolean | undefined) => { asked.trim = on; };
/** A check's own switch for the cameras on this machine (main.ts `__ballCams.ask`), as the address's: one held moment
 *  filmed from both. Undefined hands that camera back to the setting. */
export const askBallCams = (o: {spike?: SpikeCamStyle; chase?: ChaseCamStyle}) => { asked.spike = o.spike; asked.chase = o.chase; };

/** How see-through Sky Spike's net is drawn (0: as it is; 1: thinned for the COURT-SIDE stand, which looks at the far
 *  court through it). One for the page, as the arena's other shared uniforms are (hype.ts): main.ts sets it from the
 *  camera filming (SpikeCam `sheer`), BallArena's net shader reads it. */
export const netSheer = {value: 0};
