(function () {
  let engine = null;

  function boot() {
    if (engine) return;
    engine = new TDGameEngine();
    engine.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
