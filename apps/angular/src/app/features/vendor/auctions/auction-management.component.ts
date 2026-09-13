import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  LifecycleTransition,
  getTransition,
  minimumNextBid,
  resolveTiming,
  transitionsFrom,
} from '../../../core/domain/auction-lifecycle';
import { ApiFailure, toApiFailure } from '../../../core/domain/api-failure';
import { AuctionStatus } from '../../../core/domain/enums';
import { formatAmount, formatDateTime } from '../../../core/domain/format';
import { Auction, Bid, Paginated } from '../../../core/domain/models';
import { AsyncResource } from '../../../core/state/async-resource';
import { AuctionService } from '../../../core/services/auction.service';
import { NotificationService } from '../../../core/services/notification.service';
import { AuthService } from '../../../core/services/session.service';
import { AuctionLifecycleComponent } from '../../../shared/ui/auction-lifecycle.component';
import { AuctionStatusBadgeComponent } from '../../../shared/ui/badge.component';
import { BidHistoryComponent } from '../../../shared/ui/bid-history.component';
import { ButtonComponent } from '../../../shared/ui/button.component';
import { CountdownComponent } from '../../../shared/ui/countdown.component';
import { DialogComponent } from '../../../shared/ui/dialog.component';
import { IconComponent } from '../../../shared/ui/icon.component';
import { BreadcrumbsComponent, Crumb } from '../../../shared/ui/pagination.component';
import { PriceComponent } from '../../../shared/ui/price.component';
import { ErrorStateComponent } from '../../../shared/ui/state-block.component';
import { AlertComponent } from '../../../shared/ui/toast.component';

/**
 * Auction management — the lifecycle control surface.
 *
 * This screen exists to make the state machine legible and to offer *only* the
 * transitions that are legal from the current state. The available actions come
 * from `transitionsFrom(status)`, the same table the API enforces, so the UI
 * cannot present an action the server would reject:
 *
 *   DRAFT     → Schedule, Cancel
 *   SCHEDULED → Activate,  Cancel
 *   ACTIVE    → End,       Cancel
 *   ENDED     → (none — terminal)
 *   CANCELLED → (none — terminal)
 *
 * Every transition is confirmed first, because each one changes what bidders can
 * do. The confirmation states the precise consequence rather than "Are you sure?".
 */
@Component({
  selector: 'app-auction-management',
  standalone: true,
  imports: [
    TitleCasePipe,
    RouterLink,
    AuctionLifecycleComponent,
    AuctionStatusBadgeComponent,
    BidHistoryComponent,
    ButtonComponent,
    CountdownComponent,
    DialogComponent,
    IconComponent,
    BreadcrumbsComponent,
    PriceComponent,
    ErrorStateComponent,
    AlertComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-breadcrumbs [items]="crumbs()" />

      @switch (true) {
        @case (auction.isLoading() && !auction.data()) {
          <div class="card card-body stack">
            <div class="skeleton skeleton-title"></div>
            <div class="skeleton skeleton-text"></div>
          </div>
        }

        @case (auction.hasError()) {
          <div class="card">
            @if (auction.error(); as failure) {
              <app-error-state
                [failure]="failure"
                [retrying]="auction.isLoading()"
                (retry)="reload()"
              >
                <a class="btn btn-secondary" routerLink="/vendor/auctions">
                  <app-icon name="chevron-left" [size]="15" />
                  Kembali ke Lelang Saya
                </a>
              </app-error-state>
            }
          </div>
        }

        @case (true) {
          @let data = auctionData()!;

          <header class="page-head">
            <div class="page-head-text">
              <div class="detail-eyebrow">
                <app-auction-status-badge
                  [status]="data.status"
                  [endingSoon]="timing().endingSoon"
                />
                <span class="text-mono-id">{{ data.product?.code }}</span>
              </div>
              <h1 class="page-title">{{ data.product?.name ?? 'Lelang' }}</h1>
              <p class="page-subtitle">
                Kelola siklus lelang ini. Hanya transisi yang valid dari status saat ini yang tersedia.
              </p>
            </div>
            <div class="page-actions">
              <a class="btn btn-secondary" [routerLink]="['/marketplace', data.id]">
                <app-icon name="external" [size]="15" />
                Lihat Halaman Publik
              </a>
              @if (canEdit()) {
                <a class="btn btn-secondary" [routerLink]="['/vendor/auctions', data.id, 'edit']">
                  <app-icon name="edit" [size]="15" />
                  Edit Detail
                </a>
              }
            </div>
          </header>

          @if (actionFailure(); as failure) {
            <app-alert tone="danger" [title]="failure.message">{{ failure.detail }}</app-alert>
          }

          @if (statusWindowMismatch()) {
            <app-alert tone="warning" title="Waktu lelang sudah habis namun lelang masih terbuka">
              Penawaran telah dihentikan karena waktu berakhir sudah berlalu.
              Tutup lelang untuk memindahkannya ke status <strong>Selesai</strong> dan menyelesaikan hasilnya.
            </app-alert>
          }

          <div class="management-grid">
            <!-- Current state -->
            <section class="card">
              <div class="card-header">
                <h2 class="section-heading">Status Saat Ini</h2>
                <span class="badge badge-brand">{{ data.status | titlecase }}</span>
              </div>
              <div class="card-body stack">
                <app-auction-lifecycle [auction]="data" variant="full" />

                @if (isTerminal()) {
                  <app-alert tone="neutral" title="Status Final">
                    {{ data.status === AuctionStatus.CANCELLED ? 'Dibatalkan' : 'Selesai' }} adalah
                    status final. Tidak ada transisi siklus lebih lanjut yang tersedia untuk lelang ini.
                  </app-alert>
                } @else {
                  <div class="lifecycle-summary">
                    <p class="price-label">
                      Transisi yang tersedia dari status {{ data.status | titlecase }}
                    </p>
                    <div class="row-wrap lifecycle-actions">
                      @for (transition of transitions(); track transition.to) {
                        <app-button
                          [label]="transition.label"
                          [variant]="
                            transition.destructive ? 'danger-outline' : primaryVariant(transition)
                          "
                          [icon]="transition.destructive ? 'ban' : transitionIcon(transition)"
                          [disabled]="busy()"
                          (clicked)="requestTransition(transition)"
                        />
                      }
                    </div>
                    <p class="text-helper">
                      @if (transitions().length === 0) {
                        Tidak ada transisi yang tersedia dari status ini.
                      } @else {
                        {{ transitions().length }}
                        {{ transitions().length === 1 ? 'transisi' : 'transisi' }}
                        valid saat ini. Perubahan status lain tidak diizinkan oleh siklus lelang.
                      }
                    </p>
                  </div>
                }
              </div>
            </section>

            <!-- Key facts -->
            <section class="card">
              <div class="card-header">
                <h2 class="section-heading">Informasi Lelang</h2>
              </div>
              <div class="card-body stack">
                <app-price
                  [amount]="data.currentPrice"
                  label="Harga Saat Ini"
                  size="lg"
                  [tone]="data.bidCount > 0 ? 'default' : 'muted'"
                />

                <div class="meta-list">
                  <div class="meta-item">
                    <span class="price-label">Harga Awal</span>
                    <span class="meta-value text-numeric">{{ money(data.startingPrice) }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="price-label">Kelipatan Tawaran</span>
                    <span class="meta-value text-numeric">{{ money(data.bidIncrement) }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="price-label">Minimum Tawaran Berikutnya</span>
                    <span class="meta-value text-numeric">{{ money(minimum()) }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="price-label">Total Tawaran</span>
                    <span class="meta-value text-numeric">{{ data.bidCount }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="price-label">Waktu Mulai</span>
                    <span class="meta-value">{{ dateTime(data.startTime) }}</span>
                  </div>
                  <div class="meta-item">
                    <span class="price-label">Waktu Berakhir</span>
                    <span class="meta-value">{{ dateTime(data.endTime) }}</span>
                  </div>
                </div>

                @if (data.status === AuctionStatus.ACTIVE && timing().acceptingBids) {
                  <app-countdown [target]="data.endTime" prefix="closes" size="md" />
                }

                <div class="ownership-note">
                  <app-icon name="shield" [size]="14" />
                  <span> Anda dapat mengelola lelang ini karena akun penjual Anda adalah pemiliknya. </span>
                </div>
              </div>
            </section>
          </div>

          <!-- Bid history -->
          <section class="card">
            <div class="card-header">
              <h2 class="section-heading">Riwayat Penawaran</h2>
              <span class="badge badge-plain">{{ data.bidCount }} tawaran</span>
            </div>
            @if (bids.isLoading() && !bids.data()) {
              <div class="card-body stack-sm">
                @for (i of skeletonRows; track i) {
                  <div class="skeleton skeleton-text" style="height: 34px"></div>
                }
              </div>
            } @else {
              <app-bid-history
                [bids]="bidList()"
                sort="highest"
                [auctionEnded]="data.status === AuctionStatus.ENDED"
                emptyMessage="Belum ada penawaran pada lelang ini."
              />
            }
          </section>
        }
      }
    </div>

    <!-- Transition confirmation -->
    @if (pendingTransition(); as transition) {
      <app-dialog
        [title]="transition.label + ' lelang ini?'"
        [subtitle]="'Dari ' + statusLabel() + ' ke ' + transition.to"
        [icon]="transition.destructive ? 'ban' : transitionIcon(transition)"
        [tone]="transition.destructive ? 'danger' : 'neutral'"
        [confirmLabel]="transition.label"
        [confirmVariant]="transition.destructive ? 'danger' : 'primary'"
        [busy]="busy()"
        (confirmed)="applyTransition()"
        (dismissed)="pendingTransition.set(null)"
      >
        <p>{{ transition.description }}</p>

        @if (transition.to === AuctionStatus.SCHEDULED) {
          <p class="dialog-detail">
            Lelang akan berlangsung dari
            <strong>{{ dateTime(auctionData()?.startTime) }}</strong> hingga
            <strong>{{ dateTime(auctionData()?.endTime) }}</strong
            >.
          </p>
        }

        @if (transition.to === AuctionStatus.ENDED) {
          <p class="dialog-detail">
            @if (highestBid(); as top) {
              Tawaran tertinggi yang valid adalah <strong>{{ money(top.amount) }}</strong
              >. Tawaran tersebut menentukan hasil — platform tidak menyimpan catatan pemenang terpisah.
            } @else {
              Lelang ini belum memiliki tawaran. Tidak ada hasil yang akan dihasilkan.
            }
          </p>
        }

        @if (transition.destructive) {
          <p class="dialog-detail dialog-detail-danger">
            Tindakan ini tidak dapat dibatalkan. Penawar tidak dapat lagi menempatkan tawaran.
          </p>
        }
      </app-dialog>
    }
  `,
  styles: [
    `
      .management-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);
        gap: var(--sp-5);
        align-items: start;
      }
      @media (max-width: 1024px) {
        .management-grid {
          grid-template-columns: 1fr;
        }
      }
      .detail-eyebrow {
        display: flex;
        align-items: center;
        gap: var(--sp-3);
        margin-bottom: var(--sp-3);
      }
      .lifecycle-summary {
        display: flex;
        flex-direction: column;
        gap: var(--sp-3);
        padding-top: var(--sp-4);
        border-top: 1px solid var(--c-border);
      }
      .lifecycle-actions {
        display: flex;
        gap: var(--sp-3);
      }
      .ownership-note {
        display: flex;
        align-items: center;
        gap: var(--sp-2);
        padding: var(--sp-3);
        font-size: var(--fs-sm);
        color: var(--c-text-secondary);
        background: var(--c-surface-sunken);
        border-radius: var(--r-sm);
      }
      .dialog-detail {
        margin-top: var(--sp-3);
        padding: var(--sp-3);
        font-size: var(--fs-sm);
        background: var(--c-surface-sunken);
        border-radius: var(--r-sm);
      }
      .dialog-detail-danger {
        color: var(--c-danger);
        background: var(--c-danger-soft);
      }
    `,
  ],
})
export class AuctionManagementComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly auctionService = inject(AuctionService);
  private readonly notifications = inject(NotificationService);
  private readonly auth = inject(AuthService);

  protected readonly AuctionStatus = AuctionStatus;
  protected readonly skeletonRows = Array.from({ length: 4 }, (_, i) => i);

  readonly auction = new AsyncResource<Auction>();
  readonly bids = new AsyncResource<Paginated<Bid>>();

  readonly busy = signal(false);
  readonly actionFailure = signal<ApiFailure | null>(null);
  readonly pendingTransition = signal<LifecycleTransition | null>(null);

  private readonly auctionId = this.route.snapshot.paramMap.get('id') ?? '';

  readonly auctionData = computed(() => this.auction.data());
  readonly bidList = computed(() => this.bids.data()?.items ?? []);

  readonly timing = computed(() => {
    const data = this.auctionData();
    return data
      ? resolveTiming(data)
      : { acceptingBids: false, endingSoon: false, clockExpired: false };
  });

  readonly minimum = computed(() => {
    const data = this.auctionData();
    return data ? minimumNextBid(data) : 0;
  });

  /** The lifecycle actions legal from the current state. Empty for terminal states. */
  readonly transitions = computed<LifecycleTransition[]>(() => {
    const data = this.auctionData();
    return data ? transitionsFrom(data.status) : [];
  });

  readonly isTerminal = computed(() => {
    const status = this.auctionData()?.status;
    return status === AuctionStatus.ENDED || status === AuctionStatus.CANCELLED;
  });

  readonly statusLabel = computed(() => {
    const status = this.auctionData()?.status;
    return status ? status.charAt(0) + status.slice(1).toLowerCase() : '';
  });

  readonly statusWindowMismatch = computed(() => {
    const data = this.auctionData();
    if (!data) return false;
    return data.status === AuctionStatus.ACTIVE && resolveTiming(data).clockExpired;
  });

  readonly highestBid = computed(() => {
    const list = this.bidList();
    if (list.length === 0) return null;
    return [...list].sort((a, b) => b.amount - a.amount)[0];
  });

  /**
   * A vendor may manage their own auctions; an administrator may manage any.
   * A vendor viewing another vendor's auction sees the read-only facts only.
   */
  readonly canManage = computed(() => {
    const data = this.auctionData();
    if (!data) return false;
    if (this.auth.isAdmin()) return true;
    return this.auth.vendor()?.id === data.vendorId;
  });

  /** Terms are editable only while the auction has not started. */
  readonly canEdit = computed(() => {
    if (!this.canManage()) return false;
    const status = this.auctionData()?.status;
    return status === AuctionStatus.DRAFT || status === AuctionStatus.SCHEDULED;
  });

  readonly crumbs = computed<Crumb[]>(() => [
    { label: 'Lelang Saya', link: '/vendor/auctions' },
    { label: this.auctionData()?.product?.name ?? 'Detail Lelang' },
  ]);

  constructor() {
    this.reload();
  }

  reload(): void {
    this.auction.load(this.auctionService.getById(this.auctionId));
    this.bids.load(this.auctionService.listBids(this.auctionId, { sort: 'highest', limit: 50 }));
  }

  primaryVariant(transition: LifecycleTransition): 'primary' | 'success' {
    return transition.to === AuctionStatus.ENDED ? 'success' : 'primary';
  }

  transitionIcon(transition: LifecycleTransition) {
    switch (transition.to) {
      case AuctionStatus.SCHEDULED:
        return 'calendar' as const;
      case AuctionStatus.ACTIVE:
        return 'play' as const;
      case AuctionStatus.ENDED:
        return 'check' as const;
      default:
        return 'ban' as const;
    }
  }

  /** Opens the confirmation dialog. Nothing is sent until the user confirms. */
  requestTransition(transition: LifecycleTransition): void {
    // Re-verify against the live status: the record may have changed since render.
    const data = this.auctionData();
    if (data && !getTransition(data.status, transition.to)) {
      this.notifications.warning(
        'Action no longer available',
        `This auction is now ${data.status}. Reload to see the current options.`,
      );
      this.reload();
      return;
    }

    this.actionFailure.set(null);
    this.pendingTransition.set(transition);
  }

  applyTransition(): void {
    const transition = this.pendingTransition();
    if (!transition) return;

    this.busy.set(true);
    this.actionFailure.set(null);

    this.auctionService.changeStatus(this.auctionId, transition.to).subscribe({
      next: (auction) => {
        this.busy.set(false);
        this.pendingTransition.set(null);
        this.auction.set(auction);
        this.notifications.success(
          `Lelang ${transition.label.toLowerCase()}`,
          transitionDescription(transition.to),
        );
        this.reload();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        this.pendingTransition.set(null);
        const failure = toApiFailure(error);
        this.actionFailure.set(failure);
        this.notifications.fromFailure(failure, 'Transisi gagal');
        // A 409 means someone else changed the state; re-read it.
        if (failure.status === 409) this.reload();
      },
    });
  }

  money(value: number | null | undefined): string {
    return formatAmount(value);
  }

  dateTime(iso: string | null | undefined): string {
    return formatDateTime(iso);
  }
}

function transitionDescription(status: AuctionStatus): string {
  switch (status) {
    case AuctionStatus.SCHEDULED:
      return 'Lelang dijadwalkan dan akan aktif pada waktu mulai yang ditentukan.';
    case AuctionStatus.ACTIVE:
      return 'Lelang terbuka untuk penawaran hingga waktu berakhirnya.';
    case AuctionStatus.ENDED:
      return 'Hasil ditentukan berdasarkan tawaran tertinggi yang valid.';
    case AuctionStatus.CANCELLED:
      return 'Lelang telah ditarik/dibatalkan.';
    default:
      return 'Status lelang telah diperbarui.';
  }
}
