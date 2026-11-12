/** Boss relics (the overhaul's Phase 4, item 2): "Every boss leaves one: its
 *  power, bent to the fighter. shakugo's: heavy blows leave magma. LORD ORO's: the
 *  ultimate stops time for two seconds. Kuromitsu's: a just guard answers by
 *  itself. Three slots. Which bosses a run meets starts to matter."
 *
 *  A relic is the boss's own signature (signatures.ts), thrown by the fighter
 *  who beat it and set off by something the fighter does - a heavy blow, a
 *  special, a dash, a just guard, the ultimate, the awakening - so nothing
 *  here fires on a clock. Ten bosses carry one so far, one or more at every
 *  rank. A fighter holds three; a fourth is taken in place of one of them, or
 *  left where it fell.
 *
 *  Data and the draft's card ids only (the match server reads it too); the
 *  run (SurvivalGame) does what each one does. */
import type { SigElement } from './signatures';

/** What sets a relic off. */
export type RelicTrigger = 'crowded' | 'combo' | 'special' | 'dash' | 'foresight' | 'heavy' | 'ultimate' | 'awakening';

export interface RelicDefinition {
  /** The boss's enemies.ts id: it is that boss's relic. */
  id: string;
  /** Its power, as the card and the slots name it. */
  name: string;
  /** Drawn large on its seal. */
  kanji: string;
  /** Its colour (bossFx's SIG_ELEMENTS). */
  element: SigElement;
  trigger: RelicTrigger;
  /** Seconds before it can go off again (0: each time its trigger comes). */
  gap: number;
  /** What it does, on its card. */
  text: string;
}

/** How many a fighter holds. */
export const RELIC_SLOTS = 3;

/** Whose power each is, from the bottom of the road to the top. */
export const RELICS: readonly RelicDefinition[] = [
  { id: 'harrow', name: 'THE FUNERAL HOWL', kanji: '遠吠',
    element: 'sound', trigger: 'crowded', gap: 7,
    text: 'When the crowd closes in, you howl: a ring of sound rolls out 9 metres and throws them all down.' },
  { id: 'zarek', name: 'MOLTEN RAKE', kanji: '熔爪', element: 'fire',
    trigger: 'combo', gap: 2,
    text: 'Every 8th hit of a combo rakes five molten claws across the ground ahead of you.' },
  { id: 'nightfall', name: 'CINDER WAVE', kanji: '燼波', element: 'blood', trigger: 'special', gap: 4,
    text: 'Your specials loose a cinder wave: it tears 16 metres on toward what they struck.' },
  { id: 'kade', name: 'STILLING PALM', kanji: '静掌',
    element: 'sound', trigger: 'dash', gap: 3.5,
    text: 'Your dash ends in a stilling palm: the shock goes on through everything 7 metres ahead.' },
  { id: 'kuromitsu', name: 'THE TWELVE EYES', kanji: '十二眼',
    element: 'steel', trigger: 'foresight', gap: 8,
    text: 'Every 8 seconds the next blow at you is seen coming: it misses, and a thrust of tar answers it. A just guard answers too.' },
  { id: 'rime', name: 'THE LONG WINTER', kanji: '長冬',
    element: 'ice', trigger: 'special', gap: 5,
    text: 'Your specials freeze the ground they hit: everything within 4.5 metres is frozen solid.' },
  { id: 'caldera', name: 'CHARRED FIST', kanji: '焦拳',
    element: 'magma', trigger: 'heavy', gap: 1.1,
    text: 'Your heavy blows leave magma where they land: it burns whatever stands in it for 4 seconds.' },
  { id: 'oro', name: 'THE STILL HOUR', kanji: '刻止', element: 'light', trigger: 'ultimate', gap: 0,
    text: 'Your ultimate stops time: for 2 seconds nothing moves but you.' },
  { id: 'haldor', name: 'QUAKE', kanji: '地割', element: 'sound', trigger: 'heavy', gap: 5,
    text: 'A heavy blow cracks the air: the ground splits six ways from where it landed.' },
  { id: 'magatsu', name: 'CARRION FIELD', kanji: '屍原', element: 'blood', trigger: 'awakening', gap: 0,
    text: 'Awakened, you lay out the carrion field: everything within 7 metres is cut, again and again, until it fades.' },
];

export const relicOf = (id: string | undefined) => RELICS.find(relic => relic.id === id);

/** The relic draft's cards (a card id is a string all the way to a co-op
 *  room): give up a held relic for the new one, or leave the new one. */
export const RELIC_LEAVE = 'relic-leave';
export const RELIC_GIVE = 'relic-give:';
export const giveCard = (held: string) => `${RELIC_GIVE}${held}`;
export const givenOf = (card: string | undefined) => card?.startsWith(RELIC_GIVE) ? card.slice(RELIC_GIVE.length) : undefined;
export const isRelicCard = (card: string | undefined) => card === RELIC_LEAVE || !!givenOf(card);

/** A relic's blows grow with the run as a burn does (upgrades.ts burnAt): a
 *  flat number was nothing at level 29. */
export const relicScale = (level: number) => 1 + Math.max(0, level - 1) * .07;
