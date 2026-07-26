const MODIFIERS = ['shield', 'fast', 'regen', 'armored'];

class Wave {
  constructor() {
    this.currentWave = 0;
    this.totalWaves = 20;
    this.spawnTimer = 0;
    this.waveActive = false;
    this.spawnQueue = [];
  }

  getWaveConfig(waveNum) {
    const hpMult = 1 + (waveNum - 1) * 0.18;
    const speedMult = 1 + Math.min((waveNum - 1) * 0.02, 0.3);
    return { hpMult, speedMult };
  }

  _randomModifier(waveNum) {
    if (waveNum < 11) return null;
    const r = Math.random();
    if (r < 0.25) return MODIFIERS[Math.floor(Math.random() * MODIFIERS.length)];
    return null;
  }

  startWave(waveNum, waypoints) {
    this.currentWave = waveNum;
    this.waveActive = true;
    this.spawnTimer = 0;
    this.spawnQueue = [];

    const cfg = this.getWaveConfig(waveNum);
    const baseInterval = Math.max(0.2, 0.7 - waveNum * 0.025);
    const baseCount = 3 + (waveNum - 1) * 3;
    const count = Math.min(baseCount, 60);

    let enemies = [];
    const isBoss = waveNum === 20;
    const s5 = waveNum === 5, s10 = waveNum === 10, s15 = waveNum === 15;

    if (isBoss) {
      enemies.push({ type: 'Boss', hpMult: cfg.hpMult, speedMult: cfg.speedMult, mod: null });
    } else if (s5) {
      for (let i = 0; i < count; i++) enemies.push({ type: 'Tank', hpMult: cfg.hpMult, speedMult: cfg.speedMult, mod: null });
    } else if (s10) {
      for (let i = 0; i < count; i++) enemies.push({ type: 'Healer', hpMult: cfg.hpMult, speedMult: cfg.speedMult, mod: this._randomModifier(waveNum) });
    } else if (s15) {
      for (let i = 0; i < count; i++) enemies.push({ type: 'Tank', hpMult: cfg.hpMult * 1.3, speedMult: cfg.speedMult, mod: this._randomModifier(waveNum) });
    } else {
      for (let i = 0; i < count; i++) {
        let type = 'Grunt';
        if (waveNum > 6) { const r = Math.random(); if (r < 0.15) type = 'Scout'; else if (r < 0.35 && waveNum > 8) type = 'Tank'; else if (r < 0.4 && waveNum > 12) type = 'Healer'; }
        enemies.push({ type, hpMult: cfg.hpMult, speedMult: cfg.speedMult, mod: this._randomModifier(waveNum) });
      }
    }

    let maxNeeded = 0;
    for (const e of enemies) {
      const ed = ENEMY_DATA[e.type];
      if (ed) {
        const spdPx = ed.speed * cfg.speedMult * 40;
        const needed = (ed.size * 2) / spdPx;
        if (needed > maxNeeded) maxNeeded = needed;
      }
    }
    const spawnInterval = Math.max(baseInterval, Math.min(maxNeeded, 1.2));

    let t = 0;
    for (const e of enemies) {
      this.spawnQueue.push({ type: e.type, hpMult: e.hpMult, speedMult: e.speedMult, spawnTime: t, modifier: e.mod });
      t += spawnInterval;
    }
    return this.spawnQueue.length;
  }

  update(dt, waypoints, grid, enemies) {
    if (!this.waveActive) return false;
    this.spawnTimer += dt;

    while (this.spawnQueue.length > 0 && this.spawnQueue[0].spawnTime <= this.spawnTimer) {
      const s = this.spawnQueue.shift();
      enemies.push(new Enemy(waypoints, s.type, s.hpMult, s.speedMult, grid, s.modifier));
    }

    if (this.spawnQueue.length === 0) {
      const alive = enemies.filter(e => e.alive).length;
      if (alive === 0) { this.waveActive = false; return true; }
    }
    return false;
  }

  isComplete() { return this.currentWave >= this.totalWaves && !this.waveActive; }
}

window.Wave = Wave;
