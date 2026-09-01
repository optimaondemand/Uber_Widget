/* =====================================================================
   Optima Curriculum Studio - UI core: frame, rail, router, toasts, modals
   ===================================================================== */
(function (OCS) {
  const ui = { views: {}, current: null, visited: {} };
  OCS.ui = ui;
  const esc = OCS.esc;

  ui.STEPS = [
    { id: 'course',    num: 1, label: 'Course',    hint: 'Pick a spine or import', needsPlan: false },
    { id: 'standards', num: 2, label: 'Standards', hint: 'Shopping cart + coverage', needsPlan: true },
    { id: 'template',  num: 3, label: 'Template',  hint: 'Module patterns',          needsPlan: true },
    { id: 'build',     num: 4, label: 'Build',     hint: 'Drag, mute, swap, add',     needsPlan: true },
    { id: 'enrich',    num: 5, label: 'Enrich',    hint: 'Art, music, books',         needsPlan: true },
    { id: 'style',     num: 6, label: 'Style',     hint: 'Skins, calendar, teacher',  needsPlan: true },
    { id: 'export',    num: 7, label: 'Export',    hint: 'Canvas, HTML, reports',     needsPlan: true },
  ];

  /* ---------- tiny DOM helpers ---------- */
  ui.el = function (html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };
  ui.frag = function (html) { const t = document.createElement('template'); t.innerHTML = html; return t.content; };
  ui.q = (sel, root) => (root || document).querySelector(sel);
  ui.qa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- toasts ---------- */
  ui.toast = function (msg, kind = '', ms = 3200) {
    const wrap = ui.q('#toasts'); const t = ui.el(`<div class="toast ${kind}">${esc(msg)}</div>`); wrap.appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .3s'; setTimeout(() => t.remove(), 320); }, ms);
  };

  /* ---------- modals ---------- */
  ui.modal = function ({ title, body, footer, wide = false, onClose }) {
    const root = ui.q('#modal-root');
    const back = ui.el(`<div class="modal-back" role="dialog" aria-modal="true"><div class="modal ${wide ? 'wide' : ''}"><div class="mhead"><h2>${esc(title || '')}</h2><button class="btn light sm" data-close>✕ Close</button></div><div class="mbody"></div>${footer !== false ? '<div class="mfoot"></div>' : ''}</div></div>`);
    const mb = ui.q('.mbody', back); if (typeof body === 'string') mb.innerHTML = body; else if (body) mb.appendChild(body);
    const mf = ui.q('.mfoot', back); if (mf && footer) { if (typeof footer === 'string') mf.innerHTML = footer; else mf.appendChild(footer); }
    const close = () => { back.remove(); document.removeEventListener('keydown', onKey); if (onClose) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    back.addEventListener('click', (e) => { if (e.target === back || e.target.closest('[data-close]')) close(); });
    document.addEventListener('keydown', onKey);
    root.appendChild(back);
    return { close, el: back, body: mb, foot: mf };
  };
  ui.confirm = function (msg, { ok = 'Yes, do it', danger = false } = {}) {
    return new Promise(res => {
      const m = ui.modal({ title: 'Please confirm', body: `<p style="font-size:14px;">${esc(msg)}</p>`, footer: `<button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>` });
      ui.q('[data-ok]', m.el).onclick = () => { m.close(); res(true); };
      m.el.addEventListener('click', (e) => { if (e.target === m.el || e.target.closest('[data-close]')) res(false); });
    });
  };
  ui.prompt = function (label, value = '', { ok = 'Save' } = {}) {
    return new Promise(res => {
      const m = ui.modal({ title: label, body: `<div class="field"><input type="text" id="prompt-input" value="${esc(value)}"></div>`, footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>${esc(ok)}</button>` });
      const inp = ui.q('#prompt-input', m.el); inp.focus(); inp.select();
      const done = () => { const v = inp.value.trim(); m.close(); res(v); };
      ui.q('[data-ok]', m.el).onclick = done; inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(); });
    });
  };
  ui.previewPage = function (url, title) {
    ui.modal({ title: title || 'Lesson preview', wide: true, footer: `<a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Open in new tab ↗</a><button class="btn primary" data-close>Done</button>`, body: `<iframe class="preview" src="${esc(url)}" title="${esc(title || 'preview')}"></iframe>` });
  };
  ui.previewHtml = function (html, title) {
    const m = ui.modal({ title: title || 'Preview', wide: true, footer: `<button class="btn primary" data-close>Done</button>`, body: `<iframe class="preview" title="${esc(title || 'preview')}"></iframe>` });
    const f = ui.q('iframe', m.el); f.srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"><style>body{margin:0;background:#F0F2F8;padding:16px;font-family:Nunito,Verdana,sans-serif}</style></head><body>${html}</body></html>`;
  };
  ui.copy = async function (text, label = 'Copied to clipboard') {
    try { await navigator.clipboard.writeText(text); ui.toast(label, 'good'); }
    catch (e) { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); ui.toast(label, 'good'); } catch (e2) { ui.toast('Copy failed. Select the text and copy manually.', 'bad'); } ta.remove(); }
  };
  ui.downloadText = function (text, fileName, type = 'text/plain') { OCS.imscc.download(new Blob([text], { type }), fileName); };

  /* ---------- rail + progress ---------- */
  function stepDone(id) {
    const p = OCS.state.plan; if (!p) return false;
    switch (id) {
      case 'course': return true;
      case 'standards': return (p.standards.targets || []).length > 0 && !!ui.visited.standards;
      case 'template': return !!ui.visited.template || p.modules.some(m => m.templateId);
      case 'build': return !!ui.visited.build;
      case 'enrich': return !!ui.visited.enrich || p.modules.some(m => m.items.some(i => i.library || (i.enrich && i.enrich.length)));
      case 'style': return !!ui.visited.style;
      case 'export': return !!(p.progress && p.progress.exported);
    }
    return false;
  }
  ui.renderRail = function () {
    const rail = ui.q('#rail'); const p = OCS.state.plan; const cov = OCS.coverage();
    rail.innerHTML = ui.STEPS.map(s => `<button class="step ${ui.current === s.id ? 'active' : ''} ${stepDone(s.id) ? 'done' : ''}" data-go="${s.id}" ${s.needsPlan && !p ? 'disabled title="Pick a course first"' : ''}><span class="num">${stepDone(s.id) && ui.current !== s.id ? '✓' : s.num}</span><span><span class="lbl">${esc(s.label)}</span><span class="hint">${esc(s.hint)}</span></span></button>`).join('')
      + `<div class="spacer"></div>`
      + (p ? `<button class="cart-pill" data-go="standards" title="Open the standards cart"><span class="t">Standards cart</span><span class="v">${cov.covered.length} / ${cov.targets.length} covered</span><span class="bar"><i style="width:${cov.pct}%"></i></span><span class="tiny" style="color:#A8D0E6">${cov.uncovered.length ? cov.uncovered.length + ' gap' + (cov.uncovered.length === 1 ? '' : 's') + ' to fill' : (cov.targets.length ? 'Every target is covered' : 'Add target standards')}</span></button>` : '')
      + `<div class="foot">Token-free. Everything runs in your browser and saves there automatically. ${OCS.data.catalog ? 'Catalog ' + esc(OCS.data.catalog.generated) : ''}</div>`;
    ui.qa('[data-go]', rail).forEach(b => b.onclick = () => ui.go(b.dataset.go));
  };

  /* ---------- router ---------- */
  ui.go = function (name) { if (!ui.views[name]) name = 'home'; if (location.hash !== '#/' + name) location.hash = '#/' + name; else ui.render(); };
  ui.render = function () {
    let name = (location.hash || '#/home').replace(/^#\//, '').split('?')[0];
    if (!ui.views[name]) name = 'home';
    const step = ui.STEPS.find(s => s.id === name);
    if (step && step.needsPlan && !OCS.state.plan) { name = 'course'; }
    ui.current = name; if (step) ui.visited[name] = true;
    const stage = ui.q('#stage'); stage.innerHTML = ''; stage.scrollTop = 0;
    try { ui.views[name](stage); } catch (e) { console.error(e); stage.innerHTML = `<div class="notice bad">Something went wrong drawing this screen: ${esc(e.message)}</div>`; }
    ui.renderRail();
    document.title = (step ? step.label + ' · ' : '') + 'Optima Curriculum Studio';
  };

  /* ---------- top bar ---------- */
  ui.renderTop = function () {
    const p = OCS.state.plan; const inp = ui.q('#plan-name'); const st = ui.q('#save-state');
    inp.disabled = !p; inp.value = p ? p.name : '';
    if (!p) st.textContent = ''; else st.textContent = OCS.state.dirty ? 'Saving…' : (OCS.state.lastSaved ? 'Saved in this browser ' + OCS.state.lastSaved.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Autosave on');
    st.classList.toggle('dirty', !!(p && OCS.state.dirty));
    ui.q('#btn-undo').disabled = !OCS.state.undo.length; ui.q('#btn-save').disabled = !p; ui.q('#btn-export').disabled = !p;
  };
  ui.wireTop = function () {
    const inp = ui.q('#plan-name');
    inp.addEventListener('change', () => { if (OCS.state.plan) OCS.mutate(p => { p.name = inp.value.trim() || 'Untitled course plan'; }, 'plan:renamed'); });
    ui.q('#btn-undo').onclick = () => { if (OCS.undo()) ui.toast('Undone'); };
    ui.q('#btn-save').onclick = () => { if (!OCS.state.plan) return; ui.downloadText(OCS.exportPlanJSON(), OCS.slug(OCS.state.plan.name) + '.ocs.json', 'application/json'); ui.toast('Plan file downloaded. Keep it or send it to Joseph.', 'good'); };
    ui.q('#btn-export').onclick = () => ui.go('export');
    ui.q('#btn-open').onclick = () => ui.q('#file-plan').click();
    ui.q('#file-plan').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return; e.target.value = '';
      try { const text = await f.text(); const p = OCS.importPlanJSON(text); if (p.course.sourceId && OCS.data.catalog.courses.some(c => c.id === p.course.sourceId)) OCS.loadCourse(p.course.sourceId).catch(() => {}); ui.toast('Plan opened: ' + p.name, 'good'); ui.go('build'); }
      catch (err) { ui.toast(err.message, 'bad'); }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); if (OCS.undo()) ui.toast('Undone'); }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) && !/input|textarea/i.test(document.activeElement.tagName)) { e.preventDefault(); if (OCS.redo()) ui.toast('Redone'); }
    });
  };

  /* ---------- shared bits ---------- */
  ui.stageHead = function (kicker, title, text, right) {
    return `<div class="stage-head"><div><div class="kicker">${esc(kicker)}</div><h1>${esc(title)}</h1>${text ? `<p>${text}</p>` : ''}</div>${right ? `<div class="btn-row">${right}</div>` : ''}</div>`;
  };
  ui.kindChip = function (kind) { const m = OCS.kindMeta(kind); return `<span class="chip kind">${m.icon} ${esc(m.label)}</span>`; };
  ui.stdChip = function (code, extra = '') { const j = OCS.jurisdictionOf(code) || ''; const std = OCS.lookupStandard(code); return `<span class="chip ${j.toLowerCase()}" title="${esc(std ? std.text : 'Standard text not loaded yet')}">${esc(code)}${extra}</span>`; };
  ui.videoDots = function (videos) { if (!videos || !videos.total) return ''; return `<span class="vid-dots" title="${videos.ready} of ${videos.total} videos ready">${(videos.slots || []).slice(0, 8).map(s => `<i class="${s.status === 'ready' ? 'ready' : (s.status === 'pending' ? 'pending' : '')}"></i>`).join('')}</span><span>${videos.ready}/${videos.total} videos</span>`; };
  /* ---------- school-week helpers (plan override, else the school calendar's Week 1) ---------- */
  ui.week1 = function (plan) { const p = plan || OCS.state.plan; return (p && p.calendar && p.calendar.week1) || (OCS.data.calendar && OCS.data.calendar.week1) || null; };
  ui.weekOf = function (iso, plan) { const w1 = ui.week1(plan); if (!w1 || !iso) return null; const a = new Date(w1 + 'T12:00:00'), b = new Date(iso + 'T12:00:00'); return Math.floor((b - a) / (7 * 864e5)) + 1; };
  ui.weekDate = function (n, plan) { const w1 = ui.week1(plan); if (!w1 || !n) return null; const d = new Date(w1 + 'T12:00:00'); d.setDate(d.getDate() + (n - 1) * 7); return d; };
  ui.weekLabel = function (n, plan) { const d = ui.weekDate(n, plan); return d ? `Wk ${n} · ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}` : `Wk ${n}`; };
  ui.weekCount = function (plan) { const cal = OCS.data.calendar; let last = 36; if (cal && cal.quarters) for (const q of cal.quarters) { const end = (plan && plan.calendar && plan.calendar.quarters && plan.calendar.quarters[q.id]) || q.end; const w = ui.weekOf(end, plan); if (w && w + 1 > last) last = w + 1; } return Math.min(last, 52); };
  ui.emptyState = function (icon, title, text, cta) { return `<div class="card pad" style="text-align:center;padding:40px 20px;"><div style="font-size:44px;">${icon}</div><h2 style="margin:8px 0 4px;">${esc(title)}</h2><p class="muted" style="margin:0 auto 14px;max-width:460px;">${text}</p>${cta || ''}</div>`; };
})(window.OCS);
