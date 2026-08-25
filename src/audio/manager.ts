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
}

export class AudioManager {
  readonly context: AudioContext;
  private readonly buses = new Map<string, AudioBus>();

  constructor(context?: AudioContext) {
    this.context = context ?? new AudioContext();
    this.createBus("master");
    this.createBus("music", "master");
    this.createBus("sfx", "master");
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
    if (this.context.state === "suspended") await this.context.resume();
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
    gain.connect(
      this.buses.get(options.bus ?? "sfx")?.gain ?? this.context.destination,
    );
    source.start();
    return source;
  }

  stopAll(): void {
    // Sources are intentionally owned by callers; stopping is explicit per source.
  }

  dispose(): void {
    for (const bus of this.buses.values()) bus.gain.disconnect();
    this.buses.clear();
    void this.context.close();
  }
}
