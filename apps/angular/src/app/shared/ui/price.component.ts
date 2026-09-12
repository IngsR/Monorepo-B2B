import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatAmount } from '../../core/domain/format';

export type PriceSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'hero';
export type PriceTone = 'default' | 'muted' | 'brand' | 'success' | 'danger';

/**
 * Price display.
 *
 * The single component responsible for rendering money anywhere in the product,
 * so the same figure is never shown in two different formats. Values are set in
 * a tabular monospaced face: digits align vertically in tables and the number
 * does not reflow while the user types a bid.
 *
 * The currency symbol is deliberately rendered smaller than the figure — on the
 * auction detail screen the number is the primary signal, not the unit.
 */
@Component({
  selector: 'app-price',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (label()) {
      <span class="price-label">{{ label() }}</span>
    }
    <span [class]="classes()">
      <span class="price-currency">{{ currency() }}</span>
      <span class="price-value">{{ formatted() }}</span>
    </span>
  `,
  styles: [
    `
      :host {
        display: flex;
        flex-direction: column;
        gap: var(--sp-2);
        min-width: 0;
      }
      .price {
        display: flex;
        align-items: baseline;
        gap: var(--sp-2);
      }
    `,
  ],
})
export class PriceComponent {
  readonly amount = input<number | null>(null);
  readonly size = input<PriceSize>('md');
  readonly tone = input<PriceTone>('default');
  readonly label = input<string>('');
  readonly currency = input('$');

  readonly formatted = computed(() => formatAmount(this.amount()));

  readonly classes = computed(() => {
    const parts = ['price', `price-${this.size()}`];
    if (this.tone() !== 'default') parts.push(`price-${this.tone()}`);
    if (this.amount() === null || this.amount() === undefined) parts.push('price-muted');
    return parts.join(' ');
  });
}

/**
 * A labelled metric tile. Used for the secondary auction figures — minimum next
 * bid, bid increment, starting price — where the label is as important as the
 * value.
 */
@Component({
  selector: 'app-price-tile',
  standalone: true,
  imports: [PriceComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="price-tile" [class.price-tile-accent]="accent()">
      <app-price [amount]="amount()" [label]="label()" [size]="size()" [tone]="tone()" />
      @if (hint()) {
        <span class="text-helper">{{ hint() }}</span>
      }
    </div>
  `,
})
export class PriceTileComponent {
  readonly amount = input.required<number | null>();
  readonly label = input.required<string>();
  readonly hint = input<string>('');
  readonly size = input<PriceSize>('md');
  readonly tone = input<PriceTone>('default');
  readonly accent = input(false);
}
