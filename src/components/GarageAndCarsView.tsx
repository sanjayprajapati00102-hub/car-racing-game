import React, { useEffect, useRef, useState } from 'react';
import { Check, Lock, Wrench } from 'lucide-react';
import {
  CARS,
  computeEffectiveCarStats,
  getDefaultUpgrades,
  getUpgradeCost,
  MAX_UPGRADE_LEVEL,
  UPGRADE_DEFINITIONS,
} from '../game/data/cars';
import { SaveData, UpgradeType } from '../game/types';
import { UIManager } from '../game/UIManager';

interface GarageAndCarsViewProps {
  mode: 'garage' | 'car_select';
  saveData: SaveData;
  onSelectCar: (carId: string) => void;
  onUnlockCar: (carId: string) => void;
  onUpgradeCar: (carId: string, upgradeType: UpgradeType) => void;
  onStartQuickRaceWithCar: (carId: string) => void;
}

export const GarageAndCarsView: React.FC<GarageAndCarsViewProps> = ({
  mode,
  saveData,
  onSelectCar,
  onUnlockCar,
  onUpgradeCar,
  onStartQuickRaceWithCar,
}) => {
  const [focusedCarId, setFocusedCarId] = useState<string>(saveData.selectedCarId);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const rotationRef = useRef<number>(-Math.PI / 5);

  const focusedCar = CARS.find((c) => c.id === focusedCarId) || CARS[0];
  const isUnlocked = saveData.unlockedCars.includes(focusedCar.id);
  const isSelected = saveData.selectedCarId === focusedCar.id;
  const carUpgrades = saveData.upgrades[focusedCar.id] || getDefaultUpgrades();
  const effectiveStats = computeEffectiveCarStats(focusedCar, carUpgrades);

  useEffect(() => {
    let raf: number;
    const animate = () => {
      rotationRef.current += 0.008;
      UIManager.renderCarPreview(
        previewCanvasRef.current,
        focusedCar,
        carUpgrades,
        rotationRef.current
      );
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(raf);
  }, [focusedCar, carUpgrades]);

  const statRows: { label: string; value: number; base: number }[] = [
    { label: 'Top Speed', value: effectiveStats.topSpeed, base: focusedCar.baseStats.topSpeed },
    { label: 'Acceleration', value: effectiveStats.acceleration, base: focusedCar.baseStats.acceleration },
    { label: 'Handling', value: effectiveStats.handling, base: focusedCar.baseStats.handling },
    { label: 'Braking', value: effectiveStats.braking, base: focusedCar.baseStats.braking },
    { label: 'Nitro Boost', value: effectiveStats.nitro, base: focusedCar.baseStats.nitro },
    { label: 'Tire Grip', value: effectiveStats.grip, base: focusedCar.baseStats.grip },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-slate-800/80 pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-medium text-amber-400">
            {mode === 'garage' ? 'Performance Workshop & Tuning' : 'Showroom Roster'}
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white">
            {mode === 'garage' ? 'Garage & Upgrades' : 'Car Selection'}
          </h1>
        </div>
        <div className="flex items-center gap-3 text-sm text-slate-300">
          <span>Available Balance:</span>
          <span className="font-mono text-lg font-bold text-amber-400">
            {saveData.coins.toLocaleString()} Coins
          </span>
        </div>
      </div>

      {/* Car Roster Selector Bar */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {CARS.map((car, idx) => {
          const unlocked = saveData.unlockedCars.includes(car.id);
          const active = focusedCar.id === car.id;
          const equipped = saveData.selectedCarId === car.id;

          return (
            <button
              key={car.id}
              type="button"
              onClick={() => {
                setFocusedCarId(car.id);
                if (unlocked) onSelectCar(car.id);
              }}
              className={`flex flex-col items-start justify-between rounded-xl border p-4 text-left transition-all ${
                active
                  ? 'border-amber-400 bg-slate-900/95 shadow-sm'
                  : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700'
              }`}
            >
              <div className="flex w-full items-center justify-between text-xs text-slate-400">
                <span>0{idx + 1}. {car.category}</span>
                {!unlocked ? (
                  <Lock className="h-3.5 w-3.5 text-slate-500" />
                ) : equipped ? (
                  <Check className="h-3.5 w-3.5 text-emerald-400" />
                ) : null}
              </div>
              <div className="mt-2 font-display text-base font-bold text-white truncate w-full">
                {car.name}
              </div>
              <div className="mt-1 font-mono text-xs text-slate-400">
                {unlocked
                  ? equipped
                    ? 'Equipped'
                    : 'Unlocked'
                  : `${car.unlockCost.toLocaleString()} Coins`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Main Split: Left Showroom Preview & Telemetry | Right Upgrade Tuning or Action */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        {/* Left Column: Live Canvas Turntable & 6 Stat Bars */}
        <div className="flex flex-col justify-between rounded-xl border border-slate-800/80 bg-slate-900/75 p-6 lg:col-span-5">
          <div>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-2xl font-bold text-white">{focusedCar.name}</h2>
              <span className="text-xs text-slate-400">{focusedCar.category}</span>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{focusedCar.tagline}</p>

            <div className="my-5 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
              <canvas
                ref={previewCanvasRef}
                width={420}
                height={210}
                className="h-[200px] w-full object-cover"
              />
            </div>

            {/* 6 Vehicle Statistics */}
            <div className="space-y-3">
              {statRows.map((s) => {
                const upgradeGain = s.value - s.base;
                return (
                  <div key={s.label}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-300">{s.label}</span>
                      <span className="font-mono font-bold text-white">
                        {s.value}
                        {upgradeGain > 0 && (
                          <span className="ml-1 text-emerald-400">(+{upgradeGain})</span>
                        )}
                        <span className="text-slate-500"> / 100</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all duration-200"
                        style={{ width: `${s.value}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Unlock / Equip / Race CTA */}
          <div className="mt-6 flex flex-wrap items-center gap-3 pt-4 border-t border-slate-800/80">
            {!isUnlocked ? (
              <button
                type="button"
                disabled={saveData.coins < focusedCar.unlockCost}
                onClick={() => onUnlockCar(focusedCar.id)}
                className={`w-full rounded-lg px-5 py-3 text-sm font-semibold transition-colors whitespace-nowrap ${
                  saveData.coins >= focusedCar.unlockCost
                    ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                    : 'cursor-not-allowed bg-slate-800 text-slate-500'
                }`}
              >
                {saveData.coins >= focusedCar.unlockCost
                  ? `Unlock Car (${focusedCar.unlockCost.toLocaleString()} Coins)`
                  : `Need ${(focusedCar.unlockCost - saveData.coins).toLocaleString()} More Coins`}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onSelectCar(focusedCar.id)}
                  className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                    isSelected
                      ? 'border border-emerald-500/40 bg-emerald-950/50 text-emerald-300'
                      : 'bg-slate-800 text-white hover:bg-slate-700'
                  }`}
                >
                  {isSelected ? 'Selected for Race' : 'Select Car'}
                </button>
                <button
                  type="button"
                  onClick={() => onStartQuickRaceWithCar(focusedCar.id)}
                  className="flex-1 rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-amber-300 whitespace-nowrap"
                >
                  Race Now
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right Column: 6-Part Mechanical Upgrade Workshop */}
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/75 p-6 lg:col-span-7">
          <div className="mb-5 flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="font-display text-xl font-bold text-white">
                Mechanical Tuning & Upgrades
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                Each upgrade directly improves on-track physics behavior up to Level {MAX_UPGRADE_LEVEL}.
              </p>
            </div>
            <Wrench className="h-5 w-5 text-amber-400" />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {UPGRADE_DEFINITIONS.map((def) => {
              const currentLevel = carUpgrades[def.key];
              const isMax = currentLevel >= MAX_UPGRADE_LEVEL;
              const cost = getUpgradeCost(focusedCar, def.key, currentLevel);
              const currentStat = effectiveStats[def.statKey];
              const nextStat = isMax ? currentStat : Math.min(100, currentStat + def.bonusPerLevel);
              const canAfford = isUnlocked && !isMax && saveData.coins >= cost;

              return (
                <div
                  key={def.key}
                  className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/70 p-4"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">{def.label}</span>
                      <span className="font-mono text-xs text-amber-400">
                        Lv. {currentLevel} / {MAX_UPGRADE_LEVEL}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{def.description}</p>

                    {/* Level indicator bars */}
                    <div className="mt-3 flex gap-1.5">
                      {Array.from({ length: MAX_UPGRADE_LEVEL }).map((_, i) => (
                        <div
                          key={i}
                          className={`h-1.5 flex-1 rounded-sm ${
                            i < currentLevel ? 'bg-amber-400' : 'bg-slate-800'
                          }`}
                        />
                      ))}
                    </div>

                    {/* Stat comparison */}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-300">
                      <span>
                        Current Stat: <strong className="font-mono text-white">{currentStat}</strong>
                      </span>
                      <span>
                        Next Stat:{' '}
                        <strong className="font-mono text-emerald-400">
                          {isMax ? 'MAX' : nextStat}
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between">
                    <span className="font-mono text-xs text-slate-400">
                      {isMax ? 'Max Level Reached' : `Cost: ${cost.toLocaleString()} Coins`}
                    </span>
                    <button
                      type="button"
                      disabled={!canAfford}
                      onClick={() => onUpgradeCar(focusedCar.id, def.key)}
                      className={`rounded-md px-3.5 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                        isMax
                          ? 'bg-slate-800 text-slate-500 cursor-default'
                          : canAfford
                            ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {!isUnlocked ? 'Locked' : isMax ? 'Maxed' : 'Upgrade'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
