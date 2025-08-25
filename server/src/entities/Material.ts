import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity({ name: 'materials' })
export class Material {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string;

  @Column({ type: 'varchar', length: 200 })
  name!: string;

  @Column({ type: 'varchar', length: 200, nullable: true })
  spec?: string;

  @Column({ type: 'varchar', length: 32 })
  uom!: string;

  @Column({ type: 'varchar', length: 64, nullable: true })
  category?: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 128, nullable: true })
  barcode?: string | null;

  @Column({ type: 'boolean', default: false })
  isBatch!: boolean;

  @Column({ type: 'int', nullable: true })
  shelfLifeDays?: number | null;

  @Column({ type: 'boolean', default: true })
  enabled!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
