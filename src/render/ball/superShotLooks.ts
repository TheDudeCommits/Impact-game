import * as THREE from 'three';
import {FIGHTERS} from '../../config';
import type {FighterId} from '../../game/types';
import {signatureShot, type SignatureMotif} from '../../game/ball/superShots';
import {elementFor} from '../vfx/palette';

/** How a fighter's SUPER SHOT looks on the ball: its two colours - the fighter's own
 *  ultimate's (render/vfx/palette.ts elementFor: the saturated rim its blows cool to) and the fighter's colour - which
 *  the trail carries across its width and the rings and sparks are drawn in, and for the eight with a bespoke shot
 *  (game/ball/superShots.ts) the motif the ball throws off in flight (BallField draws each). Built once a fighter. */
export interface SuperLook { a: THREE.Color; b: THREE.Color; motif?: SignatureMotif }

const looks = new Map<FighterId, SuperLook>();
/** (Read every frame a super shot flies: one look a fighter, keyed by the fighter alone, so no key is built.) */
export function superLook(fighter: FighterId): SuperLook {
  const key = fighter;
  let look = looks.get(key);
  if (!look) {
    const element = elementFor(fighter, 'ultimate'), a = new THREE.Color(element.rim), own = new THREE.Color(FIGHTERS[fighter]?.color ?? '#ffffff');
    // Two that read apart on the trail: the fighter's colour, or the element's hot body when the two are near alike.
    const hsl = {h: 0, s: 0, l: 0}, hsl2 = {h: 0, s: 0, l: 0};
    a.getHSL(hsl); own.getHSL(hsl2);
    const near = Math.min(Math.abs(hsl.h - hsl2.h), 1 - Math.abs(hsl.h - hsl2.h)) < .06;
    look = {a, b: near ? new THREE.Color(element.spike) : own, motif: signatureShot(fighter)?.motif};
    looks.set(key, look);
  }
  return look;
}

/** A LINK SHOT's two: the finisher's colour and the setter's. */
export function fighterColour(fighter: FighterId | undefined, out: THREE.Color) { return out.set(fighter ? FIGHTERS[fighter]?.color ?? '#ffffff' : '#ffffff'); }

/** What each motif is, for BallField (it draws them from its own pool, at the VISUAL EFFECTS level's density):
 *  - sun: a corona of gold rings thrown off the ball, and gold sparks (RAKUJITSU).
 *  - foxfire: flame wisps peeling off and rising round it (KOENBAKU).
 *  - tide: spray flung out sideways and a wake of rings (TAKASHIO).
 *  - sand-cut: slash lines crossing over it, sand puffing off (SAKAIWARI).
 *  - feast: a spiral of flame in two colours (HIUTAGE).
 *  - crown: golden lightning crawling round it (OUKODAN).
 *  - sickle: crescent ripples in the void's violet (KUKARI).
 *  - storm: purple lightning thrown out round it, white streaks (SHIRANSEN). */
export const MOTIF_RATE: Readonly<Record<SignatureMotif, number>> = {sun: 9, foxfire: 46, tide: 60, 'sand-cut': 16, feast: 55, crown: 22, sickle: 8, storm: 34};
