import { CarStats, WeatherType } from './types';

export interface PhysicsDerivedParams {
  maxSpeed: number;         // World units / sec
  maxReverseSpeed: number;
  acceleration: number;     // World units / sec^2
  braking: number;
  turnRate: number;         // Radians / sec
  lateralGrip: number;      // Higher = less slide
  nitroBoostMultiplier: number;
  nitroDrainRate: number;   // % per sec
  nitroRechargeRate: number;// % per sec
}

export class Physics {
  public static deriveParams(
    stats: CarStats,
    trackGripModifier: number,
    weather: WeatherType
  ): PhysicsDerivedParams {
    let weatherGrip = 1.0;
    if (weather === WeatherType.RAIN) weatherGrip = 0.84;
    else if (weather === WeatherType.SNOW) weatherGrip = 0.75;
    else if (weather === WeatherType.FOG) weatherGrip = 0.95;

    const totalGripFactor = trackGripModifier * weatherGrip;

    return {
      maxSpeed: 540 + (stats.topSpeed / 100) * 340, // 540..880 px/s (displays up to ~320 KM/H)
      maxReverseSpeed: 190,
      acceleration: 310 + (stats.acceleration / 100) * 320,
      braking: 480 + (stats.braking / 100) * 360,
      turnRate: (2.35 + (stats.handling / 100) * 1.45) * (0.88 + totalGripFactor * 0.12),
      lateralGrip: (4.2 + (stats.grip / 100) * 4.8) * totalGripFactor,
      nitroBoostMultiplier: 1.24 + (stats.nitro / 100) * 0.14,
      nitroDrainRate: Math.max(18, 34 - (stats.nitro / 100) * 12),
      nitroRechargeRate: 9 + (stats.nitro / 100) * 9,
    };
  }

  public static speedToKmh(worldSpeed: number): number {
    return Math.round(Math.abs(worldSpeed) * 0.34);
  }
}
