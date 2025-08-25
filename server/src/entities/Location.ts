import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Warehouse } from './Warehouse.js';

@Entity({ name: 'locations' })
export class Location {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Warehouse, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'warehouse_id' })
  warehouse!: Warehouse;

  @Index()
  @Column({ name: 'warehouse_id', type: 'uuid' })
  warehouseId!: string;

  @Index()
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  zone?: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  tempZone?: string;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;
}
