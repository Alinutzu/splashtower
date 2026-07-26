const UPGRADE_COSTS = [100, 250, 500];
const UPGRADE_MAX = 3;
const BUFF_POOL = [
  { id: 'dmg',      name: '+25% Damage (all)',   icon: '⚔️', desc: 'Toate turnurile fac +25% damage', apply: b => { b.damageMult = (b.damageMult || 1) + 0.25; } },
  { id: 'range',    name: '+1 Range (all)',       icon: '🎯', desc: 'Toate turnurile au +1 range', apply: b => { b.rangeMult = (b.rangeMult || 1) + 0.33; } },
  { id: 'speed',    name: '+20% Attack Speed',    icon: '⚡', desc: 'Turnurile atacă cu 20% mai repede', apply: b => { b.speedMult = (b.speedMult || 1) - 0.2; } },
  { id: 'cannon',   name: '+50% Cannon Damage',   icon: '💣', desc: 'Cannonele fac +50% damage', apply: b => { b.cannonDmgMult = (b.cannonDmgMult || 1) + 0.5; } },
  { id: 'ice',      name: 'Ice Slow +40%',        icon: '❄️', desc: 'Încetinirea Ice crește cu 40%', apply: b => { b.iceSlowMult = (b.iceSlowMult || 0) + 0.4; } },
  { id: 'lightning',name: 'Lightning +1 Chain',   icon: '🌩️', desc: 'Lightning lovește +1 inamic', apply: b => { b.lightningChainAdd = (b.lightningChainAdd || 0) + 1; } },
  { id: 'sniper',   name: '+60% Sniper Damage',   icon: '🎯', desc: 'Sniper-ul face +60% damage', apply: b => { b.sniperDmgMult = (b.sniperDmgMult || 1) + 0.6; } },
  { id: 'discount', name: '-20% Tower Cost',      icon: '💰', desc: 'Turnurile costă 20% mai puțin', apply: b => { b.towerCostReduction = (b.towerCostReduction || 0) + 0.2; } },
  { id: 'heal',     name: '+5 HP Baza',           icon: '❤️', desc: 'Baza primește +5 HP maxim', apply: b => { b.bonusHp = (b.bonusHp || 0) + 5; } },
];

class TDGameEngine {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.grid = new Grid(20, 12, 40);
    this.wave = new Wave();
    this.particles = new ParticleSystem();
    this.audio = new AudioManager();
    this.saveManager = new SaveManager();
    this.state = 'MENU';
    this.coins = 100;
    this.hp = 20;
    this.maxHp = 20;
    this.totalCoinsEarned = 0;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.selectedTowerType = null;
    this.selectedGridTower = null;
    this.pendingCol = -1;
    this.pendingRow = -1;
    this.mouseX = -1;
    this.mouseY = -1;
    this.lastTime = 0;
    this.running = false;
    this.paused = false;
    this.metaPoints = 0;
    this.upgrades = { startBonus: 0, extraShields: 0, architectDiscount: 0 };
    this.buffs = {};
    this.pickChoices = [];
    this._architectDiscount = 0;
    this.selectedMapIndex = 0;
    this._boundLoop = this._loop.bind(this);
    this._boundClick = this._onClick.bind(this);
    this._boundMove = this._onMouseMove.bind(this);
    this._boundTouchStart = this._onTouchStart.bind(this);
    this._boundTouchEnd = this._onTouchEnd.bind(this);
    this._boundLeave = () => { this.mouseX = this.mouseY = -1; this.grid.clearHover(); };
    this._boundResize = this._resize.bind(this);
    this._lastHud = { coins: -1, wave: -1, hp: -1, maxHp: -1 };
    this._wasAutoPaused = false;
    this.waveText = null;
    this.speedLevels = [1, 2, 3];
    this.speedIndex = 0;
    this.gameSpeed = 1;
    this.leaderboard = new Leaderboard();
    this._cgInitialized = false;
    this._pendingRevive = false;
    this._pigmentClaimed = false;
    this._pigmentAmount = 0;
    this._lastDailyClaim = 0;

    this._longPressTimer = null;
    this._longPressStartTime = 0;
    this._longPressTouch = null;
    this._popupActive = false;
    this._popupTower = null;
  }

  async init() {
    this.canvas.width = this.grid.width;
    this.canvas.height = this.grid.height;
    this.canvas.addEventListener('click', this._boundClick);
    this.canvas.addEventListener('mousemove', this._boundMove);
    this.canvas.addEventListener('mouseleave', this._boundLeave);
    this.canvas.addEventListener('touchstart', this._boundTouchStart, { passive: false });
    this.canvas.addEventListener('touchend', this._boundTouchEnd, { passive: false });
    window.addEventListener('resize', this._boundResize);
    this._resize();
    this._isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this._touchPending = false;
    this._touchTimer = null;

    document.querySelectorAll('.tower-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectTowerType(btn.dataset.tower));
    });
    document.querySelectorAll('.mobile-tower-btn').forEach(btn => {
      btn.addEventListener('click', () => this.selectTowerType(btn.dataset.tower));
    });
    document.getElementById('btn-start-wave').addEventListener('click', () => this.startWave());
    document.getElementById('btn-play').addEventListener('click', () => this.startGame());
    document.getElementById('btn-shop').addEventListener('click', () => this._openShop());
    document.getElementById('btn-shop-close').addEventListener('click', () => this._closeShop());
    document.querySelectorAll('.btn-upg').forEach(btn => {
      btn.addEventListener('click', () => this._purchaseUpgrade(btn.dataset.upg));
    });
    document.getElementById('btn-retry-v').addEventListener('click', () => this.restart());
    document.getElementById('btn-retry-d').addEventListener('click', () => this.restart());
    document.getElementById('btn-menu-v').addEventListener('click', () => this._goToMenu());
    document.getElementById('btn-menu-d').addEventListener('click', () => this._goToMenu());
    document.getElementById('btn-pause').addEventListener('click', () => this._togglePause());
    document.getElementById('btn-mute').addEventListener('click', () => this._toggleMute());
    document.getElementById('btn-speed').addEventListener('click', () => this._cycleSpeed());
    document.getElementById('btn-resume').addEventListener('click', () => this._togglePause());
    document.getElementById('btn-pause-shop').addEventListener('click', () => { this._pauseState = 'shop'; this._openShop(); });
    document.getElementById('btn-pause-menu').addEventListener('click', () => this._goToMenu());
    document.getElementById('btn-pause-lb').addEventListener('click', () => this._openLeaderboard());
    document.getElementById('btn-leaderboard').addEventListener('click', () => this._openLeaderboard());
    document.getElementById('btn-lb-close').addEventListener('click', () => this._closeLeaderboard());
    document.getElementById('btn-revive').addEventListener('click', () => this._requestRevive());
    document.getElementById('btn-pigment').addEventListener('click', () => this._claimPigmentMultiplier());
    document.getElementById('btn-daily').addEventListener('click', () => this._claimDailyReward());
    document.addEventListener('keydown', (e) => this._onKeyDown(e));

    this._fabWave = document.getElementById('btn-fab-wave');
    this._towerPopup = document.getElementById('tower-popup');
    this._popupTowerName = document.getElementById('popup-tower-name');
    this._popupTowerStats = document.getElementById('popup-tower-stats');
    this._popupBtnUpgrade = document.getElementById('popup-btn-upgrade');
    this._popupBtnSell = document.getElementById('popup-btn-sell');
    this._popupBtnTarget = document.getElementById('popup-btn-target');

    this._fabWave.addEventListener('click', (e) => { e.stopPropagation(); if (this.state === 'PREPARE') this.startWave(); });
    this._popupBtnUpgrade.addEventListener('click', () => this._popupUpgradeTower());
    this._popupBtnSell.addEventListener('click', () => this._popupSellTower());
    this._popupBtnTarget.addEventListener('click', () => this._popupToggleTarget());
    document.getElementById('pick-choices').addEventListener('click', (e) => {
      const card = e.target.closest('.pick-card');
      if (card) this._applyPick(parseInt(card.dataset.choice, 10));
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        if (this.state !== 'MENU' && this.state !== 'VICTORY' && this.state !== 'DEFEAT' && this.state !== 'PAUSED') {
          this._prePauseState = this.state;
          this.state = 'PAUSED';
          this.paused = true;
          this._wasAutoPaused = true;
        }
      } else if (this._wasAutoPaused) {
        this._wasAutoPaused = false;
        if (this.state === 'PAUSED') {
          this.state = this._prePauseState || 'PREPARE';
          this.paused = false;
          this._showUI('none');
        }
      }
      document.getElementById('btn-pause').textContent = this.paused ? '▶' : '⏸';
    });

    this.audio.init();
    await this.leaderboard.init();
    await this._initCrazyGames();
    await this._loadProgress();
    this._buildMapCards();
    this._updateMenuUI();
    this._updateDailyRewardUI();
    this._showUI('menu');
    document.getElementById('wave-total').textContent = this.wave.totalWaves;
    this._updateHUD();
    this.running = true;
    this.lastTime = performance.now();
    this._loop(this.lastTime);
  }

  _resize() {
    const wrapper = document.getElementById('game-wrapper');
    const sidebar = document.getElementById('hud-sidebar');
    const mobileBar = document.getElementById('mobile-tower-bar');
    const sidebarW = sidebar && getComputedStyle(sidebar).display !== 'none' ? 120 : 0;
    const mobileBarH = mobileBar && getComputedStyle(mobileBar).display !== 'none' ? 76 : 0;
    const avW = wrapper.clientWidth - sidebarW;
    const avH = wrapper.clientHeight - 44 - mobileBarH;
    if (avW <= 0 || avH <= 0) return;
    const ar = 800 / 600;
    let w = avW, h = avW / ar;
    if (h > avH) { h = avH; w = avH * ar; }
    this.canvas.style.width = Math.floor(w) + 'px';
    this.canvas.style.height = Math.floor(h) + 'px';
  }

  async _initCrazyGames() {
    try {
      if (window.CrazyGames && window.CrazyGames.SDK) {
        await window.CrazyGames.SDK.init();
        this._cgInitialized = true;
        window.CrazyGames.SDK.game.gameplayStart();

        document.addEventListener('crazygames_sdk_focus_loss', () => {
          if (this.state !== 'MENU' && this.state !== 'VICTORY' && this.state !== 'DEFEAT' && this.state !== 'PAUSED') {
            this._prePauseState = this.state;
            this.state = 'PAUSED';
            this.paused = true;
            this._wasAutoPaused = true;
            document.getElementById('btn-pause').textContent = '▶';
          }
        });
        document.addEventListener('crazygames_sdk_focus_gain', () => {
          if (this._wasAutoPaused && this.state === 'PAUSED') {
            this._wasAutoPaused = false;
            this.state = this._prePauseState || 'PREPARE';
            this.paused = false;
            this._showUI('none');
            document.getElementById('btn-pause').textContent = '⏸';
          }
        });
      }
    } catch (_) { this._cgInitialized = false; }
  }

  destroy() {
    this.running = false;
    this.canvas.removeEventListener('click', this._boundClick);
    this.canvas.removeEventListener('mousemove', this._boundMove);
    this.canvas.removeEventListener('mouseleave', this._boundLeave);
    this.canvas.removeEventListener('touchstart', this._boundTouchStart);
    this.canvas.removeEventListener('touchend', this._boundTouchEnd);
    window.removeEventListener('resize', this._boundResize);
  }

  // ---- Persistence ----

  async _loadProgress() {
    const data = await this.saveManager.loadProgress();
    this.metaPoints = data.metaPoints || 0;
    this._lastDailyClaim = data.lastDailyClaim || 0;
    if (data.upgrades) {
      this.upgrades.startBonus = data.upgrades.startBonus || 0;
      this.upgrades.extraShields = data.upgrades.extraShields || 0;
      this.upgrades.architectDiscount = data.upgrades.architectDiscount || 0;
    }
  }

  async _saveProgress() {
    await this.saveManager.saveProgress({ metaPoints: this.metaPoints, upgrades: this.upgrades, lastDailyClaim: this._lastDailyClaim });
  }

  // ---- Shop ----

  _openShop() { this._updateShopUI(); this._showUI('shop'); }
  _closeShop() {
    if (this._pauseState === 'shop') {
      this._pauseState = null;
      this._showUI('paused');
    } else {
      this._updateMenuUI();
      this._updateDailyRewardUI();
      this._showUI('menu');
    }
  }

  _purchaseUpgrade(type) {
    const level = this.upgrades[type];
    if (level >= UPGRADE_MAX) return;
    const cost = UPGRADE_COSTS[level];
    if (this.metaPoints < cost) return;
    this.metaPoints -= cost;
    this.upgrades[type]++;
    this._saveProgress();
    this._updateShopUI();
    this.audio.play('tower_upgrade');
  }

  _updateShopUI() {
    document.getElementById('shop-meta-points').textContent = this.metaPoints;
    document.querySelectorAll('.upgrade-item').forEach(item => {
      const type = item.dataset.upgrade;
      const level = this.upgrades[type];
      const btn = item.querySelector('.btn-upg');
      const fill = item.querySelector('.upg-fill');
      fill.style.width = (level / UPGRADE_MAX * 100) + '%';
      if (level >= UPGRADE_MAX) { btn.textContent = 'MAX'; btn.className = 'btn-upg maxed'; btn.disabled = true; }
      else { btn.textContent = UPGRADE_COSTS[level] + '🪙'; btn.className = 'btn-upg'; btn.disabled = this.metaPoints < UPGRADE_COSTS[level]; }
    });
  }

  _updateMenuUI() { document.getElementById('menu-meta-points').textContent = this.metaPoints; }

  _buildMapCards() {
    const container = document.getElementById('map-grid');
    container.innerHTML = '';
    MAP_DEFS.forEach((m, i) => {
      const card = document.createElement('div');
      card.className = 'map-card' + (i === this.selectedMapIndex ? ' selected' : '');
      const stars = Array(m.difficulty).fill('★').join('');
      card.innerHTML = `<div class="map-card-icon">${m.icon}</div><div class="map-card-name">${m.name}</div><div class="map-card-diff"><span class="star">${stars}</span></div>`;
      card.addEventListener('click', () => this._selectMap(i));
      container.appendChild(card);
    });
  }

  _selectMap(index) {
    this.selectedMapIndex = index;
    document.querySelectorAll('.map-card').forEach((c, i) => c.classList.toggle('selected', i === index));
  }

  // ---- Game flow ----

  startGame() {
    const mapDef = MAP_DEFS[this.selectedMapIndex] || MAP_DEFS[0];
    const wp = buildWaypoints(mapDef, 40);
    this.grid = new Grid(20, 12, 40, wp);

    this.buffs = {};
    this.pickChoices = [];
    const bonusCoins = this.upgrades.startBonus * 50;
    const bonusHp = this.upgrades.extraShields * 5;
    const discount = this.upgrades.architectDiscount * 0.05;
    this.coins = 100 + bonusCoins;
    this.maxHp = 20 + bonusHp;
    this.hp = this.maxHp;
    this.totalCoinsEarned = 0;
    this.towers = [];
    this.enemies = [];
    this.projectiles = [];
    this.wave = new Wave();
    this.particles = new ParticleSystem();
    this.selectedTowerType = null;
    this.selectedGridTower = null;
    this.pendingCol = -1;
    this.pendingRow = -1;
    this._architectDiscount = discount;
    this.waveText = null;
    window.DAMAGE_NUMBERS.length = 0;
    window.SCREEN_SHAKE = 0;
    this.state = 'PREPARE';
    this._showUI('none');
    this._syncFAB();
    document.getElementById('wave-total').textContent = this.wave.totalWaves;
    this._updateHUD();
    this._updateSidebarSelection();
    this._updateSidebarCosts();
    this.audio.play('wave_start');
  }

  restart() {
    if (this._cgInitialized && (this.state === 'VICTORY' || this.state === 'DEFEAT')) {
      try { window.CrazyGames.SDK.ad.requestAd('midgame'); } catch (_) {}
    }
    this.startGame();
  }

  _goToMenu() {
    if (this._cgInitialized && (this.state === 'VICTORY' || this.state === 'DEFEAT')) {
      try { window.CrazyGames.SDK.ad.requestAd('midgame'); } catch (_) {}
    }
    this.state = 'MENU'; this.paused = false; this._updateMenuUI(); this._updateDailyRewardUI(); this._showUI('menu');
  }

  _togglePause() {
    if (this.state === 'MENU' || this.state === 'VICTORY' || this.state === 'DEFEAT') return;
    if (this.state === 'PAUSED') {
      this.state = this._prePauseState || 'PREPARE';
      this.paused = false;
      this._wasAutoPaused = false;
      if (this._touchTimer) { clearTimeout(this._touchTimer); this._touchTimer = null; }
      this._touchPending = false;
      this.pendingCol = -1; this.pendingRow = -1;
      this._showUI('none');
      document.getElementById('btn-pause').textContent = '⏸';
    } else {
      this._prePauseState = this.state;
      this.state = 'PAUSED';
      this.paused = true;
      this._wasAutoPaused = false;
      this._showUI('paused');
      document.getElementById('btn-pause').textContent = '▶';
    }
  }

  _toggleMute() {
    const muted = this.audio.toggleMute();
    document.getElementById('btn-mute').textContent = muted ? '🔇' : '🔊';
  }

  _cycleSpeed() {
    this.speedIndex = (this.speedIndex + 1) % this.speedLevels.length;
    this.gameSpeed = this.speedLevels[this.speedIndex];
    const btn = document.getElementById('btn-speed');
    btn.textContent = this.gameSpeed + 'x';
    btn.classList.toggle('speed-active', this.gameSpeed > 1);
  }

  async _showAdBreak(callback) {
    if (this._cgInitialized) {
      try { await window.CrazyGames.SDK.ad.requestAd('midgame'); } catch (_) {}
    }
    callback();
  }

  startWave() {
    if (this.state !== 'PREPARE') return;
    if (this.wave.waveActive) return;
    const next = this.wave.currentWave + 1;
    if (next > this.wave.totalWaves) return;
    this.state = 'WAVE';
    this.wave.startWave(next, this.grid.waypoints);
    this.selectedTowerType = null;
    this.selectedGridTower = null;
    this.pendingCol = -1;
    this.pendingRow = -1;
    this._updateSidebarSelection();
    this._updateHUD();
    this.audio.play('wave_start');
    this._closeTowerPopup();
    this._syncFAB();
  }

  // ---- Roguelite picks ----

  _showPick(waveNum) {
    this.state = 'PICK';
    const pool = [...BUFF_POOL];
    const choices = [];
    for (let i = 0; i < 3; i++) {
      if (pool.length === 0) break;
      const idx = Math.floor(Math.random() * pool.length);
      choices.push(pool.splice(idx, 1)[0]);
    }
    this.pickChoices = choices;

    document.getElementById('pick-wave').textContent = waveNum;
    const container = document.getElementById('pick-choices');
    container.innerHTML = '';
    choices.forEach((c, i) => {
      const card = document.createElement('div');
      card.className = 'pick-card';
      card.dataset.choice = i;
      card.innerHTML = `<div class="pick-card-icon">${c.icon}</div><div class="pick-card-name">${c.name}</div><div class="pick-card-desc">${c.desc}</div>`;
      container.appendChild(card);
    });
    this._showUI('pick');
  }

  _applyPick(index) {
    const choice = this.pickChoices[index];
    if (!choice) return;
    choice.apply(this.buffs);
    this._recalcTowers();
    this.state = 'PREPARE';
    this._syncFAB();
    this._updateSidebarCosts();
    this._showUI('none');
    this.audio.play('tower_upgrade');
  }

  _recalcTowers() {
    for (const t of this.towers) t.recalc(this.buffs);
  }

  // ---- Selection ----

  selectTowerType(type) {
    if (this.state === 'VICTORY' || this.state === 'DEFEAT') return;
    this.selectedTowerType = this.selectedTowerType === type ? null : type;
    this.selectedGridTower = null;
    this.pendingCol = -1;
    this.pendingRow = -1;
    this._updateSidebarSelection();
  }

  _updateSidebarSelection() {
    document.querySelectorAll('.tower-btn').forEach(btn =>
      btn.classList.toggle('selected', btn.dataset.tower === this.selectedTowerType));
    document.querySelectorAll('.mobile-tower-btn').forEach(btn =>
      btn.classList.toggle('selected', btn.dataset.tower === this.selectedTowerType));
  }

  _updateSidebarCosts() {
    const disc = this._architectDiscount + (this.buffs.towerCostReduction || 0);
    document.querySelectorAll('.tower-btn').forEach(btn => {
      const base = parseInt(btn.dataset.cost, 10);
      btn.querySelector('.tower-cost').textContent = Math.ceil(base * (1 - disc)) + '🪙';
    });
    document.querySelectorAll('.mobile-tower-btn').forEach(btn => {
      const base = parseInt(btn.dataset.cost, 10);
      btn.querySelector('.tower-cost').textContent = Math.ceil(base * (1 - disc)) + '🪙';
    });
  }

  // ---- Input ----

  _getCanvasCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    const sx = this.canvas.width / rect.width;
    const sy = this.canvas.height / rect.height;
    const touch = e.changedTouches && e.changedTouches[0];
    const cx = e.clientX != null ? e.clientX : touch ? touch.clientX : 0;
    const cy = e.clientY != null ? e.clientY : touch ? touch.clientY : 0;
    return { x: (cx - rect.left) * sx, y: (cy - rect.top) * sy };
  }

  _onClick(e) {
    if (this.state === 'MENU' || this.state === 'VICTORY' || this.state === 'DEFEAT' || this.state === 'PICK' || this.state === 'PAUSED') return;
    if (this.state === 'SHOP') return;
    if (this._lastTouchTime && Date.now() - this._lastTouchTime < 500) return;

    const pos = this._getCanvasCoords(e);
    const cell = this.grid.pixelToCell(pos.x, pos.y);

    if (this.selectedTowerType) {
      if (this.grid.isPathCell(cell.col, cell.row)) return;
      if (this.towers.find(t => t.col === cell.col && t.row === cell.row)) return;
      if (this.pendingCol === cell.col && this.pendingRow === cell.row) {
        this._placeTower(cell.col, cell.row);
        this.pendingCol = -1; this.pendingRow = -1;
      } else { this.pendingCol = cell.col; this.pendingRow = cell.row; }
      return;
    }

    const hitTower = this.towers.find(t => t.hitTest(pos.x, pos.y));
    if (hitTower) {
      const uiY = hitTower.y + hitTower.grid.cellSize / 2 + 4;
      const inUpgrade = pos.y > uiY + 30 && pos.y < uiY + 44;
      const inSell = pos.y > uiY + 48 && pos.y < uiY + 62;
      if (this.selectedGridTower === hitTower) {
        if (inSell) { this._sellTower(hitTower); return; }
        if (inUpgrade) { this._upgradeTower(hitTower); return; }
        if (hitTower.type === 'Sniper' && pos.y > uiY + 58 && pos.y < uiY + 70) {
          hitTower.targetMode = hitTower.targetMode === 'first' ? 'strongest' : 'first';
          return;
        }
      }
      this.selectedGridTower = hitTower;
      this.selectedTowerType = null;
      this.pendingCol = -1; this.pendingRow = -1;
      this._updateSidebarSelection();
    } else {
      if (this._popupActive) { this._closeTowerPopup(); return; }
      this.selectedGridTower = null;
    }
  }

  _onMouseMove(e) {
    if (this.state === 'MENU' || this.state === 'VICTORY' || this.state === 'DEFEAT' || this.state === 'PICK' || this.state === 'PAUSED') { this.grid.clearHover(); return; }
    const pos = this._getCanvasCoords(e);
    this.mouseX = pos.x; this.mouseY = pos.y;
    const cell = this.grid.pixelToCell(pos.x, pos.y);
    this.grid.setHover(cell.col, cell.row);
  }

  _onTouchStart(e) {
    e.preventDefault();
    this._lastTouchTime = Date.now();
    if (this.state === 'MENU' || this.state === 'VICTORY' || this.state === 'DEFEAT' || this.state === 'SHOP' || this.state === 'PICK' || this.state === 'PAUSED') return;
    const touch = e.changedTouches[0];
    const pos = this._getCanvasCoords(touch);
    this.mouseX = pos.x; this.mouseY = pos.y;
    const cell = this.grid.pixelToCell(pos.x, pos.y);
    this.grid.setHover(cell.col, cell.row);
    if (this._isTouchDevice && (this.state === 'WAVE' || this.state === 'PREPARE')) {
      this._longPressStartTime = Date.now();
      this._longPressTouch = { x: pos.x, y: pos.y };
      this._cancelLongPress();
      this._longPressTimer = setTimeout(() => {
        this._longPressTimer = null;
        const tower = this.towers.find(t => t.hitTest(pos.x, pos.y));
        if (tower) this._showTowerPopup(tower, pos.x, pos.y);
      }, 500);
    }
    this._handleTouchCell(cell, pos);
  }

  _onTouchEnd(e) {
    e.preventDefault();
    this._cancelLongPress();
    this._longPressTouch = null;
  }

  _cancelLongPress() {
    if (this._longPressTimer) { clearTimeout(this._longPressTimer); this._longPressTimer = null; }
  }

  // ---- Tower Popup (DOM-based, mobile) ----

  _showTowerPopup(tower, canvasX, canvasY) {
    this._popupActive = true;
    this._popupTower = tower;
    this.selectedGridTower = tower;
    this.selectedTowerType = null;
    this.pendingCol = -1; this.pendingRow = -1;
    this._updateSidebarSelection();

    const cfg = TOWER_DATA[tower.type];
    const upgCost = tower.getUpgradeCost();
    const sellValue = tower.getSellValue();

    this._popupTowerName.textContent = `${cfg.label} ${tower.type} Lv${tower.level}`;
    this._popupTowerStats.textContent = `Dmg:${tower.damage}  R:${tower.getRangeInCells()}`;

    if (upgCost > 0) {
      this._popupBtnUpgrade.textContent = `⬆ ${upgCost}🪙`;
      this._popupBtnUpgrade.classList.remove('maxed');
      this._popupBtnUpgrade.disabled = this.coins < upgCost;
    } else {
      this._popupBtnUpgrade.textContent = 'MAX';
      this._popupBtnUpgrade.classList.add('maxed');
      this._popupBtnUpgrade.disabled = true;
    }
    this._popupBtnSell.textContent = `💰 ${sellValue}🪙`;

    if (tower.type === 'Sniper') {
      this._popupBtnTarget.classList.remove('hidden');
      this._popupBtnTarget.textContent = tower.targetMode === 'first' ? '🎯 First' : '💪 Strong';
    } else {
      this._popupBtnTarget.classList.add('hidden');
    }

    const rect = this.canvas.getBoundingClientRect();
    const wrapperRect = document.getElementById('game-wrapper').getBoundingClientRect();
    const scaleX = rect.width / this.canvas.width;
    const scaleY = rect.height / this.canvas.height;
    let screenX = rect.left + canvasX * scaleX - wrapperRect.left;
    let screenY = rect.top + canvasY * scaleY - wrapperRect.top;
    screenX = Math.max(110, Math.min(wrapperRect.width - 110, screenX));
    screenY = Math.max(80, Math.min(wrapperRect.height - 20, screenY));

    this._towerPopup.style.left = screenX + 'px';
    this._towerPopup.style.top = screenY + 'px';
    this._towerPopup.classList.remove('hidden');
  }

  _closeTowerPopup() {
    if (!this._popupActive) return;
    this._popupActive = false;
    this._popupTower = null;
    this.selectedGridTower = null;
    this._towerPopup.classList.add('hidden');
  }

  _popupUpgradeTower() {
    if (!this._popupTower) return;
    this._upgradeTower(this._popupTower);
    if (this._popupTower && this.selectedGridTower === this._popupTower) {
      this._showTowerPopup(this._popupTower, this._popupTower.x, this._popupTower.y);
    } else {
      this._closeTowerPopup();
    }
  }

  _popupSellTower() {
    if (!this._popupTower) return;
    this._sellTower(this._popupTower);
    this._closeTowerPopup();
  }

  _popupToggleTarget() {
    if (!this._popupTower || this._popupTower.type !== 'Sniper') return;
    this._popupTower.targetMode = this._popupTower.targetMode === 'first' ? 'strongest' : 'first';
    this._showTowerPopup(this._popupTower, this._popupTower.x, this._popupTower.y);
  }

  // ---- Start Wave FAB sync ----

  _syncFAB() {
    const btn = document.getElementById('btn-start-wave');
    const fab = this._fabWave;
    if (this.state === 'PREPARE') {
      btn.disabled = false; btn.textContent = 'START WAVE';
      fab.disabled = false; fab.textContent = '⚔️\nSTART';
      fab.classList.remove('hidden');
    } else if (this.state === 'PICK') {
      btn.disabled = true; btn.textContent = '...';
      fab.disabled = true; fab.textContent = '⏳\nWAIT';
      fab.classList.remove('hidden');
    } else if (this.state === 'WAVE') {
      btn.disabled = true; btn.textContent = 'ÎN CURS...';
      fab.disabled = true; fab.textContent = '⚔️\nÎN CURS';
      fab.classList.remove('hidden');
    } else {
      btn.disabled = true; btn.textContent = 'START WAVE';
      fab.classList.add('hidden');
    }
  }

  _handleTouchCell(cell, pos) {
    if (this.selectedTowerType) {
      if (this.grid.isPathCell(cell.col, cell.row)) return;
      if (this.towers.find(t => t.col === cell.col && t.row === cell.row)) return;
      if (this.pendingCol === cell.col && this.pendingRow === cell.row && this._touchPending) {
        this._placeTower(cell.col, cell.row);
        this.pendingCol = -1; this.pendingRow = -1; this._touchPending = false;
      } else {
        this.pendingCol = cell.col; this.pendingRow = cell.row; this._touchPending = true;
        if (this._touchTimer) clearTimeout(this._touchTimer);
        this._touchTimer = setTimeout(() => { this.pendingCol = -1; this.pendingRow = -1; this._touchPending = false; }, 3000);
      }
      return;
    }
    const hitTower = this.towers.find(t => t.hitTest(pos.x, pos.y));
    if (hitTower) {
      if (this._popupActive && this._popupTower !== hitTower) this._closeTowerPopup();
      if (this._popupActive && this._popupTower === hitTower) return;
      const uiY = hitTower.y + hitTower.grid.cellSize / 2 + 4;
      const inUpgrade = pos.y > uiY + 30 && pos.y < uiY + 44;
      const inSell = pos.y > uiY + 48 && pos.y < uiY + 62;
      if (this.selectedGridTower === hitTower) {
        if (inSell) { this._sellTower(hitTower); this._closeTowerPopup(); return; }
        if (inUpgrade) { this._upgradeTower(hitTower); this._popupActive ? this._showTowerPopup(hitTower, hitTower.x, hitTower.y) : null; return; }
        if (hitTower.type === 'Sniper' && pos.y > uiY + 58 && pos.y < uiY + 70) {
          hitTower.targetMode = hitTower.targetMode === 'first' ? 'strongest' : 'first';
          if (this._popupActive) this._showTowerPopup(hitTower, hitTower.x, hitTower.y);
          return;
        }
      }
      this.selectedGridTower = hitTower;
      this.selectedTowerType = null; this.pendingCol = -1; this.pendingRow = -1;
      this._updateSidebarSelection();
    } else {
      this._closeTowerPopup();
      this.selectedGridTower = null;
    }
  }

  // ---- Tower actions ----

  _placeTower(col, row) {
    if (!this.selectedTowerType) return;
    const cfg = window.TOWER_DATA[this.selectedTowerType];
    if (!cfg) return;
    const discount = this._architectDiscount + (this.buffs.towerCostReduction || 0);
    const finalCost = Math.ceil(cfg.cost * (1 - discount));
    if (this.coins < finalCost) return;
    this.coins -= finalCost;
    const tower = new Tower(col, row, this.grid, this.selectedTowerType, this.buffs);
    tower.discount = discount;
    tower.totalInvested = finalCost;
    this.towers.push(tower);
    this.audio.play('tower_place');
    this.particles.pigmentBurst(tower.x, tower.y, cfg.color);
    this._updateHUD();
  }

  _sellTower(tower) {
    const value = tower.getSellValue();
    this.coins += value;
    this.towers = this.towers.filter(t => t !== tower);
    if (this.selectedGridTower === tower) this.selectedGridTower = null;
    this.audio.play('tower_sell');
    this.particles.splash(tower.x, tower.y, '#ffe600', 10);
    this._updateHUD();
  }

  _upgradeTower(tower) {
    const cost = tower.getUpgradeCost();
    if (cost < 0) return;
    if (this.coins < cost) return;
    this.coins -= cost;
    tower.upgrade(this.buffs);
    this.audio.play('tower_upgrade');
    this.particles.splash(tower.x, tower.y, '#ffe600', 12);
    this._updateHUD();
  }

  // ---- Game loop ----

  _loop(ts) {
    if (!this.running) return;
    if (this.paused) { this.lastTime = ts; requestAnimationFrame(this._boundLoop); return; }
    const dt = Math.min((ts - this.lastTime) / 1000, 0.05) * this.gameSpeed;
    this.lastTime = ts;
    if (window.SCREEN_SHAKE > 0) {
      window.SCREEN_SHAKE *= 0.85;
      if (window.SCREEN_SHAKE < 0.5) window.SCREEN_SHAKE = 0;
    }
    this.update(dt);
    this.render();
    requestAnimationFrame(this._boundLoop);
  }

  update(dt) {
    if (this.state === 'MENU' || this.state === 'VICTORY' || this.state === 'DEFEAT' || this.state === 'SHOP' || this.state === 'PICK' || this.state === 'PAUSED') return;

    for (const tower of this.towers) {
      if (tower.update(dt, this.enemies, this.projectiles)) this.audio.play('tower_shoot');
    }
    for (const proj of this.projectiles) proj.update(dt, this.enemies);
    this.projectiles = this.projectiles.filter(p => p.alive);
    for (const e of this.enemies) e.update(dt, this.enemies);

    const survivors = [];
    for (const e of this.enemies) {
      if (!e.alive) {
        if (e.escaped) {
          this.hp -= e.type === 'Boss' ? 5 : 1;
          window.SCREEN_SHAKE = Math.max(window.SCREEN_SHAKE, e.type === 'Boss' ? 12 : 6);
          this.audio.play('enemy_escape');
          this.particles.splash(e.x, e.y, '#ff00aa', 8);
        } else {
          this.coins += e.coins; this.totalCoinsEarned += e.coins;
          this.audio.play('coin_collect'); this.audio.play('enemy_die');
          this.particles.pigmentBurst(e.x, e.y, '#ffe600');
        }
      } else { survivors.push(e); }
    }
    this.enemies = survivors;

    if (this.waveText) {
      this.waveText.timer += dt;
      if (this.waveText.timer >= this.waveText.duration) {
        this.waveText = null;
      }
    }

    for (let i = window.DAMAGE_NUMBERS.length - 1; i >= 0; i--) {
      const dn = window.DAMAGE_NUMBERS[i];
      dn.life += dt;
      dn.y += dn.vy * dt;
      if (dn.life >= dn.maxLife) {
        window.DAMAGE_NUMBERS.splice(i, 1);
      }
    }

    if (this.hp <= 0) { this.hp = 0; this._onDefeat(); return; }

    if (this.state === 'WAVE') {
      if (this.wave.update(dt, this.grid.waypoints, this.grid, this.enemies)) this._onWaveComplete();
    }

    this.particles.update(dt);
    this._updateHUD();
  }

  _onWaveComplete() {
    const wn = this.wave.currentWave;
    const bonus = 20 + wn * 5;
    this.coins += bonus;
    this.totalCoinsEarned += bonus;

    window.SCREEN_SHAKE = Math.max(window.SCREEN_SHAKE, 8);
    this.waveText = { text: `VALUL ${wn} COMPLETAT!`, timer: 0, duration: 2.5 };

    if (wn >= this.wave.totalWaves) {
      this.state = 'VICTORY';
      this._finalizeRun('victory');
    } else if (wn === 5 || wn === 10 || wn === 15) {
      this._showAdBreak(() => this._showPick(wn));
    } else if (wn === 3) {
      this._showPick(wn);
    } else {
      this.state = 'PREPARE';
      this._syncFAB();
    }
    this._updateHUD();
  }

  _onDefeat() {
    this.state = 'DEFEAT';
    window.SCREEN_SHAKE = Math.max(window.SCREEN_SHAKE, 14);
    this._pendingRevive = this._cgInitialized;
    if (this._cgInitialized) {
      document.getElementById('btn-revive').classList.remove('hidden');
    }
    this._finalizeRun('defeat');
  }

  async _requestRevive() {
    if (!this._pendingRevive) return;
    if (!this._cgInitialized) return;
    try {
      await window.CrazyGames.SDK.ad.requestAd('rewarded');
      this._pendingRevive = false;
      this.hp = Math.min(this.maxHp, this.hp + 5);
      this.state = 'WAVE';
      this._showUI('none');
      document.getElementById('btn-revive').classList.add('hidden');
      this.audio.play('tower_upgrade');
      if (this._cgInitialized) window.CrazyGames.SDK.game.gameplayStart();
    } catch (_) {
      document.getElementById('btn-revive').classList.add('hidden');
    }
  }

  async _claimPigmentMultiplier() {
    if (this._pigmentClaimed || !this._cgInitialized) return;
    try {
      await window.CrazyGames.SDK.ad.requestAd('rewarded');
      this._pigmentClaimed = true;
      this.metaPoints += this._pigmentAmount;
      this._saveProgress();
      const btn = document.getElementById('btn-pigment');
      btn.textContent = '✅ Revendicat!';
      btn.disabled = true;
      document.getElementById('victory-meta').textContent = this._pigmentAmount * 2;
      this._updateMenuUI();
      this.audio.play('coin_collect');
    } catch (_) {}
  }

  _updateDailyRewardUI() {
    const btn = document.getElementById('btn-daily');
    if (!this._cgInitialized) { btn.classList.add('hidden'); return; }
    btn.classList.remove('hidden');
    const now = Date.now();
    const elapsed = now - this._lastDailyClaim;
    const cooldown = 24 * 60 * 60 * 1000;
    if (elapsed >= cooldown || this._lastDailyClaim === 0) {
      btn.textContent = '🎁 Recompensă Zilnică';
      btn.disabled = false;
      btn.style.borderColor = 'rgba(255,230,0,0.3)';
    } else {
      const remaining = cooldown - elapsed;
      const h = Math.floor(remaining / 3600000);
      const m = Math.floor((remaining % 3600000) / 60000);
      btn.textContent = `⏰ Revină în ${h}h ${m}m`;
      btn.disabled = true;
      btn.style.borderColor = 'rgba(255,255,255,0.06)';
    }
  }

  async _claimDailyReward() {
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000;
    if (this._lastDailyClaim > 0 && now - this._lastDailyClaim < cooldown) return;
    if (!this._cgInitialized) return;
    try {
      await window.CrazyGames.SDK.ad.requestAd('rewarded');
      const reward = 50 + Math.floor(Math.random() * 51);
      this.metaPoints += reward;
      this._lastDailyClaim = now;
      this._saveProgress();
      this._updateMenuUI();
      this._updateDailyRewardUI();
      this.audio.play('coin_collect');
    } catch (_) {}
  }

  _onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this._togglePause();
      return;
    }
    if (e.code === 'Space') {
      e.preventDefault();
      if (this.state === 'PREPARE') this.startWave();
      return;
    }
    const towerKeys = { '1': 'Arrow', '2': 'Cannon', '3': 'Ice', '4': 'Lightning', '5': 'Sniper' };
    if (towerKeys[e.key] && (this.state === 'PREPARE' || this.state === 'WAVE')) {
      this.selectTowerType(towerKeys[e.key]);
    }
  }

  _openLeaderboard() {
    const list = document.getElementById('lb-list');
    const scores = this.leaderboard.getTopScores(10);
    if (scores.length === 0) {
      list.innerHTML = '<div class="lb-empty">Niciun scor înregistrat</div>';
    } else {
      list.innerHTML = scores.map((s, i) => {
        const rankClass = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        return `<div class="lb-entry"><span class="lb-rank ${rankClass}">#${i + 1}</span><span class="lb-wave">Val ${s.wave}</span><span class="lb-score">${s.score}</span></div>`;
      }).join('');
    }
    this._showUI('leaderboard');
  }

  _closeLeaderboard() {
    this._updateMenuUI();
    this._showUI('menu');
  }

  _finalizeRun(type) {
    const metaGained = Math.floor(this.totalCoinsEarned / 2);
    this.metaPoints += metaGained;
    this._saveProgress();

    const score = this.totalCoinsEarned * (1 + this.wave.currentWave / 10);
    this.leaderboard.submitScore(score, { wave: this.wave.currentWave, map: this.selectedMapIndex });

    if (this._cgInitialized) {
      try {
        window.CrazyGames.SDK.game.gameplayStop();
        if (type === 'victory') window.CrazyGames.SDK.game.happyTime();
      } catch (_) {}
    }

    if (type === 'victory') {
      this._pigmentClaimed = false;
      this._pigmentAmount = metaGained;
      document.getElementById('victory-coins').textContent = this.totalCoinsEarned;
      document.getElementById('victory-meta').textContent = metaGained;
      const pigmentBtn = document.getElementById('btn-pigment');
      pigmentBtn.classList.remove('hidden');
      pigmentBtn.disabled = false;
      pigmentBtn.textContent = `💰 2x Puncte (+${metaGained} 🪙)`;
      this._showUI('victory');
    } else {
      document.getElementById('defeat-wave').textContent = this.wave.currentWave;
      document.getElementById('defeat-coins').textContent = this.totalCoinsEarned;
      document.getElementById('defeat-meta').textContent = metaGained;
      this._showUI('defeat');
    }
    this.audio.play('game_over');
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    if (window.SCREEN_SHAKE > 0.5) {
      const sx = (Math.random() - 0.5) * window.SCREEN_SHAKE * 2;
      const sy = (Math.random() - 0.5) * window.SCREEN_SHAKE * 2;
      ctx.translate(sx, sy);
    }

    this.grid.draw(ctx);
    this.grid.drawEntryExit(ctx);
    for (const tower of this.towers) tower.draw(ctx);
    for (const e of this.enemies) e.draw(ctx);
    for (const proj of this.projectiles) proj.draw(ctx);
    this.particles.draw(ctx);

    if (this.selectedGridTower) {
      this.selectedGridTower.drawRange(ctx);
      if (!this._isTouchDevice || !this._popupActive) {
        this.selectedGridTower.drawUI(ctx, this.coins);
      }
    }

    if (this.selectedTowerType) {
      if (this.mouseX >= 0 && this.mouseY >= 0) {
        const cell = this.grid.pixelToCell(this.mouseX, this.mouseY);
        const valid = !this.grid.isPathCell(cell.col, cell.row) && !this.towers.find(t => t.col === cell.col && t.row === cell.row);
        const x = cell.col * this.grid.cellSize; const y = cell.row * this.grid.cellSize;
        ctx.save();
        ctx.fillStyle = valid ? 'rgba(0,240,255,0.12)' : 'rgba(255,0,170,0.12)';
        ctx.fillRect(x, y, this.grid.cellSize, this.grid.cellSize);
        ctx.strokeStyle = valid ? '#00f0ff' : '#ff00aa'; ctx.lineWidth = 2; ctx.shadowColor = valid ? '#00f0ff' : '#ff00aa'; ctx.shadowBlur = 8;
        ctx.strokeRect(x, y, this.grid.cellSize, this.grid.cellSize); ctx.shadowBlur = 0;
        ctx.restore();
      }
      if (this.pendingCol >= 0 && this.pendingRow >= 0) {
        const px = this.pendingCol * this.grid.cellSize; const py = this.pendingRow * this.grid.cellSize;
        ctx.save();
        ctx.fillStyle = 'rgba(0,240,255,0.18)'; ctx.fillRect(px, py, this.grid.cellSize, this.grid.cellSize);
        ctx.strokeStyle = '#00f0ff'; ctx.lineWidth = 2; ctx.shadowColor = '#00f0ff'; ctx.shadowBlur = 12; ctx.setLineDash([4, 4]);
        ctx.strokeRect(px, py, this.grid.cellSize, this.grid.cellSize); ctx.setLineDash([]); ctx.shadowBlur = 0;
        ctx.fillStyle = '#00f0ff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('✓', px + this.grid.cellSize / 2, py + this.grid.cellSize / 2);
        ctx.fillStyle = 'rgba(0,240,255,0.7)'; ctx.font = '9px sans-serif'; ctx.textBaseline = 'top';
        ctx.fillText('Tap din nou pentru a plasa', px + this.grid.cellSize / 2, py + this.grid.cellSize + 2);
        ctx.restore();
      }
    }

    this._drawDamageNumbers(ctx);
    this._drawWaveText(ctx);

    ctx.restore();
  }

  _drawDamageNumbers(ctx) {
    for (const dn of window.DAMAGE_NUMBERS) {
      const alpha = 1 - dn.life / dn.maxLife;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = dn.color || '#ffe600';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = dn.color || '#ffe600';
      ctx.shadowBlur = 8;
      ctx.fillText(dn.text, dn.x, dn.y);
      ctx.restore();
    }
  }

  _drawWaveText(ctx) {
    if (!this.waveText) return;
    const t = this.waveText.timer / this.waveText.duration;
    const alpha = t < 0.15 ? t / 0.15 : t > 0.7 ? 1 - (t - 0.7) / 0.3 : 1;
    const scale = t < 0.3 ? 0.5 + 0.5 * (t / 0.3) : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.fillStyle = '#00f0ff';
    ctx.font = 'bold 36px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#00f0ff';
    ctx.shadowBlur = 24;
    ctx.fillText(this.waveText.text, 0, 0);
    ctx.restore();
  }

  _updateHUD() {
    const last = this._lastHud;
    if (this.coins !== last.coins) { document.getElementById('coins-value').textContent = this.coins; last.coins = this.coins; }
    if (this.wave.currentWave !== last.wave) { document.getElementById('wave-current').textContent = this.wave.currentWave; last.wave = this.wave.currentWave; }
    const pct = Math.max(0, (this.hp / this.maxHp) * 100);
    if (this.hp !== last.hp || this.maxHp !== last.maxHp) {
      document.getElementById('hp-fill').style.width = pct + '%';
      document.getElementById('hp-text').textContent = `${this.hp}/${this.maxHp}`;
      last.hp = this.hp; last.maxHp = this.maxHp;
    }
  }

  _showUI(name) {
    document.getElementById('ui-menu').classList.toggle('hidden', name !== 'menu');
    document.getElementById('ui-shop').classList.toggle('hidden', name !== 'shop');
    document.getElementById('ui-pick').classList.toggle('hidden', name !== 'pick');
    document.getElementById('ui-paused').classList.toggle('hidden', name !== 'paused');
    document.getElementById('ui-victory').classList.toggle('hidden', name !== 'victory');
    document.getElementById('ui-defeat').classList.toggle('hidden', name !== 'defeat');
    document.getElementById('ui-leaderboard').classList.toggle('hidden', name !== 'leaderboard');
  }
}

window.TDGameEngine = TDGameEngine;
