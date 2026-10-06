export interface ControlInputState {
  accelerate: boolean;
  brake: boolean;
  left: boolean;
  right: boolean;
  nitro: boolean;
  analogSteer: number; // -1 to 1 when using mouse or touch
}

export class InputManager {
  private keys: Set<string> = new Set();
  private touchState = {
    accelerate: false,
    brake: false,
    left: false,
    right: false,
    nitro: false,
  };
  private mouseSteerActive = false;
  private mouseSteerValue = 0;
  private mouseAccelerate = false;
  private onPauseCallback?: () => void;

  private handleKeyDown = (e: KeyboardEvent) => {
    // Ignore shortcuts when typing into an input field
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }
    const code = e.code;
    if (
      code === 'ArrowUp' ||
      code === 'ArrowDown' ||
      code === 'ArrowLeft' ||
      code === 'ArrowRight' ||
      code === 'Space'
    ) {
      e.preventDefault();
    }
    if ((code === 'KeyP' || code === 'Escape') && !e.repeat) {
      this.onPauseCallback?.();
    }
    this.keys.add(code);
  };

  private handleKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.mouseSteerActive) return;
    const centerX = window.innerWidth / 2;
    const delta = (e.clientX - centerX) / (window.innerWidth * 0.28);
    this.mouseSteerValue = Math.max(-1, Math.min(1, delta));
  };

  private handleMouseDown = (e: MouseEvent) => {
    if (!this.mouseSteerActive) return;
    if (e.button === 0) {
      this.mouseAccelerate = true;
    }
  };

  private handleMouseUp = () => {
    this.mouseAccelerate = false;
  };

  private handleBlur = () => {
    this.keys.clear();
    this.resetTouch();
    this.mouseAccelerate = false;
  };

  public attach(onPause?: () => void): void {
    this.onPauseCallback = onPause;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('mousedown', this.handleMouseDown);
    window.addEventListener('mouseup', this.handleMouseUp);
    window.addEventListener('blur', this.handleBlur);
  }

  public detach(): void {
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('mousedown', this.handleMouseDown);
    window.removeEventListener('mouseup', this.handleMouseUp);
    window.removeEventListener('blur', this.handleBlur);
  }

  public setMouseSteeringEnabled(enabled: boolean): void {
    this.mouseSteerActive = enabled;
    if (!enabled) {
      this.mouseSteerValue = 0;
      this.mouseAccelerate = false;
    }
  }

  public setTouchControl(control: keyof typeof this.touchState, active: boolean): void {
    this.touchState[control] = active;
  }

  public resetTouch(): void {
    this.touchState.accelerate = false;
    this.touchState.brake = false;
    this.touchState.left = false;
    this.touchState.right = false;
    this.touchState.nitro = false;
  }

  public getState(): ControlInputState {
    const accelerate =
      this.keys.has('KeyW') ||
      this.keys.has('ArrowUp') ||
      this.touchState.accelerate ||
      this.mouseAccelerate;

    const brake =
      this.keys.has('KeyS') ||
      this.keys.has('ArrowDown') ||
      this.touchState.brake;

    const left =
      this.keys.has('KeyA') ||
      this.keys.has('ArrowLeft') ||
      this.touchState.left;

    const right =
      this.keys.has('KeyD') ||
      this.keys.has('ArrowRight') ||
      this.touchState.right;

    const nitro =
      this.keys.has('Space') ||
      this.keys.has('ShiftLeft') ||
      this.keys.has('ShiftRight') ||
      this.touchState.nitro;

    let analogSteer = 0;
    if (left && !right) analogSteer = -1;
    else if (right && !left) analogSteer = 1;
    else if (this.mouseSteerActive && Math.abs(this.mouseSteerValue) > 0.08) {
      analogSteer = this.mouseSteerValue;
    }

    return {
      accelerate,
      brake,
      left: analogSteer < -0.05,
      right: analogSteer > 0.05,
      nitro,
      analogSteer,
    };
  }
}
