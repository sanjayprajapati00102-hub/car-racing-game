import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock, Play, RotateCcw, Trophy } from 'lucide-react';
import { CARS } from '../game/data/cars';
import { CAREER_EVENTS } from '../game/data/career';
import { getTrackById, TRACKS } from '../game/data/tracks';
import { SaveManager } from '../game/SaveManager';
import {
  AIDifficulty,
  CareerEvent,
  GameSettings,
  GameState,
  RaceConfig,
  RaceResultsData,
  SaveData,
  TimeOfDay,
  TrackSpec,
  WeatherType,
} from '../game/types';
import { UIManager } from '../game/UIManager';

/* ============================================================================
 * 1. CAREER MODE VIEW
 * ========================================================================== */
interface CareerModeViewProps {
  saveData: SaveData;
  onStartCareerEvent: (event: CareerEvent) => void;
}

export const CareerModeView: React.FC<CareerModeViewProps> = ({
  saveData,
  onStartCareerEvent,
}) => {
  const chapters = [1, 2, 3];
  const completedCount = Object.values(saveData.careerProgress).filter((p) => p.completed).length;
  const progressPercent = Math.round((completedCount / CAREER_EVENTS.length) * 100);

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-6 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-medium text-amber-400">Championship Progression</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            Career Mode
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-sm text-slate-300">
          <div>
            <span className="text-slate-400">Progress: </span>
            <strong className="font-mono text-white">{progressPercent}%</strong>
          </div>
          <div>
            <span className="text-slate-400">Trophies: </span>
            <strong className="font-mono text-amber-400">{saveData.stats.trophies} / 24</strong>
          </div>
          <div>
            <span className="text-slate-400">Record: </span>
            <strong className="font-mono text-white">
              {saveData.stats.wins}W - {saveData.stats.losses}L
            </strong>
          </div>
          <div>
            <span className="text-slate-400">Coins: </span>
            <strong className="font-mono text-amber-400">
              {saveData.coins.toLocaleString()}
            </strong>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {chapters.map((chapterNum) => {
          const events = CAREER_EVENTS.filter((e) => e.chapter === chapterNum);
          const chapterTitle = events[0]?.chapterTitle || `Chapter ${chapterNum}`;

          return (
            <section key={chapterNum}>
              <h2 className="mb-4 font-display text-xl font-bold text-white">{chapterTitle}</h2>
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {events.map((ev, idx) => {
                  const unlocked = SaveManager.isCareerEventUnlocked(ev.id);
                  const result = saveData.careerProgress[ev.id];
                  const track = getTrackById(ev.trackId);

                  return (
                    <div
                      key={ev.id}
                      className={`flex flex-col justify-between rounded-xl border p-5 transition-all ${
                        unlocked
                          ? 'border-slate-800 bg-slate-900/80 hover:border-slate-700'
                          : 'border-slate-800/40 bg-slate-950/50 opacity-65'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>
                            0{idx + 1}. {track.name} · {ev.laps} Laps
                          </span>
                          {!unlocked ? (
                            <Lock className="h-3.5 w-3.5 text-slate-500" />
                          ) : (
                            <span className="font-mono text-amber-400">
                              {result?.trophies || 0} / 3 Trophies
                            </span>
                          )}
                        </div>

                        <h3 className="mt-2 font-display text-lg font-bold text-white">
                          {ev.title}
                        </h3>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">
                          {ev.subtitle}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span>AI: {ev.aiDifficulty}</span>
                          <span aria-hidden="true">·</span>
                          <span>{ev.weather}</span>
                          <span aria-hidden="true">·</span>
                          <span>{ev.timeOfDay}</span>
                          <span aria-hidden="true">·</span>
                          <span>1st Prize: {ev.rewardCoins.first} Coins</span>
                        </div>

                        {result?.completed && (
                          <div className="mt-3 pt-3 border-t border-slate-800/70 flex items-center justify-between font-mono text-xs text-emerald-400">
                            <span>Best Finish: P{result.bestPosition}</span>
                            <span>{UIManager.formatTime(result.bestTimeMs)}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-800/80">
                        <button
                          type="button"
                          disabled={!unlocked}
                          onClick={() => onStartCareerEvent(ev)}
                          className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                            unlocked
                              ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                              : 'cursor-not-allowed bg-slate-800 text-slate-500'
                          }`}
                        >
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>
                            {unlocked
                              ? result?.completed
                                ? 'Race Again'
                                : 'Start Event'
                              : 'Complete Previous Race to Unlock'}
                          </span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. TRACK SELECTION VIEW
 * ========================================================================== */
interface TrackSelectViewProps {
  saveData: SaveData;
  onSelectTrack: (trackId: string) => void;
  onUnlockTrack: (trackId: string) => void;
  onStartQuickRaceOnTrack: (trackId: string) => void;
}

const TrackCardPreview: React.FC<{ track: TrackSpec }> = ({ track }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    UIManager.renderTrackPreview(canvasRef.current, track);
  }, [track]);

  return (
    <canvas
      ref={canvasRef}
      width={300}
      height={150}
      className="h-[140px] w-full rounded-lg border border-slate-800 object-cover"
    />
  );
};

export const TrackSelectView: React.FC<TrackSelectViewProps> = ({
  saveData,
  onSelectTrack,
  onUnlockTrack,
  onStartQuickRaceOnTrack,
}) => {
  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-amber-400">World Circuits</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            Track Selection
          </h1>
        </div>
        <div className="font-mono text-sm text-slate-300">
          Balance: <strong className="text-amber-400">{saveData.coins.toLocaleString()} Coins</strong>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {TRACKS.map((track, idx) => {
          const unlocked = saveData.unlockedTracks.includes(track.id);
          const selected = saveData.selectedTrackId === track.id;
          const bestLap = saveData.bestLapTimes[track.id];

          return (
            <div
              key={track.id}
              className={`flex flex-col justify-between rounded-xl border p-5 transition-all ${
                selected
                  ? 'border-amber-400 bg-slate-900/90'
                  : 'border-slate-800 bg-slate-900/65 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    0{idx + 1}. {track.region} · {track.lengthKm} km
                  </span>
                  {!unlocked ? (
                    <Lock className="h-3.5 w-3.5 text-slate-500" />
                  ) : selected ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : null}
                </div>

                <h2 className="mt-1.5 font-display text-xl font-bold text-white">{track.name}</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-300">{track.description}</p>

                <div className="my-4">
                  <TrackCardPreview track={track} />
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span>Difficulty: {track.difficultyLabel}</span>
                  <span aria-hidden="true">·</span>
                  <span>Grip: {Math.round(track.gripModifier * 100)}%</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Best Lap: {bestLap ? UIManager.formatTime(bestLap) : 'No Record'}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-2.5 pt-4 border-t border-slate-800/80">
                {!unlocked ? (
                  <button
                    type="button"
                    disabled={saveData.coins < track.unlockCost}
                    onClick={() => onUnlockTrack(track.id)}
                    className={`w-full rounded-lg px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      saveData.coins >= track.unlockCost
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                        : 'cursor-not-allowed bg-slate-800 text-slate-500'
                    }`}
                  >
                    Unlock Track ({track.unlockCost.toLocaleString()} Coins)
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => onSelectTrack(track.id)}
                      className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                        selected
                          ? 'border border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                          : 'bg-slate-800 text-white hover:bg-slate-700'
                      }`}
                    >
                      {selected ? 'Selected' : 'Select'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onStartQuickRaceOnTrack(track.id)}
                      className="flex-1 rounded-lg bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
                    >
                      Race Track
                    </button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. QUICK RACE CONFIGURATOR VIEW
 * ========================================================================== */
interface QuickRaceViewProps {
  saveData: SaveData;
  onStartQuickRace: (config: RaceConfig) => void;
}

export const QuickRaceView: React.FC<QuickRaceViewProps> = ({
  saveData,
  onStartQuickRace,
}) => {
  const [carId, setCarId] = useState(saveData.selectedCarId);
  const [trackId, setTrackId] = useState(saveData.selectedTrackId);
  const [laps, setLaps] = useState(3);
  const [aiCount, setAiCount] = useState(5);
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>(AIDifficulty.MEDIUM);
  const [weather, setWeather] = useState<WeatherType>(WeatherType.CLEAR);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>(TimeOfDay.DAY);

  const selectedTrack = getTrackById(trackId);

  useEffect(() => {
    setWeather(selectedTrack.defaultWeather);
    setTimeOfDay(selectedTrack.defaultTimeOfDay);
  }, [trackId, selectedTrack.defaultWeather, selectedTrack.defaultTimeOfDay]);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-8 border-b border-slate-800/80 pb-6">
        <p className="text-xs font-medium text-amber-400">Custom Event Setup</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
          Quick Race
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/75 p-6 lg:col-span-7">
          {/* Select Car */}
          <div>
            <label className="block text-xs font-medium text-slate-300">Select Unlocked Car</label>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {CARS.map((c) => {
                const unlocked = saveData.unlockedCars.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => setCarId(c.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                      carId === c.id
                        ? 'border-amber-400 bg-amber-400/15 text-white'
                        : unlocked
                          ? 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                          : 'cursor-not-allowed border-slate-800/40 bg-slate-950/30 text-slate-600'
                    }`}
                  >
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {unlocked ? c.category : 'Locked in Garage'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Select Track */}
          <div>
            <label className="block text-xs font-medium text-slate-300">Select Circuit</label>
            <div className="mt-2 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {TRACKS.map((t) => {
                const unlocked = saveData.unlockedTracks.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => setTrackId(t.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-xs font-medium transition-colors ${
                      trackId === t.id
                        ? 'border-amber-400 bg-amber-400/15 text-white'
                        : unlocked
                          ? 'border-slate-800 bg-slate-950/60 text-slate-300 hover:border-slate-700'
                          : 'cursor-not-allowed border-slate-800/40 bg-slate-950/30 text-slate-600'
                    }`}
                  >
                    <div className="font-semibold truncate">{t.name}</div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      {unlocked ? t.region : 'Locked'}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Laps & Number of AI Opponents */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-300">Number of Laps</label>
              <div className="mt-2 flex gap-1.5 rounded-lg bg-slate-950 p-1">
                {[2, 3, 5, 8].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setLaps(n)}
                    className={`flex-1 rounded-md py-2 font-mono text-xs font-semibold transition-colors ${
                      laps === n
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {n} Laps
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">AI Opponents</label>
              <div className="mt-2 flex gap-1.5 rounded-lg bg-slate-950 p-1">
                {[3, 5, 7].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setAiCount(n)}
                    className={`flex-1 rounded-md py-2 font-mono text-xs font-semibold transition-colors ${
                      aiCount === n
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {n} Cars
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* AI Difficulty, Weather & Time of Day */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-300">AI Difficulty</label>
              <div className="mt-2 flex flex-col gap-1.5">
                {Object.values(AIDifficulty).map((diff) => (
                  <button
                    key={diff}
                    type="button"
                    onClick={() => setAiDifficulty(diff)}
                    className={`rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                      aiDifficulty === diff
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {diff}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Weather</label>
              <div className="mt-2 flex flex-col gap-1.5">
                {Object.values(WeatherType).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWeather(w)}
                    className={`rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                      weather === w
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Time of Day</label>
              <div className="mt-2 flex flex-col gap-1.5">
                {Object.values(TimeOfDay).map((tod) => (
                  <button
                    key={tod}
                    type="button"
                    onClick={() => setTimeOfDay(tod)}
                    className={`rounded-md px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                      timeOfDay === tod
                        ? 'bg-amber-400 text-slate-950 font-semibold'
                        : 'bg-slate-950 text-slate-400 hover:text-white'
                    }`}
                  >
                    {tod}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Summary & Start CTA */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/75 p-6 lg:col-span-5">
          <div>
            <h2 className="font-display text-xl font-bold text-white">{selectedTrack.name}</h2>
            <p className="mt-1 text-xs text-slate-300">{selectedTrack.description}</p>
            <div className="my-4">
              <TrackCardPreview track={selectedTrack} />
            </div>
            <div className="space-y-2 text-xs text-slate-300">
              <div className="flex justify-between border-b border-slate-800/80 py-1.5">
                <span className="text-slate-400">Selected Vehicle</span>
                <span className="font-semibold text-white">
                  {CARS.find((c) => c.id === carId)?.name}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 py-1.5">
                <span className="text-slate-400">Distance</span>
                <span className="font-mono text-white">
                  {laps} Laps ({(selectedTrack.lengthKm * laps).toFixed(1)} km)
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 py-1.5">
                <span className="text-slate-400">Grid Size</span>
                <span className="font-mono text-white">{aiCount + 1} Racers ({aiDifficulty})</span>
              </div>
              <div className="flex justify-between py-1.5">
                <span className="text-slate-400">Conditions</span>
                <span className="text-white">
                  {weather} · {timeOfDay}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onStartQuickRace({
                mode: 'quick',
                carId,
                trackId,
                laps,
                aiCount,
                aiDifficulty,
                weather,
                timeOfDay,
              })
            }
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-amber-400 px-6 py-3.5 text-sm font-bold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Start Race Now</span>
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. RACE RESULTS VIEW
 * ========================================================================== */
interface RaceResultsViewProps {
  results: RaceResultsData;
  totalCoins: number;
  onRaceAgain: () => void;
  onNextRace: () => void;
  onOpenGarage: () => void;
  onMainMenu: () => void;
}

export const RaceResultsView: React.FC<RaceResultsViewProps> = ({
  results,
  totalCoins,
  onRaceAgain,
  onNextRace,
  onOpenGarage,
  onMainMenu,
}) => {
  const isPodium = results.position <= 3;

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-amber-400">
            {results.trackName} · Official Classification
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {results.position === 1
              ? 'Victory — 1st Place!'
              : isPodium
                ? `Podium Finish — Position ${results.position}`
                : `Race Finished — Position ${results.position} / ${results.totalRacers}`}
          </h1>
          {results.unlockedNextEventTitle && (
            <p className="mt-1 text-xs font-semibold text-emerald-400">
              Unlocked Next Career Event: {results.unlockedNextEventTitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Trophy
            className={`h-8 w-8 ${
              results.position === 1
                ? 'text-amber-400'
                : results.position === 2
                  ? 'text-slate-300'
                  : results.position === 3
                    ? 'text-amber-600'
                    : 'text-slate-600'
            }`}
          />
          <div>
            <div className="text-xs text-slate-400">Total Wallet Balance</div>
            <div className="font-mono text-xl font-bold text-amber-400">
              {totalCoins.toLocaleString()} Coins
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left: Telemetry & Rewards Breakdown */}
        <div className="space-y-6 rounded-xl border border-slate-800 bg-slate-900/80 p-6 lg:col-span-6">
          <h2 className="font-display text-lg font-bold text-white">
            Performance & Rewards Breakdown
          </h2>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-xs text-slate-400">Race Time</div>
              <div className="mt-1 font-mono text-base font-bold text-white">
                {UIManager.formatTime(results.totalTimeMs)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-xs text-slate-400">Best Lap</div>
              <div className="mt-1 font-mono text-base font-bold text-emerald-400">
                {UIManager.formatTime(results.bestLapMs)}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-xs text-slate-400">Drift Score</div>
              <div className="mt-1 font-mono text-base font-bold text-sky-400">
                {results.driftScore.toLocaleString()} pts
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-xs text-slate-400">Overtakes</div>
              <div className="mt-1 font-mono text-base font-bold text-white">
                {results.overtakes}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-xs text-slate-400">Coins Picked Up</div>
              <div className="mt-1 font-mono text-base font-bold text-amber-400">
                {results.coinsCollectedInRace}
              </div>
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
              <div className="text-xs text-slate-400">Clean Laps</div>
              <div className="mt-1 font-mono text-base font-bold text-white">
                {results.perfectLaps}
              </div>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-800 pt-4 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Finishing Position Purse (P{results.position})</span>
              <span className="font-mono font-semibold text-white">
                +{results.rewards.positionReward} Coins
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Podium Finish Bonus</span>
              <span className="font-mono font-semibold text-white">
                +{results.rewards.podiumBonus} Coins
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>On-Track Coins Collected ({results.coinsCollectedInRace} × 25)</span>
              <span className="font-mono font-semibold text-white">
                +{results.rewards.collectedBonus} Coins
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Drift Mastery Bonus</span>
              <span className="font-mono font-semibold text-white">
                +{results.rewards.driftBonus} Coins
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Overtake Bonus ({results.overtakes} × 20)</span>
              <span className="font-mono font-semibold text-white">
                +{results.rewards.overtakeBonus} Coins
              </span>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Perfect Lap Bonus ({results.perfectLaps} × 75)</span>
              <span className="font-mono font-semibold text-white">
                +{results.rewards.perfectLapBonus} Coins
              </span>
            </div>
            <div className="flex justify-between border-t border-slate-800 pt-3 text-sm font-bold text-amber-400">
              <span>Total Coins Earned</span>
              <span className="font-mono">+{results.rewards.totalEarned} Coins</span>
            </div>
          </div>
        </div>

        {/* Right: Standings Leaderboard */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-6 lg:col-span-6">
          <div>
            <h2 className="mb-4 font-display text-lg font-bold text-white">Race Standings</h2>
            <div className="overflow-hidden rounded-lg border border-slate-800">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/90 text-slate-400">
                  <tr>
                    <th className="py-2.5 pl-4 pr-2">Pos</th>
                    <th className="px-2 py-2.5">Driver</th>
                    <th className="px-2 py-2.5">Car</th>
                    <th className="py-2.5 pl-2 pr-4 text-right">Total Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 font-mono">
                  {results.standings.map((row) => (
                    <tr
                      key={`${row.position}_${row.name}`}
                      className={
                        row.isPlayer
                          ? 'bg-amber-400/15 font-semibold text-amber-300'
                          : 'text-slate-300'
                      }
                    >
                      <td className="py-2.5 pl-4 pr-2">P{row.position}</td>
                      <td className="px-2 py-2.5 font-sans">
                        {row.name} {row.isPlayer && '(You)'}
                      </td>
                      <td className="px-2 py-2.5 font-sans text-slate-400">{row.carName}</td>
                      <td className="py-2.5 pl-2 pr-4 text-right">
                        {UIManager.formatTime(row.timeMs)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <button
              type="button"
              onClick={onRaceAgain}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-800 px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-slate-700 whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Race Again</span>
            </button>
            <button
              type="button"
              onClick={onNextRace}
              className="rounded-lg bg-amber-400 px-4 py-3 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
            >
              Next Race
            </button>
            <button
              type="button"
              onClick={onOpenGarage}
              className="rounded-lg bg-slate-800 px-4 py-3 text-xs font-semibold text-white transition-colors hover:bg-slate-700 whitespace-nowrap"
            >
              Garage
            </button>
            <button
              type="button"
              onClick={onMainMenu}
              className="rounded-lg border border-slate-700 bg-slate-950 px-4 py-3 text-xs font-semibold text-slate-300 transition-colors hover:text-white whitespace-nowrap"
            >
              Main Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. HIGH SCORES LEADERBOARD VIEW
 * ========================================================================== */
export const HighScoresView: React.FC<{ saveData: SaveData }> = ({ saveData }) => {
  const [trackFilter, setTrackFilter] = useState<string>('all');

  const filtered = saveData.highScores
    .filter((h) => trackFilter === 'all' || h.trackId === trackFilter)
    .sort((a, b) => a.bestLapMs - b.bestLapMs);

  return (
    <div className="mx-auto w-full max-w-5xl px-6 py-8">
      <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-amber-400">Local Hall of Fame</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            High Scores & Lap Records
          </h1>
        </div>

        {/* Interactive Filter Controls */}
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-900 p-1">
          <button
            type="button"
            onClick={() => setTrackFilter('all')}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              trackFilter === 'all'
                ? 'bg-amber-400 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Tracks
          </button>
          {TRACKS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTrackFilter(t.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                trackFilter === t.id
                  ? 'bg-amber-400 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-950/80 text-xs text-slate-400">
            <tr>
              <th className="py-3.5 pl-6 pr-3">Rank</th>
              <th className="px-3 py-3.5">Driver</th>
              <th className="px-3 py-3.5">Circuit</th>
              <th className="px-3 py-3.5">Vehicle</th>
              <th className="px-3 py-3.5 text-right">Best Lap</th>
              <th className="px-3 py-3.5 text-right">Total Race</th>
              <th className="py-3.5 pl-3 pr-6 text-right">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {filtered.map((entry, idx) => (
              <tr key={entry.id} className="hover:bg-slate-800/40">
                <td className="py-3.5 pl-6 pr-3 font-mono text-xs font-bold text-amber-400">
                  #{idx + 1}
                </td>
                <td className="px-3 py-3.5 font-medium text-white">{entry.playerName}</td>
                <td className="px-3 py-3.5 text-slate-300">{entry.trackName}</td>
                <td className="px-3 py-3.5 text-slate-400">{entry.carName}</td>
                <td className="px-3 py-3.5 text-right font-mono font-semibold text-emerald-400">
                  {UIManager.formatTime(entry.bestLapMs)}
                </td>
                <td className="px-3 py-3.5 text-right font-mono text-slate-300">
                  {UIManager.formatTime(entry.totalTimeMs)}
                </td>
                <td className="py-3.5 pl-3 pr-6 text-right font-mono text-xs text-slate-400">
                  {entry.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ============================================================================
 * 6. SETTINGS VIEW
 * ========================================================================== */
interface SettingsViewProps {
  settings: GameSettings;
  onUpdateSettings: (partial: Partial<GameSettings>) => void;
  onResetProgress: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetProgress,
}) => {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-8 border-b border-slate-800/80 pb-6">
        <p className="text-xs font-medium text-amber-400">Audio, Graphics & Controls</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
          Settings
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Audio & Profile */}
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/75 p-6">
          <h2 className="font-display text-lg font-bold text-white">Audio & Driver Profile</h2>

          <div>
            <label className="block text-xs font-medium text-slate-300">Driver Name</label>
            <input
              type="text"
              maxLength={20}
              value={settings.playerName}
              onChange={(e) => onUpdateSettings({ playerName: e.target.value })}
              className="mt-1.5 w-full rounded-lg border border-slate-700 bg-slate-950 px-3.5 py-2 text-sm text-white focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Master Volume</span>
              <span className="font-mono text-white">{settings.masterVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.masterVolume}
              onChange={(e) => onUpdateSettings({ masterVolume: Number(e.target.value) })}
              className="mt-2 w-full accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Music Volume</span>
              <span className="font-mono text-white">{settings.musicVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.musicVolume}
              onChange={(e) => onUpdateSettings({ musicVolume: Number(e.target.value) })}
              className="mt-2 w-full accent-amber-400"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs">
              <span className="text-slate-300">Sound Effects Volume</span>
              <span className="font-mono text-white">{settings.sfxVolume}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.sfxVolume}
              onChange={(e) => onUpdateSettings({ sfxVolume: Number(e.target.value) })}
              className="mt-2 w-full accent-amber-400"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs font-medium text-slate-300">Mute All Audio</span>
            <button
              type="button"
              onClick={() => onUpdateSettings({ muted: !settings.muted })}
              className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                settings.muted
                  ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                  : 'bg-slate-800 text-slate-300'
              }`}
            >
              {settings.muted ? 'Muted (ON)' : 'Unmuted (OFF)'}
            </button>
          </div>
        </div>

        {/* Graphics, Controls & Save Data */}
        <div className="flex flex-col justify-between space-y-5 rounded-xl border border-slate-800 bg-slate-900/75 p-6">
          <div className="space-y-5">
            <h2 className="font-display text-lg font-bold text-white">
              Graphics & Control Options
            </h2>

            <div>
              <label className="block text-xs font-medium text-slate-300">Graphics Quality</label>
              <div className="mt-2 flex gap-1.5 rounded-lg bg-slate-950 p-1">
                {(['Low', 'Medium', 'High'] as const).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => onUpdateSettings({ graphicsQuality: q })}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                      settings.graphicsQuality === q
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300">Control Scheme</label>
              <div className="mt-2 flex gap-1.5 rounded-lg bg-slate-950 p-1">
                {(['Keyboard', 'Keyboard + Mouse', 'Touch'] as const).map((cs) => (
                  <button
                    key={cs}
                    type="button"
                    onClick={() => onUpdateSettings({ controlScheme: cs })}
                    className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      settings.controlScheme === cs
                        ? 'bg-amber-400 text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cs}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">Screen Shake Effects</span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ screenShake: !settings.screenShake })}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                  settings.screenShake
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.screenShake ? 'Enabled' : 'Disabled'}
              </button>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-300">
                Canvas Particles & Tire Smoke
              </span>
              <button
                type="button"
                onClick={() => onUpdateSettings({ particles: !settings.particles })}
                className={`rounded-lg px-4 py-1.5 text-xs font-semibold transition-colors ${
                  settings.particles
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {settings.particles ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          </div>

          <div className="border-t border-slate-800 pt-4">
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                className="w-full rounded-lg border border-red-500/40 bg-red-950/30 px-4 py-2.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-950/60"
              >
                Reset All Saved Progress
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onResetProgress();
                    setConfirmReset(false);
                  }}
                  className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-xs font-bold text-white hover:bg-red-500"
                >
                  Confirm Reset
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 7. HOW TO PLAY VIEW
 * ========================================================================== */
export const HowToPlayView: React.FC<{ onStartPracticeRace: () => void }> = ({
  onStartPracticeRace,
}) => {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-8">
      <div className="mb-8 border-b border-slate-800/80 pb-6">
        <p className="text-xs font-medium text-amber-400">Driver Briefing & Controls</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
          How to Play
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/75 p-6">
          <h2 className="font-display text-lg font-bold text-white">Desktop & Mobile Controls</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-300">
            <li className="flex justify-between border-b border-slate-800/70 pb-2">
              <span className="text-slate-400">Accelerate</span>
              <span className="font-mono font-semibold text-white">W / Arrow Up</span>
            </li>
            <li className="flex justify-between border-b border-slate-800/70 pb-2">
              <span className="text-slate-400">Brake & Reverse</span>
              <span className="font-mono font-semibold text-white">S / Arrow Down</span>
            </li>
            <li className="flex justify-between border-b border-slate-800/70 pb-2">
              <span className="text-slate-400">Steer Left / Right</span>
              <span className="font-mono font-semibold text-white">A, D / Left, Right Arrows</span>
            </li>
            <li className="flex justify-between border-b border-slate-800/70 pb-2">
              <span className="text-slate-400">Activate N2O Nitro</span>
              <span className="font-mono font-semibold text-amber-400">Spacebar / Shift</span>
            </li>
            <li className="flex justify-between pb-1">
              <span className="text-slate-400">Pause Race</span>
              <span className="font-mono font-semibold text-white">P / Escape</span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/75 p-6">
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-white">
              Drifting, Nitro & Upgrades
            </h2>
            <p className="text-xs leading-relaxed text-slate-300">
              <strong>01. Controlled Drifting:</strong> Turn into corners at high speed to kick out
              the rear tail. Drifting builds your Drift Score (converted into bonus coins) and
              recharges your N2O Nitro meter 65% faster.
            </p>
            <p className="text-xs leading-relaxed text-slate-300">
              <strong>02. Nitro Management:</strong> Press Space on straightaways for a burst of
              speed. Release before hitting 0% to avoid overheating the N2O system.
            </p>
            <p className="text-xs leading-relaxed text-slate-300">
              <strong>03. Surface & Weather:</strong> Rain and Snow reduce lateral tire grip. Avoid
              oil slicks, water puddles, and ice patches on the road, and collect gold coins for
              instant +25 Coin bonuses.
            </p>
          </div>

          <button
            type="button"
            onClick={onStartPracticeRace}
            className="mt-6 w-full rounded-lg bg-amber-400 px-5 py-3 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300"
          >
            Jump Into Track Practice
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 8. PAUSE OVERLAY MODAL
 * ========================================================================== */
interface PauseModalProps {
  onResume: () => void;
  onRestart: () => void;
  onSettings: () => void;
  onQuitToMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  onResume,
  onRestart,
  onSettings,
  onQuitToMenu,
}) => {
  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm rounded-xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
        <p className="text-xs font-medium text-amber-400">Race Suspended</p>
        <h2 className="mt-1 font-display text-2xl font-bold text-white">Game Paused</h2>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={onResume}
            className="w-full rounded-lg bg-amber-400 py-3 text-xs font-bold text-slate-950 transition-colors hover:bg-amber-300"
          >
            Resume Race (P)
          </button>
          <button
            type="button"
            onClick={onRestart}
            className="w-full rounded-lg bg-slate-800 py-3 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Restart Race
          </button>
          <button
            type="button"
            onClick={onSettings}
            className="w-full rounded-lg bg-slate-800 py-3 text-xs font-semibold text-white transition-colors hover:bg-slate-700"
          >
            Settings
          </button>
          <button
            type="button"
            onClick={onQuitToMenu}
            className="w-full rounded-lg border border-slate-700 bg-slate-950 py-3 text-xs font-semibold text-slate-300 transition-colors hover:text-white"
          >
            Quit to Main Menu
          </button>
        </div>
      </div>
    </div>
  );
};
