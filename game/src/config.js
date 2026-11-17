// City layout, palette and tuning for Solmar Bay: Neon Tide.
// The city is an 8x8 grid of blocks. Roads run on multiples of PITCH; each
// block is BLOCK wide with ROAD-wide streets between them. The ocean lies
// east of the grid; the Neon Boulevard is the easternmost north-south road.

export const CFG = {
  PITCH: 52,
  BLOCK: 40,
  ROAD_HALF: 6,
  GRID: 4, // roads at -4..4 * PITCH
  CITY_MIN: -208,
  CITY_MAX: 208,
  BEACH_X: 214, // sand starts here
  OCEAN_X: 252, // water starts here
  DAY_START_HOUR: 18.4, // dusk: the neon shows best
  DAY_LENGTH_SEC: 480, // one full day cycle
  WALK_SPEED: 7.5,
  SPRINT_SPEED: 11.5,
  GARAGE_COST: 150,
};

// Art-deco pastel palette for the buildings, plus the neon accent colors.
export const PALETTE = {
  facades: ['#ffd9c0', '#ffe9a8', '#ffc7dd', '#c8f2e4', '#cfe4ff', '#f6d8ff', '#ffedd0', '#d9f7ff'],
  trim: ['#ff2e88', '#00e5ff', '#ffea00', '#b537f2', '#00ff9d'],
  roofs: ['#7a5a8c', '#4a6b8a', '#8a5a5a', '#5a8a7a'],
  road: '#3b3b46',
  sidewalk: '#9a94a6',
  sand: '#f2d5a0',
  ocean: '#1a3a6b',
};

export const NEON_SIGNS = [
  { text: 'HOTEL PALMA', color: '#ff2e88' },
  { text: 'NEON TIDE', color: '#00e5ff' },
  { text: 'CAFÉ LUNA', color: '#ffea00' },
  { text: 'ARCADE', color: '#b537f2' },
  { text: 'DRIVE-IN', color: '#00ff9d' },
  { text: 'TIKI BAR', color: '#ff6b35' },
  { text: 'DISCO', color: '#ff2e88' },
  { text: 'SURF SHOP', color: '#00e5ff' },
];

// Six car archetypes: name, top speed (m/s), acceleration, handling, size.
export const CAR_ARCHETYPES = {
  comet:   { name: 'Comet',   top: 34, accel: 16, grip: 2.6, len: 4.4, wid: 2.0, body: 0.62, colors: [0xffd23f, 0xff5a5a, 0x4fc3f7] },
  coupe:   { name: 'Coupe',   top: 30, accel: 14, grip: 2.4, len: 4.2, wid: 1.9, body: 0.58, colors: [0xe040fb, 0xffffff, 0x212121] },
  sedan:   { name: 'Sedan',   top: 27, accel: 12, grip: 2.2, len: 4.6, wid: 1.9, body: 0.62, colors: [0x90a4ae, 0x5d4037, 0x37474f] },
  van:     { name: 'Van',     top: 23, accel: 10, grip: 1.9, len: 5.0, wid: 2.1, body: 0.95, colors: [0xfff3e0, 0x80cbc4, 0xefebe9] },
  pickup:  { name: 'Pickup',  top: 28, accel: 13, grip: 2.1, len: 4.8, wid: 2.0, body: 0.66, colors: [0xef6c00, 0x33691e, 0x8d6e63] },
  sport:   { name: 'Sport',   top: 38, accel: 19, grip: 3.0, len: 4.3, wid: 2.0, body: 0.50, colors: [0xff1744, 0x00e5ff, 0xffea00] },
};

export const MISSION_NAMES = [
  'First Fare', 'Harbor Lights', 'Sunset Run', 'The Long Way Home', 'Neon Tide',
];

// Clamp a value into [a, b].
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist2(ax, az, bx, bz) { const dx = ax - bx, dz = az - bz; return dx * dx + dz * dz; }
