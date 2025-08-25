import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { Material } from './Material.js'
import { Warehouse } from './Warehouse.js'

@Entity({ name: 'adjustments' })
export class Adjustment {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'uuid' })
  materialId!: string
  @ManyToOne(() => Material)
  @JoinColumn({ name: 'material_id' })
  material!: Material

  @Column({ type: 'uuid' })
  warehouseId!: string
  @ManyToOne(() => Warehouse)
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse

  @Column({ type: 'varchar', length: 64, default: '' })
  batchNo!: string

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  beforeQty!: string

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  afterQty!: string

  @Column({ type: 'numeric', precision: 18, scale: 6 })
  delta!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  reason!: string | null

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date
}
