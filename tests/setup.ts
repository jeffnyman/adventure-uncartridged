// audio.ts initializes HTMLAudioElement instances at module level.
// Any test that imports from adventure.ts triggers that module
// graph, which calls new Audio() before the test body runs. The
// problem is that Node.js has no Audio API, which would cause
// test failurse. This stub satisfies the constructor and the
// properties playSound() relies on.
class AudioStub {
  preload: string = "";
  currentTime: number = 0;
  paused: boolean = true;
  constructor(_src: string) {}
  play(): Promise<void> {
    return Promise.resolve();
  }
  pause(): void {}
}

globalThis.Audio = AudioStub as unknown as typeof Audio;
