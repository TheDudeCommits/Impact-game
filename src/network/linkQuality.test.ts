import { describe, expect, it } from 'vitest';
import { LAG_HIDE_MS, LAG_SHOW_MS, LinkQuality, PAGE_FRAME_MS, STALL_MS, STALL_NOTE_AGE_MS, STALL_NOTE_MS } from './linkQuality';

/** Frames every 16.7 ms and a snapshot every 33 ms from `from` to `to`, as a smooth page on a good link hears them. */
const smooth = (link: LinkQuality, from: number, to: number, snapshots = true) => {
  for (let t = from; t < to; t += 50 / 3) { link.frame(t); if (snapshots && Math.round((t - from) / (50 / 3)) % 2 === 0) link.heard(t + 1); }
};

describe('the link to the match server', () => {
  it('says nothing while the link is good', () => {
    const link = new LinkQuality();
    for (let t = 0; t < 10_000; t += 33) link.heard(t);
    for (let t = 0; t < 10_000; t += 2000) { link.pong(link.ping(t), t + 24); }
    expect(link.rtt).toBeCloseTo(24, 0);
    expect(link.note(10_000)).toBeUndefined();
    expect(link.view(10_000)).toMatchObject({ rtt: 24, stalls: 0, longestStall: 0, pings: 5, pongs: 5 });
  });

  it('smooths the round trip and keeps the floor', () => {
    const link = new LinkQuality();
    for (const rtt of [200, 210, 190, 400, 205, 200]) link.pong(link.ping(1000), 1000 + rtt);
    expect(link.rtt).toBeGreaterThan(195);
    expect(link.rtt).toBeLessThan(260);
    expect(link.best).toBe(190);
    expect(link.jitter).toBeGreaterThan(0);
  });

  it('puts the round trip in the HUD past LAG_SHOW_MS and takes it down only below LAG_HIDE_MS', () => {
    const link = new LinkQuality();
    link.pong(0, LAG_SHOW_MS - 1);
    expect(link.note(1)).toBeUndefined();
    link.pong(0, LAG_SHOW_MS + 60);
    link.pong(0, LAG_SHOW_MS + 60);
    link.pong(0, LAG_SHOW_MS + 60);
    expect(link.note(2)).toMatch(/^LAG · \d+ MS$/);
    // A dip that stays above the hide line keeps the note.
    const link2 = new LinkQuality();
    for (let i = 0; i < 12; i++) link2.pong(0, LAG_SHOW_MS + 50);
    expect(link2.note(1)).toBe(`LAG · ${LAG_SHOW_MS + 50} MS`);
    const far = new LinkQuality();
    for (let i = 0; i < 12; i++) far.pong(0, 230);
    expect(far.note(1)).toBeUndefined();
    for (let i = 0; i < 12; i++) link2.pong(0, (LAG_SHOW_MS + LAG_HIDE_MS) / 2);
    expect(link2.note(2), 'between the lines: still showing').toMatch(/^LAG/);
    for (let i = 0; i < 24; i++) link2.pong(0, 60);
    expect(link2.note(3), 'below the lower line: gone').toBeUndefined();
  });

  it('calls a long silence between snapshots a stall, and says so for ten seconds', () => {
    const link = new LinkQuality();
    for (let t = 0; t < 1000; t += 33) link.heard(t);
    link.heard(1000);
    link.heard(1000 + STALL_MS - 1);
    expect(link.view(2000).stalls, 'just under the line is not a stall').toBe(0);
    const at = 1000 + STALL_MS - 1 + STALL_NOTE_MS + 100;
    link.heard(at);
    expect(link.view(at).stalls).toBe(1);
    expect(link.note(at + 1)).toMatch(/^UNSTABLE CONNECTION · 0\.\d S STALL$/);
    expect(link.note(at + STALL_NOTE_AGE_MS + 1), 'ten seconds on, the note goes').toBeUndefined();
    expect(link.view(at + STALL_NOTE_AGE_MS + 1).longestStall, 'the evidence keeps it for thirty').toBeGreaterThan(STALL_NOTE_MS);
  });

  // 31 October 2026: the room's load froze the page behind the loading screen, and the warning blamed the connection.
  it('does not count a silence the page itself caused: a frame as long as the silence', () => {
    const link = new LinkQuality();
    smooth(link, 0, 1000);
    // The page builds the room: one frame of two seconds, and the snapshots that came meanwhile are heard after it.
    link.frame(1000); link.heard(1001);
    link.frame(3015); link.heard(3016); link.heard(3017);
    smooth(link, 3030, 4000);
    expect(link.view(4000)).toMatchObject({ stalls: 0, longestStall: 0, pageHolds: 1 });
    expect(link.view(4000).longestPageHold).toBeGreaterThan(2000);
    expect(link.note(4000), 'no UNSTABLE CONNECTION for the page\'s own freeze').toBeUndefined();
    link.pong(link.ping(3900), 3930);
    expect(link.summary(4000), 'the bug report says whose it was').toMatch(/ · ping 30 ms .* · page froze 1 time, longest 20\d\d ms$/);
  });

  it('does not count it either when the snapshot is heard before the long frame is drawn (a long task it waited behind)', () => {
    const link = new LinkQuality();
    smooth(link, 0, 1000);
    link.frame(1000); link.heard(1001);
    link.heard(1601); // a 600 ms task: the snapshot waiting behind it is handled before the next frame
    link.frame(1616);
    smooth(link, 1633, 2500);
    expect(link.view(2500)).toMatchObject({ stalls: 0, pageHolds: 1 });
    expect(link.note(2500)).toBeUndefined();
  });

  it('still calls a silence a stall while the page draws smoothly through it', () => {
    const link = new LinkQuality();
    smooth(link, 0, 1000);
    smooth(link, 1000, 1700, false); // frames on time, no snapshot for 700 ms
    smooth(link, 1700, 2500);
    expect(link.view(2500)).toMatchObject({ stalls: 1, pageHolds: 0 });
    expect(link.note(2500)).toBe('UNSTABLE CONNECTION · 0.7 S STALL');
  });

  it('counts the link\'s part of a silence the page only partly explains', () => {
    const link = new LinkQuality();
    smooth(link, 0, 1000);
    // 900 ms without a snapshot: smooth frames, one of 300 ms in the middle, smooth frames.
    smooth(link, 1000, 1300, false); link.frame(1300); link.frame(1600); smooth(link, 1617, 1900, false);
    link.heard(1900);
    smooth(link, 1910, 2500);
    const v = link.view(2500);
    expect(v.stalls).toBe(1);
    expect(v.longestStall).toBeGreaterThanOrEqual(580);
    expect(v.longestStall).toBeLessThanOrEqual(620);
    expect(link.note(2500)).toBe('UNSTABLE CONNECTION · 0.6 S STALL');
  });

  it('takes from a long frame begun before the last snapshot only what falls after it, and lets a slow page\'s ordinary frames be', () => {
    const link = new LinkQuality();
    link.frame(100); link.heard(101);
    // A 500 ms frame begun before the snapshot at 520: only its last 80 ms are inside the 700 ms silence that follows.
    link.heard(520); link.frame(600);
    for (let t = 620; t <= 1220; t += 20) link.frame(t);
    link.heard(1220);
    expect(link.view(1300).longestStall).toBe(620);
    // A device drawing every 80 ms (under PAGE_FRAME_MS): the silence is still the link's.
    const slow = new LinkQuality();
    slow.frame(100); slow.heard(101);
    for (let t = 180; t <= 740; t += 80) slow.frame(t);
    slow.heard(741);
    expect(80).toBeLessThan(PAGE_FRAME_MS);
    expect(slow.view(800)).toMatchObject({ stalls: 1, longestStall: 640, pageHolds: 0 });
  });

  it('ignores a pong that is not an echo', () => {
    const link = new LinkQuality();
    for (const junk of [undefined, null, 'x', NaN, Infinity, 1e9]) link.pong(junk, 500);
    link.pong(1000, 500); // from the future
    expect(link.pongs).toBe(0);
    expect(link.rtt).toBeNaN();
  });

  it('starts over', () => {
    const link = new LinkQuality();
    link.pong(0, 300); link.heard(0); link.heard(900);
    link.frame(1000); link.heard(1001); link.frame(1500); link.heard(1501);
    link.reset();
    expect(link.view(1600)).toMatchObject({ rtt: null, stalls: 0, pongs: 0, pageHolds: 0 });
  });
});
