import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn, Index, VersionColumn } from 'typeorm';
import { InboundItem } from './InboundItem.js';

export type InboundStatus = 'DRAFT' | 'APPROVED' | 'PUTAWAY' | 'CANCELLED';

@Entity({ name: 'inbound_orders' })
export class InboundOrder {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ name: 'source_type', type: 'varchar', length: 32 })
  sourceType!: 'PURCHASE' | 'RETURN' | 'ADJUST_GAIN';

  @Column({ type: 'varchar', length: 200, nullable: true })
  supplier?: string;

  @Column({ name: 'arrive_date', type: 'date', nullable: true })
  arriveDate?: string;

  @Column({ type: 'varchar', length: 16, default: 'DRAFT' })
  status!: InboundStatus;

  @OneToMany((): typeof InboundItem => InboundItem, (it: InboundItem) => it.order, { cascade: true })
  items!: InboundItem[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  // 乐观锁版本
  @VersionColumn()
  version!: number;
}
