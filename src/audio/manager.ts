export interface AudioBus {
  readonly gain: GainNode;
  volume: number;
  mute: boolean;
}

export interface PlayAudioOptions {
  bus?: string;
  loop?: boolean;
  volume?: number;
  playbackRate?: number;
  pan?: number;
}

export class AudioManager {
  readonly context: AudioContext;
  private readonly buses = new Map<string, AudioBus>();
  private readonly sources = new Set<AudioBufferSourceNode>();

  constructor(context?: AudioContext) {
    this.context = context ?? new AudioContext();
    this.createBus("master");
    this.createBus("music", "master");
    this.createBus("sfx", "master");
  }

  get activeSourceCount(): number {
    return this.sources.size;
  }

  createBus(name: string, parent = "master"): AudioBus {
    const existing = this.buses.get(name);
    if (existing) return existing;
    const gain = this.context.createGain();
    if (name !== "master")
      gain.connect(this.buses.get(parent)?.gain ?? this.context.destination);
    else gain.connect(this.context.destination);
    const bus: AudioBus = {
      gain,
      get volume() {
        return gain.gain.value;
      },
      set volume(value: number) {
        gain.gain.value = Math.max(0, value);
      },
      get mute() {
        return gain.gain.value === 0;
      },
      set mute(value: boolean) {
        gain.gain.value = value ? 0 : 1;
      },
    };
    this.buses.set(name, bus);
    return bus;
  }

  getBus(name: string): AudioBus | undefined {
    return this.buses.get(name);
  }

  async unlock(): Promise<void> {
    await this.resume();
  }

  async pause(): Promise<void> {
    if (this.context.state === "running") await this.context.suspend();
  }

  async resume(): Promise<void> {
    if (this.context.state === "suspended") await this.context.resume();
  }

  fadeBus(name: string, volume: number, duration: number): void {
    const bus = this.buses.get(name);
    if (!bus) throw new Error(`Unknown audio bus: ${name}`);
    const now = this.context.currentTime;
    bus.gain.gain.cancelScheduledValues(now);
    bus.gain.gain.setValueAtTime(bus.gain.gain.value, now);
    bus.gain.gain.linearRampToValueAtTime(
      Math.max(0, volume),
      now + Math.max(0, duration),
    );
  }

  play(
    buffer: AudioBuffer,
    options: PlayAudioOptions = {},
  ): AudioBufferSourceNode {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = options.loop ?? false;
    source.playbackRate.value = options.playbackRate ?? 1;
    const gain = this.context.createGain();
    gain.gain.value = options.volume ?? 1;
    source.connect(gain);
    const destination =
      this.buses.get(options.bus ?? "sfx")?.gain ?? this.context.destination;
    if (options.pan !== undefined && "createStereoPanner" in this.context) {
      const panner = this.context.createStereoPanner();
      panner.pan.value = Math.max(-1, Math.min(1, options.pan));
      gain.connect(panner);
      panner.connect(destination);
    } else {
      gain.connect(destination);
    }
    source.addEventListener("ended", () => {
      this.sources.delete(source);
      source.disconnect();
      gain.disconnect();
    });
    this.sources.add(source);
    source.start();
    return source;
  }

  stopAll(): void {
    for (const source of [...this.sources]) source.stop();
    this.sources.clear();
  }

  dispose(): void {
    this.stopAll();
    for (const bus of this.buses.values()) bus.gain.disconnect();
    this.buses.clear();
    void this.context.close();
  }
}
