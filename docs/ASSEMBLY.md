# Adventure for the Atari 2600: Assembly Reference

This document explains how the Atari 2600 worked as a hardware platform and then walks through the `adventure.asm` disassembly line by line in terms of what each major section does and why it does it that way. No modern codebase knowledge is required; this document stands alone for anyone curious about the original 1979 game or the machine it ran on.

---

## Table of Contents

1. [The Atari 2600 Hardware](#1-the-atari-2600-hardware)
2. [6502 Assembly Language Essentials](#2-6502-assembly-language-essentials)
3. [How to Read the Disassembly](#3-how-to-read-the-disassembly)
4. [ROM Layout and Entry Points](#4-rom-layout-and-entry-points)
5. [Racing the Beam: the Display Kernel](#5-racing-the-beam-the-display-kernel)
6. [The Room System](#6-the-room-system)
7. [The Object System](#7-the-object-system)
8. [The Main Game Loop](#8-the-main-game-loop)
9. [Enemy and Item Behavior](#9-enemy-and-item-behavior)
10. [Sound Generation](#10-sound-generation)
11. [Notable Techniques](#11-notable-techniques)

---

## 1. The Atari 2600 Hardware

### 1.1 Overview

The Atari 2600, released in 1977, was built around three chips: the CPU, the TIA (Television Interface Adapter), and the RIOT (RAM/IO/Timer). Understanding what each chip did is essential to reading any 2600 program.

### 1.2 The CPU: MOS 6507

The 6507 is a cost-reduced variant of the MOS 6502. Atari chose it to save money. The differences that matter for reading assembly code are:

- **13 address lines** instead of the 6502's 16. This limits the addressable space to 8 KB of ROM. Adventure fits in exactly 4 KB, occupying addresses `$F000`–`$FFFF`.
- **No interrupt pins**. The 6507 has no NMI or IRQ lines, so interrupts are impossible. All code runs in a single execution thread driven by a tight main loop.
- **Same instruction set** as the 6502. Every opcode behaves identically to the standard 6502.

The CPU ran at **1.19 MHz**. Each instruction took 2 to 7 clock cycles depending on the opcode and addressing mode. The clock cycle comments in the disassembly (the `;2`, `;3`, `;4`, `;5`, `;6` annotations after each instruction) count the exact number of cycles that instruction consumes. This matters enormously when timing video output.

#### Registers

| Register | Width  | Purpose                                                                                                     |
| -------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| A        | 8-bit  | Accumulator. Most arithmetic and data movement goes through here.                                           |
| X        | 8-bit  | Index register. Used for offsets and loop counters.                                                         |
| Y        | 8-bit  | Index register. Used for offsets and loop counters.                                                         |
| PC       | 16-bit | Program Counter. Points to the next instruction to execute.                                                 |
| SP       | 8-bit  | Stack Pointer. Points into the hardware stack at `$0100`–`$01FF`.                                           |
| P        | 8-bit  | Processor Status. Individual flag bits: Negative, Overflow, Break, Decimal, Interrupt-disable, Zero, Carry. |

### 1.3 Memory Map

The 2600's address space is 8 KB (13 address lines), but the TIA, RIOT, and ROM are all mapped into it:

| Address Range   | What Is There                           |
| --------------- | --------------------------------------- |
| `$0000`–`$007F` | TIA registers (write, some read)        |
| `$0080`–`$00FF` | 128 bytes of RAM (inside the RIOT chip) |
| `$0280`–`$029F` | RIOT I/O and timer registers            |
| `$F000`–`$FFFF` | 4 KB ROM cartridge                      |

Because the chip-select logic only decodes a subset of address bits, these regions mirror themselves throughout the full 64 KB address space, but programs always use the canonical addresses shown above.

The **128 bytes of RAM** (`$0080`–`$00FF`) are the only writable storage. There is no stack RAM separate from this; the hardware stack uses the same range with the CPU automatically adding `$0100` to the 8-bit SP value, which means it aliases into the TIA register space. Because the TIA only responds to writes, reads from the stack region are harmless, and Adventure uses the stack normally.

### 1.4 The TIA: Television Interface Adapter

The TIA is the heart of the 2600 and the source of most of its constraints. Its fundamental purpose is to generate the NTSC (or PAL) composite video signal that drives the television.

The critical thing to understand is that the TIA **has no frame buffer**. There is no pixel memory that the CPU draws into and the TIA reads back. Instead, the TIA generates the video signal in real time, one horizontal scan line at a time, and the CPU must write the correct values to TIA registers at precisely the right moment for those values to appear on the correct part of the screen. This is called **"Racing the Beam."**

#### TIA Graphical Objects

The TIA can display five kinds of graphical object simultaneously on each scan line:

| Object         | Register(s)          | Width                    | Notes                                                                |
| -------------- | -------------------- | ------------------------ | -------------------------------------------------------------------- |
| Playfield (PF) | PF0, PF1, PF2        | 20 color clocks per half | The background maze/room walls. Can be mirrored or reflected.        |
| Player 0 (P0)  | GRP0, NUSIZ0, COLUP0 | 8 pixels                 | One of the two sprite registers. Adventure uses this for Object1.    |
| Player 1 (P1)  | GRP1, NUSIZ1, COLUP1 | 8 pixels                 | The second sprite register. Used for Object2.                        |
| Missile 0 (M0) | ENAM0                | 1–4 pixels               | One-bit sprite. Adventure uses this for the left thin wall.          |
| Missile 1 (M1) | ENAM1                | 1–4 pixels               | One-bit sprite. Adventure uses this for the right thin wall.         |
| Ball (BL)      | ENABL                | 1–4 pixels               | Another one-bit sprite. Adventure uses this for the player's avatar. |

Despite the naming, "Player 0" and "Player 1" don't have to represent players; they are just the two 8-pixel sprite channels. Adventure repurposes them for game objects. The actual player avatar is displayed using the Ball object.

#### Collision Detection Hardware

The TIA also performs **automatic collision detection** in hardware. After each scan line, it records which of the five object types overlapped each other. These results accumulate in latched registers that the CPU can read:

| Register         | Collisions Recorded                            |
| ---------------- | ---------------------------------------------- |
| `CXP0FB` (`$32`) | Player 0 vs. Playfield; Player 0 vs. Ball      |
| `CXP1FB` (`$33`) | Player 1 vs. Playfield; Player 1 vs. Ball      |
| `CXM0FB` (`$34`) | Missile 0 vs. Playfield; Missile 0 vs. Ball    |
| `CXM1FB` (`$35`) | Missile 1 vs. Playfield; Missile 1 vs. Ball    |
| `CXBLPF` (`$36`) | Ball vs. Playfield                             |
| `CXPPMM` (`$37`) | Player 0 vs. Player 1; Missile 0 vs. Missile 1 |

Writing to `CXCLR` clears all collision latches at once. Adventure reads these registers every frame to determine when the player avatar (Ball) has hit a wall (Playfield), touched an object (Player 0 or Player 1), or when a dragon has touched the player.

#### Audio

The TIA also handles audio. It has two audio channels, each controlled by three registers:

| Register        | Purpose                                                 |
| --------------- | ------------------------------------------------------- |
| `AUDC0`/`AUDC1` | Audio Control: selects the waveform (noise, tone, etc.) |
| `AUDF0`/`AUDF1` | Audio Frequency: divides the base clock to set pitch    |
| `AUDV0`/`AUDV1` | Audio Volume: 0 (silent) to 15 (loudest)                |

Adventure uses only channel 0 (AUDC0, AUDF0, AUDV0) for most sounds, with AUDV1 occasionally zeroed.

### 1.5 Screen Timing

An NTSC television frame consists of 262 scan lines:

| Region       | Scan Lines | Purpose                                     |
| ------------ | ---------- | ------------------------------------------- |
| VSYNC        | 3          | Synchronizes the TV to start of a new frame |
| VBLANK (top) | 37         | Invisible region above the picture          |
| Visible      | 192        | The actual game display                     |
| Overscan     | 30         | Invisible region below the picture          |

Each scan line is **228 color clocks** wide (76 CPU cycles, since the color clock runs 3x the CPU clock). The horizontal blank occupies the first 68 color clocks; the visible portion is the remaining 160 color clocks, corresponding to **160 pixels** of horizontal resolution.

The CPU therefore has exactly **76 cycles per scan line** while the visible region is drawn. Every cycle that goes past the intended deadline shifts what appears on screen. The tight cycle counts in the disassembly's comments are not decoration; they are critical to understanding how to implement the cycles appropriately.

The game explicitly manages the frame boundary using the `INTIM` register. At the end of each visible frame the code writes to the `TIM64T` timer register to start counting down. The next frame's setup waits for `INTIM` to reach zero (polling the `@PrintDisplay_1` / `DoVSYNC` loops) before emitting the VSYNC signal and beginning the next frame.

### 1.6 The RIOT Chip

The RIOT (MOS 6532) provides three services:

- **RAM**: 128 bytes of read/write memory at `$0080`–`$00FF`.
- **I/O ports**: `SWCHA` (`$0280`) reads the joystick directions; `SWCHB` (`$0282`) reads the console switches (Reset, Select, color/B&W, difficulty levers).
- **Timer**: Writing to `TIM64T` (`$0296`) starts a countdown that decrements every 64 clock cycles. Reading `INTIM` (`$0284`) reads the current count. Adventure uses this to synchronize frame timing.

---

## 2. 6502 Assembly Language Essentials

### 2.1 Instruction Notation

Each line of the disassembly shows:

```
<address>: <bytes>   <label>   <mnemonic>  <operand>   ;<cycles>  <comment>
```

For example:

```
f031: a9 00         lda   #$00   ;2
```

`f031` is the ROM address; `a9 00` is the machine code; `lda #$00` is the assembly instruction; `;2` means this instruction takes 2 CPU cycles.

### 2.2 Key Instructions Used in Adventure

| Mnemonic      | Operation                                                  | Flags affected |
| ------------- | ---------------------------------------------------------- | -------------- |
| `lda`         | Load A from memory or immediate                            | N, Z           |
| `sta`         | Store A to memory                                          | —              |
| `ldx` / `stx` | Load/store X register                                      | N, Z / —       |
| `ldy` / `sty` | Load/store Y register                                      | N, Z / —       |
| `tax` / `tay` | Transfer A to X or Y                                       | N, Z           |
| `txa` / `tya` | Transfer X or Y to A                                       | N, Z           |
| `txs`         | Transfer X to Stack Pointer                                | —              |
| `clc` / `sec` | Clear/set Carry flag                                       | C              |
| `adc`         | Add with Carry: A = A + operand + C                        | N, V, Z, C     |
| `sbc`         | Subtract with Borrow: A = A − operand − (1−C)              | N, V, Z, C     |
| `and`         | Bitwise AND: A = A & operand                               | N, Z           |
| `ora`         | Bitwise OR: A = A &#124; operand                           | N, Z           |
| `eor`         | Bitwise XOR: A = A ^ operand                               | N, Z           |
| `asl`         | Arithmetic shift left (multiply by 2)                      | N, Z, C        |
| `lsr`         | Logical shift right (divide by 2)                          | N, Z, C        |
| `rol` / `ror` | Rotate left/right through carry                            | N, Z, C        |
| `inc` / `dec` | Increment/decrement memory                                 | N, Z           |
| `inx` / `dex` | Increment/decrement X                                      | N, Z           |
| `iny` / `dey` | Increment/decrement Y                                      | N, Z           |
| `cmp`         | Compare A with operand (sets flags, does not store result) | N, Z, C        |
| `cpx` / `cpy` | Compare X or Y with operand                                | N, Z, C        |
| `bne`         | Branch if Zero flag clear                                  | —              |
| `beq`         | Branch if Zero flag set                                    | —              |
| `bpl`         | Branch if Negative flag clear                              | —              |
| `bmi`         | Branch if Negative flag set                                | —              |
| `bcc`         | Branch if Carry clear                                      | —              |
| `bcs`         | Branch if Carry set                                        | —              |
| `jmp`         | Unconditional jump                                         | —              |
| `jsr`         | Jump to subroutine (push return address on stack)          | —              |
| `rts`         | Return from subroutine (pop return address from stack)     | —              |
| `sei`         | Set Interrupt Disable flag (disables IRQ — moot on 6507)   | I              |
| `cld`         | Clear Decimal mode flag                                    | D              |

### 2.3 Addressing Modes

The 6502 has several ways to specify the address of an operand. Adventure uses all of the common ones:

| Mode         | Syntax        | What It Does                                                                                                                                     |
| ------------ | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Immediate    | `lda #$00`    | The operand value is embedded directly in the instruction.                                                                                       |
| Zero Page    | `lda $86`     | Reads from address `$0086` (always in the first 256 bytes). Faster and shorter than absolute.                                                    |
| Zero Page, X | `sta $00,x`   | Reads from address `$0000 + X`. Used to index into tables in zero page.                                                                          |
| Absolute     | `lda SWCHA`   | Reads from the full 16-bit address (here `$0280`).                                                                                               |
| Absolute, Y  | `lda $0000,y` | Reads from the full address plus the Y register.                                                                                                 |
| Indirect, Y  | `lda ($80),y` | Reads the 16-bit address stored at zero-page `$80`/`$81`, then adds Y to it. This is Adventure's main mechanism for walking through data tables. |
| Indirect, X  | `lda ($93,x)` | Adds X to `$93`, reads the 16-bit address at the resulting zero-page location, then reads from that address.                                     |

Zero-page instructions are one byte shorter and one cycle faster than absolute instructions, so Adventure uses zero page aggressively for frequently accessed variables.

---

## 3. How to Read the Disassembly

### 3.1 Directives

The disassembly uses SourceGen format, which has a few special directives:

| Directive           | Meaning                                                             |
| ------------------- | ------------------------------------------------------------------- |
| `.eq $xx`           | Defines a symbolic name for a hardware register address             |
| `.org $xxxx`        | Sets the assembler's origin (the address the next byte will occupy) |
| `.dd1 $xx`          | One data byte                                                       |
| `.dd2 $xxxx`        | A two-byte (little-endian) word                                     |
| `.bulk $xx,$xx,...` | A sequence of data bytes                                            |
| `.fill N,$xx`       | N copies of the value `$xx`                                         |
| `.junk N`           | N bytes of unused padding                                           |

### 3.2 Comments and Labels

Labels (e.g., `PrintDisplay`, `MoveDragon`) name the first byte of a routine or data table. Labels beginning with `@` are local to the surrounding named routine. Comments after the semicolon are either from the original disassembler or added later to explain intent.

The `vis` tag that appears before many data blocks is a SourceGen annotation indicating that the bytes following it are visual data (essentially, graphics bitmaps) that SourceGen renders in a side panel rather than as raw hex.

---

## 4. ROM Layout and Entry Points

### 4.1 Origin

```asm
.org    $f000
```

The entire ROM is mapped to addresses `$F000`–`$FFFF`. The disassembler confirms this by listing addresses in the `$Fxxx` range throughout.

### 4.2 Entry Points

The first bytes of the ROM define two entry points:

```asm
f000: 4c ef f2   START   jmp   StartGame    ;3
```

`START` at `$F000` is the canonical entry point referenced by the reset vector at `$FFFC`. It jumps to `StartGame` at `$F2EF`, which performs a full hardware initialization: disabling interrupts, clearing all TIA registers, zeroing all RAM variables, and setting up the initial game state.

```asm
f003: 78         sei                        ;2
f004: d8         cld                        ;2
f005: 4c 06 f3   jmp   MainGameLoop         ;3
```

The three bytes at `$F003`–`$F005` provide an alternate entry that skips initialization and jumps directly into `MainGameLoop`. This was used during development or possibly for a soft-reset path that preserves game state.

### 4.3 The 6502 Vectors

The very last 6 bytes of any 6502 ROM hold three interrupt vectors:

```asm
fffa: 00 f0   .dd2   $f000    ; NMI vector
fffc: 00 f0   .dd2   $f000    ; Reset vector
fffe: 00 f0   .dd2   $f000    ; IRQ/BRK vector
```

All three vectors point to `$F000`. Since the 6507 has no interrupt lines, NMI and IRQ can never fire, so their vectors are irrelevant, but they must exist in ROM because the CPU reads the reset vector (`$FFFC`) on power-on. All three are set to the same start address as a safe default.

---

## 5. Racing the Beam: the Display Kernel

The display kernel is the most time-critical code in any 2600 game. Adventure's display kernel runs from approximately `$F008` to `$F0C5`, with supporting routines for VSYNC and sprite positioning nearby.

### 5.1 The Basic Frame Structure

Each television frame follows the same sequence:

1. Wait for the previous frame's timer to expire (`DoVSYNC`).
2. Emit the VSYNC signal (3 scan lines).
3. Wait through the top VBLANK (37 scan lines).
4. Draw 192 visible scan lines while writing playfield and sprite data synchronously.
5. Turn on VBLANK at the bottom (the last ~8 scan lines).
6. Start the timer for the next frame.

### 5.2 DoVSYNC (`$F0EC`)

```asm
f0ec: ad 84 02   DoVSYNC   lda   INTIM       ;4  get timer output
f0ef: d0 fb                bne   DoVSYNC     ;2+ wait for time-out
f0f1: a9 02                lda   #$02        ;2
f0f3: 85 02                sta   WSYNC       ;3  wait for horizontal blank
f0f5: 85 01                sta   VBLANK      ;3  start vertical blanking
f0f7: 85 02                sta   WSYNC       ;3
f0f9: 85 02                sta   WSYNC       ;3
f0fb: 85 02                sta   WSYNC       ;3
f0fd: 85 00                sta   VSYNC       ;3  begin vertical sync
f0ff: 85 02                sta   WSYNC       ;3
f101: 85 02                sta   WSYNC       ;3
f103: a9 00                lda   #$00        ;2
f105: 85 02                sta   WSYNC       ;3  wait for horizontal blank
f107: 85 00                sta   VSYNC       ;3  end vertical sync
f109: a9 2a                lda   #$2a        ;2
f10b: 8d 96 02             sta   TIM64T      ;4  count down next frame
f10e: 60                   rts               ;6
```

This routine first spins on `INTIM` until the 64-clock timer reaches zero, synchronizing to the end of the previous frame's overscan. Then it:

- Writes bit 1 of `VBLANK` to enable blanking (the `#$02`). The same byte value happens to be a valid `WSYNC` write (any write to WSYNC stalls the CPU until the next horizontal blank), so writes to addresses 0 and 2 can be interleaved efficiently.
- Pulses `VSYNC` high for exactly 3 scan lines then low, creating the synchronization signal the TV needs.
- Reloads `TIM64T` with `$2A` (42 decimal). At 64 clocks per tick, this gives 42 × 64 = 2,688 clock cycles ≈ 35.4 scan lines of VBLANK timing for the next frame.

Note how the same value `#$02` is used to write to both `WSYNC` and `VBLANK`. This is intentional and common on the 2600: write the right data to one register; the fact that the other register also receives it is harmless because the TIA only latches what it cares about.

### 5.3 PrintDisplay (`$F008`)

`PrintDisplay` is called twice per game loop iteration (sometimes three times). Each call draws one complete frame. It begins by positioning the three sprites horizontally:

```asm
f008: 85 2b   PrintDisplay   sta   HMCLR    ;3  clear horizontal motion
f00a: a5 86                  lda   $86      ;3  position Player00 sprite
f00c: a2 00                  ldx   #$00     ;2   (object index 0)
f00e: 20 d2 f0               jsr   PosSpriteX  ;6
f011: a5 88                  lda   $88      ;3  position Player01 sprite
f013: a2 01                  ldx   #$01     ;2   (object index 1)
f015: 20 d2 f0               jsr   PosSpriteX  ;6
f018: a5 8b                  lda   $8b      ;3  position Ball sprite
f01a: a2 04                  ldx   #$04     ;2   (object index 4 = ball)
f01c: 20 d2 f0               jsr   PosSpriteX  ;6
```

Variables `$86` and `$88` hold the X coordinates of the two objects currently selected for display. Variable `$8B` holds the player's X coordinate. The `PosSpriteX` routine (explained in section 11.1) converts a pixel X coordinate to TIA reset and fine-motion values.

After positioning, the code waits for the VBLANK period to end (polling `INTIM`), then enters the visible scan line loop. The loop body at `PrintPlayer01` and `PrintPlayer00` runs once per scan line, deciding for each line whether to output a sprite pixel and which playfield byte to show.

### 5.4 The Scan Line Loop

The visible area is 104 scan lines tall (the game uses `$68` = 104 as the initial count in `$8E`), ticking down each iteration. Every 16 scan lines (`$8E & $0F == 0`), the code writes a new row of playfield data:

```asm
f097: 85 02   sta   WSYNC   ;3  wait for horizontal blank
f099: 84 1f   sty   ENABL   ;3  enable Ball (if wanted)
f09b: 86 1b   stx   GRP0    ;3  display Player00 definition byte
f09d: a4 8f   ldy   $8f     ;3  get room definition index
f09f: b1 80   lda   ($80),y ;5+ get first room definition byte
f0a1: 85 0d   sta   PF0     ;3  write to playfield register
f0a3: c8      iny            ;2
f0a4: b1 80   lda   ($80),y ;5+ get next room definition byte
f0a6: 85 0e   sta   PF1     ;3
f0a8: c8      iny            ;2
f0a9: b1 80   lda   ($80),y ;5+ get last room definition byte
f0ab: 85 0f   sta   PF2     ;3
```

The `WSYNC` write stalls the CPU until the horizontal blank, ensuring that `ENABL`, `GRP0`, `PF0`, `PF1`, and `PF2` are all written at the very start of the new scan line. This is the core of beam racing: the CPU is deliberately synchronized to the scan line boundary by the `WSYNC` stall, and then the first bytes of playfield data arrive on exactly the right color clocks.

The pointer at `$80`/`$81` (zero-page indirect) points into the room graphics data. As the scan line index decrements, the room definition index `$8F` advances through successive rows of the room.

Sprite pixels (Y position check for Object1, Object2, and the Ball) are tested on every scan line against stored Y coordinates. When the scan line reaches an object's Y coordinate, the sprite definition bytes begin feeding into `GRP0`, `GRP1`, or `ENABL`.

### 5.5 TidyUp (`$F0C6`)

After the final visible scan line, `TidyUp` clears `GRP0` and `GRP1` to zero (so old sprite data doesn't persist into the overscan), and sets the `TIM64T` timer to `$20` (32 ticks × 64 = 2,048 cycles ≈ 27 scan lines of overscan timing).

---

## 6. The Room System

### 6.1 Room Data Format

All room definitions live in `RoomDataTable` at `$FE1B`. Each entry is exactly 9 bytes:

| Offset | Size    | Contents                                                                                     |
| ------ | ------- | -------------------------------------------------------------------------------------------- |
| 0–1    | 2 bytes | Pointer to room graphics data                                                                |
| 2      | 1 byte  | Playfield color (COLUPF) for color mode                                                      |
| 3      | 1 byte  | Playfield color for B&W mode                                                                 |
| 4      | 1 byte  | Playfield control value (bits 5–0 = CTRLPF; bit 6 = right thin wall; bit 7 = left thin wall) |
| 5      | 1 byte  | Room number to the **above**                                                                 |
| 6      | 1 byte  | Room number to the **left**                                                                  |
| 7      | 1 byte  | Room number **below**                                                                        |
| 8      | 1 byte  | Room number to the **right**                                                                 |

There are 31 rooms (numbered `$00`–`$1E`). The `RoomNumToAddress` routine (`$F271`) converts a room number to its `RoomDataTable` pointer by multiplying by 9 (achieved by multiplying by 8 with three left shifts and then adding the original value).

### 6.2 Room Graphics Format

Each room graphic is a 7-row x 3-byte table, thus 21 bytes total. On each row, the three bytes correspond to `PF0`, `PF1`, and `PF2`.

The TIA's playfield registers work as follows:

- **PF0** (`$0D`): Only the upper 4 bits are displayed (bits 7–4). They appear as the leftmost 4 color clocks of the left half of the screen.
- **PF1** (`$0E`): All 8 bits are displayed in order, covering the middle of the left half.
- **PF2** (`$0F`): All 8 bits are displayed in reverse order (bit 0 is leftmost in the right portion of the left half).

The `CTRLPF` register's bit 0 controls whether the right half of the screen mirrors the left (reflected) or repeats it (non-reflected). Adventure uses reflected playfields for most rooms, making the left and right halves symmetrical, which is why rooms appear to have walls on both sides.

The `vis` annotations in the disassembly show the binary patterns of each room's data as a small pixel image in SourceGen, making it visually clear what shape each room has.

### 6.3 Navigation Between Rooms

When the player's avatar (the Ball) exits one edge of the screen, the code at `DealWithLeft`/`DealWithDown`/`DealWithRight`/`DealWithUp` in `MoveGroundObject` (`$F5FF`) detects the boundary crossing, adjusts the avatar's X or Y coordinate to the opposite edge, and calls `GetNewRoom` (`$F69F`):

```asm
f69f: b5 00   GetNewRoom   lda   $00,x    ;4  get the object's room
f6a1: 20 71 f2             jsr   RoomNumToAddress ;6
f6a4: b1 93                lda   ($93),y  ;5+ get adjacent room number (Y = direction index)
f6a6: 20 d5 f6             jsr   AdjustRoomLevel ;6
f6a9: 95 00                sta   $00,x    ;4  store as new room
```

Y is set to 5, 6, 7, or 8 before the call, which selects the appropriate adjacent-room byte from the room data (offsets 5–8 = above, left, below, right).

`AdjustRoomLevel` (`$F6D5`) handles level-specific room connections. Room numbers with bit 7 set (`>= $80`) are treated as "conditional": depending on the current level (game 1, 2, or 3), the actual room number differs. The `RoomDiffs` table at `$FF32` encodes these alternatives.

This allows game 1 to have a simpler, more open map while games 2 and 3 introduce maze rooms for the same physical connections.

### 6.4 Castle Portals

The three castles (yellow, white, black) each have a portcullis (gate). Portals are detected not by the room exit logic but by the `MoveGroundObject` routine, which checks whether an object's Y coordinate exceeds the screen bottom while the object is in one of the three castle entry rooms. If so, the object is teleported into the corresponding castle room.

Portcullis state controls whether the gate is open or closed. When open, objects can move through freely. When a key collides with its matching portcullis, `Portals` (`$F93C`) increments the portcullis state, beginning the opening animation.

---

## 7. The Object System

### 7.1 Object Definition

Adventure manages 19 distinct objects (numbered 0–18 in the indirection table). Each object has a fixed-size record of 9 bytes in the `Store1`–`Store9` tables at `$FF44`:

| Offset | Label         | Contents                                                       |
| ------ | ------------- | -------------------------------------------------------------- |
| 0–1    | Store1/Store2 | Pointer to dynamic info in RAM (room, X, Y at offsets 0, 1, 2) |
| 2–3    | Store3/Store4 | Pointer to the object's current-state variable in RAM          |
| 4–5    | Store5/Store6 | Pointer to the object's state table in ROM                     |
| 6      | Store7        | Object color (COLUP0/COLUP1)                                   |
| 7      | Store8        | Object B&W color                                               |
| 8      | Store9        | Object size (NUSIZ0/NUSIZ1 value)                              |

The "dynamic info" for most objects is a 3-byte block in RAM:

- Byte 0: Current room number
- Byte 1: X coordinate
- Byte 2: Y coordinate

Dragons and the bat have additional bytes for movement direction and state.

### 7.2 Object State Tables

Many objects have multiple visual states (e.g., the dragon has mouth-closed, mouth-open, and dead states; the portcullis animates through multiple frames). The state table is a list of entries, each consisting of:

- 1 byte: state-number threshold
- 2 bytes: pointer to the corresponding graphic in ROM

`GetObjectState` (`$F2A1`) walks the state table, comparing the object's current state value to each threshold. It stops at the first threshold the state value does not exceed and returns a pointer to that graphic.

### 7.3 Object Enumeration

The `CacheObjects` routine (`$F235`) finds which two objects are in the current room and stores their table indices in `$95` (Object1) and `$96` (Object2). On each call it starts from the object after the last one checked (`$9C`), cycling through all 18 object slots (spaced 9 bytes apart, `$09` per object). This round-robin ensures that no object is permanently occluded by another when more than two are in the same room.

After finding two candidates, `SetupRoomPrint` applies a priority rule: if one of the two objects is the invisible surround or the bridge, it is swapped to the Object2 slot (Player 1), because the invisible surround must be displayed in a specific layer order for collision detection to work correctly.

### 7.4 Object Table Summary

The complete set of objects defined by the Store tables:

| Index | Label                     | Object                                                                                                             |
| ----- | ------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| 00    | Invisible Surround        | A large transparent sprite that surrounds the player; used for detecting that the player is inside certain regions |
| 01–03 | Portcullis 1, 2, 3        | The castle gates                                                                                                   |
| 04    | Author Name               | The "CREATED BY WARREN ROBINETT" hidden graphic                                                                    |
| 05    | Number                    | The game-number selector (1, 2, or 3) displayed on the title screen                                                |
| 06–08 | Red, Yellow, Green Dragon | The three enemies                                                                                                  |
| 09    | Sword                     | The weapon that slays dragons                                                                                      |
| 0A    | Bridge                    | Allows crossing over walls                                                                                         |
| 0B–0D | Yellow, White, Black Key  | Keys that open the respective castle portcullises                                                                  |
| 0E    | Bat                       | The thieving creature that steals items                                                                            |
| 0F    | Black Dot                 | The pixel used to access the Easter-egg room                                                                       |
| 10    | Chalice                   | The goal object (winning condition)                                                                                |
| 11    | Magnet                    | Attracts keys, the sword, and other items                                                                          |
| 12    | Null                      | An empty placeholder object                                                                                        |

### 7.5 Carrying Objects

When the player fires the joystick trigger while colliding with a carriable object (anything with an object index ≥ `$51`), the `PickupPutdown` routine (`$F556`) stores the object's index in `$9D` (the "being carried" slot) and records the X/Y offset of the object relative to the player in `$9E`/`$9F`.

Each frame thereafter, `MoveCarriedObject` (`$F5D4`) updates the carried object's room and coordinates to track the player's position plus the stored offset.

---

## 8. The Main Game Loop

### 8.1 Structure

`MainGameLoop` at `$F306` is the central driver. It runs three sub-iterations per logical frame, each including a `PrintDisplay` call:

```
MainGameLoop:
  CheckGameStart      ; detect reset/select button presses
  MakeSound           ; output audio registers if sound is active
  CheckInput          ; sample joystick and console switches

  [if game not active: branch to NonActiveLoop]

  [check win condition: if chalice in yellow castle, end game]

  Phase 1: BallMovement(all directions) → MoveCarriedObject → DoVSYNC → SetupRoomPrint → PrintDisplay
  Phase 2: PickupPutdown → BallMovement(vertical only) → Surround → DoVSYNC → MoveBat → Portals → PrintDisplay
  Phase 3: MoveGreenDragon → MoveYellowDragon → DoVSYNC → BallMovement(horizontal only) → MoveRedDragon → Mag → PrintDisplay

  jmp MainGameLoop
```

By splitting ball movement and object updates across three sub-frames, the game achieves smoother motion than would be possible if everything ran in a single sequential block. Each phase applies different movement constraints via the `ReadStick_3` merge values:

```asm
f553: 00 c0 30   ReadStick_3   .bulk $00,$c0,$30
```

In phase 0 (Y=0), no bits are masked: all joystick directions are allowed. In phase 1 (Y=1), `$C0` is ORed in: left and right bits are forced high (disabled). In phase 2 (Y=2), `$30` is ORed in: up and down bits are forced high (disabled). The SWCHA register uses active-low logic, so a `1` means "not pressed."

### 8.2 CheckInput (`$F2B2`)

This routine increments a 16-bit software counter (`$E5`/`$E6`). If either the joystick or any console switch has been used this frame, the high byte `$E6` is reset to zero. If no input occurs for long enough, `$E6` reaches `$80`, triggering the "attract mode" color-dimming effect in `ChangeColor`.

### 8.3 CheckGameStart (`$F384`)

This detects rising edges on the Reset and Select console switches. It compares the current `SWCHB` value against the stored previous value (`$92`) to find transitions rather than holding the switch down.

Pressing Reset causes the ball's starting coordinates to be placed in the yellow castle and the game state to become active. Pressing Select cycles the difficulty level (stored in `$DD`) through 0, 2, and 4; corresponding to game 1, 2, and 3.

`SetupRoomObjects` (`$F3D3`) initializes all object positions from one of the level data tables (`Game1Objects` or `Game2Objects`). For level 3, it calls `RandomizeLevel3` (`$F412`) to scatter objects into randomized rooms.

### 8.4 RandomizeLevel3 (`$F412`)

The random number generator is not a separate routine; it reuses the input counter `$E5` as a seed. For each of the eleven randomizable objects, it:

1. Right-shifts `$E5` five times (dividing by 32).
2. Adds the original `$E5` value to the result.
3. Stores the result back into `$E5` (updating the seed for next time).
4. Masks to 5 bits (`and #$1F`), giving a room number in the range 0–31.
5. Compares against the per-object lower and upper bounds in `Loc_2`/`Loc_3`. If out of range, tries again.
6. Writes the accepted room number into the object's dynamic data.

The seed advances every time the loop runs, which depends on how many frames elapsed between game start and pressing Select, which provides pseudo-random variation without a true random number generator.

---

## 9. Enemy and Item Behavior

### 9.1 Dragon AI

All three dragons share a single `MoveDragon` routine (`$F7EA`), parameterized by a different object matrix table and starting dragon index.

#### State Machine

Each dragon has a state byte at offset 4 of its dynamic data:

| State                      | Meaning                                                                                                          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `$00`                      | Normal: hunting. Dragon pursues objects in its matrix.                                                           |
| `$01`                      | Dead: killed by sword. Dragon does not move.                                                                     |
| `$02`                      | Has eaten the player. Player's coordinates are moved to the dragon's location.                                   |
| `$03`–`$FB`                | Roaring: mouth open, incrementing. Will eat player if still colliding near `$FC`.                                |
| `$D0`, `$E8`, `$F0`, `$F6` | Open-mouthed attack states (set on first collision; exact value depends on game level and P0 difficulty switch). |

#### Object Matrix

Each dragon has an object matrix, which is a table of (object1, object2) pairs. `GetLinkedObject` (`$F728`) walks this table. For each pair, it checks whether object1 is in the same room as the dragon. If so, it calls `GetLinkedObj_4` to compute which direction the dragon should move toward object2. The first matching pair wins.

Red dragon's matrix (`RedDragMatrix`): pursues sword, ball, chalice, white key.
Yellow dragon's matrix (`YelDragMatrix`): pursues sword, yellow key, ball, chalice.
Green dragon's matrix (`GreenDragMatrix`): pursues sword, ball, chalice, bridge, magnet, black key.

When the dragon's state is `$00` and the player difficulty switch selects "amateur" (`B` difficulty), the sword is treated as a "difficulty object," meaning the dragon ignores the player if it is also holding the sword in amateur mode. (In expert mode, the sword is not excluded.)

#### Eating and Death

- **Eating**: If the dragon's state is near `$FC` and the ball collides with the dragon, the state advances to `$02` and the player's X/Y coordinates are overwritten with the dragon's position (the player is "inside" the dragon).
- **Death**: If the sword collides with the dragon (detected via `CXPPMM`: player-to-player collision, since both the sword and dragon are displayed as Player sprites), the dragon's state is set to `$01` and the dying sound plays.

### 9.2 Bat AI (`$F8A5`)

The bat cycles through 8 animation frames (`$CF` counts 0–7, wrapping). Its key property is the "fed-up counter" (`$D1`):

- If `$D1` is nonzero, the bat moves on a fixed path (`$CE` = current movement direction) and the counter increments.
- If `$D1` is zero, the bat actively hunts. It uses `BatMatrix` (a table of 10 objects the bat can steal) and `GetLinkedObject` to move toward the nearest stealable object in the same room.

When close enough to a stealable object (within 7 pixels in both X and Y), the bat picks it up, stores it as `$D0` (bat's carried object), and resets `$D1` to `$10`. From then on the bat carries the stolen object to a new location until it gets fed up again.

If the bat steals an object the player is carrying (`$9D`), `$9D` is reset to `$A2` (nothing carried), silently removing it from the player's hands.

### 9.3 Magnet (`$F9B3`)

The magnet uses the same `GetLinkedObject` mechanism. `MagnetMatrix` lists six objects the magnet attracts (keys, sword, bridge, chalice). If any of those objects is in the same room as the magnet, `MoveGroundObject` is called with delta 1 to nudge them toward the magnet by one pixel per sub-frame.

The magnet's Y coordinate is temporarily adjusted by −8 before the check (to represent the poles at the top of the U-shape) and restored afterward.

---

## 10. Sound Generation

### 10.1 Sound Architecture

Adventure uses a simple count-down sound system. Two variables control it:

- `$DF` (noise count): the remaining duration of the current sound, in frames.
- `$E0` (noise type): which of six sound effects to produce.

Each call to `MakeSound` (`$FA23`) decrements `$DF`. When `$DF` reaches zero, volumes are set to zero and the sound stops. While `$DF` is nonzero, a dispatch table switches on `$E0` to call the appropriate sound routine.

### 10.2 The Six Sound Effects

| Type (`$E0`) | Name            | How It Works                                                                                                                                                |
| ------------ | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0            | Game Over / Win | Playfield color and AUDC0/AUDF0/AUDV0 all fed from the `$DF` counter, creating a flashing, descending tone as the count winds down.                         |
| 1            | Dragon Roar     | Alternates between two AUDC0 values (3 and 8) on odd/even frames. Volume tracks `$DF` directly; frequency is `$DF/4 + $1C`, giving a rising-pitch roar.     |
| 2            | Player Eaten    | Fixed AUDC0 of 6. Frequency is `$DF XOR $0F` (decreasing from 15 to 0). Volume starts at 8 and increases slightly, producing a descending swallowing sound. |
| 3            | Dragon Dying    | AUDC0 of 4. Volume = `$DF`; frequency = `$DF XOR $1F` (flipped so it rises as count falls). Produces a dying-creature warble.                               |
| 4            | Drop Object     | Frequency = `$DF XOR $03`; fixed volume 5 and AUDC0 6. A brief click.                                                                                       |
| 5            | Pick Up Object  | Identical code path to Drop Object; same sound.                                                                                                             |

---

## 11. Notable Techniques

### 11.1 Sprite Horizontal Positioning (`PosSpriteX`, `$F0D2`)

The TIA positions sprites horizontally by a two-step mechanism: coarse positioning (which group of 15 color clocks) and fine positioning (the last few color clocks of adjustment). The `RESP0` register, when written, immediately resets the sprite counter to the current horizontal beam position. After that, writing to `HMP0` and applying `HMOVE` adjusts the position by up to ±7 color clocks.

Adventure's sprite-positioning routine converts a pixel X coordinate (0–159) to these two values:

```asm
f0d2: a0 02   PosSpriteX   ldy   #$02         ; start with coarse = 2 (offset from HBLANK)
f0d4: 38                   sec                ; set carry for subtraction loop
f0d5: c8      @loop         iny               ; increment coarse counter
f0d6: e9 0f                sbc   #$0f         ; subtract 15
f0d8: b0 fb                bcs   @loop        ; loop while remainder >= 0
; A now holds (negative) the fine remainder
f0da: 49 ff                eor   #$ff         ; flip to positive
f0dc: e9 06                sbc   #$06         ; adjust to center around zero
f0de: 0a                   asl   A            ; shift into high nibble (4 times)
f0df: 0a                   asl   A
f0e0: 0a                   asl   A
f0e1: 0a                   asl   A
; Now wait the coarse number of 15-clock groups since HBLANK
f0e2: 84 02                sty   WSYNC        ; wait for horizontal blank
f0e4: 88      @loop         dey               ; count down coarse groups
f0e5: 10 fd                bpl   @loop        ; each iteration = 5 CPU = 15 color clocks
f0e7: 95 10                sta   RESP0,x      ; reset sprite at current beam position
f0e9: 95 20                sta   HMP0,x       ; store fine adjustment for HMOVE later
f0eb: 60                   rts
```

The division-by-15 loop exploits the fact that the CPU itself is the delay. Each iteration (`iny` + `sbc #$0f` + `bcs`) takes exactly 5 CPU cycles = 15 color clocks. Counting down in Y after the `WSYNC` replays those exact delays, placing the beam at precisely the right position when `RESP0` is written.

### 11.2 The ChangeColor Routine (`$F2D3`)

```asm
f2d3: 4a   ChangeColor   lsr   A        ; shift bit 0 into carry
f2d4: 90 04              bcc   @done    ; if bit 0 was 0: normal color
; bit 0 was 1: "flash" color — use value as index into page zero
f2d6: a8                 tay
f2d7: b9 80 00           lda   $0080,y  ; read from RAM[y]: uses the low input counter
f2da: a4 e6   @done      ldy   $e6      ; get the input-timeout high byte
f2dc: 10 04              bpl   @done2   ; if timeout not reached, skip dimming
f2de: 45 e6              eor   $e6      ; merge counter bits into color
f2e0: 29 fb              and   #$fb     ; keep it from brightening the luminance
f2e2: 0a   @done2        asl   A        ; restore the bit 0 shift
f2e3: 60                 rts
```

Three things happen here:

1. **Flash effect**: A color value with bit 0 set is treated as an index (divided by 2). The code reads from RAM at that index, which for most objects lands on the input counter `$E5`, a byte that changes every frame. This produces a cycling color.

2. **Attract-mode dimming**: When `$E6` (input timeout high byte) has bit 7 set, the timeout has expired. XORing the color with `$E6` (which is `$80`) flips the MSB of the color, effectively halving its luminance and creating a dimmed attract-mode palette.

3. **Color format recovery**: TIA color values are in the format `cccc lll0` (4 color bits, 3 luminance bits, and bit 0 always zero). The initial `lsr` removed bit 0 as a flag; the final `asl` restores the format.

### 11.3 The Easter Egg (`$F687`)

The most famous Easter egg in video game history: Warren Robinett's hidden signature room. The relevant check occurs inside `DealWithRight`:

```asm
f67b: b5 00   lda   $00,x   ; get the Ball's room
f67d: c9 03   cmp   #$03    ; is it room 3?
f67f: d0 15   bne   ...     ; if not, normal right-exit
f681: a5 a1   lda   $a1     ; check the room of the black dot
f683: c9 15   cmp   #$15    ; is it in the hidden room ($15)?
f685: f0 0f   beq   ...     ; if so, don't allow secret entry
; -- allow secret entry --
f687: a9 1e   lda   #$1e    ; room $1E (the name room)
f689: 95 00   sta   $00,x   ; set as current room
f68b: a9 03   lda   #$03    ; X coordinate = 3 (just inside left edge)
f68d: 95 01   sta   $01,x
f68f: 4c ab f6 jmp   MovementReturn
```

To find the hidden room, the player must carry the black dot (`GfxDot`, a single-pixel "object" at `$FD86`) into room `$03`. Normally, the black dot is in a hidden-within-hidden room (`$15`) and is not easily accessible. Moving it out of room `$15` (by bringing it through the secret room connection itself, on a first visit) enables the condition. Subsequently, the player who travels right from room 3 is silently transported to room `$1E`.

Room `$1E` contains the `GfxAuthor` graphic at `$FD88` — a pixel-art representation of the phrase "CREATED BY WARREN ROBINETT." Because Atari forbade game credits, Robinett encoded his name in the game's data without management's knowledge. The graphic exists entirely within the regular object system; it uses object index 04 (the "name" object), which happens to be positioned in room `$1E` with its state pointing to `GfxAuthor`.

### 11.4 Level Differences via Room Number Flags

Room adjacency data can contain values ≥ `$80`. When `AdjustRoomLevel` (`$F6D5`) sees a room number with bit 7 set, it strips the `$80` flag and looks the actual destination up in `RoomDiffs`. The `RoomDiffs` table has three entries per abstract room slot (for levels 1, 2, and 3). The level number (`$DD`, stored as 0, 2, or 4) is halved and used as an index into that triple.

This single mechanism provides three entirely different map topologies from one set of room definitions, with no duplicate room data needed.

### 11.5 Zero-Page Variable Map

The 128 bytes of RAM (`$80`–`$FF`) are divided into two roles:

- `$80`–`$9F`: Temporary working variables used by the display kernel and game logic. These are not preserved across frames in any structured way; they are set up by each routine before use.
- `$A0`–`$FF`: Persistent dynamic object data. Each object's room, X, Y, movement, and state bytes live here. The exact layout is defined by the pointers in `Store1`–`Store9`.

Selected persistent variables:

| Address     | Purpose                                               |
| ----------- | ----------------------------------------------------- |
| `$8A`       | Current room number                                   |
| `$8B`       | Ball (player) X coordinate                            |
| `$8C`       | Ball (player) Y coordinate                            |
| `$9D`       | Object currently carried by the player (`$A2` = none) |
| `$DD`       | Level number (0 = game 1, 2 = game 2, 4 = game 3)     |
| `$DE`       | Game active flag (`$FF` = inactive, `$00` = active)   |
| `$DF`       | Current sound effect remaining duration               |
| `$E0`       | Current sound effect type                             |
| `$E5`/`$E6` | Input activity counter (also used as RNG seed)        |

---

_Disassembly originally by Joel D. Park (2002), converted to SourceGen format by Andy McFadden (2020). The original game code is Copyright 1979 Atari, Inc.; all game logic described here is derived solely from that public disassembly._
