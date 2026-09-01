/* =====================================================================
   Optima Curriculum Studio - Step 6: Style (skins), teacher info, calendar
   ===================================================================== */
(function (OCS) {
  const ui = OCS.ui, esc = OCS.esc;

  ui.views.style = function (stage) {
    const p = OCS.state.plan; const S = OCS.data.skins; const cal = OCS.data.calendar;
    const evs = allEvents(p);
    stage.innerHTML = ui.stageHead('Step 6', 'Style, teacher, and calendar', 'Skins recolor every generated Canvas page with Optima branding intact. Teacher details show up on page headers. School dates feed the pacing strip and warn you when a module lands on an i-Ready day or holiday.')
      + `<div class="grid cols-2" style="align-items:start;">
  <div>
    <div class="card pad" style="margin-bottom:14px;"><h3 style="margin-bottom:10px;">Skin</h3><div class="grid auto" id="skins">${S.skins.map(s => `<div class="card skin-card ${p.skin.id === s.id ? 'on' : ''}" data-skin="${s.id}"><div class="sw" style="background:${s.gradient};color:${s.primary};">${s.emoji}</div><div class="sb"><b>${esc(s.name)}</b><span>${esc(s.mood)}</span></div></div>`).join('')}</div>
      <div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;"><button class="btn sm" id="bg-upload">🖼️ Upload a background image</button>${p.skin.customBg ? `<img src="${p.skin.customBg}" alt="custom background" style="height:34px;border-radius:6px;border:1px solid var(--line);"><button class="btn xs" id="bg-clear">Remove</button>` : '<span class="tiny muted">Optional. Stored inside your plan, never uploaded.</span>'}</div>
      <div class="tiny muted" style="margin-top:8px;">${esc(S.custom.specsPending)}</div></div>
    <div class="card pad"><h3 style="margin-bottom:10px;">Teacher and section</h3><div class="fields">
      <div class="field"><label>Name</label><input data-t="name" value="${esc(p.teacher.name || '')}" placeholder="Ms. Rivera"></div>
      <div class="field"><label>Email</label><input data-t="email" value="${esc(p.teacher.email || '')}" placeholder="name@optimaed.com"></div>
      <div class="field"><label>Section / period</label><input data-t="section" value="${esc(p.teacher.section || '')}" placeholder="4A · Live"></div>
      <div class="field"><label>Term</label><input data-t="term" value="${esc(p.teacher.term || '')}" placeholder="2026-27"></div></div>
      <div class="field" style="margin-top:10px;"><label>Course blurb (for a generated home page)</label><textarea data-notes placeholder="One or two sentences students see on the course home page.">${esc(p.notes || '')}</textarea></div></div>
  </div>
  <div>
    <div class="card" style="margin-bottom:14px;"><div style="padding:12px 16px;border-bottom:1px solid var(--line);"><h3>Live preview</h3><span class="tiny muted">How a lesson header will look in Canvas</span></div><div style="padding:14px;background:var(--paper);" id="skin-preview"></div></div>
    <div class="card pad"><h3 style="margin-bottom:6px;">School calendar <span class="chip ${cal.status === 'partial' ? 'warn' : 'ok'}">${esc(cal.schoolYear)} · ${esc(cal.status.replace('-', ' '))}</span></h3>
      <p class="small muted" style="margin:0 0 10px;">${esc(cal.source)}</p>
      <div class="fields"><div class="field"><label>Week 1 begins</label><input type="date" id="cal-week1" value="${esc(p.calendar.week1 || cal.week1 || '')}"><div class="help">${p.calendar.week1 ? 'Your override. Clear it to use the school calendar.' : esc(cal.week1Note || 'Turns module week numbers into real dates.')}</div></div>
        ${cal.quarters.map(q => `<div class="field"><label>${esc(q.label)} ends</label><input type="date" data-q="${q.id}" value="${esc((p.calendar.quarters && p.calendar.quarters[q.id]) || q.end || '')}"><div class="help">${q.start ? 'Starts ' + esc(OCS.fmtDate(q.start)) : ''}${ui.weekOf(q.end, p) ? ' · ends in week ' + ui.weekOf((p.calendar.quarters && p.calendar.quarters[q.id]) || q.end, p) : ''}</div></div>`).join('')}</div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin:14px 0 6px;"><b class="small">Key dates</b><span class="btn-row"><button class="btn xs" id="cal-add">＋ Add date</button><button class="btn xs" id="cal-import">📂 Import calendar JSON</button></span></div>
      <div class="cal-list">${evs.map((e, i) => `<div class="ev"><i style="background:${esc(colorFor(e.type))}"></i><span>${esc(OCS.fmtDate(e.date))}${e.end ? ' – ' + esc(OCS.fmtDate(e.end)) : ''}</span><span>${esc(e.label)} <span class="tiny muted">${esc(e.type)}</span></span>${e._mine ? `<button class="btn xs" data-ev-del="${e._idx}">✕</button>` : '<span class="tiny muted">school</span>'}</div>`).join('') || '<div class="tiny muted">No dates yet.</div>'}</div>
      ${pacingHtml(p)}
    </div>
  </div>
</div>`;
    ui.qa('[data-skin]', stage).forEach(c => c.onclick = () => { OCS.mutate(pl => { pl.skin.id = c.dataset.skin; }, 'plan:changed'); OCS.applySkin(OCS.skinFor(c.dataset.skin)); ui.render(); });
    ui.q('#bg-upload').onclick = () => ui.q('#file-bg').click();
    ui.q('#file-bg').onchange = (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; if (f.size > 1.5 * 1024 * 1024) { ui.toast('Please use an image under 1.5 MB.', 'bad'); return; } const r = new FileReader(); r.onload = () => { OCS.mutate(pl => { pl.skin.customBg = r.result; }, 'plan:changed'); ui.render(); }; r.readAsDataURL(f); };
    const bc = ui.q('#bg-clear'); if (bc) bc.onclick = () => { OCS.mutate(pl => { pl.skin.customBg = null; }, 'plan:changed'); ui.render(); };
    ui.qa('[data-t]', stage).forEach(i => i.onchange = () => { OCS.mutate(pl => { pl.teacher[i.dataset.t] = i.value.trim(); }, 'plan:changed'); preview(); });
    ui.q('[data-notes]').onchange = (e) => OCS.mutate(pl => { pl.notes = e.target.value.trim(); }, 'plan:changed');
    ui.q('#cal-week1').onchange = (e) => { OCS.mutate(pl => { pl.calendar.week1 = e.target.value || null; }, 'plan:changed'); ui.render(); };
    ui.qa('[data-q]', stage).forEach(i => i.onchange = () => OCS.mutate(pl => { pl.calendar.quarters = pl.calendar.quarters || {}; pl.calendar.quarters[i.dataset.q] = i.value || null; }, 'plan:changed'));
    ui.q('#cal-add').onclick = addEvent;
    ui.q('#cal-import').onclick = () => ui.q('#file-calendar').click();
    ui.q('#file-calendar').onchange = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const j = JSON.parse(await f.text()); const evs2 = Array.isArray(j.events) ? j.events : (Array.isArray(j) ? j : null); if (!evs2) throw new Error('No events array found.'); OCS.mutate(pl => { pl.calendar.overrides = [...(pl.calendar.overrides || []), ...evs2.filter(x => x.date).map(x => ({ date: x.date, end: x.end || null, type: x.type || 'other', label: x.label || x.title || 'Event' }))]; if (Array.isArray(j.quarters)) { pl.calendar.quarters = pl.calendar.quarters || {}; j.quarters.forEach(q => { if (q.id && q.end) pl.calendar.quarters[q.id] = q.end; }); } if (j.week1) pl.calendar.week1 = j.week1; }, 'plan:changed'); ui.toast(`Imported ${evs2.length} dates`, 'good'); ui.render(); } catch (err) { ui.toast('Import failed: ' + err.message, 'bad'); } };
    ui.qa('[data-ev-del]', stage).forEach(b => b.onclick = () => OCS.mutate(pl => { pl.calendar.overrides.splice(Number(b.dataset.evDel), 1); }, 'plan:changed') || ui.render());
    preview();
  };
  function preview() {
    const p = OCS.state.plan; const box = ui.q('#skin-preview'); if (!box) return;
    const sample = p.modules.flatMap(m => m.items).find(i => i.kind === 'lesson') || { title: 'Lesson 4.02.01: Physical Features of Florida', code: '4.02.01', kind: 'lesson', objectives: ['Identify Florida\'s major physical features on a map.'], flCodes: ['SS.4.G.1.1'] };
    box.innerHTML = `<div style="transform:scale(.92);transform-origin:top left;width:108%;">${OCS.gen.header(p, { title: sample.title, kicker: [p.course.grade ? 'Grade ' + p.course.grade : '', p.course.subjectLabel, sample.code ? 'Lesson ' + sample.code : ''].filter(Boolean).join(' • '), emoji: OCS.kindMeta(sample.kind).icon })}</div>`;
  }
  function colorFor(type) { const t = (OCS.data.calendar.eventTypes || []).find(x => x.id === type); return t ? t.color : '#55C8E8'; }
  function allEvents(p) {
    const base = (OCS.data.calendar.events || []).map(e => ({ ...e, _mine: false }));
    const mine = (p.calendar.overrides || []).map((e, i) => ({ ...e, _mine: true, _idx: i }));
    return [...base, ...mine].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }
  ui.allEvents = allEvents;
  function addEvent() {
    const types = OCS.data.calendar.eventTypes;
    const body = ui.el(`<div class="fields"><div class="field"><label>Date</label><input type="date" id="ev-date"></div><div class="field"><label>End (optional)</label><input type="date" id="ev-end"></div><div class="field"><label>Type</label><select id="ev-type">${types.map(t => `<option value="${t.id}">${esc(t.label)}</option>`).join('')}</select></div><div class="field" style="grid-column:1/-1;"><label>Label</label><input id="ev-label" placeholder="i-Ready diagnostic window"></div></div>`);
    const m = ui.modal({ title: 'Add a school date', body, footer: `<button class="btn" data-close>Cancel</button><button class="btn primary" data-ok>Add</button>` });
    ui.q('[data-ok]', m.el).onclick = () => { const d = ui.q('#ev-date', body).value; if (!d) { ui.toast('Pick a date.', 'bad'); return; } OCS.mutate(pl => { pl.calendar.overrides = pl.calendar.overrides || []; pl.calendar.overrides.push({ date: d, end: ui.q('#ev-end', body).value || null, type: ui.q('#ev-type', body).value, label: ui.q('#ev-label', body).value.trim() || 'Event' }); }, 'plan:changed'); m.close(); ui.render(); };
  }
  function weekOf(p, iso) { return ui.weekOf(iso, p); }
  // every week an event touches, so a break that spans two weeks marks both
  function weeksSpanned(p, e) { const a = weekOf(p, e.date); if (!a) return []; const b = e.end ? weekOf(p, e.end) : a; const out = []; for (let w = a; w <= Math.min(b || a, a + 8); w++) out.push(w); return out; }
  function pacingHtml(p) {
    const evs = allEvents(p); const byWeek = {}; evs.forEach(e => weeksSpanned(p, e).forEach(w => (byWeek[w] = byWeek[w] || []).push(e)));
    const qEnds = {}; OCS.data.calendar.quarters.forEach(q => { const end = (p.calendar.quarters && p.calendar.quarters[q.id]) || q.end; const w = weekOf(p, end); if (w) qEnds[w] = q.id; });
    const mods = {}; p.modules.forEach(m => { if (m.weekStart) (mods[m.weekStart] = mods[m.weekStart] || []).push(m.title); });
    const warn = []; p.modules.forEach(m => { if (m.weekStart && byWeek[m.weekStart]) byWeek[m.weekStart].forEach(e => { if (e.type === 'iready' || e.type === 'holiday' || e.type === 'fte') warn.push(`"${m.title}" starts the week of ${e.label}`); }); });
    const count = ui.weekCount(p); const w1 = ui.week1(p);
    const cls = (w) => { const types = (byWeek[w] || []).map(e => e.type); return types.includes('holiday') ? 'holiday' : types.includes('fte') || types.includes('iready') ? 'fte' : types.length ? 'ev' : ''; };
    return `<div style="margin-top:14px;"><b class="small">Pacing strip</b> <span class="tiny muted">${w1 ? 'Weeks from ' + OCS.fmtDate(w1) + ' (' + count + ' weeks through Quarter 4)' : 'Set Week 1 to place dates on the strip'} · assign weeks to modules in the builder</span>
<div class="pacing">${Array.from({ length: count }, (_, i) => i + 1).map(w => `<div class="wk ${qEnds[w] ? 'q' : ''} ${cls(w)} ${mods[w] ? 'has' : ''}" title="${esc([ui.weekLabel(w, p), mods[w] ? mods[w].join(', ') : '', ...(byWeek[w] || []).map(e => e.label), qEnds[w] ? 'End of ' + qEnds[w] : ''].filter(Boolean).join(' · '))}">W${w}${w1 ? `<div style="font-weight:600;">${ui.weekDate(w, p).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</div>` : ''}${qEnds[w] ? `<div style="color:var(--teal)">${qEnds[w]}</div>` : ''}${mods[w] ? `<div style="font-size:14px;">📦</div>` : ''}</div>`).join('')}</div>
<div class="tiny muted" style="margin-top:4px;">Red = school closed · Amber = FTE or testing week · Teal outline = quarter ends · 📦 = a module starts</div>
${warn.length ? `<div class="notice warn" style="margin-top:6px;">⚠️ <span>${warn.map(esc).join('<br>')}</span></div>` : ''}</div>`;
  }
})(window.OCS);
