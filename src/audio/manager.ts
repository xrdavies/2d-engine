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

export interface PcmStreamOptions {
  bus?: string;
  bufferSize?: number;
  capacity?: number;
}

export interface PcmStream {
  readonly queuedSamples: number;
  push(left: number, right?: number): void;
  stop(): void;
}

class AudioPcmStream implements PcmStream {
  private readonly processor: ScriptProcessorNode;
  private readonly left: Float32Array;
  private readonly right: Float32Array;
  private readIndex = 0;
  private writeIndex = 0;
  private count = 0;
  private stopped = false;

  constructor(
    context: AudioContext,
    destination: AudioNode,
    options: PcmStreamOptions,
  ) {
    const capacity = Math.max(1_024, options.capacity ?? 65_536);
    this.left = new Float32Array(capacity);
    this.right = new Float32Array(capacity);
    this.processor = context.createScriptProcessor(
      options.bufferSize ?? 2_048,
      0,
      2,
    );
    this.processor.onaudioprocess = (event) => {
      const left = event.outputBuffer.getChannelData(0);
      const right = event.outputBuffer.getChannelData(1);
      for (let index = 0; index < left.length; index += 1) {
        left[index] = this.count > 0 ? (this.left[this.readIndex] ?? 0) : 0;
        right[index] = this.count > 0 ? (this.right[this.readIndex] ?? 0) : 0;
        if (this.count > 0) {
          this.readIndex = (this.readIndex + 1) % this.left.length;
          this.count -= 1;
        }
      }
    };
    this.processor.connect(destination);
  }

  get queuedSamples(): number {
    return this.count;
  }

  push(left: number, right = left): void {
    if (this.stopped || this.count >= this.left.length - 1) return;
    this.left[this.writeIndex] = Math.max(-1, Math.min(1, left));
    this.right[this.writeIndex] = Math.max(-1, Math.min(1, right));
    this.writeIndex = (this.writeIndex + 1) % this.left.length;
    this.count += 1;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.processor.disconnect();
    this.processor.onaudioprocess = null;
    this.count = 0;
  }
}

export class AudioManager {
  readonly context: AudioContext;
  private readonly buses = new Map<string, AudioBus>();
  private readonly busStates = new Map<
    string,
    { volume: number; muted: boolean }
  >();
  private readonly sources = new Set<AudioBufferSourceNode>();
  private readonly streams = new Set<AudioPcmStream>();

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
    const state = { volume: gain.gain.value, muted: false };
    if (name !== "master")
      gain.connect(this.buses.get(parent)?.gain ?? this.context.destination);
    else gain.connect(this.context.destination);
    const bus: AudioBus = {
      gain,
      get volume() {
        return state.volume;
      },
      set volume(value: number) {
        state.volume = Math.max(0, value);
        if (!state.muted) gain.gain.value = state.volume;
      },
      get mute() {
        return state.muted;
      },
      set mute(value: boolean) {
        state.muted = value;
        gain.gain.value = value ? 0 : state.volume;
      },
    };
    this.buses.set(name, bus);
    this.busStates.set(name, state);
    return bus;
  }

  getBus(name: string): AudioBus | undefined {
    return this.buses.get(name);
  }

  createPcmStream(options: PcmStreamOptions = {}): PcmStream {
    const destination =
      this.buses.get(options.bus ?? "sfx")?.gain ?? this.context.destination;
    const stream = new AudioPcmStream(this.context, destination, options);
    this.streams.add(stream);
    return {
      get queuedSamples() {
        return stream.queuedSamples;
      },
      push: (left, right) => stream.push(left, right),
      stop: () => {
        stream.stop();
        this.streams.delete(stream);
      },
    };
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
    const state = this.busStates.get(name);
    if (!bus || !state) throw new Error(`Unknown audio bus: ${name}`);
    state.volume = Math.max(0, volume);
    if (state.muted) return;
    const now = this.context.currentTime;
    bus.gain.gain.cancelScheduledValues(now);
    bus.gain.gain.setValueAtTime(bus.gain.gain.value, now);
    bus.gain.gain.linearRampToValueAtTime(
      state.volume,
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
    for (const stream of this.streams) stream.stop();
    this.streams.clear();
    for (const bus of this.buses.values()) bus.gain.disconnect();
    this.buses.clear();
    this.busStates.clear();
    void this.context.close();
  }
}
