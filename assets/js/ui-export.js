/* =====================================================================
   Optima Curriculum Studio - Step 7: Export
   ===================================================================== */
(function (OCS) {
  const ui = OCS.ui, esc = OCS.esc;

  ui.views.export = function (stage) {
    const p = OCS.state.plan; const s = OCS.planSummary(); const cov = OCS.coverage();
    const warnings = [];
    if (s.placeholders) warnings.push(`${s.placeholders} slot${s.placeholders > 1 ? 's are' : ' is'} still empty. They export as clearly marked placeholder pages so you can fill them in Canvas later, or mute them first.`);
    if (cov.uncovered.length) warnings.push(`${cov.uncovered.length} targeted standard${cov.uncovered.length > 1 ? 's have' : ' has'} no covering item yet.`);
    const missing = p.modules.flatMap(m => m.items).filter(i => !i.muted && i.source && OCS.data.courses[i.source.courseId] && (OCS.data.courses[i.source.courseId].modules.flatMap(x => x.items).find(x => x.id === i.source.itemId) || {}).pageStatus === 'missing');
    if (missing.length) warnings.push(`${missing.length} lesson page${missing.length > 1 ? 's are' : ' is'} not published on GitHub yet (they will show a blank frame in Canvas until the repo catches up).`);
    if (!p.modules.some(m => !m.muted && m.items.some(i => !i.muted))) warnings.push('Nothing is live. Unmute at least one item.');
    stage.innerHTML = ui.stageHead('Step 7', 'Export', 'Everything below is generated in your browser from the plan. Nothing is sent anywhere. Muted modules and items are left out.',
      `<button class="btn" id="ex-scope">🗺️ Scope and sequence</button><button class="btn" id="ex-report">📋 Standards report</button>`)
      + `<div class="stats" style="margin-bottom:14px;"><div class="stat"><span class="v">${s.modules}</span><span class="l">Modules</span></div><div class="stat"><span class="v">${s.items}</span><span class="l">Items</span></div><div class="stat"><span class="v">${s.lessons}</span><span class="l">Lessons</span></div><div class="stat"><span class="v">${s.quizzes}</span><span class="l">Quizzes</span></div><div class="stat"><span class="v">${s.discussions}</span><span class="l">Discussions</span></div><div class="stat"><span class="v">${s.muted}</span><span class="l">Muted (skipped)</span></div><div class="stat"><span class="v">${cov.pct}%</span><span class="l">Standards covered</span></div></div>`
      + (warnings.length ? `<div class="notice warn" style="margin-bottom:14px;">⚠️ <div>${warnings.map(w => `<div>${esc(w)}</div>`).join('')}</div></div>` : `<div class="notice good" style="margin-bottom:14px;">✅ Ready to export.</div>`)
      + `<div class="grid cols-3">
  <div class="card export-card"><div class="big">📦</div><h3>Canvas course cartridge (.imscc)</h3><p class="small muted" style="margin:0;">Import it yourself: Canvas › Settings › Import Course Content › "Canvas Course Export Package". Modules, assignments with the embedded lessons, quizzes with their questions, pages, and discussions all come through unpublished so you can review first.</p>
    <label class="toggle small"><input type="checkbox" id="ex-pages" checked> Include the course's Home, Start Here, and guide pages</label>
    <label class="toggle small"><input type="checkbox" id="ex-home"> Also generate a home page from this plan</label>
    <label class="toggle small"><input type="checkbox" id="ex-muted"> Include muted items too</label>
    <div class="btn-row"><button class="btn primary" id="ex-imscc">⬇ Build .imscc</button></div><div id="ex-imscc-out" class="small"></div></div>
  <div class="card export-card" style="border-top-color:var(--gold)"><div class="big">📋</div><h3>Canvas-ready HTML</h3><p class="small muted" style="margin:0;">For one lesson at a time, or when you already have a shell. Inline styles only (Canvas strips style blocks); the GitHub widgets stay as iframes so teachers never touch GitHub.</p>
    <div class="btn-row"><button class="btn" id="ex-canvas-zip">⬇ All fragments (.zip)</button><button class="btn" id="ex-html-zip">⬇ Standalone pages (.zip)</button></div>
    <details><summary class="small" style="cursor:pointer;font-weight:800;">Copy a single item</summary><div id="ex-copy-list" style="display:flex;flex-direction:column;gap:6px;margin-top:8px;max-height:320px;overflow:auto;"></div></details></div>
  <div class="card export-card" style="border-top-color:var(--purple)"><div class="big">🤝</div><h3>Hand-off and reports</h3><p class="small muted" style="margin:0;">The plan file is what Joseph needs for a 10-minute port, and what you reopen next year. Reports show your lead what is covered.</p>
    <div class="btn-row"><button class="btn primary" id="ex-plan">💾 Plan file (.ocs.json)</button><button class="btn" id="ex-csv">⬇ Standards CSV</button><button class="btn" id="ex-print">🖨 Print report</button></div>
    <div class="small" style="margin-top:6px;"><b>Note for Joseph</b><pre class="code" id="ex-note" style="white-space:pre-wrap;">${esc(handoffNote(p, s, cov))}</pre><button class="btn xs" id="ex-note-copy">Copy note</button></div></div>
</div>`;
    ui.q('#ex-scope').onclick = () => ui.previewHtml(OCS.gen.scopeHtml(p), 'Scope and sequence');
    ui.q('#ex-report').onclick = () => ui.previewHtml(OCS.gen.standardsReportHtml(p), 'Standards coverage report');
    ui.q('#ex-print').onclick = () => { const w = window.open('', '_blank'); if (!w) { ui.toast('Pop-up blocked. Allow pop-ups for this site to print.', 'bad'); return; } w.document.write(OCS.gen.standaloneDoc('Standards report', OCS.gen.standardsReportHtml(p), p)); w.document.close(); setTimeout(() => w.print(), 600); };
    ui.q('#ex-csv').onclick = () => ui.downloadText(OCS.gen.standardsCsv(p), OCS.slug(p.name) + '-standards.csv', 'text/csv');
    ui.q('#ex-plan').onclick = () => { ui.downloadText(OCS.exportPlanJSON(), OCS.slug(p.name) + '.ocs.json', 'application/json'); mark(); ui.toast('Plan file downloaded', 'good'); };
    ui.q('#ex-note-copy').onclick = () => ui.copy(ui.q('#ex-note').textContent, 'Note copied');
    ui.q('#ex-imscc').onclick = async () => {
      const out = ui.q('#ex-imscc-out'); out.innerHTML = `<div class="notice info">⏳ Building the cartridge…</div>`;
      try {
        if (p.course.sourceId && !OCS.data.courses[p.course.sourceId] && OCS.data.catalog.courses.some(c => c.id === p.course.sourceId)) await OCS.loadCourse(p.course.sourceId);
        const r = await OCS.imscc.build(p, { includeSourcePages: ui.q('#ex-pages').checked, generateHome: ui.q('#ex-home').checked, includeMuted: ui.q('#ex-muted').checked });
        OCS.imscc.download(r.blob, r.fileName); mark();
        out.innerHTML = `<div class="notice good">✅ <div><b>${esc(r.fileName)}</b> (${(r.blob.size / 1024).toFixed(0)} KB): ${r.stats.modules} modules, ${r.stats.assignments} assignments, ${r.stats.quizzes} quizzes, ${r.stats.pages} pages, ${r.stats.discussions} discussions.${r.stats.skippedMuted ? ` ${r.stats.skippedMuted} muted items skipped.` : ''}<br><span class="tiny">Everything imports unpublished. Discussion topics are new in this build; check one after import.</span></div></div>`;
      } catch (e) { console.error(e); out.innerHTML = `<div class="notice bad">Export failed: ${esc(e.message)}</div>`; }
    };
    ui.q('#ex-canvas-zip').onclick = async () => { try { const r = await OCS.imscc.buildHtmlPack(p, { standalone: false }); OCS.imscc.download(r.blob, r.fileName); mark(); ui.toast(`${r.count} Canvas HTML fragments zipped`, 'good'); } catch (e) { ui.toast(e.message, 'bad'); } };
    ui.q('#ex-html-zip').onclick = async () => { try { const r = await OCS.imscc.buildHtmlPack(p, { standalone: true }); OCS.imscc.download(r.blob, r.fileName); mark(); ui.toast(`${r.count} standalone pages zipped`, 'good'); } catch (e) { ui.toast(e.message, 'bad'); } };
    const list = ui.q('#ex-copy-list');
    list.innerHTML = p.modules.filter(m => !m.muted).flatMap(m => m.items.filter(i => !i.muted && i.kind !== 'header').map(i => `<div class="copy-row"><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${OCS.kindMeta(i.kind).icon} ${esc(i.title)}</span><button class="btn xs" data-pv="${i.id}">Preview</button><button class="btn xs primary" data-cp="${i.id}">Copy HTML</button></div>`)).join('') || '<span class="tiny muted">Nothing live to copy.</span>';
    ui.qa('[data-cp]', list).forEach(b => b.onclick = () => { const it = OCS.findItem(b.dataset.cp).item; ui.copy(it.kind === 'quiz' ? OCS.gen.quizDescription(it, p) : OCS.gen.canvasFragment(it, p), 'Canvas HTML copied. In Canvas, open the HTML editor (</>) and paste.'); });
    ui.qa('[data-pv]', list).forEach(b => b.onclick = () => { const it = OCS.findItem(b.dataset.pv).item; ui.previewHtml(OCS.gen.canvasFragment(it, p), it.title); });
    function mark() { OCS.mutate(pl => { pl.progress = pl.progress || {}; pl.progress.exported = new Date().toISOString(); }, 'plan:changed'); }
  };
  function handoffNote(p, s, cov) {
    return `Course build hand-off: ${p.name}
Source spine: ${p.course.title || 'blank'} (${p.course.state || 'FL'} standards)
Teacher: ${p.teacher.name || '—'}${p.teacher.section ? ' · ' + p.teacher.section : ''}${p.teacher.email ? ' · ' + p.teacher.email : ''}
Contents: ${s.modules} modules, ${s.items} items (${s.lessons} lessons, ${s.quizzes} quizzes, ${s.discussions} discussions), ${s.muted} muted items left out
Standards: ${cov.covered.length}/${cov.targets.length} targets covered (${cov.pct}%)${cov.uncovered.length ? '; open: ' + cov.uncovered.slice(0, 8).join(', ') + (cov.uncovered.length > 8 ? '…' : '') : ''}
Attached: the .imscc cartridge (import as Canvas Course Export Package, everything arrives unpublished) and the .ocs.json plan file (reopen at the Curriculum Studio to make changes).
Requests for Canvas: ${p.notes || 'none noted'}`;
  }
})(window.OCS);
