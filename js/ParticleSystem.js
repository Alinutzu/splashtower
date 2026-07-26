class Particle {
  constructor(x, y, vx, vy, color, size, life) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
    this.alive = true;
  }

  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 180 * dt;
    this.life -= dt;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx) {
    const alpha = Math.max(0, this.life / this.maxLife);
    const radius = this.size * (0.3 + 0.7 * alpha);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

class ParticleSystem {
  constructor() {
    this.particles = [];
  }

  splash(x, y, color, count = 16) {
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.3;
      const speed = 80 + Math.random() * 160;
      const size = 2 + Math.random() * 5;
      const life = 0.4 + Math.random() * 0.6;
      this.particles.push(
        new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, size, life)
      );
    }
  }

  pigmentBurst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 40 + Math.random() * 80;
      const size = 1.5 + Math.random() * 2.5;
      const life = 0.3 + Math.random() * 0.4;
      this.particles.push(
        new Particle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, size, life)
      );
    }
  }

  deathBurst(x, y) {
    this.splash(x, y, '#ff00aa', 20);
    this.splash(x, y, '#00f0ff', 20);
  }

  speedTrail(x, y, vx, count = 1) {
    for (let i = 0; i < count; i++) {
      const px = x - 10 - Math.random() * 30;
      const py = y + (Math.random() - 0.5) * 20;
      const life = 0.15 + Math.random() * 0.2;
      const size = 1 + Math.random() * 2;
      const color = Math.random() > 0.5 ? '#00f0ff' : '#ff00aa';
      this.particles.push(
        new Particle(px, py, -Math.random() * 40 - 20, (Math.random() - 0.5) * 20, color, size, life)
      );
    }
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].update(dt);
      if (!this.particles[i].alive) {
        this.particles[i] = this.particles[this.particles.length - 1];
        this.particles.pop();
      }
    }
  }

  draw(ctx) {
    for (const p of this.particles) {
      p.draw(ctx);
    }
  }
}

window.ParticleSystem = ParticleSystem;
