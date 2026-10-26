import './style.css';
import * as THREE from 'three';
import { config } from './config.js';
import { buildWorld } from './world.js';
import { Avatar } from './avatar.js';
import { createControls } from './controls.js';
import { createNet, onlineConfigured } from './net.js';
import { createUI } from './ui.js';
import media from 'virtual:media';

const WALK_SPEED = 2.4;
const RADIUS = 0.3;
const SEND_EVERY = 1 / 12;

const store = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

// Turn the 'auto' settings in config.js into the files actually sitting in public/.
if (!Array.isArray(config.photos)) {
  let files = media.photos;
  const first = config.centrepiece;
  if (first && files.includes(first)) files = [first, ...files.filter((f) => f !== first)];
  config.photos = files.map((f) => {
    const extra = config.captions?.[f];
    return { src: `/photos/${encodeURIComponent(f)}`, caption: '', date: '', ...(typeof extra === 'string' ? { caption: extra } : extra) };
  });
}
if (config.video === 'auto') {
  const playable = media.videos.find((f) => /\.(mp4|webm|m4v)$/i.test(f));
  config.video = playable ? `/video/${encodeURIComponent(playable)}` : null;
  if (!playable && media.videos.length) console.warn('Found only .mov videos in public/video. Convert one to .mp4 so browsers can play it.');
}

const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.body.classList.add('touch');
document.title = config.title;
document.getElementById('join-title').textContent = config.title;

const ui = createUI(config);
const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isTouch ? 1.5 : 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x2a2420);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
resize();
addEventListener('resize', resize);

// ---- Join screen ----
const playerByName = (name) =>
  config.players.find((p) => p.name === name) || { name, color: '#c2577a', look: config.players[0].look };
let chosen = store.get('museum.name');
if (!config.players.some((p) => p.name === chosen)) chosen = null;
ui.renderWho(config.players, chosen, (name) => {
  chosen = name;
  ui.joinError('');
});
const passInput = document.getElementById('pass');
passInput.value = store.get('museum.secret') || '';
passInput.addEventListener('keydown', (e) => e.key === 'Enter' && start());
document.getElementById('enter').onclick = start;

let started = false;
async function start() {
  if (started) return;
  if (!chosen) return ui.joinError('Pick who you are first.');
  const secret = passInput.value.trim();
  if (!secret) return ui.joinError('Type your secret word.');
  started = true;
  ui.joinError('');
  store.set('museum.name', chosen);
  store.set('museum.secret', secret);
  ui.showLoading(0.02, 'Hanging the frames…');
  try {
    const music = config.music ? new Audio(config.music) : null;
    if (music) {
      music.loop = true;
      music.volume = 0.35;
      music.play().catch(() => {});
    }
    const world = await buildWorld(scene, config, (p) => ui.showLoading(p, p < 1 ? 'Hanging the frames…' : 'Opening the doors…'));
    run(world, playerByName(chosen), secret, music);
  } catch (e) {
    console.error(e);
    started = false;
    ui.resetJoin();
    ui.joinError('Something went wrong while loading. Check the console, then try again.');
  }
}

// ---- The game ----
function run(world, myPlayer, secret, music) {
  const myId = Math.random().toString(36).slice(2, 10);
  const clock = new THREE.Clock();
  let lastSent = 0;
  let lastKey = '';
  const me = new Avatar(myPlayer, scene);
  const pos = me.group.position;
  pos.set(world.spawn.x + (Math.random() - 0.5) * 1.2, 0, world.spawn.z);
  me.group.rotation.y = world.spawn.ry;
  let facing = world.spawn.ry;
  let sitting = null; // { seat, bench }
  const remotes = new Map(); // id -> { avatar, target }

  ui.enterGame();
  ui.toast(isTouch ? 'Joystick to walk · drag to look' : 'W A S D to walk · drag to look');

  if (music) {
    const btn = document.getElementById('btn-music');
    btn.hidden = false;
    btn.onclick = () => {
      if (music.paused) music.play().catch(() => {});
      else music.pause();
      btn.classList.toggle('off', music.paused);
    };
  }

  const controls = createControls(canvas, document.getElementById('joystick'), {
    onAction: doAction,
    onTap: tapAt,
    isTyping: () => ui.isTyping(),
  });
  controls.cam.yaw = facing + Math.PI; // start with the camera behind the player
  document.getElementById('btn-action').onclick = doAction;
  if (import.meta.env.DEV) window.__museum = { controls, pos, world, camera, me };

  // Network
  const net = createNet(secret, { id: myId, name: myPlayer.name });
  if (net.mode === 'local') {
    ui.sys('Test mode: open this page in another tab with the same secret word to see a second visitor. Add Supabase keys (see README) to play together online.');
  }
  net.connected.then(
    () => net.mode === 'online' && ui.sys('Connected. Share the link and your secret word to meet here.'),
    () => ui.sys("Couldn't connect to the live server. You can still walk around."),
  );

  let people = [{ id: myId, name: myPlayer.name }];
  function refreshPeople() {
    ui.setPeople(people.map((p) => ({ name: p.name, color: playerByName(p.name).color, me: p.id === myId })));
  }
  refreshPeople();

  function remoteFor(id, name) {
    let r = remotes.get(id);
    if (!r) {
      r = { avatar: new Avatar(playerByName(name), scene), name, target: null };
      remotes.set(id, r);
    }
    return r;
  }

  net.on('presence', (list) => {
    const before = new Set(people.map((p) => p.id));
    const now = new Set(list.map((p) => p.id));
    for (const p of list) if (!before.has(p.id) && p.id !== myId) ui.toast(`${p.name} is here`);
    for (const p of people) {
      if (!now.has(p.id) && p.id !== myId) {
        ui.toast(`${p.name} left`);
        const r = remotes.get(p.id);
        if (r) {
          r.avatar.dispose();
          remotes.delete(p.id);
        }
      }
    }
    people = list.some((p) => p.id === myId) ? list : [{ id: myId, name: myPlayer.name }, ...list];
    refreshPeople();
  });
  net.on('peer-joined', () => (lastSent = -1)); // make sure the newcomer gets our position right away
  net.on('state', (s) => {
    if (s.id === myId) return;
    const r = remoteFor(s.id, s.name);
    const first = !r.target;
    r.target = s;
    if (first) r.avatar.setPose(s.x, s.z, s.ry, { moving: s.moving, sitting: s.sitting });
  });
  net.on('chat', (c) => {
    if (c.id === myId) return;
    const r = remotes.get(c.id);
    if (r) r.avatar.say(c.text, clock.elapsedTime);
    ui.addChat(c.name, playerByName(c.name).color, c.text);
  });
  net.on('heart', (h) => {
    const r = remotes.get(h.id);
    if (r) r.avatar.heart();
  });

  ui.onChatSubmit((text) => {
    me.say(text, clock.elapsedTime);
    ui.addChat(myPlayer.name, myPlayer.color, text);
    net.sendChat({ id: myId, name: myPlayer.name, text, ts: Date.now() });
  });
  const sendHeart = () => {
    me.heart();
    net.sendHeart({ id: myId });
  };
  document.getElementById('btn-heart').onclick = sendHeart;
  addEventListener('keydown', (e) => {
    if (e.code === 'KeyH' && !ui.isTyping()) sendHeart();
  });

  // Interactions
  let nearby = null;
  function findNearby() {
    let best = null;
    let bestD = Infinity;
    for (const it of world.interactables) {
      const d = Math.hypot(pos.x - it.x, pos.z - it.z);
      if (d < it.radius && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }
  function seatTaken(seat) {
    for (const r of remotes.values()) if (r.target && r.target.sitting && Math.hypot(r.target.x - seat.x, r.target.z - seat.z) < 0.3) return true;
    return false;
  }
  function standUp() {
    if (!sitting) return;
    pos.x = sitting.bench.x;
    pos.z = sitting.bench.z;
    sitting = null;
  }
  function doAction() {
    if (sitting) return standUp();
    if (!nearby) return;
    if (nearby.type === 'photo') ui.openPhoto(nearby.index);
    if (nearby.type === 'read') ui.showNote(nearby.text.heading, nearby.text.body, nearby.text.signature);
    if (nearby.type === 'bench') {
      const free = nearby.seats
        .filter((s) => !seatTaken(s))
        .sort((a, b) => Math.hypot(pos.x - a.x, pos.z - a.z) - Math.hypot(pos.x - b.x, pos.z - b.z))[0];
      if (!free) return ui.toast('This bench is full');
      sitting = { seat: free, bench: nearby };
      pos.x = free.x;
      pos.z = free.z;
      facing = free.ry;
    }
  }
  const raycaster = new THREE.Raycaster();
  function tapAt(x, y) {
    raycaster.setFromCamera(new THREE.Vector2((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1), camera);
    const hit = raycaster.intersectObjects(world.clickable, false)[0];
    if (!hit) return;
    if (hit.distance > 9) return ui.toast('Walk a little closer');
    ui.openPhoto(hit.object.userData.photoIndex);
  }

  function collide() {
    for (let pass = 0; pass < 2; pass++) {
      for (const c of world.colliders) {
        const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
        const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 >= RADIUS * RADIUS) continue;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2);
          pos.x = cx + (dx / d) * RADIUS;
          pos.z = cz + (dz / d) * RADIUS;
        } else {
          const pushes = [pos.x - c.minX + RADIUS, c.maxX - pos.x + RADIUS, pos.z - c.minZ + RADIUS, c.maxZ - pos.z + RADIUS];
          const m = Math.min(...pushes);
          if (m === pushes[0]) pos.x -= pushes[0];
          else if (m === pushes[1]) pos.x += pushes[1];
          else if (m === pushes[2]) pos.z -= pushes[2];
          else pos.z += pushes[3];
        }
      }
    }
  }

  // Main loop
  renderer.setAnimationLoop(() => {
    const dt = Math.min(0.05, clock.getDelta());
    const t = clock.elapsedTime;

    const move = controls.getMove();
    const moving = Math.hypot(move.x, move.y) > 0.08;
    const speed = WALK_SPEED * Math.min(1, Math.hypot(move.x, move.y));
    if (moving && sitting) standUp();
    if (moving) {
      const yaw = controls.cam.yaw;
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const dx = fx * move.y + rx * move.x;
      const dz = fz * move.y + rz * move.x;
      const len = Math.hypot(dx, dz) || 1;
      pos.x += (dx / len) * speed * dt;
      pos.z += (dz / len) * speed * dt;
      facing = Math.atan2(dx, dz);
      collide();
    }
    const state = { moving, sitting: !!sitting, speed };
    me.setPose(pos.x, pos.z, facing, state);
    me.update(dt, t);

    nearby = sitting ? null : findNearby();
    ui.setPrompt(sitting ? 'Stand up' : nearby ? nearby.label : null);

    for (const r of remotes.values()) {
      if (r.target) {
        const k = Math.min(1, dt * 10);
        const p = r.avatar.group.position;
        r.avatar.setPose(p.x + (r.target.x - p.x) * k, p.z + (r.target.z - p.z) * k, r.target.ry, { moving: r.target.moving, sitting: r.target.sitting, speed: WALK_SPEED });
      }
      r.avatar.update(dt, t);
    }

    // Send my state ~12 times a second while it changes, and every second regardless.
    const key = `${pos.x.toFixed(2)},${pos.z.toFixed(2)},${facing.toFixed(2)},${moving},${!!sitting}`;
    if ((key !== lastKey && t - lastSent > SEND_EVERY) || t - lastSent > 1 || lastSent < 0) {
      net.sendState({ id: myId, name: myPlayer.name, x: pos.x, z: pos.z, ry: facing, moving, sitting: !!sitting });
      lastSent = t;
      lastKey = key;
    }

    world.update(dt, pos);
    controls.updateCamera(camera, pos, world.colliders, dt);
    renderer.render(scene, camera);
  });

  addEventListener('beforeunload', () => net.leave());
}

if (!onlineConfigured) console.info('Supabase keys not set: running in same-browser test mode.');
