import { MigrationInterface, QueryRunner } from 'typeorm'

export class AppSettings1724571000003 implements MigrationInterface {
  name = 'AppSettings1724571000003'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS app_settings (
      k varchar(64) PRIMARY KEY,
      v jsonb NOT NULL,
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )`)
    // 默认阈值：最小库存 0，临期天数 30
    await queryRunner.query(`INSERT INTO app_settings(k, v) VALUES('thresholds', '{"globalMinQty":0, "expiryDays":30}') ON CONFLICT (k) DO NOTHING`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS app_settings`)
  }
}
