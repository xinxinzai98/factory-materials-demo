import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddSuppliers1724571000001 implements MigrationInterface {
  name = 'AddSuppliers1724571000001'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS suppliers (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(64) NOT NULL UNIQUE,
      name varchar(128) NOT NULL,
      contact varchar(255),
      enabled boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_suppliers_code ON suppliers(code)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS suppliers`)
  }
}
