import 'reflect-metadata';
import { DataSource } from 'typeorm';
import dotenv from 'dotenv';
import { Material } from './entities/Material.js';
import { Warehouse } from './entities/Warehouse.js';
import { Location } from './entities/Location.js';
import { Stock } from './entities/Stock.js';
import { StockMovement } from './entities/StockMovement.js';
import { InboundOrder } from './entities/InboundOrder.js';
import { InboundItem } from './entities/InboundItem.js';
import { OutboundOrder } from './entities/OutboundOrder.js';
import { OutboundItem } from './entities/OutboundItem.js';
import { User } from './entities/User.js';
import { Adjustment } from './entities/Adjustment.js';
import { Supplier } from './entities/Supplier.js';
import { Notification } from './entities/Notification.js';

dotenv.config();

const sync = (process.env.DB_SYNC || 'false') === 'true';

const migrationsGlob = process.env.MIGRATIONS_GLOB || (process.env.NODE_ENV === 'development' ? 'src/migrations/*.ts' : 'dist/migrations/*.js');

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'db',
  port: +(process.env.DB_PORT || 5432),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASS || 'postgres',
  database: process.env.DB_NAME || 'materials',
  synchronize: sync,
  logging: false,
  entities: [Material, Warehouse, Location, Stock, StockMovement, InboundOrder, InboundItem, OutboundOrder, OutboundItem, User, Adjustment, Supplier, Notification],
  migrations: [migrationsGlob],
});
