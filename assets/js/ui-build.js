/* =====================================================================
   Optima Curriculum Studio - Step 3 (Template) + Step 4 (Build the spine)
   ===================================================================== */
(function (OCS) {
  const ui = OCS.ui, esc = OCS.esc;
  const local = { showMuted: true, drag: null, filter: '' };

  /* ======================= Step 3: templates ======================= */
  ui.views.template = function (stage) {
    const p = OCS.state.plan; const T = OCS.data.templates;
    const mine = T.templates.filter(t => t.subject === '*' || t.subject === p.course.subject);
    const others = T.templates.filter(t => !mine.includes(t));
    const card = (t) => `<div class="card tpl-card">
  <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;"><div><h3>${esc(t.name)}</h3><div class="tiny muted">${esc(t.moduleLabel)} template · ${esc(t.subject === '*' ? 'any subject' : t.subject)} · grades ${t.grades.join(', ')}</div></div><span class="chip ${t.status === 'draft' ? 'draft' : 'ok'}">${t.status === 'draft' ? 'Draft · pending lead approval' : 'Approved'}</span></div>
  <p class="small" style="margin:0;color:var(--ink-2);">${esc(t.description)}</p>
  <div class="slots">${t.slots.map(s => `<div class="slot ${s.required ? 'req' : ''} ${s.type === 'project' || s.type === 'assessment' ? 'project' : ''} ${s.type === 'header' ? 'header' : ''}"><span>${OCS.kindMeta(s.type).icon}</span><span>${esc(s.label)}${s.required ? '' : ' <span class="tiny" style="opacity:.7">(optional)</span>'}${s.note ? `<div class="tiny" style="opacity:.75">${esc(s.note)}</div>` : ''}</span></div>`).join('')}</div>
  <div class="tiny muted">Derived from: ${esc(t.derivedFrom)}</div>
  <div class="btn-row"><button class="btn primary sm" data-use="${t.id}">＋ Add a module from this template</button><button class="btn sm" data-check="${t.id}">Check my modules against it</button></div>
</div>`;
    stage.innerHTML = ui.stageHead('Step 3', 'Module templates', 'Templates are the subject-lead-approved shapes a module can take: what has to be in a week or unit, with the module project at the bottom. Add a module from a template and its empty slots appear in the builder, ready to fill from the course library, the media libraries, or your own files.',
      `<button class="btn" id="tpl-submit">📨 How leads submit a template</button>`)
      + (mine.length ? `<h2 style="margin:0 0 10px;">For ${esc(p.course.subjectLabel || 'this course')}</h2><div class="grid cols-2">${mine.map(card).join('')}</div>` : '')
      + (others.length ? `<h2 style="margin:22px 0 10px;">Other subjects</h2><div class="grid cols-2">${others.map(card).join('')}</div>` : '');
    ui.qa('[data-use]', stage).forEach(b => b.onclick = () => { const t = T.templates.find(x => x.id === b.dataset.use); const mod = OCS.addModule(null, t); ui.toast(`Module "${mod.title}" added with ${mod.items.length} slots.`, 'good'); ui.go('build'); setTimeout(() => { const el = document.querySelector(`[data-module="${mod.id}"]`); if (el) el.scrollIntoView({ behavior: 'smooth' }); }, 80); });
    ui.qa('[data-check]', stage).forEach(b => b.onclick = () => templateCheck(T.templates.find(x => x.id === b.dataset.check)));
    ui.q('#tpl-submit').onclick = () => ui.modal({ title: 'Submitting a template', body: `<p>Subject leads describe a module shape once and every teacher in that subject gets it as a starting point. To add one, send Jorge or Jessica a note with:</p><ul class="small" style="line-height:1.8;"><li>Template name, subject, grades</li><li>The ordered slots: type (lesson, reading, quiz, discussion, project…), label, required or optional</li><li>What the module project or assessment must include</li></ul><p class="small muted">It is stored as a short JSON entry in <code>data/templates.json</code>; no code changes needed. Templates stay marked <b>Draft</b> until the lead approves them.</p><pre class="code">${esc(JSON.stringify(T.templates[0], null, 1).slice(0, 900))}…</pre>`, footer: `<button class="btn primary" data-close>Got it</button>` });
  };
  function templateCheck(t) {
    const p = OCS.state.plan;
    const rows = p.modules.map(m => {
      const kinds = m.items.filter(i => !i.muted).map(i => i.kind);
      const req = t.slots.filter(s => s.required);
      const missing = []; const counts = {}; kinds.forEach(k => counts[k] = (counts[k] || 0) + 1);
      const need = {}; req.forEach(s => need[s.type] = (need[s.type] || 0) + 1);
      for (const [k, n] of Object.entries(need)) if ((counts[k] || 0) < n) missing.push(`${n - (counts[k] || 0)} × ${OCS.kindMeta(k).label}`);
      return `<div class="row" style="display:flex;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid var(--line);"><b>${esc(m.title)}</b>${missing.length ? `<span class="chip warn">missing ${esc(missing.join(', '))}</span>` : `<span class="chip ok">✓ matches</span>`}</div>`;
    }).join('');
    ui.modal({ title: `Check against "${t.name}"`, body: `<p class="small muted" style="margin:0 0 8px;">Required slots only. Muted items do not count.</p>${rows || '<div class="notice info">No modules yet.</div>'}`, footer: `<button class="btn primary" data-close>Done</button>` });
  }

  /* ======================= Step 4: builder ======================= */
  ui.views.build = function (stage) {
    const p = OCS.state.plan; const s = OCS.planSummary(); const cov = OCS.coverage();
    const firstRun = p.progress && p.progress.firstRun;
    stage.innerHTML = ui.stageHead('Step 4', 'Build the spine', 'Drag to reorder, mute what you will not use (it stays here but never exports), swap a lesson for another, or add a slot from the palette. Click any row to edit it on the right.',
      `<button class="btn primary" id="b-add-module">＋ Module</button><button class="btn" id="b-collapse">Collapse all</button><label class="toggle"><input type="checkbox" id="b-showmuted" ${local.showMuted ? 'checked' : ''}> Show muted</label>`)
      + (firstRun ? `<div class="notice info" style="margin-bottom:12px;">🧺 <span><b>Standards cart pre-filled</b> with the ${p.standards.targets.length} Florida standards this course covers (${cov.pct}% covered right now). Add or remove targets in <a href="#/standards">Step 2</a>. <button class="btn xs" id="b-dismiss">Dismiss</button></span></div>` : '')
      + `<div class="stats" style="margin-bottom:12px;"><div class="stat"><span class="v">${s.modules}</span><span class="l">Modules</span></div><div class="stat"><span class="v">${s.items}</span><span class="l">Live items</span></div><div class="stat"><span class="v">${s.muted}</span><span class="l">Muted</span></div><div class="stat"><span class="v">${s.placeholders}</span><span class="l">Empty slots</span></div><div class="stat"><span class="v">${s.videosReady}/${s.videosTotal}</span><span class="l">Videos ready</span></div><div class="stat"><span class="v">${cov.pct}%</span><span class="l">Standards covered</span></div></div>`
      + `<div class="build-layout"><div id="spine"></div><div class="card inspector" id="inspector"></div></div>`;
    ui.q('#b-add-module').onclick = addModuleFlow;
    ui.q('#b-collapse').onclick = () => { const all = p.modules.every(m => m.collapsed); OCS.mutate(pl => pl.modules.forEach(m => m.collapsed = !all), 'module:changed'); };
    ui.q('#b-showmuted').onchange = (e) => { local.showMuted = e.target.checked; renderSpine(); };
    const dis = ui.q('#b-dismiss'); if (dis) dis.onclick = () => OCS.mutate(pl => { pl.progress.firstRun = false; }, 'plan:changed');
    renderSpine(); renderInspector();
  };
  OCS.on('plan:changed', () => { if (ui.current === 'build') { renderSpine(); renderInspector(); } });
  ['item:added', 'item:removed', 'item:changed', 'item:moved', 'module:added', 'module:removed', 'module:changed', 'module:moved', 'targets:changed'].forEach(e => OCS.on(e, () => { if (ui.current === 'build') { renderSpine(); renderInspector(); } }));
  OCS.on('select', () => { if (ui.current === 'build') { ui.qa('.item').forEach(el => el.classList.toggle('selected', el.dataset.item === OCS.state.selectedItemId)); renderInspector(); } });

  function addModuleFlow() {
    const T = OCS.data.templates; const p = OCS.state.plan;
    const mine = T.templates.filter(t => t.subject === '*' || t.subject === p.course.subject);
    const body = ui.el(`<div><div class="field"><label>Module title</label><input id="am-title" placeholder="Unit 5: …"></div><p class="small muted" style="margin:10px 0 6px;">Start empty or from a template:</p><div class="btn-row"><button class="btn" data-tpl="">Empty module</button>${mine.map(t => `<button class="btn" data-tpl="${t.id}">${esc(t.name)}</button>`).join('')}</div></div>`);
    const m = ui.modal({ title: 'Add a module', body, footer: `<button class="btn" data-close>Cancel</button>` });
    ui.qa('[data-tpl]', body).forEach(b => b.onclick = () => { const t = T.templates.find(x => x.id === b.dataset.tpl); const title = ui.q('#am-title', body).value.trim(); const mod = OCS.addModule(title || (t ? t.name : `Module ${p.modules.length + 1}`), t); m.close(); ui.toast('Module added', 'good'); setTimeout(() => { const el = document.querySelector(`[data-module="${mod.id}"]`); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 60); });
  }

  /* ---------------- spine ---------------- */
  function renderSpine() {
    const wrap = ui.q('#spine'); if (!wrap) return; const p = OCS.state.plan;
    if (!p.modules.length) { wrap.innerHTML = ui.emptyState('🧱', 'No modules yet', 'Add a module from a template, or go back and start from one of the built courses.', `<button class="btn primary" onclick="location.hash='#/template'">Pick a template</button>`); return; }
    wrap.innerHTML = p.modules.map((m, mi) => moduleHtml(m, mi)).join('');
    // module header controls
    ui.qa('.module', wrap).forEach(el => {
      const id = el.dataset.module;
      ui.q('[data-collapse]', el).onclick = () => OCS.updateModule(id, { collapsed: !OCS.findModule(id).collapsed });
      ui.q('[data-mute-mod]', el).onclick = () => OCS.updateModule(id, { muted: !OCS.findModule(id).muted });
      ui.q('[data-dup-mod]', el).onclick = () => OCS.duplicateModule(id);
      ui.q('[data-del-mod]', el).onclick = async () => { if (await ui.confirm(`Remove the module "${OCS.findModule(id).title}" and everything in it?`, { ok: 'Remove module', danger: true })) OCS.removeModule(id); };
      ui.q('[data-add-item]', el).onclick = () => palette(id);
      const wk = ui.q('[data-week]', el); wk.onchange = () => OCS.updateModule(id, { weekStart: wk.value ? Number(wk.value) : null });
      const ti = ui.q('input.mtitle', el); ti.onchange = () => OCS.updateModule(id, { title: ti.value.trim() || 'Module' }); ti.onclick = (e) => e.stopPropagation();
      // drag modules by header
      const hd = ui.q('.mhd', el);
      hd.draggable = true;
      hd.addEventListener('dragstart', (e) => { local.drag = { type: 'module', id }; e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); });
      hd.addEventListener('dragend', () => { el.classList.remove('dragging'); clearDrop(); });
      el.addEventListener('dragover', (e) => { if (local.drag && local.drag.type === 'module') { e.preventDefault(); clearDrop(); el.classList.add(before(e, el) ? 'drop-before' : 'drop-after'); } if (local.drag && local.drag.type === 'item' && e.target.closest('.items') && !e.target.closest('.item')) { e.preventDefault(); } });
      el.addEventListener('drop', (e) => {
        if (local.drag && local.drag.type === 'module') { e.preventDefault(); const idx = p.modules.findIndex(x => x.id === id); OCS.moveModule(local.drag.id, before(e, el) ? idx : idx + 1); local.drag = null; }
        else if (local.drag && local.drag.type === 'item' && !e.target.closest('.item')) { e.preventDefault(); OCS.moveItem(local.drag.id, id, OCS.findModule(id).items.length); local.drag = null; }
        clearDrop();
      });
    });
    // items
    ui.qa('.item', wrap).forEach(el => {
      const id = el.dataset.item;
      el.onclick = (e) => { if (e.target.closest('button')) return; OCS.select(id); };
      el.addEventListener('dragstart', (e) => { local.drag = { type: 'item', id }; e.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); e.stopPropagation(); });
      el.addEventListener('dragend', () => { el.classList.remove('dragging'); clearDrop(); });
      el.addEventListener('dragover', (e) => { if (!local.drag || local.drag.type !== 'item') return; e.preventDefault(); e.stopPropagation(); clearDrop(); el.classList.add(before(e, el) ? 'drop-before' : 'drop-after'); });
      el.addEventListener('drop', (e) => { if (!local.drag || local.drag.type !== 'item') return; e.preventDefault(); e.stopPropagation(); const modId = el.closest('.module').dataset.module; const mod = OCS.findModule(modId); const idx = mod.items.findIndex(x => x.id === id); OCS.moveItem(local.drag.id, modId, before(e, el) ? idx : idx + 1); local.drag = null; clearDrop(); });
      ui.qa('[data-op]', el).forEach(b => b.onclick = (e) => { e.stopPropagation(); itemOp(b.dataset.op, id); });
    });
  }
  function before(e, el) { const r = el.getBoundingClientRect(); return (e.clientY - r.top) < r.height / 2; }
  function clearDrop() { ui.qa('.drop-before,.drop-after').forEach(x => x.classList.remove('drop-before', 'drop-after')); }

  function moduleHtml(m, mi) {
    const items = m.items.filter(i => local.showMuted || !i.muted);
    const live = m.items.filter(i => !i.muted && i.kind !== 'header').length;
    const cal = OCS.data.calendar; const weeks = 36;
    return `<div class="card module ${m.muted ? 'muted' : ''} ${m.collapsed ? 'collapsed' : ''}" data-module="${m.id}">
  <div class="mhd" title="Drag to reorder module">
    <span class="handle">⋮⋮</span>
    <h3><input class="mtitle" value="${esc(m.title)}" aria-label="Module title"></h3>
    <span class="meta">${live} live${m.items.length - live - m.items.filter(i => i.kind === 'header').length > 0 ? ` · ${m.items.filter(i => i.muted).length} muted` : ''}</span>
    <select data-week class="btn light sm" style="padding:3px 6px;" title="Week this module starts"><option value="">week…</option>${Array.from({ length: weeks }, (_, i) => `<option value="${i + 1}" ${m.weekStart === i + 1 ? 'selected' : ''}>Wk ${i + 1}</option>`).join('')}</select>
    <button class="btn light" data-mute-mod title="${m.muted ? 'Unmute module' : 'Mute module (kept, not exported)'}">${m.muted ? '🔈' : '🔇'}</button>
    <button class="btn light" data-dup-mod title="Duplicate module">⧉</button>
    <button class="btn light" data-del-mod title="Remove module">🗑</button>
    <button class="btn light" data-collapse title="Collapse / expand">${m.collapsed ? '▸' : '▾'}</button>
  </div>
  <div class="items">${items.map(it => itemHtml(it)).join('') || '<div class="tiny muted" style="padding:8px 10px;">Empty module. Add a slot below or drag items here.</div>'}</div>
  <div class="madd"><button class="btn sm" data-add-item>＋ Add to this module</button></div>
</div>`;
  }
  function itemHtml(it) {
    const meta = OCS.kindMeta(it.kind); const sel = it.id === OCS.state.selectedItemId;
    const isEmpty = it.placeholder && !it.pageUrl && !it.html && !it.library && !(it.quiz && it.quiz.questions && it.quiz.questions.length);
    const sub = [];
    if (it.code) sub.push(`<span class="chip">${esc(it.code)}</span>`);
    if (it.kind !== 'header') sub.push(ui.kindChip(it.kind));
    (it.flCodes || []).slice(0, 4).forEach(c => sub.push(ui.stdChip(c)));
    if ((it.flCodes || []).length > 4) sub.push(`<span class="chip fl">+${it.flCodes.length - 4}</span>`);
    if (it.videos && it.videos.total) sub.push(ui.videoDots(it.videos));
    if (it.quiz) sub.push(`<span>${(it.quiz.questions || []).filter(q => q.include !== false).length} questions</span>`);
    if (it.source && it.source.courseId && OCS.state.plan.course.sourceId !== it.source.courseId) sub.push(`<span class="chip" title="Borrowed from another course">↗ ${esc((OCS.data.catalog.courses.find(c => c.id === it.source.courseId) || {}).title || 'other course')}</span>`);
    if (it.pageUrl && OCS.data.courses[it.source && it.source.courseId] && pageMissing(it)) sub.push(`<span class="chip warn" title="The GitHub lesson page for this item returns 404 today">page not published</span>`);
    if (isEmpty) sub.push(`<span class="chip draft">empty slot</span>`);
    if (it.library) sub.push(`<span class="chip" style="background:#F0E8FF;color:#5B3F91;">${esc(it.library.kind)} · ${esc(it.library.title.slice(0, 22))}</span>`);
    if ((it.enrich || []).length) sub.push(`<span class="chip" style="background:#F0E8FF;color:#5B3F91;">＋${it.enrich.length} library</span>`);
    return `<div class="item kind-${it.kind} ${it.muted ? 'muted' : ''} ${sel ? 'selected' : ''} ${isEmpty ? 'placeholder' : ''}" data-item="${it.id}" draggable="true">
  <span class="handle" title="Drag to move">⋮⋮</span>
  <span class="icon">${meta.icon}</span>
  <div class="main"><div class="title" title="${esc(it.title)}">${esc(it.title)}</div><div class="sub">${sub.join('')}</div></div>
  <div class="ops">${it.pageUrl ? `<button class="btn" data-op="preview" title="Preview lesson page">👁</button>` : ''}<button class="btn" data-op="mute" title="${it.muted ? 'Unmute' : 'Mute (keep but do not export)'}">${it.muted ? '🔈' : '🔇'}</button><button class="btn" data-op="swap" title="Swap for another lesson">⇄</button><button class="btn" data-op="dup" title="Duplicate">⧉</button><button class="btn" data-op="del" title="Remove">✕</button></div>
</div>`;
  }
  function pageMissing(it) {
    const c = OCS.data.courses[it.source.courseId]; if (!c) return false;
    for (const m of c.modules) for (const x of m.items) if (x.id === it.source.itemId) return x.pageStatus === 'missing';
    return false;
  }
  async function itemOp(op, id) {
    const f = OCS.findItem(id); if (!f) return; const it = f.item;
    if (op === 'preview') ui.previewPage(it.pageUrl, it.title);
    if (op === 'mute') OCS.toggleMute(id);
    if (op === 'dup') OCS.duplicateItem(id);
    if (op === 'del') { if (it.placeholder || await ui.confirm(`Remove "${it.title}" from your plan? (Muting keeps it around instead.)`, { ok: 'Remove', danger: true })) OCS.removeItem(id); }
    if (op === 'swap') swapFlow(it, f.module);
  }

  /* ---------------- palette: add something to a module ---------------- */
  function palette(moduleId, replaceItemId) {
    const T = OCS.data.templates; const p = OCS.state.plan;
    const body = ui.el(`<div>
<div class="seg" style="margin-bottom:12px;"><button class="on" data-tab="slots">Placeholder slots</button><button data-tab="library">From the Optima course library</button><button data-tab="media">From the media libraries</button></div>
<div data-pane="slots"><p class="small muted" style="margin:0 0 8px;">Empty slots you fill in yourself. They export as real Canvas items with your instructions.</p><div class="palette">${T.componentTypes.filter(c => !c.id.startsWith('library-')).map(c => `<button class="pc" data-kind="${c.id}"><span class="ic">${c.icon}</span><b>${esc(c.label)}</b><span>${esc(c.description)}</span></button>`).join('')}</div></div>
<div data-pane="library" hidden><div class="search" style="margin-bottom:8px;">🔎 <input id="pal-q" placeholder="Search every built lesson: title, standard code, topic…"></div><div class="btn-row" style="margin-bottom:8px;" id="pal-courses"></div><div id="pal-results" class="cov-list"><div class="notice info">⏳ Loading all courses…</div></div></div>
<div data-pane="media" hidden><p class="small">Art, music, and book cards come from the Enrich step, where they are matched to a lesson's topic. <button class="btn sm primary" id="pal-enrich">Open Enrich →</button></p></div>
</div>`);
    const m = ui.modal({ title: replaceItemId ? 'Swap with…' : 'Add to module', wide: true, body, footer: `<button class="btn" data-close>Cancel</button>` });
    ui.qa('[data-tab]', body).forEach(b => b.onclick = () => { ui.qa('[data-tab]', body).forEach(x => x.classList.toggle('on', x === b)); ui.qa('[data-pane]', body).forEach(pn => pn.hidden = pn.dataset.pane !== b.dataset.tab); if (b.dataset.tab === 'library') loadLibraryPane(); });
    ui.qa('[data-kind]', body).forEach(b => b.onclick = () => { const item = OCS.newItem(b.dataset.kind); place(moduleId, item, replaceItemId); m.close(); ui.toast(`${OCS.kindMeta(item.kind).label} slot added. Fill it in on the right.`, 'good'); });
    ui.q('#pal-enrich', body).onclick = () => { m.close(); ui.go('enrich'); };
    let loaded = false;
    async function loadLibraryPane() {
      if (loaded) return; loaded = true;
      await OCS.loadAllCourses();
      const courses = Object.values(OCS.data.courses); let cid = p.course.sourceId || (courses[0] && courses[0].id);
      const cw = ui.q('#pal-courses', body); cw.innerHTML = courses.map(c => `<button class="btn xs ${c.id === cid ? 'primary' : ''}" data-c="${c.id}">${esc(c.title.replace(' On-Demand', ''))}</button>`).join('') + `<button class="btn xs ${cid === '*' ? 'primary' : ''}" data-c="*">All courses</button>`;
      const qi = ui.q('#pal-q', body);
      const draw = () => {
        const q = qi.value.trim().toLowerCase(); const out = [];
        for (const c of courses) { if (cid !== '*' && c.id !== cid) continue; for (const mod of c.modules) for (const it of mod.items) { if (it.kind === 'header') continue; const hay = [it.title, mod.title, ...(it.lesson && it.lesson.flCodes || []), ...(it.lesson && it.lesson.objectives || []), ...(it.lesson && it.lesson.keyConcepts || [])].join(' ').toLowerCase(); if (!q || hay.includes(q)) out.push({ c, mod, it }); if (out.length > 300) break; } }
        ui.q('#pal-results', body).innerHTML = out.slice(0, 120).map((r, i) => `<div class="suggest" data-i="${i}"><div style="flex:1;min-width:0;"><b>${OCS.kindMeta(r.it.kind).icon} ${esc(r.it.title)}</b><div class="tiny muted">${esc(r.c.title)} · ${esc(r.mod.title)}${r.it.videos ? ' · ' + r.it.videos.ready + '/' + r.it.videos.total + ' videos' : ''}${r.it.pageStatus === 'missing' ? ' · <span style="color:var(--warn)">page not published</span>' : ''}</div><div style="margin-top:3px;">${(r.it.lesson && r.it.lesson.flCodes || []).slice(0, 5).map(x => ui.stdChip(x)).join('')}</div></div><div class="btn-row" style="flex-wrap:nowrap;">${r.it.pageUrl ? `<button class="btn xs" data-prev="${i}">Preview</button>` : ''}<button class="btn xs primary" data-add="${i}">${replaceItemId ? 'Use this' : 'Add'}</button></div></div>`).join('') + (out.length > 120 ? `<div class="tiny muted">Showing 120 of ${out.length}. Narrow your search.</div>` : '') || '<div class="notice info">Nothing matches.</div>';
        ui.qa('[data-prev]', body).forEach(b => b.onclick = () => { const r = out[b.dataset.prev]; ui.previewPage(r.it.pageUrl, r.it.title); });
        ui.qa('[data-add]', body).forEach(b => b.onclick = () => { const r = out[b.dataset.add]; const item = OCS.itemFromCatalog(r.c, r.it); item.placeholder = false; place(moduleId, item, replaceItemId); m.close(); ui.toast(`Added "${item.title}"`, 'good'); });
      };
      ui.qa('[data-c]', cw).forEach(b => b.onclick = () => { cid = b.dataset.c; ui.qa('[data-c]', cw).forEach(x => x.classList.toggle('primary', x === b)); draw(); });
      qi.oninput = draw; draw();
    }
    if (replaceItemId) { ui.q('[data-tab="library"]', body).click(); }
  }
  function place(moduleId, item, replaceItemId) {
    if (replaceItemId) { const f = OCS.findItem(replaceItemId); const idx = f ? f.module.items.findIndex(x => x.id === replaceItemId) : -1; const old = f && f.item; if (old && old.notes) item.notes = old.notes; OCS.removeItem(replaceItemId); OCS.addItem(moduleId, item, idx < 0 ? undefined : idx); }
    else OCS.addItem(moduleId, item);
  }
  function swapFlow(it, mod) { palette(mod.id, it.id); }
  ui.palette = palette;

  /* ---------------- inspector ---------------- */
  function renderInspector() {
    const box = ui.q('#inspector'); if (!box) return;
    const f = OCS.findItem(OCS.state.selectedItemId);
    if (!f) { box.innerHTML = `<div class="ibody"><div style="text-align:center;padding:30px 10px;"><div style="font-size:40px;">👈</div><h3 style="margin:8px 0 4px;">Select an item</h3><p class="small muted" style="margin:0;">Click any row to edit its title, notes for students, objectives, standards, videos, or quiz questions.</p></div></div>`; return; }
    const it = f.item; const meta = OCS.kindMeta(it.kind); const B = OCS.data.blooms;
    const isLesson = !!it.pageUrl || ['lesson', 'assignment', 'reading', 'practice', 'fluency', 'assessment', 'project', 'spotlight-vr', 'custom', 'video', 'discussion'].includes(it.kind);
    box.innerHTML = `<div class="ihead"><span class="icon">${meta.icon}</span><div style="flex:1;min-width:0;"><div class="tiny muted">${esc(meta.label)} · ${esc(f.module.title)}</div><b style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(it.title)}</b></div>${it.pageUrl ? `<a class="btn xs" href="${esc(it.pageUrl)}" target="_blank" rel="noopener" title="Open live page">↗</a>` : ''}</div>
<div class="ibody">
  <div class="field"><label>Title</label><input data-f="title" value="${esc(it.title)}"></div>
  ${it.kind !== 'header' ? `<div class="field"><label>Note to students</label><textarea data-f="notes" placeholder="Optional. Shows in a gold card above the lesson: reminders, what to bring, how long it should take…">${esc(it.notes || '')}</textarea></div>` : ''}
  ${(it.kind === 'custom' || it.kind === 'video' || it.kind === 'reading' || it.kind === 'assignment' || it.kind === 'project' || it.kind === 'discussion' || it.kind === 'page' || it.kind === 'spotlight-vr' || it.kind === 'practice') ? `<div class="field"><label>Your content (HTML or plain text)</label><textarea data-f="html" placeholder="Paste instructions, an embed code (iframe), links, or plain text.">${esc(it.html || '')}</textarea><div class="help">Iframes are kept. Canvas strips &lt;style&gt; blocks, so use simple HTML.</div></div>` : ''}
  ${isLesson || it.pageUrl ? `<div class="field"><label>Lesson page URL (GitHub Pages)</label><input data-f="pageUrl" value="${esc(it.pageUrl || '')}" placeholder="https://optimaondemand.github.io/…"><div class="help">Embedded as an iframe, exactly like the built courses.${it.pageUrl ? ` <a href="#" data-preview>Preview</a>` : ''}</div></div><div class="field"><label>Iframe height (px)</label><input data-f="iframeHeight" type="number" value="${it.iframeHeight || 1200}"></div>` : ''}
  ${it.missionQuestion !== undefined && it.kind !== 'header' ? `<div class="field"><label>Essential / mission question</label><input data-f="missionQuestion" value="${esc(it.missionQuestion || '')}" placeholder="What…? Why…? How…?"><div class="help">${it.flCodes && it.flCodes.length ? `<a href="#" data-eq>✨ Suggest from standards</a>` : 'Add a standard below to unlock suggestions.'}</div></div>` : ''}
  ${it.kind !== 'header' ? objectivesSection(it) : ''}
  ${it.kind !== 'header' ? standardsSection(it) : ''}
  ${it.assignment ? submissionSection(it) : ''}
  ${it.videos && it.videos.slots && it.videos.slots.length ? videosSection(it) : ''}
  ${it.quiz ? quizSection(it) : ''}
  ${it.library ? `<section><h4>Library resource</h4><div class="small">${esc(it.library.kind)} · <b>${esc(it.library.title)}</b> ${it.library.creator ? '· ' + esc(it.library.creator) : ''}${it.library.link ? ` · <a href="${esc(it.library.link)}" target="_blank" rel="noopener">source</a>` : ''}</div></section>` : ''}
  ${(it.enrich || []).length ? `<section><h4>Attached from libraries <span class="tiny muted">${it.enrich.length}</span></h4>${it.enrich.map((e, i) => `<div class="row" style="display:flex;justify-content:space-between;gap:8px;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--line);"><span>${esc(e.kind)} · ${esc(e.title)}</span><button class="btn xs" data-unenrich="${i}">✕</button></div>`).join('')}</section>` : ''}
  ${it.planning ? planningSection(it) : ''}
  ${it.info && it.info.length ? `<section><h4>From the lesson page</h4><div class="small" style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;">${it.info.filter(c => c.value).map(c => `<span class="muted">${esc(c.label)}</span><span>${esc(c.value)}${c.detail ? ' <span class="muted">· ' + esc(c.detail) + '</span>' : ''}</span>`).join('')}</div>${it.virtue ? `<div class="small" style="margin-top:6px;"><b>Virtue lens:</b> ${esc(it.virtue.label)}</div>` : ''}${it.counts ? `<div class="tiny muted" style="margin-top:6px;">${it.counts.activities || 0} activities · ${it.counts.journals || 0} response boxes · ${it.counts.selfCheckQuestions || 0} self-check questions · ~${it.counts.words || 0} words${it.features && it.features.readAloud ? ' · read-aloud' : ''}</div>` : ''}</section>` : ''}
  <section><h4>Actions</h4><div class="btn-row">${it.pageUrl ? `<button class="btn sm" data-act="preview">👁 Preview page</button>` : ''}<button class="btn sm" data-act="copyhtml">⧉ Copy Canvas HTML</button><button class="btn sm" data-act="previewhtml">Preview export</button><button class="btn sm" data-act="mute">${it.muted ? '🔈 Unmute' : '🔇 Mute'}</button><button class="btn sm" data-act="swap">⇄ Swap</button><button class="btn sm danger" data-act="del">✕ Remove</button></div></section>
</div>`;
    // wiring
    ui.qa('[data-f]', box).forEach(inp => inp.addEventListener('change', () => { const k = inp.dataset.f; let v = inp.value; if (k === 'iframeHeight') v = Number(v) || 1200; if (k === 'pageUrl') v = v.trim() || null; const patch = {}; patch[k] = v; if (k === 'pageUrl' && v) patch.placeholder = false; if (k === 'html' && v.trim()) patch.placeholder = false; OCS.updateItem(it.id, patch); }));
    const pv = ui.q('[data-preview]', box); if (pv) pv.onclick = (e) => { e.preventDefault(); ui.previewPage(it.pageUrl, it.title); };
    const eq = ui.q('[data-eq]', box); if (eq) eq.onclick = (e) => { e.preventDefault(); suggestEQ(it); };
    ui.qa('[data-act]', box).forEach(b => b.onclick = async () => {
      const a = b.dataset.act;
      if (a === 'preview') ui.previewPage(it.pageUrl, it.title);
      if (a === 'copyhtml') ui.copy(OCS.gen.canvasFragment(it, OCS.state.plan), 'Canvas HTML copied. Paste into the Canvas HTML editor (</>).');
      if (a === 'previewhtml') ui.previewHtml(OCS.gen.canvasFragment(it, OCS.state.plan), 'Export preview: ' + it.title);
      if (a === 'mute') OCS.toggleMute(it.id);
      if (a === 'swap') swapFlow(it, f.module);
      if (a === 'del') { if (await ui.confirm(`Remove "${it.title}"?`, { ok: 'Remove', danger: true })) OCS.removeItem(it.id); }
    });
    ui.qa('[data-unenrich]', box).forEach(b => b.onclick = () => OCS.updateItem(it.id, { enrich: it.enrich.filter((_, i) => i !== Number(b.dataset.unenrich)) }));
    wireObjectives(box, it); wireStandards(box, it); wireSubmission(box, it); wireQuiz(box, it); wireVideos(box, it);
  }

  function objectivesSection(it) {
    const B = OCS.data.blooms;
    return `<section><h4>Student objectives <span><button class="btn xs" data-obj-add>＋ Add</button>${(it.flCodes || []).length ? `<button class="btn xs" data-obj-suggest>✨ Suggest</button>` : ''}</span></h4>
<div class="obj-list">${(it.objectives || []).map((o, i) => { const lv = OCS.bloomLevelFor(o).level; return `<div class="obj"><textarea data-obj="${i}">${esc(o)}</textarea><div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">${lv ? `<span class="chip" style="background:${lv.color};color:#fff;border-color:transparent;" title="Bloom's level detected from the verb">${esc(lv.label)}</span>` : '<span class="chip" title="No Bloom\'s verb detected">—</span>'}<button class="btn xs" data-obj-del="${i}">✕</button></div></div>`; }).join('') || '<div class="tiny muted">No objectives yet.</div>'}</div>
<div class="bloom-bar" title="Bloom's levels">${B.levels.map(l => `<button data-bloom="${l.id}" style="border-color:${l.color};color:${l.color}" title="${esc(l.prompt)}: ${esc(l.verbs.slice(0, 6).join(', '))}…">${l.label}</button>`).join('')}</div>
<div class="tiny muted">Click a Bloom's level to see its verbs. Suggestions are plug-and-chug from the standards attached below.</div></section>`;
  }
  function wireObjectives(box, it) {
    ui.qa('[data-obj]', box).forEach(t => t.addEventListener('change', () => { const o = it.objectives.slice(); o[Number(t.dataset.obj)] = t.value.trim(); OCS.updateItem(it.id, { objectives: o.filter(Boolean) }); }));
    ui.qa('[data-obj-del]', box).forEach(b => b.onclick = () => OCS.updateItem(it.id, { objectives: it.objectives.filter((_, i) => i !== Number(b.dataset.objDel)) }));
    const add = ui.q('[data-obj-add]', box); if (add) add.onclick = () => OCS.updateItem(it.id, { objectives: [...(it.objectives || []), 'I can …'] });
    const sug = ui.q('[data-obj-suggest]', box); if (sug) sug.onclick = () => suggestObjectives(it);
    ui.qa('[data-bloom]', box).forEach(b => b.onclick = () => { const l = OCS.data.blooms.levels.find(x => x.id === b.dataset.bloom); ui.modal({ title: `Bloom's: ${l.label}`, body: `<p><b>${esc(l.prompt)}.</b></p><div class="bloom-bar">${l.verbs.map(v => `<button data-v="${esc(v)}" style="border-color:${l.color}">${esc(v)}</button>`).join('')}</div><p class="tiny muted" style="margin-top:10px;">Click a verb to start a new objective with it.</p>`, footer: `<button class="btn" data-close>Close</button>` }); setTimeout(() => ui.qa('#modal-root [data-v]').forEach(vb => vb.onclick = () => { OCS.updateItem(it.id, { objectives: [...(it.objectives || []), `I can ${vb.dataset.v} …`] }); ui.qa('#modal-root .modal-back').pop()?.remove(); }), 0); });
  }
  function suggestObjectives(it) {
    const codes = it.flCodes || []; const out = [];
    for (const c of codes) { const std = OCS.lookupStandard(c); if (!std) continue; OCS.suggestICan(std.text).forEach(s => out.push({ c, s })); }
    if (!out.length) { ui.toast('Standards text is still loading, or these codes are not in the bundle yet. Open Step 2 once and try again.', 'bad', 5000); OCS.loadBundle(OCS.state.plan.course.subject, OCS.state.plan.course.grade).then(() => renderInspector()); return; }
    const body = ui.el(`<div><p class="small muted" style="margin:0 0 8px;">Student-facing statements built from the standards on this item. Click to add.</p>${out.map((o, i) => `<div class="sugg" data-i="${i}"><span class="plus">＋</span><span><span class="tiny muted">${esc(o.c)}</span><br>${esc(o.s)}</span></div>`).join('')}</div>`);
    const m = ui.modal({ title: 'Suggested objectives', body, footer: `<button class="btn primary" data-close>Done</button>` });
    ui.qa('[data-i]', body).forEach(d => d.onclick = () => { const o = out[d.dataset.i]; OCS.updateItem(it.id, { objectives: [...(OCS.findItem(it.id).item.objectives || []), o.s] }); d.style.opacity = .4; ui.toast('Objective added', 'good'); });
  }
  function suggestEQ(it) {
    const out = []; for (const c of it.flCodes || []) { const std = OCS.lookupStandard(c); if (std) OCS.suggestEQ(std.text).forEach(s => out.push(s)); }
    if (!out.length) { ui.toast('No standards text loaded yet. Visit Step 2 once.', 'bad'); return; }
    const body = ui.el(`<div>${out.map((s, i) => `<div class="sugg" data-i="${i}"><span class="plus">?</span><span>${esc(s)}</span></div>`).join('')}</div>`);
    const m = ui.modal({ title: 'Essential question starters', body, footer: `<button class="btn" data-close>Cancel</button>` });
    ui.qa('[data-i]', body).forEach(d => d.onclick = () => { OCS.updateItem(it.id, { missionQuestion: out[d.dataset.i] }); m.close(); });
  }

  function standardsSection(it) {
    return `<section><h4>Standards <span class="tiny muted">${(it.flCodes || []).length + (it.txCodes || []).length} tagged</span></h4>
<div>${(it.flCodes || []).map(c => ui.stdChip(c, ` <span class="x" data-std-del="${esc(c)}">✕</span>`)).join('')}${(it.txCodes || []).map(c => `<span class="chip tx" title="Texas">${esc(c)} <span class="x" data-tx-del="${esc(c)}">✕</span></span>`).join('') || '<span class="tiny muted">None yet.</span>'}</div>
<div class="search">＋ <input data-std-add placeholder="Add a code (SS.4.A.1.1) and press Enter" list="std-dl"><datalist id="std-dl">${Object.keys(OCS.standardsIndex).slice(0, 400).map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>
${(it.flCodes || []).length ? `<div class="tiny muted">${(it.flCodes || []).slice(0, 3).map(c => { const s = OCS.lookupStandard(c); return s ? `<div><b>${esc(c)}</b> ${esc(s.text.slice(0, 120))}${s.text.length > 120 ? '…' : ''}</div>` : ''; }).join('')}</div>` : ''}</section>`;
  }
  function wireStandards(box, it) {
    ui.qa('[data-std-del]', box).forEach(x => x.onclick = () => OCS.updateItem(it.id, { flCodes: it.flCodes.filter(c => c !== x.dataset.stdDel) }));
    ui.qa('[data-tx-del]', box).forEach(x => x.onclick = () => OCS.updateItem(it.id, { txCodes: it.txCodes.filter(c => c !== x.dataset.txDel) }));
    const add = ui.q('[data-std-add]', box); if (add) add.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const v = add.value.trim(); if (!v) return; if (/^\d{3}\./.test(v)) OCS.updateItem(it.id, { txCodes: [...new Set([...(it.txCodes || []), v])], txNormalized: [...new Set([...(it.txNormalized || []), v])] }); else OCS.updateItem(it.id, { flCodes: [...new Set([...(it.flCodes || []), v])] }); } });
  }
  function submissionSection(it) {
    const a = it.assignment; const types = (a.submissionTypes || '').split(',').map(s => s.trim());
    const opt = (v, l) => `<label class="toggle"><input type="checkbox" data-sub="${v}" ${types.includes(v) ? 'checked' : ''}> ${l}</label>`;
    return `<section><h4>Canvas assignment settings</h4><div style="display:flex;gap:10px;flex-wrap:wrap;">${opt('online_text_entry', 'Text entry')}${opt('media_recording', 'Media recording')}${opt('online_upload', 'File upload')}${opt('none', 'No submission')}</div><div class="fields"><div class="field"><label>Points</label><input type="number" data-points value="${a.points == null ? '' : a.points}" placeholder="ungraded"></div><div class="field"><label>Due (days after module start)</label><input type="number" data-due value="${it.dueOffsetDays == null ? '' : it.dueOffsetDays}" placeholder="optional"></div></div></section>`;
  }
  function wireSubmission(box, it) {
    ui.qa('[data-sub]', box).forEach(cb => cb.onchange = () => { let types = ui.qa('[data-sub]', box).filter(x => x.checked).map(x => x.dataset.sub); if (cb.dataset.sub === 'none' && cb.checked) types = ['none']; else types = types.filter(t => t !== 'none'); if (!types.length) types = ['none']; OCS.updateItem(it.id, { assignment: { ...it.assignment, submissionTypes: types.join(',') } }); });
    const pts = ui.q('[data-points]', box); if (pts) pts.onchange = () => OCS.updateItem(it.id, { assignment: { ...it.assignment, points: pts.value === '' ? null : Number(pts.value) } });
    const due = ui.q('[data-due]', box); if (due) due.onchange = () => OCS.updateItem(it.id, { dueOffsetDays: due.value === '' ? null : Number(due.value) });
  }
  function videosSection(it) {
    return `<section><h4>Optima videos <span class="tiny muted">${it.videos.ready}/${it.videos.total} ready</span></h4><div class="cov-list">${it.videos.slots.map((s, i) => `<div class="row"><span class="chip ${s.status === 'ready' ? 'ok' : (s.status === 'pending' ? 'warn' : '')}">${esc(s.status)}</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${esc(s.slot || '')}">${esc(s.type || 'Video')}${s.title ? ' · ' + esc(s.title) : ''}</span>${s.embedSrc ? `<button class="btn xs" data-play="${i}">▶</button>` : ''}</div>`).join('')}</div><div class="tiny muted">Status comes from the repo's video-manifest.json and refreshes live. Pending slots are filmed by Bethany and Kayson's team; nothing to do here.</div></section>`;
  }
  function wireVideos(box, it) { ui.qa('[data-play]', box).forEach(b => b.onclick = () => { const s = it.videos.slots[b.dataset.play]; ui.modal({ title: s.title || s.type || 'Video', wide: true, footer: `<button class="btn primary" data-close>Done</button>`, body: `<div style="position:relative;padding-top:56.25%;"><iframe src="${esc(s.embedSrc)}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:10px;" allowfullscreen></iframe></div>` }); }); }
  function quizSection(it) {
    const q = it.quiz; const qs = q.questions || []; const on = qs.filter(x => x.include !== false).length;
    return `<section><h4>Quiz questions <span><span class="tiny muted">${on}/${qs.length} included</span> <button class="btn xs" data-q-add="essay">＋ Essay</button><button class="btn xs" data-q-add="mc">＋ Multiple choice</button></span></h4>
<div class="q-list">${qs.map((x, i) => `<div class="q ${x.include === false ? 'off' : ''}"><div><div class="qt">${esc((x.type || '').replace(/_question$/, '').replace(/_/g, ' '))} · ${x.points || 1} pt</div><div>${esc(x.prompt || '').slice(0, 220)}${(x.prompt || '').length > 220 ? '…' : ''}</div>${x.options ? `<ul>${x.options.map(o => `<li class="${(x.correct || []).includes(o.id) ? 'ok' : ''}">${esc(o.text)}</li>`).join('')}</ul>` : ''}${x.pairs ? `<ul>${x.pairs.map(pp => `<li>${esc(pp.left)} → ${esc(((x.choices || []).find(c => c.id === pp.rightId) || {}).text || '?')}</li>`).join('')}</ul>` : ''}</div><div style="display:flex;flex-direction:column;gap:4px;"><button class="btn xs" data-q-toggle="${i}" title="Include or skip">${x.include === false ? 'Include' : 'Skip'}</button><button class="btn xs" data-q-del="${i}">✕</button></div></div>`).join('') || '<div class="tiny muted">No questions yet. Add one.</div>'}</div></section>`;
  }
  function wireQuiz(box, it) {
    if (!it.quiz) return;
    ui.qa('[data-q-toggle]', box).forEach(b => b.onclick = () => { const qs = it.quiz.questions.map((x, i) => i === Number(b.dataset.qToggle) ? { ...x, include: x.include === false } : x); OCS.updateItem(it.id, { quiz: { ...it.quiz, questions: qs } }); });
    ui.qa('[data-q-del]', box).forEach(b => b.onclick = () => OCS.updateItem(it.id, { quiz: { ...it.quiz, questions: it.quiz.questions.filter((_, i) => i !== Number(b.dataset.qDel)) } }));
    ui.qa('[data-q-add]', box).forEach(b => b.onclick = () => addQuestion(it, b.dataset.qAdd));
  }
  function addQuestion(it, type) {
    const body = ui.el(`<div><div class="field"><label>Question</label><textarea id="nq-prompt" placeholder="Type the question students will see"></textarea></div>${type === 'mc' ? `<div class="field" style="margin-top:8px;"><label>Choices (one per line, put * before the correct one)</label><textarea id="nq-opts" placeholder="*Peninsula\nIsland\nMountain range"></textarea></div>` : ''}<div class="field" style="margin-top:8px;"><label>Points</label><input id="nq-pts" type="number" value="1"></div></div>`);
    const m = ui.modal({ title: type === 'mc' ? 'New multiple choice question' : 'New essay question', body, footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Add question</button>` });
    ui.q('[data-ok]', m.el).onclick = () => {
      const prompt = ui.q('#nq-prompt', body).value.trim(); if (!prompt) { ui.toast('Type a question first.', 'bad'); return; }
      const q = { id: OCS.uid('q_'), title: 'Question', type: type === 'mc' ? 'multiple_choice_question' : 'essay_question', points: Number(ui.q('#nq-pts', body).value) || 1, prompt, promptHtml: `<div><p>${esc(prompt)}</p></div>`, include: true };
      if (type === 'mc') { const lines = ui.q('#nq-opts', body).value.split('\n').map(s => s.trim()).filter(Boolean); q.options = lines.map(l => ({ id: OCS.uid('a').slice(0, 24), text: l.replace(/^\*\s*/, '') })); q.correct = lines.map((l, i) => l.startsWith('*') ? q.options[i].id : null).filter(Boolean); if (!q.correct.length) q.correct = [q.options[0] && q.options[0].id].filter(Boolean); }
      OCS.updateItem(it.id, { quiz: { ...it.quiz, questions: [...(it.quiz.questions || []), q] }, placeholder: false }); m.close(); ui.toast('Question added', 'good');
    };
  }
  function planningSection(it) {
    const p = it.planning; const rows = [['Routine', p.routine], ['Lesson type', p.lessonType], ['Unit arc', p.unitArc], ['CPA model', p.cpaModel], ['Virtue lens', p.virtue], ['Cross-curricular', p.crossCurricular], ['Socratic question', p.socratic], ['Thinking move', p.thinkingMove], ['Evidence', p.evidence], ['Reading', p.core_reading_4_day_chapter_pace || p.core_reading_4_day_pace], ['Reading skill', p.reading_skill_what_good_readers_do], ['Writing moves', p.rwm_focus], ['Grammar', p.grammar_conventions], ['Morphology', p.morphology || p.morphology_vocabulary], ['Spelling', p.spelling_word_analysis], ['Writing', p.writing_focus_assessment]].filter(r => r[1]);
    if (!rows.length) return '';
    return `<section><h4>From the planning table</h4><div class="small" style="display:grid;grid-template-columns:auto 1fr;gap:3px 10px;">${rows.map(r => `<span class="muted">${esc(r[0])}</span><span>${esc(r[1])}</span>`).join('')}</div></section>`;
  }
})(window.OCS);
