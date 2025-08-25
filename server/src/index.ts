import 'reflect-metadata';
import express, { Request, Response } from 'express';
import morgan from 'morgan';
import helmet from 'helmet';
import cors from 'cors';
import dotenv from 'dotenv';
import { AppDataSource } from './data-source.js';
import apiRouter from './routes/api.js';
import authRouter from './routes/auth.js';

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
    app.listen(PORT, HOST, () => {
      const local = `http://localhost:${PORT}`;
      console.log(`API listening on ${local} (host: ${HOST})`);
    });
  })
  .catch((err: unknown) => {
    console.error('Data Source initialization error', err);
    process.exit(1);
  });
