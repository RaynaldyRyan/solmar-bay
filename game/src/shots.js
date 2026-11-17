// Solmar Bay — deterministic screenshot staging.
// One clear job: read ?shot=<name>&seed=<n> and place the game into exactly the
// state each screenshot needs (car, wanted level, mission, time of day), with
// traffic and pedestrians staged in frame so every shot shows several systems.

import { Car } from './vehicles.js';

export const SHOT_NAMES = ['cover', 'chase', 'plaza', 'menu'];

export function shotFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const seed = parseInt(params.get('seed') || '1', 10);
  return { shot: SHOT_NAMES.includes(shot) ? shot : null, seed: Number.isNaN(seed) ? 1 : seed };
}

function givePlayerCar(game, type, x, z, heading, speed) {
  const car = new Car(game.scene, type, x, z, heading);
  car.driver = 'player';
  car.occupied = true;
  car.speed = speed;
  game.traffic.parked.push(car);
  game.player.enterCar(car, game);
  // Chase camera sits behind the car: camYaw equals the car's heading.
  game.player.camYaw = heading;
  return car;
}

// A police interceptor placed exactly where the shot needs it.
function stageCopCar(game, x, z, heading, speed) {
  const car = new Car(game.scene, 'cop', x, z, heading);
  car.driver = 'cop';
  car.occupied = true;
  car.speed = speed;
  car.deployTimer = 9;
  game.police.copCars.push(car);
  return car;
}

// A traffic car placed exactly where the shot needs it, driving its lane.
function stageTrafficCar(game, type, x, z, heading, speed, alongX, dir, road) {
  const car = new Car(game.scene, type, x, z, heading);
  car.driver = 'traffic';
  car.occupied = true;
  car.speed = speed;
  car.cruise = speed;
  car.alongX = alongX;
  car.dir = dir;
  car.road = road;
  car.turnCooldown = 8;
  game.traffic.cars.push(car);
  return car;
}

export function applyShot(game, name) {
  // Every shot starts from the same golden hour.
  game.day.setHour(17.33);
  if (name === 'menu') {
    game.state = 'menu';
    return;
  }
  game.state = 'playing';
  game.hideMenus();
  if (name === 'cover') {
    // Driving through the city: traffic, pedestrians, HUD, minimap, objective.
    givePlayerCar(game, 'sport', -57, 16.4, Math.PI / 2, 26);
    // Same-direction car ahead, oncoming cab, cross traffic at the next junction.
    stageTrafficCar(game, 'sedan', -12, 16.4, Math.PI / 2, 12, true, 1, 19);
    stageTrafficCar(game, 'taxi', 24, 21.6, -Math.PI / 2, 12, true, -1, 19);
    stageTrafficCar(game, 'suv', 21.6, -30, 0, 11, false, 1, 19);
    // Pedestrians on the sidewalks the camera passes.
    game.pedestrians.spawn(-30, 26);
    game.pedestrians.spawn(-18, 12);
    game.pedestrians.spawn(2, 26);
    game.pedestrians.spawn(8, 12);
    game.missions.startMission('first-fare', { force: true });
    game.money = 1250;
  } else if (name === 'chase') {
    // Three-star police chase: interceptors on the player's tail, beacon ahead.
    givePlayerCar(game, 'coupe', 21.6, -57, 0, 26);
    game.police.stars = 3;
    game.police.spawnCopCar(game.player);
    game.police.spawnCopCar(game.player);
    game.police.spawnFootCop(game.player);
    // Two interceptors in frame: one pulling alongside ahead, one head-on far off
    // (far enough that it cannot ram the player before the screenshot).
    stageCopCar(game, 16.4, -35, 0, 20);
    stageCopCar(game, 21.6, 100, Math.PI, 15);
    stageCopCar(game, -45, 21.6, Math.PI / 2, 18);
    game.missions.startMission('solmar-job', { force: true });
    game.money = 2400;
  } else if (name === 'plaza') {
    // On foot at Central Plaza, the mission beacon ahead to the northwest.
    game.player.x = -6;
    game.player.z = 14;
    game.player.heading = -2.5;
    game.player.camYaw = -2.5;
    // Low camera pitch: the lens tilts up so the tall mission beacon clears the rooftops.
    game.player.camPitch = -0.12;
    game.player.mesh.position.set(-6, 0, 14);
    game.player.mesh.rotation.y = -2.5;
    game.pedestrians.spawn(6, 4);
    game.pedestrians.spawn(-12, -6);
    game.pedestrians.spawn(10, -10);
    game.missions.startMission('first-fare', { force: true });
    game.player.pistolOwned = true;
    game.player.weapon = 'pistol';
    game.player.ammo = 48;
    game.money = 3600;
  }
  // Let the world settle one frame before the screenshot script waits on game time.
  game.time = 0;
}
