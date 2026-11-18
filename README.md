# Rosie's Game House

A retro adventure through Rosie's house: a Game Boy style map whose rooms hold mini-games.

Play: https://benbaichmankass.github.io/Rosies-Game-House/

- `src/App.tsx` hash router (map, room, game), `src/map/` house map, `src/games/<id>/` one folder per game,
  `src/shared/` the contract every game uses.
- Building a game? Read `docs/CONVENTIONS.md`, `docs/SPEC.md`, `docs/DECISIONS.md`, `docs/CHARACTERS.md`.
- Checks: `npm run lint && npm run build && for f in scripts/check-*.ts; do npx tsx "$f" || exit 1; done`
- `main` deploys to GitHub Pages automatically.
