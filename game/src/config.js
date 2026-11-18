// Shared constants and data tables. Everything a system needs to agree on
// lives here: the clock (DAY_MINUTES — the day-rollover check in world.js
// reads it from here, never from a local copy), the world bounds, the
// districts, the vehicle archetypes, the weapons, the radio stations and the
// mission payouts. No system defines its own copy of these numbers.
export const DAY_MINUTES = 1440;
export const STEP = 1 / 60;
export const TAPE_COUNT = 20;
export const BEST_KEY = 'solmar-bay-best';
export const SAVE_KEY = 'solmar-bay-save-v3';

export const WORLD = { minX: -1000, maxX: 1000, minZ: -700, maxZ: 700 };

// Land masses: mainland (west), barrier island (east, the beach strip) and the
// port peninsula (south-east), joined by two causeways over the bay.
export const LAND = {
  mainland: { x0: -1000, z0: -700, x1: 300, z1: 700 },
  island: { x0: 560, z0: -700, x1: 760, z1: 700 },
  port: { x0: 300, z0: 280, x1: 560, z1: 700 },
  causewayN: { x0: 300, z0: -320, x1: 560, z1: -260 },
  causewayS: { x0: 300, z0: 180, x1: 560, z1: 240 },
};

// 7 districts, each with its own palette and landmark. Rectangles tile the land
// (causeways belong to the district they leave from).
export const DISTRICTS = [
  { id: 'north', name: 'North Shore', x0: -1000, z0: -700, x1: 300, z1: -260, palette: ['#7fb069', '#a7c957', '#6a994e'], landmark: 'Solmar Stadium', landmarkAt: [-650, -480] },
  { id: 'downtown', name: 'Downtown', x0: -420, z0: -260, x1: 120, z1: 180, palette: ['#3a506b', '#5bc0be', '#1c2541'], landmark: 'Solmar Tower', landmarkAt: [-150, -40] },
  { id: 'littlesol', name: 'Little Sol', x0: -1000, z0: -260, x1: -420, z1: 320, palette: ['#ff9f1c', '#ffbf69', '#e76f51'], landmark: 'Calle Ocho Market', landmarkAt: [-710, 40] },
  { id: 'oldtown', name: 'Old Town', x0: -420, z0: 180, x1: 300, z1: 700, palette: ['#d8c3a5', '#c9ada7', '#b08968'], landmark: 'Fountain Plaza', landmarkAt: [-60, 440] },
  { id: 'strip', name: 'Art Deco Strip', x0: 560, z0: -700, x1: 760, z1: 60, palette: ['#ff5d8f', '#ffb3c1', '#f72585'], landmark: 'Neon Pier', landmarkAt: [700, -300] },
  { id: 'marina', name: 'Marina Bay', x0: 560, z0: 60, x1: 760, z1: 700, palette: ['#4cc9f0', '#4361ee', '#3a0ca3'], landmark: 'Harbor Lighthouse', landmarkAt: [720, 620] },
  { id: 'port', name: 'Port Solmar', x0: 300, z0: 280, x1: 560, z1: 700, palette: ['#6c757d', '#adb5bd', '#495057'], landmark: 'Container Terminal', landmarkAt: [430, 490] },
];

// 6 drivable archetypes + the police cruiser: distinct top speed, acceleration,
// grip and silhouette (render3d draws each differently).
export const ARCHETYPES = {
  coupe: { name: 'Comet GT', top: 46, accel: 22, grip: 3.4, len: 4.4, wid: 2.0, color: 0xe91e8c, wing: true, desc: 'Rear-wing coupe' },
  convertible: { name: 'Sunset Spyder', top: 40, accel: 19, grip: 2.6, len: 4.2, wid: 1.9, color: 0xffd166, wing: false, desc: 'Open-top convertible' },
  sedan: { name: 'Metro Sedan', top: 32, accel: 14, grip: 3.0, len: 4.5, wid: 1.9, color: 0x8ecae6, wing: false, desc: 'Four-door sedan' },
  taxi: { name: 'Solmar Taxi', top: 34, accel: 15, grip: 3.0, len: 4.5, wid: 1.9, color: 0xffc300, wing: false, desc: 'City cab' },
  pickup: { name: 'Rancher 4x4', top: 30, accel: 13, grip: 3.2, len: 5.0, wid: 2.1, color: 0x606c38, wing: false, desc: 'Heavy pickup' },
  van: { name: 'Cargo Van', top: 27, accel: 11, grip: 2.8, len: 5.2, wid: 2.1, color: 0xdad7cd, wing: false, desc: 'Delivery van' },
  cruiser: { name: 'PD Cruiser', top: 42, accel: 21, grip: 3.5, len: 4.6, wid: 2.0, color: 0x111111, wing: false, desc: 'Police interceptor' },
};

// 5 weapons for the hotbar: damage, fire rate (shots/sec), range, spread.
export const WEAPONS = [
  { id: 'pistol', name: 'Pistol', dmg: 25, rate: 3.5, range: 90, spread: 0.02, auto: false },
  { id: 'smg', name: 'SMG', dmg: 16, rate: 9, range: 80, spread: 0.05, auto: true },
  { id: 'shotgun', name: 'Shotgun', dmg: 12, rate: 1.4, range: 45, spread: 0.12, auto: false, pellets: 6 },
  { id: 'rifle', name: 'Rifle', dmg: 40, rate: 5, range: 160, spread: 0.015, auto: true },
  { id: 'sniper', name: 'Sniper', dmg: 95, rate: 0.8, range: 260, spread: 0.002, auto: false },
];

// 3 procedural radio stations (radio.js synthesizes them with Web Audio).
export const STATIONS = [
  { id: 'neon', name: 'NEON FM 88.5', genre: 'Synthwave', bpm: 112, root: 55, minor: true, tracks: ['Midnight Overdrive', 'Chrome Hearts', 'Palm Static'] },
  { id: 'latin', name: 'SOLMAR LATIN 101.2', genre: 'Latin Pop', bpm: 128, root: 65.4, minor: false, tracks: ['Calle Fuego', 'Baila Solmar', 'Ritmo del Mar'] },
  { id: 'jazz', name: 'MIDNIGHT JAZZ 99.9', genre: 'Jazz', bpm: 84, root: 49, minor: true, tracks: ['Blue Hour', 'Harbor Lights', 'Last Call'] },
];

export const PROPERTIES = [
  { id: 'safehouse', name: 'Neon Palms Apartment', price: 0, income: 0, at: [640, -120], owned: true, blurb: 'Safehouse — save here' },
  { id: 'slip', name: 'Marina Slip 7', price: 12000, income: 400, at: [700, 420], owned: false, blurb: 'Boat slip, $400/day' },
  { id: 'flamingo', name: "The Flamingo Club", price: 25000, income: 900, at: [660, -420], owned: false, blurb: 'Nightclub, $900/day' },
];

// Wanted levels: how many cruisers hunt, whether the helicopter flies, and the
// escape radius the player must clear to cool down.
export const WANTED = [
  { stars: 0, cruisers: 0, heli: false, escape: 0 },
  { stars: 1, cruisers: 1, heli: false, escape: 120 },
  { stars: 2, cruisers: 2, heli: false, escape: 160 },
  { stars: 3, cruisers: 3, heli: true, escape: 220 },
  { stars: 4, cruisers: 4, heli: true, escape: 300 },
  { stars: 5, cruisers: 6, heli: true, escape: 380 },
];

export const RESPRAY_COST = 500;
export const NITRO_MAX = 100;
