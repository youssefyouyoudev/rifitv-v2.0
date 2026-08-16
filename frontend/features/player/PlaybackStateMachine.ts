import type { PlaybackState } from "./types";

const transitions: Record<PlaybackState, PlaybackState[]> = {
  idle: ["loading", "error"],
  loading: ["ready", "playing", "buffering", "recovering", "switching_source", "offline", "error"],
  ready: ["playing", "loading", "switching_source", "error"],
  playing: ["buffering", "recovering", "switching_source", "offline", "ended", "error", "ready"],
  buffering: ["playing", "recovering", "switching_source", "offline", "error"],
  recovering: ["playing", "buffering", "switching_source", "offline", "error"],
  switching_source: ["loading", "playing", "offline", "error"],
  offline: ["recovering", "loading", "error"],
  error: ["loading", "recovering"],
  ended: ["loading", "playing"],
};

export class PlaybackStateMachine {
  private current: PlaybackState = "idle";

  state(): PlaybackState {
    return this.current;
  }

  transition(next: PlaybackState): PlaybackState {
    if (next === this.current) {
      return this.current;
    }

    if (!transitions[this.current].includes(next)) {
      throw new Error(`Invalid playback transition: ${this.current} -> ${next}`);
    }

    this.current = next;

    return this.current;
  }

  force(next: PlaybackState): PlaybackState {
    this.current = next;

    return this.current;
  }
}
