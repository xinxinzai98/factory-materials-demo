import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, Unique } from 'typeorm';
import { Material } from './Material.js';
import { Warehouse } from './Warehouse.js';
import { Location } from './Location.js';

@Entity({ name: 'stocks' })
@Unique('uq_stock_dim', ['materialId', 'warehouseId', 'locationId', 'batchNo'])
export class Stock {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Material, { nullable: false })
  @JoinColumn({ name: 'material_id' })
  material!: Material;
  @Index()
  @Column({ name: 'material_id', type: 'uuid' })
  materialId!: string;

  @ManyToOne(() => Warehouse, { nullable: false })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;
  @Index()
  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string;

  @ManyToOne(() => Location, { nullable: true })
  @JoinColumn({ name: 'location_id' })
  location?: Location | null;
  @Index()
  @Column({ name: 'location_id', type: 'uuid', nullable: true })
  locationId?: string | null;

  @Index()
  @Column({ name: 'batch_no', type: 'varchar', length: 100, default: '' })
  batchNo!: string;

  @Column({ name: 'mfg_date', type: 'date', nullable: true })
  mfgDate?: string | null;

  @Index()
  @Column({ name: 'exp_date', type: 'date', nullable: true })
  expDate?: string | null;

  @Column({ name: 'qty_on_hand', type: 'decimal', precision: 18, scale: 3, default: 0 })
  qtyOnHand!: string;

  @Column({ name: 'qty_allocated', type: 'decimal', precision: 18, scale: 3, default: 0 })
  qtyAllocated!: string;

  @Column({ name: 'qty_in_transit', type: 'decimal', precision: 18, scale: 3, default: 0 })
  qtyInTransit!: string;
}
