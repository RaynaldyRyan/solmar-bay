// Solmar Bay — pickups and the Spray & Save garage.
// One clear job: health and ammo pickups scattered around the city, and the
// pay-and-spray garage that clears wanted level and repairs the player's car.

import { WORLD, WANTED } from './config.js';
import { Rng } from './random.js';

const PICKUP_DEFS = [
  { kind: 'health', x: -19, z: 57, color: 0x40d860 }, // hospital forecourt
  { kind: 'health', x: 57, z: -57, color: 0x40d860 },
  { kind: 'ammo', x: 95, z: 19, color: 0xf2a020 },
  { kind: 'ammo', x: -95, z: -95, color: 0xf2a020 },
  { kind: 'health', x: -38, z: 152, color: 0x40d860 }, // pier
  { kind: 'ammo', x: 95, z: -95, color: 0xf2a020 },
  { kind: 'health', x: -57, z: -19, color: 0x40d860 },
  { kind: 'ammo', x: 19, z: 133, color: 0xf2a020 },
];

export class Pickups {
  constructor(scene, city, game) {
    this.scene = scene;
    this.city = city;
    this.game = game;
    this.items = [];
    for (const def of PICKUP_DEFS) {
      const group = new THREE.Group();
      const core = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.7),
        new THREE.MeshBasicMaterial({ color: def.color }),
      );
      group.add(core);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.9, 1.2, 20),
        new THREE.MeshBasicMaterial({ color: def.color, transparent: true, opacity: 0.6, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.9;
      group.add(ring);
      group.position.set(def.x, 1.4, def.z);
      scene.add(group);
      this.items.push({ ...def, group, core, taken: false, respawn: 0 });
    }
    // Spray & Save garage zone (beside the garage building, southwest corner).
    this.spray = { x: -95, z: 95, radius: 7, cost: WANTED.SPRAY_COST };
  }

  update(dt, game) {
    const player = game.player;
    for (const p of this.items) {
      if (p.taken) {
        p.respawn -= dt;
        if (p.respawn <= 0) {
          p.taken = false;
          p.group.visible = true;
        }
        continue;
      }
      p.core.rotation.y += dt * 2;
      p.group.position.y = 1.4 + Math.sin(performance.now() / 400 + p.x) * 0.15;
      const d = Math.hypot(player.x - p.x, player.z - p.z);
      if (d < 2.2 && player.onFoot) {
        this.collect(p, game);
      }
    }
    // Garage: drive in with a wanted level and pay to clear it.
    if (!player.onFoot && player.car) {
      const d = Math.hypot(player.x - this.spray.x, player.z - this.spray.z);
      if (d < this.spray.radius && game.police.stars > 0 && !this.sprayBusy) {
        this.sprayBusy = true;
        setTimeout(() => { this.sprayBusy = false; }, 3000);
        this.useSpray(game);
      }
    }
  }

  collect(p, game) {
    p.taken = true;
    p.respawn = 45;
    p.group.visible = false;
    game.effects.sparkle(p.x, 1.4, p.z);
    game.audio.pickup();
    if (p.kind === 'health') {
      game.player.heal(50);
      game.hud.flash('Health +50');
    } else {
      game.player.pistolOwned = true;
      game.player.weapon = 'pistol';
      game.player.ammo += 24;
      game.hud.flash('Pistol ammo +24');
    }
  }

  useSpray(game) {
    if (game.money < this.spray.cost) {
      game.hud.flash(`Spray & Save needs $${this.spray.cost} — you're short`);
      return;
    }
    game.money -= this.spray.cost;
    game.police.clearWanted();
    if (game.player.car) game.player.car.repair();
    game.effects.sparkle(game.player.x, 2, game.player.z);
    game.hud.flash(`Spray & Save — wanted cleared, car repaired (-$${this.spray.cost})`);
    game.audio.pickup();
  }
}
