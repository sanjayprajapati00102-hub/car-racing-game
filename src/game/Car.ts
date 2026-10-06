import { ControlInputState } from './InputManager';
import { ParticleSystem } from './ParticleSystem';
import { Physics, PhysicsDerivedParams } from './Physics';
import { CarSpec, CarStats, TimeOfDay, WeatherType } from './types';

export class Car {
  public readonly id: string;
  public readonly driverName: string;
  public readonly isPlayer: boolean;
  public readonly spec: CarSpec;
  public readonly stats: CarStats;
  public physicsParams: PhysicsDerivedParams;

  // Position & Orientation
  public x = 0;
  public y = 0;
  public angle = 0; // Radians
  public vx = 0;
  public vy = 0;
  public forwardSpeed = 0;
  public lateralSpeed = 0;
  public steerAngle = 0;

  // Nitro System
  public nitro = 100; // 0..100
  public nitroActive = false;
  public nitroOverheated = false;
  public nitroCooldownTimer = 0;

  // Drifting & Surface State
  public isDrifting = false;
  public isBraking = false;
  public isAccelerating = false;
  public offRoadFactor = 0; // 0 = on road, 1 = off road
  public hazardSlipTimer = 0;
  public currentDriftPoints = 0;
  public totalDriftScore = 0;

  // Race Progress State
  public lap = 1;
  public nextCheckpointIndex = 1;
  public checkpointsPassedInLap = 0;
  public nearestTrackPointIndex = 0;
  public totalProgress = 0;
  public position = 1;
  public finished = false;
  public finishTimeMs = 0;
  public currentLapStartMs = 0;
  public bestLapMs = 0;
  public cleanLap = true;
  public perfectLaps = 0;

  // Previous rear tire world positions for continuous skid marks
  private prevRearLeft: { x: number; y: number } | null = null;
  private prevRearRight: { x: number; y: number } | null = null;

  constructor(params: {
    id: string;
    driverName: string;
    isPlayer: boolean;
    spec: CarSpec;
    stats: CarStats;
    trackGripModifier: number;
    weather: WeatherType;
    customPrimaryColor?: string;
  }) {
    this.id = params.id;
    this.driverName = params.driverName;
    this.isPlayer = params.isPlayer;
    this.spec = params.customPrimaryColor
      ? { ...params.spec, primaryColor: params.customPrimaryColor }
      : params.spec;
    this.stats = params.stats;
    this.physicsParams = Physics.deriveParams(
      this.stats,
      params.trackGripModifier,
      params.weather
    );
  }

  public resetToGrid(x: number, y: number, angle: number): void {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.vx = 0;
    this.vy = 0;
    this.forwardSpeed = 0;
    this.lateralSpeed = 0;
    this.steerAngle = 0;
    this.nitro = 100;
    this.nitroActive = false;
    this.nitroOverheated = false;
    this.nitroCooldownTimer = 0;
    this.isDrifting = false;
    this.offRoadFactor = 0;
    this.hazardSlipTimer = 0;
    this.currentDriftPoints = 0;
    this.totalDriftScore = 0;
    this.lap = 1;
    this.nextCheckpointIndex = 1;
    this.checkpointsPassedInLap = 0;
    this.nearestTrackPointIndex = 0;
    this.totalProgress = 0;
    this.finished = false;
    this.finishTimeMs = 0;
    this.currentLapStartMs = 0;
    this.bestLapMs = 0;
    this.cleanLap = true;
    this.perfectLaps = 0;
    this.prevRearLeft = null;
    this.prevRearRight = null;
  }

  public updatePhysics(
    dt: number,
    input: ControlInputState,
    particles: ParticleSystem,
    canMove: boolean
  ): void {
    if (!canMove) {
      this.vx = 0;
      this.vy = 0;
      this.forwardSpeed = 0;
      return;
    }

    const p = this.physicsParams;
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);
    const rightX = -sin;
    const rightY = cos;

    // Decompose current velocity into car's local forward and lateral axes
    this.forwardSpeed = this.vx * cos + this.vy * sin;
    this.lateralSpeed = this.vx * rightX + this.vy * rightY;

    // Nitro logic with cooldown balance
    if (this.nitroCooldownTimer > 0) {
      this.nitroCooldownTimer -= dt;
      if (this.nitroCooldownTimer <= 0) {
        this.nitroOverheated = false;
      }
    }

    if (
      input.nitro &&
      !this.nitroOverheated &&
      this.nitro > 2 &&
      this.forwardSpeed > 80
    ) {
      this.nitroActive = true;
      this.nitro = Math.max(0, this.nitro - p.nitroDrainRate * dt);
      if (this.nitro <= 0.5) {
        this.nitro = 0;
        this.nitroActive = false;
        this.nitroOverheated = true;
        this.nitroCooldownTimer = 2.0; // 2 sec cooldown when fully depleted
      }
    } else {
      if (this.nitroActive) {
        // Brief 0.45s cooldown after releasing nitro to prevent spam tapping
        this.nitroCooldownTimer = Math.max(this.nitroCooldownTimer, 0.45);
      }
      this.nitroActive = false;
      if (!input.nitro && this.nitro < 100) {
        const driftBonusRecharge = this.isDrifting ? 1.65 : 1.0;
        this.nitro = Math.min(100, this.nitro + p.nitroRechargeRate * driftBonusRecharge * dt);
      }
    }

    // Effective max speed & acceleration
    const offRoadSpeedPenalty = 1 - this.offRoadFactor * 0.34;
    const nitroSpeedMult = this.nitroActive ? p.nitroBoostMultiplier : 1.0;
    const effectiveMaxSpeed = p.maxSpeed * offRoadSpeedPenalty * nitroSpeedMult;
    const effectiveAccel = p.acceleration * (this.nitroActive ? 1.55 : 1.0) * (1 - this.offRoadFactor * 0.25);

    this.isAccelerating = input.accelerate;
    this.isBraking = input.brake;

    if (input.accelerate) {
      this.forwardSpeed += effectiveAccel * dt;
    } else if (input.brake) {
      if (this.forwardSpeed > 15) {
        this.forwardSpeed -= p.braking * dt;
      } else {
        this.forwardSpeed -= p.acceleration * 0.55 * dt;
      }
    } else {
      // Natural rolling resistance
      const drag = 140;
      if (Math.abs(this.forwardSpeed) > drag * dt) {
        this.forwardSpeed -= Math.sign(this.forwardSpeed) * drag * dt;
      } else {
        this.forwardSpeed = 0;
      }
    }

    // Clamp forward/reverse speeds
    if (this.forwardSpeed > effectiveMaxSpeed) {
      this.forwardSpeed -= (this.forwardSpeed - effectiveMaxSpeed) * Math.min(1, dt * 5);
    }
    if (this.forwardSpeed < -p.maxReverseSpeed) {
      this.forwardSpeed = -p.maxReverseSpeed;
    }

    // Smooth steering
    const targetSteer = input.analogSteer;
    this.steerAngle += (targetSteer - this.steerAngle) * Math.min(1, dt * 11);

    // Speed-sensitive steering (must be moving to turn)
    const speedFactor = Math.min(1, Math.abs(this.forwardSpeed) / 145);
    const highSpeedDamping = 1 - Math.min(0.28, (Math.abs(this.forwardSpeed) / p.maxSpeed) * 0.22);
    const directionSign = this.forwardSpeed >= -5 ? 1 : -1;

    if (this.hazardSlipTimer > 0) {
      this.hazardSlipTimer -= dt;
    }

    const angularDelta =
      this.steerAngle * p.turnRate * speedFactor * highSpeedDamping * directionSign * dt;
    this.angle += angularDelta;

    // Recompute basis after rotation
    const newCos = Math.cos(this.angle);
    const newSin = Math.sin(this.angle);
    const newRightX = -newSin;
    const newRightY = newCos;

    // Inject lateral velocity from sharp turning at speed (arcade drift physics)
    const turnCentrifugal =
      -this.steerAngle * (Math.abs(this.forwardSpeed) * 0.34) * (Math.abs(this.steerAngle) > 0.4 ? 1.25 : 0.7);
    this.lateralSpeed += turnCentrifugal * dt * 3.2;

    // Lateral grip damping (lower when drifting or on oil/ice hazard)
    const isTurningHardAtSpeed =
      Math.abs(this.steerAngle) > 0.55 && Math.abs(this.forwardSpeed) > p.maxSpeed * 0.52;
    const hazardMultiplier = this.hazardSlipTimer > 0 ? 0.22 : 1.0;
    const driftGripMultiplier = isTurningHardAtSpeed ? 0.48 : 1.0;
    const effectiveGrip = p.lateralGrip * driftGripMultiplier * hazardMultiplier * (1 - this.offRoadFactor * 0.25);

    this.lateralSpeed *= Math.max(0, 1 - effectiveGrip * dt);

    // Detect active drift state
    const slipSpeed = Math.abs(this.lateralSpeed);
    this.isDrifting =
      (slipSpeed > 52 && Math.abs(this.forwardSpeed) > 210) ||
      (isTurningHardAtSpeed && slipSpeed > 36);

    if (this.isDrifting && this.offRoadFactor < 0.5) {
      const pointsDelta = Math.round(slipSpeed * 0.35 * dt * 60);
      this.currentDriftPoints += pointsDelta;
      this.totalDriftScore += pointsDelta;
    } else if (!this.isDrifting && this.currentDriftPoints > 0) {
      this.currentDriftPoints = 0;
    }

    // Reconstruct world velocity
    this.vx = newCos * this.forwardSpeed + newRightX * this.lateralSpeed;
    this.vy = newSin * this.forwardSpeed + newRightY * this.lateralSpeed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Emit particles (skid marks, tire smoke, nitro flames)
    this.emitEffects(particles, newCos, newSin, newRightX, newRightY);
  }

  private emitEffects(
    particles: ParticleSystem,
    cos: number,
    sin: number,
    rightX: number,
    rightY: number
  ): void {
    const rearOffset = -this.spec.length * 0.38;
    const sideOffset = this.spec.width * 0.42;

    const rlX = this.x + cos * rearOffset - rightX * sideOffset;
    const rlY = this.y + sin * rearOffset - rightY * sideOffset;
    const rrX = this.x + cos * rearOffset + rightX * sideOffset;
    const rrY = this.y + sin * rearOffset + rightY * sideOffset;

    if (this.isDrifting || (this.isBraking && Math.abs(this.forwardSpeed) > 220)) {
      if (this.prevRearLeft && this.prevRearRight) {
        particles.addSkidSegment(this.prevRearLeft.x, this.prevRearLeft.y, rlX, rlY);
        particles.addSkidSegment(this.prevRearRight.x, this.prevRearRight.y, rrX, rrY);
      }
      if (Math.random() < 0.65) {
        particles.emitTireSmoke(rlX, rlY, this.vx, this.vy);
        particles.emitTireSmoke(rrX, rrY, this.vx, this.vy);
      }
    }

    this.prevRearLeft = { x: rlX, y: rlY };
    this.prevRearRight = { x: rrX, y: rrY };

    if (this.nitroActive) {
      const exhaustX = this.x - cos * (this.spec.length * 0.52);
      const exhaustY = this.y - sin * (this.spec.length * 0.52);
      particles.emitNitroFlame(exhaustX, exhaustY, this.angle + Math.PI);
    }

    if (this.offRoadFactor > 0.3 && Math.abs(this.forwardSpeed) > 100 && Math.random() < 0.45) {
      particles.emitSurfaceDust(rlX, rlY, '#a16207');
    }
  }

  public getSpeedKmh(): number {
    return Physics.speedToKmh(Math.hypot(this.vx, this.vy));
  }

  public render(ctx: CanvasRenderingContext2D, timeOfDay: TimeOfDay): void {
    const w = this.spec.width;
    const l = this.spec.length;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // 1. Night / Sunset Headlight Beams
    if (timeOfDay === TimeOfDay.NIGHT || timeOfDay === TimeOfDay.SUNSET) {
      const beamAlpha = timeOfDay === TimeOfDay.NIGHT ? 0.32 : 0.14;
      const grad = ctx.createLinearGradient(l * 0.4, 0, l * 4.8, 0);
      grad.addColorStop(0, `rgba(254, 249, 195, ${beamAlpha})`);
      grad.addColorStop(1, 'rgba(254, 249, 195, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(l * 0.42, -w * 0.35);
      ctx.lineTo(l * 4.8, -w * 2.1);
      ctx.lineTo(l * 4.8, w * 2.1);
      ctx.lineTo(l * 0.42, w * 0.35);
      ctx.closePath();
      ctx.fill();
    }

    // 2. Soft Drop Shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.55)';
    this.roundRect(ctx, -l * 0.5 + 3, -w * 0.5 + 4, l, w, 6);
    ctx.fill();

    // 3. Four Wheels (front wheels rotate with steerAngle)
    const wheelL = 10;
    const wheelW = 5;
    const frontX = l * 0.28;
    const rearX = -l * 0.28;
    const wheelY = w * 0.48;

    ctx.fillStyle = '#0f172a';
    // Rear wheels
    ctx.fillRect(rearX - wheelL / 2, -wheelY - wheelW / 2, wheelL, wheelW);
    ctx.fillRect(rearX - wheelL / 2, wheelY - wheelW / 2, wheelL, wheelW);

    // Front steerable wheels
    for (const wy of [-wheelY, wheelY]) {
      ctx.save();
      ctx.translate(frontX, wy);
      ctx.rotate(this.steerAngle * 0.42);
      ctx.fillRect(-wheelL / 2, -wheelW / 2, wheelL, wheelW);
      ctx.restore();
    }

    // 4. Chassis Body by Style
    if (this.spec.bodyStyle === 'formula') {
      // Open-wheel Formula chassis
      ctx.fillStyle = this.spec.primaryColor;
      // Nose & fuselage
      ctx.beginPath();
      ctx.moveTo(l * 0.52, 0);
      ctx.lineTo(l * 0.15, -w * 0.22);
      ctx.lineTo(-l * 0.1, -w * 0.42);
      ctx.lineTo(-l * 0.45, -w * 0.32);
      ctx.lineTo(-l * 0.45, w * 0.32);
      ctx.lineTo(-l * 0.1, w * 0.42);
      ctx.lineTo(l * 0.15, w * 0.22);
      ctx.closePath();
      ctx.fill();

      // Front & rear wings
      ctx.fillStyle = this.spec.secondaryColor;
      ctx.fillRect(l * 0.4, -w * 0.48, 6, w * 0.96);
      ctx.fillRect(-l * 0.5, -w * 0.46, 8, w * 0.92);

      // Cockpit halo
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.ellipse(-2, 0, 8, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = this.spec.accentColor;
      ctx.beginPath();
      ctx.arc(-1, 0, 3.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Closed-body cars (Starter, Sport, Muscle, Super)
      ctx.fillStyle = this.spec.primaryColor;
      this.roundRect(ctx, -l * 0.5, -w * 0.46, l, w * 0.92, this.spec.bodyStyle === 'muscle' ? 4 : 7);
      ctx.fill();

      // Center racing stripe or aero hood detail
      ctx.fillStyle = this.spec.accentColor;
      if (this.spec.bodyStyle === 'muscle') {
        ctx.fillRect(-l * 0.48, -4.5, l * 0.96, 3.2);
        ctx.fillRect(-l * 0.48, 1.3, l * 0.96, 3.2);
      } else if (this.spec.bodyStyle === 'super') {
        ctx.beginPath();
        ctx.moveTo(l * 0.48, 0);
        ctx.lineTo(l * 0.05, -w * 0.32);
        ctx.lineTo(l * 0.05, w * 0.32);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-l * 0.46, -2, l * 0.92, 4);
      }

      // Cabin & Windshield
      ctx.fillStyle = '#0f172a';
      this.roundRect(ctx, -l * 0.24, -w * 0.36, l * 0.52, w * 0.72, 4);
      ctx.fill();

      // Roof panel
      ctx.fillStyle = this.spec.secondaryColor;
      this.roundRect(ctx, -l * 0.16, -w * 0.3, l * 0.28, w * 0.6, 3);
      ctx.fill();

      // Rear Wing for Sport & Super cars
      if (this.spec.bodyStyle === 'sport' || this.spec.bodyStyle === 'super') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-l * 0.49, -w * 0.44, 5, w * 0.88);
      }
    }

    // 5. Headlights & Brake Lights
    ctx.fillStyle = '#fef08a';
    ctx.fillRect(l * 0.45, -w * 0.36, 3, 5);
    ctx.fillRect(l * 0.45, w * 0.36 - 5, 3, 5);

    ctx.fillStyle = this.isBraking ? '#ef4444' : '#7f1d1d';
    ctx.fillRect(-l * 0.5, -w * 0.36, 3, 6);
    ctx.fillRect(-l * 0.5, w * 0.36 - 6, 3, 6);

    if (this.isBraking) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
      ctx.beginPath();
      ctx.arc(-l * 0.5, -w * 0.3, 6, 0, Math.PI * 2);
      ctx.arc(-l * 0.5, w * 0.3, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    // 6. Player / AI Overhead Indicator Tag
    if (this.isPlayer) {
      ctx.save();
      ctx.translate(this.x, this.y - 32);
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(-5, -2);
      ctx.lineTo(5, -2);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
  ): void {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
