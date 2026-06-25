export function loadAudio(resource: string): HTMLAudioElement {
  const audio = new Audio(resource);
  audio.preload = "auto";

  return audio;
}

export const soundPickup = loadAudio("/sounds/pickup.wav");
