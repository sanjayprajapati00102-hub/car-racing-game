import { Car } from './Car';
import { ControlInputState } from './InputManager';
import { Track } from './Track';
import { AIDifficulty, CarSpec, CarStats, WeatherType } from './types';

export class AICar extends Car {
  private difficulty: AIDifficulty;
  private preferredLaneOffset: number; // Lateral offset from centerline
  private skillFactor: number;
  private mistakeTimer = 0;
  private mistakeSteerBias = 0;

  constructor(params: {
    id: string;
    driverName: string;
    spec: CarSpec;
    stats: CarStats;
    difficulty: AIDifficulty;
    trackGripModifier: number;
    weather: WeatherType;
    customPrimaryColor: string;
    laneBias: number;
  }) {
    super({
      id: params.id,
      driverName: params.driverName,
      isPlayer: false,
      spec: params.spec,
      stats: params.stats,
      trackGripModifier: params.trackGripModifier,
      weather: params.weather,
      customPrimaryColor: params.customPrimaryColor,
    });

    this.difficulty = params.difficulty;
    this.preferredLaneOffset = params.laneBias;

    switch (params.difficulty) {
      case AIDifficulty.EASY:
        this.skillFactor = 0.80;
        break;
      case AIDifficulty.MEDIUM:
        this.skillFactor = 0.90;
        break;
      case AIDifficulty.HARD:
        this.skillFactor = 0.97;
        break;
      case AIDifficulty.EXPERT:
        this.skillFactor = 1.04;
        break;
    }

    // Scale AI top speed and acceleration by difficulty
    this.physicsParams.maxSpeed *= this.skillFactor;
    this.physicsParams.acceleration *= this.skillFactor;
  }

  public computeAIControls(dt: number, track: Track, allCars: Car[]): ControlInputState {
    if (this.finished) {
      return {
        accelerate: false,
        brake: true,
        left: false,
        right: false,
        nitro: false,
        analogSteer: 0,
      };
    }

    const totalPts = track.points.length;
    const lookaheadSteps = Math.max(8, Math.min(20, Math.round(this.forwardSpeed / 42)));
    const targetIdx = (this.nearestTrackPointIndex + lookaheadSteps) % totalPts;
    const farIdx = (this.nearestTrackPointIndex + lookaheadSteps * 2) % totalPts;

    const targetPt = track.points[targetIdx];
    const farPt = track.points[farIdx];

    // Occasional minor human-like line variance / mistakes on lower difficulties
    this.mistakeTimer -= dt;
    if (this.mistakeTimer <= 0) {
      this.mistakeTimer = 1.5 + Math.random() * 2.5;
      const mistakeChance =
        this.difficulty === AIDifficulty.EASY
          ? 0.35
          : this.difficulty === AIDifficulty.MEDIUM
            ? 0.2
            : this.difficulty === AIDifficulty.HARD
              ? 0.08
              : 0.02;
      if (Math.random() < mistakeChance) {
        this.mistakeSteerBias = (Math.random() - 0.5) * 0.35;
      } else {
        this.mistakeSteerBias = 0;
      }
    }

    // Avoid nearby obstacles and slower cars ahead
    let avoidanceOffset = this.preferredLaneOffset;
    for (const obs of track.obstacles) {
      const dist = Math.hypot(obs.x - this.x, obs.y - this.y);
      if (dist < 180) {
        const obsLat = (obs.x - targetPt.x) * targetPt.nx + (obs.y - targetPt.y) * targetPt.ny;
        avoidanceOffset = obsLat > 0 ? -track.spec.roadWidth * 0.26 : track.spec.roadWidth * 0.26;
      }
    }

    for (const other of allCars) {
      if (other.id === this.id) continue;
      const dist = Math.hypot(other.x - this.x, other.y - this.y);
      if (dist < 110) {
        const otherLat = (other.x - targetPt.x) * targetPt.nx + (other.y - targetPt.y) * targetPt.ny;
        avoidanceOffset = otherLat > 0 ? -track.spec.roadWidth * 0.25 : track.spec.roadWidth * 0.25;
      }
    }

    const aimX = targetPt.x + targetPt.nx * avoidanceOffset;
    const aimY = targetPt.y + targetPt.ny * avoidanceOffset;

    const desiredAngle = Math.atan2(aimY - this.y, aimX - this.x);
    let angleDiff = desiredAngle - this.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const analogSteer = Math.max(-1, Math.min(1, angleDiff * 2.4 + this.mistakeSteerBias));

    // Corner speed management: slow down when curvature ahead is sharp
    const upcomingCurvature = Math.max(targetPt.curvature, farPt.curvature);
    const cornerSafeSpeed =
      upcomingCurvature > 0.35
        ? this.physicsParams.maxSpeed * 0.62
        : upcomingCurvature > 0.2
          ? this.physicsParams.maxSpeed * 0.8
          : this.physicsParams.maxSpeed;

    const needBrake = this.forwardSpeed > cornerSafeSpeed && upcomingCurvature > 0.22;
    const accelerate = !needBrake;

    // Activate nitro on straightaways when aligned with the track
    const useNitro =
      upcomingCurvature < 0.12 &&
      Math.abs(angleDiff) < 0.2 &&
      this.nitro > 45 &&
      this.forwardSpeed > this.physicsParams.maxSpeed * 0.7 &&
      this.difficulty !== AIDifficulty.EASY;

    return {
      accelerate,
      brake: needBrake,
      left: analogSteer < -0.05,
      right: analogSteer > 0.05,
      nitro: useNitro,
      analogSteer,
    };
  }
}
