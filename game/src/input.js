// Keyboard + mouse input. Mouse orbit works with pointer lock when the
// player clicks the canvas, and falls back to drag-to-look otherwise.
export function createInput(canvas) {
  const keys = new Set();
  let mouseDX = 0, mouseDY = 0, dragging = false, lastX = 0, lastY = 0;
  let locked = false;

  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    keys.add(e.code);
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('click', () => {
    if (!locked && document.pointerLockElement !== canvas) {
      try { canvas.requestPointerLock(); } catch (e) { /* drag fallback */ }
    }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (locked) { mouseDX += e.movementX; mouseDY += e.movementY; }
    else if (dragging) { mouseDX += e.clientX - lastX; mouseDY += e.clientY - lastY; lastX = e.clientX; lastY = e.clientY; }
  });
  canvas.addEventListener('mousedown', (e) => { dragging = true; lastX = e.clientX; lastY = e.clientY; });
  window.addEventListener('mouseup', () => { dragging = false; });

  return {
    isDown(code) { return keys.has(code); },
    // One-shot key check: true only on the first frame the key is down.
    pressed(code) {
      if (keys.has(code) && !this._wasDown.has(code)) { this._wasDown.add(code); return true; }
      if (!keys.has(code)) this._wasDown.delete(code);
      return false;
    },
    _wasDown: new Set(),
    takeMouse() { const d = { x: mouseDX, y: mouseDY }; mouseDX = 0; mouseDY = 0; return d; },
    axis() {
      // returns {x: strafe/steer -1..1, y: forward -1..1}
      let x = 0, y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
      return { x, y };
    },
  };
}
