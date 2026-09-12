import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
} from '@angular/core';
import { formatCountdown } from '../../core/domain/format';
import { ClockService } from '../../core/services/clock.service';
import { IconComponent } from './icon.component';

export type CountdownTone = 'default' | 'urgent' | 'muted' | 'onMedia';
export type CountdownSize = 'sm' | 'md' | 'lg';

/**
 * Live countdown to an auction's end time.
 *
 * Subscribes to the shared `ClockService` rather than owning an interval, so a
 * marketplace page with twenty auction cards still runs a single timer. The
 * subscription is released with the component.
 *
 * The label states what the remaining time means ("Closes in", "Starts in",
 * "Closed") — a bare number is ambiguous and would be mistaken for either
 * boundary.
 */
@Component({
  selector: 'app-countdown',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="wrapperClass()">
      @if (showIcon()) {
        <app-icon [name]="iconName()" [size]="iconSize()" />
      }
      <span>
        @if (label()) {
          <span class="countdown-label">{{ label() }}</span>
        }
        <span class="countdown-value">{{ display() }}</span>
      </span>
    </span>
  `,
  styles: [
    `
      :host {
        display: inline-flex;
      }
      .countdown-wrap {
        display: inline-flex;
        align-items: center;
        gap: var(--sp-2);
      }
      .countdown-value {
        font-family: var(--font-mono);
        font-variant-numeric: tabular-nums;
        font-weight: var(--fw-bold);
        letter-spacing: -0.02em;
      }
      .countdown-wrap.is-onMedia .countdown-value,
      .countdown-wrap.is-onMedia .countdown-label {
        color: inherit;
      }
    `,
  ],
})
export class CountdownComponent {
  /** Target instant, as an ISO timestamp. */
  readonly target = input.required<string>();
  readonly prefix = input<'closes' | 'starts' | 'none'>('closes');
  readonly tone = input<CountdownTone>('default');
  readonly size = input<CountdownSize>('md');
  readonly showIcon = input(true);
  /** Below this many milliseconds the countdown switches to the urgent tone. */
  readonly urgentThreshold = input(30 * 60 * 1000);

  private readonly clock = inject(ClockService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    const release = this.clock.subscribe();
    this.destroyRef.onDestroy(release);
  }

  private readonly remaining = computed(() => {
    const target = new Date(this.target()).getTime();
    return target - this.clock.now();
  });

  private readonly isExpired = computed(() => this.remaining() <= 0);

  private readonly isUrgent = computed(
    () => !this.isExpired() && this.remaining() <= this.urgentThreshold(),
  );

  readonly display = computed(() => (this.isExpired() ? '—' : formatCountdown(this.remaining())));

  readonly label = computed(() => {
    const expired = this.isExpired();
    switch (this.prefix()) {
      case 'starts':
        return expired ? 'Started' : 'Starts in';
      case 'closes':
        return expired ? 'Closed' : 'Closes in';
      default:
        return '';
    }
  });

  readonly iconName = computed(() =>
    this.isExpired() ? 'ban' : this.isUrgent() ? 'alert' : 'clock',
  );

  readonly iconSize = computed(() => (this.size() === 'sm' ? 13 : this.size() === 'lg' ? 18 : 15));

  readonly wrapperClass = computed(() => {
    const parts = ['countdown-wrap'];
    if (this.tone() === 'onMedia') parts.push('is-onMedia');
    else if (this.tone() === 'muted' || this.isExpired()) parts.push('is-muted');
    else if (this.tone() === 'urgent' || this.isUrgent()) parts.push('is-urgent');
    if (this.size() === 'sm') parts.push('countdown-sm');
    if (this.size() === 'lg') parts.push('countdown-lg');
    return parts.join(' ');
  });
}
