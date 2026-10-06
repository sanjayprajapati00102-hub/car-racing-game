import { CarSpec, CarStats, CarUpgrades, UpgradeType } from '../types';

export const MAX_UPGRADE_LEVEL = 5;

export const UPGRADE_DEFINITIONS: {
  key: UpgradeType;
  label: string;
  statKey: keyof CarStats;
  description: string;
  baseCost: number;
  bonusPerLevel: number;
}[] = [
  {
    key: 'engine',
    label: 'Engine Block',
    statKey: 'topSpeed',
    description: 'Increases maximum top-end velocity on straightaways.',
    baseCost: 180,
    bonusPerLevel: 4,
  },
  {
    key: 'acceleration',
    label: 'Twin Turbo',
    statKey: 'acceleration',
    description: 'Boosts launch torque and low-gear acceleration response.',
    baseCost: 160,
    bonusPerLevel: 4,
  },
  {
    key: 'handling',
    label: 'Active Suspension',
    statKey: 'handling',
    description: 'Sharpens steering turn-in rate and cornering agility.',
    baseCost: 150,
    bonusPerLevel: 4,
  },
  {
    key: 'brakes',
    label: 'Carbon Ceramic Brakes',
    statKey: 'braking',
    description: 'Shortens braking distance before tight hairpins.',
    baseCost: 140,
    bonusPerLevel: 4,
  },
  {
    key: 'tires',
    label: 'Slick Compound Tires',
    statKey: 'grip',
    description: 'Improves lateral traction across asphalt, rain, and snow.',
    baseCost: 170,
    bonusPerLevel: 4,
  },
  {
    key: 'nitro',
    label: 'N2O Injection System',
    statKey: 'nitro',
    description: 'Extends nitro duration, thrust force, and recharge speed.',
    baseCost: 200,
    bonusPerLevel: 4,
  },
];

export const CARS: CarSpec[] = [
  {
    id: 'starter_car',
    name: 'Apex Hatch GT',
    category: 'Starter Car',
    tagline: 'Balanced hot-hatch tuned for predictable cornering and forgiving drift control.',
    unlockCost: 0,
    primaryColor: '#3b82f6',
    secondaryColor: '#1d4ed8',
    accentColor: '#93c5fd',
    bodyStyle: 'starter',
    width: 24,
    length: 44,
    baseStats: {
      topSpeed: 54,
      acceleration: 58,
      handling: 68,
      braking: 64,
      nitro: 55,
      grip: 66,
    },
  },
  {
    id: 'sport_car',
    name: 'Veloce Coupe RS',
    category: 'Sport Car',
    tagline: 'Lightweight rear-wheel-drive coupe built for precision apex hunting and nimble slides.',
    unlockCost: 650,
    primaryColor: '#10b981',
    secondaryColor: '#047857',
    accentColor: '#6ee7b7',
    bodyStyle: 'sport',
    width: 25,
    length: 46,
    baseStats: {
      topSpeed: 68,
      acceleration: 70,
      handling: 74,
      braking: 70,
      nitro: 66,
      grip: 72,
    },
  },
  {
    id: 'muscle_car',
    name: 'Titan V8 Mach',
    category: 'Muscle Car',
    tagline: 'Supercharged American muscle with ferocious straight-line pull and smoky power slides.',
    unlockCost: 1400,
    primaryColor: '#f97316',
    secondaryColor: '#c2410c',
    accentColor: '#fed7aa',
    bodyStyle: 'muscle',
    width: 26,
    length: 48,
    baseStats: {
      topSpeed: 78,
      acceleration: 80,
      handling: 60,
      braking: 62,
      nitro: 78,
      grip: 60,
    },
  },
  {
    id: 'super_car',
    name: 'Zenith Hyperion',
    category: 'Super Car',
    tagline: 'Mid-engine carbon exotic combining blistering velocity with active aerodynamic downforce.',
    unlockCost: 2600,
    primaryColor: '#ef4444',
    secondaryColor: '#b91c1c',
    accentColor: '#fca5a5',
    bodyStyle: 'super',
    width: 26,
    length: 48,
    baseStats: {
      topSpeed: 88,
      acceleration: 86,
      handling: 82,
      braking: 84,
      nitro: 84,
      grip: 82,
    },
  },
  {
    id: 'formula_car',
    name: 'F-Zero Apex',
    category: 'Formula Car',
    tagline: 'Open-wheel championship single-seater delivering maximum downforce and instant response.',
    unlockCost: 4500,
    primaryColor: '#eab308',
    secondaryColor: '#a16207',
    accentColor: '#fef08a',
    bodyStyle: 'formula',
    width: 25,
    length: 50,
    baseStats: {
      topSpeed: 94,
      acceleration: 92,
      handling: 94,
      braking: 92,
      nitro: 88,
      grip: 92,
    },
  },
];

export function getDefaultUpgrades(): CarUpgrades {
  return {
    engine: 1,
    acceleration: 1,
    handling: 1,
    brakes: 1,
    tires: 1,
    nitro: 1,
  };
}

export function getUpgradeCost(car: CarSpec, upgradeType: UpgradeType, currentLevel: number): number {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return 0;
  const def = UPGRADE_DEFINITIONS.find((u) => u.key === upgradeType)!;
  const carTierMultiplier = 1 + CARS.findIndex((c) => c.id === car.id) * 0.28;
  return Math.round(def.baseCost * currentLevel * carTierMultiplier);
}

export function computeEffectiveCarStats(car: CarSpec, upgrades?: CarUpgrades): CarStats {
  const u = upgrades || getDefaultUpgrades();
  return {
    topSpeed: Math.min(100, car.baseStats.topSpeed + (u.engine - 1) * 4),
    acceleration: Math.min(100, car.baseStats.acceleration + (u.acceleration - 1) * 4),
    handling: Math.min(100, car.baseStats.handling + (u.handling - 1) * 4),
    braking: Math.min(100, car.baseStats.braking + (u.brakes - 1) * 4),
    grip: Math.min(100, car.baseStats.grip + (u.tires - 1) * 4),
    nitro: Math.min(100, car.baseStats.nitro + (u.nitro - 1) * 4),
  };
}

export function getCarById(id: string): CarSpec {
  return CARS.find((c) => c.id === id) || CARS[0];
}
