// Number Room Definition

export const ROOMFLAG_NONE = 0x00;
export const ROOMFLAG_MIRROR = 0x01;
export const ROOMFLAG_LEFTTHINWALL = 0x02;
export const ROOMFLAG_RIGHTTHINWALL = 0x04;

// prettier-ignore
export const roomGfxNumberRoom = [
    0xF0,0xFF,0xFF,     // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRR
    0x30,0x00,0x00,     // XX                                    RR
    0x30,0x00,0x00,     // XX                                    RR
    0x30,0x00,0x00,     // XX                                    RR
    0x30,0x00,0x00,     // XX                                    RR
    0x30,0x00,0x00,     // XX                                    RR
    0xF0,0xFF,0x0F      // XXXXXXXXXXXXXXXXXXXXRRRRRRRRRRRRRRRRRRRR
]
