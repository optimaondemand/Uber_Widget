/* =====================================================================
   Optima Curriculum Studio - bootstrap
   ===================================================================== */
(function (OCS) {
  const ui = OCS.ui;
  async function boot() {
    const stage = document.getElementById('stage');
    stage.innerHTML = `<div class="notice info" style="margin:40px auto;max-width:520px;">⏳ Loading the course catalog…</div>`;
    try { await OCS.loadStatic(); }
    catch (e) { stage.innerHTML = `<div class="notice bad" style="margin:40px auto;max-width:640px;">Could not load <code>data/catalog.json</code>. If you opened index.html straight from a folder, run it through a local server (tools/serve.ps1) or GitHub Pages instead.<br><small>${OCS.esc(e.message)}</small></div>`; return; }
    ui.wireTop();
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
