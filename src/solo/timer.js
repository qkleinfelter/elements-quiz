const TICK_INTERVAL_MS = 200;

/**
 * A countdown timer for a single Solo question (PLAN.md §6). Ticks roughly every
 * 200ms with the remaining time, and calls onTimeout exactly once when it reaches
 * zero. Pauses automatically while the tab is hidden (visibilitychange) so a
 * backgrounded tab doesn't burn through the countdown, then resumes the same
 * remaining duration when the tab becomes visible again.
 */
export class Timer {
  #durationMs;
  #onTick;
  #onTimeout;
  #intervalId = null;
  #endsAt = null;
  #remainingMs = null; // set while paused
  #visibilityHandler = null;

  constructor({ durationMs, onTick, onTimeout }) {
    this.#durationMs = durationMs;
    this.#onTick = onTick;
    this.#onTimeout = onTimeout;
  }

  start() {
    this.#remainingMs = this.#durationMs;
    this.#resume();
    if (typeof document !== "undefined") {
      this.#visibilityHandler = () => {
        if (document.hidden) {
          this.#pause();
        } else {
          this.#resume();
        }
      };
      document.addEventListener("visibilitychange", this.#visibilityHandler);
    }
  }

  stop() {
    this.#clearInterval();
    if (typeof document !== "undefined" && this.#visibilityHandler) {
      document.removeEventListener("visibilitychange", this.#visibilityHandler);
      this.#visibilityHandler = null;
    }
  }

  #resume() {
    this.#endsAt = Date.now() + this.#remainingMs;
    this.#clearInterval();
    this.#intervalId = setInterval(() => this.#tick(), TICK_INTERVAL_MS);
  }

  #pause() {
    this.#remainingMs = Math.max(0, this.#endsAt - Date.now());
    this.#clearInterval();
  }

  #clearInterval() {
    if (this.#intervalId !== null) {
      clearInterval(this.#intervalId);
      this.#intervalId = null;
    }
  }

  #tick() {
    const remaining = Math.max(0, this.#endsAt - Date.now());
    this.#onTick(remaining);
    if (remaining <= 0) {
      this.stop();
      this.#onTimeout();
    }
  }
}
