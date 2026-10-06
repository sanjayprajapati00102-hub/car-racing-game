import React, { useEffect, useRef } from 'react';
import { Pause, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { Game } from '../game/Game';
import { GameState, HudSnapshot } from '../game/types';
import { UIManager } from '../game/UIManager';

interface RacingHudProps {
  hud: HudSnapshot;
  game: Game;
  muted: boolean;
  onToggleMute: () => void;
}

export const RacingHud: React.FC<RacingHudProps> = ({
  hud,
  game,
  muted,
  onToggleMute,
}) => {
  const minimapRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    game.setMinimapCanvas(minimapRef.current);
    return () => {
      game.setMinimapCanvas(null);
    };
  }, [game]);

  const speedPercent = Math.min(100, (hud.speedKmh / 310) * 100);

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4 sm:p-6">
      {/* Top Row: Left (Position & Lap), Center (Timers), Right (Minimap & Quick Controls) */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: Position & Lap */}
        <div className="flex items-center gap-6 rounded-xl border border-slate-800/90 bg-slate-950/85 px-5 py-3 backdrop-blur-md">
          <div>
            <div className="text-xs font-medium text-slate-400">Position</div>
            <div className="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {hud.position}
              <span className="text-base font-normal text-slate-400"> / {hud.totalRacers}</span>
            </div>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div>
            <div className="text-xs font-medium text-slate-400">Lap</div>
            <div className="font-mono text-2xl font-bold tracking-tight text-amber-400 sm:text-3xl">
              {hud.lap}
              <span className="text-base font-normal text-slate-400"> / {hud.totalLaps}</span>
            </div>
          </div>
          <div className="hidden h-8 w-px bg-slate-800 sm:block" />
          <div className="hidden sm:block">
            <div className="text-xs font-medium text-slate-400">Race Telemetry</div>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-slate-300">
              <span>Coins: {hud.coinsCollected}</span>
              <span aria-hidden="true">·</span>
              <span>Drift: {hud.driftScore}</span>
            </div>
          </div>
        </div>

        {/* Top-Center: Race Timer */}
        <div className="hidden flex-col items-center rounded-xl border border-slate-800/90 bg-slate-950/85 px-6 py-2.5 backdrop-blur-md md:flex">
          <div className="text-xs font-medium text-slate-400">Race Time</div>
          <div className="font-mono text-2xl font-bold tracking-wider text-white">
            {UIManager.formatTime(hud.raceTimeMs)}
          </div>
          <div className="mt-0.5 flex items-center gap-2 font-mono text-xs text-slate-400">
            <span>Lap: {UIManager.formatTime(hud.currentLapMs)}</span>
            {hud.bestLapMs > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-400">Best: {UIManager.formatTime(hud.bestLapMs)}</span>
              </>
            )}
          </div>
        </div>

        {/* Top-Right: Minimap & Action Controls */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={onToggleMute}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/85 text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
              title={muted ? 'Unmute Audio' : 'Mute Audio'}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => game.restartRace()}
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-800 bg-slate-950/85 text-slate-300 transition-colors hover:border-slate-700 hover:text-white"
              title="Restart Race"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => game.togglePause()}
              className="flex h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/85 px-3.5 text-xs font-semibold text-slate-200 transition-colors hover:border-slate-700 hover:text-white whitespace-nowrap"
            >
              <Pause className="h-3.5 w-3.5" />
              <span>Pause (P)</span>
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-800/90 bg-slate-950/85 p-1.5 backdrop-blur-md">
            <canvas
              ref={minimapRef}
              width={168}
              height={126}
              className="block h-[108px] w-[144px] sm:h-[126px] sm:w-[168px]"
            />
          </div>
        </div>
      </div>

      {/* Center Overlays: Countdown, Notifications, Wrong Way, Active Drift */}
      <div className="flex flex-col items-center justify-center gap-3">
        {hud.state === GameState.COUNTDOWN && hud.countdownText && (
          <div
            key={hud.countdownText}
            className="animate-pulse-fast font-display text-7xl font-extrabold tracking-tight text-amber-400 drop-shadow-[0_6px_24px_rgba(245,158,11,0.5)] sm:text-8xl"
          >
            {hud.countdownText}
          </div>
        )}

        {hud.wrongWay && hud.state === GameState.RACING && (
          <div className="rounded-lg border border-red-500/60 bg-red-950/90 px-5 py-2 text-sm font-bold tracking-wide text-red-200">
            Wrong Direction — Turn Around
          </div>
        )}

        {hud.notificationText && hud.state !== GameState.COUNTDOWN && (
          <div className="rounded-lg border border-amber-500/40 bg-slate-950/90 px-5 py-2 font-display text-lg font-bold tracking-wide text-amber-300">
            {hud.notificationText}
          </div>
        )}

        {hud.currentDriftPoints > 20 && (
          <div className="rounded-lg border border-sky-500/40 bg-slate-950/80 px-4 py-1.5 font-mono text-sm font-bold text-sky-300">
            Drift +{hud.currentDriftPoints} pts
          </div>
        )}
      </div>

      {/* Bottom Row: Speedometer (Left), Touch Controls (Mobile/Touch), Nitro Meter (Right) */}
      <div className="flex flex-col gap-4">
        {/* Touch Controls Bar (Visible on touch/mobile screens or when Touch control scheme is selected) */}
        <div className="pointer-events-auto flex items-center justify-between gap-3 lg:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={() => game.input.setTouchControl('left', true)}
              onPointerUp={() => game.input.setTouchControl('left', false)}
              onPointerLeave={() => game.input.setTouchControl('left', false)}
              className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/90 text-lg font-bold text-white active:bg-amber-500 active:text-slate-950"
            >
              LEFT
            </button>
            <button
              type="button"
              onPointerDown={() => game.input.setTouchControl('right', true)}
              onPointerUp={() => game.input.setTouchControl('right', false)}
              onPointerLeave={() => game.input.setTouchControl('right', false)}
              className="flex h-16 w-16 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/90 text-lg font-bold text-white active:bg-amber-500 active:text-slate-950"
            >
              RIGHT
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onPointerDown={() => game.input.setTouchControl('nitro', true)}
              onPointerUp={() => game.input.setTouchControl('nitro', false)}
              onPointerLeave={() => game.input.setTouchControl('nitro', false)}
              className="flex h-16 px-4 items-center justify-center rounded-xl border border-sky-500/60 bg-sky-950/90 text-sm font-bold text-sky-300 active:bg-sky-400 active:text-slate-950 whitespace-nowrap"
            >
              NITRO
            </button>
            <button
              type="button"
              onPointerDown={() => game.input.setTouchControl('brake', true)}
              onPointerUp={() => game.input.setTouchControl('brake', false)}
              onPointerLeave={() => game.input.setTouchControl('brake', false)}
              className="flex h-16 px-4 items-center justify-center rounded-xl border border-red-500/50 bg-red-950/85 text-sm font-bold text-red-200 active:bg-red-500 active:text-white whitespace-nowrap"
            >
              BRAKE
            </button>
            <button
              type="button"
              onPointerDown={() => game.input.setTouchControl('accelerate', true)}
              onPointerUp={() => game.input.setTouchControl('accelerate', false)}
              onPointerLeave={() => game.input.setTouchControl('accelerate', false)}
              className="flex h-16 px-5 items-center justify-center rounded-xl border border-emerald-500/60 bg-emerald-950/90 text-sm font-bold text-emerald-200 active:bg-emerald-400 active:text-slate-950 whitespace-nowrap"
            >
              GAS
            </button>
          </div>
        </div>

        {/* Bottom-Left Speedometer & Bottom-Right Nitro Meter */}
        <div className="flex items-end justify-between gap-4">
          {/* Speedometer */}
          <div className="w-52 rounded-xl border border-slate-800/90 bg-slate-950/85 p-4 backdrop-blur-md sm:w-64">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-slate-400">Speed</span>
              <div className="font-mono text-3xl font-bold tracking-tight text-white">
                {hud.speedKmh} <span className="text-xs font-normal text-slate-400">KM/H</span>
              </div>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-75"
                style={{ width: `${speedPercent}%` }}
              />
            </div>
          </div>

          {/* Nitro Meter */}
          <div className="w-52 rounded-xl border border-slate-800/90 bg-slate-950/85 p-4 backdrop-blur-md sm:w-64">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-slate-400">
                {hud.nitroOverheated
                  ? 'Nitro Cooling Down'
                  : hud.nitroActive
                    ? 'Nitro Engaged'
                    : 'N2O Boost (Space)'}
              </span>
              <span
                className={`font-mono text-xl font-bold ${
                  hud.nitroOverheated
                    ? 'text-red-400'
                    : hud.nitroActive
                      ? 'text-sky-300'
                      : 'text-sky-400'
                }`}
              >
                {hud.nitro}%
              </span>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all duration-75 ${
                  hud.nitroOverheated
                    ? 'bg-red-500'
                    : 'bg-gradient-to-r from-sky-500 to-cyan-300'
                }`}
                style={{ width: `${hud.nitro}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
