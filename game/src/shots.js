// Deterministic shot staging: ?shot=<name>&seed=1 places the game into a
// fixed state for each screenshot, so every render shows the systems at
// their best. The screenshot script waits on window.__solmar.time.
export function applyShot(name, world) {
  const { player, police, missions, combat } = world;
  world.dayCycle.hour = 17.8; // late golden hour: warm light, readable shadows, neon starting to glow
  if (name === 'boulevard') {
    // cover: driving the Neon Boulevard at dusk, mission 1 live, Rosa ahead
    const car = world.spawnParkedCar('sport', 0xff1744, 208, -156, 0);
    player.pos.set(208, 0, -156);
    player.enterCar(car);
    car.speed = 16;
    missions.startMission();
    world.hud.setObjective('Go to Rosa');
  } else if (name === 'chase') {
    // 3 stars, two cop cars ahead closing in — no mission card, the chase is the shot
    const car = world.spawnParkedCar('coupe', 0xe040fb, 208, 20, 0);
    player.pos.set(208, 0, 20);
    player.enterCar(car);
    car.speed = 20;
    police.addWanted(3);
    // stage two cop cars ahead, driving south to meet the player; at ~3.5s they
    // are right beside the player, turning to pursue — visible in frame
    police.placeCopCar(204, 140, Math.PI);
    police.placeCopCar(212, 146, Math.PI);
  } else if (name === 'plaza') {
    // on foot at the plaza fountain, pistol out, mission marker ahead.
    // (20, 34): north of the fountain (26, 26), clear of the ring palm at
    // (26, 43), camera stays on plaza ground instead of the road behind it.
    player.pos.set(20, 0, 34);
    player.angle = Math.PI;
    player.weapon = 'pistol';
    missions.startMission();
    world.hud.setObjective('Go to Rosa');
  } else if (name === 'menu') {
    // start screen over the city: handled by main.js (menu camera orbit)
    return;
  }
}
