import { Entity, PrimaryGeneratedColumn, Column, Index, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm'
import { Warehouse } from './Warehouse.js'
import { Material } from './Material.js'

@Entity({ name: 'stock_movements' })
export class StockMovement {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @CreateDateColumn({ name: 'created_at' })
  @Index()
  createdAt!: Date

  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse
  @Index()
  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string

  @ManyToOne(() => Material)
  @JoinColumn({ name: 'material_id' })
  material!: Material
  @Index()
  @Column({ name: 'material_id', type: 'uuid' })
  materialId!: string

  @Column({ name: 'batch_no', type: 'varchar', length: 100, nullable: true })
  batchNo?: string | null

  @Column({ name: 'qty_change', type: 'decimal', precision: 18, scale: 3 })
  qtyChange!: string

  @Index()
  @Column({ name: 'source_type', type: 'varchar', length: 24 })
  sourceType!: 'INBOUND' | 'OUTBOUND' | 'ADJUST' | 'TRANSFER'

  @Column({ name: 'source_code', type: 'varchar', length: 64, nullable: true })
  sourceCode?: string | null
}
