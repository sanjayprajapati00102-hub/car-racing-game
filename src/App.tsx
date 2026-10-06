/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play, Volume2, VolumeX } from 'lucide-react';
import { GarageAndCarsView } from './components/GarageAndCarsView';
import {
  CareerModeView,
  HighScoresView,
  HowToPlayView,
  PauseModal,
  QuickRaceView,
  RaceResultsView,
  SettingsView,
  TrackSelectView,
} from './components/MenuViews';
import { RacingHud } from './components/RacingHud';
import { computeEffectiveCarStats, getCarById } from './game/data/cars';
import { CAREER_EVENTS } from './game/data/career';
import { getTrackById } from './game/data/tracks';
import { Game } from './game/Game';
import { SaveManager } from './game/SaveManager';
import {
  CareerEvent,
  GameSettings,
  GameState,
  HudSnapshot,
  RaceConfig,
  RaceResultsData,
  SaveData,
  UpgradeType,
} from './game/types';
import { UIManager } from './game/UIManager';

const INITIAL_HUD: HudSnapshot = {
  state: GameState.MAIN_MENU,
  countdownValue: 3,
  countdownText: '3',
  lap: 1,
  totalLaps: 3,
  position: 1,
  totalRacers: 6,
  raceTimeMs: 0,
  currentLapMs: 0,
  bestLapMs: 0,
  speedKmh: 0,
  nitro: 100,
  nitroActive: false,
  nitroOverheated: false,
  driftScore: 0,
  currentDriftPoints: 0,
  coinsCollected: 0,
  overtakes: 0,
  wrongWay: false,
  notificationText: '',
  notificationTimer: 0,
};

export default function App() {
  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heroCarCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game | null>(null);

  const [saveData, setSaveData] = useState<SaveData>(() => SaveManager.load());
  const [gameState, setGameState] = useState<GameState>(GameState.MAIN_MENU);
  const [hud, setHud] = useState<HudSnapshot>(INITIAL_HUD);
  const [raceResults, setRaceResults] = useState<RaceResultsData | null>(null);

  // Initialize Game instance once
  if (!gameRef.current) {
    gameRef.current = new Game({
      onHudUpdate: (snapshot) => {
        setHud({ ...snapshot });
      },
      onStateChange: (newState, results) => {
        setGameState(newState);
        if (results) {
          setRaceResults(results);
        }
        setSaveData({ ...SaveManager.getData() });
      },
    });
  }

  useEffect(() => {
    const game = gameRef.current!;
    if (mainCanvasRef.current) {
      game.mountCanvases(mainCanvasRef.current);
    }
    return () => {
      game.unmount();
    };
  }, []);

  // Rotate hero car preview on Main Menu
  useEffect(() => {
    if (gameState !== GameState.MAIN_MENU) return;
    let angle = -Math.PI / 6;
    let raf: number;
    const selectedCar = getCarById(saveData.selectedCarId);
    const carUpgrades = saveData.upgrades[selectedCar.id];

    const renderLoop = () => {
      angle += 0.007;
      UIManager.renderCarPreview(heroCarCanvasRef.current, selectedCar, carUpgrades, angle);
      raf = requestAnimationFrame(renderLoop);
    };
    raf = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(raf);
  }, [gameState, saveData.selectedCarId, saveData.upgrades]);

  const navigateTo = (target: GameState) => {
    const game = gameRef.current!;
    game.audio.playSfx('menu_click');
    game.setState(target);
  };

  const handleQuickPlay = () => {
    const game = gameRef.current!;
    game.audio.playSfx('menu_click');
    const selectedTrack = getTrackById(saveData.selectedTrackId);
    game.startRace({
      mode: 'quick',
      carId: saveData.selectedCarId,
      trackId: saveData.selectedTrackId,
      laps: 3,
      aiCount: 5,
      aiDifficulty: selectedTrack.defaultWeather === 'Snow' ? ('Hard' as any) : ('Medium' as any),
      weather: selectedTrack.defaultWeather,
      timeOfDay: selectedTrack.defaultTimeOfDay,
    });
  };

  const handleStartCareerEvent = (ev: CareerEvent) => {
    const game = gameRef.current!;
    game.audio.playSfx('menu_click');
    game.startRace({
      mode: 'career',
      careerEventId: ev.id,
      carId: saveData.selectedCarId,
      trackId: ev.trackId,
      laps: ev.laps,
      aiCount: ev.aiCount,
      aiDifficulty: ev.aiDifficulty,
      weather: ev.weather,
      timeOfDay: ev.timeOfDay,
    });
  };

  const handleStartCustomRace = (config: RaceConfig) => {
    const game = gameRef.current!;
    game.audio.playSfx('menu_click');
    game.startRace(config);
  };

  const handleSelectCar = (carId: string) => {
    SaveManager.selectCar(carId);
    gameRef.current?.audio.playSfx('menu_click');
    setSaveData({ ...SaveManager.getData() });
  };

  const handleUnlockCar = (carId: string) => {
    if (SaveManager.unlockCar(carId)) {
      gameRef.current?.audio.playSfx('unlock');
      setSaveData({ ...SaveManager.getData() });
    }
  };

  const handleUpgradeCar = (carId: string, upgradeType: UpgradeType) => {
    if (SaveManager.upgradeCar(carId, upgradeType)) {
      gameRef.current?.audio.playSfx('upgrade');
      setSaveData({ ...SaveManager.getData() });
    }
  };

  const handleSelectTrack = (trackId: string) => {
    SaveManager.selectTrack(trackId);
    gameRef.current?.audio.playSfx('menu_click');
    setSaveData({ ...SaveManager.getData() });
  };

  const handleUnlockTrack = (trackId: string) => {
    if (SaveManager.unlockTrack(trackId)) {
      gameRef.current?.audio.playSfx('unlock');
      setSaveData({ ...SaveManager.getData() });
    }
  };

  const handleUpdateSettings = (partial: Partial<GameSettings>) => {
    SaveManager.updateSettings(partial);
    gameRef.current?.applySettings();
    setSaveData({ ...SaveManager.getData() });
  };

  const handleResetProgress = () => {
    SaveManager.resetProgress();
    gameRef.current?.applySettings();
    gameRef.current?.audio.playSfx('menu_click');
    setSaveData({ ...SaveManager.getData() });
  };

  const handleNextRace = () => {
    const game = gameRef.current!;
    game.audio.playSfx('menu_click');

    if (raceResults?.mode === 'career' && raceResults.careerEventId) {
      const currentIdx = CAREER_EVENTS.findIndex((e) => e.id === raceResults.careerEventId);
      const nextEv = CAREER_EVENTS[currentIdx + 1];
      if (nextEv && SaveManager.isCareerEventUnlocked(nextEv.id)) {
        handleStartCareerEvent(nextEv);
        return;
      }
      navigateTo(GameState.CAREER_MODE);
      return;
    }

    handleQuickPlay();
  };

  const isGameplayActive =
    gameState === GameState.COUNTDOWN ||
    gameState === GameState.RACING ||
    gameState === GameState.PAUSED ||
    gameState === GameState.FINISHED;

  const currentCar = getCarById(saveData.selectedCarId);
  const currentCarStats = computeEffectiveCarStats(
    currentCar,
    saveData.upgrades[currentCar.id]
  );
  const currentTrack = getTrackById(saveData.selectedTrackId);

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-slate-950 text-slate-100">
      {/* Persistent Full-Viewport 2D Game & Attract-Mode Canvas */}
      <canvas
        ref={mainCanvasRef}
        className="fixed inset-0 z-0 h-full w-full block"
      />

      {/* Active Gameplay HUD & Pause Modal */}
      {isGameplayActive && (
        <>
          <RacingHud
            hud={hud}
            game={gameRef.current!}
            muted={saveData.settings.muted}
            onToggleMute={() =>
              handleUpdateSettings({ muted: !saveData.settings.muted })
            }
          />
          {gameState === GameState.PAUSED && (
            <PauseModal
              onResume={() => gameRef.current?.togglePause()}
              onRestart={() => gameRef.current?.restartRace()}
              onSettings={() => navigateTo(GameState.SETTINGS)}
              onQuitToMenu={() => navigateTo(GameState.MAIN_MENU)}
            />
          )}
        </>
      )}

      {/* Non-Gameplay Menu Chrome & Views */}
      {!isGameplayActive && (
        <div className="relative z-10 flex min-h-screen flex-col">
          {/* Strict 3-Zone Top Bar Contract */}
          <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/85 px-6 py-4 backdrop-blur-md">
            {/* Zone 1: Single text element wordmark */}
            <button
              type="button"
              onClick={() => navigateTo(GameState.MAIN_MENU)}
              className="font-display text-lg font-extrabold tracking-tight text-white transition-colors hover:text-amber-400 whitespace-nowrap"
            >
              Ultimate 2D Racing
            </button>

            {/* Zone 2: 5 clean text navigation links */}
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-300">
              <button
                type="button"
                onClick={() => navigateTo(GameState.CAREER_MODE)}
                className={`transition-colors hover:text-white whitespace-nowrap ${
                  gameState === GameState.CAREER_MODE ? 'text-amber-400 underline underline-offset-8' : ''
                }`}
              >
                Career Mode
              </button>
              <button
                type="button"
                onClick={() => navigateTo(GameState.QUICK_RACE)}
                className={`transition-colors hover:text-white whitespace-nowrap ${
                  gameState === GameState.QUICK_RACE ? 'text-amber-400 underline underline-offset-8' : ''
                }`}
              >
                Quick Race
              </button>
              <button
                type="button"
                onClick={() => navigateTo(GameState.GARAGE)}
                className={`transition-colors hover:text-white whitespace-nowrap ${
                  gameState === GameState.GARAGE || gameState === GameState.CAR_SELECT
                    ? 'text-amber-400 underline underline-offset-8'
                    : ''
                }`}
              >
                Garage
              </button>
              <button
                type="button"
                onClick={() => navigateTo(GameState.TRACK_SELECT)}
                className={`transition-colors hover:text-white whitespace-nowrap ${
                  gameState === GameState.TRACK_SELECT ? 'text-amber-400 underline underline-offset-8' : ''
                }`}
              >
                Tracks
              </button>
              <button
                type="button"
                onClick={() => navigateTo(GameState.HIGH_SCORES)}
                className={`transition-colors hover:text-white whitespace-nowrap ${
                  gameState === GameState.HIGH_SCORES ? 'text-amber-400 underline underline-offset-8' : ''
                }`}
              >
                High Scores
              </button>
            </nav>

            {/* Zone 3: 2 primary actions */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  handleUpdateSettings({ muted: !saveData.settings.muted })
                }
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
                title={saveData.settings.muted ? 'Unmute Audio' : 'Mute Audio'}
              >
                {saveData.settings.muted ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <button
                type="button"
                onClick={handleQuickPlay}
                className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
              >
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Play Now</span>
              </button>
            </div>
          </header>

          {/* Main View Router */}
          <main className="flex-1">
            {gameState === GameState.MAIN_MENU && (
              <div className="mx-auto flex max-w-6xl flex-col justify-between gap-10 px-6 py-10 lg:flex-row lg:items-center lg:py-16">
                {/* Left Column: Game Title, Primary Play CTA & Complete Menu Navigation */}
                <div className="max-w-xl space-y-6">
                  <div className="flex items-center gap-2 text-xs font-medium text-amber-400">
                    <span>Top-Down Arcade Motorsport</span>
                    <span aria-hidden="true">·</span>
                    <span>5 World Circuits</span>
                    <span aria-hidden="true">·</span>
                    <span>Full Drift & N2O Physics</span>
                  </div>

                  <h1 className="font-display text-4xl font-extrabold tracking-tight text-white sm:text-6xl [text-wrap:balance]">
                    Ultimate 2D Racing
                  </h1>

                  <p className="text-base leading-relaxed text-slate-300">
                    Take the wheel across urban asphalt, desert canyons, rain-slicked timberland,
                    alpine snowbanks, and midnight neon expressways. Earn coins, tune six mechanical
                    subsystems in the garage, and outmaneuver rival AI drivers.
                  </p>

                  {/* Primary Action & Core Mode Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={handleQuickPlay}
                      className="flex items-center gap-2.5 rounded-lg bg-amber-400 px-7 py-3.5 text-sm font-bold text-slate-950 transition-transform duration-150 hover:scale-[1.02] hover:bg-amber-300 whitespace-nowrap"
                    >
                      <Play className="h-4 w-4 fill-current" />
                      <span>Play Race</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo(GameState.CAREER_MODE)}
                      className="rounded-lg border border-slate-700 bg-slate-900/90 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:border-amber-400/60 hover:bg-slate-800 whitespace-nowrap"
                    >
                      Career Mode
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo(GameState.QUICK_RACE)}
                      className="rounded-lg border border-slate-700 bg-slate-900/90 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:border-slate-500 hover:bg-slate-800 whitespace-nowrap"
                    >
                      Quick Race
                    </button>
                  </div>

                  {/* Secondary Menu Grid: All Required Menu Destinations */}
                  <div className="grid grid-cols-2 gap-2.5 pt-4 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => navigateTo(GameState.GARAGE)}
                      className="rounded-lg border border-slate-800 bg-slate-900/75 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
                    >
                      <div className="text-xs font-semibold text-white">Garage</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">Upgrade & Tune</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo(GameState.CAR_SELECT)}
                      className="rounded-lg border border-slate-800 bg-slate-900/75 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
                    >
                      <div className="text-xs font-semibold text-white">Car Selection</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {saveData.unlockedCars.length} / 5 Unlocked
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo(GameState.TRACK_SELECT)}
                      className="rounded-lg border border-slate-800 bg-slate-900/75 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
                    >
                      <div className="text-xs font-semibold text-white">Track Selection</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">
                        {currentTrack.name}
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo(GameState.HIGH_SCORES)}
                      className="rounded-lg border border-slate-800 bg-slate-900/75 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
                    >
                      <div className="text-xs font-semibold text-white">High Scores</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">Lap Leaderboard</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo(GameState.HOW_TO_PLAY)}
                      className="rounded-lg border border-slate-800 bg-slate-900/75 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
                    >
                      <div className="text-xs font-semibold text-white">How to Play</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">Controls & Tips</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => navigateTo(GameState.SETTINGS)}
                      className="rounded-lg border border-slate-800 bg-slate-900/75 px-4 py-3 text-left transition-colors hover:border-slate-700 hover:bg-slate-900"
                    >
                      <div className="text-xs font-semibold text-white">Settings</div>
                      <div className="mt-0.5 text-[11px] text-slate-400">Audio & Graphics</div>
                    </button>
                  </div>
                </div>

                {/* Right Column: Active Vehicle & Driver Telemetry Showcase Card */}
                <div className="w-full max-w-md rounded-xl border border-slate-800/90 bg-slate-900/80 p-6 backdrop-blur-md">
                  <div className="flex items-baseline justify-between">
                    <div>
                      <span className="text-xs font-medium text-amber-400">
                        Equipped Machine · {currentCar.category}
                      </span>
                      <h2 className="mt-0.5 font-display text-2xl font-bold text-white">
                        {currentCar.name}
                      </h2>
                    </div>
                    <span className="font-mono text-sm font-bold text-amber-400">
                      {saveData.coins.toLocaleString()} Coins
                    </span>
                  </div>

                  <div className="my-4 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                    <canvas
                      ref={heroCarCanvasRef}
                      width={380}
                      height={180}
                      className="h-[175px] w-full object-cover"
                    />
                  </div>

                  {/* Quick Stat Readout */}
                  <div className="grid grid-cols-3 gap-3 text-xs">
                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5">
                      <span className="text-slate-400">Top Speed</span>
                      <div className="mt-0.5 font-mono text-sm font-bold text-white">
                        {currentCarStats.topSpeed} / 100
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5">
                      <span className="text-slate-400">Acceleration</span>
                      <div className="mt-0.5 font-mono text-sm font-bold text-white">
                        {currentCarStats.acceleration} / 100
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/60 p-2.5">
                      <span className="text-slate-400">Handling</span>
                      <div className="mt-0.5 font-mono text-sm font-bold text-white">
                        {currentCarStats.handling} / 100
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 text-xs text-slate-400">
                    <span>
                      Selected Circuit: <strong className="text-white">{currentTrack.name}</strong>
                    </span>
                    <span>
                      Career Wins: <strong className="font-mono text-white">{saveData.stats.wins}</strong>
                    </span>
                  </div>
                </div>
              </div>
            )}

            {(gameState === GameState.GARAGE || gameState === GameState.CAR_SELECT) && (
              <GarageAndCarsView
                mode={gameState === GameState.GARAGE ? 'garage' : 'car_select'}
                saveData={saveData}
                onSelectCar={handleSelectCar}
                onUnlockCar={handleUnlockCar}
                onUpgradeCar={handleUpgradeCar}
                onStartQuickRaceWithCar={(carId) => {
                  handleSelectCar(carId);
                  const track = getTrackById(saveData.selectedTrackId);
                  handleStartCustomRace({
                    mode: 'quick',
                    carId,
                    trackId: track.id,
                    laps: 3,
                    aiCount: 5,
                    aiDifficulty: 'Medium' as any,
                    weather: track.defaultWeather,
                    timeOfDay: track.defaultTimeOfDay,
                  });
                }}
              />
            )}

            {gameState === GameState.CAREER_MODE && (
              <CareerModeView
                saveData={saveData}
                onStartCareerEvent={handleStartCareerEvent}
              />
            )}

            {gameState === GameState.TRACK_SELECT && (
              <TrackSelectView
                saveData={saveData}
                onSelectTrack={handleSelectTrack}
                onUnlockTrack={handleUnlockTrack}
                onStartQuickRaceOnTrack={(trackId) => {
                  handleSelectTrack(trackId);
                  const track = getTrackById(trackId);
                  handleStartCustomRace({
                    mode: 'quick',
                    carId: saveData.selectedCarId,
                    trackId,
                    laps: 3,
                    aiCount: 5,
                    aiDifficulty: 'Medium' as any,
                    weather: track.defaultWeather,
                    timeOfDay: track.defaultTimeOfDay,
                  });
                }}
              />
            )}

            {gameState === GameState.QUICK_RACE && (
              <QuickRaceView
                saveData={saveData}
                onStartQuickRace={handleStartCustomRace}
              />
            )}

            {gameState === GameState.HIGH_SCORES && (
              <HighScoresView saveData={saveData} />
            )}

            {gameState === GameState.SETTINGS && (
              <SettingsView
                settings={saveData.settings}
                onUpdateSettings={handleUpdateSettings}
                onResetProgress={handleResetProgress}
              />
            )}

            {gameState === GameState.HOW_TO_PLAY && (
              <HowToPlayView onStartPracticeRace={handleQuickPlay} />
            )}

            {gameState === GameState.RESULTS && raceResults && (
              <RaceResultsView
                results={raceResults}
                totalCoins={saveData.coins}
                onRaceAgain={() => gameRef.current?.restartRace()}
                onNextRace={handleNextRace}
                onOpenGarage={() => navigateTo(GameState.GARAGE)}
                onMainMenu={() => navigateTo(GameState.MAIN_MENU)}
              />
            )}
          </main>
        </div>
      )}
    </div>
  );
}
