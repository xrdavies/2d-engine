import { AudioManager } from "../../src/index.ts";

const button = document.querySelector<HTMLButtonElement>("#unlock");
const status = document.querySelector<HTMLElement>("#status");
if (!button || !status) throw new Error("Audio example markup is incomplete");
const audio = new AudioManager();
button.addEventListener("click", async () => {
  await audio.unlock();
  const sampleRate = audio.context.sampleRate;
  const buffer = audio.context.createBuffer(1, sampleRate / 10, sampleRate);
  const samples = buffer.getChannelData(0);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = Math.sin((index / sampleRate) * Math.PI * 2 * 440) * 0.1;
  }
  audio.play(buffer);
  status.textContent = `Audio context: ${audio.context.state}; sound playing`;
});
