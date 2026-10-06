import { Car } from './Car';
import { computeEffectiveCarStats } from './data/cars';
import { Track } from './Track';
import { CarSpec, CarUpgrades, TimeOfDay, TrackSpec, WeatherType } from './types';

export class UIManager {
  public static formatTime(ms: number): string {
    if (!ms || ms <= 0 || !isFinite(ms)) return '--:--.--';
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const hundredths = Math.floor((ms % 1000) / 10);

    const mStr = String(minutes).padStart(2, '0');
    const sStr = String(seconds).padStart(2, '0');
    const hStr = String(hundredths).padStart(2, '0');
    return `${mStr}:${sStr}.${hStr}`;
  }

  public static renderCarPreview(
    canvas: HTMLCanvasElement | null,
    carSpec: CarSpec,
    upgrades?: CarUpgrades,
    angle = -Math.PI / 5
  ): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Subtle showroom floor grid & spotlight
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, 10, w * 0.5, h * 0.5, w * 0.48);
    grad.addColorStop(0, 'rgba(30, 41, 59, 0.9)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.95)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const dummyCar = new Car({
      id: 'preview',
      driverName: '',
      isPlayer: false,
      spec: carSpec,
      stats: computeEffectiveCarStats(carSpec, upgrades),
      trackGripModifier: 1,
      weather: WeatherType.CLEAR,
    });
    dummyCar.x = 0;
    dummyCar.y = 0;
    dummyCar.angle = angle;
    dummyCar.steerAngle = 0.25;

    ctx.save();
    ctx.translate(w * 0.5, h * 0.5);
    ctx.scale(2.6, 2.6);
    dummyCar.render(ctx, TimeOfDay.DAY);
    ctx.restore();
  }

  public static renderTrackPreview(canvas: HTMLCanvasElement | null, trackSpec: TrackSpec): void {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = trackSpec.terrainColor;
    ctx.fillRect(0, 0, w, h);

    const tempTrack = new Track(trackSpec);
    const b = tempTrack.bounds;
    const tw = b.maxX - b.minX;
    const th = b.maxY - b.minY;
    const pad = 20;
    const scale = Math.min((w - pad * 2) / tw, (h - pad * 2) / th);

    const offsetX = (w - tw * scale) * 0.5 - b.minX * scale;
    const offsetY = (h - th * scale) * 0.5 - b.minY * scale;

    ctx.save();
    const pts = tempTrack.points;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i].x * scale + offsetX;
      const py = pts[i].y * scale + offsetY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = trackSpec.shoulderColorA;
    ctx.stroke();

    ctx.lineWidth = 10;
    ctx.strokeStyle = trackSpec.surfaceColor;
    ctx.stroke();

    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.5)';
    ctx.stroke();
    ctx.setLineDash([]);

    // Start/finish dot
    const s0 = pts[0];
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(s0.x * scale + offsetX, s0.y * scale + offsetY, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
