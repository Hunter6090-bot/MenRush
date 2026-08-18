const $ = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

let meta = null;
let connections = [];
let weekData = null;

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

function renderCards() {
  const root = $('#cards');
  root.innerHTML = '';
  for (const conn of connections) {
    const card = document.createElement('article');
    card.className = 'card';
    card.dataset.platform = conn.platform;

    const fieldHtml = Object.entries(conn.fields)
      .map(([key, f]) => {
        const placeholder = f.set ? f.masked : '';
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
}

function upsertConn(c) {
  const i = connections.findIndex((x) => x.platform === c.platform);
  if (i >= 0) connections[i] = c;
  else connections.push(c);
}

function renderWeek() {
  const w = weekData.week;
  $('#week-title').textContent = `Week ${w.week} — ${w.theme}`;
  $('#week-meta').textContent = `${w.start} → ${w.end} (UK) · today ${w.today}${
    w.note ? ` · ${w.note}` : ''
  } · source: ${weekData.source}`;
  $('#approve-hint').textContent = weekData.approveHint || '';

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
      h.style.cssText = 'font-family:var(--font);margin:1rem 0 0.35rem;font-size:1rem;color:var(--copper-hot)';
      h.textContent = p.date;
      root.appendChild(h);
    }
    const el = document.createElement('article');
    el.className = `post${p.included ? '' : ' excluded'}`;
    const ready = p.ready ? 'Ready' : p.included ? 'On, not verified' : 'Off — excluded';
    el.innerHTML = `
      <div class="post-meta">
        <span>${p.platform.toUpperCase()}</span>
        <span>${p.timeUk || ''}</span>
        <span>${p.kind || 'draft'}</span>
        <span>${ready}</span>
      </div>
      <pre class="post-body">${escapeHtml(p.body)}</pre>
    `;
    root.appendChild(el);
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
  renderCards();
}

async function loadWeek() {
  weekData = await api('/api/week');
  renderWeek();
}

$('#btn-refresh-week').addEventListener('click', () => loadWeek());

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
        box.innerHTML = `<h3>Publish results (${result.summary.ok}/${result.summary.total} ok)</h3>` +
          result.results
            .map(
              (r) =>
                `<div class="result-row ${r.ok ? 'ok' : 'fail'}">${r.platform} ${r.date} ${r.timeUk || ''} — ${
                  r.ok ? `ok${r.externalId ? ` · ${r.externalId}` : ''}` : r.error
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
