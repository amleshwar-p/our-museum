import { createClient } from '@supabase/supabase-js';

// Turns the secret word into a room name, so a different word means a different (empty) museum.
function roomFor(secret) {
  let h = 0x811c9dc5;
  for (const ch of secret.trim().toLowerCase()) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return 'museum-' + (h >>> 0).toString(36);
}

function emitter() {
  const handlers = {};
  return {
    on(evt, fn) {
      (handlers[evt] ||= []).push(fn);
    },
    emit(evt, data) {
      (handlers[evt] || []).forEach((fn) => fn(data));
    },
  };
}

export const onlineConfigured = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

// Online play through Supabase Realtime (free tier). Needs VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.
function supabaseNet(room, me) {
  const ev = emitter();
  const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
  const channel = supabase.channel(room, { config: { broadcast: { self: false }, presence: { key: me.id } } });
  let ready = false;

  channel
    .on('presence', { event: 'sync' }, () => {
      const list = Object.values(channel.presenceState()).map((metas) => metas[0]);
      ev.emit('presence', list);
    })
    .on('presence', { event: 'join' }, () => ev.emit('peer-joined'))
    .on('broadcast', { event: 'state' }, ({ payload }) => ev.emit('state', payload))
    .on('broadcast', { event: 'chat' }, ({ payload }) => ev.emit('chat', payload))
    .on('broadcast', { event: 'heart' }, ({ payload }) => ev.emit('heart', payload));

  const connected = new Promise((resolve, reject) => {
    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        ready = true;
        await channel.track({ id: me.id, name: me.name });
        resolve();
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        ev.emit('status', 'offline');
        reject(new Error(status));
      }
    });
  });

  const send = (event, payload) => ready && channel.send({ type: 'broadcast', event, payload });
  return {
    mode: 'online',
    connected,
    on: ev.on,
    sendState: (s) => send('state', s),
    sendChat: (c) => send('chat', c),
    sendHeart: (h) => send('heart', h),
    leave: () => supabase.removeChannel(channel),
  };
}

// Same-device fallback (several tabs in one browser), handy for testing without any setup.
function localNet(room, me) {
  const ev = emitter();
  const bc = new BroadcastChannel(room);
  const peers = new Map([[me.id, { id: me.id, name: me.name, seen: Infinity }]]);
  const publish = () => ev.emit('presence', [...peers.values()].map(({ id, name }) => ({ id, name })));
  let closed = false;
  const post = (type, payload) => !closed && bc.postMessage({ type, payload });

  bc.onmessage = ({ data }) => {
    const { type, payload } = data;
    if (type === 'hello' || type === 'state') {
      const isNew = !peers.has(payload.id);
      peers.set(payload.id, { id: payload.id, name: payload.name, seen: performance.now() });
      if (isNew) {
        publish();
        ev.emit('peer-joined');
        post('hello', { id: me.id, name: me.name });
      }
    }
    if (type === 'bye') {
      peers.delete(payload.id);
      publish();
    }
    if (type === 'state' || type === 'chat' || type === 'heart') ev.emit(type, payload);
  };

  const timer = setInterval(() => {
    post('hello', { id: me.id, name: me.name });
    const now = performance.now();
    let changed = false;
    for (const [id, p] of peers) if (id !== me.id && now - p.seen > 6000) changed = peers.delete(id) || changed;
    if (changed) publish();
  }, 2000);
  const bye = () => post('bye', { id: me.id });
  addEventListener('beforeunload', bye);
  post('hello', { id: me.id, name: me.name });
  setTimeout(publish, 0);

  return {
    mode: 'local',
    connected: Promise.resolve(),
    on: ev.on,
    sendState: (s) => post('state', s),
    sendChat: (c) => post('chat', c),
    sendHeart: (h) => post('heart', h),
    leave: () => {
      bye();
      clearInterval(timer);
      closed = true;
      bc.close();
    },
  };
}

export function createNet(secret, me) {
  const room = roomFor(secret);
  return onlineConfigured ? supabaseNet(room, me) : localNet(room, me);
}
