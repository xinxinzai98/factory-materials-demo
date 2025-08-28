import { MigrationInterface, QueryRunner } from "typeorm";

export class AuditLogs1724831000000 implements MigrationInterface {
  name = 'AuditLogs1724831000000'
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS audit_logs (
      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
      action VARCHAR(32) NOT NULL,
      entityType VARCHAR(32) NOT NULL,
      entityCode VARCHAR(64),
      username VARCHAR(100),
      reason VARCHAR(200),
      details jsonb,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_audit_entitycode ON audit_logs(entityCode)`)
  }
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS audit_logs`)
  }
}
