// Effects: a small particle pool (sparks, smoke, hit puffs), tracer lines for
// gunfire, and a reusable muzzle-flash light.
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];   // {mesh, vel, life, maxLife, grow}
    this.tracers = [];     // {line, life}
    this.flash = new THREE.PointLight(0xffe08a, 0, 18);
    this.scene.add(this.flash);
    this.flashLife = 0;
    this._sparkGeo = new THREE.SphereGeometry(0.09, 6, 5);
    this._smokeGeo = new THREE.SphereGeometry(0.35, 8, 6);
  }

  _spawn(pos, vel, life, color, size, grow) {
    const m = new THREE.Mesh(
      size > 0.2 ? this._smokeGeo : this._sparkGeo,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }),
    );
    m.position.copy(pos);
    if (size > 0.2) m.scale.setScalar(size / 0.35);
    this.scene.add(m);
    this.particles.push({ mesh: m, vel, life, maxLife: life, grow });
  }

  sparks(pos, n = 8) {
    for (let i = 0; i < n; i++) {
      this._spawn(pos, new THREE.Vector3(
        (Math.random() - 0.5) * 8, Math.random() * 6 + 1, (Math.random() - 0.5) * 8,
      ), 0.4 + Math.random() * 0.3, 0xffcc44, 0.09, 0);
    }
  }

  hitPuff(pos) {
    for (let i = 0; i < 5; i++) {
      this._spawn(pos, new THREE.Vector3(
        (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3,
      ), 0.35, 0xdddddd, 0.12, 0);
    }
  }

  smoke(pos) {
    this._spawn(pos, new THREE.Vector3(
      (Math.random() - 0.5) * 0.8, 1.2 + Math.random(), (Math.random() - 0.5) * 0.8,
    ), 1.1, 0x555555, 0.5, 1.6);
  }

  // A tracer line from `from` to `to`, fading over 0.12s.
  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffe9a8, transparent: true, opacity: 0.95,
    }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
  }

  muzzle(pos) {
    this.flash.position.copy(pos);
    this.flash.intensity = 3.2;
    this.flashLife = 0.06;
  }

  update(dt) {
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      if (this.flashLife <= 0) this.flash.intensity = 0;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.material.dispose();
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(p.vel, dt);
      p.vel.y -= 4 * dt;
      if (p.grow) p.mesh.scale.multiplyScalar(1 + p.grow * dt);
      p.mesh.material.opacity = Math.max(0, p.life / p.maxLife) * 0.9;
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      } else {
        t.line.material.opacity = t.life / 0.12;
      }
    }
  }
}
