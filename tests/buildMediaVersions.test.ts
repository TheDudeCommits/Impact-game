import { describe, expect, it } from 'vitest';
import { stripProvenance, runtimeAssetManifest, creditMarkers } from '../scripts/build/provenance';
import homeVoices from '../public/assets/audio/home/manifest.json';
import homeSprites from '../public/assets/home/sprites/manifest.json';

describe('production media manifests', () => {
  it('preserves the actual homepage voice cache versions after build stripping', () => {
    const built = stripProvenance(homeVoices) as typeof homeVoices;
    expect(built.assets.map(row => [row.file, row.runtimeSha256])).toEqual(homeVoices.assets.map(row => [row.file, row.runtimeSha256]));
    expect(creditMarkers(JSON.stringify(built))).toEqual([]);
  });
  it('removes generated source paths and voice notes without losing sprite playback data', () => {
    const runtime = { frameCount: 32, heroFrame: 15, sha256: 'sheet', timing: { frameTimesMs: [0, 100], loopMs: 200 } };
    const built = stripProvenance({ ...runtime, sources: [{ file: '/private/master.png' }], visualReview: { path: '/private/review.jpg' }, audioPairing: { source: 'https://youtube.com/watch?v=example' }, timing: { ...runtime.timing, voiceSource: 'https://youtube.com/watch?v=example', timingNotes: 'working notes' } });
    expect(built).toEqual(runtime);
  });
  it('keeps every homepage playback field while excluding cel review records from the bundle', () => {
    const built = runtimeAssetManifest(homeSprites, '/project/public/assets/home/sprites/manifest.json') as typeof homeSprites;
    const playback = (row: Record<string, unknown>) => {
      const timing = row.timing as Record<string, unknown> | undefined;
      return [row.id, row.sha256, row.posterSha256, row.columns, row.frameCount, row.heroFrame,
        timing?.frameTimesMs, timing?.loopMs, timing?.loopStartFrame, row.motionTiming, row.runtimePages];
    };
    expect(built.fighters.map(playback)).toEqual(homeSprites.fighters.map(playback));
    expect(built.fighters.every(row => !('frames' in row) && !('sources' in row))).toBe(true);
    expect(JSON.stringify(built).length).toBeLessThan(JSON.stringify(homeSprites).length / 2);
    const voices = runtimeAssetManifest(homeVoices, '/project/public/assets/audio/home/manifest.json') as typeof homeVoices;
    expect(voices.assets).toEqual(homeVoices.assets.map(({ fighter, file, runtimeSha256 }) => ({ fighter, file, runtimeSha256 })));
    expect(runtimeAssetManifest({ source: 'private', runtime: true }, '/project/public/assets/other.json')).toEqual({ runtime: true });
  });
});
