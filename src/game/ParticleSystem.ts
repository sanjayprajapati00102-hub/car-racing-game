import { WeatherType } from './types';

interface Particle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  endSize: number;
  alpha: number;
  life: number;
  maxLife: number;
  color: string;
  type: 'smoke' | 'flame' | 'spark' | 'dust';
}

interface SkidMark {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  alpha: number;
}

interface WeatherDrop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
}

export class ParticleSystem {
  private pool: Particle[] = [];
  private skidMarks: SkidMark[] = [];
  private weatherParticles: WeatherDrop[] = [];
  private maxParticles = 450;
  private maxSkids = 360;
  private enabled = true;

  constructor() {
    for (let i = 0; i < this.maxParticles; i++) {
      this.pool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        size: 4,
        endSize: 8,
        alpha: 1,
        life: 0,
        maxLife: 1,
        color: '#ffffff',
        type: 'smoke',
      });
    }

    for (let i = 0; i < 140; i++) {
      this.weatherParticles.push({
        x: Math.random() * 1600,
        y: Math.random() * 1000,
        vx: -80,
        vy: 450,
        size: 2,
        alpha: 0.4 + Math.random() * 0.4,
      });
    }
  }

  public setEnabled(enabled: boolean, quality: 'Low' | 'Medium' | 'High' = 'High'): void {
    this.enabled = enabled;
    this.maxSkids = quality === 'Low' ? 120 : quality === 'Medium' ? 240 : 380;
  }

  public clear(): void {
    for (const p of this.pool) {
      p.active = false;
    }
    this.skidMarks.length = 0;
  }

  private spawn(params: Omit<Particle, 'active' | 'life'>): void {
    if (!this.enabled) return;
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) {
        p.active = true;
        p.x = params.x;
        p.y = params.y;
        p.vx = params.vx;
        p.vy = params.vy;
        p.size = params.size;
        p.endSize = params.endSize;
        p.alpha = params.alpha;
        p.life = 0;
        p.maxLife = params.maxLife;
        p.color = params.color;
        p.type = params.type;
        return;
      }
    }
  }

  public emitTireSmoke(x: number, y: number, carVx: number, carVy: number): void {
    if (!this.enabled) return;
    this.spawn({
      x: x + (Math.random() - 0.5) * 6,
      y: y + (Math.random() - 0.5) * 6,
      vx: carVx * 0.15 + (Math.random() - 0.5) * 28,
      vy: carVy * 0.15 + (Math.random() - 0.5) * 28,
      size: 5,
      endSize: 18,
      alpha: 0.42,
      maxLife: 0.55 + Math.random() * 0.25,
      color: '#e2e8f0',
      type: 'smoke',
    });
  }

  public emitNitroFlame(x: number, y: number, backwardAngle: number): void {
    if (!this.enabled) return;
    for (let i = 0; i < 2; i++) {
      const spread = (Math.random() - 0.5) * 0.35;
      const speed = 160 + Math.random() * 120;
      const isCore = Math.random() > 0.45;
      this.spawn({
        x,
        y,
        vx: Math.cos(backwardAngle + spread) * speed,
        vy: Math.sin(backwardAngle + spread) * speed,
        size: isCore ? 5 : 8,
        endSize: 1,
        alpha: 0.9,
        maxLife: 0.14 + Math.random() * 0.08,
        color: isCore ? '#38bdf8' : '#f97316',
        type: 'flame',
      });
    }
  }

  public emitCollisionSparks(x: number, y: number, count = 14): void {
    if (!this.enabled) return;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 90 + Math.random() * 220;
      this.spawn({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 3.5,
        endSize: 0.5,
        alpha: 1,
        maxLife: 0.22 + Math.random() * 0.2,
        color: Math.random() > 0.3 ? '#fbbf24' : '#f87171',
        type: 'spark',
      });
    }
  }

  public emitSurfaceDust(x: number, y: number, color: string): void {
    if (!this.enabled) return;
    this.spawn({
      x: x + (Math.random() - 0.5) * 8,
      y: y + (Math.random() - 0.5) * 8,
      vx: (Math.random() - 0.5) * 40,
      vy: (Math.random() - 0.5) * 40,
      size: 4,
      endSize: 12,
      alpha: 0.5,
      maxLife: 0.35 + Math.random() * 0.2,
      color,
      type: 'dust',
    });
  }

  public addSkidSegment(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.enabled) return;
    this.skidMarks.push({ x1, y1, x2, y2, alpha: 0.38 });
    if (this.skidMarks.length > this.maxSkids) {
      this.skidMarks.shift();
    }
  }

  public update(dt: number, weather: WeatherType, viewportWidth: number, viewportHeight: number): void {
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.95;
      p.vy *= 0.95;
    }

    // Slowly fade oldest skid marks
    for (let i = this.skidMarks.length - 1; i >= 0; i--) {
      this.skidMarks[i].alpha -= dt * 0.012;
      if (this.skidMarks[i].alpha <= 0.02) {
        this.skidMarks.splice(i, 1);
      }
    }

    // Update screen-space weather drops
    if (weather === WeatherType.RAIN || weather === WeatherType.SNOW) {
      for (const w of this.weatherParticles) {
        if (weather === WeatherType.RAIN) {
          w.vx = -160;
          w.vy = 680;
        } else {
          w.vx = -45 + Math.sin(w.y * 0.02) * 25;
          w.vy = 135;
        }
        w.x += w.vx * dt;
        w.y += w.vy * dt;

        if (w.y > viewportHeight) {
          w.y = -10;
          w.x = Math.random() * viewportWidth;
        }
        if (w.x < 0) {
          w.x = viewportWidth;
        }
      }
    }
  }

  public renderSkidMarks(ctx: CanvasRenderingContext2D): void {
    if (this.skidMarks.length === 0) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 4;
    for (let i = 0; i < this.skidMarks.length; i++) {
      const s = this.skidMarks[i];
      ctx.strokeStyle = `rgba(15, 23, 42, ${s.alpha.toFixed(2)})`;
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.restore();
  }

  public renderWorldParticles(ctx: CanvasRenderingContext2D): void {
    if (!this.enabled) return;
    ctx.save();
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      const t = p.life / p.maxLife;
      const currentSize = p.size + (p.endSize - p.size) * t;
      const currentAlpha = p.alpha * (1 - t);

      ctx.globalAlpha = Math.max(0, currentAlpha);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, currentSize), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  public renderWeatherAndSpeedOverlay(
    ctx: CanvasRenderingContext2D,
    weather: WeatherType,
    speedRatio: number,
    nitroActive: boolean,
    width: number,
    height: number
  ): void {
    ctx.save();

    if (weather === WeatherType.RAIN && this.enabled) {
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.38)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      for (const w of this.weatherParticles) {
        ctx.moveTo(w.x, w.y);
        ctx.lineTo(w.x - 4, w.y + 16);
      }
      ctx.stroke();
    } else if (weather === WeatherType.SNOW && this.enabled) {
      ctx.fillStyle = 'rgba(248, 250, 252, 0.72)';
      for (const w of this.weatherParticles) {
        ctx.beginPath();
        ctx.arc(w.x, w.y, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (weather === WeatherType.FOG) {
      const fogGrad = ctx.createRadialGradient(
        width * 0.5,
        height * 0.5,
        Math.min(width, height) * 0.2,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.65
      );
      fogGrad.addColorStop(0, 'rgba(203, 213, 225, 0.05)');
      fogGrad.addColorStop(1, 'rgba(148, 163, 184, 0.42)');
      ctx.fillStyle = fogGrad;
      ctx.fillRect(0, 0, width, height);
    }

    // Radial speed lines when driving near top speed or using nitro
    if (this.enabled && (nitroActive || speedRatio > 0.85)) {
      const intensity = nitroActive ? 0.35 : (speedRatio - 0.85) * 1.4;
      const cx = width / 2;
      const cy = height / 2;
      ctx.strokeStyle = nitroActive
        ? `rgba(56, 189, 248, ${intensity.toFixed(2)})`
        : `rgba(248, 250, 252, ${(intensity * 0.6).toFixed(2)})`;
      ctx.lineWidth = 2;

      const timeSeed = Math.floor(performance.now() / 45);
      for (let i = 0; i < 16; i++) {
        const angle = ((i * 137.5 + timeSeed * 23) % 360) * (Math.PI / 180);
        const r1 = Math.min(width, height) * (0.36 + ((i * 19) % 10) * 0.015);
        const r2 = r1 + 65 + (nitroActive ? 45 : 15);
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(angle) * r1, cy + Math.sin(angle) * r1);
        ctx.lineTo(cx + Math.cos(angle) * r2, cy + Math.sin(angle) * r2);
        ctx.stroke();
      }
    }

    ctx.restore();
  }
}
