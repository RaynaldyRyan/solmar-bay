// Effects: pooled particles (sparks, smoke, muzzle flash), tracer lines and
// a reusable flash light. Everything recycles — nothing allocates per frame.
export function createEffects(scene) {
  const MAX = 240;
  const geo = new THREE.BufferGeometry();
  const positions = new Float32Array(MAX * 3);
  const colors = new Float32Array(MAX * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX; i++) parts.push({ alive: false, x: 0, y: -100, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1, r: 1, g: 1, b: 1, grav: 0 });
  let cursor = 0;

  // tracers: short-lived glowing lines
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.9 });
  const tracers = [];

  const flash = new THREE.PointLight(0xffc46b, 0, 18, 2);
  scene.add(flash);
  let flashTime = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b, grav) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX;
    p.alive = true; p.x = x; p.y = y; p.z = z;
    p.vx = vx; p.vy = vy; p.vz = vz;
    p.life = life; p.max = life; p.r = r; p.g = g; p.b = b; p.grav = grav;
  }

  return {
    burst(x, y, z, color, n, speed) {
      const c = new THREE.Color(color);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, up = Math.random() * 2 - 0.4;
        const s = (speed || 6) * (0.4 + Math.random() * 0.8);
        spawn(x, y, z, Math.cos(a) * s, up * s * 0.7, Math.sin(a) * s, 0.4 + Math.random() * 0.5, c.r, c.g, c.b, 9);
      }
    },
    smoke(x, y, z) {
      spawn(x, y, z, (Math.random() - 0.5) * 1.2, 1.6 + Math.random(), (Math.random() - 0.5) * 1.2, 1.1 + Math.random() * 0.6, 0.35, 0.35, 0.38, -1.5);
    },
    muzzle(x, y, z) {
      flash.position.set(x, y, z);
      flash.intensity = 2.2;
      flashTime = 0.07;
      this.burst(x, y, z, 0xffc46b, 5, 3);
    },
    tracer(ax, ay, az, bx, by, bz) {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz),
      ]);
      const line = new THREE.Line(g, tracerMat);
      scene.add(line);
      tracers.push({ line, life: 0.09 });
    },
    update(dt) {
      for (let i = 0; i < MAX; i++) {
        const p = parts[i];
        if (!p.alive) { positions[i * 3 + 1] = -100; continue; }
        p.life -= dt;
        if (p.life <= 0) { p.alive = false; positions[i * 3 + 1] = -100; continue; }
        p.vy -= p.grav * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
        if (p.y < 0.1) { p.y = 0.1; p.vy *= -0.3; }
        positions[i * 3] = p.x; positions[i * 3 + 1] = p.y; positions[i * 3 + 2] = p.z;
        const f = p.life / p.max;
        colors[i * 3] = p.r * f; colors[i * 3 + 1] = p.g * f; colors[i * 3 + 2] = p.b * f;
      }
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;
      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].life -= dt;
        if (tracers[i].life <= 0) {
          scene.remove(tracers[i].line);
          tracers[i].line.geometry.dispose();
          tracers.splice(i, 1);
        }
      }
      if (flashTime > 0) {
        flashTime -= dt;
        if (flashTime <= 0) flash.intensity = 0;
      }
    },
  };
}
