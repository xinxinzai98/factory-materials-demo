import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { OutboundOrder } from './OutboundOrder.js';
import { Material } from './Material.js';

@Entity({ name: 'outbound_items' })
export class OutboundItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne((): typeof OutboundOrder => OutboundOrder, (o: OutboundOrder) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: OutboundOrder;
  @Index()
  @Column({ name: 'order_id', type: 'uuid' })
  orderId!: string;

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'material_id' })
  material!: Material;
  @Index()
  @Column({ name: 'material_id', type: 'uuid' })
  materialId!: string;

  @Column({ type: 'decimal', precision: 18, scale: 3 })
  qty!: string;

  @Column({ name: 'batch_policy', type: 'varchar', length: 16, default: 'SYSTEM' })
  batchPolicy!: 'SYSTEM' | 'SPECIFIED';

  @Column({ name: 'batch_no', type: 'varchar', length: 100, nullable: true })
  batchNo?: string | null;
}
