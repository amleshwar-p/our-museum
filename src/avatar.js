import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';

const TARGET_HEIGHT = 1.65;
const SPH = new THREE.SphereGeometry(1, 32, 24);

const gltfLoader = new GLTFLoader();
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
gltfLoader.setDRACOLoader(draco);
const modelCache = new Map();

function spriteFromCanvas(canvas, worldWidth) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(worldWidth, (worldWidth * canvas.height) / canvas.width, 1);
  s.renderOrder = 10;
  return s;
}

function plaidTexture(base) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = 'rgba(28,30,34,.6)';
  g.fillRect(0, 0, 128, 44);
  g.fillRect(0, 0, 44, 128);
  g.fillStyle = 'rgba(28,30,34,.35)';
  g.fillRect(72, 0, 16, 128);
  g.fillRect(0, 72, 128, 16);
  g.fillStyle = 'rgba(215,217,222,.55)';
  g.fillRect(56, 0, 4, 128);
  g.fillRect(0, 56, 128, 4);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 2);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A cute, rounded placeholder character, used until a real .glb model is provided.
function buildProcedural(look) {
  const P = (color, extra = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, ...extra });
  const skin = P(look.skin, { roughness: 0.55, clearcoat: 0.08 });
  const hair = P(look.hair, { roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.4, side: THREE.DoubleSide });
  const pants = P(look.pants, { roughness: 0.9 });
  const top = look.top === 'plaid' ? P(0xffffff, { map: plaidTexture(look.topColor), roughness: 0.85 }) : P(look.topColor, { roughness: 0.75 });
  const shoe = P(0xf4f1ea, { roughness: 0.5 });
  const sole = P(0xc9c3b8);
  const white = P(0xffffff, { roughness: 0.15, clearcoat: 1 });
  const iris = P(0x4a2a1a, { roughness: 0.2, clearcoat: 1 });
  const pupil = P(0x0d0907, { roughness: 0.1, clearcoat: 1 });
  const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const brow = P(0x221a16, { roughness: 0.8 });
  const blush = P(0xf2a0a8, { transparent: true, opacity: 0.45 });
  const isLong = look.hairStyle === 'long';

  const ell = (rx, ry, rz, mat, x, y, z, p, r) => {
    const m = new THREE.Mesh(SPH, mat);
    m.scale.set(rx, ry, rz);
    m.position.set(x, y, z);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    p.add(m);
    return m;
  };
  const add = (geo, mat, x, y, z, p, r) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (r) m.rotation.set(r[0], r[1], r[2]);
    p.add(m);
    return m;
  };
  const lathe = (pts) => new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), 40);

  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  ell(0.22, 0.11, 0.17, pants, 0, 0.5, 0, body);
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.1, 0.5, 0);
    body.add(p);
    add(lathe([[0, 0], [0.09, 0], [0.088, -0.1], [0.08, -0.3], [0.082, -0.38], [0, -0.38]]), pants, 0, 0, 0, p);
    ell(0.085, 0.065, 0.135, shoe, 0, -0.41, 0.04, p);
    ell(0.09, 0.025, 0.14, sole, 0, -0.455, 0.04, p);
    return p;
  });
  const torso = add(
    lathe(isLong
      ? [[0, 0.48], [0.22, 0.48], [0.21, 0.6], [0.19, 0.72], [0.215, 0.88], [0.2, 0.98], [0.1, 1.04], [0, 1.05]]
      : [[0, 0.48], [0.22, 0.48], [0.235, 0.62], [0.24, 0.82], [0.225, 0.96], [0.11, 1.03], [0, 1.05]]),
    top, 0, 0, 0, body,
  );
  if (look.top === 'plaid') {
    [0.92, 0.8, 0.68, 0.56].forEach((y) => ell(0.013, 0.013, 0.008, P(0x2a2622), 0, y, 0.24, body));
    [-1, 1].forEach((s) => add(new THREE.BoxGeometry(0.11, 0.06, 0.018), top, s * 0.055, 1.01, 0.1, body, [-0.5, 0, s * 0.55]));
  } else {
    ell(0.035, 0.03, 0.025, top, 0, 0.94, 0.19, body);
  }
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 20), skin, 0, 1.06, 0, body);
  const arms = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.24, 0.95, 0);
    p.rotation.z = s * 0.14;
    body.add(p);
    if (look.top === 'puff') {
      ell(0.12, 0.1, 0.12, top, 0, -0.03, 0, p);
      ell(0.13, 0.04, 0.13, top, 0, -0.1, 0, p);
      add(lathe([[0, 0], [0.048, 0], [0.044, -0.2], [0.04, -0.36], [0, -0.36]]), skin, 0, -0.08, 0, p);
    } else {
      add(lathe([[0, 0.03], [0.075, 0.02], [0.072, -0.2], [0, -0.2]]), top, 0, 0, 0, p);
      add(new THREE.TorusGeometry(0.066, 0.022, 12, 28), top, 0, -0.21, 0, p, [Math.PI / 2, 0, 0]);
      add(lathe([[0, 0], [0.052, 0], [0.046, -0.2], [0, -0.2]]), skin, 0, -0.22, 0, p);
    }
    ell(0.055, 0.065, 0.045, skin, 0, -0.46, 0, p);
    ell(0.02, 0.035, 0.02, skin, -s * 0.04, -0.44, 0.03, p, [0, 0, -s * 0.5]);
    return p;
  });

  const head = new THREE.Group();
  head.position.y = 1.38;
  body.add(head);
  ell(0.36, 0.34, 0.33, skin, 0, 0, 0, head);
  [-1, 1].forEach((s) => {
    ell(isLong ? 0.13 : 0.115, 0.1, 0.1, skin, s * 0.15, -0.11, 0.2, head);
    ell(0.045, 0.075, 0.035, skin, s * 0.35, -0.03, 0, head);
    ell(0.055, 0.028, 0.012, blush, s * 0.19, -0.1, 0.29, head, [0, s * 0.5, 0]);
  });
  ell(0.042, 0.036, 0.036, skin, 0, -0.06, 0.33, head);
  const eyes = [-1, 1].map((s) => {
    const e = new THREE.Group();
    e.position.set(s * 0.125, 0.005, 0.265);
    head.add(e);
    ell(0.078, 0.078, 0.072, white, 0, 0, 0, e);
    ell(0.056, 0.058, 0.03, iris, 0, -0.005, 0.05, e);
    ell(0.03, 0.032, 0.02, pupil, 0, -0.005, 0.068, e);
    ell(0.016, 0.016, 0.008, shine, 0.022, 0.024, 0.08, e);
    ell(0.008, 0.008, 0.005, shine, -0.02, -0.025, 0.078, e);
    add(new THREE.SphereGeometry(0.083, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, 0, 0, e, [isLong ? -0.35 : 0.25, 0, 0]);
    if (isLong) add(new THREE.TorusGeometry(0.08, 0.009, 8, 24, Math.PI), pupil, 0, 0.01, 0.025, e, [-0.35, 0, 0]);
    ell(0.062, isLong ? 0.012 : 0.017, 0.02, brow, s * 0.008, 0.115, 0.04, e, [0, 0, -s * (isLong ? 0.18 : 0.08)]);
    return e;
  });
  if (isLong) {
    const lip = P(0xc8707c, { roughness: 0.35, clearcoat: 0.6 });
    ell(0.045, 0.022, 0.024, lip, 0, -0.175, 0.305, head);
    ell(0.04, 0.016, 0.02, lip, 0, -0.155, 0.31, head);
  } else {
    add(new THREE.TorusGeometry(0.038, 0.01, 10, 20, Math.PI), P(0x8f4b47), 0, -0.16, 0.315, head, [0.2, 0, Math.PI]);
  }
  add(new THREE.SphereGeometry(0.375, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.56), hair, 0, 0.02, -0.02, head, [-0.5, 0, 0]);
  if (isLong) {
    ell(0.23, 0.08, 0.13, hair, -0.07, 0.25, 0.21, head, [0.35, 0, 0.35]);
    ell(0.15, 0.065, 0.11, hair, 0.17, 0.22, 0.22, head, [0.35, 0, -0.45]);
    ell(0.38, 0.5, 0.2, hair, 0, 1.08, -0.15, body);
    ell(0.32, 0.2, 0.16, hair, 0, 0.66, -0.16, body);
    [-1, 1].forEach((s) => {
      ell(0.075, 0.26, 0.065, hair, s * 0.29, 1.04, 0.07, body, [0.1, 0, s * 0.08]);
      ell(0.05, 0.08, 0.045, hair, s * 0.3, 0.79, 0.09, body);
    });
  } else {
    [
      [0.2, 0.085, 0.12, 0.04, 0.25, 0.22, 0.35, 0, -0.35], [0.15, 0.07, 0.1, -0.13, 0.23, 0.24, 0.35, 0, 0.3],
      [0.22, 0.13, 0.2, 0, 0.3, 0.02, 0, 0, 0], [0.3, 0.2, 0.18, 0, 0.1, -0.18, 0, 0, 0],
      [0.08, 0.16, 0.14, -0.31, 0.08, -0.02, 0, 0, 0], [0.08, 0.16, 0.14, 0.31, 0.08, -0.02, 0, 0, 0],
      [0.06, 0.13, 0.06, 0.1, 0.36, 0.08, 0.3, 0, -0.5], [0.06, 0.12, 0.06, -0.08, 0.37, 0.1, 0.4, 0, 0.4],
      [0.05, 0.11, 0.05, 0.2, 0.32, 0.14, 0.5, 0, -0.8],
    ].forEach((h) => ell(h[0], h[1], h[2], hair, h[3], h[4], h[5], head, [h[6], h[7], h[8]]));
  }
  root.traverse((m) => m.isMesh && (m.castShadow = true));
  root.scale.setScalar(look.hairStyle === 'long' ? 1 : 1.06);

  let blinkAt = 1 + Math.random() * 2;
  let blinkStart = -1;
  let walkPhase = 0;
  let t = Math.random() * 10;
  return {
    root,
    height: 1.95,
    animate(dt, state) {
      t += dt;
      const breath = Math.sin(t * 2) * 0.012;
      torso.scale.set(1 + breath * 0.5, 1 + breath, 1 + breath * 0.5);
      if (state.sitting) {
        legs.forEach((l) => (l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, -1.45, 0.2)));
        arms.forEach((a) => (a.rotation.x = THREE.MathUtils.lerp(a.rotation.x, -0.45, 0.2)));
        body.position.y = THREE.MathUtils.lerp(body.position.y, 0.06, 0.2);
        body.rotation.z = 0;
      } else if (state.moving) {
        walkPhase += dt * 9;
        const a = Math.sin(walkPhase) * 0.55;
        legs[0].rotation.x = a;
        legs[1].rotation.x = -a;
        arms[0].rotation.x = -a * 0.7;
        arms[1].rotation.x = a * 0.7;
        body.position.y = Math.abs(Math.cos(walkPhase)) * 0.035;
        body.rotation.z = Math.sin(walkPhase) * 0.03;
      } else {
        legs.forEach((l) => (l.rotation.x = THREE.MathUtils.lerp(l.rotation.x, 0, 0.2)));
        arms.forEach((a) => (a.rotation.x = THREE.MathUtils.lerp(a.rotation.x, 0, 0.2)));
        body.position.y = THREE.MathUtils.lerp(body.position.y, 0, 0.2);
        body.rotation.z = 0;
      }
      head.rotation.x = Math.sin(t * 0.9) * 0.03;
      if (t > blinkAt) {
        blinkStart = t;
        blinkAt = t + 2.5 + Math.random() * 2.5;
      }
      const b = t - blinkStart;
      const sy = b >= 0 && b < 0.16 ? Math.max(0.08, Math.abs(1 - b / 0.08)) : 1;
      eyes.forEach((e) => (e.scale.y = sy));
    },
  };
}

// Loads a rigged .glb and plays its idle / walk / sit clips.
async function buildFromModel(url) {
  if (!modelCache.has(url)) modelCache.set(url, gltfLoader.loadAsync(url));
  const gltf = await modelCache.get(url);
  const model = SkeletonUtils.clone(gltf.scene);
  model.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.frustumCulled = false;
    }
  });
  const box = new THREE.Box3().setFromObject(model);
  const h = box.max.y - box.min.y || 1;
  const scale = TARGET_HEIGHT / h;
  const root = new THREE.Group();
  model.scale.setScalar(scale);
  model.position.y = -box.min.y * scale;
  root.add(model);

  const mixer = new THREE.AnimationMixer(model);
  const find = (re) => gltf.animations.find((a) => re.test(a.name));
  const clips = { idle: find(/idle|stand|breath/i) || gltf.animations[0], walk: find(/walk|run/i), sit: find(/sit/i) };
  const actions = {};
  for (const [k, clip] of Object.entries(clips)) if (clip) actions[k] = mixer.clipAction(clip);
  let current = null;
  const play = (name) => {
    const next = actions[name] || actions.idle;
    if (!next || next === current) return;
    next.reset().fadeIn(0.25).play();
    if (current) current.fadeOut(0.25);
    current = next;
  };
  play('idle');
  return {
    root,
    height: TARGET_HEIGHT + 0.1,
    animate(dt, state) {
      play(state.sitting ? 'sit' : state.moving ? 'walk' : 'idle');
      mixer.update(dt);
    },
  };
}

export class Avatar {
  constructor(player, scene) {
    this.player = player;
    this.scene = scene;
    this.group = new THREE.Group();
    this.state = { moving: false, sitting: false };
    this.targetRy = 0;
    this.body = buildProcedural(player.look || {});
    this.group.add(this.body.root);
    this.hearts = [];
    this.bubble = null;
    this.bubbleUntil = 0;
    this.addLabel();
    scene.add(this.group);
    if (player.model) {
      buildFromModel(player.model)
        .then((b) => {
          this.group.remove(this.body.root);
          this.body = b;
          this.group.add(b.root);
          this.label.position.y = b.height + 0.25;
        })
        .catch((e) => console.warn(`Could not load model for ${player.name}, keeping the placeholder.`, e));
    }
  }

  addLabel() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 112;
    const g = c.getContext('2d');
    g.font = '500 52px Inter, sans-serif';
    const w = Math.min(480, g.measureText(this.player.name).width + 80);
    g.fillStyle = 'rgba(28,22,19,0.72)';
    g.beginPath();
    g.roundRect((512 - w) / 2, 14, w, 84, 42);
    g.fill();
    g.fillStyle = this.player.color;
    g.beginPath();
    g.arc((512 - w) / 2 + 38, 56, 12, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#f6eee6';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(this.player.name, (512 - w) / 2 + 60, 58);
    this.label = spriteFromCanvas(c, 0.95);
    this.label.position.y = this.body.height + 0.25;
    this.group.add(this.label);
  }

  say(text, now) {
    if (this.bubble) {
      this.group.remove(this.bubble);
      this.bubble.material.map.dispose();
    }
    const c = document.createElement('canvas');
    c.width = 640;
    const g = c.getContext('2d');
    g.font = '40px Inter, sans-serif';
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (g.measureText(test).width > 540 && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
    const shown = lines.slice(0, 4);
    c.height = 60 + shown.length * 50 + 24;
    g.font = '40px Inter, sans-serif';
    const width = Math.max(...shown.map((l) => g.measureText(l).width)) + 60;
    const x = (640 - width) / 2;
    g.fillStyle = 'rgba(251,246,240,0.96)';
    g.beginPath();
    g.roundRect(x, 8, width, c.height - 40, 28);
    g.fill();
    g.beginPath();
    g.moveTo(300, c.height - 33);
    g.lineTo(320, c.height - 8);
    g.lineTo(340, c.height - 33);
    g.fill();
    g.fillStyle = '#2b211c';
    g.textAlign = 'center';
    g.textBaseline = 'top';
    shown.forEach((l, i) => g.fillText(l, 320, 34 + i * 50));
    this.bubble = spriteFromCanvas(c, 1.6);
    this.bubble.position.y = this.body.height + 0.55 + this.bubble.scale.y / 2;
    this.group.add(this.bubble);
    this.bubbleUntil = now + 6 + text.length * 0.05;
  }

  heart() {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = '#ff5c8a';
    g.beginPath();
    g.moveTo(64, 112);
    g.bezierCurveTo(-20, 58, 18, -6, 64, 34);
    g.bezierCurveTo(110, -6, 148, 58, 64, 112);
    g.fill();
    for (let i = 0; i < 6; i++) {
      const s = spriteFromCanvas(c, 0.22 + Math.random() * 0.12);
      s.position.set((Math.random() - 0.5) * 0.6, this.body.height * 0.7, (Math.random() - 0.5) * 0.6);
      s.userData = { vy: 0.7 + Math.random() * 0.5, life: 0, delay: i * 0.12, sway: Math.random() * 6 };
      s.visible = false;
      this.group.add(s);
      this.hearts.push(s);
    }
  }

  setPose(x, z, ry, state) {
    this.group.position.x = x;
    this.group.position.z = z;
    this.targetRy = ry;
    this.state = state;
  }

  update(dt, now) {
    let d = this.targetRy - this.group.rotation.y;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.group.rotation.y += d * Math.min(1, dt * 12);
    this.body.animate(dt, this.state);
    if (this.bubble && now > this.bubbleUntil) {
      this.group.remove(this.bubble);
      this.bubble.material.map.dispose();
      this.bubble = null;
    }
    for (let i = this.hearts.length - 1; i >= 0; i--) {
      const h = this.hearts[i];
      const u = h.userData;
      if (u.delay > 0) {
        u.delay -= dt;
        continue;
      }
      h.visible = true;
      u.life += dt;
      h.position.y += u.vy * dt;
      h.position.x += Math.sin(u.life * 4 + u.sway) * 0.004;
      h.material.opacity = Math.max(0, 1 - u.life / 2);
      if (u.life > 2) {
        this.group.remove(h);
        h.material.map.dispose();
        h.material.dispose();
        this.hearts.splice(i, 1);
      }
    }
  }

  get position() {
    return this.group.position;
  }

  dispose() {
    this.scene.remove(this.group);
  }
}
