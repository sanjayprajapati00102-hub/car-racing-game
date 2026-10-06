import { Car } from './Car';
import { CarSpec, CarStats, WeatherType } from './types';

export class Player extends Car {
  public coinsCollectedInRace = 0;
  public overtakes = 0;
  public wrongWay = false;

  constructor(params: {
    driverName: string;
    spec: CarSpec;
    stats: CarStats;
    trackGripModifier: number;
    weather: WeatherType;
  }) {
    super({
      id: 'player',
      driverName: params.driverName,
      isPlayer: true,
      spec: params.spec,
      stats: params.stats,
      trackGripModifier: params.trackGripModifier,
      weather: params.weather,
    });
  }

  public override resetToGrid(x: number, y: number, angle: number): void {
    super.resetToGrid(x, y, angle);
    this.coinsCollectedInRace = 0;
    this.overtakes = 0;
    this.wrongWay = false;
  }
}
