import {describe, expect, it} from 'vitest';
import * as THREE from 'three';
import {RIDE, SuperRide} from './superRide';
import {SUPER_CAM_OPTIONS, ballCamAsk, superCamChoice, superCamOf} from './ballCamChoice';
import {freshBall} from '../../game/ball/physics';
import type {BallView} from '../../game/ball/model';

const view = (ball: Partial<BallView['ball']>, at = 10): BallView => ({mode: 'goal-rush', phase: 'live', events: [{id: 4, at, kind: 'super', x: 0, y: 1, z: 0}],
  ball: {...freshBall(), held: false, super: true, vx: 0, vy: 0, vz: 30, ...ball}} as unknown as BallView);

describe('the lens riding a SUPER SHOT: an option, off by default', () => {
  it('is CLASSIC unless RIDE is picked, and the address asks for it on this machine only', () => {
    expect(SUPER_CAM_OPTIONS[0][0]).toBe('classic');
    expect(superCamOf(undefined)).toBe('classic');
    expect(superCamChoice({})).toBe('classic');
    expect(superCamChoice({superCam: 'ride'})).toBe('ride');
    expect(ballCamAsk('?supercam=ride', 'localhost').ride).toBe('ride');
    expect(ballCamAsk('?supercam=ride', 'play.example.com')).toEqual({});
  });
  it('off, it leaves the lens exactly as the match placed it', () => {
    const r = new SuperRide(), cam = new THREE.PerspectiveCamera();
    cam.position.set(1, 2, 3); cam.lookAt(0, 0, 0);
    const before = [...cam.position.toArray(), ...cam.quaternion.toArray()];
    for (let i = 0; i < 30; i++) r.aim(cam, 1 / 60, view({}), new THREE.Vector3(0, 1, 2), 'classic', 10 + i / 60);
    expect([...cam.position.toArray(), ...cam.quaternion.toArray()]).toEqual(before);
  });
  it('on, it rides behind the ball through the flight, and hands the lens back when the flight ends', () => {
    const r = new SuperRide(), cam = new THREE.PerspectiveCamera(), ball = new THREE.Vector3(0, 1, 2);
    for (let i = 0; i < 30; i++) { cam.position.set(10, 8, 0); cam.lookAt(0, 0, 0); r.aim(cam, 1 / 60, view({}), ball, 'ride', 10 + i / 60); }
    expect(r.weight).toBe(1);
    expect(cam.position.z).toBeCloseTo(2 - RIDE.back, 3);
    expect(cam.getWorldDirection(new THREE.Vector3()).z).toBeGreaterThan(.9);
    // (Somebody's touch: no longer a SUPER SHOT. The lens is handed back over RIDE.out.)
    for (let i = 0; i < 30; i++) { cam.position.set(10, 8, 0); cam.lookAt(0, 0, 0); r.aim(cam, 1 / 60, view({super: false}), ball, 'ride', 10.5 + i / 60); }
    expect(r.weight).toBe(0);
    expect(cam.position.x).toBe(10);
  });
});
