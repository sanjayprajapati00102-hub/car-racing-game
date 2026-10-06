import {
  TimeOfDay,
  TrackCoin,
  TrackDecoration,
  TrackObstacle,
  TrackPoint,
  TrackSpec,
  Vec2,
} from './types';

export class Track {
  public readonly spec: TrackSpec;
  public readonly points: TrackPoint[] = [];
  public readonly totalLength: number = 0;
  public readonly checkpoints: number[] = []; // Indices into points[]
  public readonly decorations: TrackDecoration[] = [];
  public readonly coins: TrackCoin[] = [];
  public readonly obstacles: TrackObstacle[] = [];
  public readonly bounds = { minX: -2000, maxX: 2500, minY: -1000, maxY: 2500 };

  constructor(spec: TrackSpec) {
    this.spec = spec;
    this.points = this.buildSplinePoints(spec.controlPoints, 28);
    this.totalLength =
      this.points.length > 0 ? this.points[this.points.length - 1].distanceFromStart : 1;

    this.computeBounds();
    this.buildCheckpoints(8);
    this.populateCoins();
    this.populateObstacles();
    this.populateDecorations();
  }

  private catmullRom(p0: Vec2, p1: Vec2, p2: Vec2, p3: Vec2, t: number): Vec2 {
    const t2 = t * t;
    const t3 = t2 * t;
    const x =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    return { x, y };
  }

  private buildSplinePoints(ctrl: Vec2[], subdivisionsPerSegment: number): TrackPoint[] {
    const raw: Vec2[] = [];
    const n = ctrl.length;

    for (let i = 0; i < n; i++) {
      const p0 = ctrl[(i - 1 + n) % n];
      const p1 = ctrl[i];
      const p2 = ctrl[(i + 1) % n];
      const p3 = ctrl[(i + 2) % n];

      for (let s = 0; s < subdivisionsPerSegment; s++) {
        const t = s / subdivisionsPerSegment;
        raw.push(this.catmullRom(p0, p1, p2, p3, t));
      }
    }

    const result: TrackPoint[] = [];
    let dist = 0;
    const total = raw.length;

    for (let i = 0; i < total; i++) {
      const prev = raw[(i - 1 + total) % total];
      const curr = raw[i];
      const next = raw[(i + 1) % total];
      const next2 = raw[(i + 4) % total];
      const prev2 = raw[(i - 4 + total) % total];

      if (i > 0) {
        dist += Math.hypot(curr.x - prev.x, curr.y - prev.y);
      }

      const dx = next.x - prev.x;
      const dy = next.y - prev.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = dx / len;
      const ty = dy / len;
      const nx = -ty;
      const ny = tx;

      // Approximate curvature over a wider window
      const a1 = Math.atan2(curr.y - prev2.y, curr.x - prev2.x);
      const a2 = Math.atan2(next2.y - curr.y, next2.x - curr.x);
      let diff = a2 - a1;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;

      result.push({
        x: curr.x,
        y: curr.y,
        tx,
        ty,
        nx,
        ny,
        curvature: Math.abs(diff),
        distanceFromStart: dist,
      });
    }

    return result;
  }

  private computeBounds(): void {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const p of this.points) {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const pad = this.spec.roadWidth * 2.5;
    this.bounds.minX = minX - pad;
    this.bounds.maxX = maxX + pad;
    this.bounds.minY = minY - pad;
    this.bounds.maxY = maxY + pad;
  }

  private buildCheckpoints(count: number): void {
    const step = Math.floor(this.points.length / count);
    for (let i = 0; i < count; i++) {
      this.checkpoints.push((i * step) % this.points.length);
    }
  }

  private populateCoins(): void {
    const total = this.points.length;
    const step = Math.floor(total / 18);
    for (let i = step; i < total - 12; i += step) {
      const pt = this.points[i];
      // Offset alternatingly from centerline
      const sideOffset = ((i / step) % 2 === 0 ? 1 : -1) * (this.spec.roadWidth * 0.22);
      this.coins.push({
        id: `coin_${i}`,
        x: pt.x + pt.nx * sideOffset,
        y: pt.y + pt.ny * sideOffset,
        collected: false,
        respawnTimer: 0,
      });
    }
  }

  private populateObstacles(): void {
    const total = this.points.length;
    const step = Math.floor(total / 7);
    for (let i = step; i < total - 24; i += step) {
      const pt = this.points[i];
      const side = (i % 2 === 0 ? 1 : -1) * (this.spec.roadWidth * 0.25);
      let type: TrackObstacle['type'] = 'oil';
      if (this.spec.id === 'snow_track') type = 'ice_patch';
      else if (this.spec.id === 'forest_track') type = 'puddle';

      this.obstacles.push({
        id: `obs_${i}`,
        x: pt.x + pt.nx * side,
        y: pt.y + pt.ny * side,
        radius: 22,
        type,
        angle: Math.atan2(pt.ty, pt.tx),
      });
    }
  }

  private populateDecorations(): void {
    const total = this.points.length;
    const halfRoad = this.spec.roadWidth * 0.5;

    // Grandstand near start/finish line
    if (total > 8) {
      const startPt = this.points[4];
      this.decorations.push({
        x: startPt.x - startPt.nx * (halfRoad + 95),
        y: startPt.y - startPt.ny * (halfRoad + 95),
        type: 'grandstand',
        radius: 60,
        width: 150,
        height: 46,
        rotation: Math.atan2(startPt.ty, startPt.tx),
        color: '#334155',
      });
    }

    for (let i = 0; i < total; i += 6) {
      const pt = this.points[i];
      const angle = Math.atan2(pt.ty, pt.tx);

      // Streetlights or Neon Pylons along track edges
      if (this.spec.id === 'city_track' || this.spec.id === 'night_track') {
        const side = i % 12 === 0 ? 1 : -1;
        this.decorations.push({
          x: pt.x + pt.nx * side * (halfRoad + 26),
          y: pt.y + pt.ny * side * (halfRoad + 26),
          type: this.spec.id === 'night_track' ? 'neon_pylon' : 'streetlight',
          radius: 8,
          rotation: angle,
          color: this.spec.id === 'night_track' ? '#06b6d4' : '#cbd5e1',
        });
      }

      // Outer scenery props
      for (const side of [-1, 1]) {
        const distFromCenter = halfRoad + 85 + ((i * 37) % 140);
        const px = pt.x + pt.nx * side * distFromCenter;
        const py = pt.y + pt.ny * side * distFromCenter;

        // Ensure decoration isn't overlapping another segment of road
        const nearest = this.getNearestPoint(px, py);
        if (nearest.distance < halfRoad + 55) continue;

        if (this.spec.id === 'city_track' || this.spec.id === 'night_track') {
          if (i % 12 === 0) {
            this.decorations.push({
              x: px,
              y: py,
              type: 'building',
              radius: 48,
              width: 68 + ((i * 13) % 40),
              height: 68 + ((i * 19) % 40),
              rotation: angle,
              color: this.spec.id === 'night_track' ? '#1e1b4b' : '#1e293b',
            });
          }
        } else if (this.spec.id === 'desert_track') {
          this.decorations.push({
            x: px,
            y: py,
            type: i % 12 === 0 ? 'rock' : 'cactus',
            radius: i % 12 === 0 ? 28 : 14,
            rotation: (i * 1.1) % (Math.PI * 2),
            color: i % 12 === 0 ? '#7c2d12' : '#15803d',
          });
        } else if (this.spec.id === 'forest_track') {
          this.decorations.push({
            x: px,
            y: py,
            type: 'pine',
            radius: 26 + (i % 12),
            rotation: (i * 0.7) % (Math.PI * 2),
            color: i % 12 === 0 ? '#166534' : '#14532d',
          });
        } else if (this.spec.id === 'snow_track') {
          this.decorations.push({
            x: px,
            y: py,
            type: i % 12 === 0 ? 'snowdrift' : 'pine',
            radius: 26,
            rotation: 0,
            color: i % 12 === 0 ? '#f8fafc' : '#0f766e',
          });
        }
      }
    }
  }

  public getStartGridPosition(gridIndex: number, totalCars: number): { x: number; y: number; angle: number } {
    const totalPts = this.points.length;
    // Place grid slightly behind start line (index 0)
    const row = Math.floor(gridIndex / 2);
    const col = gridIndex % 2 === 0 ? -1 : 1;
    const ptIndex = (totalPts - 3 - row * 3 + totalPts) % totalPts;
    const pt = this.points[ptIndex];
    const lateralOffset = col * (this.spec.roadWidth * 0.22);

    return {
      x: pt.x + pt.nx * lateralOffset,
      y: pt.y + pt.ny * lateralOffset,
      angle: Math.atan2(pt.ty, pt.tx),
    };
  }

  public getNearestPoint(x: number, y: number, hintIndex?: number): {
    index: number;
    point: TrackPoint;
    distance: number;
    signedLateral: number;
  } {
    let bestIdx = 0;
    let bestDistSq = Infinity;
    const total = this.points.length;

    if (hintIndex !== undefined && hintIndex >= 0) {
      // Search local window first
      const windowSize = 32;
      for (let offset = -windowSize; offset <= windowSize; offset++) {
        const idx = (hintIndex + offset + total) % total;
        const p = this.points[idx];
        const dx = x - p.x;
        const dy = y - p.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          bestIdx = idx;
        }
      }
      if (bestDistSq < this.spec.roadWidth * this.spec.roadWidth * 2.2) {
        const pt = this.points[bestIdx];
        const dx = x - pt.x;
        const dy = y - pt.y;
        const signedLateral = dx * pt.nx + dy * pt.ny;
        return {
          index: bestIdx,
          point: pt,
          distance: Math.sqrt(bestDistSq),
          signedLateral,
        };
      }
    }

    // Full search fallback
    for (let i = 0; i < total; i++) {
      const p = this.points[i];
      const dx = x - p.x;
      const dy = y - p.y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }

    const pt = this.points[bestIdx];
    const dx = x - pt.x;
    const dy = y - pt.y;
    const signedLateral = dx * pt.nx + dy * pt.ny;
    return {
      index: bestIdx,
      point: pt,
      distance: Math.sqrt(bestDistSq),
      signedLateral,
    };
  }

  public updateCoins(dt: number): void {
    for (const c of this.coins) {
      if (c.collected) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          c.collected = false;
        }
      }
    }
  }

  public render(ctx: CanvasRenderingContext2D, timeOfDay: TimeOfDay): void {
    const pts = this.points;
    if (pts.length === 0) return;

    ctx.save();

    // 1. Outer barrier wall / shadow base
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    ctx.lineWidth = this.spec.roadWidth + 36;
    ctx.strokeStyle = '#0f172a';
    ctx.stroke();

    // 2. Alternating curb / rumble strips
    ctx.lineWidth = this.spec.roadWidth + 18;
    ctx.strokeStyle = this.spec.shoulderColorA;
    ctx.stroke();

    ctx.setLineDash([28, 28]);
    ctx.lineWidth = this.spec.roadWidth + 18;
    ctx.strokeStyle = this.spec.shoulderColorB;
    ctx.stroke();
    ctx.setLineDash([]);

    // 3. Main asphalt surface
    ctx.lineWidth = this.spec.roadWidth;
    ctx.strokeStyle = this.spec.surfaceColor;
    ctx.stroke();

    // 4. Subtle racing groove / inner edge lines
    ctx.lineWidth = this.spec.roadWidth - 14;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    // 5. Center dashed lane line
    ctx.setLineDash([34, 38]);
    ctx.lineWidth = 3;
    ctx.strokeStyle =
      this.spec.id === 'night_track' ? 'rgba(6, 182, 212, 0.35)' : 'rgba(248, 250, 252, 0.25)';
    ctx.stroke();
    ctx.setLineDash([]);

    // 6. Subtle checkpoint arches / road markings
    for (let c = 1; c < this.checkpoints.length; c++) {
      const cpIdx = this.checkpoints[c];
      const cp = pts[cpIdx];
      const half = this.spec.roadWidth * 0.48;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(cp.x - cp.nx * half, cp.y - cp.ny * half);
      ctx.lineTo(cp.x + cp.nx * half, cp.y + cp.ny * half);
      ctx.stroke();
    }

    // 7. Start / Finish checkered line at pts[0]
    this.renderStartFinishLine(ctx, pts[0]);

    // 8. Surface obstacles (oil slicks, puddles, ice patches)
    this.renderObstacles(ctx);

    // 9. Collectible Coins
    this.renderCoins(ctx);

    // 10. Environment decorations
    this.renderDecorations(ctx, timeOfDay);

    ctx.restore();
  }

  private renderStartFinishLine(ctx: CanvasRenderingContext2D, startPt: TrackPoint): void {
    ctx.save();
    ctx.translate(startPt.x, startPt.y);
    ctx.rotate(Math.atan2(startPt.ty, startPt.tx));

    const halfWidth = this.spec.roadWidth * 0.5;
    const rows = 2;
    const cols = 12;
    const cellW = 10;
    const cellH = (halfWidth * 2) / cols;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f8fafc' : '#0f172a';
        ctx.fillRect(-cellW + r * cellW, -halfWidth + c * cellH, cellW, cellH + 0.5);
      }
    }
    ctx.restore();
  }

  private renderObstacles(ctx: CanvasRenderingContext2D): void {
    for (const obs of this.obstacles) {
      ctx.save();
      ctx.translate(obs.x, obs.y);
      ctx.rotate(obs.angle);

      if (obs.type === 'oil') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.beginPath();
        ctx.ellipse(0, 0, obs.radius * 1.15, obs.radius * 0.75, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(168, 85, 247, 0.35)';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (obs.type === 'puddle') {
        ctx.fillStyle = 'rgba(14, 165, 233, 0.38)';
        ctx.beginPath();
        ctx.ellipse(0, 0, obs.radius * 1.2, obs.radius * 0.85, -0.3, 0, Math.PI * 2);
        ctx.fill();
      } else if (obs.type === 'ice_patch') {
        ctx.fillStyle = 'rgba(186, 230, 253, 0.52)';
        ctx.beginPath();
        ctx.ellipse(0, 0, obs.radius * 1.3, obs.radius * 0.85, 0.1, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  private renderCoins(ctx: CanvasRenderingContext2D): void {
    const pulse = Math.sin(performance.now() * 0.006) * 1.5;
    for (const c of this.coins) {
      if (c.collected) continue;
      ctx.save();
      ctx.translate(c.x, c.y);

      // Outer glow
      ctx.fillStyle = 'rgba(251, 191, 36, 0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 14 + pulse, 0, Math.PI * 2);
      ctx.fill();

      // Gold coin disc
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#fef08a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Inner emblem
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(-2, -4, 4, 8);
      ctx.restore();
    }
  }

  private renderDecorations(ctx: CanvasRenderingContext2D, timeOfDay: TimeOfDay): void {
    const isNight = timeOfDay === TimeOfDay.NIGHT;

    for (const d of this.decorations) {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(d.rotation);

      switch (d.type) {
        case 'grandstand': {
          const w = d.width || 140;
          const h = d.height || 45;
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.strokeStyle = '#475569';
          ctx.lineWidth = 2;
          ctx.strokeRect(-w / 2, -h / 2, w, h);
          // Steps
          ctx.fillStyle = '#334155';
          ctx.fillRect(-w / 2 + 4, -h / 2 + 6, w - 8, 8);
          ctx.fillRect(-w / 2 + 4, -h / 2 + 18, w - 8, 8);
          ctx.fillRect(-w / 2 + 4, -h / 2 + 30, w - 8, 8);
          break;
        }
        case 'building': {
          const w = d.width || 70;
          const h = d.height || 70;
          ctx.fillStyle = d.color;
          ctx.fillRect(-w / 2, -h / 2, w, h);
          ctx.strokeStyle = isNight ? '#38bdf8' : '#475569';
          ctx.lineWidth = 2;
          ctx.strokeRect(-w / 2, -h / 2, w, h);

          // Rooftop details / windows
          ctx.fillStyle = isNight ? 'rgba(250, 204, 21, 0.65)' : 'rgba(148, 163, 184, 0.25)';
          for (let wx = -w / 2 + 10; wx < w / 2 - 12; wx += 16) {
            for (let wy = -h / 2 + 10; wy < h / 2 - 12; wy += 16) {
              ctx.fillRect(wx, wy, 8, 8);
            }
          }
          break;
        }
        case 'pine':
        case 'tree': {
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.beginPath();
          ctx.arc(4, 4, d.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = this.spec.id === 'snow_track' ? '#e2e8f0' : '#22c55e';
          ctx.globalAlpha = 0.45;
          ctx.beginPath();
          ctx.arc(-3, -3, d.radius * 0.6, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'cactus': {
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.arc(0, 0, d.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#dcfce7';
          ctx.lineWidth = 1.5;
          ctx.stroke();
          break;
        }
        case 'rock':
        case 'snowdrift': {
          ctx.fillStyle = d.color;
          ctx.beginPath();
          ctx.ellipse(0, 0, d.radius * 1.2, d.radius * 0.85, 0, 0, Math.PI * 2);
          ctx.fill();
          break;
        }
        case 'streetlight':
        case 'neon_pylon': {
          ctx.fillStyle = d.type === 'neon_pylon' ? '#ec4899' : '#f8fafc';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();

          if (isNight || d.type === 'neon_pylon') {
            const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 48);
            glow.addColorStop(
              0,
              d.type === 'neon_pylon' ? 'rgba(236, 72, 153, 0.42)' : 'rgba(254, 240, 138, 0.36)'
            );
            glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(0, 0, 48, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
      }

      ctx.restore();
    }
  }
}
