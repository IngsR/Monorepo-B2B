import { TestBed } from '@angular/core/testing';
import { AuctionStateService } from './auction-state.service';

describe('AuctionStateService', () => {
  let service: AuctionStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AuctionStateService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should have initial active, pending, and cancelled lots', () => {
    expect(service.activeLots().length).toBeGreaterThan(0);
    expect(service.pendingLots().length).toBeGreaterThan(0);
    expect(service.cancelledLots().length).toBeGreaterThan(0);
  });

  it('submitNewLot should add a new lot with status PENDING_REVIEW', () => {
    const initialPending = service.pendingLots().length;
    service.submitNewLot({
      title: 'Scrap Tembaga Pabrik Tekstil',
      description: 'Kabel tembaga siap lebur',
      category: 'SCRAP_METAL',
      quantity: 5,
      unit: 'Ton',
      weightKg: 5000,
      startingPrice: 350000000,
      sellerName: 'Budi Santoso',
      companyName: 'PT Cilegon Baja Mandiri',
    });

    expect(service.pendingLots().length).toBe(initialPending + 1);
    const added = service.pendingLots()[0];
    expect(added.title).toBe('Scrap Tembaga Pabrik Tekstil');
    expect(added.status).toBe('PENDING_REVIEW');
  });

  it('approveAndPublishLot should transition a lot to ACTIVE and publish to activeLots', () => {
    const pendingLot = service.pendingLots()[0];
    expect(pendingLot).toBeDefined();

    service.approveAndPublishLot(pendingLot.id);

    const updated = service.lots().find((l) => l.id === pendingLot.id);
    expect(updated?.status).toBe('ACTIVE');
    expect(service.activeLots().some((l) => l.id === pendingLot.id)).toBe(true);
  });

  it('cancelLot should transition a lot to CANCELLED', () => {
    const activeLot = service.activeLots()[0];
    expect(activeLot).toBeDefined();

    service.cancelLot(activeLot.id, 'Pelepasan ditolak audit');

    const updated = service.lots().find((l) => l.id === activeLot.id);
    expect(updated?.status).toBe('CANCELLED');
    expect(service.cancelledLots().some((l) => l.id === activeLot.id)).toBe(true);
  });

  it('placeBid should increment currentPrice and totalBids for an active lot', () => {
    const activeLot = service.activeLots()[0];
    const oldPrice = activeLot.currentPrice;
    const oldBids = activeLot.totalBids;

    service.placeBid(activeLot.id, 10000000);

    const updated = service.lots().find((l) => l.id === activeLot.id);
    expect(updated?.currentPrice).toBe(oldPrice + 10000000);
    expect(updated?.totalBids).toBe(oldBids + 1);
  });

  it('toggleMemberStatus should toggle between ACTIVE and SUSPENDED', () => {
    const member = service.members()[0];
    const initialStatus = member.status;

    service.toggleMemberStatus(member.id);
    expect(service.members().find((m) => m.id === member.id)?.status).toBe(
      initialStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE'
    );

    service.toggleMemberStatus(member.id);
    expect(service.members().find((m) => m.id === member.id)?.status).toBe(initialStatus);
  });
});
