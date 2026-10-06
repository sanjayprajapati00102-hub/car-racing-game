import { Car } from './Car';

export class Camera {
  public x = 0;
  public y = 0;
  public zoom = 1.0;
  private shakeIntensity = 0;
  private shakeOffsetX = 0;
  private shakeOffsetY = 0;
  private screenShakeEnabled = true;

  public setScreenShakeEnabled(enabled: boolean): void {
    this.screenShakeEnabled = enabled;
    if (!enabled) {
      this.shakeIntensity = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  public snapTo(target: Car): void {
    this.x = target.x;
    this.y = target.y;
    this.zoom = 1.0;
    this.shakeIntensity = 0;
  }

  public addShake(amount: number): void {
    if (!this.screenShakeEnabled) return;
    this.shakeIntensity = Math.min(22, Math.max(this.shakeIntensity, amount));
  }

  public update(dt: number, target: Car): void {
    // Look ahead slightly in direction of car velocity so upcoming turns are clearly visible
    const lookAheadFactor = 0.22;
    const desiredX = target.x + target.vx * lookAheadFactor;
    const desiredY = target.y + target.vy * lookAheadFactor;

    const followRate = Math.min(1, dt * 8.5);
    this.x += (desiredX - this.x) * followRate;
    this.y += (desiredY - this.y) * followRate;

    // Slight dynamic zoom based on speed and nitro
    const speedRatio = Math.min(1.2, Math.hypot(target.vx, target.vy) / target.physicsParams.maxSpeed);
    const desiredZoom = 1.02 - speedRatio * 0.14 - (target.nitroActive ? 0.04 : 0);
    this.zoom += (desiredZoom - this.zoom) * Math.min(1, dt * 4);

    if (target.nitroActive && this.screenShakeEnabled) {
      this.shakeIntensity = Math.max(this.shakeIntensity, 2.2);
    }

    if (this.shakeIntensity > 0.1) {
      this.shakeOffsetX = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() - 0.5) * 2 * this.shakeIntensity;
      this.shakeIntensity *= Math.max(0, 1 - dt * 9);
    } else {
      this.shakeIntensity = 0;
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  public applyTransform(ctx: CanvasRenderingContext2D, viewportWidth: number, viewportHeight: number): void {
    ctx.translate(
      viewportWidth * 0.5 + this.shakeOffsetX,
      viewportHeight * 0.5 + this.shakeOffsetY
    );
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }
}
