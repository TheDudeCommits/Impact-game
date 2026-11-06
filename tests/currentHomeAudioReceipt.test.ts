import { describe, expect, it } from 'vitest';
import { currentHomeAudioHash } from './helpers/currentHomeAudioReceipt';

const oldHash = '1'.repeat(64), newHash = '2'.repeat(64);
const receipt = {fighter:'shakugo',file:'/assets/audio/home/shakugo.m4a',runtimeSha256:newHash,
  sourceUrl:'https://www.youtube.com/watch?v=source',sourceSha256:'3'.repeat(64),
  sourceTitle:'Original Shakugo recording',sourceType:'Recorded voice',windows:[{start:18.72,duration:1.35}],durationSeconds:1.35};

describe('current home receipt boundary', () => {
  it('supersedes only the matching home file and preserves combat hashes', () => {
    expect(currentHomeAudioHash(receipt.file,oldHash,[receipt])).toBe(newHash);
    expect(currentHomeAudioHash('/assets/audio/v2/voice/shakugo-ultimate.wav',oldHash,[receipt])).toBe(oldHash);
    expect(currentHomeAudioHash('/assets/audio/home/../shakugo.m4a',oldHash,[receipt])).toBe(oldHash);
  });
  it('rejects absent, cross-character, ambiguous and unproven replacement receipts', () => {
    for (const rows of [[],[{...receipt,fighter:'kagari'}],[receipt,receipt],[{...receipt,sourceSha256:undefined}],[{...receipt,windows:[]}],[{...receipt,runtimeSha256:'invalid'}]])
      expect(()=>currentHomeAudioHash(receipt.file,oldHash,rows)).toThrow();
  });
});
