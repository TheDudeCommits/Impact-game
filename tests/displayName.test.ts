import { describe, expect, it } from 'vitest';
import { displayName, refusedName } from '../src/server/displayName';
import { NAME_FALLBACK, tidyName } from '../src/game/displayName';
import { OWN_NAMES } from '../src/game/economy/names';
import { ArenaSimulation } from '../src/game/simulation';

describe('display names', () => {
  it('refuses slurs and obscenities, through the usual disguises', () => {
    for (const slur of ['Fuckface', 'n1gg4', 'Big Ass', 'big_ass', 'f.u.c.k', 'f u c k', 's1ut', 'Sh1tHead', 'xX_Nаzi_Xx', 'ＦＵＣＫ', 'Pen Island'])
      expect(displayName(slur), slur).toBe(NAME_FALLBACK);
  });

  it('refuses the staff\'s, the game\'s and the design\'s names, and look-alikes of them', () => {
    for (const reserved of ['Admin', 'admin', 'Administrator', 'Moderator', 'Mod', 'Owner', 'Staff', 'Official', 'System', 'Support', 'Dev', 'Developer', 'GM',
      'Impact Game', 'ImpactGame', 'TheDude', 'The Dude', 'Dude', 'SuperAdmin', 'ModBob', 'Mod99',
      ...OWN_NAMES.flatMap(own => { const Own = own[0].toUpperCase() + own.slice(1); return [own, Own, `${own} khan`, `${Own}Mode`, `${own}99`]; }),
      // full-width, a Cyrillic А, Greek capitals, small capitals, leetspeak, separators, l and rn for i and m
      'ＡＤＭＩＮ', 'Аdmin', 'ΑDΜΙΝ', 'ᴀᴅᴍɪɴ', '4dm1n', '@dmin', 'M0d', 'a.d.m.i.n', 'Ad Min', 'Admln', 'Adrnin',
      // hidden: a zero-width space, stacked marks
      'Ad​min', 'A̸d̷m̶i̵n̴'])
      expect(displayName(reserved), reserved).toBe(NAME_FALLBACK);
  });

  it('keeps ordinary names, in any script, and words that only contain a short reserved one', () => {
    for (const fine of ['Thunder Hawk', 'Paper Tiger', 'Samir', 'Devon', 'Sigma', 'Modric', 'Dudek', 'Assassin', 'Woodcock', 'Dickens', 'Analysis', "O'Brien", 'Jean-Luc', 'Mr. T', 'x_X_x',
      '鬼滅の刃', '김민준', 'Анна', 'Δημήτρης', 'محمد',
      'José', 'Zoë', 'Sølion-s-roar', 'Nguyễn', 'अमित', 'नमस्ते', 'สมศักดิ์'])
      expect(displayName(fine), fine).toBe(fine.normalize('NFKC'));
  });

  it('draws nothing that is not there to be read: zalgo, bidi overrides, zero-width and filler characters, emoji', () => {
    expect(displayName('Z̵̢̛a̴l̷g̸o̶ Kid')).toBe('Zalgo Kid');
    expect(displayName('‮Thunder Hawk')).toBe('Thunder Hawk');
    expect(displayName('Thunder Hawk‮gnp.exe')).toBe('Thunder Hawkgnp.exe');
    expect(displayName('⁧Thunder Hawk⁩ ‏')).toBe('Thunder Hawk');
    expect(displayName('Thun‍der H﻿awk⁠')).toBe('Thunder Hawk');
    expect(displayName('Taisei\u{1F525}\u{1F525}')).toBe('Taisei');
    expect(displayName('\u{1F44D}\u{1F3FD} Thunder Hawk')).toBe('Thunder Hawk');
    for (const empty of ['\u{1F525}\u{1F525}', 'ㅤㅤ', 'ᅟ', '   ', '...', '​', ''])
      expect(displayName(empty), JSON.stringify(empty)).toBe(NAME_FALLBACK);
    // Full-width forms read as the plain ones; curly quotes and dashes as plain ones.
    expect(displayName('Taisei　Ｓｏｎ')).toBe('Taisei Son');
    expect(displayName('O’Brien — Jr')).toBe("O'Brien - Jr");
    // Only letters, digits, spaces and - _ . ' stand; spaces single, the ends trimmed.
    expect(displayName('  <b>Hawk</b>  the   Swift!! ')).toBe('bHawkb the Swift');
  });

  it('keeps to the length its seat has, and answers anything that is not a string with the fallback', () => {
    expect(displayName('Very Long Name That Goes On And On')).toBe('Very Long Name That');
    expect(displayName('Very Long Name That Goes On And On', 18)).toBe('Very Long Name Tha');
    expect([...displayName('鬼'.repeat(40), 18)]).toHaveLength(18);
    for (const raw of [undefined, null, 42, {}, ['Thunder Hawk']]) expect(displayName(raw), String(raw)).toBe(NAME_FALLBACK);
    expect(refusedName(NAME_FALLBACK)).toBe(false);
  });

  it('is fast enough for every join', () => {
    const start = performance.now();
    for (let i = 0; i < 2000; i++) displayName(`Z̵̢a̴lgo Kid ${i}${'x'.repeat(i % 300)}`, 18);
    expect((performance.now() - start) / 2000).toBeLessThan(1);
  });

  it('leaves names the game gives alone in the simulation, but nothing undrawable gets in', () => {
    expect(tidyName('Bot · Thunder Hawk')).toBe('Bot · Thunder Hawk');
    expect(tidyName('Kōsuke Shiun')).toBe('Kōsuke Shiun');
    const sim = new ArenaSimulation({ roomMode: 'training', trainingBot: false });
    try {
      sim.addPlayer('a', 'taisei', '‮K̶̵i​rin<script>\u0007');
      expect(sim.getPlayer('a')!.name).toBe('Kirinscript');
      sim.addPlayer('b', 'taisei', 'ㅤ');
      expect(sim.getPlayer('b')!.name).toBe(NAME_FALLBACK);
    } finally { sim.dispose(); }
  });
});
