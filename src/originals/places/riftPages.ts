import type { InkPage, InkSky } from '../../render/rift/ink';
import type { LookPreset } from '../../render/look/stageLooks';

const without = (sky: InkSky, changes: Partial<InkSky>): InkSky => { const { disc: _disc, ...rest } = sky; return { ...rest, ...changes }; };

export function originalInkPages(pages: Record<string, InkPage>) {
  const lake = pages['rift-swords'];
  if (lake) Object.assign(lake, { paper: 0xe9e4ea, shade: 0x4c4462,
    sky: without(lake.sky, { top: .68, low: .3, clouds: .62, cloudLit: .26, cloudShade: .76, stars: .12 }) });
  const star = pages['rift-eclipse'];
  if (star) Object.assign(star, { far: 330, sky: without(star.sky, { top: .62, low: .18, clouds: .46, cloudLit: .5, cloudShade: .95 }) });
  return pages;
}

export function originalRiftLooks(looks: Record<string, LookPreset>) {
  const lake = looks['rift-swords'];
  if (lake) {
    lake.key = { ...lake.key, color: 0xd8a0b0 };
    lake.fog = { ...lake.fog, color: 0x261c2c };
    lake.sky = { ...lake.sky, zenith: 0x0c0814, horizon: 0x6a3a5e, ground: 0x120a12, sunColor: 0xd87a8a, sunIntensity: 3.5, sunGlow: 1.1,
      cloudCoverage: .74, cloudLit: 0x5a3a5a, cloudShade: 0x1a1020, cloudRim: 0xd890b0, stars: .12 };
    lake.atmosphere = { ...lake.atmosphere, color: 0xb8a8c0, color2: 0x5a4a62 };
  }
  // (The sky's sun stands for the star's glow over the crater's far rim: small, low, no eclipse round it.)
  const star = looks['rift-eclipse'];
  if (star) star.sky = { ...star.sky, eclipse: 0, sunIntensity: 3.2, sunSize: .035, sunGlow: 2.4, sunGlowWidth: 3, sunDir: [0, .06, 1], cloudCoverage: .5 };
  return looks;
}
