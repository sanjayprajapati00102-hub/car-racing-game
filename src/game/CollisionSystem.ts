import { AudioManager } from './AudioManager';
import { Camera } from './Camera';
import { Car } from './Car';
import { ParticleSystem } from './ParticleSystem';
import { Player } from './Player';
import { Track } from './Track';

export class CollisionSystem {
  private lastCollisionSoundTime = 0;

  public handleAllCollisions(
    cars: Car[],
    player: Player,
    track: Track,
    particles: ParticleSystem,
    camera: Camera,
    audio: AudioManager,
    onCoinCollected?: () => void
  ): void {
    const halfRoad = track.spec.roadWidth * 0.5;
    const barrierLimit = halfRoad + 16;

    // 1. Track Boundaries, Off-Road Detection, Coins & Obstacles
    for (const car of cars) {
      const nearest = track.getNearestPoint(car.x, car.y, car.nearestTrackPointIndex);
      car.nearestTrackPointIndex = nearest.index;

      // Off-road shoulder vs barrier wall
      if (nearest.distance > halfRoad - 8) {
        car.offRoadFactor = Math.min(1, (nearest.distance - (halfRoad - 8)) / 24);
      } else {
        car.offRoadFactor = 0;
      }

      // Hard outer barrier collision — do not allow driving through walls
      if (nearest.distance > barrierLimit) {
        const sign = nearest.signedLateral >= 0 ? 1 : -1;
        // Clamp car inside barrier
        car.x = nearest.point.x + nearest.point.nx * sign * barrierLimit;
        car.y = nearest.point.y + nearest.point.ny * sign * barrierLimit;

        // Reflect velocity away from barrier normal and apply friction penalty
        const vn = car.vx * (nearest.point.nx * sign) + car.vy * (nearest.point.ny * sign);
        if (vn > 0) {
          car.vx -= 1.35 * vn * (nearest.point.nx * sign);
          car.vy -= 1.35 * vn * (nearest.point.ny * sign);
        }
        car.forwardSpeed *= 0.78;
        car.cleanLap = false;

        if (Math.abs(car.forwardSpeed) > 120) {
          particles.emitCollisionSparks(car.x, car.y, 10);
          if (car.isPlayer) {
            camera.addShake(8);
            this.playCollisionThrottled(audio);
          }
        }
      }

      // Surface Hazards / Obstacles
      for (const obs of track.obstacles) {
        const dist = Math.hypot(car.x - obs.x, car.y - obs.y);
        if (dist < obs.radius + car.spec.width * 0.45) {
          car.hazardSlipTimer = 0.55;
          car.forwardSpeed *= 0.97;
        }
      }

      // Collectible Coins (Player only)
      if (car.isPlayer) {
        for (const coin of track.coins) {
          if (coin.collected) continue;
          const dist = Math.hypot(car.x - coin.x, car.y - coin.y);
          if (dist < 26) {
            coin.collected = true;
            coin.respawnTimer = 12; // Respawn on subsequent laps
            player.coinsCollectedInRace += 1;
            audio.playSfx('coin');
            onCoinCollected?.();
          }
        }
      }
    }

    // 2. Car-to-Car Collisions
    const minCarDist = 34;
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy);

        if (dist > 0 && dist < minCarDist) {
          const overlap = (minCarDist - dist) * 0.55;
          const nx = dx / dist;
          const ny = dy / dist;

          // Separate cars
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;

          // Relative velocity along collision normal
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const velAlongNormal = rvx * nx + rvy * ny;

          if (velAlongNormal < 0) {
            const impulse = -0.85 * velAlongNormal;
            a.vx -= nx * impulse * 0.5;
            a.vy -= ny * impulse * 0.5;
            b.vx += nx * impulse * 0.5;
            b.vy += ny * impulse * 0.5;

            a.forwardSpeed *= 0.9;
            b.forwardSpeed *= 0.9;
            a.cleanLap = false;
            b.cleanLap = false;

            const midX = (a.x + b.x) * 0.5;
            const midY = (a.y + b.y) * 0.5;
            particles.emitCollisionSparks(midX, midY, 12);

            if (a.isPlayer || b.isPlayer) {
              camera.addShake(9);
              this.playCollisionThrottled(audio);
            }
          }
        }
      }
    }
  }

  private playCollisionThrottled(audio: AudioManager): void {
    const now = performance.now();
    if (now - this.lastCollisionSoundTime > 180) {
      this.lastCollisionSoundTime = now;
      audio.playSfx('collision');
    }
  }
}
