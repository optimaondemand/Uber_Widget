/* =====================================================================
   Optima Curriculum Studio - bootstrap
   ===================================================================== */
(function (OCS) {
  const ui = OCS.ui;
  // Preview build (one self-contained file): no network, no downloads, no cross-site frames.
  function previewShim() {
    if (!window.OCS_EMBED) return;
    const site = 'https://optimaondemand.github.io/Uber_Widget/';
    const bar = document.createElement('div');
    bar.className = 'preview-bar';
    bar.innerHTML = `<b>Preview build</b> · everything works except downloads and live lesson frames, which need the published site. <a href="${site}" target="_blank" rel="noopener">${site.replace('https://', '')}</a>`;
    const app = document.querySelector('.app'); app.classList.add('has-preview'); app.insertBefore(bar, document.querySelector('.body'));
    OCS.imscc.download = function (blob, fileName) {
      ui.modal({ title: 'Downloads need the published site', body: `<p>This preview runs inside a sandbox that cannot save files. <b>${OCS.esc(fileName)}</b> was generated (${(blob.size / 1024).toFixed(0)} KB) but cannot be handed to your browser from here.</p><p class="small muted">Open the same plan on the published site to download it. Your plan is saved in this browser; use <b>Save plan file</b> there, or rebuild the plan in two clicks.</p>`, footer: `<a class="btn primary" href="${site}" target="_blank" rel="noopener">Open the published site ↗</a><button class="btn" data-close>Close</button>` });
    };
    ui.previewPage = function (url, title) {
      ui.modal({ title: title || 'Lesson page', body: `<p>Live lesson pages cannot be framed inside this preview. Open it directly:</p><p><a class="btn primary" href="${OCS.esc(url)}" target="_blank" rel="noopener">Open the lesson page ↗</a></p><p class="tiny muted" style="word-break:break-all;">${OCS.esc(url)}</p>`, footer: `<button class="btn" data-close>Close</button>` });
    };
    ui.previewHtml = function (html, title) {
      const m = ui.modal({ title: title || 'Preview', wide: true, footer: `<button class="btn primary" data-close>Done</button>`, body: `<div class="preview-inline" style="background:#F0F2F8;padding:14px;border-radius:10px;max-height:72vh;overflow:auto;"></div>` });
      ui.q('.preview-inline', m.el).innerHTML = html;
    };
  }
  async function boot() {
    const stage = document.getElementById('stage');
    stage.innerHTML = `<div class="notice info" style="margin:40px auto;max-width:520px;">⏳ Loading the course catalog…</div>`;
    try { await OCS.loadStatic(); }
    catch (e) { stage.innerHTML = `<div class="notice bad" style="margin:40px auto;max-width:640px;">Could not load <code>data/catalog.json</code>. If you opened index.html straight from a folder, run it through a local server (tools/serve.ps1) or GitHub Pages instead.<br><small>${OCS.esc(e.message)}</small></div>`; return; }
    ui.wireTop(); previewShim();
    const saved = OCS.loadSaved();
    if (saved) { if (saved.course.sourceId && OCS.data.catalog.courses.some(c => c.id === saved.course.sourceId)) OCS.loadCourse(saved.course.sourceId).catch(() => {}); OCS.applySkin(OCS.skinFor(saved.skin && saved.skin.id)); }
    OCS.loadStandardsManifest().catch(() => {});
    OCS.loadLibraries().catch(() => {});
    OCS.on('plan:any', () => { ui.renderTop(); ui.renderRail(); });
    OCS.on('saved', () => ui.renderTop());
    OCS.on('save:failed', () => ui.toast('Autosave failed (browser storage may be full or blocked). Download your plan file to be safe.', 'bad', 6000));
    OCS.on('videos:refreshed', (e) => { if (ui.current === 'build') ui.render(); });
    window.addEventListener('hashchange', ui.render);
    ui.renderTop(); ui.render();
    if (!location.hash) ui.go('home');
    window.addEventListener('error', (e) => { if (e.message) console.error(e.error || e.message); });
  }
  document.addEventListener('DOMContentLoaded', boot);
})(window.OCS);
