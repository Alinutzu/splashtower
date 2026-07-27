const TOWER_DATA = {
  Arrow:     { cost: 50,  damage: 10, range: 3, cooldown: 0.5,  color: '#00f0ff', pSpeed: 300, pType: 'arrow',    aoe: 0, slow: 0,   chain: 0, label: '🗡️' },
  Cannon:    { cost: 100, damage: 40, range: 2, cooldown: 1.5,  color: '#ff00aa', pSpeed: 200, pType: 'cannon',   aoe: 1, slow: 0,   chain: 0, label: '💣' },
  Ice:       { cost: 75,  damage: 5,  range: 3, cooldown: 1.0,  color: '#00aaff', pSpeed: 250, pType: 'ice',      aoe: 0, slow: 0.5, chain: 0, label: '❄️' },
  Lightning: { cost: 120, damage: 25, range: 4, cooldown: 0.8,  color: '#ffe600', pSpeed: 400, pType: 'lightning',aoe: 0, slow: 0,   chain: 2, label: '⚡' },
  Sniper:    { cost: 150, damage: 80, range: 6, cooldown: 2.5,  color: '#ffcc00', pSpeed: 500, pType: 'sniper',   aoe: 0, slow: 0,   chain: 0, label: '🎯' },
};

class Tower {
  constructor(col, row, grid, type, buffs) {
    this.col = col;
    this.row = row;
    this.grid = grid;
    const px = grid.cellToPixel(col, row);
    this.x = px.x;
    this.y = px.y;
    this.type = type;
    this.level = 1;
    this.cooldownTimer = 0;
    this.target = null;
    this.angle = 0;
    this.maxLevel = 3;
    this.targetMode = 'first';

    const cfg = TOWER_DATA[type];
    this.baseCost = cfg.cost;
    this.cost = this.baseCost;
    this.totalInvested = this.baseCost;
    this.discount = 0;

    this.recalc(buffs || {});
  }

  recalc(buffs) {
    const cfg = TOWER_DATA[this.type];
    const dmgMult = this.level === 1 ? 1 : this.level === 2 ? 1.5 : 2;
    const rangeAdd = this.level === 1 ? 0 : this.level === 2 ? 1 : 2;

    let baseDmg = cfg.damage * dmgMult;
    if (this.type === 'Cannon') baseDmg *= (buffs.cannonDmgMult || 1);
    if (this.type === 'Sniper') baseDmg *= (buffs.sniperDmgMult || 1);

    this.damage = Math.round(baseDmg * (buffs.damageMult || 1));
    this.range = (cfg.range + rangeAdd) * this.grid.cellSize * (buffs.rangeMult || 1);
    this.cooldown = cfg.cooldown * (buffs.speedMult || 1);
    this.iceSlowFactor = Math.min(0.9, cfg.slow + (buffs.iceSlowMult || 0));
    this.lightningChain = cfg.chain + (buffs.lightningChainAdd || 0);
    this.aoeRadius = cfg.aoe * this.grid.cellSize * (this.type === 'Cannon' && this.level === 3 ? 1.5 : 1);
    this.pierce = this.type === 'Arrow' && this.level === 3 ? 1 : 0;
    this.critChance = this.type === 'Sniper' && this.level === 3 ? 0.2 : 0;
    this.chainDamageMult = this.type === 'Lightning' && this.level === 3 ? 0.8 : 0.6;
  }

  getRangeInCells() { return Math.round(this.range / this.grid.cellSize * 10) / 10; }

  upgrade(buffs) {
    if (this.level >= this.maxLevel) return -1;
    const cost = this.getUpgradeCost();
    this.level++;
    this.totalInvested += cost;
    this.recalc(buffs || {});
    return cost;
  }

  getUpgradeCost() {
    if (this.level >= this.maxLevel) return -1;
    const base = this.level === 1 ? Math.ceil(this.baseCost * 0.75) : this.baseCost;
    return Math.ceil(base * (1 - (this.discount || 0)));
  }

  getSellValue() { return Math.floor(this.totalInvested * 0.75); }

  findTarget(enemies) {
    let best = null;
    let bestProgress = -1;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      if (dx * dx + dy * dy <= this.range * this.range) {
        const progress = e.waypointIndex + (e.progressToNext || 0);
        if (progress > bestProgress) {
          bestProgress = progress;
          best = e;
        }
      }
    }
    this.target = best;
    return best;
  }

  findStrongest(enemies) {
    let best = null;
    let bestHp = -1;
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = e.x - this.x;
      const dy = e.y - this.y;
      if (dx * dx + dy * dy <= this.range * this.range) {
        if (e.hp > bestHp) {
          bestHp = e.hp;
          best = e;
        }
      }
    }
    this.target = best;
    return best;
  }

  update(dt, enemies, projectiles) {
    if (!this.target || !this.target.alive) {
      if (this.targetMode === 'strongest') this.findStrongest(enemies);
      else this.findTarget(enemies);
    }
    this.cooldownTimer -= dt;

    if (this.target) {
      const dx = this.target.x - this.x;
      const dy = this.target.y - this.y;
      if (dx * dx + dy * dy > this.range * this.range) {
        this.target = null;
        return false;
      }
      this.angle = Math.atan2(dy, dx);
      if (this.cooldownTimer <= 0) {
        this.cooldownTimer = this.cooldown;
        const cfg = TOWER_DATA[this.type];
        projectiles.push(new Projectile(
          this.x, this.y, this.target,
          this.damage, cfg.pSpeed, cfg.color, cfg.pType,
          this.aoeRadius, this.iceSlowFactor, this.lightningChain,
          this.pierce, this.critChance, this.chainDamageMult
        ));
        return true;
      }
    }
    return false;
  }

  draw(ctx) {
    ctx.save();
    const s = this.grid.cellSize;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    const cfg = TOWER_DATA[this.type];
    const glow = this.level === 3 ? 14 : this.level === 2 ? 8 : 4;
    ctx.shadowColor = cfg.color;
    ctx.shadowBlur = glow;

    if (this.type === 'Arrow') {
      ctx.strokeStyle = '#e0d9c8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-12, -7); ctx.lineTo(-10, 0); ctx.lineTo(-12, 7); ctx.closePath();
      ctx.fillStyle = '#2a2a23'; ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a14'; ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = cfg.color; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'Cannon') {
      ctx.strokeStyle = '#e0d9c8'; ctx.lineWidth = 2;
      ctx.fillStyle = '#2a2a23'; ctx.fillRect(-10, -8, 20, 16); ctx.strokeRect(-10, -8, 20, 16);
      ctx.beginPath(); ctx.arc(6, 0, 6, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = cfg.color; ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'Ice') {
      ctx.strokeStyle = '#e0d9c8'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2; const r = i % 2 === 0 ? 10 : 6; i === 0 ? ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r) : ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      ctx.closePath(); ctx.fillStyle = '#2a2a23'; ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = cfg.color; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'Lightning') {
      ctx.strokeStyle = '#e0d9c8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(4, -2); ctx.lineTo(-2, -2); ctx.lineTo(2, 10); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = cfg.color; ctx.fillRect(-1, -10, 2, 20);
    } else if (this.type === 'Sniper') {
      ctx.strokeStyle = '#e0d9c8'; ctx.lineWidth = 2;
      ctx.fillStyle = '#2a2a23'; ctx.fillRect(-4, -12, 8, 24); ctx.strokeRect(-4, -12, 8, 24);
      ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fillStyle = '#1a1a14'; ctx.fill(); ctx.stroke();
      ctx.shadowBlur = 0; ctx.fillStyle = cfg.color; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI * 2); ctx.fill();
    }

    ctx.shadowBlur = 0;
    ctx.rotate(-this.angle); ctx.translate(-this.x, -this.y);
    ctx.fillStyle = '#e0d9c8'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(`Lv${this.level}`, this.x, this.y - s / 2 + 2);
    ctx.restore();
  }

  drawRange(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.fillStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1; ctx.setLineDash([4, 6]);
    ctx.beginPath(); ctx.arc(this.x, this.y, this.range, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.setLineDash([]); ctx.restore();
  }

  drawUI(ctx, coins) {
    ctx.save();
    const s = this.grid.cellSize; const cx = this.x; const cy = this.y;
    const ui = window.TOWER_UI;
    const panelH = this.type === 'Sniper' ? ui.sniperH : ui.defaultH;
    ctx.fillStyle = 'rgba(18,18,22,0.92)'; ctx.fillRect(cx - ui.panelX, cy + s / 2 + ui.panelOffsetY, ui.panelW, panelH);
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1; ctx.strokeRect(cx - ui.panelX, cy + s / 2 + ui.panelOffsetY, ui.panelW, panelH);
    ctx.fillStyle = '#e0d9c8'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(`${this.type} Lv${this.level}`, cx, cy + s / 2 + ui.labelY);
    ctx.font = '9px sans-serif'; ctx.fillStyle = '#ffe600';
    ctx.fillText(`D:${this.damage} R:${this.getRangeInCells()}`, cx, cy + s / 2 + ui.statsY);
    const upgCost = this.getUpgradeCost(); const sellValue = this.getSellValue();
    if (upgCost > 0) { ctx.fillStyle = coins >= upgCost ? '#00f0ff' : '#605848'; ctx.fillText(`↑ ${upgCost}🪙`, cx, cy + s / 2 + ui.upgradeY); }
    else { ctx.fillStyle = '#ff00aa'; ctx.fillText('MAX', cx, cy + s / 2 + ui.upgradeY); }
    ctx.fillStyle = '#a09880'; ctx.font = '8px sans-serif'; ctx.fillText(`Sell ${sellValue}🪙`, cx, cy + s / 2 + ui.sellY);
    if (this.type === 'Sniper') {
      ctx.fillStyle = '#00f0ff'; ctx.font = '8px sans-serif';
      ctx.fillText(this.targetMode === 'first' ? '🎯 First' : '💪 Strongest', cx, cy + s / 2 + ui.sniperTargetY);
    }
    ctx.restore();
  }

  hitTest(px, py) { 
    const dx = px - this.x; 
    const dy = py - this.y; 
    const s = this.grid.cellSize;
    const ui = window.TOWER_UI;
    const panelH = this.type === 'Sniper' ? ui.sniperH : ui.defaultH;
    const inCircle = dx * dx + dy * dy < ui.hitRadius * ui.hitRadius;
    const inUI = py > this.y + s / 2 && py < this.y + s / 2 + panelH && Math.abs(px - this.x) < ui.panelX;
    return inCircle || inUI;
  }
}

const TOWER_UI = {
  panelW: 88,
  panelX: 44,
  panelOffsetY: 4,
  labelY: 18,
  statsY: 30,
  upgradeY: 42,
  sellY: 52,
  sniperTargetY: 64,
  sniperH: 76,
  defaultH: 64,
  hitRadius: 30,
  clickUpgradeFrom: 30,
  clickUpgradeTo: 44,
  clickSellFrom: 48,
  clickSellTo: 62,
  clickSnipFrom: 58,
  clickSnipTo: 70,
};

window.Tower = Tower;
window.TOWER_DATA = TOWER_DATA;
window.TOWER_UI = TOWER_UI;
