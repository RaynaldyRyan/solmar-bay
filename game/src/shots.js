// Deterministic screenshot staging: ?shot=<name>&seed=1 places the game into
// a composed state for each of the four dossier screenshots. The game runs
// normally afterwards; the staging only sets positions, wanted level, mission
// and camera so the shot is reproducible.
import { LANDMARKS } from './config.js';

export const SHOTS = {
  // Cover: driving the Comet through the city centre, mission active.
  city_drive: (game) => {
    const car = game.spawnCarNear('comet', -60, 40, Math.PI / 2);
    car.speed = 14; // rolling east along the road when the shot is taken
    game.player.enterCar(car);
    game.player.camYaw = Math.PI / 2;
    game.missions.startNext(); // First Fare — objective: Rosa's Diner
    game.day.timeOfDay = 17.5;
  },
  // Police chase: 3 wanted stars, cop cars ahead in a roadblock formation
  // (visible in frame — pursuers behind the player would hide behind the
  // camera), a foot cop closing in, objective on the map.
  police_chase: (game) => {
    const car = game.spawnCarNear('coupe', 40, -120, 0);
    car.speed = 14; // rolling south along the road, cops closing in
    game.player.enterCar(car);
    game.player.camYaw = 0;
    game.police.addStars(3, 'shot');
    game.police.placeCopCar(40, -70, Math.PI);
    game.police.placeCopCar(36, -50, Math.PI);
    game.police.spawnCop({ x: 48, z: -90 });
    game.missions.startNext();
    game.day.timeOfDay = 18.1;
  },
  // On foot at the plaza fountain with the mission beacon visible.
  plaza_foot: (game) => {
    game.player.x = -14;
    game.player.z = 14;
    game.player.heading = Math.PI * 0.78;
    game.player.camYaw = Math.PI * 0.78;
    game.player.mesh.position.set(-14, 0, 14);
    game.player.mesh.rotation.y = game.player.heading;
    game.player.weapon = 'pistol';
    game.missions.startNext();
    game.day.timeOfDay = 17.5;
  },
  // Start screen over the city (the menu stays open; main.js handles it).
  start_screen: (game) => {
    game.day.timeOfDay = 17.5;
    game.showStartScreen = true;
  },
};

export function applyShot(game, name) {
  const fn = SHOTS[name];
  if (!fn) return false;
  fn(game);
  return true;
}
