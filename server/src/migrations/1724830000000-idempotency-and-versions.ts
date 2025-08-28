import { MigrationInterface, QueryRunner } from "typeorm";

export class IdempotencyAndVersions1724830000000 implements MigrationInterface {
  name = 'IdempotencyAndVersions1724830000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS idempotency_keys (
      key VARCHAR(100) NOT NULL,
      method VARCHAR(10) NOT NULL,
      path VARCHAR(200) NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      CONSTRAINT idempotency_keys_pk PRIMARY KEY (key, method, path)
    )`);
    // add version column if not exists
    await queryRunner.query(`ALTER TABLE inbound_orders ADD COLUMN IF NOT EXISTS version INT DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE outbound_orders ADD COLUMN IF NOT EXISTS version INT DEFAULT 1`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS idempotency_keys`);
    // keep version columns (safe), no down for existing data
  }
}
