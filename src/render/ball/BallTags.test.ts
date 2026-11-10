import { describe, expect, it } from 'vitest';
import { SPEECH, Speech, speechLines } from './BallTags';

/** What the bots and people say is a speech bubble over the speaker, two at most, each about 2.5 s. */
describe('speech bubbles (BallTags.ts Speech)', () => {
  it('holds two at most: a third takes the place of the older', () => {
    const s = new Speech();
    s.say('a', 'red', 'I got it!', 0); s.say('b', 'blue', 'Nice shot!', 100);
    expect(s.count(200)).toBe(2);
    s.say('c', 'red', 'Wow!', 300);
    expect(s.count(400)).toBe(2);
    expect(s.lines.map(l => l?.id).sort()).toEqual(['b', 'c']);
    expect(SPEECH.most).toBe(2);
  });
  it("a speaker's new line takes the place of their last, not a second place", () => {
    const s = new Speech();
    s.say('a', 'red', 'I got it!', 0); s.say('a', 'red', 'Whoops...', 500);
    expect(s.count(600)).toBe(1);
    expect(s.lines.find(l => l)?.text).toBe('Whoops...');
  });
  it('each is up about two and a half seconds, and a place whose line has ended is free again', () => {
    const s = new Speech();
    s.say('a', 'red', 'I got it!', 0);
    expect(SPEECH.ms).toBeGreaterThanOrEqual(2200); expect(SPEECH.ms).toBeLessThanOrEqual(2800);
    expect(s.count(SPEECH.ms - 1)).toBe(1); expect(s.count(SPEECH.ms)).toBe(0);
    s.say('b', 'blue', 'Sorry!', SPEECH.ms + 10); s.say('c', 'blue', 'No problem.', SPEECH.ms + 20);
    expect(s.lines.map(l => l?.id).sort()).toEqual(['b', 'c']);
  });
  it('counts a change so the atlas is drawn again, says nothing for nobody or no words, and clears', () => {
    const s = new Speech(), v = s.version;
    s.say('', 'red', 'x', 0); s.say('a', 'red', '   ', 0);
    expect(s.version).toBe(v); expect(s.count(1)).toBe(0);
    s.say('a', 'red', ' Thanks! ', 0);
    expect(s.version).toBe(v + 1); expect(s.lines.find(l => l)?.text).toBe('Thanks!');
    s.clear();
    expect(s.count(1)).toBe(0); expect(s.version).toBe(v + 2);
  });
});

describe("a bubble's words (speechLines)", () => {
  const measure = (text: string) => text.length * 10;
  it('stay on one line when they fit', () => {
    expect(speechLines('I got it!', 200, measure)).toEqual(['I got it!']);
  });
  it('break onto two lines at a word when they do not', () => {
    expect(speechLines("Hunt the ball. Don't let them breathe.", 220, measure)).toEqual(["Hunt the ball. Don't", 'let them breathe.']);
  });
  it('never run past two lines: the second ends in an ellipsis', () => {
    const rows = speechLines('one two three four five six seven eight nine ten eleven twelve', 150, measure);
    expect(rows).toHaveLength(2);
    expect(measure(rows[1])).toBeLessThanOrEqual(150); expect(rows[1].endsWith('…')).toBe(true);
  });
});
