import * as THREE from 'three';
import { bonshoStrikeJoint } from '../game/fighters/bonsho';

type Joints = Readonly<Record<string, THREE.Object3D | undefined>>;
const rigs = new WeakMap<THREE.Object3D, Joints>();
const NAMES = ['RightHand', 'RightHandIndex1', 'RightHandMiddle1', 'RightHandPinky1', 'RightForeArm', 'RightArm',
  'LeftHand', 'LeftHandIndex1', 'LeftHandMiddle1', 'LeftHandPinky1'] as const;
const wrist = new THREE.Vector3(), knuckle = new THREE.Vector3(), index = new THREE.Vector3(), pinky = new THREE.Vector3(),
  along = new THREE.Vector3(), across = new THREE.Vector3(), normal = new THREE.Vector3();

function joints(model: THREE.Object3D): Joints {
  let found = rigs.get(model);
  if (!found) {
    const out: Record<string, THREE.Object3D | undefined> = {};
    for (const name of NAMES) out[name] = model.getObjectByName(name) ?? undefined;
    rigs.set(model, found = out);
  }
  return found;
}

export function bonshoStrikePoint(model: THREE.Object3D, action: string, clip: string | undefined, out: THREE.Vector3): boolean {
  const j = joints(model), part = bonshoStrikeJoint(action, clip);
  if (part === 'RightForeArm') {
    const elbow = j.RightForeArm, shoulder = j.RightArm;
    if (!elbow || !shoulder) return false;
    elbow.getWorldPosition(out); shoulder.getWorldPosition(along);
    out.addScaledVector(along.subVectors(out, along), .14);
    return true;
  }
  const side = part === 'LeftHand' ? 'Left' : 'Right';
  const hand = j[`${side}Hand`], middle = j[`${side}HandMiddle1`], first = j[`${side}HandIndex1`], last = j[`${side}HandPinky1`];
  if (!hand || !middle) return false;
  hand.getWorldPosition(wrist); middle.getWorldPosition(knuckle);
  along.subVectors(knuckle, wrist);
  out.copy(wrist).addScaledVector(along, .55);
  if (first && last) {
    first.getWorldPosition(index); last.getWorldPosition(pinky);
    across.subVectors(index, pinky);
    // The palm's side (donate.py's _palm: across x along on the right hand, along x across on the left).
    if (side === 'Right') normal.crossVectors(across, along); else normal.crossVectors(along, across);
    if (normal.lengthSq() > 1e-12) out.addScaledVector(normal.normalize(), along.length() / 3);
  }
  return true;
}
