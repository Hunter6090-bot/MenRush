const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

let meta = null;
let connections = [];
let studioSettings = null;
let weekData = null;
let imageGenConfigured = false;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

function switchTab(name) {
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
  $$('.panel').forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
  if (name === 'week') loadWeek();
}

$$('.tab').forEach((t) => {
  t.addEventListener('click', () => switchTab(t.dataset.tab));
});

function collectFields(card, platform) {
  const fields = {};
  for (const f of meta.platforms.find((p) => p.id === platform).fields) {
    const input = $(`[data-field="${f.key}"]`, card);
    fields[f.key] = input?.value ?? '';
  }
  return fields;
}

function renderImageGenCard() {
  const masked = $('#image-gen-masked');
  const keyInput = $('#image-gen-key');
  const providerInput = $('#image-gen-provider');
  const ig = studioSettings?.imageGen;
  if (providerInput && !providerInput.value) providerInput.value = ig?.provider || '';
  if (masked) {
    masked.textContent = ig?.configured ? `On device: ${ig.masked}` : 'No key saved — remote Generate stays off.';
  }
  if (keyInput) {
    keyInput.placeholder = ig?.configured ? 'Saved — enter new value to replace' : '';
  }
}

function renderCards() {
  const root = $('#cards');
  root.innerHTML = '';
  for (const conn of connections) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.platform = conn.platform;

    const fieldHtml = Object.entries(conn.fields)
      .map(([key, f]) => {
        return `<div class="field">
          <label for="${conn.platform}-${key}">${f.label}${f.optional ? ' (optional)' : ''}</label>
          <input id="${conn.platform}-${key}" data-field="${key}" type="password" autocomplete="off"
            placeholder="${f.set ? 'Saved — enter new value to replace' : ''}"
            value="" />
          ${f.set ? `<div class="hint-set">On device: ${f.masked}</div>` : ''}
        </div>`;
      })
      .join('');

    const status = conn.verified
      ? `<span class="pill ok">Verified${conn.verifiedAs ? ` · ${conn.verifiedAs}` : ''}</span>`
      : conn.lastVerifyError
        ? `<span class="pill err">Verify failed</span>`
        : `<span class="pill">Not verified</span>`;

    card.innerHTML = `
      <div class="card-head">
        <h3>${conn.label}</h3>
        <label class="toggle">
          <input type="checkbox" data-toggle ${conn.enabled ? 'checked' : ''} />
          On
        </label>
      </div>
      <p class="card-help">${conn.help}</p>
      <div class="status-row">${status}</div>
      <div class="fields">${fieldHtml}</div>
      <div class="card-actions">
        <button type="button" class="btn copper" data-verify>Verify</button>
        <button type="button" class="btn ghost" data-save>Save</button>
      </div>
      <div class="msg" data-msg></div>
    `;

    const msg = $('[data-msg]', card);

    $('[data-toggle]', card).addEventListener('change', async (e) => {
      try {
        const data = await api(`/api/connections/${conn.platform}`, {
          method: 'PUT',
          body: JSON.stringify({ enabled: e.target.checked }),
        });
        upsertConn(data.connection);
        msg.textContent = e.target.checked ? 'On — in the week.' : 'Off — excluded from the week.';
        msg.className = 'toast-ok';
      } catch (err) {
        e.target.checked = !e.target.checked;
        msg.textContent = err.message;
        msg.className = 'toast-err';
      }
    });

    $('[data-save]', card).addEventListener('click', async () => {
      msg.textContent = 'Saving…';
      msg.className = 'muted';
      try {
        const data = await api(`/api/connections/${conn.platform}`, {
          method: 'PUT',
          body: JSON.stringify({ fields: collectFields(card, conn.platform) }),
        });
        upsertConn(data.connection);
        renderCards();
      } catch (err) {
        msg.textContent = err.message;
        msg.className = 'toast-err';
      }
    });

    $('[data-verify]', card).addEventListener('click', async () => {
      msg.textContent = 'Verifying on this device…';
      msg.className = 'muted';
      try {
        const data = await api(`/api/connections/${conn.platform}/verify`, {
          method: 'POST',
          body: JSON.stringify({
            enabled: $('[data-toggle]', card).checked,
            fields: collectFields(card, conn.platform),
          }),
        });
        upsertConn(data.connection);
        renderCards();
        const again = $(`.card[data-platform="${conn.platform}"] [data-msg]`);
        if (again) {
          again.textContent = `Verified${data.as ? ` as ${data.as}` : ''}. Leave On, then approve the week.`;
          again.className = 'toast-ok';
        }
      } catch (err) {
        if (err.data?.connection) upsertConn(err.data.connection);
        renderCards();
        const again = $(`.card[data-platform="${conn.platform}"] [data-msg]`);
        if (again) {
          again.textContent = err.message || 'Verify failed';
          again.className = 'toast-err';
        }
      }
    });

    root.appendChild(card);
  }
  renderImageGenCard();
}

function upsertConn(c) {
  const i = connections.findIndex((x) => x.platform === c.platform);
  if (i >= 0) connections[i] = c;
  else connections.push(c);
}

function readyLabel(p) {
  if (p.format === 'story' || p.format === 'reel') return 'Preview only';
  if (p.ready) return 'Ready';
  if (p.included) return 'On, not verified';
  return 'Off — excluded';
}

function aspectClass(format) {
  if (format === 'story' || format === 'reel') return 'tall';
  if (format === 'post') return 'wide';
  return 'square';
}

function visualWorkspaceHtml(p) {
  const media = p.media || {};
  const prompt = media.prompt || '';
  const preview = media.hasImage
    ? `<img data-preview src="${escapeAttr(media.imageUrl)}" alt="Draft preview" />`
    : `<div class="visual-empty">No image yet — upload or Generate poster from your prompt.</div>`;
  const remoteDisabled = imageGenConfigured ? '' : 'disabled';
  const remoteTitle = imageGenConfigured
    ? 'Remote AI Generate (provider not fully wired — use local poster or upload)'
    : 'Set an image API key under Connections → Image generate (optional)';

  return `
    <div class="visual" data-visual>
      <div class="visual-frame ${aspectClass(p.format)}">
        ${preview}
      </div>
      <div class="visual-controls">
        <label class="prompt-label" for="prompt-${cssId(p.id)}">Poster prompt</label>
        <textarea id="prompt-${cssId(p.id)}" data-prompt rows="3" placeholder="Type what you want on the poster…">${escapeHtml(prompt)}</textarea>
        ${
          p.platform === 'instagram' && p.format === 'feed'
            ? `<label class="prompt-label" for="puburl-${cssId(p.id)}">Public image URL (IG publish only)</label>
               <input id="puburl-${cssId(p.id)}" data-public-url type="url" placeholder="https://… (Graph cannot fetch localhost uploads)" value="${escapeAttr(media.publicImageUrl || '')}" />`
            : ''
        }
        <div class="visual-actions">
          <label class="btn ghost file-btn">Upload<input type="file" data-upload accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden /></label>
          <button type="button" class="btn copper" data-gen-local>Generate poster</button>
          <button type="button" class="btn ghost" data-gen-remote ${remoteDisabled} title="${escapeAttr(remoteTitle)}">Generate (AI)</button>
          <button type="button" class="btn ghost" data-save-prompt>Save prompt</button>
          <button type="button" class="btn ghost" data-clear-image ${media.hasImage ? '' : 'disabled'}>Clear image</button>
        </div>
        <div class="msg" data-visual-msg></div>
      </div>
    </div>
  `;
}

function cssId(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, '_');
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function wireVisual(el, post) {
  const msg = $('[data-visual-msg]', el);
  const promptEl = $('[data-prompt]', el);
  const pubUrlEl = $('[data-public-url]', el);

  const setMsg = (text, ok) => {
    msg.textContent = text;
    msg.className = ok === true ? 'toast-ok' : ok === false ? 'toast-err' : 'muted';
  };

  const applyMedia = (media) => {
    post.media = media;
    const frame = $('.visual-frame', el);
    if (media?.hasImage) {
      frame.innerHTML = `<img data-preview src="${escapeAttr(media.imageUrl)}" alt="Draft preview" />`;
    } else {
      frame.innerHTML = `<div class="visual-empty">No image yet — upload or Generate poster from your prompt.</div>`;
    }
    $('[data-clear-image]', el).disabled = !media?.hasImage;
  };

  $('[data-save-prompt]', el).addEventListener('click', async () => {
    setMsg('Saving…');
    try {
      const body = { prompt: promptEl.value };
      if (pubUrlEl) body.publicImageUrl = pubUrlEl.value;
      const data = await api(`/api/drafts/${encodeURIComponent(post.id)}/media`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      applyMedia(data.media);
      setMsg('Prompt saved on this device.', true);
    } catch (err) {
      setMsg(err.message, false);
    }
  });

  $('[data-upload]', el).addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setMsg('Uploading…');
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const data = await api(`/api/drafts/${encodeURIComponent(post.id)}/image`, {
        method: 'POST',
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: file.type || 'image/png',
          filename: file.name,
        }),
      });
      applyMedia(data.media);
      setMsg('Image attached to this draft.', true);
    } catch (err) {
      setMsg(err.message, false);
    }
  });

  $('[data-clear-image]', el).addEventListener('click', async () => {
    setMsg('Clearing…');
    try {
      const data = await api(`/api/drafts/${encodeURIComponent(post.id)}/image`, { method: 'DELETE' });
      applyMedia(data.media);
      setMsg('Image cleared.', true);
    } catch (err) {
      setMsg(err.message, false);
    }
  });

  $('[data-gen-local]', el).addEventListener('click', async () => {
    setMsg('Generating local poster…');
    try {
      const data = await api(`/api/drafts/${encodeURIComponent(post.id)}/generate`, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'local',
          prompt: promptEl.value,
          format: post.format,
          platform: post.platform,
        }),
      });
      if (promptEl && data.media?.prompt) promptEl.value = data.media.prompt;
      applyMedia(data.media);
      setMsg('Local poster ready — preview only until you Approve a publishable draft.', true);
    } catch (err) {
      setMsg(err.message, false);
    }
  });

  $('[data-gen-remote]', el).addEventListener('click', async () => {
    if (!imageGenConfigured) return;
    setMsg('Remote Generate…');
    try {
      await api(`/api/drafts/${encodeURIComponent(post.id)}/generate`, {
        method: 'POST',
        body: JSON.stringify({
          mode: 'remote',
          prompt: promptEl.value,
          format: post.format,
          platform: post.platform,
        }),
      });
    } catch (err) {
      setMsg(err.message || 'Remote Generate unavailable — use local poster or upload.', false);
    }
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function renderWeek() {
  const w = weekData.week;
  $('#week-title').textContent = `Week ${w.week} — ${w.theme}`;
  $('#week-meta').textContent = `${w.start} → ${w.end} (UK) · today ${w.today}${
    w.note ? ` · ${w.note}` : ''
  } · source: ${weekData.source}`;
  $('#approve-hint').textContent = weekData.approveHint || '';
  imageGenConfigured = Boolean(weekData.imageGenConfigured);

  const root = $('#week-posts');
  root.innerHTML = '';
  if (!weekData.posts.length) {
    root.innerHTML = `<p class="muted">No drafts for this week in the local pack.</p>`;
    return;
  }

  let lastDate = '';
  for (const p of weekData.posts) {
    if (p.date !== lastDate) {
      lastDate = p.date;
      const h = document.createElement('h3');
      h.className = 'day-heading';
      h.textContent = p.date;
      root.appendChild(h);
    }
    const el = document.createElement('article');
    el.className = `post${p.included ? '' : ' excluded'}${p.visual ? ' has-visual' : ''}`;
    el.dataset.id = p.id;
    const slot = p.slotLabel || p.platform.toUpperCase();
    el.innerHTML = `
      <div class="post-meta">
        <span class="slot">${escapeHtml(slot)}</span>
        <span>${escapeHtml(p.timeUk || '')}</span>
        <span>${escapeHtml(p.format || p.kind || 'draft')}</span>
        <span>${escapeHtml(readyLabel(p))}</span>
      </div>
      <pre class="post-body">${escapeHtml(p.body)}</pre>
      ${p.visual ? visualWorkspaceHtml(p) : ''}
    `;
    root.appendChild(el);
    if (p.visual) wireVisual(el, p);
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function loadConnections() {
  const data = await api('/api/connections');
  connections = data.connections;
  studioSettings = data.studio || null;
  imageGenConfigured = Boolean(studioSettings?.imageGen?.configured);
  renderCards();
}

async function loadWeek() {
  weekData = await api('/api/week');
  renderWeek();
}

$('#btn-refresh-week').addEventListener('click', () => loadWeek());

$('#btn-save-image-gen')?.addEventListener('click', async () => {
  const msg = $('#image-gen-msg');
  msg.textContent = 'Saving…';
  msg.className = 'muted';
  try {
    const data = await api('/api/studio/image-gen', {
      method: 'PUT',
      body: JSON.stringify({
        apiKey: $('#image-gen-key').value,
        provider: $('#image-gen-provider').value,
      }),
    });
    studioSettings = data.studio;
    imageGenConfigured = Boolean(studioSettings?.imageGen?.configured);
    $('#image-gen-key').value = '';
    renderImageGenCard();
    msg.textContent = imageGenConfigured
      ? 'Image key saved on this device. Generate (AI) unlocks on This week.'
      : 'Saved.';
    msg.className = 'toast-ok';
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'toast-err';
  }
});

$('#btn-approve').addEventListener('click', async () => {
  if (!weekData) await loadWeek();
  const ready = weekData.readyPlatforms || [];
  const list = $('#confirm-platforms');
  list.innerHTML = '';
  if (!ready.length) {
    list.innerHTML = '<li>None — turn On and Verify at least one platform first.</li>';
  } else {
    ready.forEach((p) => {
      const li = document.createElement('li');
      li.textContent = p;
      list.appendChild(li);
    });
  }
  const dlg = $('#confirm-dialog');
  dlg.showModal();
  dlg.addEventListener(
    'close',
    async () => {
      if (dlg.returnValue !== 'ok') return;
      if (!ready.length) return;
      const box = $('#approve-result');
      box.classList.remove('hidden');
      box.innerHTML = '<p class="muted">Publishing…</p>';
      try {
        const result = await api('/api/week/approve', {
          method: 'POST',
          body: JSON.stringify({ confirm: true }),
        });
        box.innerHTML =
          `<h3>Publish results (${result.summary.ok}/${result.summary.total} ok)</h3>` +
          result.results
            .map(
              (r) =>
                `<div class="result-row ${r.ok ? 'ok' : 'fail'}">${r.platform}${
                  r.format ? `/${r.format}` : ''
                } ${r.date} ${r.timeUk || ''} — ${
                  r.ok
                    ? `ok${r.externalId ? ` · ${r.externalId}` : ''}${r.mediaAttached ? ' · media' : ''}${
                        r.warning ? ` · ${r.warning}` : ''
                      }`
                    : r.error
                }</div>`,
            )
            .join('');
      } catch (err) {
        box.innerHTML = `<p class="toast-err">${escapeHtml(err.message)}</p>`;
      }
    },
    { once: true },
  );
});

async function boot() {
  meta = await api('/api/meta');
  $('#intro').textContent = meta.intro;
  $('#key-source').textContent = meta.keySource || '';
  $('#bearer-warn').textContent = meta.bearerWarning;
  const health = await api('/api/health');
  $('#store-hint').textContent = `Store: ${health.store}`;
  await loadConnections();
}

boot().catch((err) => {
  document.body.innerHTML = `<p style="padding:2rem;color:#c45a3a">Studio failed to start: ${escapeHtml(err.message)}</p>`;
});
