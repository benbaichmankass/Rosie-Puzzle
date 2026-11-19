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
Waking Rosie costs points (Ben's call): every time the Roomba bumps her (on the floor, her bed, or the sofa right
where she sleeps) she wakes up grumpy (growl, "Grr!", annoyed mark, open eyes), a floating "-150" shows and the
level-clear tally lists "Woke Rosie xN". A short cooldown makes one collision count once; she settles back to
sleep after a moment. A level's score never drops below 0. The start screen says "Don't bump Rosie, she's napping!".

## Gas Leak (living room)
Top-down grid of the living room. Gas enters from the kitchen side (right). The left wall has, top to bottom: a
window, the door, a window with an AC unit (matches the house plan). Bentzi sits on the couch. **Real time, no RUN
button (Ben's call):** after a 3-2-1 countdown the gas starts leaking on its own, seeping slowly at first and then
speeding up. The player places fans from a limited supply and sets each fan's direction and strength (1-3) while the
gas flows; every change affects the gas on the next tick. The gas travels as one stream pushed by fans. If it is blocked
or circles over its own trail, pressure builds; at the limit the room fills up. Win: gas leaves through an open exit.
Lose: gas reaches Bentzi, or the room fills (cartoon "BOOM", no gore). Level clear shows the time and 1-3 stars against
the level's par; best time and stars are kept per level. Retry restarts the leak with no fans. Fewer open exits as
levels rise; later levels add AC airflow, ceiling fans and furniture to route around. Levels must be provably winnable
in real time: the check script builds each stored solution one fan every 2.5 s (from the countdown) in the same
simulation and must win.

## Jerusalem Boulevard Runner (yard, street door)
Behind-the-back 3-lane endless runner, Rosie on a leash (Bentzi's arm and the leash in view). Middle lane: a wider
two-way bike path (red asphalt, dashed centre line, painted bike symbols) with pedestrians and bikers coming at you,
plus low things to jump. Side lanes: the light rail, one direction per side: oncoming trams on the left, slower
trams going your way on the right (you catch up with them; some have a yellow ramp at the rear). Trams telegraph
before arriving (bell, glowing rails, warning sign). Swipe left/right to change lane, swipe up to jump. Speed ramps
up; score = distance. Draw the boulevard (ficus/palm trees, red-line tram) yourself; do not copy web photos.
Ben's feedback (round 1):
- Lively animation: Rosie's run cycle (legs, body bounce, flapping ears, head bob, wagging tail), squash and stretch
  on jumps/landings, lean into lane changes; the leash swings and Bentzi's hand bobs and is tugged; walkers and
  bikers have walk/pedal cycles; trees sway.
- Tram roofs (Subway Surfers style): being in the air when a tram reaches you, or running up a rear ramp, puts Rosie
  on the roof. She runs along it and drops off its end; she can hop down to the bike path, or leap across the bike
  path onto a tram on the other track if one is alongside. Running into a tram on the ground (front or rear) is a
  crash. The spawner and `scripts/check-boulevard-runner.ts` model roofs and prove every run stays passable.
- Light rail stations along the boulevard with the real Red Line station names on Sderot Yerushalayim (north to
  south: Shalma, Bloomfield Stadium, Ehrlich, Isakov, HaBesht, Machrozet, repeating). Side platforms with shelters,
  a hanging name sign and a totem sign (Hebrew + English); a tram often waits at the platform (a still obstacle you
  can climb). A "Next stop" banner shows the station name.
- Shop fronts carry the names of real businesses on the boulevard (confirmed from published listings; plain
  lettering, no logos): a sign over each shop window and a hanging blade sign.
- Treats (dog-biscuit bones) lie in rows in the lanes, on the street or on tram roofs: +10 points each. Score =
  metres walked + treat/power-up points; best score kept. Every ~500-800 m a power-up (+50): the skateboard (8 s:
  20% faster, auto-jumps low stuff, and takes one hit for Rosie, after which she is briefly untouchable; a hit
  from a tram puts her on its roof) or the treat magnet (10 s: pulls in treats from every lane). The active
  power-up shows with a timer bar. Treats are only placed where collecting them never forces a crash; the check
  script proves it for every treat with the real timings, and checks the run is passable at skateboard speed.

## Hose Shooter (yard, back wall)
First-person view of the yard's back wall: a tree, the fence/wall top, dirt yard. Drag to aim the hose nozzle,
hold to spray (water stream with arc). Cats run along the tree, wall and ground: +points. A chicken sometimes pops
up from behind the wall: big bonus. Bunnies and turtles wander through: hitting them costs points. 60-second rounds,
best score kept. Look (Ben's call): old western. The same yard as a dusty sun-bleached showdown (adobe wall, plank
fence, desert tree, mesas beyond the wall, tumbleweeds and dust), cut-paper characters: outlaw cats in bandit masks and
bandanas, the chicken as a bonus "outlaw" in a hat, the real bunnies and turtles unchanged. The nozzle is held like a
six-shooter; READY/STEADY/DRAW countdown; wanted-poster start and game-over screens, score on a wooden sign, sheriff-star
timer, twangy guitar sounds. The "characters on a bike" note in the spec is unclear; ignore it unless Ben clarifies.

## Garden Defense (yard, bunny wall)
Side view of the bed along the yard's left wall, with the apartment block across the street (windows, nosy
neighbours) showing over the wall. 5 hedges, the 3 real bunnies. Goal (Ben's call): grow the hedges tall enough to
hide the apartments. Tap/hold a hedge to water it (watering can); watered hedges grow taller and fuller. Bunnies hop
to hedges and eat leaves; a hedge with no leaves dies (it leaves a gap). Tapping a bunny does nothing (you can only
water). Bunnies get faster/greedier over time; the same 3 bunnies move on to the remaining hedges. WIN when every
hedge still alive reaches the red target line (hedges saved shown on the win screen); LOSE when the bunnies kill all
the hedges. Result screen: win/lose, time, hedges saved; best = most hedges saved, then fastest win. A good player
wins in about 2-3 minutes. Look: Japanese watercolor with paper-puppet (jointed cut-paper) animation.

## Cabinet Breaker (kitchen)
Classic brick-breaker in portrait. Paddle at the bottom (drag). Multiple level shapes, ball speeds up. A slug (slow,
bonus) or a cockroach (fast, bigger bonus) sometimes crawls across the shelves; hit it with the ball. 3 lives.
Look (Ben's call: based on his photos of the real kitchen): the board is the run of white flat-panel upper cabinets
with their doors swung open (antique-brass bow handles), white shelves inside, the light wood ledge on top with
boards, the copper-handled pan and a trailing fern, and the glossy black marble backsplash behind the play area.
The bamboo cutting-board paddle runs along the black speckled granite counter (white base cabinets with a drawer
stack, gooseneck tap, white stove at the end). Bricks are that kitchen's things: dish-rack plates, glasses of water,
steel bowls, the green colander, Spark soap + pump, the pink French press, paper towels, the filter jug, pickles
(1 hit); kettle, tomato cans, utensil crock, SodaStream, steel pot (2 hits); clay pot, air fryer, pan (3 hits).

## Getting Ready for Shabbos (kitchen counter)
Shabbat candle-lighting time for Tel Aviv from Hebcal (no key, CORS ok):
`https://www.hebcal.com/shabbat?cfg=json&geonameid=293397&M=on`, item with `category: "candles"`. Cache it in
storage; if offline, fall back to a computed or last-known time and say so. The clock shows the 3 hours before
candle lighting, compressed into 60 real seconds per level, and ticks every second (louder in the last 10).
**Everything happens at once on ONE counter screen (Ben's call: "it should feel like chaos")**: no task picker and
no separate task screens. All four stations are visible and directly playable at the same time: the challah board,
the coffee urn, the plata and the phone. Tasks (any order): braid the challah (drag an outside strand over toward
the middle, alternating sides; forgiving drop, grab handles, a hint after a few idle seconds), plug in and switch on
the urn (10 s boil runs in the background and must finish), load the plata (plug in, then drag the soup pot,
2 trays, 2 challahs and 1 cake on without anything toppling: simple stacking physics), answer Mom's calls (the phone
rings and buzzes across the counter until you tap it; her messages pop up as speech bubbles with multiple-choice
small-talk replies you tap; the right answers end the call sooner, while the other stations keep running). Urgency
cues: buzzing/vibrating phone, urn steam, ticking clock, stations flash red when they need attention (ringing phone,
urn not on with boil time running short, a topple, anything unfinished in the last 15 s). Levels get tighter (more
strands and crosses, trickier balance on a narrower plata, more calls). Look: BoJack Horseman-like flat 2D cartoon
(kitchen restyle pending Ben's house video).

## Squeegee Survival (bathroom)
Side/top view: floor slopes from the shower down toward the sink; shower is on, water flows downhill. The player
moves up/down along the floor and taps to swing the squeegee (one tap = one push of water toward the drain). Three
shelves under the sink flood as water rises: bottom = cleaning supplies (suds, slippery controls), middle = toilet
paper (falls in, clogs the drain, slower draining), top = electric toothbrush and trimmer (electrocution, game over).
Score = survival time. Look: Maurice Sendak-like pen-and-ink with watercolor wash.
