import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source.js';

const router = Router();

// GET /api/metrics/stock-pie
router.get('/stock-pie', async (req: Request, res: Response) => {
  // 按物料类别统计库存总量
  const rows = await AppDataSource.query(`
    SELECT COALESCE(m.category, '未分类') AS type, SUM(s.qty_on_hand) AS value
    FROM materials m
    JOIN stocks s ON s.material_id = m.id
    GROUP BY type
    ORDER BY value DESC
  `)
  res.json({ data: rows })
})

// GET /api/metrics/trends?days=14
router.get('/trends', async (req: Request, res: Response) => {
  const days = +(req.query.days as string || 14)
  const rows = await AppDataSource.query(`
    SELECT to_char(d, 'YYYY-MM-DD') AS date,
      COALESCE(inb,0) AS inbounds,
      COALESCE(outb,0) AS outbounds
    FROM (
      SELECT generate_series(CURRENT_DATE - INTERVAL '${days-1} days', CURRENT_DATE, '1 day') AS d
    ) dd
    LEFT JOIN (
      SELECT DATE("createdAt") AS dt, COUNT(1) AS inb FROM inbound_orders GROUP BY dt
    ) i ON i.dt = dd.d
    LEFT JOIN (
      SELECT DATE("createdAt") AS dt, COUNT(1) AS outb FROM outbound_orders GROUP BY dt
    ) o ON o.dt = dd.d
    ORDER BY date ASC
  `)
  res.json({ data: rows })
})

// GET /api/metrics/low-stocks?limit=6
router.get('/low-stocks', async (req: Request, res: Response) => {
  const limit = +(req.query.limit as string || 6)
  const rows = await AppDataSource.query(`
    SELECT m.code AS materialCode, SUM(s.qty_on_hand) AS qty
    FROM materials m
    JOIN stocks s ON s.material_id = m.id
    GROUP BY m.code
    HAVING SUM(s.qty_on_hand) < 20
    ORDER BY qty ASC
    LIMIT $1
  `, [limit])
  res.json(rows)
})

export default router;
