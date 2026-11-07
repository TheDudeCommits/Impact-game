# Impact

Impact is a free, open-source arena fighter that runs in the browser. Every fighter in it is an original character made
for the game: their names, faces, outfits, moves, voices and themes are its own.

You pick a fighter and fight in one of the game's modes: one-on-one Duels, twelve-player battle royales against people or
bots, private rooms, a Training Ground, co-op Arcade Survival against waves and bosses, and the objective modes Last Stand,
Bad Blood and Rift War. It plays with a keyboard and mouse, a controller or touch.

**Play it at [impact.dude.work](https://impact.dude.work).**

## Running it locally

You need [Node.js](https://nodejs.org) 22.12 or newer and git. Clone your fork, then install the packages:

```sh
npm ci
```

Start the match server (Colyseus, on port 2567):

```sh
npm run server
```

In a second terminal, start the page (Vite, on port 5173):

```sh
npm run dev
```

Open <http://localhost:5173>. The Training Ground and the offline modes run in the page alone; online matches, parties and
accounts need the server. The dev server forwards `/matchmake`, `/health` and `/ws` to the server on 2567.

Controls on a keyboard: WASD moves, the mouse turns the camera, J/K or the left/right mouse buttons are light and heavy
attacks, Q is the special, R the ultimate, F guards, Shift dashes, Space jumps and Tab changes target. Settings lists the
rest, and the controller layout.

Other commands:

| Command | What it does |
| --- | --- |
| `npx tsc --noEmit` | Type-checks the source, the tests and the build configuration. |
| `npm test` | Runs the tests (Vitest). |
| `npm run build` | Type-checks, then builds the page into `dist/`. |
| `npm run preview` | Serves the built page on port 4173. |

`vite.config.ts` reads the current commit from git for the build stamp; outside a git checkout, set `VITE_BUILD_SHA` to any
text first.

### Settings

Nothing has to be configured to play locally. A deployment sets these in the environment (the page's `VITE_*` settings in
`.env.local` or the build's environment; the server's in its own environment). `.env.example` lists them all with their
defaults.

| Setting | Default | What it is |
| --- | --- | --- |
| `VITE_MATCH_SERVER` | this page's host, port 2567 | The match server the page connects to. |
| `VITE_SITE_URL` | `http://localhost:5173` | Where the game is served: canonical and shared links, the legal pages. |
| `VITE_SERVER_HOST`, `VITE_DISCORD_INVITE` | none | The server's host as the privacy page names it; a Discord button. |
| `PORT` | `2567` | The server's port. |
| `DATA_DIR` | none (memory only) | Where the server keeps accounts and progress. |
| `ECONOMY_ORIGINS` | none (localhost only) | Origins allowed to call the accounts API. |
| `PRIVY_APP_ID` | none (sign-in off) | Turns on sign-in with a Privy app; without it everyone plays as a guest. |

The server can also be built as a container image: see `Dockerfile`.

## The stack

TypeScript throughout. The page is built with [Vite](https://vite.dev) and drawn with [three.js](https://threejs.org). The
match server is [Colyseus](https://colyseus.io) on Node.js and owns the simulation, which the page also runs ahead for your
own fighter. Collision is [Rapier](https://rapier.rs). The tests are [Vitest](https://vitest.dev).

## A map of the source

| Where | What |
| --- | --- |
| `src/main.ts`, `index.html` | The page's entry: boot, home, fighter select, the match loop. |
| `src/game/` | The simulation, shared by the server and the page: movement, moves, combos, awakenings, bots, stages as collision, and the rules of each mode (`duel/`, `objectives/`, `moba/`, `training/`). `src/game/fighters/` holds fighters' moves as data; `src/game/economy/` the in-game currency, earned by playing. |
| `src/engine/` | The fighter engine: one specification per fighter (`sim/`), the effects data (`vfx/`) and what the page reads of them (`client/`). |
| `src/originals/` | The roster, its names, stages, sounds and voices, the launch gate (which fighters, stages and modes a build shows) and the game's name and settings (`brand.ts`). |
| `src/server/` | The match server: rooms for each mode, the input queue and step clock, accounts (`economy/`), parties and custom rooms (`social/`). |
| `src/render/` | Everything drawn: fighters and their animation, stages, effects (`vfx/`, `signature/`), the camera, the looks. |
| `src/ui/` | The interface: home, fighter select, the HUD (`hud/`), results, options, the legal panel. |
| `src/audio/` | Music, sound effects and voices as cue plans, and the mixer. |
| `src/survival/` | Co-op Arcade Survival: rounds, enemies, bosses, the skill tree. |
| `src/input/`, `src/network.ts`, `src/network/`, `src/loading/`, `src/social/` | Keyboard, pad and touch; the connection to the server; loading and fallbacks; parties and invites. |
| `public/` | The game's assets (`public/assets/`), icons and the legal pages. |
| `tests/`, and `*.test.ts` beside the code | The tests. |
| `scripts/build/` | What the build configuration imports (the brand and launch plugins, the credits page). |
| `tools/` | Dev-only pages served by `npm run dev` (the HUD lab, pose and bust renderers). |

## What is not included, and why

Some of the game's assets are held back from this repository until they are replaced with ones that are the project's own
or clearly licensed: a number of fighters' animation clips, some fighter bodies, some stage models, much of the sound and
music, a separate effects library (the VFX Armory, which has its own licence), and two fonts. They will be added as they
are replaced.

The game runs without them. A fighter whose clip is missing falls back to a shared clip where one exists, a missing sound
is silent, a missing stage model or effect is drawn without it, and the fonts fall back to Barlow Condensed and the
system's. Expect some fighters to move more plainly than they will, and some moves to look and sound sparser.

Some places are out of the stage rotation until their models return, and the tests that read held-back files are
skipped by name (`tests/setup/heldBack.json`); take a test off that list when what it reads is back.

## Credits and licences

The project's own code and assets are under the [MIT licence](LICENSE). Third-party assets in this repository stay under
their own licences, listed with their authors and sources in [CREDITS.md](CREDITS.md); the in-game credits page is drawn
from the same file.

## If something of yours is in the game

If you hold the rights to something in this repository or the game, or made it, and want it credited differently or
removed, email **Hello@Dude.work**. It helps to say who you are, what it concerns (with a link or a screenshot), and what
you would like done. Material is removed promptly.

## Contributing

Issues and pull requests are welcome: see [CONTRIBUTING.md](CONTRIBUTING.md). Every change to `main` is reviewed and
approved by the maintainer.
