import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1724570000000 implements MigrationInterface {
  name = 'Init1724570000000'

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS materials (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(64) NOT NULL UNIQUE,
      name varchar(200) NOT NULL,
      spec varchar(200),
      uom varchar(32) NOT NULL,
      category varchar(64),
      barcode varchar(128) UNIQUE,
      "isBatch" boolean NOT NULL DEFAULT false,
      "shelfLifeDays" integer,
      enabled boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS warehouses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(64) NOT NULL UNIQUE,
      name varchar(200) NOT NULL,
      address varchar(300),
      enabled boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS locations (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      warehouse_id uuid NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      code varchar(64) NOT NULL,
      zone varchar(64),
      temp_zone varchar(64),
      enabled boolean NOT NULL DEFAULT true
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_locations_warehouse ON locations(warehouse_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_locations_code ON locations(code)`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS stocks (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id uuid NOT NULL REFERENCES materials(id),
      warehouse_id uuid NOT NULL REFERENCES warehouses(id),
      location_id uuid REFERENCES locations(id),
      batch_no varchar(100) NOT NULL DEFAULT '',
      mfg_date date,
      exp_date date,
      qty_on_hand decimal(18,3) NOT NULL DEFAULT 0,
      qty_allocated decimal(18,3) NOT NULL DEFAULT 0,
      qty_in_transit decimal(18,3) NOT NULL DEFAULT 0
    )`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_dim ON stocks(material_id, warehouse_id, location_id, batch_no)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_stocks_material ON stocks(material_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_stocks_warehouse ON stocks(warehouse_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_stocks_location ON stocks(location_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_stocks_exp ON stocks(exp_date)`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS inbound_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(64) NOT NULL UNIQUE,
      source_type varchar(32) NOT NULL,
      supplier varchar(200),
      arrive_date date,
      status varchar(16) NOT NULL DEFAULT 'DRAFT',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS inbound_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES inbound_orders(id) ON DELETE CASCADE,
      material_id uuid NOT NULL REFERENCES materials(id),
      qty decimal(18,3) NOT NULL,
      batch_no varchar(100) NOT NULL DEFAULT '',
      exp_date date,
      uprice decimal(18,3)
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_inbound_items_order ON inbound_items(order_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_inbound_items_material ON inbound_items(material_id)`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS outbound_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code varchar(64) NOT NULL UNIQUE,
      purpose varchar(32) NOT NULL,
      status varchar(16) NOT NULL DEFAULT 'DRAFT',
      "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
    )`);
    await queryRunner.query(`CREATE TABLE IF NOT EXISTS outbound_items (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid NOT NULL REFERENCES outbound_orders(id) ON DELETE CASCADE,
      material_id uuid NOT NULL REFERENCES materials(id),
      qty decimal(18,3) NOT NULL,
      batch_policy varchar(16) NOT NULL DEFAULT 'SYSTEM',
      batch_no varchar(100)
    )`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_outbound_items_order ON outbound_items(order_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_outbound_items_material ON outbound_items(material_id)`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS adjustments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      material_id uuid NOT NULL REFERENCES materials(id),
      warehouse_id uuid NOT NULL REFERENCES warehouses(id),
      batch_no varchar(64) NOT NULL DEFAULT '',
      before_qty decimal(18,6) NOT NULL,
      after_qty decimal(18,6) NOT NULL,
      delta decimal(18,6) NOT NULL,
      reason varchar(255),
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    )`);

    await queryRunner.query(`CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      username varchar(64) NOT NULL UNIQUE,
      "passwordHash" varchar(255) NOT NULL,
      role varchar(32) NOT NULL DEFAULT 'ADMIN',
      enabled boolean NOT NULL DEFAULT true,
      "createdAt" timestamptz NOT NULL DEFAULT NOW(),
      "updatedAt" timestamptz NOT NULL DEFAULT NOW()
    )`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS outbound_items`)
    await queryRunner.query(`DROP TABLE IF EXISTS outbound_orders`)
    await queryRunner.query(`DROP TABLE IF EXISTS inbound_items`)
    await queryRunner.query(`DROP TABLE IF EXISTS inbound_orders`)
    await queryRunner.query(`DROP TABLE IF EXISTS adjustments`)
    await queryRunner.query(`DROP TABLE IF EXISTS stocks`)
    await queryRunner.query(`DROP TABLE IF EXISTS locations`)
    await queryRunner.query(`DROP TABLE IF EXISTS warehouses`)
    await queryRunner.query(`DROP TABLE IF EXISTS users`)
    await queryRunner.query(`DROP TABLE IF EXISTS materials`)
  }
}
