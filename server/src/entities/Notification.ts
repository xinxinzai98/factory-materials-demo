import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm'

export type NotificationStatus = 'UNREAD' | 'READ'

@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ type: 'varchar', length: 32 })
  type!: string // warning/info/success/error

  @Column({ type: 'varchar', length: 200 })
  title!: string

  @Column({ type: 'varchar', length: 500, nullable: true })
  message?: string | null

  @Index()
  @Column({ type: 'varchar', length: 16, default: 'UNREAD' })
  status!: NotificationStatus

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}
