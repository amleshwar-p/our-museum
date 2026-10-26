import * as THREE from 'three';

const KEYMAP = {
  KeyW: 'f', ArrowUp: 'f', KeyS: 'b', ArrowDown: 'b',
  KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r',
};

export function createControls(canvas, joystickEl, { onAction, onTap, isTyping }) {
  const keys = {};
  const joy = { x: 0, y: 0, active: false };
  const cam = { yaw: 0, pitch: 0.36, dist: 4.6 };

  addEventListener('keydown', (e) => {
    if (isTyping()) return;
    if (KEYMAP[e.code]) {
      keys[KEYMAP[e.code]] = true;
      e.preventDefault();
    }
    if (e.code === 'KeyE' || e.code === 'Space') {
      e.preventDefault();
      onAction();
    }
  });
  addEventListener('keyup', (e) => {
    if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = false;
  });
  addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

  // Drag anywhere on the scene to look around; a short tap counts as a click.
  const pointers = new Map();
  let pinchStart = 0;
  let distStart = cam.dist;
  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = Math.hypot(a.x - b.x, a.y - b.y);
      distStart = cam.dist;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchStart) cam.dist = THREE.MathUtils.clamp((distStart * pinchStart) / d, 2.2, 7);
      return;
    }
    cam.yaw -= dx * 0.006;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * 0.004, -0.15, 1.1);
  });
  const end = (e) => {
    const p = pointers.get(e.pointerId);
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinchStart = 0;
    if (p && performance.now() - p.t < 300 && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) < 8) onTap(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cam.dist = THREE.MathUtils.clamp(cam.dist + e.deltaY * 0.003, 2.2, 7);
  }, { passive: false });

  // On-screen joystick for phones
  const knob = joystickEl.querySelector('.knob');
  const R = 42;
  let joyId = null;
  const setJoy = (e) => {
    const r = joystickEl.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2);
    let y = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(x, y);
    if (len > R) {
      x = (x / len) * R;
      y = (y / len) * R;
    }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    joy.x = x / R;
    joy.y = -y / R;
  };
  joystickEl.addEventListener('pointerdown', (e) => {
    joyId = e.pointerId;
    joystickEl.setPointerCapture(e.pointerId);
    joy.active = true;
    setJoy(e);
  });
  joystickEl.addEventListener('pointermove', (e) => e.pointerId === joyId && setJoy(e));
  const joyEnd = (e) => {
    if (e.pointerId !== joyId) return;
    joyId = null;
    joy.active = false;
    joy.x = joy.y = 0;
    knob.style.transform = '';
  };
  joystickEl.addEventListener('pointerup', joyEnd);
  joystickEl.addEventListener('pointercancel', joyEnd);

  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();
  const want = new THREE.Vector3();

  return {
    cam,
    // Movement input relative to the camera: x = right, y = forward, each -1..1
    getMove() {
      if (isTyping()) return { x: 0, y: 0 };
      let x = (keys.r ? 1 : 0) - (keys.l ? 1 : 0) + joy.x;
      let y = (keys.f ? 1 : 0) - (keys.b ? 1 : 0) + joy.y;
      const len = Math.hypot(x, y);
      if (len > 1) {
        x /= len;
        y /= len;
      }
      return { x, y };
    },
    // Places the camera behind the player, pulling it in when a wall is in the way.
    updateCamera(camera, target, colliders, dt) {
      look.set(target.x, 1.75, target.z);
      const horiz = Math.cos(cam.pitch);
      const dir = tmp.set(Math.sin(cam.yaw) * horiz, Math.sin(cam.pitch), Math.cos(cam.yaw) * horiz);
      let d = cam.dist;
      for (let s = 0.4; s <= cam.dist; s += 0.1) {
        const px = look.x + dir.x * s;
        const pz = look.z + dir.z * s;
        const py = look.y + dir.y * s;
        const hit = py > 4.0 || colliders.some((c) => c.tall !== false && px > c.minX - 0.2 && px < c.maxX + 0.2 && pz > c.minZ - 0.2 && pz < c.maxZ + 0.2);
        if (hit) {
          d = Math.max(0.6, s - 0.15);
          break;
        }
      }
      want.set(look.x + dir.x * d, look.y + dir.y * d, look.z + dir.z * d);
      if (!this.placed) {
        camera.position.copy(want);
        this.placed = true;
      } else camera.position.lerp(want, Math.min(1, dt * 10));
      camera.lookAt(look);
    },
  };
}
