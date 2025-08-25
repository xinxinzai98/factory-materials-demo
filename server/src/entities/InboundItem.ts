import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { InboundOrder } from './InboundOrder.js';
import { Material } from './Material.js';

@Entity({ name: 'inbound_items' })
export class InboundItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne((): typeof InboundOrder => InboundOrder, (o: InboundOrder) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order!: InboundOrder;
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

  @Column({ name: 'batch_no', type: 'varchar', length: 100, default: '' })
  batchNo!: string;

  @Column({ name: 'exp_date', type: 'date', nullable: true })
  expDate?: string | null;

  @Column({ type: 'decimal', precision: 18, scale: 3, nullable: true })
  uprice?: string | null;
}
