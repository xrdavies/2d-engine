import { describe, expect, it, vi } from "vitest";
import { AudioManager } from "../../src/audio/index.ts";

class FakeParam {
  value = 1;
  cancelScheduledValues = vi.fn();
  setValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
  linearRampToValueAtTime = vi.fn((value: number) => {
    this.value = value;
  });
}

class FakeNode extends EventTarget {
  gain = new FakeParam();
  pan = new FakeParam();
  playbackRate = new FakeParam();
  buffer: AudioBuffer | null = null;
  loop = false;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn(() => this.dispatchEvent(new Event("ended")));
}

describe("AudioManager", () => {
  it("tracks, stops and fades audio", async () => {
    const context = {
      state: "running",
      currentTime: 1,
      destination: new FakeNode(),
      createGain: () => new FakeNode(),
      createBufferSource: () => new FakeNode(),
      createStereoPanner: () => new FakeNode(),
      createScriptProcessor: () =>
        new FakeNode() as unknown as ScriptProcessorNode,
      suspend: vi.fn(async function (this: { state: string }) {
        this.state = "suspended";
      }),
      resume: vi.fn(async function (this: { state: string }) {
        this.state = "running";
      }),
      close: vi.fn(async () => undefined),
    } as unknown as AudioContext;
    const audio = new AudioManager(context);
    audio.play({} as AudioBuffer, { pan: 0.5 });
    expect(audio.activeSourceCount).toBe(1);
    audio.fadeBus("music", 0.25, 0.5);
    expect(audio.getBus("music")?.volume).toBe(0.25);
    const music = audio.getBus("music");
    if (!music) throw new Error("Missing music bus");
    music.volume = 0.4;
    music.mute = true;
    expect(music.gain.gain.value).toBe(0);
    music.mute = false;
    expect(music.gain.gain.value).toBe(0.4);
    audio.stopAll();
    expect(audio.activeSourceCount).toBe(0);
    const stream = audio.createPcmStream({ bus: "music", capacity: 1_024 });
    stream.push(0.25, -0.25);
    expect(stream.queuedSamples).toBe(1);
    stream.stop();
    expect(stream.queuedSamples).toBe(0);
    await audio.pause();
    expect(context.state).toBe("suspended");
    await audio.resume();
    expect(context.state).toBe("running");
  });

  it("load() fetches a URL and decodes PCM through the audio context", async () => {
    const decoded = { length: 8 } as AudioBuffer;
    const decodeAudioData = vi.fn(async (data: ArrayBuffer) => {
      expect(data.byteLength).toBe(4);
      return decoded;
    });
    const context = {
      state: "running",
      currentTime: 0,
      destination: new FakeNode(),
      createGain: () => new FakeNode(),
      createBufferSource: () => new FakeNode(),
      createScriptProcessor: () =>
        new FakeNode() as unknown as ScriptProcessorNode,
      decodeAudioData,
    } as unknown as AudioContext;
    const audio = new AudioManager(context);
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      const buffer = await audio.load("/sounds/check.m4a");
      expect(buffer).toBe(decoded);
      expect(fetchMock).toHaveBeenCalledWith("/sounds/check.m4a", {
        signal: undefined,
      });
      expect(decodeAudioData).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
