import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';
import { OutboundItem } from './OutboundItem.js';

export type OutboundStatus = 'DRAFT' | 'APPROVED' | 'PICKED' | 'CANCELLED';

@Entity({ name: 'outbound_orders' })
export class OutboundOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 32 })
  purpose!: 'MO_ISSUE' | 'SALE' | 'RETURN' | 'ADJUST_LOSS';

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status!: OutboundStatus;

  @OneToMany((): typeof OutboundItem => OutboundItem, (it: OutboundItem) => it.order, { cascade: true })
  items!: OutboundItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
