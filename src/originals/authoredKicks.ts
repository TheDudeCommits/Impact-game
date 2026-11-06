const KICKS: Readonly<Record<string, ReadonlySet<string>>> = {
  shakugo: new Set(['Rush 2']),     // Shakugo (fix-polish2)
  pyroclast: new Set(['Rush 2']),     // Pyroclast (fix-polish2)
  shanxiao: new Set(['Rush 2']),      // Shanxiao (fix-polish2)
  irbis: new Set(['Rush 2']),   // Irbis (fix-polish2)
  shirokane: new Set(['Rush 2']),    // Shirokane
  setsu: new Set(['Rush 2']),     // Setsu
  suzuran: new Set(['Rush 2']),     // Suzuran
  unari: new Set(['Rush 2']),     // Unari
  // (KoKo's Rush 2 is KoKo's jumping hook again, his air light: aaa-a2, 6 November - no kick to let fly.)
  oyashio: new Set(['Rush 2']),      // Oyashio
  'ovid': new Set(['Rush 2']), // Ovid
  senko: new Set(['Rush 1']),     // Senko (Rush 1 the high kick that opens his string; his Rush 2 is the shipped stage again, gauntlet)
  gummy: new Set(['Rush 2']),      // Lucy
  konta: new Set(['Rush 2']),     // Konta
  ume: new Set(['Rush 2']),     // Ume
  murex: new Set(['Rush 2']),     // Murex (fix-polish2)
  tancho: new Set(['Rush 2']),   // Tancho (fix-polish2)
  tempo: new Set(['Rush 2']),       // Tempo
};

export const ORIGINAL_AUTHORED_KICKS = KICKS;

/** Whether `clip`, on `fighter`'s body, is one of the originals' authored kicks (Fighter.authoredKick). */
export function originalAuthoredKick(fighter: string, clip: string | undefined): boolean {
  return !!clip && !!KICKS[fighter]?.has(clip);
}
