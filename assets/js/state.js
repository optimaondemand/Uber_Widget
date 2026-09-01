/* =====================================================================
   Optima Curriculum Studio - plan state
   A "plan" is the teacher's customized course spine. It autosaves to the
   browser (localStorage) and can be downloaded / reopened as a .ocs.json
   file, which is also what a teacher hands to Joseph.
   ===================================================================== */
(function (OCS) {
  const LS_KEY = 'ocs.plan.v1', LS_RECENT = 'ocs.recent.v1';
  const listeners = {};
  OCS.on = (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); };
  OCS.emit = (evt, payload) => { (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } }); (listeners['*'] || []).forEach(fn => { try { fn(evt, payload); } catch (e) {} }); };

  const state = { plan: null, selectedItemId: null, dirty: false, undo: [], redo: [], lastSaved: null };
  OCS.state = state;

  /* ---------------- plan construction ---------------- */
  function blankPlan(opts = {}) {
    const now = new Date().toISOString();
    return {
      schema: 'ocs-plan/1', id: OCS.uid('plan_'), name: opts.name || 'Untitled course plan', created: now, updated: now,
      teacher: { name: '', email: '', section: '', term: '2026-27' },
      course: { sourceId: opts.sourceId || null, title: opts.title || '', grade: opts.grade || '', subject: opts.subject || '', subjectLabel: opts.subjectLabel || '', state: opts.state || 'FL', repo: opts.repo || null, pagesBase: opts.pagesBase || null },
      skin: { id: opts.skin || 'optima-navy', customBg: null },
      calendar: { week1: null, overrides: [] },
      standards: { jurisdiction: opts.state || 'FL', targets: [] },
      modules: [],
      notes: '',
    };
  }
  OCS.newBlankPlan = function (opts) { setPlan(blankPlan(opts)); return state.plan; };

  // Build a plan from a catalog course: this is the "gold standard" spine, fully pre-populated.
  OCS.newPlanFromCourse = function (course, opts = {}) {
    const p = blankPlan({ name: (course.title || 'Course') + ' — my build', sourceId: course.id, title: course.title, grade: course.grade, subject: course.subject, subjectLabel: course.subjectLabel, state: opts.state || 'FL', skin: course.accent, repo: course.repo, pagesBase: course.pagesBase });
    const keep = opts.moduleIds ? new Set(opts.moduleIds) : null;
    for (const m of course.modules || []) {
      if (keep && !keep.has(m.id)) continue;
      const mod = { id: OCS.uid('m_'), sourceId: m.id, title: m.title, muted: false, collapsed: false, weekStart: null, items: [] };
      for (const it of m.items || []) mod.items.push(OCS.itemFromCatalog(course, it));
      p.modules.push(mod);
    }
    // Sensible default targets: every FL standard the gold-standard course covers
    p.standards.targets = Array.from(new Set(course.flStandards || [])).filter(c => !/^MTR\./.test(c));
    setPlan(p); return p;
  };

  OCS.itemFromCatalog = function (course, it) {
    const L = it.lesson || {};
    return {
      id: OCS.uid('i_'), kind: it.kind, title: it.title, muted: false, placeholder: !!it.isPlaceholder,
      source: { courseId: course.id, itemId: it.id, ref: it.ref, canvasType: it.canvasType },
      code: it.code || null, week: it.week || null, unit: it.unit || null,
      pageUrl: it.pageUrl || null, iframeHeight: it.iframeHeight || 1200, extraHtml: it.extraHtml || null,
      flCodes: Array.from(new Set([...(L.flCodes || []), ...((it.planning && it.planning.standardsList) || [])])),
      txCodes: L.txCodes || [], txNormalized: L.txNormalized || [],
      objectives: (L.objectives || []).slice(), missionQuestion: L.missionQuestion || null, keyConcepts: L.keyConcepts || [],
      info: L.info || [], needs: L.needs || [], virtue: L.virtue || null, planning: it.planning || null,
      videos: it.videos ? JSON.parse(JSON.stringify(it.videos)) : null, features: L.features || null, counts: L.counts || null,
      assignment: it.assignment ? { ...it.assignment } : null,
      quiz: it.quiz ? { ...it.quiz, questions: (it.quiz.questions || []).map(q => ({ ...q, include: true })) } : null,
      pageRef: it.pageRef || null, notes: '', html: '', dueOffsetDays: null, enrich: [],
    };
  };

  // A fresh placeholder item of a given kind (teacher fills it in)
  OCS.newItem = function (kind, patch = {}) {
    const meta = OCS.kindMeta(kind);
    const base = { id: OCS.uid('i_'), kind, title: patch.title || meta.label, muted: false, placeholder: true, source: null, code: null, week: null, unit: null,
      pageUrl: null, iframeHeight: 1200, extraHtml: null, flCodes: [], txCodes: [], objectives: [], missionQuestion: null, keyConcepts: [], info: [], needs: [], virtue: null, planning: null,
      videos: null, features: null, counts: null, assignment: (meta.canvas === 'Assignment') ? { submissionTypes: meta.defaultSubmission || 'online_text_entry', points: null, gradingType: 'points' } : null,
      quiz: kind === 'quiz' ? { title: patch.title || 'New quiz', description: '', quizType: 'assignment', points: null, allowedAttempts: 1, scoringPolicy: 'keep_highest', questions: [] } : null,
      pageRef: null, notes: '', html: '', dueOffsetDays: null, enrich: [], library: null };
    return Object.assign(base, patch);
  };

  /* ---------------- mutation with undo ---------------- */
  function snapshot() { state.undo.push(JSON.stringify(state.plan)); if (state.undo.length > 60) state.undo.shift(); state.redo.length = 0; }
  function touched(evt, payload) { state.plan.updated = new Date().toISOString(); state.dirty = true; scheduleSave(); OCS.emit(evt || 'plan:changed', payload); OCS.emit('plan:any'); }
  OCS.mutate = function (fn, evt, payload) { if (!state.plan) return; snapshot(); fn(state.plan); touched(evt, payload); };
  OCS.undo = function () { if (!state.undo.length) return false; state.redo.push(JSON.stringify(state.plan)); state.plan = JSON.parse(state.undo.pop()); touched('plan:changed'); return true; };
  OCS.redo = function () { if (!state.redo.length) return false; state.undo.push(JSON.stringify(state.plan)); state.plan = JSON.parse(state.redo.pop()); touched('plan:changed'); return true; };

  function setPlan(p) { state.plan = p; state.undo.length = 0; state.redo.length = 0; state.selectedItemId = null; state.dirty = true; scheduleSave(); OCS.emit('plan:loaded', p); OCS.emit('plan:any'); }
  OCS.setPlan = setPlan;

  OCS.findItem = function (id) { if (!state.plan) return null; for (const m of state.plan.modules) for (const it of m.items) if (it.id === id) return { item: it, module: m }; return null; };
  OCS.findModule = function (id) { return state.plan ? state.plan.modules.find(m => m.id === id) : null; };
  OCS.select = function (id) { state.selectedItemId = id; OCS.emit('select', id); };

  OCS.addModule = function (title, template) {
    let created = null;
    OCS.mutate(p => {
      created = { id: OCS.uid('m_'), sourceId: null, title: title || (template ? template.name : 'New module'), muted: false, collapsed: false, weekStart: null, templateId: template ? template.id : null, items: [] };
      if (template) for (const s of template.slots) created.items.push(OCS.newItem(s.type, { title: s.label.replace('{n}', String(p.modules.length + 1)).replace('{u}', String(p.modules.length + 1).padStart(2, '0')), notes: s.note || '', required: !!s.required }));
      p.modules.push(created);
    }, 'module:added');
    return created;
  };
  OCS.removeModule = function (id) { OCS.mutate(p => { p.modules = p.modules.filter(m => m.id !== id); }, 'module:removed'); };
  OCS.updateModule = function (id, patch) { OCS.mutate(p => { const m = p.modules.find(x => x.id === id); if (m) Object.assign(m, patch); }, 'module:changed', id); };
  OCS.moveModule = function (id, toIndex) { OCS.mutate(p => { const i = p.modules.findIndex(m => m.id === id); if (i < 0) return; const [m] = p.modules.splice(i, 1); p.modules.splice(Math.max(0, Math.min(toIndex, p.modules.length)), 0, m); }, 'module:moved'); };
  OCS.duplicateModule = function (id) { OCS.mutate(p => { const i = p.modules.findIndex(m => m.id === id); if (i < 0) return; const c = JSON.parse(JSON.stringify(p.modules[i])); c.id = OCS.uid('m_'); c.title += ' (copy)'; c.items.forEach(it => it.id = OCS.uid('i_')); p.modules.splice(i + 1, 0, c); }, 'module:added'); };

  OCS.addItem = function (moduleId, item, index) { OCS.mutate(p => { const m = p.modules.find(x => x.id === moduleId); if (!m) return; if (index == null || index > m.items.length) m.items.push(item); else m.items.splice(index, 0, item); }, 'item:added', item.id); state.selectedItemId = item.id; OCS.emit('select', item.id); return item; };
  OCS.removeItem = function (id) { OCS.mutate(p => { for (const m of p.modules) m.items = m.items.filter(i => i.id !== id); }, 'item:removed', id); if (state.selectedItemId === id) OCS.select(null); };
  OCS.updateItem = function (id, patch) { OCS.mutate(p => { for (const m of p.modules) for (const it of m.items) if (it.id === id) Object.assign(it, patch); }, 'item:changed', id); };
  OCS.toggleMute = function (id) { OCS.mutate(p => { for (const m of p.modules) for (const it of m.items) if (it.id === id) it.muted = !it.muted; }, 'item:changed', id); };
  OCS.duplicateItem = function (id) { OCS.mutate(p => { for (const m of p.modules) { const i = m.items.findIndex(x => x.id === id); if (i >= 0) { const c = JSON.parse(JSON.stringify(m.items[i])); c.id = OCS.uid('i_'); c.title += ' (copy)'; m.items.splice(i + 1, 0, c); return; } } }, 'item:added'); };
  OCS.moveItem = function (id, toModuleId, toIndex) {
    OCS.mutate(p => {
      let moved = null;
      for (const m of p.modules) { const i = m.items.findIndex(x => x.id === id); if (i >= 0) { moved = m.items.splice(i, 1)[0]; if (m.id === toModuleId && i < toIndex) toIndex--; break; } }
      const tm = p.modules.find(m => m.id === toModuleId); if (!moved || !tm) return;
      tm.items.splice(Math.max(0, Math.min(toIndex, tm.items.length)), 0, moved);
    }, 'item:moved', id);
  };

  /* ---------------- standards cart & coverage ---------------- */
  OCS.toggleTarget = function (code) { OCS.mutate(p => { const i = p.standards.targets.indexOf(code); if (i >= 0) p.standards.targets.splice(i, 1); else p.standards.targets.push(code); }, 'targets:changed'); };
  OCS.setTargets = function (codes) { OCS.mutate(p => { p.standards.targets = Array.from(new Set(codes)); }, 'targets:changed'); };
  OCS.coverage = function () {
    const p = state.plan; if (!p) return { targets: [], covered: [], uncovered: [], byCode: {}, pct: 0, extra: [] };
    const byCode = {};
    for (const m of p.modules) { if (m.muted) continue; for (const it of m.items) { if (it.muted) continue; for (const c of [...(it.flCodes || []), ...(it.txNormalized || [])]) (byCode[c] = byCode[c] || []).push({ item: it, module: m }); } }
    const targets = p.standards.targets || [];
    const covered = targets.filter(c => byCode[c]); const uncovered = targets.filter(c => !byCode[c]);
    const extra = Object.keys(byCode).filter(c => !targets.includes(c));
    return { targets, covered, uncovered, byCode, extra, pct: targets.length ? Math.round(covered.length / targets.length * 100) : 0 };
  };

  /* ---------------- persistence ---------------- */
  let saveTimer = null;
  function scheduleSave() { clearTimeout(saveTimer); saveTimer = setTimeout(OCS.save, 500); }
  OCS.save = function () {
    if (!state.plan) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(state.plan)); state.dirty = false; state.lastSaved = new Date(); OCS.emit('saved', state.lastSaved); rememberRecent(state.plan); }
    catch (e) { OCS.emit('save:failed', e); }
  };
  OCS.loadSaved = function () { try { const s = localStorage.getItem(LS_KEY); if (!s) return null; const p = JSON.parse(s); if (p && p.schema === 'ocs-plan/1') { state.plan = p; state.dirty = false; OCS.emit('plan:loaded', p); OCS.emit('plan:any'); return p; } } catch (e) {} return null; };
  function rememberRecent(p) { try { const r = JSON.parse(localStorage.getItem(LS_RECENT) || '[]').filter(x => x.id !== p.id); r.unshift({ id: p.id, name: p.name, updated: p.updated, course: p.course.title }); localStorage.setItem(LS_RECENT, JSON.stringify(r.slice(0, 6))); } catch (e) {} }
  OCS.recent = function () { try { return JSON.parse(localStorage.getItem(LS_RECENT) || '[]'); } catch (e) { return []; } };
  OCS.clearPlan = function () { state.plan = null; state.selectedItemId = null; try { localStorage.removeItem(LS_KEY); } catch (e) {} OCS.emit('plan:loaded', null); OCS.emit('plan:any'); };

  OCS.exportPlanJSON = function () { return JSON.stringify(state.plan, null, 1); };
  OCS.importPlanJSON = function (text) {
    const p = JSON.parse(text);
    if (!p || p.schema !== 'ocs-plan/1' || !Array.isArray(p.modules)) throw new Error('This file is not an Optima Curriculum Studio plan.');
    setPlan(p); return p;
  };

  /* ---------------- summaries ---------------- */
  OCS.planSummary = function () {
    const p = state.plan; if (!p) return null;
    const s = { modules: 0, items: 0, muted: 0, placeholders: 0, lessons: 0, quizzes: 0, pages: 0, discussions: 0, videosReady: 0, videosTotal: 0, byKind: {} };
    for (const m of p.modules) { if (m.muted) continue; s.modules++; for (const it of m.items) { if (it.muted) { s.muted++; continue; } s.items++; s.byKind[it.kind] = (s.byKind[it.kind] || 0) + 1; if (it.placeholder && !it.pageUrl && !it.html && !it.library) s.placeholders++; if (it.kind === 'lesson') s.lessons++; if (it.kind === 'quiz') s.quizzes++; if (it.kind === 'page') s.pages++; if (it.kind === 'discussion') s.discussions++; if (it.videos) { s.videosReady += it.videos.ready || 0; s.videosTotal += it.videos.total || 0; } } }
    return s;
  };
})(window.OCS);
