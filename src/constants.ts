export const FPS = 58;

// Overscan is the blank border region the original 2600 TV signal
// emitted above and below the visible frame. This refers to 16
// scanlines on each edge.
export const OVERSCAN = 16;

export const SCREEN_WIDTH = 320;
export const SCREEN_HEIGHT = 192;

// Full raster height: visible area plus top and bottom
// overscan regions.
export const TOTAL_HEIGHT = SCREEN_HEIGHT + OVERSCAN + OVERSCAN;

export const MAX_OBJECTS = 16;
export const MAX_DISPLAY_OBJECTS = 2;

// These are the playfield grid dimensions and the TIA sync offsets.
// On real 2600 hardware the TIA chip drew sprites relative to where
// the electron beam was at horizontal/vertical sync, not the
// screen-corner zero. CLOCKS_HSYNC and CLOCKS_VSYNC are those
// offsets; they appear as positional corrections throughout the
// drawing and collision code. The full width of the playfield is
// 40, so PLAYFIELD_COLS is half of that, with the right half
// being mirrored or repeated.
export const PLAYFIELD_COLS = 20;
export const CLOCKS_HSYNC = 2;
export const CLOCKS_VSYNC = 4;
