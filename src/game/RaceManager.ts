import { AICar } from './AICar';
import { AudioManager } from './AudioManager';
import { Car } from './Car';
import { CARS, computeEffectiveCarStats, getCarById } from './data/cars';
import { CAREER_EVENTS } from './data/career';
import { getTrackById } from './data/tracks';
import { Player } from './Player';
import { SaveManager } from './SaveManager';
import { Track } from './Track';
import {
  GameState,
  HudSnapshot,
  RaceConfig,
  RaceResultsData,
} from './types';

const AI_NAMES = [
  'Elena Vance',
  'Marcus K.',
  'Kenji Sato',
  'Aria Lindqvist',
  'Devon Brooks',
  'Viktor Volkov',
  'Sofia Moretti',
  'Lucas Meyer',
];

const AI_COLORS = [
  '#ec4899',
  '#14b8a6',
  '#a855f7',
  '#f97316',
  '#06b6d4',
  '#84cc16',
  '#f43f5e',
];

export class RaceManager {
  public config: RaceConfig;
  public track: Track;
  public player: Player;
  public aiCars: AICar[] = [];
  public allCars: Car[] = [];

  public countdownTimer = 3.6;
  public lastCountdownBeep = 4;
  public raceTimeMs = 0;
  public finishGraceTimer = 0;
  public notificationText = '';
  public notificationTimer = 0;
  private previousPlayerPosition = 1;

  constructor(config: RaceConfig) {
    this.config = config;
    const trackSpec = getTrackById(config.trackId);
    this.track = new Track(trackSpec);

    const save = SaveManager.getData();
    const playerCarSpec = getCarById(config.carId);
    const playerStats = computeEffectiveCarStats(
      playerCarSpec,
      save.upgrades[playerCarSpec.id]
    );

    this.player = new Player({
      driverName: save.settings.playerName || 'Racer One',
      spec: playerCarSpec,
      stats: playerStats,
      trackGripModifier: trackSpec.gripModifier,
      weather: config.weather,
    });

    this.spawnGrid();
  }

  private spawnGrid(): void {
    this.aiCars = [];
    const totalCars = this.config.aiCount + 1;
    const playerTierIdx = Math.max(0, CARS.findIndex((c) => c.id === this.config.carId));

    for (let i = 0; i < this.config.aiCount; i++) {
      // Choose appropriate AI car tier around player's car
      const aiCarIdx = Math.min(
        CARS.length - 1,
        Math.max(0, playerTierIdx + (i % 3) - 1)
      );
      const aiSpec = CARS[aiCarIdx];
      const baseStats = computeEffectiveCarStats(aiSpec);
      const laneBias = ((i % 2 === 0 ? -1 : 1) * (15 + (i * 11) % 35));

      const ai = new AICar({
        id: `ai_${i}`,
        driverName: AI_NAMES[i % AI_NAMES.length],
        spec: aiSpec,
        stats: baseStats,
        difficulty: this.config.aiDifficulty,
        trackGripModifier: this.track.spec.gripModifier,
        weather: this.config.weather,
        customPrimaryColor: AI_COLORS[i % AI_COLORS.length],
        laneBias,
      });

      const gridPos = this.track.getStartGridPosition(i, totalCars);
      ai.resetToGrid(gridPos.x, gridPos.y, gridPos.angle);
      ai.position = i + 1;
      this.aiCars.push(ai);
    }

    // Place player at the back of the grid for exciting overtakes
    const playerGridPos = this.track.getStartGridPosition(this.config.aiCount, totalCars);
    this.player.resetToGrid(playerGridPos.x, playerGridPos.y, playerGridPos.angle);
    this.player.position = totalCars;
    this.previousPlayerPosition = totalCars;

    this.allCars = [...this.aiCars, this.player];
  }

  public showNotification(text: string, duration = 2.0): void {
    this.notificationText = text;
    this.notificationTimer = duration;
  }

  public updateProgressAndStandings(
    dt: number,
    audio: AudioManager,
    onPlayerFinished: () => void
  ): void {
    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
    }

    const totalPts = this.track.points.length;
    const totalCps = this.track.checkpoints.length;

    for (const car of this.allCars) {
      if (car.finished) continue;

      const nearest = this.track.getNearestPoint(car.x, car.y, car.nearestTrackPointIndex);
      car.nearestTrackPointIndex = nearest.index;

      // Check wrong-way for player
      if (car.isPlayer && Math.abs(car.forwardSpeed) > 100) {
        const moveDot =
          Math.cos(car.angle) * nearest.point.tx + Math.sin(car.angle) * nearest.point.ty;
        this.player.wrongWay = moveDot < -0.35;
      } else if (car.isPlayer) {
        this.player.wrongWay = false;
      }

      // Check next checkpoint passage
      const targetCpPointIdx = this.track.checkpoints[car.nextCheckpointIndex];
      const cpPt = this.track.points[targetCpPointIdx];
      const distToCp = Math.hypot(car.x - cpPt.x, car.y - cpPt.y);

      if (distToCp < this.track.spec.roadWidth * 0.85) {
        car.checkpointsPassedInLap += 1;
        car.nextCheckpointIndex = (car.nextCheckpointIndex + 1) % totalCps;

        // If we just crossed checkpoint 0 (Start/Finish line) and completed all checkpoints
        if (car.nextCheckpointIndex === 1 && car.checkpointsPassedInLap >= totalCps) {
          const lapDuration = this.raceTimeMs - car.currentLapStartMs;
          if (lapDuration > 4000 && (car.bestLapMs === 0 || lapDuration < car.bestLapMs)) {
            car.bestLapMs = lapDuration;
          }
          if (car.cleanLap) {
            car.perfectLaps += 1;
            if (car.isPlayer) {
              this.showNotification('PERFECT LAP BONUS!', 2.2);
            }
          }

          car.currentLapStartMs = this.raceTimeMs;
          car.cleanLap = true;
          car.checkpointsPassedInLap = 0;

          if (car.lap >= this.config.laps) {
            car.finished = true;
            car.finishTimeMs = this.raceTimeMs;
            if (car.isPlayer) {
              onPlayerFinished();
            }
          } else {
            car.lap += 1;
            if (car.isPlayer) {
              audio.playSfx('lap_complete');
              if (car.lap === this.config.laps) {
                this.showNotification('FINAL LAP!', 2.4);
              } else {
                this.showNotification(`LAP ${car.lap} / ${this.config.laps}`, 1.8);
              }
            }
          }
        }
      }

      // Compute continuous totalProgress for accurate real-time ranking
      const cpProgress = car.checkpointsPassedInLap / totalCps;
      const pointFraction = nearest.index / totalPts;
      // Handle wrap-around right before finish line
      const normalizedFraction =
        car.checkpointsPassedInLap === totalCps - 1 && nearest.index < totalPts * 0.2
          ? 1 + pointFraction
          : Math.max(cpProgress * 0.85, pointFraction);

      car.totalProgress = (car.lap - 1) * 1000 + normalizedFraction * 1000;
    }

    // Sort cars by finished status & totalProgress
    const sorted = [...this.allCars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTimeMs - b.finishTimeMs;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.totalProgress - a.totalProgress;
    });

    for (let i = 0; i < sorted.length; i++) {
      sorted[i].position = i + 1;
    }

    // Detect player overtakes
    if (this.player.position < this.previousPlayerPosition && this.raceTimeMs > 2500) {
      const gained = this.previousPlayerPosition - this.player.position;
      this.player.overtakes += gained;
      this.showNotification(`OVERTAKE! P${this.player.position}`, 1.4);
    }
    this.previousPlayerPosition = this.player.position;
  }

  public buildHudSnapshot(state: GameState): HudSnapshot {
    let countdownText = '';
    const ceilVal = Math.ceil(this.countdownTimer - 0.6);
    if (state === GameState.COUNTDOWN) {
      countdownText = ceilVal > 0 ? String(ceilVal) : 'GO!';
    }

    return {
      state,
      countdownValue: Math.max(0, ceilVal),
      countdownText,
      lap: Math.min(this.player.lap, this.config.laps),
      totalLaps: this.config.laps,
      position: this.player.position,
      totalRacers: this.allCars.length,
      raceTimeMs: this.raceTimeMs,
      currentLapMs: Math.max(0, this.raceTimeMs - this.player.currentLapStartMs),
      bestLapMs: this.player.bestLapMs,
      speedKmh: this.player.getSpeedKmh(),
      nitro: Math.round(this.player.nitro),
      nitroActive: this.player.nitroActive,
      nitroOverheated: this.player.nitroOverheated,
      driftScore: this.player.totalDriftScore,
      currentDriftPoints: this.player.currentDriftPoints,
      coinsCollected: this.player.coinsCollectedInRace,
      overtakes: this.player.overtakes,
      wrongWay: this.player.wrongWay,
      notificationText: this.notificationTimer > 0 ? this.notificationText : '',
      notificationTimer: this.notificationTimer,
    };
  }

  public finalizeResults(): RaceResultsData {
    // Estimate finish times for any AI cars still on track when race concludes
    for (const car of this.allCars) {
      if (!car.finished) {
        const remainingRatio = Math.max(
          0.03,
          (this.config.laps * 1000 - car.totalProgress) / 1000
        );
        car.finishTimeMs = Math.round(this.raceTimeMs + remainingRatio * 42000);
        if (car.bestLapMs === 0) {
          car.bestLapMs = Math.round(car.finishTimeMs / this.config.laps);
        }
      }
    }

    const sorted = [...this.allCars].sort((a, b) => a.position - b.position);
    const pos = this.player.position;

    let positionReward = 100;
    if (this.config.mode === 'career' && this.config.careerEventId) {
      const ev = CAREER_EVENTS.find((e) => e.id === this.config.careerEventId);
      if (ev) {
        if (pos === 1) positionReward = ev.rewardCoins.first;
        else if (pos === 2) positionReward = ev.rewardCoins.second;
        else if (pos === 3) positionReward = ev.rewardCoins.third;
        else positionReward = ev.rewardCoins.participation;
      }
    } else {
      positionReward = pos === 1 ? 450 : pos === 2 ? 300 : pos === 3 ? 200 : 90;
    }

    const podiumBonus = pos === 1 ? 150 : pos === 2 ? 90 : pos === 3 ? 50 : 0;
    const collectedBonus = this.player.coinsCollectedInRace * 25;
    const driftBonus = Math.min(400, Math.floor(this.player.totalDriftScore / 35));
    const overtakeBonus = this.player.overtakes * 20;
    const perfectLapBonus = this.player.perfectLaps * 75;

    const totalEarned =
      positionReward +
      podiumBonus +
      collectedBonus +
      driftBonus +
      overtakeBonus +
      perfectLapBonus;

    const { unlockedNextEventTitle } = SaveManager.recordRaceCompletion({
      careerEventId: this.config.careerEventId,
      trackId: this.track.spec.id,
      trackName: this.track.spec.name,
      carId: this.player.spec.id,
      carName: this.player.spec.name,
      position: pos,
      totalTimeMs: this.player.finishTimeMs || this.raceTimeMs,
      bestLapMs:
        this.player.bestLapMs ||
        Math.round((this.player.finishTimeMs || this.raceTimeMs) / this.config.laps),
      coinsEarned: totalEarned,
      driftScore: this.player.totalDriftScore,
    });

    return {
      mode: this.config.mode,
      careerEventId: this.config.careerEventId,
      trackId: this.track.spec.id,
      trackName: this.track.spec.name,
      carId: this.player.spec.id,
      carName: this.player.spec.name,
      position: pos,
      totalRacers: this.allCars.length,
      totalTimeMs: Math.round(this.player.finishTimeMs || this.raceTimeMs),
      bestLapMs: Math.round(
        this.player.bestLapMs ||
          (this.player.finishTimeMs || this.raceTimeMs) / this.config.laps
      ),
      perfectLaps: this.player.perfectLaps,
      coinsCollectedInRace: this.player.coinsCollectedInRace,
      overtakes: this.player.overtakes,
      driftScore: this.player.totalDriftScore,
      rewards: {
        positionReward,
        podiumBonus,
        collectedBonus,
        driftBonus,
        overtakeBonus,
        perfectLapBonus,
        totalEarned,
      },
      unlockedNextEventTitle,
      standings: sorted.map((c) => ({
        position: c.position,
        name: c.driverName,
        carName: c.spec.name,
        timeMs: Math.round(c.finishTimeMs),
        bestLapMs: Math.round(c.bestLapMs || c.finishTimeMs / this.config.laps),
        isPlayer: c.isPlayer,
      })),
    };
  }
}
