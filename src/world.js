import * as THREE from 'three';

const H = 4.2; // wall height
const T = 0.3; // wall thickness
const HALF_W = 6; // hall is 12m wide

// Works out how long the hall must be so every photo gets a spot on a wall.
function planLayout(count) {
  const needed = Math.max(0, count - 1); // the first photo is the centrepiece
  for (let L = 16; ; L += 2.6) {
    const zFront = 8;
    const zBack = zFront - L;
    const zMid = (zFront + zBack) / 2;
    const slots = [
      { x: -4.3, z: zBack + T / 2, ry: 0, size: 'small' },
      { x: 4.3, z: zBack + T / 2, ry: 0, size: 'small' },
    ];
    for (let z = zBack + 2.4; z <= zFront - 2.0; z += 2.6) {
      slots.push({ x: -HALF_W + T / 2, z, ry: Math.PI / 2, size: 'side' });
      if (Math.abs(z - zMid) > 3.7) slots.push({ x: HALF_W - T / 2, z, ry: -Math.PI / 2, size: 'side' });
    }
    slots.push({ x: -3.9, z: zFront - T / 2, ry: Math.PI, size: 'side' });
    slots.push({ x: 3.9, z: zFront - T / 2, ry: Math.PI, size: 'side' });
    if (slots.length >= needed) return { L, zFront, zBack, zMid, slots };
  }
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function woodFloorTexture() {
  const t = canvasTexture(1024, 1024, (g, w, h) => {
    const rows = 8;
    const rh = h / rows;
    for (let r = 0; r < rows; r++) {
      let x = (r % 2) * -180;
      while (x < w) {
        const len = 260 + ((r * 97 + x) % 170);
        const tone = 128 + ((r * 31 + Math.floor(x)) % 34) - 17;
        g.fillStyle = `rgb(${tone + 30},${tone - 2},${tone - 34})`;
        g.fillRect(x, r * rh, len, rh);
        g.strokeStyle = 'rgba(40,24,12,0.10)';
        for (let i = 0; i < 6; i++) {
          g.beginPath();
          const y = r * rh + 8 + i * (rh / 6);
          g.moveTo(x, y);
          g.bezierCurveTo(x + len * 0.3, y + 4, x + len * 0.6, y - 4, x + len, y);
          g.stroke();
        }
        g.fillStyle = 'rgba(40,24,12,0.45)';
        g.fillRect(x, r * rh, 2, rh);
        x += len;
      }
      g.fillStyle = 'rgba(40,24,12,0.35)';
      g.fillRect(0, r * rh, w, 2);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function wallTexture() {
  const t = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#efe6da';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(120,90,60,${Math.random() * 0.025})`;
      g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
    g.fillStyle = '#4f3727';
    g.fillRect(0, h * 0.95, w, h * 0.05);
    g.fillStyle = '#d9cbb8';
    g.fillRect(0, h * 0.94, w, 3);
    g.fillStyle = '#e2d6c6';
    g.fillRect(0, 0, w, h * 0.025);
  });
  t.wrapS = THREE.RepeatWrapping;
  return t;
}

function glowTexture() {
  return canvasTexture(256, 256, (g) => {
    const grad = g.createRadialGradient(128, 70, 10, 128, 120, 140);
    grad.addColorStop(0, 'rgba(255,226,180,0.55)');
    grad.addColorStop(1, 'rgba(255,226,180,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
  });
}

function wrapText(g, text, x, y, maxW, lineH) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (g.measureText(test).width > maxW && line) {
      g.fillText(line, x, y);
      line = w;
      y += lineH;
    } else line = test;
  }
  g.fillText(line, x, y);
  return y;
}

function loadPhotos(photos, onProgress) {
  const loader = new THREE.TextureLoader();
  let done = 0;
  return Promise.all(
    photos.map(
      (p) =>
        new Promise((resolve) => {
          loader.load(
            p.src,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.anisotropy = 8;
              onProgress(++done / photos.length);
              resolve(tex);
            },
            undefined,
            () => {
              console.warn('Could not load photo', p.src);
              onProgress(++done / photos.length);
              resolve(null);
            },
          );
        }),
    ),
  );
}

export async function buildWorld(scene, cfg, onProgress = () => {}) {
  const photos = cfg.photos || [];
  const layout = planLayout(photos.length);
  const { L, zFront, zBack, zMid } = layout;
  const colliders = [];
  const interactables = [];
  const clickable = [];

  const textures = await loadPhotos(photos, (p) => onProgress(p * 0.9));

  const M = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
  const wood = M(0x5a3e2b, { roughness: 0.6 });
  const brass = M(0xc9a35a, { roughness: 0.3, metalness: 0.8 });
  const wallTex = wallTexture();

  // Lighting
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x5a4636, 1.1));
  const sun = new THREE.DirectionalLight(0xfff1de, 1.6);
  sun.position.set(4, 10, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 30 });
  sun.shadow.bias = -0.0004;
  sun.shadow.radius = 4;
  scene.add(sun, sun.target);

  // Floor and ceiling
  const floorTex = woodFloorTexture();
  floorTex.repeat.set(16 / 4, (L + 12) / 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(16, L + 12), M(0xffffff, { map: floorTex, roughness: 0.55 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(2, 0, zMid);
  floor.receiveShadow = true;
  scene.add(floor);
  const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(16, L + 12), M(0xf3ece2, { roughness: 1, emissive: 0x9a8b7a, emissiveIntensity: 0.55 }));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(2, H, zMid);
  scene.add(ceiling);

  // Walls (axis-aligned segments, each one also a collider)
  function wall(x1, z1, x2, z2) {
    const alongX = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    const len = alongX ? Math.abs(x2 - x1) : Math.abs(z2 - z1);
    const tex = wallTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(len / 4, 1);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(alongX ? len + T : T, H, alongX ? T : len + T), M(0xffffff, { map: tex, roughness: 0.95 }));
    mesh.position.set((x1 + x2) / 2, H / 2, (z1 + z2) / 2);
    mesh.receiveShadow = true;
    scene.add(mesh);
    const hw = alongX ? (len + T) / 2 : T / 2;
    const hd = alongX ? T / 2 : (len + T) / 2;
    colliders.push({ minX: mesh.position.x - hw, maxX: mesh.position.x + hw, minZ: mesh.position.z - hd, maxZ: mesh.position.z + hd });
  }
  const door = 1.6;
  wall(-HALF_W, zBack, HALF_W, zBack);
  wall(-HALF_W, zBack, -HALF_W, zFront);
  wall(HALF_W, zBack, HALF_W, zMid - 2.5);
  wall(HALF_W, zMid + 2.5, HALF_W, zFront);
  wall(-HALF_W, zFront, -door, zFront);
  wall(door, zFront, HALF_W, zFront);
  const roomX = 10.5;
  wall(HALF_W, zMid - 3.2, roomX, zMid - 3.2);
  wall(HALF_W, zMid + 3.2, roomX, zMid + 3.2);
  wall(roomX, zMid - 3.2, roomX, zMid + 3.2);
  // Lintel above the door and a warm glow outside it
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(door * 2, 1.2, T), M(0xefe6da));
  lintel.position.set(0, H - 0.6, zFront);
  scene.add(lintel);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(door * 2, 3), new THREE.MeshBasicMaterial({ color: 0xffe2b8 }));
  outside.position.set(0, 1.5, zFront + 1.2);
  outside.rotation.y = Math.PI;
  scene.add(outside);
  colliders.push({ minX: -door, maxX: door, minZ: zFront - 0.05, maxZ: zFront + 0.4 });

  // Ceiling lamps
  let lights = 0;
  for (let z = zBack + 3; z < zFront - 1; z += 4) {
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 32), new THREE.MeshBasicMaterial({ color: 0xfff3dc }));
    lamp.position.set(0, H - 0.03, z);
    scene.add(lamp);
    if (lights < 4 && Math.round((z - zBack - 3) / 4) % 2 === 0) {
      const p = new THREE.PointLight(0xffe6c4, 18, 11, 2);
      p.position.set(0, H - 0.4, z);
      scene.add(p);
      lights++;
    }
  }

  // Photos
  const glow = glowTexture();
  const fit = (aspect, maxW, maxH) => (aspect > maxW / maxH ? [maxW, maxW / aspect] : [maxH * aspect, maxH]);
  function hangPhoto(i, slot) {
    const tex = textures[i];
    const aspect = tex && tex.image ? tex.image.width / tex.image.height : 4 / 3;
    const big = slot.size === 'centre';
    const [w, h] = big ? fit(aspect, 3.6, 2.4) : slot.size === 'small' ? fit(aspect, 1.3, 1.0) : fit(aspect, 1.6, 1.25);
    const g = new THREE.Group();
    const y = big ? 2.25 : 1.85;
    g.position.set(slot.x, y, slot.z);
    g.rotation.y = slot.ry;

    const light = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.2, h + 1.6), new THREE.MeshBasicMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    light.position.set(0, 0.25, 0.16);
    g.add(light);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.06), wood);
    frame.position.z = T / 2 + 0.03;
    frame.castShadow = true;
    g.add(frame);
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.1, h + 0.1), M(0xfbf8f2, { roughness: 1 }));
    mat.position.z = T / 2 + 0.061;
    g.add(mat);
    const pic = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      tex
        ? new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.22 })
        : M(0xcbbfb1),
    );
    pic.position.z = T / 2 + 0.063;
    pic.userData.photoIndex = i;
    g.add(pic);
    clickable.push(pic);

    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, Math.min(w * 0.6, 1.4), 12), brass);
    bar.rotation.z = Math.PI / 2;
    bar.position.set(0, h / 2 + 0.22, T / 2 + 0.2);
    g.add(bar);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8), brass);
    arm.rotation.x = Math.PI / 2;
    arm.position.set(0, h / 2 + 0.22, T / 2 + 0.1);
    g.add(arm);

    const p = photos[i];
    if (p.caption) {
      const plaque = canvasTexture(512, 128, (c, cw, ch) => {
        c.fillStyle = '#f7f1e8';
        c.fillRect(0, 0, cw, ch);
        c.fillStyle = '#3a2a20';
        c.font = 'italic 40px Fraunces, Georgia, serif';
        c.textAlign = 'center';
        c.fillText(p.caption.slice(0, 32), cw / 2, p.date ? 58 : 76);
        if (p.date) {
          c.font = '26px Inter, sans-serif';
          c.fillStyle = '#7a6656';
          c.fillText(p.date, cw / 2, 100);
        }
      });
      const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.155), M(0xffffff, { map: plaque, roughness: 0.9 }));
      pl.position.set(0, -h / 2 - 0.32, T / 2 + 0.02);
      g.add(pl);
    }
    scene.add(g);

    const n = new THREE.Vector3(Math.sin(slot.ry), 0, Math.cos(slot.ry));
    interactables.push({
      type: 'photo',
      index: i,
      x: slot.x + n.x * 1.4,
      z: slot.z + n.z * 1.4,
      radius: big ? 2.6 : 1.6,
      label: 'View photo',
    });
  }
  if (photos.length) hangPhoto(0, { x: 0, z: zBack + T / 2, ry: 0, size: 'centre' });
  for (let i = 1; i < photos.length; i++) hangPhoto(i, layout.slots[i - 1]);

  // Spotlight on the centrepiece
  const spot = new THREE.SpotLight(0xfff0d8, 60, 14, 0.42, 0.5, 2);
  spot.position.set(0, H - 0.2, zBack + 4);
  spot.target.position.set(0, 2.2, zBack);
  scene.add(spot, spot.target);

  // Rope barrier in front of the centrepiece
  const velvet = M(0x8a1f2c, { roughness: 0.7 });
  const postXs = [-1.8, 0, 1.8];
  const ropeZ = zBack + 1.4;
  postXs.forEach((x) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.95, 16), brass);
    post.position.set(x, 0.475, ropeZ);
    post.castShadow = true;
    scene.add(post);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 24), brass);
    base.position.set(x, 0.02, ropeZ);
    scene.add(base);
  });
  for (let i = 0; i < postXs.length - 1; i++) {
    const a = postXs[i], b = postXs[i + 1];
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(a, 0.9, ropeZ), new THREE.Vector3((a + b) / 2, 0.68, ropeZ), new THREE.Vector3(b, 0.9, ropeZ)]);
    scene.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.025, 8), velvet));
  }
  colliders.push({ minX: -1.9, maxX: 1.9, minZ: ropeZ - 0.1, maxZ: ropeZ + 0.1, tall: false });

  // Benches
  const cushion = M(0x3f5f57, { roughness: 0.9 });
  function bench(x, z, ry) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.1, 0.62), wood);
    seat.position.y = 0.4;
    const pad = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.08, 0.56), cushion);
    pad.position.y = 0.49;
    g.add(seat, pad);
    [-1.05, 1.05].forEach((lx) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.4, 0.55), wood);
      leg.position.set(lx, 0.2, 0);
      g.add(leg);
    });
    g.traverse((m) => m.isMesh && ((m.castShadow = true), (m.receiveShadow = true)));
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    scene.add(g);
    const sideways = Math.abs(Math.sin(ry)) > 0.5;
    const hw = sideways ? 0.31 : 1.2, hd = sideways ? 1.2 : 0.31;
    colliders.push({ minX: x - hw, maxX: x + hw, minZ: z - hd, maxZ: z + hd, tall: false });
    // Sitters face the bench's local -z direction
    const seats = [-0.55, 0.55].map((lx) => {
      const v = new THREE.Vector3(lx, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
      return { x: x + v.x, z: z + v.z, ry: ry + Math.PI };
    });
    const front = new THREE.Vector3(0, 0, -0.9).applyAxisAngle(new THREE.Vector3(0, 1, 0), ry);
    interactables.push({ type: 'bench', x: x + front.x, z: z + front.z, radius: 1.5, seats, label: 'Sit down' });
  }
  bench(0, zBack + 5.2, 0);
  if (L >= 22) bench(0, zMid + 2, 0);
  bench(7.4, zMid, -Math.PI / 2);

  // Dedication stand by the entrance, facing people as they walk in
  const ded = cfg.dedication || {};
  const dedTex = canvasTexture(1024, 680, (g, w, h) => {
    g.fillStyle = '#2f2a5e';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(238,237,254,0.35)';
    g.lineWidth = 3;
    g.strokeRect(28, 28, w - 56, h - 56);
    g.fillStyle = '#eeedfe';
    g.textAlign = 'center';
    g.font = 'italic 76px Fraunces, Georgia, serif';
    g.fillText(ded.heading || '', w / 2, 150);
    g.font = '44px Fraunces, Georgia, serif';
    const y = wrapText(g, ded.body || '', w / 2, 260, w - 180, 62);
    g.font = 'italic 42px Fraunces, Georgia, serif';
    g.fillText(ded.signature ? '— ' + ded.signature : '', w / 2, Math.min(h - 70, y + 110));
  });
  const stand = new THREE.Group();
  const board = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.06, 0.06), [wood, wood, wood, wood, M(0xffffff, { map: dedTex, roughness: 0.7 }), wood]);
  board.position.y = 1.2;
  board.rotation.x = -0.18;
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 16), brass);
  pole.position.y = 0.38;
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 32), brass);
  foot.position.y = 0.025;
  stand.add(board, pole, foot);
  stand.traverse((m) => m.isMesh && (m.castShadow = true));
  const standZ = zFront - 5;
  stand.position.set(0, 0, standZ);
  scene.add(stand);
  colliders.push({ minX: -0.8, maxX: 0.8, minZ: standZ - 0.3, maxZ: standZ + 0.3, tall: false });
  interactables.push({ type: 'read', x: 0, z: standZ + 1.1, radius: 1.3, label: 'Read the dedication', text: ded });

  // Screening room
  let video = null;
  let screenTex;
  if (cfg.video) {
    video = document.createElement('video');
    video.src = cfg.video;
    video.loop = true;
    video.playsInline = true;
    video.crossOrigin = 'anonymous';
    video.preload = 'auto';
    screenTex = new THREE.VideoTexture(video);
    screenTex.colorSpace = THREE.SRGBColorSpace;
  } else {
    screenTex = canvasTexture(1024, 576, (g, w, h) => {
      g.fillStyle = '#121010';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#f6dcc0';
      g.beginPath();
      g.moveTo(470, 210);
      g.lineTo(470, 330);
      g.lineTo(570, 270);
      g.fill();
      g.font = '38px Inter, sans-serif';
      g.textAlign = 'center';
      g.fillText('Your film plays here', w / 2, 430);
      g.font = '24px Inter, sans-serif';
      g.fillStyle = '#9c8a78';
      g.fillText('Set "video" in src/config.js', w / 2, 475);
    });
  }
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 2.14), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }));
  screen.position.set(roomX - T / 2 - 0.05, 2.1, zMid);
  screen.rotation.y = -Math.PI / 2;
  scene.add(screen);
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.03, 2.3, 3.96), M(0x161414, { roughness: 0.6 }));
  bezel.position.set(roomX - T / 2 - 0.016, 2.1, zMid);
  scene.add(bezel);
  const roomLight = new THREE.PointLight(0xbfd2ff, 6, 6, 2);
  roomLight.position.set(roomX - 1.2, 2.2, zMid);
  scene.add(roomLight);

  // Plants in the corners
  const pot = M(0xd8cbbb, { roughness: 0.6 });
  const leaf = M(0x4f7a4a, { roughness: 0.8 });
  [[-5.2, zBack + 0.9], [5.2, zBack + 0.9], [-5.2, zFront - 0.9], [5.2, zFront - 0.9], [roomX - 0.7, zMid - 2.5], [roomX - 0.7, zMid + 2.5]].forEach(([x, z]) => {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.22, 0.5, 24), pot);
    p.position.y = 0.25;
    g.add(p);
    for (let i = 0; i < 7; i++) {
      const l = new THREE.Mesh(new THREE.SphereGeometry(0.22 + (i % 3) * 0.05, 16, 12), leaf);
      const a = i * 0.9;
      l.position.set(Math.cos(a) * 0.15, 0.7 + (i % 4) * 0.18, Math.sin(a) * 0.15);
      l.scale.y = 1.3;
      g.add(l);
    }
    g.traverse((m) => m.isMesh && (m.castShadow = true));
    g.position.set(x, 0, z);
    scene.add(g);
    colliders.push({ minX: x - 0.32, maxX: x + 0.32, minZ: z - 0.32, maxZ: z + 0.32, tall: false });
  });

  onProgress(1);

  const inScreenRoom = (p) => p.x > HALF_W - 0.2 && Math.abs(p.z - zMid) < 3.2;
  let videoWanted = false;

  return {
    colliders,
    interactables,
    clickable,
    spawn: { x: 0, z: zFront - 2.9, ry: Math.PI },
    video,
    update(dt, playerPos) {
      sun.position.set(playerPos.x + 4, 10, playerPos.z + 6);
      sun.target.position.set(playerPos.x, 0, playerPos.z);
      if (video) {
        const want = inScreenRoom(playerPos);
        if (want !== videoWanted) {
          videoWanted = want;
          if (want) {
            // If the browser blocks sound, start muted and unmute on the next tap or key press.
            video.play().catch(() => {
              video.muted = true;
              video.play().catch(() => {});
              const unmute = () => (video.muted = false);
              addEventListener('pointerdown', unmute, { once: true });
              addEventListener('keydown', unmute, { once: true });
            });
          }
          else video.pause();
        }
      }
    },
  };
}
