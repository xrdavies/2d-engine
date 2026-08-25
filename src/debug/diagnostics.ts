export interface FrameStats {
  frame: number;
  delta: number;
  cpuMs: number;
  batches: number;
  draws: number;
  visibleItems: number;
}

export class Diagnostics {
  private frame = 0;
  private startedAt = 0;
  private current: FrameStats = {
    frame: 0,
    delta: 0,
    cpuMs: 0,
    batches: 0,
    draws: 0,
    visibleItems: 0,
  };

  beginFrame(timestamp = performance.now()): void {
    this.startedAt = timestamp;
    this.current = {
      ...this.current,
      frame: ++this.frame,
      batches: 0,
      draws: 0,
      visibleItems: 0,
    };
  }

  endFrame(timestamp = performance.now(), delta = 0): FrameStats {
    this.current = {
      ...this.current,
      delta,
      cpuMs: Math.max(0, timestamp - this.startedAt),
    };
    return this.current;
  }

  recordRender(
    stats: Pick<FrameStats, "batches" | "draws" | "visibleItems">,
  ): void {
    this.current.batches += stats.batches;
    this.current.draws += stats.draws;
    this.current.visibleItems += stats.visibleItems;
  }

  snapshot(): FrameStats {
    return { ...this.current };
  }
}
