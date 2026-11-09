import type { Camera } from 'three';

/**
 * Round 5, WP2: what the mode HUDs need from the scene, handed over once by main.ts (one line beside `targeting`):
 * the render camera, which the edge markers project through (EdgeMarkers.ts), and whether the player's lock is on,
 * which decides the battle royale's target plate (RoyaleHud.ts), and whether the ball modes' ball cam is on (BallHud.ts's
 * key hint), and the opponent Goal Rush's FIGHT stance has locked (null: the BALL stance; game/ball/stance.ts). None
 * allocates: the camera is the one object
 * GameRenderer draws with, and `locked` reads a flag.
 */
export const hudView: { camera?: Camera; locked: () => boolean; ballCam: () => boolean; ballLock: () => string | null } = { locked: () => false, ballCam: () => false, ballLock: () => null };
