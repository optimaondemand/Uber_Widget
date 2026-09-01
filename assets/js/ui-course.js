/* =====================================================================
   Optima Curriculum Studio - Home + Step 1 (Course)
   ===================================================================== */
(function (OCS) {
  const ui = OCS.ui, esc = OCS.esc;

  ui.views.home = function (stage) {
    const p = OCS.state.plan; const recent = OCS.recent();
    stage.innerHTML = `
<div class="hero">
  <div>
    <div class="kicker" style="color:#55C8E8;font-size:11px;text-transform:uppercase;letter-spacing:.8px;font-weight:800;">Optima Academy Online</div>
    <h1>Pick a course. Keep what works. Swap the rest. Export to Canvas.</h1>
    <p>Start from the On-Demand courses the team already built, then mute, reorder, and add your own pieces. Standards check themselves off as you go. Nothing here calls an AI model, and your work saves in this browser as you build.</p>
    <div class="flow"><span>1 · Course</span><span>2 · Standards cart</span><span>3 · Template</span><span>4 · Build the spine</span><span>5 · Enrich from libraries</span><span>6 · Style + calendar</span><span>7 · Export</span></div>
  </div>
  <div class="owl">🦉</div>
</div>
<div class="grid cols-3">
  <div class="card pad">
    <h3>Continue</h3>
    ${p ? `<p class="muted small" style="margin:6px 0 10px;">You have a plan in progress.</p><div style="font-weight:800;">${esc(p.name)}</div><div class="small muted">${esc(p.course.title || 'Blank plan')} · updated ${new Date(p.updated).toLocaleString()}</div><div class="btn-row" style="margin-top:10px;"><button class="btn primary" data-go="build">Open the builder</button><button class="btn" data-go="export">Export</button></div>` : `<p class="muted small" style="margin:6px 0 10px;">No plan yet. Pick a course to begin.</p><button class="btn primary" data-go="course">Choose a course</button>`}
  </div>
  <div class="card pad">
    <h3>What you can make</h3>
    <ul class="small" style="margin:8px 0 0;padding-left:18px;color:var(--ink-2);line-height:1.7;">
      <li>A Canvas cartridge (.imscc) you import yourself</li>
      <li>Canvas-ready HTML for any single lesson</li>
      <li>Standalone HTML lesson pages with embedded widgets</li>
      <li>A standards coverage report for your lead</li>
      <li>A plan file to hand to Joseph for a 10-minute port</li>
    </ul>
  </div>
  <div class="card pad">
    <h3>Built on</h3>
    <ul class="small" style="margin:8px 0 0;padding-left:18px;color:var(--ink-2);line-height:1.7;">
      <li>${OCS.data.catalog ? OCS.data.catalog.courses.length : 6} On-Demand course spines (3rd and 4th grade ELA, Math, Social Studies)</li>
      <li>Standards Browser: TX, FL, MS, PR verbatim standards</li>
      <li>Art, Music, and ELA Reference Libraries</li>
      <li>Video manifests from each subject repo (live)</li>
    </ul>
  </div>
</div>
${recent.length ? `<h2 style="margin:22px 0 10px;">Recent plans in this browser</h2><div class="recent">${recent.map(r => `<div class="card pad" style="min-width:220px;"><b>${esc(r.name)}</b><div class="small muted">${esc(r.course || '')}</div><div class="tiny muted">${new Date(r.updated).toLocaleString()}</div></div>`).join('')}</div><p class="tiny muted">Only the most recent plan is kept live in the browser. Use <b>Save plan file</b> to keep others.</p>` : ''}`;
    ui.qa('[data-go]', stage).forEach(b => b.onclick = () => ui.go(b.dataset.go));
  };

  ui.views.course = function (stage) {
    const cat = OCS.data.catalog; const p = OCS.state.plan;
    const skins = OCS.data.skins;
    const cards = cat.courses.map(c => {
      const sk = OCS.skinFor(c.accent) || {}; const vt = c.counts.videosTotal || 0, vr = c.counts.videosReady || 0;
      return `<div class="card course-card ${p && p.course.sourceId === c.id ? 'selected' : ''}" data-course="${c.id}" style="border-top-color:${sk.accent || '#55C8E8'}">
  <div class="emoji">${sk.emoji || '📘'}</div>
  <div class="grade">Grade ${esc(c.grade)} · ${esc(c.subjectLabel)}</div>
  <h3>${esc(c.title)}</h3>
  <div class="counts"><span><b>${c.counts.modules}</b> modules</span><span><b>${c.counts.lessons}</b> lessons</span>${c.counts.quizzes ? `<span><b>${c.counts.quizzes}</b> quizzes</span>` : ''}<span><b>${c.counts.flStandards}</b> FL standards</span></div>
  ${vt ? `<div><div class="tiny muted" style="display:flex;justify-content:space-between;"><span>Optima videos ready</span><span>${vr} / ${vt}</span></div><div class="vid"><i style="width:${Math.round(vr / vt * 100)}%"></i></div></div>` : ''}
  ${c.counts.missingPages ? `<div class="tiny" style="color:var(--warn);font-weight:700;">${c.counts.missingPages} lesson pages not published yet</div>` : ''}
  <div class="btn-row" style="margin-top:auto;"><button class="btn primary sm" data-start="${c.id}">Start from this course</button><button class="btn sm" data-peek="${c.id}">Peek inside</button></div>
</div>`;
    }).join('');
    stage.innerHTML = ui.stageHead('Step 1', 'Choose your starting spine', 'Every course below is a complete On-Demand build with its lessons, quizzes, videos, and standards already wired. Start from one and customize, start blank with a template, or import any Canvas export.')
      + `<div class="grid auto">${cards}
<div class="card course-card blank" data-blank><div class="emoji">✨</div><div class="grade">Start fresh</div><h3>Blank course</h3><p class="small muted" style="margin:0;">Pick a subject and grade, choose a module template, and fill the slots from the libraries or your own materials.</p><div class="btn-row" style="margin-top:auto;"><button class="btn sm" data-blank-btn>Start blank</button></div></div>
<div class="card course-card import" data-import><div class="emoji">📦</div><div class="grade">Bring your own</div><h3>Import a Canvas export</h3><p class="small muted" style="margin:0;">Drop any .imscc file. The studio deconstructs it into modules, lessons, quizzes, and pages you can rearrange.</p><div class="btn-row" style="margin-top:auto;"><button class="btn sm" data-import-btn>Choose .imscc file</button></div></div>
</div>
${Object.keys(OCS.data.courses).some(id => OCS.data.courses[id].imported) ? `<h2 style="margin:20px 0 10px;">Imported this session</h2><div class="grid auto">${Object.values(OCS.data.courses).filter(c => c.imported).map(c => `<div class="card course-card import"><div class="emoji">📦</div><div class="grade">Imported · ${esc(c.fileName || '')}</div><h3>${esc(c.title)}</h3><div class="counts"><span><b>${c.counts.modules}</b> modules</span><span><b>${c.counts.lessons}</b> lessons</span><span><b>${c.counts.quizzes}</b> quizzes</span></div><div class="btn-row" style="margin-top:auto;"><button class="btn primary sm" data-start="${c.id}">Start from this import</button></div></div>`).join('')}</div>` : ''}`;
    ui.qa('[data-start]', stage).forEach(b => b.onclick = () => startFromCourse(b.dataset.start));
    ui.qa('[data-peek]', stage).forEach(b => b.onclick = () => peekCourse(b.dataset.peek));
    ui.q('[data-blank-btn]', stage).onclick = startBlank;
    ui.q('[data-import-btn]', stage).onclick = () => ui.q('#file-imscc').click();
    const fi = ui.q('#file-imscc'); fi.onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return; e.target.value = '';
      const m = ui.modal({ title: 'Deconstructing ' + f.name, body: `<div class="notice info">⏳ Reading modules, assignments, quizzes, and pages…</div>`, footer: false });
      try { const course = await OCS.imscc.parse(f); OCS.data.courses[course.id] = course; m.close(); ui.toast(`Imported ${course.counts.modules} modules, ${course.counts.lessons} lessons, ${course.counts.quizzes} quizzes.`, 'good'); ui.render(); startFromCourse(course.id); }
      catch (err) { m.close(); ui.toast('Import failed: ' + err.message, 'bad'); }
    };
  };

  async function peekCourse(id) {
    const m = ui.modal({ title: 'Loading…', wide: true, footer: false, body: `<div class="notice info">⏳ Loading course spine…</div>` });
    let course; try { course = await OCS.loadCourse(id); } catch (e) { m.body.innerHTML = `<div class="notice bad">${esc(e.message)}</div>`; return; }
    ui.q('h2', m.el).textContent = course.title;
    m.body.innerHTML = `<div class="stats" style="margin-bottom:12px;"><div class="stat"><span class="v">${course.counts.modules}</span><span class="l">Modules</span></div><div class="stat"><span class="v">${course.counts.lessons}</span><span class="l">Lessons</span></div><div class="stat"><span class="v">${course.counts.quizzes}</span><span class="l">Quizzes</span></div><div class="stat"><span class="v">${course.counts.videosReady}/${course.counts.videosTotal}</span><span class="l">Videos ready</span></div><div class="stat"><span class="v">${course.counts.flStandards}</span><span class="l">FL standards</span></div></div>
${course.modules.map(mod => `<details style="margin-bottom:6px;"><summary style="cursor:pointer;font-weight:800;padding:6px 0;">${esc(mod.title)} <span class="muted small">· ${mod.items.length} items</span></summary><div style="padding:4px 0 8px 14px;">${mod.items.map(it => `<div style="display:flex;gap:8px;align-items:center;padding:4px 0;border-bottom:1px solid var(--line);font-size:13px;"><span>${OCS.kindMeta(it.kind).icon}</span><span style="flex:1;">${esc(it.title)}</span>${(it.lesson && it.lesson.flCodes || []).slice(0, 4).map(c => ui.stdChip(c)).join('')}${it.videos ? ui.videoDots(it.videos) : ''}${it.pageUrl ? `<button class="btn xs" data-prev="${esc(it.pageUrl)}" data-title="${esc(it.title)}">Preview</button>` : ''}</div>`).join('')}</div></details>`).join('')}`;
    ui.qa('[data-prev]', m.el).forEach(b => b.onclick = () => ui.previewPage(b.dataset.prev, b.dataset.title));
  }

  async function startFromCourse(id) {
    let course; try { course = await OCS.loadCourse(id); } catch (e) { ui.toast('Could not load course: ' + e.message, 'bad'); return; }
    const man = OCS.data.standards.manifest ? OCS.data.standards.manifest.jurisdictions : { FL: 'Florida', TX: 'Texas', MS: 'Mississippi', PR: 'Puerto Rico' };
    const body = ui.el(`<div>
<div class="notice info" style="margin-bottom:12px;">🧭 <span>You are starting from <b>${esc(course.title)}</b>: ${course.counts.modules} modules and ${course.counts.lessons} lessons come in pre-built. You can mute or reorder anything afterwards.</span></div>
<div class="fields">
  <div class="field"><label>Plan name</label><input id="sc-name" value="${esc(course.title)} — my build"></div>
  <div class="field"><label>State standards</label><select id="sc-state">${Object.entries(man).map(([k, v]) => `<option value="${k}" ${k === 'FL' ? 'selected' : ''}>${esc(v)} (${k})</option>`).join('')}</select><div class="help">Florida is the built-in default. Texas codes are already on the lesson pages; Mississippi and Puerto Rico load from the Standards Browser.</div></div>
  <div class="field"><label>Your name (shown on pages)</label><input id="sc-teacher" placeholder="Optional"></div>
</div>
<div class="field" style="margin-top:12px;"><label>Which modules?</label>
  <div class="btn-row" style="margin:4px 0 8px;"><button class="btn xs" data-all>All</button><button class="btn xs" data-none>None</button><button class="btn xs" data-q1>First quarter (first ${Math.min(course.modules.length, Math.max(3, Math.ceil(course.modules.length / 4)))})</button></div>
  <div style="max-height:260px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:6px 10px;">${course.modules.map(m => `<label class="toggle" style="display:flex;padding:4px 0;"><input type="checkbox" data-mod="${m.id}" checked> <span style="flex:1;">${esc(m.title)}</span><span class="tiny muted">${m.items.length} items</span></label>`).join('')}</div>
</div></div>`);
    const m = ui.modal({ title: 'Set up your build', body, footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Start building →</button>` });
    const boxes = () => ui.qa('[data-mod]', body);
    ui.q('[data-all]', body).onclick = () => boxes().forEach(b => b.checked = true);
    ui.q('[data-none]', body).onclick = () => boxes().forEach(b => b.checked = false);
    ui.q('[data-q1]', body).onclick = () => { const n = Math.min(course.modules.length, Math.max(3, Math.ceil(course.modules.length / 4))); boxes().forEach((b, i) => b.checked = i < n || /placeholder|spotlight|teacher resources|goblins/i.test(course.modules[i].title)); };
    ui.q('[data-ok]', m.el).onclick = () => {
      const ids = boxes().filter(b => b.checked).map(b => b.dataset.mod); if (!ids.length) { ui.toast('Pick at least one module.', 'bad'); return; }
      const plan = OCS.newPlanFromCourse(course, { state: ui.q('#sc-state', body).value, moduleIds: ids });
      const nm = ui.q('#sc-name', body).value.trim(); const tn = ui.q('#sc-teacher', body).value.trim();
      OCS.mutate(pl => { if (nm) pl.name = nm; pl.teacher.name = tn; pl.progress = { firstRun: true }; }, 'plan:renamed');
      OCS.applySkin(OCS.skinFor(plan.skin.id));
      m.close(); ui.toast(`Plan ready: ${plan.modules.length} modules loaded. Standards cart pre-filled with ${plan.standards.targets.length} codes.`, 'good', 5000); ui.go('build');
    };
  }

  function startBlank() {
    const man = OCS.data.standards.manifest ? OCS.data.standards.manifest.jurisdictions : { FL: 'Florida', TX: 'Texas', MS: 'Mississippi', PR: 'Puerto Rico' };
    const subjects = [['ela', 'English Language Arts'], ['math', 'Mathematics'], ['social-studies', 'Social Studies'], ['science', 'Science'], ['art', 'Art'], ['music', 'Music'], ['other', 'Other']];
    const body = ui.el(`<div class="fields">
  <div class="field"><label>Plan name</label><input id="bl-name" value="New course plan"></div>
  <div class="field"><label>Subject</label><select id="bl-subject">${subjects.map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></div>
  <div class="field"><label>Grade</label><select id="bl-grade">${['K', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'].map(g => `<option ${g === '4' ? 'selected' : ''}>${g}</option>`).join('')}</select></div>
  <div class="field"><label>State standards</label><select id="bl-state">${Object.entries(man).map(([k, v]) => `<option value="${k}" ${k === 'FL' ? 'selected' : ''}>${esc(v)} (${k})</option>`).join('')}</select></div>
  <div class="field"><label>Your name</label><input id="bl-teacher" placeholder="Optional"></div>
</div>`);
    const m = ui.modal({ title: 'Start a blank course', body, footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Create →</button>` });
    ui.q('[data-ok]', m.el).onclick = () => {
      const subject = ui.q('#bl-subject', body).value; const label = subjects.find(s => s[0] === subject)[1];
      const plan = OCS.newBlankPlan({ name: ui.q('#bl-name', body).value.trim() || 'New course plan', grade: ui.q('#bl-grade', body).value, subject, subjectLabel: label, state: ui.q('#bl-state', body).value, title: `Grade ${ui.q('#bl-grade', body).value} ${label}`, skin: ({ ela: 'storyteller-gold', math: 'math-explorer', 'social-studies': 'florida-historian', art: 'sunrise-studio', music: 'sunrise-studio', science: 'forest-green' })[subject] || 'optima-navy' });
      OCS.mutate(pl => { pl.teacher.name = ui.q('#bl-teacher', body).value.trim(); }, 'plan:renamed');
      OCS.applySkin(OCS.skinFor(plan.skin.id)); m.close(); ui.toast('Blank plan created. Pick a template to shape your first module.', 'good'); ui.go('template');
    };
  }
})(window.OCS);
