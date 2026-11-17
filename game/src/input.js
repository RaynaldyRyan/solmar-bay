// Keyboard + mouse input state. Keys are tracked by code; the mouse steers the
// camera while the pointer is locked, and clicks fire the current weapon.
export class Input {
  constructor() {
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.clicked = false;       // set true on a fresh click, cleared by the game
    this.locked = false;
    this.onKey = null;          // (code) => void, for one-shot keys
    this._bound = [];
    this._listen('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      if (this.onKey) this.onKey(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
    });
    this._listen('keyup', (e) => this.keys.delete(e.code));
    this._listen('blur', () => this.keys.clear());
    this._listen('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    this._listen('mousedown', (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      this.clicked = true;
    });
    this._listen('mouseup', (e) => { if (e.button === 0) this.mouseDown = false; });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === document.body;
    });
  }

  _listen(type, fn) {
    window.addEventListener(type, fn);
    this._bound.push([type, fn]);
  }

  down(code) { return this.keys.has(code); }

  // -1/0/1 drive axis: W/S or Up/Down.
  driveAxis() {
    return (this.down('KeyW') || this.down('ArrowUp') ? 1 : 0)
      - (this.down('KeyS') || this.down('ArrowDown') ? 1 : 0);
  }

  // -1/0/1 steer axis: A/D or Left/Right.
  steerAxis() {
    return (this.down('KeyD') || this.down('ArrowRight') ? 1 : 0)
      - (this.down('KeyA') || this.down('ArrowLeft') ? 1 : 0);
  }

  lockPointer() {
    if (!this.locked && document.body.requestPointerLock) {
      document.body.requestPointerLock();
    }
  }

  unlockPointer() {
    if (document.exitPointerLock) document.exitPointerLock();
  }

  // Consume the accumulated mouse movement since the last frame.
  takeMouse() {
    const dx = this.mouseDX, dy = this.mouseDY;
    this.mouseDX = 0; this.mouseDY = 0;
    return { dx, dy };
  }

  takeClick() {
    const c = this.clicked;
    this.clicked = false;
    return c;
  }
}
