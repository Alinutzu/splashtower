window.DAMAGE_NUMBERS = window.DAMAGE_NUMBERS || [];
window.SCREEN_SHAKE = 0;

function addDamageNumber(x, y, text, color) {
  window.DAMAGE_NUMBERS.push({ x, y, text, color: color || '#ffe600', vy: -50, life: 0, maxLife: 0.9 });
}

class Projectile {
  constructor(x, y, target, damage, speed, color, type, aoeRadius, slowFactor, chainCount, pierce, critChance, chainDamageMult) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.speed = speed;
    this.color = color || '#00f0ff';
    this.type = type || 'arrow';
    this.aoeRadius = aoeRadius || 0;
    this.slowFactor = slowFactor || 0;
    this.chainCount = chainCount || 0;
    this.pierce = pierce || 0;
    this.critChance = critChance || 0;
    this.chainDamageMult = chainDamageMult || 0.6;
    this.alive = true;
    this.trail = [];
    this.maxTrail = this.type === 'cannon' ? 4 : this.type === 'sniper' ? 8 : 6;
    this.exploded = false;
    this.age = 0;
    this.lightningSegments = [];
    this.lightningTimer = 0;
    this.lightningDuration = 0.15;
    this.hasHit = false;
  }

  update(dt, enemies) {
    if (!this.alive) return;
    this.age += dt;

    if (this.type === 'lightning') {
      if (!this.hasHit) {
        this._hitLightning(enemies);
        this.hasHit = true;
      }
      this.lightningTimer += dt;
      if (this.lightningTimer >= this.lightningDuration) {
        this.alive = false;
      }
      return;
    }

    if (!this.target || !this.target.alive) {
      this.alive = false;
      return;
    }

    const dx = this.target.x - this.x;
    const dy = this.target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 8) {
      this._hit(dt, enemies);
      return;
    }

    const move = this.speed * dt;
    if (move >= dist) {
      this.x = this.target.x;
      this.y = this.target.y;
      this._hit(dt, enemies);
      return;
    }

    this.x += (dx / dist) * move;
    this.y += (dy / dist) * move;

    const _last = this.trail[this.trail.length - 1];
    if (!_last || Math.abs(this.x - _last.x) > 5 || Math.abs(this.y - _last.y) > 5) {
      this.trail.push({ x: this.x, y: this.y });
      if (this.trail.length > this.maxTrail) this.trail.shift();
    }
  }

  _hit(dt, enemies) {
    const hitX = this.x;
    const hitY = this.y;
    const hitTarget = this.target;

    if (this.type === 'cannon' && this.aoeRadius > 0) {
      this.alive = false;
      const damage = this.damage;
      let hitCount = 0;
      for (const e of enemies) {
        if (!e.alive) continue;
        const dx = e.x - hitX;
        const dy = e.y - hitY;
        if (dx * dx + dy * dy <= this.aoeRadius * this.aoeRadius) {
          e.takeDamage(damage);
          addDamageNumber(e.x, e.y - 8, String(damage));
          hitCount++;
        }
      }
      if (hitCount > 0) window.SCREEN_SHAKE = Math.max(window.SCREEN_SHAKE, 6);
    } else if (this.type === 'ice' && this.slowFactor > 0) {
      this.alive = false;
      if (hitTarget && hitTarget.alive) {
        hitTarget.takeDamage(this.damage);
        hitTarget.applySlow(this.slowFactor, 2.0);
        addDamageNumber(hitTarget.x, hitTarget.y - 8, String(this.damage), '#00aaff');
      }
    } else {
      if (hitTarget && hitTarget.alive) {
        let dmg = this.damage;
        let isCrit = false;
        if (this.type === 'sniper' && this.critChance > 0 && Math.random() < this.critChance) {
          dmg *= 2;
          isCrit = true;
        }
        hitTarget.takeDamage(dmg);
        addDamageNumber(hitTarget.x, hitTarget.y - 8, String(dmg), isCrit ? '#ff00aa' : undefined);
        if (hitTarget.type === 'Boss') window.SCREEN_SHAKE = Math.max(window.SCREEN_SHAKE, 10);

        if (this.type === 'arrow' && this.pierce > 0) {
          this.pierce--;
          for (const e of enemies) {
            if (!e.alive || e === hitTarget) continue;
            const dx = e.x - hitX;
            const dy = e.y - hitY;
            if (dx * dx + dy * dy <= 80 * 80) {
              e.takeDamage(this.damage);
              addDamageNumber(e.x, e.y - 8, String(this.damage));
              break;
            }
          }
        }
      }
      this.alive = false;
    }

    this.x = hitX;
    this.y = hitY;
  }

  _hitLightning(enemies) {
    if (!this.target || !this.target.alive) {
      this.alive = false;
      return;
    }
    this.lightningSegments = [{ x: this.x, y: this.y, tx: this.target.x, ty: this.target.y }];
    const chained = [this.target];
    this.target.takeDamage(this.damage);
    addDamageNumber(this.target.x, this.target.y - 8, String(this.damage), '#ffe600');
    for (let i = 0; i < this.chainCount; i++) {
      let best = null;
      let bestDist = 120 * 120;
      for (const e of enemies) {
        if (!e.alive || chained.includes(e)) continue;
        const dx = e.x - chained[chained.length - 1].x;
        const dy = e.y - chained[chained.length - 1].y;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestDist) {
          bestDist = d2;
          best = e;
        }
      }
      if (best) {
        const prev = chained[chained.length - 1];
        this.lightningSegments.push({ x: prev.x, y: prev.y, tx: best.x, ty: best.y });
        const chainDmg = Math.floor(this.damage * this.chainDamageMult);
        best.takeDamage(chainDmg);
        addDamageNumber(best.x, best.y - 8, String(chainDmg), '#ffe600');
        chained.push(best);
      }
    }
  }

  draw(ctx) {
    if (!this.alive) return;

    if (this.type === 'lightning') {
      ctx.save();
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 3;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 16;
      for (const seg of this.lightningSegments) {
        ctx.beginPath();
        ctx.moveTo(seg.x, seg.y);
        const steps = 8;
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const jitter = (Math.random() - 0.5) * 10 * (1 - this.lightningTimer / this.lightningDuration);
          const px = seg.x + (seg.tx - seg.x) * t + jitter;
          const py = seg.y + (seg.ty - seg.y) * t + jitter;
          ctx.lineTo(px, py);
        }
        ctx.stroke();
      }
      ctx.restore();
      return;
    }

    ctx.save();
    for (let i = 0; i < this.trail.length; i++) {
      const alpha = ((i + 1) / this.trail.length) * 0.4;
      const size = ((i + 1) / this.trail.length) * (this.type === 'cannon' ? 3 : this.type === 'sniper' ? 2 : 2.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.trail[i].x, this.trail[i].y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.type === 'cannon' ? 18 : this.type === 'sniper' ? 8 : 12;
    const r = this.type === 'cannon' ? 5 : this.type === 'sniper' ? 3 : 3.5;
    ctx.beginPath();
    ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

window.Projectile = Projectile;
