/* =====================================================================
   Optima Curriculum Studio - Step 5: Enrich from the media libraries
   Cross-references the Art, Music, and ELA Reference Libraries against a
   lesson's topic (title, objectives, key concepts) with plain keyword
   matching. No AI calls; the libraries already carry the tags.
   ===================================================================== */
(function (OCS) {
  const ui = OCS.ui, esc = OCS.esc;
  const local = { itemId: null, keys: [], query: '', tab: 'art' };

  ui.views.enrich = function (stage) {
    const p = OCS.state.plan;
    const lessons = p.modules.flatMap(m => m.items.filter(i => !i.muted && i.kind !== 'header' && i.kind !== 'quiz').map(i => ({ i, m })));
    if (!local.itemId || !lessons.some(l => l.i.id === local.itemId)) local.itemId = (OCS.state.selectedItemId && lessons.some(l => l.i.id === OCS.state.selectedItemId)) ? OCS.state.selectedItemId : (lessons[0] ? lessons[0].i.id : null);
    stage.innerHTML = ui.stageHead('Step 5', 'Enrich from the libraries', 'Pick a lesson and the studio pulls matching artworks, listening videos, and books from the three Optima reference libraries, the same cross-referencing Louis Armstrong and Langston Hughes already do in the music library. Attach a card to the lesson page, or add it as its own item.',
      `<a class="btn" href="${esc(OCS.data.catalog.libraries.art && OCS.data.catalog.libraries.art.page || '#')}" target="_blank" rel="noopener">🖼️ Art library ↗</a><a class="btn" href="${esc(OCS.data.catalog.libraries.music && OCS.data.catalog.libraries.music.page || '#')}" target="_blank" rel="noopener">🎵 Music library ↗</a><a class="btn" href="${esc(OCS.data.catalog.libraries.literature && OCS.data.catalog.libraries.literature.page || '#')}" target="_blank" rel="noopener">📚 ELA library ↗</a>`)
      + `<div class="lib-layout"><div class="card pad" id="en-left"></div><div id="en-right"></div></div>`;
    renderLeft(lessons); renderRight();
    if (!OCS.data.libraries.art && !OCS.data.libraries.music) OCS.loadLibraries().then(() => { renderRight(); });
  };

  function currentItem() { const f = OCS.findItem(local.itemId); return f ? f.item : null; }
  function renderLeft(lessons) {
    const left = ui.q('#en-left'); if (!left) return; const it = currentItem();
    if (it && !local.keysFor || local.keysFor !== it?.id) { local.keys = it ? OCS.lessonKeywords(it).slice(0, 14) : []; local.keysFor = it ? it.id : null; }
    left.innerHTML = `<div class="field"><label>Lesson to enrich</label><select id="en-item">${lessons.map(l => `<option value="${l.i.id}" ${l.i.id === local.itemId ? 'selected' : ''}>${esc(l.m.title.slice(0, 18))} › ${esc(l.i.title)}</option>`).join('') || '<option>No lessons in plan</option>'}</select></div>
${it ? `<div style="margin:12px 0 6px;" class="small"><b>${esc(it.title)}</b>${it.missionQuestion ? `<div class="muted" style="font-style:italic;">${esc(it.missionQuestion)}</div>` : ''}</div>
<div class="field"><label>Topic words (click to remove, type to add)</label><div class="lib-tab" id="en-keys">${local.keys.map(k => `<span class="chip target" data-k="${esc(k)}">${esc(k)} <span class="x">✕</span></span>`).join('') || '<span class="tiny muted">No keywords detected. Type one below.</span>'}</div><div class="search" style="margin-top:6px;">＋ <input id="en-addkey" placeholder="Add a word and press Enter"></div></div>
<div class="field" style="margin-top:10px;"><label>Or search the libraries directly</label><div class="search">🔎 <input id="en-q" value="${esc(local.query)}" placeholder="explorer, map, jazz, fable…"></div></div>
<div class="tiny muted" style="margin-top:10px;">Matches use the libraries' own tags (artist, movement, era, genre, concept) plus titles. A ★ means the record is course-approved and has an image or playable link.</div>
${(it.enrich || []).length ? `<div style="margin-top:12px;"><b class="small">Attached to this lesson</b>${it.enrich.map((e, i) => `<div class="row" style="display:flex;justify-content:space-between;gap:6px;font-size:12.5px;padding:4px 0;border-bottom:1px solid var(--line);"><span>${e.kind === 'art' ? '🖼️' : e.kind === 'music' ? '🎵' : '📚'} ${esc(e.title)}</span><button class="btn xs" data-detach="${i}">✕</button></div>`).join('')}</div>` : ''}` : ''}`;
    ui.q('#en-item', left).onchange = (e) => { local.itemId = e.target.value; OCS.select(local.itemId); local.keysFor = null; ui.render(); };
    ui.qa('[data-k]', left).forEach(c => c.onclick = () => { local.keys = local.keys.filter(k => k !== c.dataset.k); ui.render(); });
    const ak = ui.q('#en-addkey', left); if (ak) ak.addEventListener('keydown', (e) => { if (e.key === 'Enter' && ak.value.trim()) { local.keys.push(ak.value.trim().toLowerCase()); ak.value = ''; renderLeft(lessons); renderRight(); } });
    const q = ui.q('#en-q', left); if (q) q.oninput = () => { local.query = q.value; renderRight(); };
    ui.qa('[data-detach]', left).forEach(b => b.onclick = () => { const cur = currentItem(); OCS.updateItem(cur.id, { enrich: cur.enrich.filter((_, i) => i !== Number(b.dataset.detach)) }); ui.render(); });
  }

  function renderRight() {
    const right = ui.q('#en-right'); if (!right) return; const it = currentItem(); const p = OCS.state.plan;
    const libs = OCS.data.libraries;
    if (!libs.art && !libs.music && !libs.literature) { right.innerHTML = `<div class="notice info">⏳ Loading the libraries…</div>`; return; }
    const keys = local.query.trim() ? OCS.keywords(local.query).concat(local.query.trim().toLowerCase().split(/\s+/)) : local.keys;
    const res = keys.length ? OCS.matchLibraries(keys, { grade: p.course.grade, subject: p.course.subject, limit: 18, minHits: local.query.trim() ? 1 : 2 }) : { art: [], music: [], literature: [] };
    const counts = { art: res.art.length, music: res.music.length, literature: res.literature.length };
    right.innerHTML = `<div class="seg" style="margin-bottom:12px;"><button class="${local.tab === 'art' ? 'on' : ''}" data-tab="art">🖼️ Art (${counts.art})</button><button class="${local.tab === 'music' ? 'on' : ''}" data-tab="music">🎵 Music (${counts.music})</button><button class="${local.tab === 'literature' ? 'on' : ''}" data-tab="literature">📚 Books (${counts.literature})</button></div>
${!keys.length ? `<div class="notice info">Pick a lesson or type a search to see matches.</div>` : ''}
<div class="lib-grid">${(res[local.tab] || []).map((r, i) => card(r, i)).join('') || (keys.length ? `<div class="notice info" style="grid-column:1/-1;">No ${local.tab} matches for these words. Try fewer or broader words, or type a search on the left (a typed search only needs one matching word).</div>` : '')}</div>`;
    ui.qa('[data-tab]', right).forEach(b => b.onclick = () => { local.tab = b.dataset.tab; renderRight(); });
    ui.qa('[data-attach]', right).forEach(b => b.onclick = () => attach(res[local.tab][b.dataset.attach], 'attach'));
    ui.qa('[data-own]', right).forEach(b => b.onclick = () => attach(res[local.tab][b.dataset.own], 'own'));
    ui.qa('[data-play]', right).forEach(b => b.onclick = () => { const v = res.music[b.dataset.play].v; ui.modal({ title: v.title, wide: true, footer: `<button class="btn primary" data-close>Done</button>`, body: `<div style="position:relative;padding-top:56.25%;"><iframe src="${esc(v.embed)}" style="position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:10px;" allowfullscreen></iframe></div>` }); });
  }
  function card(r, i) {
    const why = r.words && r.words.length ? `<span class="tiny" style="color:var(--teal);font-weight:700;">matched: ${esc(r.words.slice(0, 4).join(', '))}</span>` : '';
    if (r.w) { const w = r.w; const star = w.disposition === 'publish' ? '★ ' : '';
      return `<div class="card lib-card"><div class="thumb" style="${w.image ? `background-image:url('${esc(w.image)}')` : ''}">${w.image ? '' : '🖼️'}</div><div class="lb"><b>${star}${esc(w.title)}</b><span class="small muted">${esc(w.creator || 'Unknown')}${w.date ? ' · ' + esc(w.date) : ''}</span><div class="tags">${(w.tags || []).slice(0, 4).map(t => `<span class="chip">${esc(t.l)}</span>`).join('')}</div>${why}<span class="tiny muted">${esc(w.disposition_label || ({ publish: 'Image available (CC0)', 'link-only': 'View on JSTOR', 're-source': 'Public domain, no free copy yet', research: 'Rights check pending' })[w.disposition] || '')}</span></div><div class="lf">${w.jstor ? `<a class="btn xs" href="${esc(w.jstor)}" target="_blank" rel="noopener">JSTOR ↗</a>` : '<span></span>'}<span class="btn-row" style="flex-wrap:nowrap;"><button class="btn xs" data-attach="${i}" title="Show as a card inside the lesson page">Attach</button><button class="btn xs primary" data-own="${i}" title="Add as its own page after the lesson">＋ Page</button></span></div></div>`; }
    if (r.v) { const v = r.v; const star = v.state === 'ok' ? '★ ' : '';
      return `<div class="card lib-card"><div class="thumb" style="${v.thumb ? `background-image:url('${esc(v.thumb)}')` : ''}">${v.thumb ? '' : '🎵'}</div><div class="lb"><b>${star}${esc(v.title)}</b><span class="small muted">${esc(v.channel || '')}</span><div class="tags">${(v.tags || []).slice(0, 4).map(t => `<span class="chip">${esc(t.l)}</span>`).join('')}</div>${v.crossRefs && Object.keys(v.crossRefs).length ? `<span class="tiny" style="color:var(--purple);font-weight:700;">Also in: ${esc(Object.keys(v.crossRefs).join(', '))}</span>` : ''}${v.disposition === 'dead-link' ? '<span class="tiny" style="color:var(--danger)">Link no longer works</span>' : ''}</div><div class="lf">${v.embed ? `<button class="btn xs" data-play="${i}">▶ Play</button>` : '<span></span>'}<span class="btn-row" style="flex-wrap:nowrap;"><button class="btn xs" data-attach="${i}">Attach</button><button class="btn xs primary" data-own="${i}">＋ Page</button></span></div></div>`; }
    if (r.t) { const t = r.t; const free = t.free && t.free.state !== 'none';
      return `<div class="card lib-card"><div class="thumb" style="background:linear-gradient(135deg,#FFF3DC,#F5E6C8);">📚</div><div class="lb"><b>${t.taught ? '★ ' : ''}${esc(t.title)}</b><span class="small muted">${esc(t.author || '')}${t.year ? ' · ' + t.year : ''} · Grade ${esc(t.grade)}</span><div class="tags"><span class="chip">${esc(t.shelf || '')}</span>${free ? `<span class="chip ok">${t.free.state === 'identical' ? 'Free' : 'Free (similar)'}</span>` : '<span class="chip warn">Buy</span>'}${t.taught ? '<span class="chip">Taught</span>' : ''}</div></div><div class="lf">${free && t.free.url ? `<a class="btn xs" href="${esc(t.free.url)}" target="_blank" rel="noopener">Read free ↗</a>` : (t.buyUrl ? `<a class="btn xs" href="${esc(t.buyUrl)}" target="_blank" rel="noopener">Book list ↗</a>` : '<span></span>')}<span class="btn-row" style="flex-wrap:nowrap;"><button class="btn xs" data-attach="${i}">Attach</button><button class="btn xs primary" data-own="${i}">＋ Page</button></span></div></div>`; }
    return '';
  }
  function toLibrary(r) {
    if (r.w) return { kind: 'art', id: r.w.id, title: r.w.title, creator: r.w.creator, date: r.w.date, material: r.w.material, image: r.w.image || null, link: r.w.jstor || null, licence: r.w.licence, tags: (r.w.tags || []).map(t => t.l) };
    if (r.v) return { kind: 'music', id: r.v.id, title: r.v.title, channel: r.v.channel, embed: r.v.embed, link: r.v.url, tags: (r.v.tags || []).map(t => t.l) };
    if (r.t) return { kind: 'book', id: r.t.id, title: r.t.title, author: r.t.author, year: r.t.year, shelf: r.t.shelf, freeUrl: r.t.free && r.t.free.url, freeSource: r.t.free && r.t.free.source, buyUrl: r.t.buyUrl };
  }
  function attach(r, mode) {
    const it = currentItem(); const L = toLibrary(r); if (!L) return;
    if (mode === 'attach') { if (!it) { ui.toast('Pick a lesson first.', 'bad'); return; } OCS.updateItem(it.id, { enrich: [...(it.enrich || []), L] }); ui.toast(`Attached "${L.title}" to ${it.title}`, 'good'); ui.render(); return; }
    const kind = L.kind === 'art' ? 'library-art' : L.kind === 'music' ? 'library-music' : 'library-book';
    const item = OCS.newItem(kind, { title: (L.kind === 'art' ? 'Look closely: ' : L.kind === 'music' ? 'Listen: ' : 'Read: ') + L.title, library: L, placeholder: false });
    if (it) { const f = OCS.findItem(it.id); const idx = f.module.items.findIndex(x => x.id === it.id); OCS.addItem(f.module.id, item, idx + 1); ui.toast(`Added a ${L.kind} page after "${it.title}"`, 'good'); }
    else ui.chooseModule(null, (modId) => { OCS.addItem(modId, item); ui.toast('Added', 'good'); });
    ui.render();
  }
})(window.OCS);
