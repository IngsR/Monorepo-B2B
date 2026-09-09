import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuctionLot } from '../../auctions/entities/auction-lot.entity.js';
import { User } from '../../users/entities/user.entity.js';

@Entity('bids')
export class Bid {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  lotId: string;

  @ManyToOne(() => AuctionLot, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lotId' })
  lot: AuctionLot;

  @Column({ type: 'uuid' })
  vendorId: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'vendorId' })
  vendor: User;

  @Column({ type: 'bigint' })
  amount: number;

  @CreateDateColumn()
  createdAt: Date;
}
