import * as THREE from 'three';

export function akaganeFan(): THREE.Group {
  const group = new THREE.Group();
  const copper = new THREE.MeshStandardMaterial({color: 0xb86a34, roughness: .38, metalness: .55});
  const iron = new THREE.MeshStandardMaterial({color: 0x24201e, roughness: .6, metalness: .3, side: THREE.DoubleSide});
  const crimson = new THREE.MeshStandardMaterial({color: 0x8c1c1a, roughness: .55, side: THREE.DoubleSide});
  const wrap = new THREE.MeshStandardMaterial({color: 0x1a1210, roughness: .85});
  const pivot = .3, reach = .56;
  // The leaf, a half disc above the pivot, and its crimson edge band.
  const leaf = new THREE.Mesh(new THREE.RingGeometry(.09, reach * .84, 40, 1, 0, Math.PI), iron);
  leaf.position.y = pivot; group.add(leaf);
  const edge = new THREE.Mesh(new THREE.RingGeometry(reach * .84, reach, 40, 1, 0, Math.PI), crimson);
  edge.position.y = pivot; group.add(edge);
  // The ribs, the two outer ones heavier: each a thin bar from the pivot out past the leaf.
  const RIBS = 14;
  for (let i = 0; i < RIBS; i++) {
    const a = i / (RIBS - 1) * Math.PI, guard = i === 0 || i === RIBS - 1;
    const len = reach * (guard ? 1.04 : 1.0);
    const rib = new THREE.Mesh(new THREE.BoxGeometry(guard ? .03 : .012, len, guard ? .03 : .014), copper);
    rib.position.set(Math.cos(a) * len / 2, pivot + Math.sin(a) * len / 2, 0);
    rib.rotation.z = a - Math.PI / 2;
    group.add(rib);
  }
  // The pivot rivet and the grip below it: the closed guard ribs bound in black cord.
  const rivet = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .05, 16), copper);
  rivet.rotation.x = Math.PI / 2; rivet.position.y = pivot; group.add(rivet);
  const grip = new THREE.Mesh(new THREE.CylinderGeometry(.022, .026, .36, 10), wrap);
  grip.position.y = pivot - .18; group.add(grip);
  const pommel = new THREE.Mesh(new THREE.SphereGeometry(.03, 12, 8), copper);
  pommel.position.y = pivot - .37; group.add(pommel);
  group.name = 'akagane-war-fan'; group.visible = false;
  group.traverse(o => { o.frustumCulled = false; });
  return group;
}
