const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

let meta = null;
let connections = [];
let studioSettings = null;
let weekData = null;
let imageGenConfigured = false;
let photoPlates = [];
let plateTarget = null; // { post, cardEl }

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
  document.body.classList.toggle('on-week', name === 'week');
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
    masked.textContent = ig?.configured ? `On device: ${ig.masked}` : 'No key saved. Remote Generate stays off.';
  }
  if (keyInput) {
    keyInput.placeholder = ig?.configured ? 'Saved. Enter new value to replace' : '';
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
      .map(
        ([key, f]) => `<div class="field">
          <label for="${conn.platform}-${key}">${f.label}${f.optional ? ' (optional)' : ''}</label>
          <input id="${conn.platform}-${key}" data-field="${key}" type="password" autocomplete="off"
            placeholder="${f.set ? 'Saved. Enter new value to replace' : ''}"
            value="" />
          ${f.set ? `<div class="hint-set">On device: ${f.masked}</div>` : ''}
        </div>`,
      )
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
        msg.textContent = e.target.checked ? 'On. In the week.' : 'Off. Excluded from the week.';
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

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;');
}

function formatDayLabel(iso) {
  try {
    const d = new Date(`${iso}T12:00:00Z`);
    return d
      .toLocaleDateString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        timeZone: 'Europe/London',
      })
      .toUpperCase();
  } catch {
    return iso;
  }
}

function formatTimeUk(timeUk) {
  if (!timeUk) return '';
  const [h, m] = timeUk.split(':').map(Number);
  if (!Number.isFinite(h)) return timeUk;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ampm} UK`;
}

function typeLabel(p) {
  if (p.format === 'story') return 'STORY';
  if (p.format === 'reel') return 'REEL';
  if (p.format === 'feed') return 'FEED';
  if (p.platform === 'x') return p.id.includes(':am') ? 'X AM' : p.id.includes(':pm') ? 'X PM' : 'X';
  if (p.platform === 'bluesky') return 'BLUESKY';
  if (p.platform === 'reddit') return 'REDDIT';
  if (p.platform === 'threads') return 'THREADS';
  return (p.slotLabel || p.platform || 'POST').toUpperCase();
}

function readyLabel(p) {
  if (p.format === 'story' || p.format === 'reel') return 'Preview only';
  if (p.ready) return 'Ready';
  if (p.included) return 'On, not verified';
  return 'Off';
}

function firstLine(body) {
  const line = String(body || '')
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#'));
  return line || 'MenRush';
}

function tagsHtml(p) {
  const tags = p.tags?.length ? p.tags : [];
  if (!tags.length) return `<div class="tag-row"><span class="plat">${escapeHtml((p.slotLabel || p.platform).toUpperCase())}</span><span class="tags muted">No hashtags for this platform</span></div>`;
  return `<div class="tag-row"><span class="plat">${escapeHtml((p.platform || '').toUpperCase())}</span><span class="tags">${tags.map(escapeHtml).join(' ')}</span></div>`;
}

function weekCardHtml(p) {
  const media = p.media || {};
  const preview = media.previewUrl || 'https://menrush.com/menrush-logo.png';
  const logoClass = media.defaultLogo ? 'logo-default' : '';
  const meta = `${formatDayLabel(p.date)} · ${formatTimeUk(p.timeUk)} · ${typeLabel(p)}`;
  const headline = media.headline || firstLine(p.body);

  return `
    <div class="week-card-photo">
      <img data-preview src="${escapeAttr(preview)}" alt="" class="${logoClass}" />
      <button type="button" class="btn copper photo-btn" data-change-front>Change front</button>
    </div>
    <div class="week-card-body">
      <div class="week-card-meta">${escapeHtml(meta)} · ${escapeHtml(readyLabel(p))}</div>
      <h3 class="week-card-headline" contenteditable="true" data-headline spellcheck="false">${escapeHtml(headline)}</h3>
      <textarea class="week-card-caption" data-caption rows="6">${escapeHtml(p.body)}</textarea>
      <div class="week-card-tags">${tagsHtml(p)}</div>
      <div class="week-card-actions">
        <button type="button" class="btn ghost" data-save-caption>Save caption</button>
        <span class="msg" data-card-msg></span>
      </div>
    </div>
  `;
}

function wireWeekCard(el, post) {
  const msg = $('[data-card-msg]', el);
  const setMsg = (text, ok) => {
    msg.textContent = text || '';
    msg.className = ok === true ? 'toast-ok' : ok === false ? 'toast-err' : 'muted';
  };

  $('[data-change-front]', el)?.addEventListener('click', () => openPlateDialog(post, el));

  $('[data-save-caption]', el).addEventListener('click', async () => {
    const caption = $('[data-caption]', el).value;
    const headline = $('[data-headline]', el).textContent.trim();
    setMsg('Saving…');
    try {
      await api(`/api/drafts/${encodeURIComponent(post.id)}/media`, {
        method: 'PUT',
        body: JSON.stringify({ caption, headline, date: post.date }),
      });
      post.body = caption;
      if (post.media) post.media.headline = headline;
      setMsg('Saved on this device.', true);
    } catch (err) {
      setMsg(err.message, false);
    }
  });
}

function applyPreview(cardEl, media) {
  const img = $('[data-preview]', cardEl);
  if (!img || !media) return;
  img.src = media.previewUrl || 'https://menrush.com/menrush-logo.png';
  img.classList.toggle('logo-default', Boolean(media.defaultLogo));
}

function openPlateDialog(post, cardEl) {
  plateTarget = { post, cardEl };
  const grid = $('#plate-grid');
  grid.innerHTML = '';
  for (const plate of photoPlates) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'plate-option';
    if (post.media?.plateId === plate.id) btn.classList.add('active');
    btn.innerHTML = `
      <img src="${escapeAttr(plate.url)}" alt="" />
      <span>${escapeHtml(plate.label)}</span>
    `;
    btn.addEventListener('click', async () => {
      const msg = $('#plate-msg');
      msg.textContent = 'Applying…';
      msg.className = 'muted';
      try {
        const data = await api(`/api/drafts/${encodeURIComponent(post.id)}/media`, {
          method: 'PUT',
          body: JSON.stringify({ plateId: plate.id, date: post.date }),
        });
        post.media = data.media;
        applyPreview(cardEl, data.media);
        $$('.plate-option', grid).forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        msg.textContent = 'Front updated.';
        msg.className = 'toast-ok';
      } catch (err) {
        msg.textContent = err.message;
        msg.className = 'toast-err';
      }
    });
    grid.appendChild(btn);
  }
  $('#plate-msg').textContent = '';
  $('#plate-dialog').showModal();
}

$('#plate-close')?.addEventListener('click', () => $('#plate-dialog').close());

$('#plate-upload')?.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file || !plateTarget) return;
  const msg = $('#plate-msg');
  msg.textContent = 'Uploading…';
  msg.className = 'muted';
  try {
    const dataUrl = await readFileAsDataUrl(file);
    const data = await api(`/api/drafts/${encodeURIComponent(plateTarget.post.id)}/image`, {
      method: 'POST',
      body: JSON.stringify({
        imageBase64: dataUrl,
        mimeType: file.type || 'image/png',
        filename: file.name,
      }),
    });
    plateTarget.post.media = data.media;
    applyPreview(plateTarget.cardEl, data.media);
    msg.textContent = 'Uploaded.';
    msg.className = 'toast-ok';
  } catch (err) {
    msg.textContent = err.message;
    msg.className = 'toast-err';
  }
});

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
  $('#week-title').textContent = `Week ${w.week}. ${w.theme}`;
  $('#week-meta').textContent = `${w.start} to ${w.end} (UK) · today ${w.today}${
    w.note ? ` · ${w.note}` : ''
  }`;
  $('#approve-hint').textContent = weekData.approveHint || '';
  imageGenConfigured = Boolean(weekData.imageGenConfigured);

  const root = $('#week-posts');
  root.innerHTML = '';
  if (!weekData.posts.length) {
    root.innerHTML = `<p class="muted">No drafts for this week in the local pack.</p>`;
    return;
  }

  // Prefer visual cards; still show reddit as text-style cards so the week is complete
  for (const p of weekData.posts) {
    const el = document.createElement('article');
    el.className = `week-card${p.included ? '' : ' excluded'}${p.visual ? '' : ' text-only'}`;
    el.dataset.id = p.id;
    if (p.visual) {
      el.innerHTML = weekCardHtml(p);
      root.appendChild(el);
      wireWeekCard(el, p);
    } else {
      el.innerHTML = `
        <div class="week-card-body full">
          <div class="week-card-meta">${escapeHtml(formatDayLabel(p.date))} · ${escapeHtml(formatTimeUk(p.timeUk))} · ${escapeHtml(typeLabel(p))} · ${escapeHtml(readyLabel(p))}</div>
          <textarea class="week-card-caption" data-caption rows="8">${escapeHtml(p.body)}</textarea>
          <div class="week-card-actions">
            <button type="button" class="btn ghost" data-save-caption>Save caption</button>
            <span class="msg" data-card-msg></span>
          </div>
        </div>
      `;
      root.appendChild(el);
      wireWeekCard(el, p);
    }
  }
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

async function loadPlates() {
  const data = await api('/api/plates');
  photoPlates = data.plates || [];
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
    msg.textContent = imageGenConfigured ? 'Image key saved on this device.' : 'Saved.';
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
    list.innerHTML = '<li>None. Turn On and Verify at least one platform first.</li>';
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
          `<h3>Publish results (${result.summary.ok}/${result.summary.total} ok${
            result.summary.skipped ? `, ${result.summary.skipped} skipped` : ''
          })</h3>` +
          result.results
            .map((r) => {
              const cls = r.ok ? 'ok' : r.skipped ? 'skip' : 'fail';
              const detail = r.ok
                ? `ok${r.externalId ? ` · ${r.externalId}` : ''}${r.mediaAttached ? ' · media' : ''}${
                    r.imageUrl ? ' · owner photo https' : ''
                  }${r.warning ? ` · ${r.warning}` : ''}`
                : r.error;
              return `<div class="result-row ${cls}">${r.platform}${
                r.format ? `/${r.format}` : ''
              } ${r.date} ${r.timeUk || ''} · ${escapeHtml(detail || '')}</div>`;
            })
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
  document.body.classList.add('on-week');
  await Promise.all([loadConnections(), loadPlates(), loadWeek()]);
}

boot().catch((err) => {
  document.body.innerHTML = `<p style="padding:2rem;color:#c45a3a">Studio failed to start: ${escapeHtml(err.message)}</p>`;
});
