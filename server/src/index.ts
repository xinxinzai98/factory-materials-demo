import 'reflect-metadata';
import express, { Request, Response } from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import bcrypt from 'bcrypt';
import { AppDataSource } from './data-source.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';
import { User } from './entities/User.js';
import { Warehouse } from './entities/Warehouse.js';
import { Material } from './entities/Material.js';

dotenv.config();

const app = express();
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// 注意顺序：先挂载无需鉴权的 /api/auth
app.use('/api/auth', authRouter);
// 再挂载需要鉴权的 /api
app.use('/api', apiRouter);

const PORT = +(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';

AppDataSource.initialize()
  .then(async () => {
    console.log('Data Source has been initialized');
    // 可选：启动时自动种子（仅在无用户时），用于本地开发与首次启动
    const autoSeed = String(process.env.AUTO_SEED || 'true').toLowerCase() === 'true';
    if (autoSeed) {
      try {
        const userRepo = AppDataSource.getRepository(User);
        const count = await userRepo.count();
        if (count === 0) {
          console.log('[seed] No users found, seeding default accounts...');
          const mk = async (username: string, role: 'ADMIN'|'OP'|'VIEWER') => {
            const passwordHash = await bcrypt.hash('123456', 10);
            const u = userRepo.create({ username, passwordHash, role, enabled: true });
            await userRepo.save(u);
          };
          await mk('admin', 'ADMIN');
          await mk('op', 'OP');
          await mk('viewer', 'VIEWER');
          // 演示基础数据（仓库与物料），若不存在则创建
          const whRepo = AppDataSource.getRepository(Warehouse);
          const mRepo = AppDataSource.getRepository(Material);
          let wh = await whRepo.findOne({ where: { code: 'WH1' } });
          if (!wh) {
            wh = whRepo.create({ code: 'WH1', name: '主仓' });
            await whRepo.save(wh);
          }
          let m = await mRepo.findOne({ where: { code: 'M001' } });
          if (!m) {
            m = mRepo.create({ code: 'M001', name: '示例物料', uom: 'PCS', isBatch: true, shelfLifeDays: 365 });
            await mRepo.save(m);
          }
          console.log('[seed] Default accounts: admin/op/viewer (password: 123456)');
        }
      } catch (e) {
        console.warn('[seed] auto seed skipped due to error:', e);
      }
    }
    app.listen(PORT, HOST, () => {
      const local = `http://localhost:${PORT}`;
      console.log(`API listening on ${local} (host: ${HOST})`);
    });
  })
  .catch((err: unknown) => {
    console.error('Data Source initialization error', err);
    process.exit(1);
  });
