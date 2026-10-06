import { CARS, getDefaultUpgrades, getUpgradeCost, MAX_UPGRADE_LEVEL } from './data/cars';
import { CAREER_EVENTS } from './data/career';
import { TRACKS } from './data/tracks';
import { CarUpgrades, GameSettings, HighScoreEntry, SaveData, UpgradeType } from './types';

const STORAGE_KEY = 'ultimate_2d_racing_save_v1';

const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 80,
  musicVolume: 60,
  sfxVolume: 85,
  muted: false,
  graphicsQuality: 'High',
  screenShake: true,
  particles: true,
  controlScheme: 'Keyboard',
  playerName: 'Racer One',
};

const SEED_HIGH_SCORES: HighScoreEntry[] = [
  {
    id: 'seed_1',
    playerName: 'Elena Vance',
    trackId: 'city_track',
    trackName: 'Metro Circuit',
    carId: 'formula_car',
    carName: 'F-Zero Apex',
    bestLapMs: 38420,
    totalTimeMs: 118540,
    date: '2026-09-18',
  },
  {
    id: 'seed_2',
    playerName: 'Marcus K.',
    trackId: 'desert_track',
    trackName: 'Canyon Mirage',
    carId: 'super_car',
    carName: 'Zenith Hyperion',
    bestLapMs: 42150,
    totalTimeMs: 129800,
    date: '2026-09-22',
  },
  {
    id: 'seed_3',
    playerName: 'Kenji Sato',
    trackId: 'night_track',
    trackName: 'Neon Expressway',
    carId: 'super_car',
    carName: 'Zenith Hyperion',
    bestLapMs: 46890,
    totalTimeMs: 144120,
    date: '2026-09-27',
  },
  {
    id: 'seed_4',
    playerName: 'Aria Lindqvist',
    trackId: 'snow_track',
    trackName: 'Glacier Peak',
    carId: 'sport_car',
    carName: 'Veloce Coupe RS',
    bestLapMs: 45110,
    totalTimeMs: 138900,
    date: '2026-09-30',
  },
  {
    id: 'seed_5',
    playerName: 'Devon Brooks',
    trackId: 'forest_track',
    trackName: 'Redwood Pass',
    carId: 'muscle_car',
    carName: 'Titan V8 Mach',
    bestLapMs: 43760,
    totalTimeMs: 134500,
    date: '2026-10-02',
  },
];

export class SaveManager {
  private static data: SaveData = SaveManager.createDefaultSave();

  public static createDefaultSave(): SaveData {
    const upgrades: Record<string, CarUpgrades> = {};
    for (const car of CARS) {
      upgrades[car.id] = getDefaultUpgrades();
    }

    return {
      coins: 500,
      selectedCarId: CARS[0].id,
      selectedTrackId: TRACKS[0].id,
      unlockedCars: [CARS[0].id],
      unlockedTracks: [TRACKS[0].id, TRACKS[1].id],
      upgrades,
      careerProgress: {},
      stats: {
        wins: 0,
        losses: 0,
        totalRaces: 0,
        trophies: 0,
        totalCoinsEarned: 500,
        totalDriftScore: 0,
      },
      bestLapTimes: {},
      highScores: [...SEED_HIGH_SCORES],
      settings: { ...DEFAULT_SETTINGS },
    };
  }

  public static load(): SaveData {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.data = this.createDefaultSave();
        this.save();
        return this.data;
      }
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const def = this.createDefaultSave();

      const mergedUpgrades: Record<string, CarUpgrades> = { ...def.upgrades };
      if (parsed.upgrades) {
        for (const key of Object.keys(parsed.upgrades)) {
          mergedUpgrades[key] = {
            ...getDefaultUpgrades(),
            ...parsed.upgrades[key],
          };
        }
      }

      this.data = {
        ...def,
        ...parsed,
        upgrades: mergedUpgrades,
        stats: { ...def.stats, ...(parsed.stats || {}) },
        settings: { ...def.settings, ...(parsed.settings || {}) },
        highScores: parsed.highScores && parsed.highScores.length > 0 ? parsed.highScores : def.highScores,
      };
      return this.data;
    } catch {
      this.data = this.createDefaultSave();
      return this.data;
    }
  }

  public static save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Ignore storage quota issues in restricted environments
    }
  }

  public static getData(): SaveData {
    return this.data;
  }

  public static resetProgress(): SaveData {
    this.data = this.createDefaultSave();
    this.save();
    return this.data;
  }

  public static updateSettings(partial: Partial<GameSettings>): GameSettings {
    this.data.settings = { ...this.data.settings, ...partial };
    this.save();
    return this.data.settings;
  }

  public static selectCar(carId: string): void {
    if (this.data.unlockedCars.includes(carId)) {
      this.data.selectedCarId = carId;
      this.save();
    }
  }

  public static selectTrack(trackId: string): void {
    if (this.data.unlockedTracks.includes(trackId)) {
      this.data.selectedTrackId = trackId;
      this.save();
    }
  }

  public static unlockCar(carId: string): boolean {
    const car = CARS.find((c) => c.id === carId);
    if (!car) return false;
    if (this.data.unlockedCars.includes(carId)) return true;
    if (this.data.coins < car.unlockCost) return false;

    this.data.coins -= car.unlockCost;
    this.data.unlockedCars.push(carId);
    this.data.selectedCarId = carId;
    this.save();
    return true;
  }

  public static unlockTrack(trackId: string): boolean {
    const track = TRACKS.find((t) => t.id === trackId);
    if (!track) return false;
    if (this.data.unlockedTracks.includes(trackId)) return true;
    if (this.data.coins < track.unlockCost) return false;

    this.data.coins -= track.unlockCost;
    this.data.unlockedTracks.push(trackId);
    this.data.selectedTrackId = trackId;
    this.save();
    return true;
  }

  public static upgradeCar(carId: string, upgradeType: UpgradeType): boolean {
    const car = CARS.find((c) => c.id === carId);
    if (!car || !this.data.unlockedCars.includes(carId)) return false;

    const currentUpgrades = this.data.upgrades[carId] || getDefaultUpgrades();
    const currentLevel = currentUpgrades[upgradeType];
    if (currentLevel >= MAX_UPGRADE_LEVEL) return false;

    const cost = getUpgradeCost(car, upgradeType, currentLevel);
    if (this.data.coins < cost) return false;

    this.data.coins -= cost;
    this.data.upgrades[carId] = {
      ...currentUpgrades,
      [upgradeType]: currentLevel + 1,
    };
    this.save();
    return true;
  }

  public static isCareerEventUnlocked(eventId: string): boolean {
    const ev = CAREER_EVENTS.find((e) => e.id === eventId);
    if (!ev) return false;
    if (!ev.requiredEventId) return true;
    const reqProgress = this.data.careerProgress[ev.requiredEventId];
    return Boolean(reqProgress && reqProgress.completed);
  }

  public static recordRaceCompletion(params: {
    careerEventId?: string;
    trackId: string;
    trackName: string;
    carId: string;
    carName: string;
    position: number;
    totalTimeMs: number;
    bestLapMs: number;
    coinsEarned: number;
    driftScore: number;
  }): { unlockedNextEventTitle?: string } {
    this.data.coins += params.coinsEarned;
    this.data.stats.totalCoinsEarned += params.coinsEarned;
    this.data.stats.totalRaces += 1;
    this.data.stats.totalDriftScore += params.driftScore;

    if (params.position === 1) {
      this.data.stats.wins += 1;
    } else {
      this.data.stats.losses += 1;
    }

    // Track best lap time
    const prevBestLap = this.data.bestLapTimes[params.trackId];
    if (params.bestLapMs > 0 && (!prevBestLap || params.bestLapMs < prevBestLap)) {
      this.data.bestLapTimes[params.trackId] = params.bestLapMs;
    }

    // Record High Score entry
    if (params.bestLapMs > 0 && params.totalTimeMs > 0) {
      const entry: HighScoreEntry = {
        id: `hs_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        playerName: this.data.settings.playerName || 'Racer One',
        trackId: params.trackId,
        trackName: params.trackName,
        carId: params.carId,
        carName: params.carName,
        bestLapMs: Math.round(params.bestLapMs),
        totalTimeMs: Math.round(params.totalTimeMs),
        date: new Date().toISOString().split('T')[0],
      };
      this.data.highScores.push(entry);
      this.data.highScores.sort((a, b) => a.bestLapMs - b.bestLapMs);
      this.data.highScores = this.data.highScores.slice(0, 30);
    }

    let unlockedNextEventTitle: string | undefined;

    if (params.careerEventId) {
      const wasUnlockedBefore = new Set(
        CAREER_EVENTS.filter((e) => this.isCareerEventUnlocked(e.id)).map((e) => e.id)
      );

      const prev = this.data.careerProgress[params.careerEventId];
      const completed = params.position <= 3 || Boolean(prev?.completed);
      const trophiesEarned =
        params.position === 1 ? 3 : params.position === 2 ? 2 : params.position === 3 ? 1 : 0;

      const prevTrophies = prev?.trophies || 0;
      const newTrophies = Math.max(prevTrophies, trophiesEarned);
      this.data.stats.trophies += Math.max(0, newTrophies - prevTrophies);

      this.data.careerProgress[params.careerEventId] = {
        completed,
        bestPosition: prev ? Math.min(prev.bestPosition, params.position) : params.position,
        bestTimeMs:
          prev && prev.bestTimeMs > 0
            ? Math.min(prev.bestTimeMs, params.totalTimeMs)
            : params.totalTimeMs,
        trophies: newTrophies,
      };

      // Also automatically unlock the track of any newly unlocked career event
      for (const ev of CAREER_EVENTS) {
        if (!wasUnlockedBefore.has(ev.id) && this.isCareerEventUnlocked(ev.id)) {
          unlockedNextEventTitle = ev.title;
          if (!this.data.unlockedTracks.includes(ev.trackId)) {
            this.data.unlockedTracks.push(ev.trackId);
          }
        }
      }
    }

    this.save();
    return { unlockedNextEventTitle };
  }
}
