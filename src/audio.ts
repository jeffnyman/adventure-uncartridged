export function loadAudio(resource: string): HTMLAudioElement {
  const audio = new Audio(resource);
  audio.preload = "auto";

  return audio;
}

export const soundWon = loadAudio("/sounds/won.wav");
export const soundRoar = loadAudio("/sounds/roar.wav");
export const soundEaten = loadAudio("/sounds/eaten.wav");
export const soundDragonDie = loadAudio("/sounds/dragondie.wav");
export const soundPutDown = loadAudio("/sounds/putdown.wav");
export const soundPickUp = loadAudio("/sounds/pickup.wav");
