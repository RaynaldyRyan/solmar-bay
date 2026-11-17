// World constants, car archetypes, landmarks and the story missions of Solmar Bay.
// Landmarks are {x, z} points on the ground plane; north is -z, east is +x.

// ---- layout ---------------------------------------------------------------
export const ROAD_SPACING = 40;          // distance between parallel road centres
export const ROAD_WIDTH = 12;            // road surface width
export const ROADS = [-160, -120, -80, -40, 0, 40, 80, 120, 160]; // road centres
export const BLOCKS = [-140, -100, -60, -20, 20, 60, 100, 140];   // block centres
export const BLOCK_SIZE = 28;            // a city block is 28 x 28
export const WORLD_BOUND = 172;          // playable ground edge (beach/harbour past it)
export const BEACH_Z = 178;              // sand starts here (south edge)
export const OCEAN_Z = 212;              // water starts here (south)
export const HARBOR_X = 178;             // docks start here (east edge)

// ---- landmarks ------------------------------------------------------------
export const LANDMARKS = {
  plaza: { x: 0, z: 0, name: 'Central Plaza' },
  rosa: { x: 34, z: -26, name: "Rosa's Diner" },
  park: { x: -80, z: -80, name: 'Palma Park' },
  harbor: { x: 172, z: -80, name: 'Old Harbor' },
  lighthouse: { x: 60, z: 204, name: 'Lighthouse' },
  ferris: { x: 120, z: 192, name: 'Ferris Wheel' },
  beach: { x: -20, z: 196, name: 'Solmar Beach' },
  garage: { x: -100, z: 100, name: 'Spray & Save' },
  hospital: { x: -34, z: 34, name: 'Solmar General' },
  pier: { x: 60, z: 186, name: 'Sunset Pier' },
};

// ---- cars -----------------------------------------------------------------
// heading: forward vector is (sin h, 0, cos h); meshes are built facing +z.
export const CAR_ARCHETYPES = {
  comet:   { name: 'Comet',   body: 0xffc933, topSpeed: 34, accel: 22, grip: 8.5, length: 4.4, width: 2.0, height: 1.35, wheels: 0.36 },
  sedan:   { name: 'Sedan',   body: 0x4a7fb5, topSpeed: 28, accel: 17, grip: 7.5, length: 4.6, width: 2.0, height: 1.4, wheels: 0.35 },
  taxi:    { name: 'Taxi',    body: 0xf5c518, topSpeed: 28, accel: 17, grip: 7.5, length: 4.6, width: 2.0, height: 1.4, wheels: 0.35 },
  pickup:  { name: 'Pickup',  body: 0xb5502a, topSpeed: 26, accel: 15, grip: 7.0, length: 5.0, width: 2.1, height: 1.6, wheels: 0.4 },
  van:     { name: 'Van',     body: 0x8f9aa3, topSpeed: 23, accel: 13, grip: 6.5, length: 5.2, width: 2.1, height: 2.0, wheels: 0.38 },
  coupe:   { name: 'Coupe',   body: 0x9b2d4a, topSpeed: 36, accel: 24, grip: 9.0, length: 4.3, width: 1.95, height: 1.25, wheels: 0.35 },
  copcar:  { name: 'Interceptor', body: 0x22364d, topSpeed: 37, accel: 25, grip: 9.5, length: 4.7, width: 2.05, height: 1.4, wheels: 0.36 },
};

export const CAR_KEYS = ['comet', 'sedan', 'taxi', 'pickup', 'van', 'coupe'];

// ---- player / combat ------------------------------------------------------
export const PLAYER = {
  walkSpeed: 5.2,
  sprintSpeed: 9.0,
  jumpSpeed: 7.5,
  health: 100,
  startPos: { x: 8, z: 24 },
  startHeading: Math.PI,
};

export const WEAPONS = {
  fists: { name: 'FISTS', range: 2.4, damage: 20, rate: 2.2, auto: false },
  pistol: { name: 'PISTOL', range: 70, damage: 34, rate: 3.5, auto: false, mag: 12 },
};

// ---- wanted ---------------------------------------------------------------
export const WANTED = {
  stealCar: 1,
  killPed: 1,
  killCop: 2,
  hitCopCar: 1,
  max: 5,
  decayDelay: 8,     // seconds with no police line of sight before decay starts
  decayStep: 4,      // seconds per star once decaying
  garageCost: 150,
};

// ---- missions -------------------------------------------------------------
// A mission is a list of steps. Step kinds:
//   goto       reach target {x,z}
//   enterCar   get into the staged car (archetype at x,z)
//   escape     bring wanted level to 0
//   checkpoint reach each target in order
export const MISSIONS = [
  {
    id: 'first-fare', title: 'First Fare', reward: 250,
    brief: "Milo Vane, a driver new in town. Rosa needs a fare run — get to her diner.",
    steps: [{ kind: 'goto', target: { x: 34, z: -26 }, text: 'Go to Rosa' }],
  },
  {
    id: 'hot-wheels', title: 'Hot Wheels', reward: 400,
    brief: 'A yellow Comet is parked by the market. Take it — then run it to Old Harbor.',
    steps: [
      { kind: 'enterCar', archetype: 'comet', at: { x: -60, z: 40 }, text: 'Steal the Comet' },
      { kind: 'goto', target: { x: 172, z: -80 }, text: 'Go to the Old Harbor' },
    ],
  },
  {
    id: 'harbor-heat', title: 'Harbor Heat', reward: 600,
    brief: 'The harbor deal was a setup. Rival gunmen are waiting — survive, then shake the heat.',
    steps: [
      { kind: 'goto', target: { x: 172, z: -80 }, text: 'Go to the Old Harbor', ambush: 3 },
      { kind: 'escape', text: 'Lose the cops' },
    ],
  },
  {
    id: 'park-pickup', title: 'Park Pickup', reward: 500,
    brief: 'Three parcels stashed around Palma Park. Collect them all, in order.',
    steps: [{
      kind: 'checkpoint',
      targets: [{ x: -100, z: -100 }, { x: -60, z: -60 }, { x: -100, z: -60 }],
      text: 'Collect the parcels',
    }],
  },
  {
    id: 'sunset-run', title: 'Sunset Run', reward: 800, timeLimit: 150,
    brief: 'The big one: lighthouse, Ferris wheel, plaza — beat the clock before sundown.',
    steps: [{
      kind: 'checkpoint',
      targets: [{ x: 60, z: 204 }, { x: 120, z: 192 }, { x: 0, z: 0 }],
      text: 'Race the sunset',
    }],
  },
];

export const COURIER_PAY = [100, 120, 150, 180, 200];
