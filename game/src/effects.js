// Solmar Bay — particle effects.
// One clear job: short-lived sprites for damage smoke, muzzle sparks, impact
// puffs, pickup sparkles and skid dust, pooled and updated in one place.

import { softDiscTexture } from './textures.js';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.tex = softDiscTexture();
    this.pool = [];
  }

  spawn(x, y, z, opts = {}) {
    const {
      color = 0xcccccc, count = 8, speed = 2, life = 0.8,
      size = 0.7, gravity = 0, spread = 1, dir = null,
    } = opts;
    for (let i = 0; i < count; i++) {
      let p = this.pool.pop();
      if (!p) {
        const mat = new THREE.SpriteMaterial({
          map: this.tex, transparent: true, depthWrite: false,
        });
        p = new THREE.Sprite(mat);
        this.scene.add(p);
      }
      p.material.color.setHex(color);
      p.material.opacity = 0.9;
      p.position.set(
        x + (Math.random() - 0.5) * spread,
        y + (Math.random() - 0.5) * spread * 0.5,
        z + (Math.random() - 0.5) * spread,
      );
      const a = Math.random() * Math.PI * 2;
      const up = dir ? 0 : Math.random() * 1.5;
      p.userData.vx = dir ? dir.x * speed : Math.cos(a) * speed * 0.6;
      p.userData.vy = dir ? dir.y * speed : up;
      p.userData.vz = dir ? dir.z * speed : Math.sin(a) * speed * 0.6;
      p.userData.life = life * (0.6 + Math.random() * 0.8);
      p.userData.maxLife = p.userData.life;
      p.userData.gravity = gravity;
      p.userData.size = size * (0.7 + Math.random() * 0.6);
      p.scale.setScalar(p.userData.size);
      p.visible = true;
      this.particles.push(p);
    }
  }

  smoke(x, y, z) {
    this.spawn(x, y, z, { color: 0x555555, count: 2, speed: 0.6, life: 1.4, size: 1.1, gravity: 1.2 });
  }

  sparks(x, y, z) {
    this.spawn(x, y, z, { color: 0xffd060, count: 10, speed: 5, life: 0.35, size: 0.35, gravity: -8 });
  }

  muzzle(x, y, z, dir) {
    this.spawn(x, y, z, { color: 0xffe080, count: 4, speed: 3, life: 0.12, size: 0.6, dir, spread: 0.2 });
  }

  blood(x, y, z) {
    this.spawn(x, y, z, { color: 0xa02020, count: 6, speed: 2, life: 0.5, size: 0.4, gravity: -6 });
  }

  sparkle(x, y, z) {
    this.spawn(x, y, z, { color: 0x80ffd0, count: 10, speed: 1.2, life: 0.9, size: 0.5, gravity: 1 });
  }

  dust(x, y, z) {
    this.spawn(x, y, z, { color: 0xc8b890, count: 3, speed: 1, life: 0.7, size: 0.9, gravity: 0.5 });
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      const u = p.userData;
      u.life -= dt;
      if (u.life <= 0) {
        p.visible = false;
        this.particles.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      u.vy += u.gravity * dt;
      p.position.x += u.vx * dt;
      p.position.y += u.vy * dt;
      p.position.z += u.vz * dt;
      const t = u.life / u.maxLife;
      p.material.opacity = t * 0.9;
      p.scale.setScalar(u.size * (1.6 - t * 0.6));
    }
  }
}
