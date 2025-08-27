import { MigrationInterface, QueryRunner } from 'typeorm'

export class ThresholdsSlowdays1724572000004 implements MigrationInterface {
  name = 'ThresholdsSlowdays1724572000004'

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 若 thresholds 缺少 slowDays 字段，则补上默认值 60（jsonb_set 第四个参数 true 表示若不存在则创建）
    await queryRunner.query(`
      UPDATE app_settings
      SET v = jsonb_set(v::jsonb, '{slowDays}', '60'::jsonb, true)
      WHERE k = 'thresholds' AND NOT (v ? 'slowDays')
    `)
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // 回滚：去除 slowDays 字段（保留其它字段）
    // 注意：jsonb - 'key' 会删除该键
    await _queryRunner.query(`
      UPDATE app_settings
      SET v = (v::jsonb - 'slowDays')
      WHERE k = 'thresholds'
    `)
  }
}
