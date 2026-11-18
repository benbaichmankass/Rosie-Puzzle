# Manager decisions (where the spec is silent)

These are defaults chosen to keep moving; Ben may change them. Lanes follow them unless Ben says otherwise.

## Global
- Names: **Bentzi**, **Shai**, **Rosie** (Ben's call: keep the current names).
- Real photos stay out of the repo (Ben's call). Everything is drawn in code.
- Map is built from Ben's sketch (`docs/map-sketch.jpg`).
- "In the style of" (South Park, BoJack Horseman, Maurice Sendak, Japanese watercolor) means an original
  look that evokes it, never copied characters.
- Each game keeps a best score with `src/shared/storage.ts` and shows it on its start/game-over screen.
- Every game has a start screen (title, one-line how-to-play, PLAY), and a game-over/level-clear screen with
  score, best, RETRY and MAP.

## Rosie Bed Puzzle (bedroom)
The existing bedtime puzzle IS this game. Unchanged apart from a map button.

## Map (lane: map)
Game Boy Color look (Ben's call: GBC colours, not green monochrome): limited per-tile 4-colour palettes, pixel tiles, pixel font. Bentzi walks around the plan (Rosie follows),
with an on-screen D-pad and tap-to-walk. Walking onto a game spot (door/wall/furniture) shows a prompt to play.
Keep the room list under the map so every game is two taps away.

## Roomba Fling (living room)
Top-down living room. Drag back from the Roomba and release to fling it (slingshot); it slides with friction and
bounces off walls and furniture (pinball feel). Start at one end, goal dock at the other. The floor starts dirty;
the Roomba's path cleans it. Score per level rewards few flings and high % cleaned. Rosie lies somewhere each level
(floor, couch or her bed) as an obstacle. Layouts randomly generated each time, always reachable (check script).
Later levels add more furniture and new obstacles (e.g. a moving obstacle, narrow gaps, rugs that slow you).

## Gas Leak (living room)
Top-down grid of the living room. Gas enters from the kitchen side (right). The left wall has, top to bottom: a
window, the door, a window with an AC unit (matches the house plan). Bentzi sits on the couch. The player places
fans from a limited supply, sets each fan's direction and strength (1-3), then presses RUN; gas spreads as a
simple grid flow sim pushed by fans. Win: gas leaves through an open exit before reaching Bentzi. Lose: gas reaches
Bentzi (cartoon "BOOM", no gore). Fewer open exits as levels rise; later levels add AC airflow, ceiling fans and
furniture to route around. Levels must be solvable (check script with a solver or a known solution per level).

## Jerusalem Boulevard Runner (yard, street door)
Behind-the-back 3-lane endless runner, Rosie on a leash pulling Bentzi (or Rosie alone). Middle lane: pedestrians
and bikers coming at you. Side lanes: the light rail, one direction per side; trains telegraph before arriving.
Swipe left/right to change lane, swipe up to jump low obstacles. Speed ramps up; score = distance. Draw the
boulevard (ficus/palm trees, red-line tram) yourself; do not copy web photos.

## Hose Shooter (yard, back wall)
First-person view of the yard's back wall: a tree, the fence/wall top, dirt yard. Drag to aim the hose nozzle,
hold to spray (water stream with arc). Cats run along the tree, wall and ground: +points. A chicken sometimes pops
up from behind the wall: big bonus. Bunnies and turtles wander through: hitting them costs points. 60-second rounds,
best score kept. Look: cut-out construction-paper characters (South Park-like) on a cartoon background. The
"characters on a bike" note in the spec is unclear; ignore it unless Ben clarifies.

## Garden Defense (yard, bunny wall)
Side view of the bed along the yard's left wall. 5 plants, the 3 real bunnies. Tap/hold a plant to water it (watering
can); watered plants grow leaves faster. Bunnies hop to plants and eat leaves; a plant with no leaves dies. Tapping a
bunny does nothing (you can only water). Bunnies get faster/greedier over time; the same 3 bunnies move on to the
remaining plants. Game over when all plants are dead. Score = survival time. Look: Japanese watercolor with
paper-puppet (jointed cut-paper) animation.

## Cabinet Breaker (kitchen)
Classic brick-breaker in portrait. Board = open kitchen cabinets; bricks = stacks of dishes, food, pots and pans
(some take more hits). Paddle at the bottom (drag). Multiple level shapes, ball speeds up. A slug (slow, bonus) or a
cockroach (fast, bigger bonus) sometimes crawls across the shelves; hit it with the ball. 3 lives.

## Getting Ready for Shabbos (kitchen counter)
Shabbat candle-lighting time for Tel Aviv from Hebcal (no key, CORS ok):
`https://www.hebcal.com/shabbat?cfg=json&geonameid=293397&M=on`, item with `category: "candles"`. Cache it in
storage; if offline, fall back to a computed or last-known time and say so. The clock shows the 3 hours before
candle lighting, compressed into 60 real seconds per level. Tasks (any order): braid the challah (drag strands over
each other in the right order), plug in and switch on the urn (10 s boil must finish), load the plata (plug in, then
place soup pot, 2 trays, 2 challahs, 1 cake without anything toppling: simple stacking physics), answer Mom's calls
(multiple-choice small talk; the right answers end the call sooner). Levels get tighter (more strands, trickier
balance, more calls). Look: BoJack Horseman-like flat 2D cartoon.

## Squeegee Survival (bathroom)
Side/top view: floor slopes from the shower down toward the sink; shower is on, water flows downhill. The player
moves up/down along the floor and taps to swing the squeegee (one tap = one push of water toward the drain). Three
shelves under the sink flood as water rises: bottom = cleaning supplies (suds, slippery controls), middle = toilet
paper (falls in, clogs the drain, slower draining), top = electric toothbrush and trimmer (electrocution, game over).
Score = survival time. Look: Maurice Sendak-like pen-and-ink with watercolor wash.
