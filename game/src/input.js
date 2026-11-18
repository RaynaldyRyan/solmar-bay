// Keyboard + mouse input, read once per frame. Keys are actions, not state:
// takeActions() drains the edge-triggered ones (confirm, pause, map, weapon
// slots, enter/exit car, radio, horn) while the analog axes (throttle, steer,
// brake, handbrake, nitro) are read live every step.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MAP = 4;
export const ACTION_ENTER_CAR = 8;
export const ACTION_RADIO = 16;
export const ACTION_HORN = 32;

const WEAPON_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let weaponSlot = -1;
  let firing = false;
  let mouseX = 0;
  let mouseY = 0;

  function onKeyDown(e) {
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'Enter' || e.code === 'Space') actions |= ACTION_CONFIRM;
    if (e.code === 'Escape' || e.code === 'KeyP') actions |= ACTION_PAUSE;
    if (e.code === 'KeyM') actions |= ACTION_MAP;
    if (e.code === 'KeyF') actions |= ACTION_ENTER_CAR;
    if (e.code === 'KeyR') actions |= ACTION_RADIO;
    if (e.code === 'KeyH') actions |= ACTION_HORN;
    const slot = WEAPON_KEYS.indexOf(e.code);
    if (slot >= 0) weaponSlot = slot;
  }
  function onKeyUp(e) {
    keys.delete(e.code);
  }
  function onMouseDown(e) {
    if (e.button === 0) firing = true;
  }
  function onMouseUp(e) {
    if (e.button === 0) firing = false;
  }
  function onMouseMove(e) {
    mouseX = e.clientX;
    mouseY = e.clientY;
  }
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mouseup', onMouseUp);
  window.addEventListener('mousemove', onMouseMove);

  return {
    takeActions() {
      const a = actions;
      actions = 0;
      return a;
    },
    takeWeaponSlot() {
      const s = weaponSlot;
      weaponSlot = -1;
      return s;
    },
    get firing() {
      return firing;
    },
    get mouse() {
      return { x: mouseX, y: mouseY };
    },
    // Driving axes: throttle 0..1, steer -1..1, brake, handbrake, nitro.
    drive() {
      const up = keys.has('KeyW') || keys.has('ArrowUp');
      const down = keys.has('KeyS') || keys.has('ArrowDown');
      const left = keys.has('KeyA') || keys.has('ArrowLeft');
      const right = keys.has('KeyD') || keys.has('ArrowRight');
      return {
        throttle: up ? 1 : 0,
        brake: down ? 1 : 0,
        steer: (left ? -1 : 0) + (right ? 1 : 0),
        handbrake: keys.has('Space') ? 1 : 0,
        nitro: keys.has('ShiftLeft') || keys.has('ShiftRight') ? 1 : 0,
      };
    },
    // On-foot axes: forward/strafe in camera space, -1..1.
    walk() {
      const f = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      const s = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      return { forward: f, strafe: s, sprint: keys.has('ShiftLeft') ? 1 : 0 };
    },
  };
}
