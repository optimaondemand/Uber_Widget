/* =====================================================================
   Optima Curriculum Studio - Step 2: Standards shopping cart + coverage
   ===================================================================== */
(function (OCS) {
  const ui = OCS.ui, esc = OCS.esc;
  const local = { jur: null, query: '', showCovered: true, onlyTargets: false, bundle: null, loading: false, index: null };

  ui.views.standards = function (stage) {
    const p = OCS.state.plan;
    local.jur = local.jur || p.standards.jurisdiction || p.course.state || 'FL';
    stage.innerHTML = ui.stageHead('Step 2', 'Standards shopping cart', 'Tick the standards you are responsible for. The cart checks them off as lessons that cover them land in your plan, and suggests lessons from the other Optima courses for anything still open.',
      `<button class="btn" id="std-report">📋 Coverage report</button><button class="btn" id="std-csv">Download CSV</button>`)
      + `<div class="std-layout"><div class="card" id="std-left"><div class="notice info" style="border-radius:14px 14px 0 0;">⏳ Loading ${esc(p.course.subjectLabel || 'subject')} grade ${esc(p.course.grade)} standards…</div></div><div id="std-right"></div></div>`;
    ui.q('#std-report').onclick = () => ui.previewHtml(OCS.gen.standardsReportHtml(p), 'Standards coverage report');
    ui.q('#std-csv').onclick = () => { ui.downloadText(OCS.gen.standardsCsv(p), OCS.slug(p.name) + '-standards.csv', 'text/csv'); };
    renderRight();
    loadBundle().then(() => { renderLeft(); renderRight(); });
  };

  async function loadBundle() {
    const p = OCS.state.plan; if (!p) return;
    const subj = p.course.subject === 'other' ? 'ela' : p.course.subject;
    local.bundle = await OCS.loadBundle(subj, p.course.grade || '4');
    if (!local.bundle && p.course.subject === 'art') local.bundle = await OCS.loadBundle('art', p.course.grade);
  }

  function rowsFor() {
    const b = local.bundle; if (!b) return [];
    let rows = b.rows.filter(r => r.j === local.jur);
    if (local.jur === 'FL') rows = rows.filter(r => !/^MA\.K12\.MTR/.test(r.code));
    const q = local.query.trim().toLowerCase();
    if (q) rows = rows.filter(r => r.code.toLowerCase().includes(q) || (r.text || '').toLowerCase().includes(q));
    const cov = OCS.coverage();
    if (local.onlyTargets) rows = rows.filter(r => cov.targets.includes(r.code));
    if (!local.showCovered) rows = rows.filter(r => !cov.byCode[r.code]);
    return rows;
  }
  function groupKey(r) {
    const p = OCS.state.plan;
    if (r.j === 'FL') { const lab = OCS.strandLabel(r.code, p.course.subject); if (lab) return lab; const m = r.code.match(/^[A-Z]+\.[^.]+\.([A-Z]+)\./); return m ? m[1] : (r.strand || 'Standards'); }
    if (r.j === 'TX') { const m = r.code.match(/\((\d+)\)/); return m ? 'Knowledge and skills ' + m[1] : (r.strand || 'TEKS'); }
    return r.strand || r.courseTitle || 'Standards';
  }

  function renderLeft() {
    const left = ui.q('#std-left'); if (!left) return;
    const p = OCS.state.plan; const b = local.bundle; const cov = OCS.coverage();
    if (!b) { left.innerHTML = `<div class="notice warn" style="border-radius:14px;">No standards bundle is available for ${esc(p.course.subjectLabel)} grade ${esc(p.course.grade)}. You can still type codes into the cart on the right.</div>`; return; }
    const jurs = Array.from(new Set(b.rows.map(r => r.j)));
    const rows = rowsFor(); const groups = {}; rows.forEach(r => (groups[groupKey(r)] = groups[groupKey(r)] || []).push(r));
    left.innerHTML = `<div style="padding:12px 14px;border-bottom:1px solid var(--line);display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
  <div class="seg" id="std-jur">${jurs.map(j => `<button class="${j === local.jur ? 'on' : ''}" data-j="${j}">${j}</button>`).join('')}</div>
  <div class="search" style="flex:1;min-width:200px;">🔎 <input id="std-q" placeholder="Search code or text…" value="${esc(local.query)}"></div>
  <label class="toggle"><input type="checkbox" id="std-only" ${local.onlyTargets ? 'checked' : ''}> Targets only</label>
  <label class="toggle"><input type="checkbox" id="std-cov" ${local.showCovered ? 'checked' : ''}> Show covered</label>
</div>
<div style="padding:8px 14px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;border-bottom:1px solid var(--line);background:#FAFBFF;">
  <span class="small muted">${rows.length} of ${b.rows.filter(r => r.j === local.jur).length} standards${b._from === 'snapshot' ? ' · offline snapshot' : ' · live from the Standards Browser'}</span>
  <span style="flex:1"></span>
  <button class="btn xs" id="std-target-covered">Target everything my plan covers</button>
  <button class="btn xs" id="std-target-all">Target all shown</button>
  <button class="btn xs danger" id="std-clear">Clear cart</button>
</div>
<div style="max-height:calc(100vh - 300px);overflow:auto;">${Object.entries(groups).map(([g, list]) => `<div class="strand-head"><h3>${esc(g)}</h3><span class="tiny muted">${list.filter(r => cov.targets.includes(r.code)).length}/${list.length} targeted · ${list.filter(r => cov.byCode[r.code]).length} covered</span></div>${list.map(r => row(r, cov)).join('')}`).join('') || '<div class="notice info" style="margin:12px;">Nothing matches that search.</div>'}</div>`;
    ui.qa('#std-jur button', left).forEach(bt => bt.onclick = () => { local.jur = bt.dataset.j; OCS.mutate(pl => { pl.standards.jurisdiction = local.jur; }, 'targets:changed'); renderLeft(); });
    ui.q('#std-q', left).oninput = (e) => { local.query = e.target.value; renderLeft(); ui.q('#std-q').focus(); const el = ui.q('#std-q'); el.setSelectionRange(el.value.length, el.value.length); };
    ui.q('#std-only', left).onchange = (e) => { local.onlyTargets = e.target.checked; renderLeft(); };
    ui.q('#std-cov', left).onchange = (e) => { local.showCovered = e.target.checked; renderLeft(); };
    ui.q('#std-target-covered', left).onclick = () => { OCS.setTargets([...new Set([...cov.targets, ...Object.keys(cov.byCode).filter(c => OCS.jurisdictionOf(c) === local.jur || local.jur === 'FL')])]); refresh(); };
    ui.q('#std-target-all', left).onclick = () => { OCS.setTargets([...new Set([...cov.targets, ...rows.map(r => r.code)])]); refresh(); };
    ui.q('#std-clear', left).onclick = async () => { if (await ui.confirm('Empty the standards cart? Coverage will still be computed from your lessons; only the targets are removed.', { ok: 'Empty the cart', danger: true })) { OCS.setTargets([]); refresh(); } };
    ui.qa('[data-target]', left).forEach(cb => cb.onchange = () => { OCS.toggleTarget(cb.dataset.target); refresh(); });
    ui.qa('[data-ican]', left).forEach(bt => bt.onclick = () => showICan(bt.dataset.ican));
  }
  function row(r, cov) {
    const hits = cov.byCode[r.code] || []; const targeted = cov.targets.includes(r.code);
    const clar = r.extras && r.extras.c && r.extras.c.length ? `<details class="clar"><summary style="cursor:pointer;">${r.extras.c.length} clarification${r.extras.c.length > 1 ? 's' : ''}${r.extras.rel ? ' · ' + esc(r.extras.rel) : ''}</summary>${r.extras.c.map(c => `<div>${esc(c)}</div>`).join('')}</details>` : (r.extras && r.extras.rel ? `<div class="clar">${esc(r.extras.rel)}</div>` : '');
    return `<div class="std-row ${targeted ? 'targeted' : ''}"><input type="checkbox" data-target="${esc(r.code)}" ${targeted ? 'checked' : ''} title="Target this standard"><div><div class="code">${esc(r.code)}</div><button class="btn xs" data-ican="${esc(r.code)}" title="Student-facing I can statements">✨ I can…</button></div><div class="text">${esc(r.text)}${clar}</div><div class="cov">${hits.length ? hits.slice(0, 3).map(h => `<span class="chip covered" title="${esc(h.module.title)}">${esc(shorten(h.item.title))}</span>`).join('') + (hits.length > 3 ? `<span class="chip covered">+${hits.length - 3}</span>` : '') : (targeted ? `<span class="chip uncovered">not covered</span>` : `<span class="chip">—</span>`)}</div></div>`;
  }
  function shorten(t) { t = String(t).replace(/^(Lesson\s+)?[\d.-]+[:\s—-]+/, ''); return t.length > 26 ? t.slice(0, 24) + '…' : t; }

  function refresh() { renderLeft(); renderRight(); ui.renderRail(); }
  // keep both panels in step when targets or items change from anywhere else (builder, undo, rail)
  ['targets:changed', 'item:added', 'item:removed', 'item:changed', 'module:changed', 'module:removed', 'plan:changed'].forEach(e => OCS.on(e, () => { if (ui.current === 'standards' && ui.q('#std-left')) { renderLeft(); renderRight(); } }));

  function renderRight() {
    const right = ui.q('#std-right'); if (!right) return;
    const p = OCS.state.plan; const cov = OCS.coverage();
    const uncovered = cov.uncovered;
    right.innerHTML = `<div class="card pad" style="margin-bottom:12px;display:flex;gap:14px;align-items:center;">
  <div class="ring" style="--p:${cov.pct}" data-label="${cov.pct}%"></div>
  <div style="flex:1;"><div style="font-weight:900;font-size:16px;">${cov.covered.length} of ${cov.targets.length} targets covered</div><div class="small muted">${uncovered.length ? uncovered.length + ' still open. Suggestions below pull from every course in the catalog.' : (cov.targets.length ? 'Every targeted standard has at least one live item in your plan.' : 'Tick standards on the left to build your cart.')}</div>${cov.extra.length ? `<div class="tiny muted" style="margin-top:4px;">${cov.extra.length} more standards are covered but not targeted.</div>` : ''}</div>
</div>
<div class="card pad" style="margin-bottom:12px;"><h3 style="margin-bottom:8px;">Add a code by hand</h3><div class="search">＋ <input id="std-add" placeholder="e.g. SS.4.A.3.5 or 113.15(c)(6)(A)"></div><div class="help tiny muted" style="margin-top:6px;">Useful for MTR codes, cross-curricular standards, or a state not loaded yet.</div></div>
<div class="card pad"><h3 style="margin-bottom:8px;">Gaps and suggestions</h3>${uncovered.length ? `<div class="cov-list">${uncovered.map(c => gap(c)).join('')}</div>` : `<div class="notice good">✅ No gaps in the cart.</div>`}</div>`;
    ui.q('#std-add', right).addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = e.target.value.trim(); if (v) { OCS.toggleTarget(v); e.target.value = ''; refresh(); } } });
    ui.qa('[data-find]', right).forEach(b => b.onclick = () => findLessons(b.dataset.find));
    ui.qa('[data-untarget]', right).forEach(b => b.onclick = () => { OCS.toggleTarget(b.dataset.untarget); refresh(); });
  }
  function gap(code) {
    const std = OCS.lookupStandard(code);
    return `<div class="row"><div style="flex:1;min-width:0;"><b>${esc(code)}</b><div class="tiny muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(std ? std.text : '')}</div></div><button class="btn xs primary" data-find="${esc(code)}">Find lessons</button><button class="btn xs ghost" data-untarget="${esc(code)}" title="Remove from cart">✕</button></div>`;
  }

  async function findLessons(code) {
    const m = ui.modal({ title: 'Lessons that cover ' + code, wide: true, footer: `<button class="btn primary" data-close>Done</button>`, body: `<div class="notice info">⏳ Searching every course in the catalog…</div>` });
    await OCS.loadAllCourses();
    const idx = OCS.lessonsByStandard(); const hits = idx[code] || [];
    const std = OCS.lookupStandard(code);
    const p = OCS.state.plan;
    if (!hits.length) { m.body.innerHTML = `<div class="notice warn">No Optima lesson in the catalog is tagged with <b>${esc(code)}</b> yet.${std ? `<br><span class="small">${esc(std.text)}</span>` : ''}<br><br>Options: add a placeholder assignment in the builder and tag it with this code, or attach a library resource (Enrich step) to a nearby lesson.</div>`; return; }
    m.body.innerHTML = `${std ? `<p class="small muted" style="margin:0 0 10px;">${esc(std.text)}</p>` : ''}<div class="cov-list">${hits.map((h, i) => `<div class="suggest"><div style="flex:1;min-width:0;"><b>${esc(h.item.title)}</b><div class="tiny muted">${esc(h.courseTitle)} · ${esc(h.moduleTitle)}${h.item.videos ? ' · ' + h.item.videos.ready + '/' + h.item.videos.total + ' videos' : ''}${h.item.pageStatus === 'missing' ? ' · <span style="color:var(--warn)">page not published</span>' : ''}</div><div style="margin-top:4px;">${(h.item.lesson && h.item.lesson.flCodes || []).slice(0, 6).map(c => ui.stdChip(c)).join('')}</div></div><div class="btn-row" style="flex-wrap:nowrap;">${h.item.pageUrl ? `<button class="btn xs" data-prev="${i}">Preview</button>` : ''}<button class="btn xs primary" data-add="${i}">Add to plan</button></div></div>`).join('')}</div>`;
    ui.qa('[data-prev]', m.el).forEach(b => b.onclick = () => { const h = hits[b.dataset.prev]; ui.previewPage(h.item.pageUrl, h.item.title); });
    ui.qa('[data-add]', m.el).forEach(b => b.onclick = () => { const h = hits[b.dataset.add]; chooseModule(m, (modId) => { const item = OCS.itemFromCatalog(OCS.data.courses[h.courseId], h.item); item.placeholder = false; OCS.addItem(modId, item); ui.toast(`Added "${item.title}" · ${code} now covered`, 'good'); m.close(); refresh(); }); });
  }
  function chooseModule(parent, done) {
    const p = OCS.state.plan;
    if (!p.modules.length) { const mod = OCS.addModule('Module 1'); done(mod.id); return; }
    const body = ui.el(`<div><p class="small muted" style="margin:0 0 8px;">Which module should it land in?</p>${p.modules.map(mo => `<button class="btn" style="display:flex;width:100%;justify-content:space-between;margin-bottom:6px;" data-mod="${mo.id}"><span>${esc(mo.title)}</span><span class="tiny muted">${mo.items.length} items</span></button>`).join('')}<button class="btn ghost" data-new>＋ New module</button></div>`);
    const mm = ui.modal({ title: 'Add to which module?', body, footer: `<button class="btn" data-close>Cancel</button>` });
    ui.qa('[data-mod]', body).forEach(b => b.onclick = () => { mm.close(); done(b.dataset.mod); });
    ui.q('[data-new]', body).onclick = () => { const mod = OCS.addModule('New module'); mm.close(); done(mod.id); };
  }
  ui.chooseModule = chooseModule;

  function showICan(code) {
    const std = OCS.lookupStandard(code); if (!std) { ui.toast('Standard text not loaded yet.', 'bad'); return; }
    const levels = OCS.data.blooms.levels; const det = OCS.bloomLevelFor(std.text);
    const body = ui.el(`<div><p class="small" style="margin:0 0 10px;color:var(--ink-2);"><b>${esc(code)}</b> · ${esc(std.text)}</p>
<div class="bloom-bar" id="ican-levels">${levels.map(l => `<button data-lv="${l.id}" class="${det.level && det.level.id === l.id ? 'on' : ''}" style="${det.level && det.level.id === l.id ? 'background:' + l.color : ''}">${l.label}</button>`).join('')}</div>
<div id="ican-list" style="margin-top:10px;display:flex;flex-direction:column;gap:6px;"></div>
<h4 style="margin:14px 0 6px;font-size:12px;text-transform:uppercase;color:var(--teal);">Essential question starters</h4><div id="eq-list" style="display:flex;flex-direction:column;gap:6px;"></div>
<h4 style="margin:14px 0 6px;font-size:12px;text-transform:uppercase;color:var(--teal);">Weekly ladder (climb Bloom's across the week)</h4><div id="ladder" style="display:flex;flex-direction:column;gap:6px;"></div>
<p class="tiny muted" style="margin-top:10px;">Plug-and-chug from the standard's own verb and object. Click any line to copy it, then paste into a lesson's objectives in the builder.</p></div>`);
    ui.modal({ title: 'Student-facing objectives', body, footer: `<button class="btn primary" data-close>Done</button>` });
    let lv = det.level ? det.level.id : null;
    const draw = () => {
      ui.q('#ican-list', body).innerHTML = OCS.suggestICan(std.text, lv).map(s => `<div class="sugg" data-copy="${esc(s)}"><span class="plus">＋</span><span>${esc(s)}</span></div>`).join('');
      ui.q('#eq-list', body).innerHTML = OCS.suggestEQ(std.text, null, lv).map(s => `<div class="sugg" data-copy="${esc(s)}"><span class="plus">?</span><span>${esc(s)}</span></div>`).join('');
      ui.q('#ladder', body).innerHTML = OCS.ladder(std.text).map(s => `<div class="sugg" data-copy="${esc(s.text)}"><span class="chip" style="background:${s.level.color};color:#fff;border-color:transparent;">${esc(s.level.label)}</span><span>${esc(s.text)}</span></div>`).join('');
      ui.qa('[data-copy]', body).forEach(d => d.onclick = () => ui.copy(d.dataset.copy, 'Copied. Paste it into an objective.'));
      ui.qa('#ican-levels button', body).forEach(b => { const L = levels.find(l => l.id === b.dataset.lv); b.classList.toggle('on', b.dataset.lv === lv); b.style.background = b.dataset.lv === lv ? L.color : ''; });
    };
    ui.qa('#ican-levels button', body).forEach(b => b.onclick = () => { lv = b.dataset.lv; draw(); });
    draw();
  }
  ui.showICan = showICan;
})(window.OCS);
