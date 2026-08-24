export interface ClockStep {
  delta: number;
  steps: number;
  alpha: number;
}

export interface ClockOptions {
  fixedDelta?: number;
  maxDelta?: number;
  maxSteps?: number;
}

export class FixedClock {
  readonly fixedDelta: number;
  readonly maxDelta: number;
  readonly maxSteps: number;

  private accumulator = 0;

  constructor(options: ClockOptions = {}) {
    this.fixedDelta = options.fixedDelta ?? 1 / 60;
    this.maxDelta = options.maxDelta ?? 0.25;
    this.maxSteps = options.maxSteps ?? 5;
  }

  reset(): void {
    this.accumulator = 0;
  }

  advance(elapsed: number): ClockStep {
    const delta = Math.min(Math.max(0, elapsed), this.maxDelta);
    this.accumulator += delta;

    let steps = 0;
    while (this.accumulator >= this.fixedDelta && steps < this.maxSteps) {
      this.accumulator -= this.fixedDelta;
      steps += 1;
    }

    if (steps === this.maxSteps && this.accumulator >= this.fixedDelta) {
      this.accumulator = 0;
    }

    return {
      delta,
      steps,
      alpha: this.accumulator / this.fixedDelta,
    };
  }
}
