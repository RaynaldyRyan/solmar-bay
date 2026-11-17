// Solmar Bay — keyboard and mouse input.
// One clear job: track which keys are held, expose edge-triggered presses,
// and own pointer-lock mouse-look for the camera.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.mousePressed = false;
    this.locked = false;
    this.canvas = canvas;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseMove = (e) => {
      if (document.pointerLockElement === canvas) {
        this.mouseDX += e.movementX;
        this.mouseDY += e.movementY;
      }
    };
    this._onMouseDown = (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.mousePressed = true;
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 0) this.mouseDown = false;
    };
    this._onLockChange = () => {
      this.locked = document.pointerLockElement === canvas;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    document.addEventListener('pointerlockchange', this._onLockChange);
    window.addEventListener('blur', this._onBlur);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // True once, on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // WASD as a -1..1 pair, forward = +y.
  moveAxes() {
    const x = (this.isDown('KeyD') ? 1 : 0) - (this.isDown('KeyA') ? 1 : 0);
    const y = (this.isDown('KeyW') ? 1 : 0) - (this.isDown('KeyS') ? 1 : 0);
    return { x, y };
  }

  requestLock() {
    if (!this.locked) {
      try {
        this.canvas.requestPointerLock();
      } catch {
        // Pointer lock may be refused in headless runs; the game still plays.
      }
    }
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  // Call once per frame, after the game has read this frame's input.
  endFrame() {
    this.pressed.clear();
    this.mousePressed = false;
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}
