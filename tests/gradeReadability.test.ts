import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { liftFightersUnderGrade } from '../src/render/look/gradeReadability';
import { frameUniforms, toonUniforms } from '../src/render/look/toonShading';

// Round 3b (CAMERA): under a technique's grade the fighters are lifted - a
// pale rim that parts from the tinted room, their shade and near-black cloth
// raised - and with no grade every fighter value is exactly the stage's own.

const snapshot = () => ({ ambient: toonUniforms.uToonAmbient.value, rimWidth: toonUniforms.uRimWidth.value, floor: toonUniforms.uToonFloor.value.clone() });
const violet = new THREE.Color(0x8a4dff);
const unit = (c: THREE.Color) => c.clone().multiplyScalar(1 / (.2126 * c.r + .7152 * c.g + .0722 * c.b));

describe('the fighters under a technique grade', () => {
  it('leaves every fighter value exactly as the stage set it when there is no grade', () => {
    toonUniforms.uToonAmbient.value = 1.7; toonUniforms.uRimWidth.value = .3; toonUniforms.uToonFloor.value.setRGB(.01, .01, .02);
    const before = snapshot();
    for (let i = 0; i < 10; i++) liftFightersUnderGrade(0, unit(violet));
    const after = snapshot();
    expect(after.ambient).toBe(before.ambient); expect(after.rimWidth).toBe(before.rimWidth); expect(after.floor.equals(before.floor)).toBe(true);
  });

  it('lifts their shade, their darkest cloth and their rim under a full grade, and pales the rim toward white', () => {
    toonUniforms.uToonAmbient.value = 1.7; toonUniforms.uRimWidth.value = .3; toonUniforms.uToonFloor.value.setRGB(.01, .01, .02);
    liftFightersUnderGrade(0, unit(violet));
    const hue = unit(violet);
    liftFightersUnderGrade(1, hue);
    expect(toonUniforms.uToonAmbient.value).toBeGreaterThan(1.7 * 1.2);
    expect(toonUniforms.uRimWidth.value).toBeGreaterThan(.3);
    expect(toonUniforms.uToonFloor.value.r).toBeGreaterThan(.04);
    // Paler than the room's hue: the channels closer together.
    const rim = frameUniforms.uLookTechColor.value, spread = (c: THREE.Color) => Math.max(c.r, c.g, c.b) / Math.min(c.r, c.g, c.b);
    expect(spread(rim)).toBeLessThan(spread(hue) * .7);
    // And back to exactly the stage's own as the grade ends.
    liftFightersUnderGrade(0, hue);
    expect(toonUniforms.uToonAmbient.value).toBe(1.7); expect(toonUniforms.uRimWidth.value).toBe(.3); expect(toonUniforms.uToonFloor.value.equals(new THREE.Color(.01, .01, .02))).toBe(true);
  });

  it('takes a stage change during a grade as the new base', () => {
    toonUniforms.uToonAmbient.value = 1.7; toonUniforms.uRimWidth.value = .3; toonUniforms.uToonFloor.value.setRGB(0, 0, 0);
    liftFightersUnderGrade(0, unit(violet));
    liftFightersUnderGrade(.8, unit(violet));
    // The stage writes its own look mid-grade (setToonLook).
    toonUniforms.uToonAmbient.value = 2.2; toonUniforms.uRimWidth.value = .4;
    liftFightersUnderGrade(.8, unit(violet));
    expect(toonUniforms.uToonAmbient.value).toBeGreaterThan(2.2);
    liftFightersUnderGrade(0, unit(violet));
    expect(toonUniforms.uToonAmbient.value).toBe(2.2); expect(toonUniforms.uRimWidth.value).toBe(.4);
  });
});
