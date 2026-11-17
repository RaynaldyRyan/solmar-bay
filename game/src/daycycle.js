// Day cycle: the sun travels across the sky, golden hour at start, with
// matching sky colour, fog and light intensity. The in-game clock runs 1 game
// minute per real second by default.
export class DayCycle {
  constructor(scene) {
    this.scene = scene;
    this.timeOfDay = 17.5;      // 17:30 — golden hour
    this.speed = 1 / 60;        // game-hours per real second (1 min/sec)
    this.sun = new THREE.DirectionalLight(0xffe0b0, 1.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -220;
    this.sun.shadow.camera.right = 220;
    this.sun.shadow.camera.top = 220;
    this.sun.shadow.camera.bottom = -220;
    this.sun.shadow.camera.far = 600;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.ambient = new THREE.AmbientLight(0xbfd4e6, 0.55);
    this.scene.add(this.ambient);
    this.scene.fog = new THREE.Fog(0xffd9a0, 180, 480);
    this.update(0);
  }

  clockText() {
    const h = Math.floor(this.timeOfDay) % 24;
    const m = Math.floor((this.timeOfDay % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  update(dt) {
    this.timeOfDay = (this.timeOfDay + dt * this.speed) % 24;
    // sun angle: 6:00 = sunrise east, 18:00 = sunset west
    const ang = ((this.timeOfDay - 6) / 12) * Math.PI;
    const elev = Math.sin(ang);
    const az = Math.cos(ang);
    this.sun.position.set(az * 260, Math.max(8, elev * 260), 60);
    // warm at low sun, white at noon
    const warm = Math.max(0, 1 - Math.abs(elev) * 1.4);
    const r = 1, g = 1 - warm * 0.25, b = 1 - warm * 0.55;
    this.sun.color.setRGB(r, g, b);
    this.sun.intensity = 0.35 + Math.max(0, elev) * 0.85;
    this.ambient.intensity = 0.35 + Math.max(0, elev) * 0.3;
    // sky: golden at dusk, blue at day, dark at night
    const sky = new THREE.Color();
    if (elev > 0.25) sky.setHex(0x87bfe8);
    else if (elev > -0.05) sky.setHex(0xffc07a);
    else sky.setHex(0x1a2440);
    this.scene.background = sky;
    this.scene.fog.color.copy(sky);
    this.scene.fog.near = 180;
    this.scene.fog.far = elev > 0 ? 480 : 320;
  }
}
