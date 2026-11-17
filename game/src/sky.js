// Sky: a gradient dome that follows the day cycle, a striped synthwave sun
// hanging over the ocean, drifting clouds and distant birds.
import { makeSunTexture, makeGlowTexture } from './textures.js';

export function createSky(scene, rng) {
  const group = new THREE.Group();
  scene.add(group);

  // Gradient dome: vertex colors blend horizon to zenith; colors update per frame.
  const domeGeo = new THREE.SphereGeometry(900, 24, 14);
  const pos = domeGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  domeGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const domeMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const dome = new THREE.Mesh(domeGeo, domeMat);
  dome.renderOrder = -10;
  group.add(dome);

  // Synthwave sun: striped disc + halo sprite, placed over the ocean (east).
  const sunTex = makeSunTexture();
  const sun = new THREE.Mesh(
    new THREE.CircleGeometry(90, 48),
    new THREE.MeshBasicMaterial({ map: sunTex, transparent: true, fog: false, depthWrite: false }),
  );
  sun.renderOrder = -9;
  group.add(sun);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xff5c8a, transparent: true, opacity: 0.55, fog: false, depthWrite: false,
  }));
  halo.scale.set(260, 260, 1);
  halo.renderOrder = -9;
  group.add(halo);

  // Clouds: flattened pink-white blobs drifting slowly.
  const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffd9e8, transparent: true, opacity: 0.85, fog: false });
  const cloudMat2 = new THREE.MeshBasicMaterial({ color: 0xc9b8e8, transparent: true, opacity: 0.7, fog: false });
  const clouds = [];
  for (let i = 0; i < 14; i++) {
    const cl = new THREE.Group();
    const puffs = 3 + rng.int(0, 3);
    for (let p = 0; p < puffs; p++) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(rng.range(9, 20), 10, 8), rng.chance(0.5) ? cloudMat : cloudMat2);
      s.position.set(p * rng.range(10, 18) - puffs * 7, rng.range(-2, 3), rng.range(-4, 4));
      s.scale.y = 0.45;
      cl.add(s);
    }
    cl.position.set(rng.range(-600, 600), rng.range(120, 210), rng.range(-600, 600));
    cl.userData.speed = rng.range(0.8, 2.2);
    clouds.push(cl);
    group.add(cl);
  }

  // Birds: small dark V shapes circling over the beach.
  const birds = [];
  const birdMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e, side: THREE.DoubleSide });
  for (let i = 0; i < 8; i++) {
    const b = new THREE.Group();
    const wingGeo = new THREE.PlaneGeometry(2.4, 0.7);
    const wl = new THREE.Mesh(wingGeo, birdMat);
    const wr = new THREE.Mesh(wingGeo, birdMat);
    wl.position.x = -1.2; wr.position.x = 1.2;
    wl.rotation.z = 0.5; wr.rotation.z = -0.5;
    b.add(wl); b.add(wr);
    b.userData = { r: rng.range(30, 90), a: rng.range(0, Math.PI * 2), h: rng.range(45, 80), sp: rng.range(0.08, 0.2), cx: 260, cz: rng.range(-120, 120), wl, wr };
    birds.push(b);
    group.add(b);
  }

  const topC = new THREE.Color(), horC = new THREE.Color(), tmp = new THREE.Color();

  return {
    update(dt, sunInfo, time) {
      // dome gradient from the day-cycle colors
      topC.copy(sunInfo.skyTop); horC.copy(sunInfo.skyHorizon);
      for (let i = 0; i < pos.count; i++) {
        const y = pos.getY(i) / 900; // -1..1
        const t = Math.max(0, Math.min(1, (y + 0.08) * 1.6));
        tmp.copy(horC).lerp(topC, t * t);
        colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b;
      }
      domeGeo.attributes.color.needsUpdate = true;
      // sun disc follows the sun direction, far away, always facing the camera
      const d = sunInfo.dir;
      sun.position.set(d.x * 820, Math.max(d.y, -0.05) * 820 + 30, d.z * 820);
      sun.lookAt(0, 40, 0);
      halo.position.copy(sun.position);
      const dayness = Math.max(0, Math.min(1, (sunInfo.elevation + 6) / 14));
      sun.material.opacity = 0.25 + 0.75 * dayness;
      halo.material.opacity = 0.1 + 0.3 * dayness;
      for (const cl of clouds) {
        cl.position.x += cl.userData.speed * dt;
        if (cl.position.x > 650) cl.position.x = -650;
      }
      for (const b of birds) {
        const u = b.userData;
        u.a += u.sp * dt;
        b.position.set(u.cx + Math.cos(u.a) * u.r, u.h + Math.sin(time * 0.7 + u.r) * 2, u.cz + Math.sin(u.a) * u.r);
        b.rotation.y = -u.a;
        const flap = Math.sin(time * 6 + u.r) * 0.35;
        u.wl.rotation.z = 0.5 + flap; u.wr.rotation.z = -0.5 - flap;
      }
    },
  };
}
