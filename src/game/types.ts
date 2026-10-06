export enum GameState {
  MAIN_MENU = 'MAIN_MENU',
  CAREER_MODE = 'CAREER_MODE',
  QUICK_RACE = 'QUICK_RACE',
  CAR_SELECT = 'CAR_SELECT',
  GARAGE = 'GARAGE',
  TRACK_SELECT = 'TRACK_SELECT',
  SETTINGS = 'SETTINGS',
  HOW_TO_PLAY = 'HOW_TO_PLAY',
  HIGH_SCORES = 'HIGH_SCORES',
  COUNTDOWN = 'COUNTDOWN',
  RACING = 'RACING',
  PAUSED = 'PAUSED',
  FINISHED = 'FINISHED',
  RESULTS = 'RESULTS',
}

export enum AIDifficulty {
  EASY = 'Easy',
  MEDIUM = 'Medium',
  HARD = 'Hard',
  EXPERT = 'Expert',
}

export enum WeatherType {
  CLEAR = 'Clear',
  RAIN = 'Rain',
  SNOW = 'Snow',
  FOG = 'Fog',
}

export enum TimeOfDay {
  DAY = 'Day',
  SUNSET = 'Sunset',
  NIGHT = 'Night',
}

export type UpgradeType = 'engine' | 'acceleration' | 'handling' | 'brakes' | 'tires' | 'nitro';

export interface CarStats {
  topSpeed: number;      // Display 1-100, mapped to physics max speed
  acceleration: number;  // Display 1-100
  handling: number;      // Display 1-100
  braking: number;       // Display 1-100
  nitro: number;         // Display 1-100
  grip: number;          // Display 1-100
}

export interface CarSpec {
  id: string;
  name: string;
  category: string;
  tagline: string;
  unlockCost: number;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bodyStyle: 'starter' | 'sport' | 'muscle' | 'super' | 'formula';
  width: number;
  length: number;
  baseStats: CarStats;
}

export interface CarUpgrades {
  engine: number;       // Level 1 to 5
  acceleration: number; // Level 1 to 5
  handling: number;     // Level 1 to 5
  brakes: number;       // Level 1 to 5
  tires: number;        // Level 1 to 5
  nitro: number;        // Level 1 to 5
}

export interface Vec2 {
  x: number;
  y: number;
}

export interface TrackPoint {
  x: number;
  y: number;
  nx: number; // Normal X
  ny: number; // Normal Y
  tx: number; // Tangent X
  ty: number; // Tangent Y
  curvature: number;
  distanceFromStart: number;
}

export interface TrackDecoration {
  x: number;
  y: number;
  type: 'tree' | 'pine' | 'building' | 'cactus' | 'rock' | 'snowdrift' | 'streetlight' | 'neon_pylon' | 'grandstand';
  radius: number;
  rotation: number;
  color: string;
  height?: number;
  width?: number;
}

export interface TrackObstacle {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: 'oil' | 'barrier' | 'puddle' | 'ice_patch';
  angle: number;
}

export interface TrackCoin {
  id: string;
  x: number;
  y: number;
  collected: boolean;
  respawnTimer: number;
}

export interface TrackSpec {
  id: string;
  name: string;
  region: string;
  description: string;
  unlockCost: number;
  roadWidth: number;
  surfaceColor: string;
  shoulderColorA: string;
  shoulderColorB: string;
  terrainColor: string;
  terrainAccent: string;
  defaultWeather: WeatherType;
  defaultTimeOfDay: TimeOfDay;
  gripModifier: number;
  controlPoints: Vec2[];
  difficultyLabel: string;
  lengthKm: number;
}

export interface CareerEvent {
  id: string;
  chapter: number;
  chapterTitle: string;
  title: string;
  subtitle: string;
  trackId: string;
  laps: number;
  aiCount: number;
  aiDifficulty: AIDifficulty;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
  rewardCoins: {
    first: number;
    second: number;
    third: number;
    participation: number;
  };
  requiredEventId?: string;
}

export interface GameSettings {
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
  graphicsQuality: 'Low' | 'Medium' | 'High';
  screenShake: boolean;
  particles: boolean;
  controlScheme: 'Keyboard' | 'Keyboard + Mouse' | 'Touch';
  playerName: string;
}

export interface HighScoreEntry {
  id: string;
  playerName: string;
  trackId: string;
  trackName: string;
  carId: string;
  carName: string;
  bestLapMs: number;
  totalTimeMs: number;
  date: string;
}

export interface CareerEventResult {
  completed: boolean;
  bestPosition: number;
  bestTimeMs: number;
  trophies: number; // 0 to 3
}

export interface SaveData {
  coins: number;
  selectedCarId: string;
  selectedTrackId: string;
  unlockedCars: string[];
  unlockedTracks: string[];
  upgrades: Record<string, CarUpgrades>;
  careerProgress: Record<string, CareerEventResult>;
  stats: {
    wins: number;
    losses: number;
    totalRaces: number;
    trophies: number;
    totalCoinsEarned: number;
    totalDriftScore: number;
  };
  bestLapTimes: Record<string, number>; // trackId -> ms
  highScores: HighScoreEntry[];
  settings: GameSettings;
}

export interface RaceConfig {
  mode: 'career' | 'quick';
  careerEventId?: string;
  carId: string;
  trackId: string;
  laps: number;
  aiCount: number;
  aiDifficulty: AIDifficulty;
  weather: WeatherType;
  timeOfDay: TimeOfDay;
}

export interface RacerTelemetry {
  id: string;
  name: string;
  isPlayer: boolean;
  carId: string;
  color: string;
  lap: number;
  maxLaps: number;
  position: number;
  totalProgress: number;
  speedKmh: number;
  nitro: number;
  nitroCooldown: boolean;
  finished: boolean;
  finishTimeMs: number;
  bestLapMs: number;
  currentLapStartMs: number;
  x: number;
  y: number;
  angle: number;
  drifting: boolean;
}

export interface RaceResultsData {
  mode: 'career' | 'quick';
  careerEventId?: string;
  trackId: string;
  trackName: string;
  carId: string;
  carName: string;
  position: number;
  totalRacers: number;
  totalTimeMs: number;
  bestLapMs: number;
  perfectLaps: number;
  coinsCollectedInRace: number;
  overtakes: number;
  driftScore: number;
  rewards: {
    positionReward: number;
    podiumBonus: number;
    collectedBonus: number;
    driftBonus: number;
    overtakeBonus: number;
    perfectLapBonus: number;
    totalEarned: number;
  };
  unlockedNextEventTitle?: string;
  standings: {
    position: number;
    name: string;
    carName: string;
    timeMs: number;
    bestLapMs: number;
    isPlayer: boolean;
  }[];
}

export interface HudSnapshot {
  state: GameState;
  countdownValue: number;
  countdownText: string;
  lap: number;
  totalLaps: number;
  position: number;
  totalRacers: number;
  raceTimeMs: number;
  currentLapMs: number;
  bestLapMs: number;
  speedKmh: number;
  nitro: number;
  nitroActive: boolean;
  nitroOverheated: boolean;
  driftScore: number;
  currentDriftPoints: number;
  coinsCollected: number;
  overtakes: number;
  wrongWay: boolean;
  notificationText: string;
  notificationTimer: number;
}
