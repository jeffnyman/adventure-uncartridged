# Game 1 agent

A planning agent that plays Game 1 to a win, plus tools to replay and film the result. It runs the real game code headlessly in Node, with no browser.

## Files

| File                   | Purpose                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `register.mjs`         | Node hook that loads the game's TypeScript and swaps in the headless hardware layer      |
| `headless-hardware.ts` | Stand-in for `src/hardware.ts`: scripted input, in-memory frame buffer, no sound         |
| `model.ts`             | Model of the player's movement, built on the game's own collision code, plus path search |
| `validate.ts`          | Drives the game with random moves and checks the model predicts every step               |
| `agent.ts`             | Follows the route goal by goal and writes the winning input file                         |
| `replay.ts`            | Replays an input file into a fresh headless game and reports the winning frame           |
| `record.mjs`           | Films the real page playing an input file back                                           |
| `game1-win.json`       | The winning input file, one entry per frame                                              |
| `game1-win.webm`       | The recorded video                                                                       |

## The route

Take the yellow key, open the yellow castle and take the sword. Kill the yellow dragon, then the green dragon. Swap the sword for the black key, open the black castle, take the chalice and carry it back to the yellow castle.

The run uses the right difficulty switch at A, so dragons charge the player instead of fleeing the sword. The left switch stays at B.

## Commands

```sh
# Check the movement model against the game
node --import ./tools/agent/register.mjs tools/agent/validate.ts

# Play Game 1 and write the input file
node --import ./tools/agent/register.mjs tools/agent/agent.ts tools/agent/game1-win.json

# Confirm the input file wins
node --import ./tools/agent/register.mjs tools/agent/replay.ts tools/agent/game1-win.json

# Watch it in a browser, with the dev server running
#   http://localhost:5173/adventure-uncartridged/?replay=/adventure-uncartridged/tools/agent/game1-win.json

# Film it (see record.mjs for the PLAYWRIGHT, CHROMIUM and FFMPEG settings)
node tools/agent/record.mjs http://localhost:5173/adventure-uncartridged/ \
  tools/agent/game1-win.json tools/agent/game1-win.webm
```

## Input file format

`frames` holds one number per game frame. Its bits are up 1, down 2, left 4, right 8, fire 16, reset 32 and select 64. Games 1 and 2 use no randomness, so the same frames always produce the same game.
