/* =====================================================================
   Optima Curriculum Studio - HTML generation
   Everything Canvas-bound is written with INLINE styles only, because the
   Canvas rich content editor strips <style> blocks and classes. Iframes to
   GitHub-hosted lesson pages are kept, exactly like the existing exports.
   ===================================================================== */
(function (OCS) {
  const esc = OCS.esc;
  const gen = {};
  OCS.gen = gen;

  const LOGO = () => (OCS.data.skins && OCS.data.skins.brand.logo) || '';
  const FONT = "'Nunito','Century Gothic','Arial Rounded MT Bold',Verdana,sans-serif";
  const SERIF = "'Lora',Georgia,'Times New Roman',serif";

  gen.skin = function (plan) {
    const s = OCS.skinFor(plan && plan.skin && plan.skin.id) || { primary: '#0E1C42', accent: '#55C8E8', accent2: '#7FD8F0', tint: '#EAF8FD', gradient: 'linear-gradient(90deg,#55C8E8,#7FD8F0,#1A8A7D)', emoji: '🦉', name: 'Optima Navy' };
    return s;
  };
  function jur(code) { return OCS.jurisdictionOf(code) || 'FL'; }
  function chipStyle(kind) {
    const m = { FL: ['#E3F8ED', '#1F7A4F', '#BFE9D0'], TX: ['#FFF3DC', '#8A5E12', '#F1DB9E'], MS: ['#F0E8FF', '#5B3F91', '#D8CCF0'], PR: ['#EAF1FB', '#2B4C7E', '#C9D8F0'], plain: ['#F0F2F8', '#3A4A6B', '#E2E8F4'] }[kind] || ['#F0F2F8', '#3A4A6B', '#E2E8F4'];
    return `display:inline-block;padding:2px 9px;border-radius:999px;font-size:11px;font-weight:800;background:${m[0]};color:${m[1]};border:1px solid ${m[2]};margin:0 4px 4px 0;white-space:nowrap;`;
  }
  gen.stdChips = function (item) {
    const fl = (item.flCodes || []).map(c => `<span style="${chipStyle('FL')}" title="${esc((OCS.lookupStandard(c) || {}).text || '')}">${esc(c)}</span>`).join('');
    const tx = (item.txCodes || []).map(c => `<span style="${chipStyle('TX')}">${esc(c)}</span>`).join('');
    return fl + tx;
  };

  /* ---------- header band shared by every generated page ---------- */
  gen.header = function (plan, { title, kicker, sub, emoji }) {
    const s = gen.skin(plan);
    const course = plan.course || {};
    const teacher = plan.teacher || {};
    const bg = plan.skin && plan.skin.customBg ? `background:linear-gradient(rgba(14,28,66,.78),rgba(14,28,66,.88)),url(${plan.skin.customBg}) center/cover no-repeat;` : `background:${s.primary};`;
    return `<div style="${bg}border-bottom:6px solid ${s.accent};padding:20px 24px 18px;border-radius:14px 14px 0 0;color:#fff;font-family:${FONT};position:relative;overflow:hidden;">
  <table role="presentation" style="width:100%;border-collapse:collapse;"><tbody><tr>
    <td style="width:60px;vertical-align:middle;padding-right:12px;"><img src="${esc(LOGO())}" alt="Optima Academy Online" style="display:block;width:48px;height:48px;border-radius:50%;background:#fff;padding:4px;"></td>
    <td style="vertical-align:middle;"><div style="font-size:18px;font-weight:800;line-height:1.15;">Optima Academy Online</div><div style="font-size:10.5px;color:${s.accent};letter-spacing:.6px;text-transform:uppercase;">An Education Experience Company</div></td>
    <td style="text-align:right;vertical-align:middle;font-size:34px;">${emoji || s.emoji || ''}</td>
  </tr></tbody></table>
  <div style="margin-top:16px;color:${s.accent};font-size:12px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;">${esc(kicker || [course.grade ? 'Grade ' + course.grade : '', course.subjectLabel || ''].filter(Boolean).join(' • '))}</div>
  <h1 style="margin:6px 0 4px;font-size:26px;line-height:1.15;font-weight:900;color:#fff;font-family:${FONT};">${esc(title || '')}</h1>
  ${sub ? `<div style="color:#D8E0F1;font-size:14px;">${esc(sub)}</div>` : ''}
  ${teacher.name ? `<div style="margin-top:8px;font-size:12px;color:#A8D0E6;">${esc(teacher.name)}${teacher.section ? ' • ' + esc(teacher.section) : ''}</div>` : ''}
</div>`;
  };
  gen.footer = function (plan, extra) {
    const s = gen.skin(plan);
    return `<div style="margin-top:18px;padding:12px 18px;background:${s.primary};color:#A8D0E6;font-size:11.5px;border-radius:0 0 14px 14px;font-family:${FONT};display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><span>Optima Academy Online · Think clearly. Show your reasoning. Keep going.</span><span>${esc(extra || '')}</span></div>`;
  };
  const card = (s, inner, accent) => `<div style="background:#fff;border:1px solid #E2E8F4;border-top:5px solid ${accent || s.accent};border-radius:12px;padding:14px 16px;margin:12px 0;font-family:${FONT};color:#0E1C42;">${inner}</div>`;
  const h3 = (t, color) => `<div style="font-size:11px;font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:${color || '#1A8A7D'};margin-bottom:8px;">${esc(t)}</div>`;

  /* ---------- lesson wrapper: what a Canvas assignment page contains ---------- */
  gen.lessonBody = function (item, plan, { standalone = false } = {}) {
    const s = gen.skin(plan);
    const objectives = (item.objectives || []).filter(Boolean);
    const parts = [];
    if (item.missionQuestion) parts.push(card(s, `${h3('Today\'s question')}<div style="font-family:${SERIF};font-size:17px;font-style:italic;color:#0E1C42;line-height:1.4;">${esc(item.missionQuestion)}</div>`, s.accent2));
    if (objectives.length) parts.push(card(s, `${h3('What you will learn')}<ol style="margin:0;padding-left:20px;line-height:1.6;">${objectives.map(o => `<li>${esc(o)}</li>`).join('')}</ol>`));
    if ((item.flCodes || []).length || (item.txCodes || []).length) parts.push(card(s, `${h3('Standards')}${gen.stdChips(item)}`, '#7A88A8'));
    if (item.notes && item.notes.trim()) parts.push(card(s, `${h3('From your teacher', '#C7922C')}<div style="line-height:1.6;">${gen.paragraphs(item.notes)}</div>`, '#C7922C'));
    if (item.html && item.html.trim()) parts.push(`<div style="margin:12px 0;font-family:${FONT};">${item.html}</div>`);
    if (item.pageUrl) {
      parts.push(`<div style="margin:12px 0;border:1px solid #E2E8F4;border-radius:12px;overflow:hidden;background:#fff;"><iframe src="${esc(item.pageUrl)}" width="100%" height="${item.iframeHeight || 1200}" style="display:block;width:100%;max-width:none;border:0;min-height:${item.iframeHeight || 1200}px;" loading="lazy" allowfullscreen="" title="${esc(item.title)}"></iframe></div>`);
      if (standalone) parts.push(`<p style="font-size:12px;color:#7A88A8;">Trouble seeing the lesson? <a href="${esc(item.pageUrl)}" target="_blank" rel="noopener" style="color:#1A8A7D;">Open it in a new tab.</a></p>`);
    } else if (item.placeholder && !item.html) {
      parts.push(`<div style="margin:12px 0;padding:22px;border:2px dashed #C7922C;border-radius:12px;background:#FFFBF2;text-align:center;font-family:${FONT};"><div style="font-size:30px;">${OCS.kindMeta(item.kind).icon}</div><b style="display:block;font-size:15px;color:#0E1C42;margin-top:6px;">${esc(item.title)}</b><div style="font-size:13px;color:#8A5E12;margin-top:4px;">Placeholder: ${esc(OCS.kindMeta(item.kind).description)}</div></div>`);
    }
    if (item.extraHtml) parts.push(`<div style="margin:12px 0;font-family:${FONT};">${item.extraHtml}</div>`);
    if (item.library) parts.push(gen.libraryCard(item, plan));
    for (const L of (item.enrich || [])) parts.push(gen.libraryCard({ library: L }, plan));
    if (item.videos && item.videos.slots && item.videos.slots.some(v => v.embedSrc) && !item.pageUrl) parts.push(gen.videoGrid(item, plan));
    if (item.kind !== 'page' && item.kind !== 'header' && item.assignment) parts.push(card(s, `${h3('Turn it in')}<div style="line-height:1.6;">When you finish, gather your answers and submit them here in Canvas${/media_recording/.test(item.assignment.submissionTypes || '') ? ' (typed or recorded)' : ''}${/online_upload/.test(item.assignment.submissionTypes || '') ? '. You may also upload a file or photo' : ''}.</div>`, '#34B76F'));
    return parts.join('\n');
  };
  gen.paragraphs = function (text) { return String(text || '').split(/\n{2,}/).map(p => `<p style="margin:0 0 8px;">${esc(p).replace(/\n/g, '<br>')}</p>`).join(''); };

  gen.videoGrid = function (item, plan) {
    const s = gen.skin(plan);
    const vids = (item.videos.slots || []).filter(v => v.embedSrc);
    return card(s, `${h3('Videos')}${vids.map(v => `<div style="margin:0 0 12px;"><div style="font-size:12px;font-weight:800;color:#3A4A6B;margin-bottom:4px;">${esc(v.type || 'Video')}${v.title ? ' · ' + esc(v.title) : ''}</div><div style="position:relative;padding-top:56.25%;border-radius:10px;overflow:hidden;background:#0E1C42;"><iframe src="${esc(v.embedSrc)}" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allowfullscreen="" loading="lazy" title="${esc(v.title || v.type || 'Video')}"></iframe></div></div>`).join('')}`);
  };

  gen.libraryCard = function (item, plan) {
    const s = gen.skin(plan); const L = item.library; if (!L) return '';
    if (L.kind === 'art') {
      return card(s, `${h3('From the Art Reference Library', '#8B6FC0')}<table role="presentation" style="width:100%;border-collapse:collapse;"><tbody><tr>${L.image ? `<td style="width:42%;vertical-align:top;padding-right:14px;"><img src="${esc(L.image)}" alt="${esc(L.title)}" style="display:block;width:100%;border-radius:10px;border:1px solid #E2E8F4;"></td>` : ''}<td style="vertical-align:top;"><div style="font-family:${SERIF};font-size:18px;font-weight:700;">${esc(L.title)}</div><div style="color:#3A4A6B;margin:4px 0 8px;">${esc(L.creator || 'Unknown artist')}${L.date ? ', ' + esc(L.date) : ''}${L.material ? ' · ' + esc(L.material) : ''}</div>${(L.tags || []).map(t => `<span style="${chipStyle('plain')}">${esc(t)}</span>`).join('')}<div style="margin-top:10px;font-size:13px;line-height:1.6;"><b>Look closely:</b> What do you notice first? What details support that? What might the artist want us to think about?</div>${L.link ? `<div style="margin-top:8px;font-size:12px;"><a href="${esc(L.link)}" target="_blank" rel="noopener" style="color:#1A8A7D;">View the record${L.image ? '' : ' on JSTOR'}</a>${L.licence ? ` · <span style="color:#7A88A8;">${esc(L.licence)}</span>` : ''}</div>` : ''}</td></tr></tbody></table>`, '#8B6FC0');
    }
    if (L.kind === 'music') {
      return card(s, `${h3('From the Music Reference Library', '#D4943A')}<div style="font-family:${SERIF};font-size:18px;font-weight:700;">${esc(L.title)}</div><div style="color:#3A4A6B;margin:4px 0 8px;">${esc(L.channel || '')}</div>${L.embed ? `<div style="position:relative;padding-top:56.25%;border-radius:10px;overflow:hidden;background:#0E1C42;"><iframe src="${esc(L.embed)}" style="position:absolute;inset:0;width:100%;height:100%;border:0;" allowfullscreen="" loading="lazy" title="${esc(L.title)}"></iframe></div>` : ''}${(L.tags || []).map(t => `<span style="${chipStyle('plain')}">${esc(t)}</span>`).join('')}<div style="margin-top:10px;font-size:13px;line-height:1.6;"><b>Listen for:</b> the beat, the instruments, and one moment that changes. What does the music make you picture?</div>`, '#D4943A');
    }
    if (L.kind === 'book') {
      return card(s, `${h3('From the ELA Reference Library', '#C7922C')}<div style="font-family:${SERIF};font-size:18px;font-weight:700;">${esc(L.title)}</div><div style="color:#3A4A6B;margin:4px 0 8px;">${esc(L.author || '')}${L.year ? ' (' + esc(L.year) + ')' : ''}${L.shelf ? ' · ' + esc(L.shelf) : ''}</div>${L.freeUrl ? `<div style="font-size:13px;">Free text: <a href="${esc(L.freeUrl)}" target="_blank" rel="noopener" style="color:#1A8A7D;">${esc(L.freeSource || 'read online')}</a></div>` : ''}${L.buyUrl ? `<div style="font-size:13px;">Copy to purchase: <a href="${esc(L.buyUrl)}" target="_blank" rel="noopener" style="color:#1A8A7D;">book list edition</a></div>` : ''}`, '#C7922C');
    }
    return '';
  };

  /* ---------- full Canvas fragment for an item ---------- */
  gen.canvasFragment = function (item, plan) {
    const meta = OCS.kindMeta(item.kind);
    const wrapper = `<div style="max-width:960px;margin:0 auto;font-family:${FONT};color:#0E1C42;line-height:1.5;">`;
    const head = gen.header(plan, { title: item.title, kicker: [plan.course.grade ? 'Grade ' + plan.course.grade : '', plan.course.subjectLabel, item.code ? 'Lesson ' + item.code : meta.label].filter(Boolean).join(' • '), emoji: meta.icon });
    return `${wrapper}${head}<div style="padding:4px 2px;">${gen.lessonBody(item, plan)}</div>${gen.footer(plan, item.code || '')}</div>`;
  };

  gen.quizDescription = function (item, plan) {
    const q = item.quiz || {}; const s = gen.skin(plan);
    const n = (q.questions || []).filter(x => x.include !== false).length;
    return `<div style="font-family:${FONT};color:#0E1C42;">${q.descriptionHtml || ''}<p style="margin:8px 0 0;font-size:13px;color:#3A4A6B;">${n} question${n === 1 ? '' : 's'}. ${item.notes ? esc(item.notes) : 'Read each question carefully and use evidence from the lessons.'}</p></div>`;
  };

  /* ---------- discussion prompt ---------- */
  gen.discussionBody = function (item, plan) { return gen.canvasFragment(item, plan); };

  /* ---------- course home page (optional replacement) ---------- */
  gen.courseHome = function (plan) {
    const s = gen.skin(plan);
    const mods = plan.modules.filter(m => !m.muted);
    const tiles = mods.map((m, i) => `<td style="width:33%;vertical-align:top;padding:6px;"><div style="background:#fff;border:1px solid #E2E8F4;border-top:5px solid ${s.accent};border-radius:10px;padding:14px;"><div style="font-size:11px;color:#7A88A8;font-weight:800;text-transform:uppercase;letter-spacing:.5px;">Module ${i + 1}</div><h3 style="margin:4px 0 6px;font-size:16px;"><a href="$CANVAS_COURSE_REFERENCE$/modules" style="color:#0E1C42;text-decoration:none;">${esc(m.title)}</a></h3><div style="font-size:12px;color:#3A4A6B;">${m.items.filter(x => !x.muted && x.kind !== 'header').length} items</div></div></td>`);
    const rows = []; for (let i = 0; i < tiles.length; i += 3) rows.push(`<tr>${tiles.slice(i, i + 3).join('')}</tr>`);
    return `<div style="max-width:1100px;margin:0 auto;font-family:${FONT};color:#0E1C42;line-height:1.5;">${gen.header(plan, { title: plan.course.title || plan.name, sub: plan.notes || '' })}
<div style="margin:18px 0 6px;"><a href="$CANVAS_COURSE_REFERENCE$/modules" style="display:inline-block;padding:11px 18px;background:${s.accent};color:${s.primary};text-decoration:none;border-radius:8px;font-weight:800;">View Course Modules</a></div>
<h2 style="margin:24px 0 8px;font-family:${SERIF};font-size:22px;border-bottom:2px solid #DCE4EF;padding-bottom:6px;">Course Modules</h2>
<table role="presentation" style="width:100%;border-collapse:separate;"><tbody>${rows.join('')}</tbody></table>${gen.footer(plan, plan.teacher.term || '')}</div>`;
  };

  /* ---------- standalone HTML document ---------- */
  gen.standaloneDoc = function (title, body, plan) {
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Lora:ital,wght@0,400;0,700;1,400&family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet">
<style>body{margin:0;background:#F0F2F8;padding:18px;font-family:${FONT};}</style></head>
<body>${body}
<!-- Generated by Optima Curriculum Studio (${OCS.esc(new Date().toISOString().slice(0, 10))}) --></body></html>`;
  };

  /* ---------- standards report ---------- */
  gen.standardsReportHtml = function (plan) {
    const cov = OCS.coverage(); const s = gen.skin(plan);
    const row = (code) => {
      const std = OCS.lookupStandard(code); const hits = cov.byCode[code] || [];
      const targeted = cov.targets.includes(code);
      return `<tr><td style="padding:6px 8px;border-bottom:1px solid #E2E8F4;font-weight:800;white-space:nowrap;vertical-align:top;">${esc(code)}</td><td style="padding:6px 8px;border-bottom:1px solid #E2E8F4;vertical-align:top;">${esc(std ? std.text : '')}${std && std.strand ? `<div style="font-size:11px;color:#7A88A8;">${esc(OCS.strandLabel(code, plan.course.subject) || std.strand)}</div>` : ''}</td><td style="padding:6px 8px;border-bottom:1px solid #E2E8F4;text-align:center;vertical-align:top;">${targeted ? '●' : ''}</td><td style="padding:6px 8px;border-bottom:1px solid #E2E8F4;vertical-align:top;">${hits.length ? hits.map(h => `<div>${esc(h.module.title)} › ${esc(h.item.title)}</div>`).join('') : `<span style="color:#BF3F3F;font-weight:800;">Not yet covered</span>`}</td></tr>`;
    };
    const all = Array.from(new Set([...cov.targets, ...Object.keys(cov.byCode)])).sort();
    return `<div style="max-width:1000px;margin:0 auto;font-family:${FONT};color:#0E1C42;">${gen.header(plan, { title: 'Standards Coverage Report', sub: plan.name, emoji: '📋' })}
<div style="padding:16px 4px;">
<table role="presentation" style="width:100%;border-collapse:separate;border-spacing:8px 0;margin-bottom:14px;"><tr>
<td style="background:#F0F2F8;border-radius:10px;padding:12px;"><div style="font-size:24px;font-weight:900;">${cov.targets.length}</div><div style="font-size:11px;color:#7A88A8;text-transform:uppercase;font-weight:800;">Targeted</div></td>
<td style="background:#E3F8ED;border-radius:10px;padding:12px;"><div style="font-size:24px;font-weight:900;color:#1F7A4F;">${cov.covered.length}</div><div style="font-size:11px;color:#7A88A8;text-transform:uppercase;font-weight:800;">Covered</div></td>
<td style="background:#FDEEEE;border-radius:10px;padding:12px;"><div style="font-size:24px;font-weight:900;color:#BF3F3F;">${cov.uncovered.length}</div><div style="font-size:11px;color:#7A88A8;text-transform:uppercase;font-weight:800;">Gaps</div></td>
<td style="background:#EAF8FD;border-radius:10px;padding:12px;"><div style="font-size:24px;font-weight:900;">${cov.extra.length}</div><div style="font-size:11px;color:#7A88A8;text-transform:uppercase;font-weight:800;">Bonus coverage</div></td>
<td style="background:#F0F2F8;border-radius:10px;padding:12px;"><div style="font-size:24px;font-weight:900;">${cov.pct}%</div><div style="font-size:11px;color:#7A88A8;text-transform:uppercase;font-weight:800;">Coverage</div></td></tr></table>
<table style="width:100%;border-collapse:collapse;font-size:13px;"><thead><tr style="background:${s.primary};color:#fff;"><th style="padding:8px;text-align:left;">Standard</th><th style="padding:8px;text-align:left;">Text</th><th style="padding:8px;">Target</th><th style="padding:8px;text-align:left;">Covered by</th></tr></thead><tbody>${all.map(row).join('')}</tbody></table>
<p style="font-size:11px;color:#7A88A8;margin-top:12px;">Generated ${new Date().toLocaleString()} by Optima Curriculum Studio. Standards text reproduced verbatim from the publishing authority via the Optima Standards Browser.</p></div>${gen.footer(plan, plan.course.state || '')}</div>`;
  };
  gen.standardsCsv = function (plan) {
    const cov = OCS.coverage(); const all = Array.from(new Set([...cov.targets, ...Object.keys(cov.byCode)])).sort();
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = [['Standard', 'Jurisdiction', 'Text', 'Targeted', 'Covered', 'Covered by'].map(q).join(',')];
    for (const c of all) { const std = OCS.lookupStandard(c); const hits = cov.byCode[c] || []; lines.push([c, jur(c), std ? std.text : '', cov.targets.includes(c) ? 'yes' : 'no', hits.length ? 'yes' : 'no', hits.map(h => h.module.title + ' > ' + h.item.title).join(' | ')].map(q).join(',')); }
    return lines.join('\r\n');
  };

  /* ---------- plan overview (scope & sequence table) ---------- */
  gen.scopeHtml = function (plan) {
    const s = gen.skin(plan);
    const rows = [];
    plan.modules.filter(m => !m.muted).forEach((m, mi) => {
      rows.push(`<tr style="background:${s.tint};"><td colspan="5" style="padding:8px 10px;font-weight:900;">${mi + 1}. ${esc(m.title)}${m.weekStart ? ` <span style="font-weight:600;color:#7A88A8;">· starts week ${m.weekStart}</span>` : ''}</td></tr>`);
      for (const it of m.items) { if (it.muted || it.kind === 'header') continue; const meta = OCS.kindMeta(it.kind); rows.push(`<tr><td style="padding:6px 10px;border-bottom:1px solid #E2E8F4;">${meta.icon}</td><td style="padding:6px 10px;border-bottom:1px solid #E2E8F4;font-weight:700;">${esc(it.title)}</td><td style="padding:6px 10px;border-bottom:1px solid #E2E8F4;color:#3A4A6B;">${esc(meta.label)}</td><td style="padding:6px 10px;border-bottom:1px solid #E2E8F4;font-size:12px;">${(it.flCodes || []).join(', ')}</td><td style="padding:6px 10px;border-bottom:1px solid #E2E8F4;font-size:12px;color:#3A4A6B;">${esc((it.objectives || [])[0] || '')}</td></tr>`); }
    });
    return `<div style="max-width:1100px;margin:0 auto;font-family:${FONT};color:#0E1C42;">${gen.header(plan, { title: 'Scope and Sequence', sub: plan.name, emoji: '🗺️' })}<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;"><thead><tr style="background:${s.primary};color:#fff;"><th style="padding:8px;"></th><th style="padding:8px;text-align:left;">Item</th><th style="padding:8px;text-align:left;">Type</th><th style="padding:8px;text-align:left;">Standards</th><th style="padding:8px;text-align:left;">First objective</th></tr></thead><tbody>${rows.join('')}</tbody></table>${gen.footer(plan, '')}</div>`;
  };
})(window.OCS);
