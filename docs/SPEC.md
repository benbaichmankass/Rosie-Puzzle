# Rosie's Game House: Spec and Instructions

## 0. How to work (read first)

You are the MANAGER session for this build. You are continuing work on the existing game repo and expanding the game that is already there.

- Do not build everything in one session. Break the work into small, separate pieces (for example: map/home page, each mini-game, shared assets, rename).
- Open your own sessions and delegate pieces to them. Run independent pieces in parallel.
- Keep ownership of integration: review what each session returns, keep style and structure consistent, and merge it into the repo.
- Update Ben as soon as each piece is ready (a short message saying what is done and how to try it), so he can give feedback while the rest is still being built. Do not wait until everything is finished.
- Fold his feedback into the relevant piece and keep going.
- Where this spec is vague or silent (see "Open questions" at the end), pick a sensible default, note the assumption in your update to Ben, and keep moving. Do not invent new features beyond this spec.

## 1. Project overview

- Name: **Rosie's Game House**. Ben has already renamed the repo in GitHub to Rosies-Game-House. It is the SAME repo as before, with the same existing game code - you are looking at the right repo. Modify the existing code wherever this spec requires it.
- An adventure game made of many mini-games.
- Characters (some should already exist in the repo): Ben, Chai, Rosie, plus the bunnies and the turtles. Bunnies and turtles are characters in the games too.
- Reference photos: Ben is supplying a file with many photos of the real house, each room, and the characters. Use them as visual reference for the rooms and characters.

## 2. Home page / map

- Looks like a retro Game Boy adventure game. The player moves between places on a map.
- Each place has its own mini-games.
- Places: bedroom, living room, kitchen, bathroom, yard.
- Ben will provide a sketch of the map layout.
- Aesthetic: old-style Game Boy adventure for the map. Each room has its own aesthetic. Each game has its own aesthetic, as specified below.

## 3. Mini-games by location

### 3.1 Bedroom

**Rosie Bed Puzzle**
- First mini-game. No further details were given (see open questions).

### 3.2 Living room

#### Game A: Roomba Fling
- Pinball / fling-style physics game. References: the Perplexity browser's no-internet game, and the "Galaxy" game where you fling a ball between planets. Here the ball is a Roomba in the living room.
- Goal: get the Roomba from one end of the living room to the other with as few flings as possible.
- The floor is dirty. Everywhere the Roomba travels it cleans. Score also counts how much of the floor was cleaned per fling.
- Each level has a different furniture layout.
- Levels are randomly generated every time.
- Difficulty rises with new challenges and barriers.
- Every level includes Rosie lying somewhere: on the floor, the couch, or her bed.

#### Game B: Gas Leak
- Pipe-puzzle style (route the flow correctly across the board). The board is the living room.
- Gas comes from the kitchen, which is on the right side. The left side has the door and two windows.
- Instead of pipes, the player places fans. Each fan can be pointed in a direction and set to one of three strength levels.
- Goal: set the fans so the gas flows out through an open exit (the door or either window).
- Which exits are open depends on difficulty. Higher difficulty means fewer open exits.
- Ben is on the couch smoking a joint. If the gas reaches him, the house explodes and the level is lost.
- If the gas gets out, the player advances to the next level.
- Each level adds more complexity: more fans, more specific setups required.
- Possible extra challenges in higher levels: AC on, ceiling fans on (these create airflow that must be accounted for, for example AC above a window pushes gas out of that window), and routing the gas around furniture and out the window.

### 3.3 Yard (three games)

#### Game A: Jerusalem Boulevard Runner
- Entered by going out the front door.
- Endless runner in the style of Subway Surfers. Player walks Rosie on Jerusalem Boulevard in Yafo (Jaffa).
- Lanes: the middle lane has pedestrians and bikers coming toward you. The side lanes have trains going in each direction (the light rail). Avoid them and go as far as you can.
- Find current photos online of the boulevard (with the trees and the light rail) and use them for the look.

#### Game B: Hose Shooter
- First-person shooter. The player holds a hose.
- Cats run around on the tree, the fence, and in the yard. Shooting cats gives points.
- Occasionally a chicken jumps up from behind the wall. Hitting it gives extra points.
- Hitting the bunnies or turtles that run around loses points.
- Aesthetic: South Park style characters on a bike, cartoonish background.

#### Game C: Garden Defense
- Water the plants faster than the bunnies eat them.
- Start with 5 plants and 3 bunnies. Watering makes plants grow faster. Bunnies eat the leaves, which kills the plant.
- Difficulty rises as bunnies get more aggressive. When a plant is finished off, the same 3 bunnies work on fewer plants (for example 3 bunnies on 2 plants).
- No levels. Score is how long the player keeps the plants alive before the bunnies win.
- Aesthetic: Japanese watercolor with a paper-puppet style.

### 3.4 Kitchen

#### Game A: Cabinet Breaker
- Brick-breaker. The board is the open kitchen cabinets. The bricks are kitchen items: piles of dishes, food, pots and pans.
- Multiple levels with different shapes. Harder over time, ball gets faster.
- Occasionally a slug or a cockroach crawls over the shelves. They are worth extra points. Cockroaches are worth more because they move much faster.

#### Game B: Getting Ready for Shabbos
- Countdown clock from 3 hours before Shabbat until Shabbat starts. Each level is played in 60 seconds of real time.
- The Shabbat start time must update weekly to match the upcoming Friday's Shabbat start time in Tel Aviv. Use a simple integration with a stable, reliable source.
- A series of tasks must be completed before the clock runs out:
  1. Braid a challah: three strands joined at the bottom. The player drags and drops strands over each other in the correct order.
  2. Coffee urn: plug it in and turn it on. Boiling takes 10 seconds and must finish before the clock runs out.
  3. Plata (hotplate): plug it in and place all the food on it: one pot of soup, two trays of food, two challah loaves, one cake. This is a balancing game. Items must be arranged without falling over.
  4. Talk to Mom: the cell phone rings with messages that have multiple-choice answers (all small talk). The player picks the option that gets the parents to end the call before Shabbat starts.
- Aesthetic: BoJack Horseman style animation.

### 3.5 Bathroom

**Squeegee Survival**
- The bathroom floor slants down from the shower toward the sink. The shower is on.
- Goal: squeegee the water toward the shower drain. The player moves the character up and down and taps to swing the squeegee (each tap is one swing). Survival game: see how long you can last.
- Under the sink are 3 shelves. Keep each shelf from being submerged as long as possible:
  - Bottom shelf: cleaning supplies. When it floods, the bathroom fills with soap suds and bubbles. The floor gets slippery and the character is harder to control.
  - Middle shelf: toilet paper rolls. When wet, they fall into the water and clog the drain, so the water drains slower.
  - Top shelf: electric toothbrush and electric hair trimmer. If they get wet, the character is electrocuted and the player loses.
- Aesthetic: Maurice Sendak style illustration.

## 4. Suggested work breakdown (for the manager)

1. Map/home page (Game Boy style), with placeholder rooms.
2. One delegated session per mini-game (nine games total: Rosie Bed Puzzle, Roomba Fling, Gas Leak, Jerusalem Boulevard Runner, Hose Shooter, Garden Defense, Cabinet Breaker, Getting Ready for Shabbos, Squeegee Survival).
3. Shared character and asset work from Ben's photo file (Ben, Chai, Rosie, bunnies, turtles).
4. Integration and consistency review, then a message to Ben after each piece lands.

## 5. Open questions (assume, note it, and move on)

- Rosie Bed Puzzle: no mechanics were given. Propose a simple puzzle and ask Ben.
- Roomba Fling: the "no internet" and "Galaxy" references are from dictated notes and may be slightly off. Treat them as "pinball / sling-the-ball-between-obstacles" style.
- Ben's map sketch and photo file are still to be provided.
- Chai is named as a character with no description. Use the photos.
