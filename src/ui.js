const $ = (id) => document.getElementById(id);

const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function createUI(cfg) {
  const chatInput = $('chat-input');
  const lightbox = $('lightbox');
  const panel = $('help');
  const helpHtml = panel.innerHTML;
  let lbIndex = 0;
  let toastTimer = 0;

  function showPhoto(i) {
    const n = cfg.photos.length;
    lbIndex = ((i % n) + n) % n;
    const p = cfg.photos[lbIndex];
    $('lb-img').src = p.src;
    $('lb-img').alt = p.caption || `Photo ${lbIndex + 1}`;
    $('lb-caption').textContent = p.caption || '';
    $('lb-date').textContent = p.date || '';
    $('lb-prev').hidden = $('lb-next').hidden = n < 2;
  }
  const closeLightbox = () => (lightbox.hidden = true);
  $('lb-close').onclick = closeLightbox;
  $('lb-prev').onclick = () => showPhoto(lbIndex - 1);
  $('lb-next').onclick = () => showPhoto(lbIndex + 1);
  lightbox.addEventListener('click', (e) => e.target === lightbox && closeLightbox());
  addEventListener('keydown', (e) => {
    if (lightbox.hidden || e.defaultPrevented) return; // the keypress that opened it
    if (e.key === 'Escape' || e.key === 'e' || e.key === 'E') closeLightbox();
    if (e.key === 'ArrowLeft') showPhoto(lbIndex - 1);
    if (e.key === 'ArrowRight') showPhoto(lbIndex + 1);
  });

  // The centred panel shows either the controls help or a note (like the dedication).
  function openPanel(html) {
    panel.innerHTML = html;
    panel.querySelector('button').onclick = () => (panel.hidden = true);
    panel.hidden = false;
  }
  $('btn-help').onclick = () => (panel.hidden ? openPanel(helpHtml) : (panel.hidden = true));
  addEventListener('keydown', (e) => e.key === 'Escape' && (panel.hidden = true));

  return {
    renderWho(players, selected, onPick) {
      const box = $('who');
      box.innerHTML = '';
      players.forEach((p) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.setProperty('--c', p.color);
        b.className = p.name === selected ? 'sel' : '';
        b.innerHTML = `<span class="dot">${escapeHtml(p.name[0] || '?')}</span><span class="nm">${escapeHtml(p.name)}</span>`;
        b.onclick = () => {
          [...box.children].forEach((c) => c.classList.remove('sel'));
          b.classList.add('sel');
          onPick(p.name);
        };
        box.appendChild(b);
      });
    },
    joinError(msg) {
      $('join-error').textContent = msg;
      $('join-error').hidden = !msg;
    },
    showLoading(progress, text) {
      $('loading').hidden = false;
      $('enter').disabled = true;
      $('loading-bar').style.width = `${Math.round(progress * 100)}%`;
      if (text) $('loading-text').textContent = text;
    },
    resetJoin() {
      $('loading').hidden = true;
      $('enter').disabled = false;
    },
    enterGame() {
      $('join').hidden = true;
      $('hud').hidden = false;
    },
    setPeople(list) {
      $('people').innerHTML = list
        .map((p) => `<span class="pill" style="--c:${p.color}"><i></i>${escapeHtml(p.name)}${p.me ? ' (you)' : ''}</span>`)
        .join('');
    },
    addChat(name, color, text) {
      const log = $('chat-log');
      const div = document.createElement('div');
      div.className = 'msg';
      div.style.setProperty('--c', color);
      div.innerHTML = `<b>${escapeHtml(name)}</b> ${escapeHtml(text)}`;
      log.appendChild(div);
      setTimeout(() => div.classList.add('fade'), 15000);
      setTimeout(() => div.remove(), 16500);
      while (log.children.length > 8) log.firstChild.remove();
    },
    sys(text) {
      const div = document.createElement('div');
      div.className = 'msg sys';
      div.textContent = text;
      $('chat-log').appendChild(div);
      setTimeout(() => div.classList.add('fade'), 12000);
      setTimeout(() => div.remove(), 13500);
    },
    toast(text) {
      const t = $('toast');
      t.textContent = text;
      t.hidden = false;
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => (t.hidden = true), 2600);
    },
    setPrompt(label) {
      const p = $('prompt');
      const btn = $('btn-action');
      if (!label) {
        p.hidden = true;
        btn.hidden = true;
        return;
      }
      p.innerHTML = `<kbd>E</kbd>${escapeHtml(label)}`;
      p.hidden = false;
      btn.textContent = label.split(' ')[0];
      btn.hidden = !document.body.classList.contains('touch');
    },
    openPhoto(i) {
      showPhoto(i);
      lightbox.hidden = false;
    },
    showNote(heading, body, signature) {
      openPanel(
        `<h3>${escapeHtml(heading || '')}</h3><p>${escapeHtml(body || '')}</p>` +
          (signature ? `<p style="font-style:italic;text-align:right">— ${escapeHtml(signature)}</p>` : '') +
          '<button>Close</button>',
      );
    },
    isTyping() {
      return document.activeElement === chatInput || !lightbox.hidden;
    },
    onChatSubmit(fn) {
      $('chat-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        chatInput.value = '';
        chatInput.blur();
        if (text) fn(text);
      });
      addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && document.activeElement !== chatInput && lightbox.hidden && !$('hud').hidden) {
          e.preventDefault();
          chatInput.focus();
        }
        if (e.key === 'Escape' && document.activeElement === chatInput) chatInput.blur();
      });
    },
  };
}
