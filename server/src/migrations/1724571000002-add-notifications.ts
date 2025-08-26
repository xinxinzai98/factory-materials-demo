import { MigrationInterface, QueryRunner } from 'typeorm'

export class AddNotifications1724571000002 implements MigrationInterface {
  name = 'AddNotifications1724571000002'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      type varchar(32) NOT NULL,
      title varchar(200) NOT NULL,
      message varchar(500),
      status varchar(16) NOT NULL DEFAULT 'UNREAD',
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status)`)
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications("createdAt")`)
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS notifications`)
  }
}
