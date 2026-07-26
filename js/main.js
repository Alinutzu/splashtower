(function () {
  let engine = null;

  async function boot() {
    if (engine) return;
    try {
      engine = new TDGameEngine();
      await engine.init();
    } catch (e) {
      console.error('[Sketch Towers] init failed:', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
