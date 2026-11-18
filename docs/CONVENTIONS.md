# Rosie's Game House: rules for every lane

The game is a Game Boy style house map (`src/map/`) that launches mini-games. Each mini-game is built
by its own session ("lane") in parallel, so these rules exist to stop lanes from colliding.
Read `docs/SPEC.md` (Ben's spec), `docs/DECISIONS.md` (the manager's rulings) and `docs/CHARACTERS.md`.

## What you own
- `src/games/<your-id>/**` (your game: `index.tsx` default export, `meta.ts`, any other files).
- `public/assets/games/<your-id>/**` (sound or other static files, if you need any).
- `scripts/check-<your-id>.ts` (optional headless check, see below).
- The map lane also owns `src/map/**`.

**Do not edit anything else**: not `src/games/registry.ts`, `src/App.tsx`, `src/shared/**`, `src/index.css`,
other games, `package.json`/lockfile, workflows or docs. If you need a shared change or a new npm
dependency, explain it in your PR description and the manager will make it. (Prefer no new deps.)

## The contract
- `src/games/<id>/index.tsx` default-exports `function Game({ onExit }: GameProps)` (`src/shared/types.ts`).
- Always show a reachable way back to the map: render `<ExitButton onExit={onExit} />` from
  `src/shared/ExitButton.tsx` (restyle it with `className` to suit your look; keep the "MAP" label).
- When the game is playable, set `status: 'ready'` in your `meta.ts`. You may refine `title`/`blurb`
  there; do not change `id`, `room` or `spot`.
- Persist best scores/settings only through `src/shared/storage.ts` with your game id.

## Platform
- Mobile-first: portrait phone, design for 390×844, must work from 360 to 430 px wide, touch controls.
  Fill `100dvh` with no page scrolling during play. Also playable with a mouse on desktop.
- Android Chrome is the main target; any modern mobile browser should work. Use pointer events.
- Pause when the tab is hidden (`visibilitychange`). Keep 60 fps on a mid-range phone: prefer
  `<canvas>` with `requestAnimationFrame` for action games; SVG/DOM is fine for puzzles.
- The build is one self-contained `dist/index.html` (vite-plugin-singlefile, `base: './'`). Reference
  static files with relative paths like `assets/games/<id>/hit.mp3` (no leading slash).
- Styling: Tailwind classes, or CSS scoped under a root class `.g-<id>` inside your own files
  (a `<style>` element or a `.css` file you import). Do not add to `src/index.css`.
- Fonts available globally: "Press Start 2P" (`.font-arcade`) and "Pixelify Sans" (`.font-pixel`).
  If your art style needs another Google Font, load it from your component (`<link>` to fonts.googleapis.com).

## Art and sound
- Each game has its own art style (see SPEC/DECISIONS). Draw everything yourself in code
  (SVG/canvas/CSS). Make it look good: this is the main thing Ben will judge.
- Original art only. "In the style of X" means evoke the look; never copy a show's characters,
  logos or frames, and never copy photos from the web into the repo.
- Real photos of Ben, Shai and Rosie are **not** in the repo and must not be added. Your session prompt
  may give you a link to reference photos: look, don't commit.
- The cast must stay recognisable (`docs/CHARACTERS.md`, colours in `src/shared/characters.ts`).
- Sound: synthesize with Web Audio, or use openly licensed recordings placed in
  `public/assets/games/<id>/` and credited in `public/assets/games/<id>/CREDITS.md`. Respect a mute toggle.
- Keep the whole game's assets small (aim < 1 MB per game; everything ships in one file).

## Code quality and checks
- TypeScript strict enough to pass `npm run lint` (tsc --noEmit). No `any` unless unavoidable.
- Keep game rules/simulation/level generation in plain TS modules (no React/DOM) so they can be tested.
- For anything with generated levels or a simulation that must be winnable, add `scripts/check-<id>.ts`
  (run with `npx tsx`) that exits non-zero on failure and runs in under 10 s, e.g. "200 generated levels,
  all solvable". CI runs every `scripts/check-*.ts`.
- Before every push: `npm run lint && npm run build && for f in scripts/check-*.ts; do npx tsx "$f" || exit 1; done`.
- Actually play it in a phone-sized browser (Playwright + Chromium are installed) and look at screenshots.

## Delivery: small and early
1. Branch from the latest `main`. Ship a **playable core first** (first PR within ~1-1.5 hours): the main
   mechanic working with simple art. Then follow-up PRs for levels, art polish and extras.
2. Open a PR into `main`. Title: `<Game title>: <what this PR adds>`. Description: how to play, which spec
   points are done, what's left, and any assumptions you made. The manager reviews, merges and tells Ben.
3. Ben gives feedback through the manager while you keep going. After a merge, branch again from `main`.
4. Don't invent features beyond the spec. Where the spec is silent, pick a sensible default and list it in the PR.
