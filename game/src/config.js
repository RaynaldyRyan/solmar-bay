// Solmar Bay — shared tuning, palette and world constants.
// One clear job: every number the rest of the game agrees on lives here.

export const WORLD = {
  // Road centre lines (8 each way, right-hand traffic), blocks between them.
  ROADS: [-133, -95, -57, -19, 19, 57, 95, 133],
  ROAD_WIDTH: 12,
  BLOCK: 26,
  PITCH: 38,
  CITY_EDGE: 152,
  // Ocean starts south of this z; the beach runs along it.
  SHORE_Z: 168,
  OCEAN_Z: 178,
  SEA_LEVEL: -0.6,
  GRAVITY: 22,
};

export const PALETTE = {
  sky: 0x87b5e0,
  haze: 0xf2c48d,
  sun: 0xffe3b0,
  ground: 0x8fae7a,
  sand: 0xe8d29a,
  asphalt: 0x3a3f46,
  sidewalk: 0xb9b3a4,
  ocean: 0x2e7f9e,
  // Pastel building facades, sun-soaked modern city.
  facades: [0xf2d8c9, 0xf7e3b0, 0xc9e2d4, 0xd8c9e8, 0xf5c9c9, 0xc9d8ef, 0xefe3c9, 0xd4e8c9],
  roof: 0x8a7f72,
  glass: 0x9fd4e8,
  palmTrunk: 0x8a6a4a,
  palmLeaf: 0x3f8f4f,
};

export const PLAYER = {
  WALK_SPEED: 6,
  SPRINT_SPEED: 10.5,
  JUMP_SPEED: 8.5,
  RADIUS: 0.55,
  HEIGHT: 1.8,
  MAX_HEALTH: 100,
  PUNCH_DAMAGE: 12,
  PUNCH_RANGE: 2.2,
  PUNCH_COOLDOWN: 0.45,
};

// Six car archetypes: name, top speed (m/s), acceleration, handling, seats, colour set.
export const CAR_TYPES = {
  sedan:   { name: 'Coral Sedan',   topSpeed: 34, accel: 14, grip: 2.4, colours: [0x4a6fa5, 0x8a8f96, 0x5a4a6a, 0x3f6f5a] },
  sport:   { name: 'Vela GT',       topSpeed: 46, accel: 20, grip: 3.1, colours: [0xc23b2e, 0x1f2a44, 0xe8a020, 0xd8d8d8] },
  coupe:   { name: 'Marina Coupe',  topSpeed: 40, accel: 17, grip: 2.8, colours: [0x2e8f8a, 0xd8703f, 0x6a4a8f, 0x9ab0c0] },
  suv:     { name: 'Palma SUV',     topSpeed: 32, accel: 12, grip: 2.1, colours: [0x5a6a3f, 0x3a3a3a, 0x7a5a3a, 0x90a0b0] },
  pickup:  { name: 'Dune Pickup',   topSpeed: 33, accel: 13, grip: 2.2, colours: [0xb08a3f, 0x4a5a6a, 0x8f3a2e, 0x6a7a5a] },
  taxi:    { name: 'Solmar Cab',    topSpeed: 36, accel: 15, grip: 2.5, colours: [0xf2c020] },
  cop:     { name: 'SBPD Interceptor', topSpeed: 44, accel: 19, grip: 3.0, colours: [0x1a2a4a] },
};

export const WANTED = {
  MAX_STARS: 5,
  STEAL_OCCUPIED: 1,
  KILL_PED: 1,
  KILL_COP: 2,
  HIT_COP_CAR: 1,
  DECAY_LOS_SECONDS: 14,
  SPRAY_COST: 150,
};

export const WEAPONS = {
  fists: { name: 'Fists', damage: 12, range: 2.2, cooldown: 0.45, auto: false, ammo: Infinity },
  pistol: { name: 'P-9 Pistol', damage: 34, range: 60, cooldown: 0.28, auto: false, ammo: 120 },
};

export const SAVE_KEY = 'solmar-bay-save-v1';

export const DAY = {
  // Golden hour start: 17:20, a full day lasts 12 real minutes.
  START_HOUR: 17.33,
  DAY_LENGTH_SEC: 720,
};

// Mission catalogue: id, title, briefing, reward, and the steps the player must do.
// Step kinds: goto (reach a point), enterCar, deliver, survive (stay alive X sec),
// escape (drop wanted to 0), checkpoint (drive through a series of gates).
export const MISSIONS = [
  {
    id: 'first-fare', title: 'First Fare', reward: 250,
    brief: 'Rosa needs a lift to her diner across town. Grab any car and get her there — she tips well.',
    steps: [
      { kind: 'goto', label: 'Go to Rosa', at: [-57, -57] },
      { kind: 'enterCar', label: 'Get in a car with Rosa' },
      { kind: 'goto', label: "Drive Rosa to Rosa's Diner", at: [95, -19], inCar: true },
    ],
  },
  {
    id: 'solmar-job', title: 'The Solmar Job', reward: 600,
    brief: 'A package waits at the Old Harbor. Pick it up and bring it to Central Plaza — the Marineros will try to stop you.',
    steps: [
      { kind: 'goto', label: 'Go to the Old Harbor', at: [133, 133] },
      { kind: 'goto', label: 'Take the package to Central Plaza', at: [0, 0], ambush: true },
    ],
  },
  {
    id: 'heat-wave', title: 'Heat Wave', reward: 500,
    brief: 'The SBPD is all over you. Lose the heat — outrun them, hide, or visit Spray & Save.',
    steps: [
      { kind: 'escape', label: 'Lose your wanted level', stars: 3 },
    ],
  },
  {
    id: 'pier-pressure', title: 'Pier Pressure', reward: 750,
    brief: 'A sunset sprint along the shore road: hit every checkpoint before the clock runs out.',
    steps: [
      { kind: 'checkpoint', label: 'Race the shore road', at: [[-133, 133], [-19, 152], [95, 152], [133, 133]], time: 75 },
    ],
  },
  {
    id: 'grand-finale', title: 'Grand Finale', reward: 1500,
    brief: 'The whole city is watching. Chain three drops across Solmar Bay while the SBPD closes in.',
    steps: [
      { kind: 'goto', label: 'Drop 1: Palma Park', at: [-95, -95], stars: 2 },
      { kind: 'goto', label: 'Drop 2: Old Harbor', at: [133, 133] },
      { kind: 'goto', label: 'Drop 3: Central Plaza', at: [0, 0] },
    ],
  },
];

export const COURIER_PAY = 120;
export const START_MONEY = 200;
