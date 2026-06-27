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
export const CLOCKS_HSYNC = 2;
export const CLOCKS_VSYNC = 4;
export const PLAYFIELD_COLS = 20;
