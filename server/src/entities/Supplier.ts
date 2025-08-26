import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

@Entity({ name: 'suppliers' })
export class Supplier {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 64 })
  code!: string

  @Column({ type: 'varchar', length: 128 })
  name!: string

  @Column({ type: 'varchar', length: 255, nullable: true })
  contact?: string | null

  @Column({ type: 'boolean', default: true })
  enabled!: boolean

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt!: Date
}
