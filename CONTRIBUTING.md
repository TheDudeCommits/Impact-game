# Contributing to Impact

Thank you for helping. Bug reports, fixes, new features, tests and art are all welcome.

## How a change gets in

1. **Fork** the repository on GitHub and clone your fork.
2. **Branch** from `main` for each change: `git checkout -b fix-guard-break` (a short name that says what it is).
3. Make the change, with a test where it can have one, and check it (below).
4. Push the branch to your fork and open a **pull request to `main`**. Fill in the template: what it changes, why, and how
   you checked it. Screenshots or a short clip help for anything you can see or hear.

`main` is protected. Nothing is pushed to it directly: every pull request needs the maintainer's review and approval
before it is merged, and the checks must pass. The maintainer may ask for changes, or decline a change that does not fit
the game; a reply on the pull request says why.

## Before you open the pull request

```sh
npm ci
npx tsc --noEmit
npm test
```

All three should pass. For anything that changes how the game plays, looks or sounds, run it (`npm run server` and
`npm run dev`, see the README) and try the change in a match.

Keep a pull request to one change. Follow the code around you: TypeScript, the same naming, and comments that say why
something is as it is.

## Assets and other people's work

Only add what you made yourself, or what is under a licence that allows it to be shared here (CC0, CC BY, the SIL Open
Font License, MIT and the like):

- Nothing taken from another game, film, series or show, and nothing made from such material (re-posed, retargeted,
  traced, or "inspired" so closely that it reads as the original). This holds for characters, names, moves, models,
  animations, sounds, music, voices, fonts and pictures.
- For a third-party asset, add a line to [CREDITS.md](CREDITS.md) in the same pull request: what it is, its author, where
  it is from, its licence and what you changed.
- If you are unsure whether something may be added, ask in an issue first.

By contributing you agree that your contribution is released under the project's [MIT licence](LICENSE) (and, for a
third-party asset, under its own licence as listed in CREDITS.md).

## Reporting a problem

Open an issue with what happened, what you expected, and how to make it happen again (browser, device, mode, fighter).
For a security problem, do not open a public issue: email **Hello@Dude.work** with "Security" in the subject.
