const ENEMY_DATA = {
  Grunt:  { hp: 80,  speed: 1.2, coins: 10, size: 10, color: '#e0d9c8' },
  Scout:  { hp: 30,  speed: 2.0, coins: 5,  size: 7,  color: '#a09880' },
  Tank:   { hp: 200, speed: 0.7, coins: 25, size: 14, color: '#605848' },
  Healer: { hp: 60,  speed: 1.0, coins: 15, size: 10, color: '#00ff88' },
  Boss:   { hp: 500, speed: 0.5, coins: 100,size: 20, color: '#ff00aa' },
};

const MODIFIER_COLORS = {
  shield: '#00aaff',
  fast:   '#ffe600',
  regen:  '#00ff88',
  armored:'#888888',
};
const MODIFIER_ICONS = {
  shield: '🛡️',
  fast:   '⚡',
  regen:  '💚',
  armored:'🔘',
};

class Enemy {
  constructor(waypoints, type, hpMult, speedMult, grid, modifier) {
    this.waypoints = waypoints;
    this.waypointIndex = 0;
    this.alive = true;
    this.escaped = false;
    this.type = type;
    this.grid = grid;
    this.modifier = modifier || null;

    const cfg = ENEMY_DATA[type];
    const modSpeed = this.modifier === 'fast' ? 1.8 : 1;
    this.maxHp = Math.round(cfg.hp * hpMult * (this.modifier === 'armored' ? 1.5 : 1));
    this.hp = this.maxHp;
    this.baseSpeed = cfg.speed * speedMult * modSpeed;
    this.speed = this.baseSpeed;
    this.coins = cfg.coins;
    this.size = cfg.size;
    this.color = cfg.color;

    this.x = waypoints[0].x;
    this.y = waypoints[0].y;
    this.progressToNext = 0;

    this.slowTimer = 0;
    this.isHealer = type === 'Healer';
    this.healCooldown = 0;

    if (this.modifier === 'shield') this.hasShield = true;
    else this.hasShield = false;

    this.regenTimer = 0;
    this._healTargets = [];
  }

  update(dt, enemies) {
    if (!this.alive) return;

    if (this.modifier === 'regen') {
      this.regenTimer += dt;
      if (this.regenTimer >= 0.5) { this.regenTimer = 0; this.hp = Math.min(this.maxHp, this.hp + 1); }
    }

    if (this.slowTimer > 0) {
      this.slowTimer -= dt;
      this.speed = this.baseSpeed * 0.5;
    } else {
      this.speed = this.baseSpeed;
    }

    if (this.isHealer) {
      this._healTargets = [];
      this.healCooldown -= dt;
      if (this.healCooldown <= 0) {
        this.healCooldown = 1.0;
        const healRange = this.grid ? this.grid.cellSize * 3 : 120;
        for (const e of enemies) {
          if (e !== this && e.alive && e.hp < e.maxHp) {
            const dx = e.x - this.x;
            const dy = e.y - this.y;
            if (dx * dx + dy * dy < healRange * healRange) {
              e.hp = Math.min(e.maxHp, e.hp + 12);
              this._healTargets.push(e);
            }
          }
        }
      }
    }

    const target = this.waypoints[this.waypointIndex + 1];
    if (!target) { this.alive = false; this.escaped = true; return; }
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const moveAmount = this.speed * (this.grid ? this.grid.cellSize : 40) * dt;

    if (moveAmount >= dist) {
      this.x = target.x;
      this.y = target.y;
      this.waypointIndex++;
      this.progressToNext = 0;
    } else {
      this.x += (dx / dist) * moveAmount;
      this.y += (dy / dist) * moveAmount;
      this.progressToNext = moveAmount / dist;
    }

    if (this.x >= (this.grid ? this.grid.width : 800)) {
      this.alive = false;
      this.escaped = true;
    }
  }

  takeDamage(amount) {
    if (!this.alive) return;
    if (this.hasShield) {
      this.hasShield = false;
      return;
    }
    if (this.modifier === 'armored') {
      amount = Math.ceil(amount * 0.5);
    }
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.alive = false; }
  }

  applySlow(factor, duration) {
    if (this.type === 'Boss' || this.type === 'Tank') return;
    if (this.modifier === 'fast') { factor *= 0.5; duration *= 0.5; }
    this.slowTimer = Math.max(this.slowTimer, duration);
    this.speed = this.baseSpeed * (1 - factor);
  }

  draw(ctx) {
    if (!this.alive) return;
    ctx.save();

    ctx.strokeStyle = this.modifier ? MODIFIER_COLORS[this.modifier] : this.color;
    ctx.lineWidth = this.modifier === 'armored' ? 3 : 2;
    ctx.shadowColor = this.modifier ? MODIFIER_COLORS[this.modifier] : this.color;
    ctx.shadowBlur = this.type === 'Boss' ? 16 : this.modifier ? 8 : 4;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.modifier === 'armored' ? '#3a3a30' : '#2a2a23';
    ctx.fill();
    ctx.stroke();

    ctx.shadowBlur = 0;

    if (this.modifier) {
      ctx.font = '9px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      ctx.fillText(MODIFIER_ICONS[this.modifier], this.x, this.y - this.size - 8);
    }

    if (this.type === 'Scout') {
      ctx.fillStyle = '#ff00aa'; ctx.beginPath(); ctx.arc(this.x + 3, this.y - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe600'; ctx.beginPath(); ctx.arc(this.x + 8, this.y + 1, 1.5, 0, Math.PI * 2); ctx.fill();
    } else if (this.type === 'Boss') {
      ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('👑', this.x, this.y);
    } else {
      ctx.fillStyle = '#ff00aa'; ctx.beginPath(); ctx.arc(this.x + 3, this.y - 2, 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe600'; ctx.beginPath(); ctx.arc(this.x + 8, this.y + 1, 1.5, 0, Math.PI * 2); ctx.fill();
    }

    const barW = this.type === 'Boss' ? 30 : 20;
    const barH = this.type === 'Boss' ? 4 : 3;
    const barX = this.x - barW / 2;
    const barY = this.y - this.size - 6;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(barX, barY, barW, barH);
    const hpRatio = this.hp / this.maxHp;
    const hpc = hpRatio > 0.5 ? '#00f0ff' : hpRatio > 0.25 ? '#ffe600' : '#ff00aa';
    ctx.fillStyle = hpc; ctx.shadowColor = hpc; ctx.shadowBlur = 4;
    ctx.fillRect(barX, barY, barW * hpRatio, barH);

    if (this.hasShield) {
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(0,170,255,0.4)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 4, 0, Math.PI * 2); ctx.stroke();
    }

    if (this.slowTimer > 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(0,170,255,0.25)'; ctx.beginPath(); ctx.arc(this.x, this.y, this.size + 3, 0, Math.PI * 2); ctx.fill();
    }

    if (this.isHealer && this._healTargets.length > 0) {
      for (const t of this._healTargets) {
        if (!t.alive) continue;
        const dx = t.x - this.x;
        const dy = t.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const wave = Math.sin(performance.now() / 200) * 0.3 + 0.7;
        ctx.strokeStyle = `rgba(0,255,136,${wave * 0.5})`;
        ctx.lineWidth = wave * 2.5;
        ctx.shadowColor = '#00ff88';
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.moveTo(this.x, this.y);
        const midX = (this.x + t.x) / 2 + (Math.random() - 0.5) * 6;
        const midY = (this.y + t.y) / 2 - 8 + (Math.random() - 0.5) * 6;
        ctx.quadraticCurveTo(midX, midY, t.x, t.y);
        ctx.stroke();
      }
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

window.Enemy = Enemy;
window.ENEMY_DATA = ENEMY_DATA;
