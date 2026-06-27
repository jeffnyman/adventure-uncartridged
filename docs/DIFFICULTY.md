# Difficulty Switches

The Atari 2600 has two physical difficulty switches, one for each player, labeled **A** (professional) and **B** (amateur). In _Adventure_, both switches are read once per frame in `dragonSeekFlee` (`src/adventure.ts`) and stored in `difficultyLeft` and `difficultyRight`. They control two completely separate behaviors, one per switch.

---

## Left Difficulty Switch — Bite Hesitation

The left switch controls how long a dragon "roars" before it actually bites and captures the ball. When a dragon makes contact with the ball, the dragon transitions to state 3 (roaring) and a countdown timer is set:

```typescript
timer = 0xfc - dragonDiff[gameLevel * 2 + (gameDifficultyLeft == Difficulty.A ? 1 : 0)];
```

The `dragonDiff` table in `src/data.ts` encodes the value subtracted from `0xFC`:

| Level | Difficulty B (Amateur) | Difficulty A (Professional) |
| ----- | ---------------------- | --------------------------- |
| 1     | `0xD0` (208)           | `0xE8` (232)                |
| 2     | `0xF0` (240)           | `0xF6` (246)                |
| 3     | `0xF0` (240)           | `0xF6` (246)                |

A higher subtracted value means a smaller timer, which means fewer frames before the bite. So Difficulty A (higher value subtracted) gives the dragon a shorter fuse.

The resulting hesitation timers in frames:

| Level | Difficulty B                  | Difficulty A                  |
| ----- | ----------------------------- | ----------------------------- |
| 1     | `0xFC − 0xD0` = **44 frames** | `0xFC − 0xE8` = **20 frames** |
| 2     | `0xFC − 0xF0` = **12 frames** | `0xFC − 0xF6` = **6 frames**  |
| 3     | `0xFC − 0xF0` = **12 frames** | `0xFC − 0xF6` = **6 frames**  |

### Why the Difference is Hard to Notice

On original 2600 hardware running at ~60Hz, game logic executed once per frame, so the level 1 gap translated to:

- **B:** 44 / 60 ≈ **0.73 seconds**
- **A:** 20 / 60 ≈ **0.33 seconds**
- Difference: ~0.4 seconds

This implementation sets `FPS = 58`, but on a 60Hz monitor the `requestAnimationFrame` loop only fires game logic on every other display frame, giving an effective game logic rate of ~30fps. At that rate the absolute hesitation windows are longer than the original, but the _difference_ between the two settings remains about 0.8 seconds at level 1:

- **B:** 44 / 30 ≈ **1.47 seconds**
- **A:** 20 / 30 ≈ **0.67 seconds**

At levels 2 and 3, the gap collapses to just 6 frames (about 0.1 to 0.2 seconds at any reasonable frame rate) which is entirely imperceptible in play regardless of difficulty setting.

The left switch was always a feel knob rather than a mechanical one. On real hardware, experienced players would just find themselves bitten "faster" on Difficulty A without being able to articulate exactly why.

---

## Right Difficulty Switch — Sword Fear

The right switch changes whether dragons actively fear the sword. In `dragonSeekFlee`, each dragon's behavior matrix is walked to find a target:

```typescript
let i = right === Difficulty.B ? 0 : 2;
```

Every dragon's matrix begins with the sword as the first entry (flee target). Starting at index 0 (Difficulty B) includes that entry, so when the sword is in the same room the dragon turns and runs. Starting at index 2 (Difficulty A) skips the sword entry entirely, so the dragon ignores the sword and goes straight to chasing the ball or other objects.

This switch has a much more noticeable effect than the left one: on Difficulty A, carrying the sword provides no protection and dragons pursue the ball regardless.

---

## Movement Speed is Not Difficulty-Controlled

Dragon movement speed is hardcoded per dragon at the `moveDragon` call sites:

| Dragon | Speed |
| ------ | ----- |
| Green  | 2     |
| Yellow | 2     |
| Red    | 3     |

No difficulty switch alters these values. The red dragon is unconditionally faster than the other two; there is no setting that makes any dragon slower or faster.

---

## Default State

Both difficulty variables default to `Difficulty.B`, matching the hardware default on the original 2600 console (the physical switches defaulted to the B position when the machine was powered on). The `Difficulty.B` defaults in `src/hardware.ts` preserve this.
