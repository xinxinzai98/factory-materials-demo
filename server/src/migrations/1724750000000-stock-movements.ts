import { MigrationInterface, QueryRunner } from "typeorm";

export class StockMovements1724750000000 implements MigrationInterface {
  name = 'StockMovements1724750000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS stock_movements (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      created_at timestamptz NOT NULL DEFAULT now(),
      warehouse_id uuid NOT NULL,
      material_id uuid NOT NULL,
      batch_no varchar(100),
      qty_change decimal(18,3) NOT NULL,
      source_type varchar(24) NOT NULL,
      source_code varchar(64),
      CONSTRAINT fk_sm_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id) ON DELETE NO ACTION,
      CONSTRAINT fk_sm_mat FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE NO ACTION
    )`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sm_created_at ON stock_movements(created_at)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sm_wh ON stock_movements(warehouse_id)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sm_mat ON stock_movements(material_id)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_sm_src ON stock_movements(source_type)`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS stock_movements`)
  }
}
