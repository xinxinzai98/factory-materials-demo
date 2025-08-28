import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity({ name: 'audit_logs' })
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 32 })
  action!: string; // APPROVE/PUTAWAY/PICK/CANCEL/INBOUND_IMMEDIATE/OUTBOUND_IMMEDIATE/ADJUST/TRANSFER

  @Column({ type: 'varchar', length: 32 })
  entityType!: string; // InboundOrder/OutboundOrder/... 

  @Index()
  @Column({ type: 'varchar', length: 64, nullable: true })
  entityCode!: string | null; // 单据编码

  @Column({ type: 'varchar', length: 100, nullable: true })
  username!: string | null; // 操作人（若有）

  @Column({ type: 'varchar', length: 200, nullable: true })
  reason!: string | null; // 作废/撤销原因等

  @Column({ type: 'jsonb', nullable: true })
  details!: any | null; // 附加上下文

  @CreateDateColumn()
  createdAt!: Date;
}
