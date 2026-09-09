import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity.js';
import { AuctionStatus } from '../enums/auction-status.enum.js';

@Entity('auction_lots')
export class AuctionLot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 150 })
  title: string;

  @Column({ length: 50 })
  category: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  quantity: number;

  @Column({ length: 20 })
  unit: string;

  @Column({ type: 'bigint' })
  basePrice: number;

  @Column({ type: 'bigint', default: 0 })
  currentPrice: number;

  @Column({
    type: 'enum',
    enum: AuctionStatus,
    default: AuctionStatus.PENDING_REVIEW,
  })
  status: AuctionStatus;

  @Column({ length: 200 })
  warehouseLocation: string;

  @Column({ type: 'uuid' })
  sellerId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'sellerId' })
  seller: User;

  @Column({ type: 'uuid', nullable: true })
  highestBidderId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'highestBidderId' })
  highestBidder: User | null;

  @Column({ type: 'int', default: 0 })
  totalBids: number;

  @Column({ type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
