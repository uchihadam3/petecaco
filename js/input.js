// Entrada: teclado + mouse (pointer lock) e controles de toque
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.move = { x: 0, y: 0 };
    this.look = { x: 0, y: 0 };
    this.queue = [];
    this.enabled = false;
    this.isTouch = matchMedia('(pointer: coarse)').matches || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
    this.locked = false;
    this.joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.lookTouch = { id: null, x: 0, y: 0 };
    this.onPause = null;
    this.onLockChange = null;

    addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.code;
      this.keys.add(k);
      if (!this.enabled) return;
      if (k === 'Space') { this.queue.push('jump'); e.preventDefault(); }
      if (k === 'ShiftLeft' || k === 'ShiftRight') this.queue.push('dash');
      if (k === 'KeyJ' || k === 'Enter') this.queue.push('hit');
      if (k === 'KeyK' || k === 'KeyQ') this.queue.push('lob');
      if (k === 'KeyL' || k === 'KeyE') this.queue.push('drop');
      if (k === 'Escape' || k === 'KeyP') { if (k === 'KeyP' && this.onPause) this.onPause(); }
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    canvas.addEventListener('mousedown', (e) => {
      if (this.isTouch || !this.enabled) return;
      if (!this.locked) { this.requestLock(); return; }
      if (e.button === 0) this.queue.push('hit');
      if (e.button === 2) this.queue.push('lob');
      if (e.button === 1) { this.queue.push('drop'); e.preventDefault(); }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.look.x += e.movementX; this.look.y += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.onLockChange && this.onLockChange(this.locked);
    });

    this.buildTouch();
  }

  requestLock() {
    if (this.isTouch) return;
    try { const p = this.canvas.requestPointerLock({ unadjustedMovement: false }); if (p && p.catch) p.catch(() => this.canvas.requestPointerLock()); } catch (e) { /* ignore */ }
  }
  exitLock() { if (document.pointerLockElement) document.exitPointerLock(); }

  buildTouch() {
    const tc = document.getElementById('touch');
    if (!tc) return;
    this.touchEl = tc;
    const zone = tc.querySelector('.tz-move');
    const lookZone = tc.querySelector('.tz-look');
    const stick = tc.querySelector('.stick'), knob = tc.querySelector('.knob');
    this.stick = stick; this.knob = knob;
    const R = 55;
    zone.addEventListener('pointerdown', (e) => {
      if (this.joy.id !== null) return;
      this.joy.id = e.pointerId; this.joy.ox = e.clientX; this.joy.oy = e.clientY;
      stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px'; stick.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.joy.id) return;
      let dx = e.clientX - this.joy.ox, dy = e.clientY - this.joy.oy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx = dx / l * R; dy = dy / l * R; }
      this.joy.x = dx / R; this.joy.y = -dy / R;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    const endJoy = (e) => { if (e.pointerId !== this.joy.id) return; this.joy.id = null; this.joy.x = this.joy.y = 0; stick.classList.remove('on'); };
    zone.addEventListener('pointerup', endJoy); zone.addEventListener('pointercancel', endJoy);

    lookZone.addEventListener('pointerdown', (e) => {
      if (this.lookTouch.id !== null) return;
      this.lookTouch.id = e.pointerId; this.lookTouch.x = e.clientX; this.lookTouch.y = e.clientY;
      lookZone.setPointerCapture(e.pointerId);
    });
    lookZone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== this.lookTouch.id) return;
      this.look.x += (e.clientX - this.lookTouch.x) * 2.2; this.look.y += (e.clientY - this.lookTouch.y) * 2.2;
      this.lookTouch.x = e.clientX; this.lookTouch.y = e.clientY;
    });
    const endLook = (e) => { if (e.pointerId === this.lookTouch.id) this.lookTouch.id = null; };
    lookZone.addEventListener('pointerup', endLook); lookZone.addEventListener('pointercancel', endLook);

    tc.querySelectorAll('[data-act]').forEach((b) => {
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault(); e.stopPropagation();
        if (!this.enabled) return;
        this.queue.push(b.dataset.act);
        b.classList.add('down');
        if (navigator.vibrate && this.haptics) navigator.vibrate(8);
      });
      const up = () => b.classList.remove('down');
      b.addEventListener('pointerup', up); b.addEventListener('pointerleave', up); b.addEventListener('pointercancel', up);
    });
  }

  showTouch(v) { if (this.touchEl) this.touchEl.classList.toggle('show', v && this.isTouch); }

  poll() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    x += this.joy.x; y += this.joy.y;
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    this.move.x = x; this.move.y = y;
    const lk = { x: this.look.x, y: this.look.y };
    this.look.x = 0; this.look.y = 0;
    const q = this.queue; this.queue = [];
    return { move: this.move, look: lk, actions: q };
  }
}
