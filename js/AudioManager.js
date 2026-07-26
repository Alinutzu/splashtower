class AudioManager {
  constructor() {
    this._ctx = null;
    this._masterGain = null;
    this._initialized = false;
    this._muted = false;
    this._volume = 0.35;
    this._buffers = {};
    this._resumeHandler = this._resumeHandler.bind(this);
  }

  async init() {
    if (this._initialized) return;
    try {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
      const compressor = this._ctx.createDynamicsCompressor();
      compressor.threshold.value = -12;
      compressor.knee.value = 6;
      compressor.ratio.value = 4;
      compressor.attack.value = 0.005;
      compressor.release.value = 0.05;
      compressor.connect(this._ctx.destination);

      this._masterGain = this._ctx.createGain();
      this._masterGain.gain.value = this._muted ? 0 : this._volume;
      this._masterGain.connect(compressor);
      this._initialized = true;
      document.addEventListener('pointerdown', this._resumeHandler, { once: true });
      document.addEventListener('keydown', this._resumeHandler, { once: true });
    } catch (e) {
      console.warn('[AudioManager] Web Audio not available:', e);
    }
  }

  _resumeHandler() {
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  }

  async _ensureCtx() {
    if (!this._initialized) await this.init();
    if (!this._ctx) return false;
    if (this._ctx.state === 'suspended') {
      try { await this._ctx.resume(); } catch (e) { return false; }
    }
    return true;
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._masterGain && !this._muted) {
      this._masterGain.gain.setTargetAtTime(this._volume, this._ctx.currentTime, 0.02);
    }
  }

  getVolume() { return this._volume; }

  toggleMute() {
    this._muted = !this._muted;
    if (this._masterGain) {
      this._masterGain.gain.setTargetAtTime(this._muted ? 0 : this._volume, this._ctx.currentTime, 0.02);
    }
    return this._muted;
  }

  isMuted() { return this._muted; }

  _makeBuffer(duration, fillFn) {
    const sr = this._ctx.sampleRate;
    const length = Math.ceil(sr * duration);
    const buffer = this._ctx.createBuffer(1, length, sr);
    const data = buffer.getChannelData(0);
    fillFn(data, sr, length);
    return buffer;
  }

  _sineBuffer(freq, duration, gain = 1, attack = 0.002, decay = 0.05) {
    return this._makeBuffer(duration, (data, sr, len) => {
      const envLen = Math.max(1, Math.floor(sr * (attack + decay)));
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        const env = i < sr * attack
          ? i / (sr * attack)
          : Math.max(0, 1 - (i - sr * attack) / (sr * decay));
        data[i] = Math.sin(2 * Math.PI * freq * t) * gain * env;
      }
    });
  }

  _generateSounds() {
    this._buffers.tower_shoot = this._sineBuffer(1200, 0.08, 0.4, 0.001, 0.04);
    this._buffers.enemy_hit = this._sineBuffer(400, 0.06, 0.3, 0.001, 0.05);
    this._buffers.enemy_die = this._sineBuffer(200, 0.2, 0.5, 0.002, 0.15);
    this._buffers.enemy_escape = this._sineBuffer(80, 0.4, 0.4, 0.01, 0.35);
    this._buffers.tower_place = this._sineBuffer(600, 0.15, 0.5, 0.002, 0.1);
    this._buffers.tower_upgrade = this._sineBuffer(800, 0.2, 0.5, 0.002, 0.12);
    this._buffers.tower_sell = this._sineBuffer(500, 0.12, 0.4, 0.002, 0.08);
    this._buffers.wave_start = this._sineBuffer(300, 0.3, 0.4, 0.01, 0.25);
    this._buffers.game_over = this._sineBuffer(100, 0.6, 0.5, 0.01, 0.5);
    this._buffers.coin_collect = this._sineBuffer(1400, 0.1, 0.3, 0.001, 0.08);
  }

  async play(name) {
    const ok = await this._ensureCtx();
    if (!ok) return;
    if (!this._buffers[name]) {
      if (Object.keys(this._buffers).length === 0) this._generateSounds();
      if (!this._buffers[name]) return;
    }
    const src = this._ctx.createBufferSource();
    src.buffer = this._buffers[name];
    src.connect(this._masterGain);
    src.start(0);
  }

  destroy() {
    if (this._ctx) this._ctx.close();
    this._initialized = false;
    document.removeEventListener('pointerdown', this._resumeHandler);
    document.removeEventListener('keydown', this._resumeHandler);
  }
}

window.AudioManager = AudioManager;
