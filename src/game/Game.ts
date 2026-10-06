import { AudioManager } from './AudioManager';
import { Camera } from './Camera';
import { CollisionSystem } from './CollisionSystem';
import { TRACKS } from './data/tracks';
import { InputManager } from './InputManager';
import { ParticleSystem } from './ParticleSystem';
import { RaceManager } from './RaceManager';
import { SaveManager } from './SaveManager';
import { Track } from './Track';
import {
  AIDifficulty,
  GameState,
  HudSnapshot,
  RaceConfig,
  RaceResultsData,
  TimeOfDay,
  WeatherType,
} from './types';

export class Game {
  public state: GameState = GameState.MAIN_MENU;
  public audio: AudioManager;
  public input: InputManager;
  public particles: ParticleSystem;
  public camera: Camera;
  public collisions: CollisionSystem;
  public raceManager: RaceManager | null = null;

  private canvas: HTMLCanvasElement | null = null;
  private minimapCanvas: HTMLCanvasElement | null = null;
  private rafId: number | null = null;
  private lastTimestamp = 0;

  // Demo background track for Main Menu attract mode
  private demoTrack: Track;
  private demoCameraAngle = 0;

  private onHudUpdate: (hud: HudSnapshot) => void;
  private onStateChange: (newState: GameState, results?: RaceResultsData) => void;

  constructor(callbacks: {
    onHudUpdate: (hud: HudSnapshot) => void;
    onStateChange: (newState: GameState, results?: RaceResultsData) => void;
  }) {
    this.onHudUpdate = callbacks.onHudUpdate;
    this.onStateChange = callbacks.onStateChange;

    const save = SaveManager.load();
    this.audio = new AudioManager(save.settings);
    this.input = new InputManager();
    this.particles = new ParticleSystem();
    this.camera = new Camera();
    this.collisions = new CollisionSystem();
    this.demoTrack = new Track(TRACKS[0]);

    this.applySettings();
  }

  public applySettings(): void {
    const settings = SaveManager.getData().settings;
    this.audio.updateSettings(settings);
    this.particles.setEnabled(settings.particles, settings.graphicsQuality);
    this.camera.setScreenShakeEnabled(settings.screenShake);
    this.input.setMouseSteeringEnabled(settings.controlScheme === 'Keyboard + Mouse');
  }

  public mountCanvases(
    mainCanvas: HTMLCanvasElement,
    minimapCanvas?: HTMLCanvasElement | null
  ): void {
    this.canvas = mainCanvas;
    this.minimapCanvas = minimapCanvas || null;
    this.input.attach(() => this.togglePause());

    if (!this.rafId) {
      this.lastTimestamp = performance.now();
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  public setMinimapCanvas(minimapCanvas: HTMLCanvasElement | null): void {
    this.minimapCanvas = minimapCanvas;
  }

  public unmount(): void {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.input.detach();
    this.audio.stopEngine();
  }

  public setState(newState: GameState, results?: RaceResultsData): void {
    this.state = newState;
    if (
      newState !== GameState.RACING &&
      newState !== GameState.COUNTDOWN &&
      newState !== GameState.FINISHED
    ) {
      this.audio.stopEngine();
    }
    this.onStateChange(newState, results);
  }

  public startRace(config?: Partial<RaceConfig>): void {
    const save = SaveManager.getData();
    const fullConfig: RaceConfig = {
      mode: config?.mode || 'quick',
      careerEventId: config?.careerEventId,
      carId: config?.carId || save.selectedCarId,
      trackId: config?.trackId || save.selectedTrackId,
      laps: config?.laps || 3,
      aiCount: config?.aiCount || 5,
      aiDifficulty: config?.aiDifficulty || AIDifficulty.MEDIUM,
      weather: config?.weather || WeatherType.CLEAR,
      timeOfDay: config?.timeOfDay || TimeOfDay.DAY,
    };

    this.applySettings();
    this.particles.clear();
    this.raceManager = new RaceManager(fullConfig);
    this.camera.snapTo(this.raceManager.player);
    this.setState(GameState.COUNTDOWN);
    this.onHudUpdate(this.raceManager.buildHudSnapshot(GameState.COUNTDOWN));
  }

  public restartRace(): void {
    if (this.raceManager) {
      this.startRace(this.raceManager.config);
    }
  }

  public togglePause(): void {
    if (this.state === GameState.RACING) {
      this.audio.playSfx('menu_click');
      this.setState(GameState.PAUSED);
    } else if (this.state === GameState.PAUSED) {
      this.audio.playSfx('menu_click');
      this.setState(GameState.RACING);
    }
  }

  private loop = (timestamp: number): void => {
    const dt = Math.min(0.05, Math.max(0.001, (timestamp - this.lastTimestamp) / 1000));
    this.lastTimestamp = timestamp;

    this.update(dt);
    this.render();

    this.rafId = requestAnimationFrame(this.loop);
  };

  private update(dt: number): void {
    if (
      this.state !== GameState.COUNTDOWN &&
      this.state !== GameState.RACING &&
      this.state !== GameState.PAUSED &&
      this.state !== GameState.FINISHED
    ) {
      // Animate background menu camera along demo track
      this.demoCameraAngle += dt * 0.18;
      return;
    }

    if (this.state === GameState.PAUSED || !this.raceManager) {
      return;
    }

    const rm = this.raceManager;
    const width = this.canvas?.width || window.innerWidth;
    const height = this.canvas?.height || window.innerHeight;

    if (this.state === GameState.COUNTDOWN) {
      rm.countdownTimer -= dt;
      const ceilVal = Math.ceil(rm.countdownTimer - 0.6);
      if (ceilVal >= 1 && ceilVal <= 3 && ceilVal < rm.lastCountdownBeep) {
        rm.lastCountdownBeep = ceilVal;
        this.audio.playSfx('countdown_beep');
      } else if (ceilVal === 0 && rm.lastCountdownBeep > 0) {
        rm.lastCountdownBeep = 0;
        this.audio.playSfx('countdown_go');
      }

      if (rm.countdownTimer <= 0) {
        this.setState(GameState.RACING);
      }
      this.camera.update(dt, rm.player);
      this.onHudUpdate(rm.buildHudSnapshot(this.state));
      return;
    }

    // Active Racing or Finished Cooldown
    rm.raceTimeMs += dt * 1000;
    rm.track.updateCoins(dt);

    // Update Player
    const playerInput =
      this.state === GameState.RACING
        ? this.input.getState()
        : rm.aiCars[0]?.computeAIControls(dt, rm.track, rm.allCars) || this.input.getState();

    rm.player.updatePhysics(dt, playerInput, this.particles, true);

    // Update AI Cars
    for (const ai of rm.aiCars) {
      const aiInput = ai.computeAIControls(dt, rm.track, rm.allCars);
      ai.updatePhysics(dt, aiInput, this.particles, true);
    }

    // Collisions
    this.collisions.handleAllCollisions(
      rm.allCars,
      rm.player,
      rm.track,
      this.particles,
      this.camera,
      this.audio,
      () => rm.showNotification('+25 COIN BONUS', 1.1)
    );

    // Progress, Laps, Checkpoints & Standings
    rm.updateProgressAndStandings(dt, this.audio, () => {
      if (this.state === GameState.RACING) {
        this.state = GameState.FINISHED;
        rm.finishGraceTimer = 1.6;
        if (rm.player.position <= 3) {
          this.audio.playSfx('victory');
        } else {
          this.audio.playSfx('defeat');
        }
        rm.showNotification(`FINISHED P${rm.player.position}!`, 2.0);
      }
    });

    // Engine Sound Telemetry
    const speedRatio = Math.min(1, Math.hypot(rm.player.vx, rm.player.vy) / rm.player.physicsParams.maxSpeed);
    this.audio.updateEngineTelemetry({
      speedRatio,
      accelerating: rm.player.isAccelerating,
      braking: rm.player.isBraking,
      drifting: rm.player.isDrifting,
      nitroActive: rm.player.nitroActive,
    });

    this.particles.update(dt, rm.config.weather, width, height);
    this.camera.update(dt, rm.player);

    if (this.state === GameState.FINISHED) {
      rm.finishGraceTimer -= dt;
      if (rm.finishGraceTimer <= 0) {
        const results = rm.finalizeResults();
        this.setState(GameState.RESULTS, results);
        return;
      }
    }

    this.onHudUpdate(rm.buildHudSnapshot(this.state));
  }

  private render(): void {
    const canvas = this.canvas;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (canvas.width !== window.innerWidth || canvas.height !== window.innerHeight) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    }

    const w = canvas.width;
    const h = canvas.height;

    // Attract-mode background rendering when in menus
    if (
      this.state !== GameState.COUNTDOWN &&
      this.state !== GameState.RACING &&
      this.state !== GameState.PAUSED &&
      this.state !== GameState.FINISHED
    ) {
      this.renderMenuBackground(ctx, w, h);
      return;
    }

    const rm = this.raceManager;
    if (!rm) return;

    // 1. Fill base terrain background
    ctx.fillStyle = rm.track.spec.terrainColor;
    ctx.fillRect(0, 0, w, h);

    // 2. World-space camera transform
    ctx.save();
    this.camera.applyTransform(ctx, w, h);

    // Subtle terrain grid lines for sense of speed
    this.renderTerrainGrid(ctx, rm.track.spec.terrainAccent);

    // Render Track, Curbs, Coins, Obstacles & Props
    rm.track.render(ctx, rm.config.timeOfDay);

    // Render Skid Marks on Road
    this.particles.renderSkidMarks(ctx);

    // Render World Particles (Smoke, Nitro Flames, Sparks)
    this.particles.renderWorldParticles(ctx);

    // Render AI & Player Cars
    for (const ai of rm.aiCars) {
      ai.render(ctx, rm.config.timeOfDay);
    }
    rm.player.render(ctx, rm.config.timeOfDay);

    ctx.restore();

    // 3. Time-of-Day Ambient Lighting Tint
    if (rm.config.timeOfDay === TimeOfDay.SUNSET) {
      ctx.fillStyle = 'rgba(249, 115, 22, 0.12)';
      ctx.fillRect(0, 0, w, h);
    } else if (rm.config.timeOfDay === TimeOfDay.NIGHT) {
      ctx.fillStyle = 'rgba(2, 6, 23, 0.36)';
      ctx.fillRect(0, 0, w, h);
    }

    // 4. Weather & Speed Lines Overlay
    const speedRatio = Math.min(1, Math.hypot(rm.player.vx, rm.player.vy) / rm.player.physicsParams.maxSpeed);
    this.particles.renderWeatherAndSpeedOverlay(
      ctx,
      rm.config.weather,
      speedRatio,
      rm.player.nitroActive,
      w,
      h
    );

    // 5. Render Real-Time Minimap
    this.renderMinimap(rm);
  }

  private renderTerrainGrid(ctx: CanvasRenderingContext2D, color: string): void {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    const step = 220;
    const startX = Math.floor((this.camera.x - 1400) / step) * step;
    const endX = this.camera.x + 1400;
    const startY = Math.floor((this.camera.y - 1000) / step) * step;
    const endY = this.camera.y + 1000;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += step) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += step) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  private renderMenuBackground(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);

    const pts = this.demoTrack.points;
    if (pts.length > 0) {
      const idx = Math.floor((this.demoCameraAngle * 45) % pts.length);
      const pt = pts[idx];

      ctx.save();
      ctx.translate(w * 0.5, h * 0.5);
      ctx.scale(0.65, 0.65);
      ctx.translate(-pt.x, -pt.y);
      this.demoTrack.render(ctx, TimeOfDay.NIGHT);
      ctx.restore();
    }

    // Measured dark scrim over attract-mode canvas so UI has crisp contrast
    const grad = ctx.createRadialGradient(w * 0.5, h * 0.5, w * 0.1, w * 0.5, h * 0.5, w * 0.75);
    grad.addColorStop(0, 'rgba(2, 6, 23, 0.76)');
    grad.addColorStop(1, 'rgba(2, 6, 23, 0.94)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  private renderMinimap(rm: RaceManager): void {
    const mm = this.minimapCanvas;
    if (!mm) return;
    const ctx = mm.getContext('2d');
    if (!ctx) return;

    const mw = mm.width;
    const mh = mm.height;
    ctx.clearRect(0, 0, mw, mh);

    const b = rm.track.bounds;
    const trackW = b.maxX - b.minX;
    const trackH = b.maxY - b.minY;
    const pad = 16;
    const scale = Math.min((mw - pad * 2) / trackW, (mh - pad * 2) / trackH);

    const offsetX = (mw - trackW * scale) * 0.5 - b.minX * scale;
    const offsetY = (mh - trackH * scale) * 0.5 - b.minY * scale;

    ctx.save();

    // Track outline
    const pts = rm.track.points;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i].x * scale + offsetX;
      const py = pts[i].y * scale + offsetY;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Start/Finish marker
    const s0 = pts[0];
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(s0.x * scale + offsetX - 3, s0.y * scale + offsetY - 3, 6, 6);

    // AI Opponent dots with heading arrow
    for (const ai of rm.aiCars) {
      const ax = ai.x * scale + offsetX;
      const ay = ai.y * scale + offsetY;
      ctx.fillStyle = ai.spec.primaryColor;
      ctx.beginPath();
      ctx.arc(ax, ay, 3.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player position & direction indicator
    const px = rm.player.x * scale + offsetX;
    const py = rm.player.y * scale + offsetY;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rm.player.angle);
    ctx.fillStyle = '#38bdf8';
    ctx.strokeStyle = '#020617';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4.5);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();
  }
}
