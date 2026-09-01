/* =====================================================================
   Optima Curriculum Studio - data layer
   Loads the catalog built by tools/build-catalog.pl, the standards bundles
   from Jessica's standards browser, the three media libraries, and the
   hand-authored templates / Bloom's / skins / calendar files.
   Strategy: local snapshot first (fast, always works on GitHub Pages),
   then a quiet live refresh for things that change (video manifests,
   standards bundles) when the network allows. No AI calls anywhere.
   ===================================================================== */
window.OCS = window.OCS || {};
(function (OCS) {
  const data = {
    catalog: null, courses: {}, templates: null, blooms: null, skins: null, calendar: null,
    libraries: { art: null, music: null, literature: null },
    standards: { manifest: null, bundles: {} },
    live: { manifests: {}, bundlesFrom: {} },
    ready: false,
  };
  OCS.data = data;

  const SUBJECT_TO_BUNDLE = { 'ela': 'English Language Arts', 'math': 'Mathematics', 'social-studies': 'Social Studies', 'science': 'Science', 'art': 'Fine Arts', 'music': 'Fine Arts' };
  const BUNDLE_FILE = (subject, grade) => `${SUBJECT_TO_BUNDLE[subject] || subject}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '__' + String(grade).toLowerCase() + '.json';

  async function getJSON(url, { timeout = 8000 } = {}) {
    const ctrl = ('AbortController' in window) ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), timeout) : null;
    try {
      const r = await fetch(url, { signal: ctrl ? ctrl.signal : undefined, cache: 'no-cache' });
      if (!r.ok) throw new Error(`${r.status} ${url}`);
      return await r.json();
    } finally { if (t) clearTimeout(t); }
  }

  OCS.loadStatic = async function () {
    const [catalog, templates, blooms, skins, calendar] = await Promise.all([
      getJSON('data/catalog.json'), getJSON('data/templates.json'), getJSON('data/blooms.json'), getJSON('data/skins.json'), getJSON('data/calendar.json'),
    ]);
    data.catalog = catalog; data.templates = templates; data.blooms = blooms; data.skins = skins; data.calendar = calendar;
    data.ready = true;
    return data;
  };

  OCS.loadCourse = async function (id) {
    if (data.courses[id]) return data.courses[id];
    const entry = (data.catalog.courses || []).find(c => c.id === id);
    if (!entry) throw new Error('Unknown course ' + id);
    const course = await getJSON(entry.file);
    data.courses[id] = course;
    // quiet live refresh of the video manifest; never blocks the UI
    OCS.refreshVideoManifest(course).catch(() => {});
    return course;
  };

  OCS.loadAllCourses = async function () {
    await Promise.all((data.catalog.courses || []).map(c => OCS.loadCourse(c.id).catch(() => null)));
    return data.courses;
  };

  /* ---- live video manifest refresh: marks slots ready/pending from the repo's video-manifest.json ---- */
  OCS.refreshVideoManifest = async function (course) {
    if (!course || !course.videoManifestUrl) return;
    let raw;
    try { raw = await getJSON(course.videoManifestUrl, { timeout: 6000 }); } catch (e) { return; }
    const map = {};
    if (raw && raw.videos && typeof raw.videos === 'object') {
      for (const [k, v] of Object.entries(raw.videos)) if (v && typeof v === 'object') map[k] = { status: v.status || 'pending', embedSrc: srcOf(v.embed), file: v.file };
    } else if (raw && typeof raw === 'object') {
      for (const [k, v] of Object.entries(raw)) if (!k.startsWith('_') && v && typeof v === 'object') map[k] = { status: v.status || 'pending', embedSrc: srcOf(v.embed) };
    }
    data.live.manifests[course.id] = { at: new Date().toISOString(), map };
    let changed = 0;
    for (const m of course.modules || []) for (const it of m.items || []) {
      if (!it.videos) continue;
      let ready = 0;
      for (const s of it.videos.slots || []) { const v = map[s.slot]; if (v) { if (s.status !== v.status) changed++; s.status = v.status; if (v.embedSrc) s.embedSrc = v.embedSrc; } if (s.status === 'ready') ready++; }
      it.videos.ready = ready;
    }
    if (changed && OCS.emit) OCS.emit('videos:refreshed', { courseId: course.id, changed });
  };
  function srcOf(embed) { if (!embed) return null; const m = String(embed).match(/src=["']([^"']+)["']/); return m ? m[1] : null; }

  /* ---- standards bundles (TX / FL / MS / PR) ---- */
  OCS.loadStandardsManifest = async function () {
    if (data.standards.manifest) return data.standards.manifest;
    try { data.standards.manifest = await getJSON(data.catalog.standards.manifest.live, { timeout: 5000 }); data.live.bundlesFrom.manifest = 'live'; }
    catch (e) { data.standards.manifest = await getJSON(data.catalog.standards.manifest.file); data.live.bundlesFrom.manifest = 'snapshot'; }
    return data.standards.manifest;
  };
  OCS.loadBundle = async function (subject, grade) {
    const file = BUNDLE_FILE(subject, grade);
    if (data.standards.bundles[file]) return data.standards.bundles[file];
    let bundle = null, from = 'live';
    try { bundle = await getJSON(data.catalog.standards.bundles.liveBase + file, { timeout: 6000 }); }
    catch (e) { from = 'snapshot'; try { bundle = await getJSON(data.catalog.standards.bundles.localBase + file); } catch (e2) { bundle = null; } }
    if (bundle) { bundle._from = from; data.standards.bundles[file] = bundle; indexBundle(bundle); }
    return bundle;
  };
  // Bundle rows are compact arrays: [courseIndex, code, text, parentCode, strand, extras{c:[clarifications], rel}]
  const stdIndex = {};
  function indexBundle(b) {
    const courses = b.courses || [];
    b.rows = (b.standards || []).map(r => {
      const c = courses[r[0]] || {};
      const row = { j: c.j, courseTitle: c.title, courseRef: c.ref, courseUrl: c.url, code: r[1], text: r[2] || '', parent: r[3], strand: r[4], extras: r[5] || null, subject: b.subject, grade: b.grade };
      stdIndex[row.code] = stdIndex[row.code] || row;
      return row;
    });
  }
  OCS.lookupStandard = function (code) { return stdIndex[code] || null; };
  OCS.standardsIndex = stdIndex;
  OCS.jurisdictionOf = function (code) {
    if (!code) return null; const r = stdIndex[code]; if (r) return r.j;
    if (/^(ELA|MA|SS|SC|HE|PE|MU|VA|DA|TH|CS|WL|MTR)\./.test(code)) return 'FL';
    if (/^\d{3}\.\d+/.test(code)) return 'TX';
    return null;
  };
  OCS.strandLabel = function (code, subject) {
    const map = (data.blooms && data.blooms.strands && data.blooms.strands[subject]) || {};
    const m = String(code).match(/^[A-Z]+\.(?:K12|K|\d+)\.([A-Z]+)\./); if (m && map[m[1]]) return map[m[1]];
    if (/^MTR\./.test(code)) return map.MTR || 'Mathematical Thinking and Reasoning';
    return null;
  };

  /* ---- libraries ---- */
  OCS.loadLibraries = async function () {
    const libs = data.catalog.libraries || {};
    await Promise.all(Object.keys(libs).map(async k => {
      if (data.libraries[k]) return;
      try { data.libraries[k] = await getJSON(libs[k].file); } catch (e) { data.libraries[k] = null; }
    }));
    return data.libraries;
  };

  /* ---- cross-course lesson index: which catalog lessons cover which FL code ---- */
  OCS.lessonsByStandard = function () {
    const idx = {};
    for (const course of Object.values(data.courses)) for (const m of course.modules || []) for (const it of m.items || []) {
      const codes = new Set([...(it.lesson?.flCodes || []), ...((it.planning && it.planning.standardsList) || [])]);
      for (const c of codes) { (idx[c] = idx[c] || []).push({ courseId: course.id, courseTitle: course.title, grade: course.grade, subject: course.subject, moduleTitle: m.title, item: it }); }
    }
    return idx;
  };

  /* ---- keyword matching for the libraries ---- */
  // words that appear in nearly every Optima lesson and therefore say nothing about its topic
  const STOP = new Set(('the a an and or of to in on for with from by as at is are was were be this that these those it its into about over under how what why when where which who your you we our their they them his her he she i my me can will do does did not no yes lesson lessons unit week grade students student today use using used one two three four five six new own all also then than more most very just like get make made '
    + 'history historians historian study studies connection connections image images enter scene notebook evidence source sources chapter chapters reading focus question questions part parts review writing response responses grammar nouns verbs syllables spelling fluency assignment activity activities check learn explore mission message inside canvas file files team teacher teachers describe identify explain write read complete compare using details detail evidence-based text texts word words sentence sentences page pages').split(' '));
  OCS.keywords = function (text) {
    return Array.from(new Set(String(text || '').toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).map(w => w.replace(/^'|'$/g, '')).filter(w => w.length > 3 && !STOP.has(w))));
  };
  OCS.lessonKeywords = function (item) {
    const L = item.lesson || {};
    const parts = [item.title, L.pageTitle, ...(L.objectives || []), ...(L.keyConcepts || []), L.missionQuestion, ...(L.info || []).map(c => c.value), item.planning && item.planning.crossCurricular, item.planning && item.planning.routine];
    return OCS.keywords(parts.filter(Boolean).join(' '));
  };
  // returns {s: score, hits: distinct keywords found, words: which ones}
  function scoreMatch(keys, hay) {
    let s = 0; const words = []; const H = ' ' + hay.toLowerCase().replace(/[^a-z0-9'\s-]/g, ' ') + ' ';
    for (const k of keys) { if (H.includes(' ' + k + ' ')) { s += 3; words.push(k); } else if (k.length > 5 && H.includes(k)) { s += 1.5; words.push(k); } }
    return { s, hits: words.length, words };
  }
  // minHits: 2 when matching from a lesson's own keyword bag (tighter), 1 for a typed search
  OCS.matchLibraries = function (keys, { grade, subject, limit = 12, minHits = 2 } = {}) {
    const out = { art: [], music: [], literature: [] };
    const art = data.libraries.art, mu = data.libraries.music, lit = data.libraries.literature;
    const ok = (m) => m.hits >= minHits || m.s >= 6;
    if (art) for (const w of art.works || []) {
      const hay = [w.title, w.creator, w.date, ...(w.units || []), ...(w.tags || []).map(t => t.l + ' ' + (t.d || ''))].join(' ');
      const m = scoreMatch(keys, hay); if (!ok(m)) continue; let s = m.s; if (w.disposition === 'publish') s += 1.5; if (w.image) s += .5;
      out.art.push({ s, w, words: m.words });
    }
    if (mu) for (const v of mu.videos || []) {
      const hay = [v.title, v.channel, ...(v.tags || []).map(t => t.l + ' ' + (t.d || '')), ...(v.lessons || []).map(l => l.page)].join(' ');
      const m = scoreMatch(keys, hay); if (!ok(m)) continue; let s = m.s; if (v.state === 'ok') s += 1; if (v.disposition === 'dead-link') s -= 5;
      out.music.push({ s, v, words: m.words });
    }
    if (lit) for (const t of lit.titles || []) {
      const hay = [t.title, t.author, t.shelf, t.listedAs].join(' ');
      const m = scoreMatch(keys, hay); if (!ok(m)) continue; let s = m.s; if (grade && String(t.grade) === String(grade)) s += 2; if (t.taught) s += 1;
      out.literature.push({ s, t, words: m.words });
    }
    for (const k of Object.keys(out)) out[k] = out[k].sort((a, b) => b.s - a.s).slice(0, limit);
    return out;
  };

  /* ---- Bloom's plug-and-chug helpers ---- */
  OCS.bloomLevelFor = function (text) {
    const b = data.blooms; if (!b) return null;
    let t = String(text || '').trim();
    for (const p of b.cleanup.stripPrefixes) { const re = new RegExp('^' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*', 'i'); t = t.replace(re, ''); }
    const first = (t.match(/^[A-Za-z-]+/) || [''])[0].toLowerCase();
    for (const lv of b.levels) if (lv.verbs.includes(first)) return { level: lv, verb: first, rest: t.slice(first.length).trim() };
    // look a little further in for a verb ("Students analyze ...", "Read and write ...")
    const words = t.toLowerCase().split(/\s+/).slice(0, 4);
    for (const w of words) for (const lv of b.levels) if (lv.verbs.includes(w)) { const i = t.toLowerCase().indexOf(w); return { level: lv, verb: w, rest: t.slice(i + w.length).trim() }; }
    return { level: null, verb: first, rest: t.slice(first.length).trim() };
  };
  function cleanObject(rest) {
    let r = String(rest || '').replace(/\s+/g, ' ').trim().replace(/[.;:]+$/, '');
    for (const [a, b] of (data.blooms?.cleanup.replacements || [])) r = r.replace(new RegExp(a, 'gi'), b);
    r = r.replace(/^(to|that)\s+/i, '');
    // trim clarification tails
    r = r.split(/\s+\((e\.g\.|for example|such as)/i)[0];
    if (r.length > 140) { const cut = r.slice(0, 140).lastIndexOf(' '); r = r.slice(0, cut > 60 ? cut : 140) + '…'; }
    return r.charAt(0).toLowerCase() + r.slice(1);
  }
  OCS.suggestICan = function (standardText, levelId) {
    const b = data.blooms; if (!b) return [];
    const m = OCS.bloomLevelFor(standardText); const obj = cleanObject(m.rest || standardText);
    const lv = levelId ? b.levels.find(l => l.id === levelId) : (m.level || b.levels[1]);
    const verb = (levelId && m.level && m.level.id !== levelId) ? lv.verbs[0] : (m.verb && lv.verbs.includes(m.verb) ? m.verb : lv.verbs[0]);
    const out = lv.icanFrames.map(f => f.replace('{verb}', verb).replace('{object}', obj));
    return Array.from(new Set(out.map(s => s.replace(/\s+/g, ' ').replace(/\.\.$/, '.'))));
  };
  OCS.suggestEQ = function (standardText, topic, levelId) {
    const b = data.blooms; if (!b) return [];
    const m = OCS.bloomLevelFor(standardText); const lv = levelId ? b.levels.find(l => l.id === levelId) : (m.level || b.levels[1]);
    const tp = topic || cleanObject(m.rest || standardText).replace(/…$/, '');
    return lv.eqFrames.map(f => f.replace('{topic}', tp));
  };
  OCS.ladder = function (standardText) {
    const b = data.blooms; if (!b) return [];
    return b.weeklyLadder.steps.map(id => ({ level: b.levels.find(l => l.id === id), text: OCS.suggestICan(standardText, id)[0] }));
  };

  /* ---- misc helpers shared by modules ---- */
  OCS.uid = function (prefix = 'g') { let s = ''; const hex = '0123456789abcdef'; for (let i = 0; i < 32; i++) s += hex[Math.floor(Math.random() * 16)]; return prefix + s; };
  OCS.esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  OCS.slug = function (s) { return String(s || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'item'; };
  OCS.fmtDate = function (iso) { if (!iso) return ''; const d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : '')); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); };
  OCS.kindMeta = function (kind) {
    const t = (data.templates && data.templates.componentTypes || []).find(c => c.id === kind);
    return t || { id: kind, label: kind, icon: '📄', canvas: 'Page', description: '' };
  };
  OCS.skinFor = function (id) { const s = data.skins; if (!s) return null; return (s.skins.find(x => x.id === id) || s.skins[0]); };
  OCS.applySkin = function (skin) {
    if (!skin) return; const r = document.documentElement.style;
    r.setProperty('--accent', skin.accent); r.setProperty('--accent-2', skin.accent2); r.setProperty('--tint', skin.tint); r.setProperty('--accent-grad', skin.gradient); r.setProperty('--navy', skin.primary);
  };
})(window.OCS);
