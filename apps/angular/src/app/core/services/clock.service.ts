import { Injectable, Signal, signal } from '@angular/core';

/**
 * A single shared clock.
 *
 * Countdowns are the only place in the application where the UI must advance on
 * its own. Rather than starting one `setInterval` per countdown (which is what
 * makes list pages expensive), one interval drives every subscriber.
 *
 * The tick is also what makes the authored auction end time meaningful in the
 * UI: a status may still read ACTIVE after the window has closed, and the
 * countdown is how the user sees that the clock has run out.
 */
@Injectable({ providedIn: 'root' })
export class ClockService {
  private readonly _now = signal(Date.now());
  /** Current time, updated once per second while at least one countdown is active. */
  readonly now: Signal<number> = this._now.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;
  private subscribers = 0;

  /** Registers a consumer. Returns the release function. */
  subscribe(): () => void {
    this.subscribers += 1;
    this.start();
    return () => {
      this.subscribers -= 1;
      if (this.subscribers <= 0) this.stop();
    };
  }

  private start(): void {
    if (this.timer !== null) return;
    this._now.set(Date.now());
    this.timer = setInterval(() => this._now.set(Date.now()), 1000);
  }

  private stop(): void {
    if (this.timer === null) return;
    clearInterval(this.timer);
    this.timer = null;
  }
}
