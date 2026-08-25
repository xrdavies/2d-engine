import { AudioManager } from "../../src/index.ts";

const button = document.querySelector<HTMLButtonElement>("#unlock");
const status = document.querySelector<HTMLElement>("#status");
if (!button || !status) throw new Error("Audio example markup is incomplete");
const audio = new AudioManager();
button.addEventListener("click", async () => {
  await audio.unlock();
  status.textContent = `Audio context: ${audio.context.state}`;
});
