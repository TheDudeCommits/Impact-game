# Voice situations

What a fighter says besides the names of their moves, when, how often, and who hears it. Decided once on launch day
(12 October 2026) and held to the code by `tests/voiceSituations.test.ts`: the table below is read by that test against
`SITUATION_RULES` in `src/audio/voiceSituations.ts`, so a number changed in one and not the other fails.

Until this, a fighter spoke when they attacked, awakened, won, or were picked on the home page. Every moment in which a
body is *acted on* was silent, apart from two quips the local player alone could hear.

## The kinds

| kind | when | chance | rest (s) | same line again (s) | delay (s) | priority | longest (s) | who hears it |
|---|---|---:|---:|---:|---:|---:|---:|---|
| `hurt` | a hit taken (flinch, hurt, stun) | 25% | 1.2 | 4 | 0 | -1 | 0.9 | anyone within 25 m, if a speaker's place is free |
| `hurt-heavy` | a launch, a knockdown, a wall splat, a ground bounce | 60% | 2.5 | 6 | 0 | -0.5 | 1.7 | the same |
| `ko` | knocked out: the victim | 100% | 0 | 0 | 0 | 1.5 | 2.6 | anyone within 25 m |
| `kill` | scored a knockout: the killer | 100% | 8 | 30 | 0.6 | 1 | 2.6 | anyone within 25 m |
| `bell` | FIGHT! | 100% | 20 | 0 | 0 | 1 | 3.5 | this client: the local fighter, then the nearest opponent |
| `parry` | a perfect guard, the vanish out of one, a blow dodged | 100% | 20 | 30 | 0.15 | 0.5 | 2 | anyone within 25 m |
| `low` | health first at 30% or under, once a life (again after 90 s still low) | 100% | 0 | 30 | 0.2 | 1 | 3.3 | anyone within 25 m |
| `taunt` | the emote wheel (keys 1 to 4, the D-pad) | 100% | 8 | 0 | 0 | 0.5 | 3.5 | this client (a co-op party hears each other's) |
| `win` | the result: the champion, where they have a win line (else their home line, as always) | 100% | 0 | 0 | 0 | 1 | 4 | everyone, centred |
| `loss` | the result: the local fighter, when they did not win | 100% | 0 | 0 | 0 | 1 | 4 | this client, centred, after the winner's line |

Reading the columns:

- **chance**: the share of opportunities taken. A roll is hashed from the speaker and the event's id (`voiceRoll`), never
  drawn at random, so every client in a room makes the same call and an event planned twice is answered the same. Every
  perfect guard speaks; a dodge speaks a quarter of the time (any blow through a dash's first frames is a dodge).
- **rest**: seconds of server time the kind is quiet for that fighter after a line of it. A cry of either weight rests
  both, so a launch and the wall it meets are one cry. A perfect guard and the vanish out of it are one moment: one roll.
- **same line again**: seconds before that fighter says the same line again, in any kind. A fighter with one line of a
  kind is therefore quiet for it that long; a fighter with two alternates.
- **delay**: seconds after the event. The killer's line waits for the victim's cry.
- **priority**: added to the event's base (4 when the local fighter is the event's actor or target, 1 otherwise), exactly
  as a move's is: efforts 0, a heavy's call 0, a special's or an area move's 1, an ultimate's 2, an awakening line 0.5.
- **longest**: no line of the kind may be longer. In-fight lines are kept short because there are only two speakers.

## The rules that hold in a room of twelve

These are the mixer's (`CombatAudio.play`), unchanged, plus one:

1. **Two speakers at once.** A third is dropped unless its priority is at least the weaker of the two.
2. **Nothing past 25 m**, and a line fades with distance (half at 8.7 m).
3. **The local fighter first**: an event the local fighter is in outranks one they are not by 3.
4. **New: a line that yields never cuts in.** Every situation line but the knockout cry yields:
   - it is never said over a line *its own speaker* is still saying. A signature always takes precedence; the kill line of
     a fighter still naming the move that scored it is dropped.
   - a cry (`hurt`, `hurt-heavy`) also never takes a speaker's place from anyone: with two voices already speaking it is
     dropped. **A hit cry never cuts a move's call**, its own fighter's or anybody else's.
   - a line that cannot be said at its moment is dropped, never played late.
5. The knockout cry does not yield: the body it cuts off has just been knocked out.
6. A situation line is in the `impact` phase: the speaker's *next* move line cuts it, and no cast cancels it. It never
   keeps a move's own voice from being planned: a cast is voiced exactly as it was before the situations existed.

In a royale this means most hit cries are heard only near the local fighter and many are dropped by design: a fight of
twelve is not twelve people shouting.

## Who plans what

- `planReaction` in `src/audio/voicePlan.ts` plans `hurt`, `hurt-heavy`, `ko`, `kill`, `parry` and `low` from the events
  the server already sends: `hit`, `wall-splat`, `ground-bounce`, `eliminated`, `just-guard`, `vanish`, `dodge`, and
  `respawn` (which arms `low` again, as does health back over 60%). `planVoice` calls it for those events;
  `planCombatAudio` passes it a `VoiceScene` (the fighter each side is playing, the target's health), which
  `CombatAudio.handle` reads off the players. Nothing was added to the simulation or the protocol.
- `CombatAudio.bell()` (the FIGHT card's beat), `CombatAudio.say('taunt', id)` (the emote wheel), and at the result
  `CombatAudio.winLine(...)` and `lossLine(...)` say the four that no combat event carries.
- The Rift's enemies are nobody here: bosses keep their own voices (`RiftAudio`), and no roster line is put in an
  enemy's mouth.
- `QuipDirector` keeps only what no situation covers: the local player's advantage line on a guard or poise broken.

## Nothing that was heard before is taken away

The situations add occasions; they do not remove one. Held by tests (`tests/voiceSituations.test.ts`,
`tests/victoryQuote.test.ts`, `tests/ampereIntegration.test.ts`):

- **The win.** Every winner said their home-screen line at the win, timed with the finale and fetched with the room.
  A fighter with no `win` line still does, by the same statement in `main.ts`. A fighter with a `win` line says that
  instead, at the same moment; the finale is timed on it (`CombatAudio.winSeconds`), and if it cannot be played the
  home line is said. Nobody wins in silence.
- **The local player's two quips.** The *resolve* line on a perfect guard: every perfect guard speaks (it rests 20 s;
  the quip rested 90). On a hit at low health: said when health first falls low, and again after 90 s still low, as the
  quip was. The *advantage* line on a knockout: the `kill` line, every 8 s at most. On a guard or poise broken: still
  `QuipDirector`'s, unchanged.
- **A move's own voice.** Calls, efforts, enders, awakening and cinematic lines are planned exactly as before; a
  situation line never keeps one from being planned.

## Where the lines come from

`LINES` in `src/audio/voiceSituations.ts`, one row a fighter. A fighter with no line of a kind is silent for it. There are
two borrowings, both of the fighter's own lines:

- the two quips every fighter already has: the *advantage* line is a `kill` line, the *resolve* line is said for `low`
  and `parry`, beside any line the kind has of its own;
- a heavier cry or a knockout with no line of its own is the next lighter cry (`ko` from `hurt-heavy` from `hurt`).

A line is either a cue of the roster bank or `rift:<name>`: one of the fighter's own Rift-boss lines, played from the
file that already ships (`public/assets/audio/survival/boss-<name>.m4a`) and brought to the roster's level at playback
(`src/audio/data/riftLineLevels.json`). Its provenance row is where it
always was: the voice manifest for a cue, `survival/boss-voices.json` for a Rift line.

## Loading

A room loads its own fighters' lines and nobody else's. Cues come with the fighter's other cues (`CombatAudio.prepare`);
Rift lines are fetched and decoded beside them (`situationSamples`), and the match warm-up waits for both
(`CombatAudio.ready`, `src/loading/matchWarmup.ts`), so no line is decoded on its first use in a fight. `retain` lets a
fighter's lines go with them.

## Turning a line down

A line listed in `src/audio/data/voiceRejects.json` (a fighter, a situation and the line) is never played in that situation.

## Adding a line

Add it to the fighter's row in `LINES`. A cue must be registered and have its manifest row, as any voice cue; the test
checks that it is the fighter's own, no longer than its kind allows, and in one kind only.
