import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source.js';
import { EntityManager } from 'typeorm';
import { Material } from '../entities/Material.js';
import { Stock } from '../entities/Stock.js';
import { InboundOrder } from '../entities/InboundOrder.js';
import { OutboundOrder } from '../entities/OutboundOrder.js';
import { authGuard } from '../middleware/auth.js';
import { requireRoles } from '../middleware/rbac.js';
import { Warehouse } from '../entities/Warehouse.js';
import { Location } from '../entities/Location.js';
import { InboundItem } from '../entities/InboundItem.js';
import { OutboundItem } from '../entities/OutboundItem.js';
import { Adjustment } from '../entities/Adjustment.js';
import { User } from '../entities/User.js';
import { Supplier } from '../entities/Supplier.js';
import { Notification } from '../entities/Notification.js';
import { getDashboardMetrics, getTrends as svcGetTrends, getLowStocks as svcGetLowStocks } from '../services/metrics.js';
import bcrypt from 'bcrypt';
// no external csv lib; build simple CSV manually
import { StockMovement } from '../entities/StockMovement.js';

const router = Router();

router.use(authGuard());

// GET /api/materials
router.get('/materials', async (req: Request, res: Response) => {
  const page = +(req.query.page as string || 1);
  const pageSize = +(req.query.pageSize as string || 20);
  const q = (req.query.q as string || '').trim();
  const updatedSince = req.query.updatedSince as string | undefined;

  const repo = AppDataSource.getRepository(Material);
  const qb = repo.createQueryBuilder('m');
  if (q) {
    qb.andWhere('(m.code ILIKE :q OR m.name ILIKE :q)', { q: `%${q}%` });
  }
  if (updatedSince) {
    qb.andWhere('m.updatedAt >= :ts', { ts: new Date(updatedSince) });
  }
  qb.orderBy('m.updatedAt', 'DESC').skip((page - 1) * pageSize).take(pageSize);

  const [data, total] = await qb.getManyAndCount();
  res.json({ data, page: { page, pageSize, total } });
});

// POST /api/materials
router.post('/materials', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
  const { code, name, uom, spec, category, barcode, isBatch, shelfLifeDays, enabled } = req.body || {};
  if (!code || !name || !uom) return res.status(400).json({ message: 'code/name/uom required' });
  const repo = AppDataSource.getRepository(Material);
  const exist = await repo.findOne({ where: [{ code }, { barcode }] });
  if (exist) return res.status(409).json({ message: 'material code or barcode exists' });
  const m = repo.create({ code, name, uom, spec, category, barcode, isBatch: !!isBatch, shelfLifeDays: shelfLifeDays ?? null, enabled: enabled ?? true });
  await repo.save(m);
  res.status(201).json(m);
});

// 模板导出与导入（CSV）
router.get('/materials/template.csv', async (_req: Request, res: Response) => {
  const header = ['code','name','uom','isBatch','shelfLifeDays'];
  const csv = header.join(',') + '\n' + 'M001,示例物料,PCS,true,365\n';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="materials-template.csv"');
  res.send('\ufeff' + csv);
});
router.post('/materials/import-csv', requireRoles('ADMIN'), async (req: Request, res: Response) => {
  const { csv } = req.body || {};
  if (!csv || typeof csv !== 'string') return res.status(400).json({ message: 'csv required' });
  const lines = csv.split(/\r?\n/).filter((l: string) => l.trim().length > 0);
  if (lines.length <= 1) return res.status(400).json({ message: 'no rows' });
  const header = lines[0].split(',').map((s)=> s.trim());
  const idx = (k: string) => header.findIndex(h=> h===k);
  const iCode = idx('code'), iName = idx('name'), iUom = idx('uom');
  const iIsBatch = idx('isBatch'), iSL = idx('shelfLifeDays');
  if (iCode<0 || iName<0 || iUom<0) return res.status(400).json({ message: 'header must include code,name,uom' });
  const repo = AppDataSource.getRepository(Material);
  const created: string[] = [];
  const skipped: string[] = [];
  const seen = new Set<string>();
  for (let li=1; li<lines.length; li++) {
    const cols = lines[li].split(',');
    const code = (cols[iCode]||'').trim();
    const name = (cols[iName]||'').trim();
    const uom = (cols[iUom]||'').trim();
    if (!code || !name || !uom) { skipped.push(code || `(row${li+1})`); continue; }
    if (seen.has(code)) { skipped.push(code); continue; }
    const isBatch = iIsBatch>=0 ? ((cols[iIsBatch]||'').trim().toLowerCase()==='true') : false;
    const shelfLifeDays = iSL>=0 ? Number((cols[iSL]||'').trim()||0) : null;
    const exist = await repo.findOne({ where: { code } });
    if (exist) { skipped.push(code); continue; }
    const m = repo.create({ code, name, uom, isBatch, shelfLifeDays: shelfLifeDays||null, enabled: true });
    await repo.save(m);
    created.push(code);
    seen.add(code);
  }
  res.json({ ok: true, created, skipped, createdCount: created.length, skippedCount: skipped.length, total: lines.length - 1 });
});

// POST /api/warehouses
router.post('/warehouses', requireRoles('ADMIN'), async (req: Request, res: Response) => {
  const { code, name, address, enabled } = req.body || {};
  if (!code || !name) return res.status(400).json({ message: 'code/name required' });
  const repo = AppDataSource.getRepository(Warehouse);
  const exist = await repo.findOne({ where: { code } });
  if (exist) return res.status(409).json({ message: 'warehouse code exists' });
  const w = repo.create({ code, name, address, enabled: enabled ?? true });
  await repo.save(w);
  res.status(201).json(w);
});

// GET /api/warehouses 列表（用于筛选）
router.get('/warehouses', async (_req: Request, res: Response) => {
  const rows = await AppDataSource.getRepository(Warehouse)
    .createQueryBuilder('w')
    .orderBy('w.code','ASC')
    .getMany();
  res.json(rows.map(w => ({ code: w.code, name: (w as any).name || w.code, enabled: (w as any).enabled })));
});

// GET /api/locations 列表（支持按仓库过滤）
router.get('/locations', async (req: Request, res: Response) => {
  const warehouse = (req.query.warehouse as string | undefined)?.trim();
  const q = (req.query.q as string | undefined)?.trim();
  const enabled = req.query.enabled as string | undefined;

  const repo = AppDataSource.getRepository(Location);
  const qb = repo.createQueryBuilder('l').leftJoinAndSelect('l.warehouse', 'w');
  if (warehouse) qb.andWhere('w.code = :wc', { wc: warehouse });
  if (q) qb.andWhere('(l.code ILIKE :q OR l.zone ILIKE :q)', { q: `%${q}%` });
  if (enabled !== undefined) qb.andWhere('l.enabled = :en', { en: enabled === 'true' });
  qb.orderBy('w.code', 'ASC').addOrderBy('l.code','ASC');
  const rows = await qb.getMany();
  res.json(rows.map(l => ({
    warehouse: l.warehouse.code,
    code: l.code,
    zone: (l as any).zone || null,
    tempZone: (l as any).tempZone || null,
    enabled: (l as any).enabled,
  })));
});

// Suppliers
router.get('/suppliers', async (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim();
  const enabled = req.query.enabled as string | undefined;
  const repo = AppDataSource.getRepository(Supplier);
  const qb = repo.createQueryBuilder('s');
  if (q) qb.andWhere('(s.code ILIKE :q OR s.name ILIKE :q)', { q: `%${q}%` });
  if (enabled !== undefined) qb.andWhere('s.enabled = :en', { en: enabled === 'true' });
  qb.orderBy('s.updatedAt', 'DESC');
  const data = await qb.getMany();
  res.json(data);
});
router.post('/suppliers', requireRoles('ADMIN'), async (req: Request, res: Response) => {
  const { code, name, contact, enabled } = req.body || {};
  if (!code || !name) return res.status(400).json({ message: 'code/name required' });
  const repo = AppDataSource.getRepository(Supplier);
  const exist = await repo.findOne({ where: { code } });
  if (exist) return res.status(409).json({ message: 'supplier code exists' });
  const s = repo.create({ code, name, contact: contact || null, enabled: enabled ?? true });
  await repo.save(s);
  res.status(201).json(s);
});
router.put('/suppliers/:code', requireRoles('ADMIN'), async (req: Request, res: Response) => {
  const code = req.params.code;
  const repo = AppDataSource.getRepository(Supplier);
  const s = await repo.findOne({ where: { code } });
  if (!s) return res.status(404).json({ message: 'not found' });
  const { name, contact, enabled } = req.body || {};
  if (name !== undefined) s.name = name;
  if (contact !== undefined) s.contact = contact;
  if (enabled !== undefined) s.enabled = !!enabled;
  await repo.save(s);
  res.json(s);
});
router.delete('/suppliers/:code', requireRoles('ADMIN'), async (req: Request, res: Response) => {
  const code = req.params.code;
  const repo = AppDataSource.getRepository(Supplier);
  const s = await repo.findOne({ where: { code } });
  if (!s) return res.status(404).json({ message: 'not found' });
  await repo.remove(s);
  res.json({ ok: true });
});

// GET /api/stocks
router.get('/stocks', async (req: Request, res: Response) => {
  const materialCode = req.query.materialCode as string | undefined;
  const warehouseCode = req.query.warehouse as string | undefined;
  const batchNo = req.query.batchNo as string | undefined;

  const stockRepo = AppDataSource.getRepository(Stock);
  const qb = stockRepo.createQueryBuilder('s')
    .leftJoinAndSelect('s.material', 'm')
    .leftJoinAndSelect('s.warehouse', 'w')
    .leftJoinAndSelect('s.location', 'l');

  if (materialCode) qb.andWhere('m.code = :mc', { mc: materialCode });
  if (warehouseCode) qb.andWhere('w.code = :wc', { wc: warehouseCode });
  if (batchNo) qb.andWhere('s.batchNo = :bn', { bn: batchNo });

  const rows = await qb.getMany();
  const data = rows.map((r: Stock) => ({
    materialId: r.materialId,
    materialCode: r.material.code,
    warehouse: r.warehouse.code,
    location: r.location?.code || null,
    batchNo: r.batchNo,
    expDate: r.expDate,
    qtyOnHand: Number(r.qtyOnHand),
    qtyAllocated: Number(r.qtyAllocated),
    qtyAvailable: Number(r.qtyOnHand) - Number(r.qtyAllocated),
  }));
  res.json(data);
});

// 导出库存 CSV
router.get('/stocks.csv', async (req: Request, res: Response) => {
  const materialCode = req.query.materialCode as string | undefined;
  const warehouseCode = req.query.warehouse as string | undefined;
  const batchNo = req.query.batchNo as string | undefined;
  const stockRepo = AppDataSource.getRepository(Stock);
  const qb = stockRepo.createQueryBuilder('s')
    .leftJoinAndSelect('s.material','m')
    .leftJoinAndSelect('s.warehouse','w')
    .leftJoinAndSelect('s.location','l');
  if (materialCode) qb.andWhere('m.code = :mc', { mc: materialCode });
  if (warehouseCode) qb.andWhere('w.code = :wc', { wc: warehouseCode });
  if (batchNo) qb.andWhere('s.batchNo = :bn', { bn: batchNo });
  const rows = await qb.orderBy('m.code','ASC').addOrderBy('w.code','ASC').getMany();
  const data = rows.map((r: Stock) => ({
    materialCode: r.material.code,
    warehouse: r.warehouse.code,
    location: r.location?.code || '',
    batchNo: r.batchNo,
    expDate: r.expDate,
    qtyOnHand: r.qtyOnHand,
    qtyAllocated: r.qtyAllocated,
  qtyAvailable: Number(r.qtyOnHand) - Number(r.qtyAllocated),
  }));
  const header = ['materialCode','warehouse','location','batchNo','expDate','qtyOnHand','qtyAllocated','qtyAvailable'];
  const escape = (v: any) => {
    const s = (v===null||v===undefined)?'':String(v)
    return '"' + s.replace(/"/g,'""') + '"'
  }
  const csv = [header.join(',')].concat(data.map(r=> header.map(h=> escape((r as any)[h])).join(','))).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  const fn = (req.query.filename as string | undefined) || 'stocks.csv'
  res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
  res.send('\ufeff' + csv);
});

// ------------------- 入库单：列表与流转 -------------------
// GET /api/inbounds 列表
router.get('/inbounds', async (req: Request, res: Response) => {
  const page = +(req.query.page as string || 1);
  const pageSize = +(req.query.pageSize as string || 20);
  const status = req.query.status as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;
  const code = req.query.code as string | undefined;
  const repo = AppDataSource.getRepository(InboundOrder);
  const qb = repo.createQueryBuilder('o').leftJoinAndSelect('o.items','it');
  if (status) qb.andWhere('o.status = :st', { st: status });
  if (code) qb.andWhere('o.code ILIKE :c', { c: `%${code}%` });
  if (dateFrom) qb.andWhere('o.createdAt >= :df', { df: new Date(dateFrom) });
  if (dateTo) qb.andWhere('o.createdAt <= :dt', { dt: new Date(dateTo) });
  qb.orderBy('o.createdAt','DESC').skip((page-1)*pageSize).take(pageSize);
  const [data, total] = await qb.getManyAndCount();
  res.json({ data, page: { page, pageSize, total } });
})
router.get('/inbounds.csv', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;
  const code = req.query.code as string | undefined;
  const qb = AppDataSource.getRepository(InboundOrder).createQueryBuilder('o');
  if (status) qb.andWhere('o.status = :st', { st: status });
  if (code) qb.andWhere('o.code ILIKE :c', { c: `%${code}%` });
  if (dateFrom) qb.andWhere('o.createdAt >= :df', { df: new Date(dateFrom) });
  if (dateTo) qb.andWhere('o.createdAt <= :dt', { dt: new Date(dateTo) });
  const rows = await qb.orderBy('o.createdAt','DESC').getMany();
  const header = ['code','sourceType','supplier','status','createdAt']
  const fmt = (v: any) => v instanceof Date ? v.toISOString() : v
  const escape = (v: any) => '"' + String(fmt(v)??'').replace(/"/g,'""') + '"'
  const csv = [header.join(',')].concat(rows.map((r:any)=> header.map(h=> escape((r as any)[h])).join(','))).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  const fn = (req.query.filename as string | undefined) || 'inbounds.csv'
  res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
  res.send('\ufeff' + csv);
})

// 库存变动流水（JSON）
router.get('/movements', async (req: Request, res: Response) => {
  const dateFrom = req.query.dateFrom as string | undefined
  const dateTo = req.query.dateTo as string | undefined
  const warehouse = req.query.warehouse as string | undefined
  const materialCode = req.query.materialCode as string | undefined
  const sourceType = req.query.sourceType as string | undefined
  const limit = Math.max(1, Math.min(1000, Number((req.query.limit as any) || 500)))

  const repo = AppDataSource.getRepository(StockMovement)
  const qb = repo.createQueryBuilder('mv')
    .leftJoin('mv.material','m')
    .leftJoin('mv.warehouse','w')
    .select([
      'mv.createdAt AS "createdAt"',
      'w.code AS "warehouse"',
      'm.code AS "materialCode"',
      'mv.batchNo AS "batchNo"',
      'mv.qtyChange AS "qtyChange"',
      'mv.sourceType AS "sourceType"',
      'mv.sourceCode AS "sourceCode"',
    ])
  if (dateFrom) qb.andWhere('mv.createdAt >= :df', { df: new Date(dateFrom) })
  if (dateTo) qb.andWhere('mv.createdAt <= :dt', { dt: new Date(dateTo) })
  if (warehouse) qb.andWhere('w.code = :wc', { wc: warehouse })
  if (materialCode) qb.andWhere('m.code = :mc', { mc: materialCode })
  if (sourceType) qb.andWhere('mv.sourceType = :st', { st: sourceType })
  const rows = await qb.orderBy('mv.createdAt','DESC').take(limit).getRawMany()
  res.json(rows)
})

// 库存变动流水 CSV 导出
router.get('/movements.csv', async (req: Request, res: Response) => {
  const dateFrom = req.query.dateFrom as string | undefined
  const dateTo = req.query.dateTo as string | undefined
  const warehouse = req.query.warehouse as string | undefined
  const materialCode = req.query.materialCode as string | undefined
  const sourceType = req.query.sourceType as string | undefined
  const limit = Math.max(1, Math.min(50000, Number((req.query.limit as any) || 10000)))

  const repo = AppDataSource.getRepository(StockMovement)
  const qb = repo.createQueryBuilder('mv')
    .leftJoin('mv.material','m')
    .leftJoin('mv.warehouse','w')
    .select([
      'mv.createdAt AS "createdAt"',
      'w.code AS "warehouse"',
      'm.code AS "materialCode"',
      'mv.batchNo AS "batchNo"',
      'mv.qtyChange AS "qtyChange"',
      'mv.sourceType AS "sourceType"',
      'mv.sourceCode AS "sourceCode"',
    ])
  if (dateFrom) qb.andWhere('mv.createdAt >= :df', { df: new Date(dateFrom) })
  if (dateTo) qb.andWhere('mv.createdAt <= :dt', { dt: new Date(dateTo) })
  if (warehouse) qb.andWhere('w.code = :wc', { wc: warehouse })
  if (materialCode) qb.andWhere('m.code = :mc', { mc: materialCode })
  if (sourceType) qb.andWhere('mv.sourceType = :st', { st: sourceType })
  const rows = await qb.orderBy('mv.createdAt','DESC').take(limit).getRawMany()
  const header = ['createdAt','warehouse','materialCode','batchNo','qtyChange','sourceType','sourceCode']
  const fmt = (v: any) => v instanceof Date ? v.toISOString() : v
  const escape = (v: any) => '"' + String(fmt(v)??'').replace(/"/g,'""') + '"'
  const csv = [header.join(',')].concat(rows.map((r:any)=> header.map(h=> escape(r[h])).join(','))).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  const fn = (req.query.filename as string | undefined) || 'movements.csv'
  res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
  res.send('\ufeff' + csv);
})

// 库存变动日汇总（按天统计 in/out/net）
router.get('/movements/summary', async (req: Request, res: Response) => {
  const dateFrom = req.query.dateFrom as string | undefined
  const dateTo = req.query.dateTo as string | undefined
  const warehouse = req.query.warehouse as string | undefined
  const materialCode = req.query.materialCode as string | undefined
  const periodRaw = (req.query.period as string | undefined) || 'day'
  const groupBy = (req.query.groupBy as string | undefined) || undefined // 'warehouse' | 'material' | undefined
  const period = ['day','week','month'].includes(periodRaw) ? periodRaw : 'day'

  let format = `to_char(date_trunc('day', mv.created_at), 'YYYY-MM-DD')`
  if (period === 'week') format = `to_char(date_trunc('week', mv.created_at), 'IYYY-IW')`
  if (period === 'month') format = `to_char(date_trunc('month', mv.created_at), 'YYYY-MM')`

  let cond = '1=1'
  const params: any[] = []
  if (dateFrom) { cond += ` AND mv.created_at >= $${params.length+1}`; params.push(new Date(dateFrom)) }
  if (dateTo) { cond += ` AND mv.created_at <= $${params.length+1}`; params.push(new Date(dateTo)) }
  if (warehouse) { cond += ` AND w.code = $${params.length+1}`; params.push(warehouse) }
  if (materialCode) { cond += ` AND m.code = $${params.length+1}`; params.push(materialCode) }

  const selectGroup = groupBy === 'warehouse' ? `, w.code AS "warehouse"` : (groupBy === 'material' ? `, m.code AS "materialCode"` : '')
  const groupCols = groupBy === 'warehouse' ? ', 2' : (groupBy === 'material' ? ', 2' : '')
  const orderCols = groupCols ? `1 ASC, 2 ASC` : `1 ASC`

  const sql = `SELECT ${format} AS date${selectGroup},
            SUM(CASE WHEN mv.qty_change::numeric > 0 THEN mv.qty_change::numeric ELSE 0 END) AS "inQty",
            SUM(CASE WHEN mv.qty_change::numeric < 0 THEN -mv.qty_change::numeric ELSE 0 END) AS "outQty",
            SUM(mv.qty_change::numeric) AS "net"
     FROM stock_movements mv
     JOIN materials m ON m.id = mv.material_id
     JOIN warehouses w ON w.id = mv.warehouse_id
     WHERE ${cond}
     GROUP BY 1${groupCols}
     ORDER BY ${orderCols}`
  const rows = await AppDataSource.query(sql, params)
  res.json({ data: rows })
})

// 库存变动日汇总 CSV 导出
router.get('/movements/summary.csv', async (req: Request, res: Response) => {
  const dateFrom = req.query.dateFrom as string | undefined
  const dateTo = req.query.dateTo as string | undefined
  const warehouse = req.query.warehouse as string | undefined
  const materialCode = req.query.materialCode as string | undefined
  const periodRaw = (req.query.period as string | undefined) || 'day'
  const groupBy = (req.query.groupBy as string | undefined) || undefined // 'warehouse' | 'material' | undefined
  const period = ['day','week','month'].includes(periodRaw) ? periodRaw : 'day'

  let format = `to_char(date_trunc('day', mv.created_at), 'YYYY-MM-DD')`
  if (period === 'week') format = `to_char(date_trunc('week', mv.created_at), 'IYYY-IW')`
  if (period === 'month') format = `to_char(date_trunc('month', mv.created_at), 'YYYY-MM')`

  let cond = '1=1'
  const params: any[] = []
  if (dateFrom) { cond += ` AND mv.created_at >= $${params.length+1}`; params.push(new Date(dateFrom)) }
  if (dateTo) { cond += ` AND mv.created_at <= $${params.length+1}`; params.push(new Date(dateTo)) }
  if (warehouse) { cond += ` AND w.code = $${params.length+1}`; params.push(warehouse) }
  if (materialCode) { cond += ` AND m.code = $${params.length+1}`; params.push(materialCode) }

  const selectGroup = groupBy === 'warehouse' ? `, w.code AS "warehouse"` : (groupBy === 'material' ? `, m.code AS "materialCode"` : '')
  const groupCols = groupBy === 'warehouse' ? ', 2' : (groupBy === 'material' ? ', 2' : '')
  const orderCols = groupCols ? `1 ASC, 2 ASC` : `1 ASC`

  const sql = `SELECT ${format} AS date${selectGroup},
            SUM(CASE WHEN mv.qty_change::numeric > 0 THEN mv.qty_change::numeric ELSE 0 END) AS "inQty",
            SUM(CASE WHEN mv.qty_change::numeric < 0 THEN -mv.qty_change::numeric ELSE 0 END) AS "outQty",
            SUM(mv.qty_change::numeric) AS "net"
     FROM stock_movements mv
     JOIN materials m ON m.id = mv.material_id
     JOIN warehouses w ON w.id = mv.warehouse_id
     WHERE ${cond}
     GROUP BY 1${groupCols}
     ORDER BY ${orderCols}`
  const rows = await AppDataSource.query(sql, params)

  const headerBase = ['date','inQty','outQty','net']
  const header = groupBy === 'warehouse' ? ['date','warehouse','inQty','outQty','net']
               : groupBy === 'material' ? ['date','materialCode','inQty','outQty','net']
               : headerBase
  const escape = (v: any) => '"' + String(v??'').replace(/"/g,'""') + '"'
  const csv = [header.join(',')].concat(rows.map((r:any)=> header.map(h=> escape(r[h])).join(','))).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  const fn = (req.query.filename as string | undefined) || 'movement-summary.csv'
  res.setHeader('Content-Disposition', `attachment; filename=\"${fn}\"`);
  res.send('\ufeff' + csv);
})

// ------------------- 共享导出模板（基于 app_settings） -------------------
type ExportTemplate = { name: string; keys: string[]; headerMap?: Record<string, string>; shared?: boolean; updatedAt?: string }

async function readTemplates(scope: string) {
  const key = `exportTemplates:${scope}`
  const rows = await AppDataSource.query('SELECT v FROM app_settings WHERE k = $1', [key])
  if (!rows?.length) return [] as ExportTemplate[]
  const v = rows[0]?.v
  if (!v) return []
  return (v.templates || v || []) as ExportTemplate[]
}
async function writeTemplates(scope: string, list: ExportTemplate[]) {
  const key = `exportTemplates:${scope}`
  const v = { templates: list, _ts: new Date().toISOString() }
  await AppDataSource.query(`INSERT INTO app_settings(k, v) VALUES($1, $2::jsonb)
    ON CONFLICT (k) DO UPDATE SET v = EXCLUDED.v, "updatedAt" = NOW()`, [key, JSON.stringify(v)])
}

// 列出共享模板（所有已登录角色可读）
router.get('/export-templates', async (req: Request, res: Response) => {
  const scope = (req.query.scope as string || '').trim()
  if (!scope) return res.status(400).json({ message: 'scope required' })
  const list = await readTemplates(scope)
  res.json(list)
})

// 新增/更新模板（ADMIN/OP）
router.post('/export-templates', requireRoles('ADMIN','OP'), async (req: Request, res: Response) => {
  const { scope, name, keys, headerMap } = req.body || {}
  if (!scope || !name || !Array.isArray(keys)) return res.status(400).json({ message: 'scope/name/keys required' })
  if (String(scope).length > 64 || String(name).length > 64) return res.status(400).json({ message: 'scope/name too long' })
  if (keys.length > 200) return res.status(400).json({ message: 'too many keys' })
  const list = await readTemplates(scope)
  const now = new Date().toISOString()
  const idx = list.findIndex(t => t.name === name)
  const item: ExportTemplate = { name, keys, headerMap: headerMap||{}, shared: true, updatedAt: now }
  if (idx >= 0) list[idx] = item; else list.push(item)
  await writeTemplates(scope, list)
  res.json({ ok: true })
})

// 删除模板（ADMIN/OP）
router.delete('/export-templates', requireRoles('ADMIN','OP'), async (req: Request, res: Response) => {
  const { scope, name } = req.body || {}
  if (!scope || !name) return res.status(400).json({ message: 'scope/name required' })
  const list = (await readTemplates(scope)).filter(t => t.name !== name)
  await writeTemplates(scope, list)
  res.json({ ok: true })
})

// 重命名模板（ADMIN/OP）
router.put('/export-templates/rename', requireRoles('ADMIN','OP'), async (req: Request, res: Response) => {
  const { scope, name, newName } = req.body || {}
  if (!scope || !name || !newName) return res.status(400).json({ message: 'scope/name/newName required' })
  const list = await readTemplates(scope)
  const idx = list.findIndex(t => t.name === name)
  if (idx < 0) return res.status(404).json({ message: 'not found' })
  list[idx].name = newName
  list[idx].updatedAt = new Date().toISOString()
  await writeTemplates(scope, list)
  res.json({ ok: true })
})

// 入库明细导出 CSV（按订单筛选条件展开为行）
router.get('/inbound-items.csv', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;
  const code = req.query.code as string | undefined;
  const qb = AppDataSource.getRepository(InboundOrder).createQueryBuilder('o')
    .leftJoin('o.items','it')
    .leftJoin('it.material','m')
    .select([
      'o.code AS "code"',
      'o.status AS "status"',
      'o.createdAt AS "createdAt"',
      'o.sourceType AS "sourceType"',
      'o.supplier AS "supplier"',
      'm.code AS "materialCode"',
      'it.qty AS "qty"',
      'it.batchNo AS "batchNo"',
      'it.expDate AS "expDate"',
    ]);
  if (status) qb.andWhere('o.status = :st', { st: status });
  if (code) qb.andWhere('o.code ILIKE :c', { c: `%${code}%` });
  if (dateFrom) qb.andWhere('o.createdAt >= :df', { df: new Date(dateFrom) });
  if (dateTo) qb.andWhere('o.createdAt <= :dt', { dt: new Date(dateTo) });
  const rows = await qb.orderBy('o.createdAt','DESC').addOrderBy('o.code','ASC').getRawMany();
  const header = ['code','status','createdAt','sourceType','supplier','materialCode','qty','batchNo','expDate'];
  const fmt = (v: any) => v instanceof Date ? v.toISOString() : v
  const escape = (v: any) => '"' + String(fmt(v)??'').replace(/"/g,'""') + '"';
  const csv = [header.join(',')].concat(rows.map((r:any)=> header.map(h=> escape(r[h])).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  const fn = (req.query.filename as string | undefined) || 'inbound-items.csv'
  res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
  res.send('\ufeff' + csv);
})

// 入库明细（JSON）便于前端按字段导出
router.get('/inbound-items', async (req: Request, res: Response) => {
  const status = req.query.status as string | undefined;
  const dateFrom = req.query.dateFrom as string | undefined;
  const dateTo = req.query.dateTo as string | undefined;
  const code = req.query.code as string | undefined;
  const qb = AppDataSource.getRepository(InboundOrder).createQueryBuilder('o')
    .leftJoin('o.items','it')
    .leftJoin('it.material','m')
    .select([
      'o.code AS "code"',
      'o.status AS "status"',
      'o.createdAt AS "createdAt"',
      'o.sourceType AS "sourceType"',
      'o.supplier AS "supplier"',
      'm.code AS "materialCode"',
      'it.qty AS "qty"',
      'it.batchNo AS "batchNo"',
      'it.expDate AS "expDate"',
    ]);
  if (status) qb.andWhere('o.status = :st', { st: status });
  if (code) qb.andWhere('o.code ILIKE :c', { c: `%${code}%` });
  if (dateFrom) qb.andWhere('o.createdAt >= :df', { df: new Date(dateFrom) });
  if (dateTo) qb.andWhere('o.createdAt <= :dt', { dt: new Date(dateTo) });
  const rows = await qb.orderBy('o.createdAt','DESC').addOrderBy('o.code','ASC').getRawMany();
  res.json(rows);
})

// POST /api/inbounds/draft 创建草稿（不动库存）
router.post('/inbounds/draft', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
  const { code, sourceType, supplier, arriveDate, items } = req.body || {}
  if (!code || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'code/items required' })

  await AppDataSource.transaction(async (mgr: EntityManager) => {
    const exist = await mgr.getRepository(InboundOrder).findOne({ where: { code } })
    if (exist) throw new Error('duplicate code')
    const order = mgr.getRepository(InboundOrder).create({ code, sourceType, supplier, arriveDate, status: 'DRAFT' })
    await mgr.getRepository(InboundOrder).save(order)
    for (const it of items) {
      const material = await mgr.getRepository(Material).findOne({ where: { code: it.materialCode } })
      if (!material) throw new Error(`material not found: ${it.materialCode}`)
      const inboundItem = mgr.getRepository(InboundItem).create({
        orderId: order.id,
        materialId: material.id,
        qty: String(it.qty),
        batchNo: it.batchNo || '',
        expDate: it.expDate || null,
        uprice: it.uprice ? String(it.uprice) : null,
      })
      await mgr.getRepository(InboundItem).save(inboundItem)
    }
    const saved = await mgr.getRepository(InboundOrder).findOne({ where: { id: order.id }, relations: ['items'] })
    res.status(201).json(saved)
  }).catch((e: any) => res.status(400).json({ message: e.message }))
})

// 更新入库草稿（替换明细）
router.put('/inbounds/:code', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
  const code = req.params.code
  const { sourceType, supplier, arriveDate, items } = req.body || {}
  await AppDataSource.transaction(async (mgr: EntityManager) => {
    const orderRepo = mgr.getRepository(InboundOrder)
    const itemRepo = mgr.getRepository(InboundItem)
    const order = await orderRepo.findOne({ where: { code } })
    if (!order) throw new Error('order not found')
    if (order.status !== 'DRAFT') throw new Error('invalid status')
    if (sourceType !== undefined) (order as any).sourceType = sourceType
    if (supplier !== undefined) (order as any).supplier = supplier
    if (arriveDate !== undefined) (order as any).arriveDate = arriveDate
    await orderRepo.save(order)
    if (Array.isArray(items)) {
      const oldItems = await itemRepo.find({ where: { orderId: order.id } })
      if (oldItems.length) await itemRepo.remove(oldItems)
      for (const it of items) {
        const material = await mgr.getRepository(Material).findOne({ where: { code: it.materialCode } })
        if (!material) throw new Error(`material not found: ${it.materialCode}`)
        const inboundItem = itemRepo.create({
          orderId: order.id,
          materialId: material.id,
          qty: String(it.qty),
          batchNo: it.batchNo || '',
          expDate: it.expDate || null,
          uprice: it.uprice ? String(it.uprice) : null,
        })
        await itemRepo.save(inboundItem)
      }
    }
    const saved = await orderRepo.findOne({ where: { id: order.id }, relations: ['items'] })
    res.json(saved)
  }).catch((e:any)=> res.status(400).json({ message: e.message }))
})

// POST /api/inbounds/:code/approve 审批（不动库存）
router.post('/inbounds/:code/approve', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
  const code = req.params.code
  const repo = AppDataSource.getRepository(InboundOrder)
  const order = await repo.findOne({ where: { code } })
  if (!order) return res.status(404).json({ message: 'order not found' })
  if (order.status !== 'DRAFT') return res.status(409).json({ message: 'invalid status' })
  order.status = 'APPROVED'
  await repo.save(order)
  res.json(order)
})

// POST /api/inbounds/:code/putaway 上架完成（此时入账库存）
router.post('/inbounds/:code/putaway', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
  const code = req.params.code
  await AppDataSource.transaction(async (mgr: EntityManager) => {
    const orderRepo = mgr.getRepository(InboundOrder)
    const itemRepo = mgr.getRepository(InboundItem)
    const stRepo = mgr.getRepository(Stock)
    const whRepo = mgr.getRepository(Warehouse)

    const order = await orderRepo.findOne({ where: { code } })
    if (!order) throw new Error('order not found')
    if (order.status !== 'APPROVED') throw new Error('invalid status')
    const items = await itemRepo.find({ where: { orderId: order.id } })
    const wh = await whRepo.findOne({ where: { code: 'WH1' } })
    if (!wh) throw new Error('warehouse not found')
    for (const it of items) {
      const stock = await stRepo.findOne({ where: { materialId: it.materialId, warehouseId: wh.id, batchNo: it.batchNo || '' } })
      if (!stock) {
        await stRepo.save(stRepo.create({
          materialId: it.materialId,
          warehouseId: wh.id,
          batchNo: it.batchNo || '',
          expDate: it.expDate || null,
          mfgDate: null,
          qtyOnHand: String(it.qty),
          qtyAllocated: '0',
          qtyInTransit: '0',
          locationId: undefined,
        }))
          // movement: inbound +qty
          await mgr.getRepository(StockMovement).save(
            mgr.getRepository(StockMovement).create({
              warehouseId: wh.id,
              materialId: it.materialId,
              batchNo: it.batchNo || '',
              qtyChange: String(it.qty),
              sourceType: 'INBOUND',
              sourceCode: order.code,
            })
          )
      } else {
        stock.qtyOnHand = String(Number(stock.qtyOnHand) + Number(it.qty))
        await stRepo.save(stock)
          // movement: inbound +qty
          await mgr.getRepository(StockMovement).save(
            mgr.getRepository(StockMovement).create({
              warehouseId: wh.id,
              materialId: it.materialId,
              batchNo: it.batchNo || '',
              qtyChange: String(it.qty),
              sourceType: 'INBOUND',
              sourceCode: order.code,
            })
          )
      }
    }
    order.status = 'PUTAWAY'
    await orderRepo.save(order)
    // 通知：入库完成
    const nRepo = mgr.getRepository(Notification)
    await nRepo.save(nRepo.create({ type: 'success', title: '入库完成', message: `入库单 ${order.code} 上架完成`, status: 'UNREAD' as any }))
  await recalcAlerts(mgr)
    const saved = await orderRepo.findOne({ where: { id: order.id }, relations: ['items'] })
    res.json(saved)
  }).catch((e: any) => res.status(400).json({ message: e.message }))
})

// 取消入库单（仅 DRAFT/APPROVED 可取消；已 PUTAWAY 不允许）
router.post('/inbounds/:code/cancel', requireRoles('ADMIN'), async (req: Request, res: Response) => {
  const code = req.params.code
  const repo = AppDataSource.getRepository(InboundOrder)
  const order = await repo.findOne({ where: { code } })
  if (!order) return res.status(404).json({ message: 'order not found' })
  if (order.status === 'PUTAWAY') return res.status(409).json({ message: 'already posted' })
  if (order.status === 'CANCELLED') return res.json(order)
  order.status = 'CANCELLED' as any
  await repo.save(order)
  res.json(order)
})

// POST /api/inbounds
router.post('/inbounds', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
  const { code, sourceType, supplier, arriveDate, items, warehouseCode } = req.body || {};
  if (!code || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'code/items required' });

  const matRepo = AppDataSource.getRepository(Material);
  const whRepo = AppDataSource.getRepository(Warehouse);
  const stRepo = AppDataSource.getRepository(Stock);
  const orderRepo = AppDataSource.getRepository(InboundOrder);
  const itemRepo = AppDataSource.getRepository(InboundItem);

  await AppDataSource.transaction(async (mgr: EntityManager) => {
    const exist = await mgr.getRepository(InboundOrder).findOne({ where: { code } });
    if (exist) throw new Error('duplicate code');

    const wh = await mgr.getRepository(Warehouse).findOne({ where: { code: warehouseCode || 'WH1' } });
    if (!wh) throw new Error('warehouse not found');

    const order = mgr.getRepository(InboundOrder).create({ code, sourceType, supplier, arriveDate, status: 'APPROVED' });
    await mgr.getRepository(InboundOrder).save(order);

    for (const it of items) {
      const material = await mgr.getRepository(Material).findOne({ where: { code: it.materialCode } });
      if (!material) throw new Error(`material not found: ${it.materialCode}`);

      const inboundItem = mgr.getRepository(InboundItem).create({
        orderId: order.id,
        materialId: material.id,
        qty: String(it.qty),
        batchNo: it.batchNo || '',
        expDate: it.expDate || null,
        uprice: it.uprice ? String(it.uprice) : null,
      });
      await mgr.getRepository(InboundItem).save(inboundItem);

      // upsert stock and add qty
      let stock = await mgr.getRepository(Stock).findOne({
        where: {
          materialId: material.id,
          warehouseId: wh.id,
          batchNo: it.batchNo || '',
        },
      })
      if (!stock) {
        stock = mgr.getRepository(Stock).create({
          materialId: material.id,
          warehouseId: wh.id,
          locationId: undefined,
          batchNo: it.batchNo || '',
          expDate: it.expDate || null,
          mfgDate: null,
          qtyOnHand: '0',
          qtyAllocated: '0',
          qtyInTransit: '0',
        })
      }
      stock.qtyOnHand = String(Number(stock.qtyOnHand) + Number(it.qty))
      await mgr.getRepository(Stock).save(stock)
      // movement: inbound +qty (即时入库)
      await mgr.getRepository(StockMovement).save(
        mgr.getRepository(StockMovement).create({
          warehouseId: wh.id,
          materialId: material.id,
          batchNo: it.batchNo || '',
          qtyChange: String(it.qty),
          sourceType: 'INBOUND',
          sourceCode: order.code,
        })
      )
    }
  const saved = await mgr.getRepository(InboundOrder).findOne({ where: { id: order.id }, relations: ['items'] })
  await mgr.getRepository(Notification).save({ type: 'success', title: '入库完成', message: `入库单 ${code} 完成`, status: 'UNREAD' as any })
  await recalcAlerts(mgr)
    res.status(201).json(saved)
  }).catch((e: any) => res.status(400).json({ message: e.message }))
})

        // ------------------- 出库单：列表与流转 -------------------
        // GET /api/outbounds 列表
        router.get('/outbounds', async (req: Request, res: Response) => {
          const page = +(req.query.page as string || 1);
          const pageSize = +(req.query.pageSize as string || 20);
          const status = req.query.status as string | undefined;
          const code = req.query.code as string | undefined;
          const dateFrom = req.query.dateFrom as string | undefined;
          const dateTo = req.query.dateTo as string | undefined;
          const repo = AppDataSource.getRepository(OutboundOrder);
          const qb = repo.createQueryBuilder('o').leftJoinAndSelect('o.items','it');
          if (status) qb.andWhere('o.status = :st', { st: status });
          if (code) qb.andWhere('o.code ILIKE :c', { c: `%${code}%` });
          if (dateFrom) qb.andWhere('o.createdAt >= :df', { df: new Date(dateFrom) });
          if (dateTo) qb.andWhere('o.createdAt <= :dt', { dt: new Date(dateTo) });
          qb.orderBy('o.createdAt','DESC').skip((page-1)*pageSize).take(pageSize);
          const [data, total] = await qb.getManyAndCount();
          res.json({ data, page: { page, pageSize, total } });
        })
  router.get('/outbounds.csv', async (req: Request, res: Response) => {
          const status = req.query.status as string | undefined;
          const code = req.query.code as string | undefined;
          const dateFrom = req.query.dateFrom as string | undefined;
          const dateTo = req.query.dateTo as string | undefined;
          const qb = AppDataSource.getRepository(OutboundOrder).createQueryBuilder('o');
          if (status) qb.andWhere('o.status = :st', { st: status });
          if (code) qb.andWhere('o.code ILIKE :c', { c: `%${code}%` });
          if (dateFrom) qb.andWhere('o.createdAt >= :df', { df: new Date(dateFrom) });
          if (dateTo) qb.andWhere('o.createdAt <= :dt', { dt: new Date(dateTo) });
          const rows = await qb.orderBy('o.createdAt','DESC').getMany();
          const header = ['code','purpose','status','createdAt']
          const fmt = (v: any) => v instanceof Date ? v.toISOString() : v
          const escape = (v: any) => '"' + String(fmt(v)??'').replace(/"/g,'""') + '"'
          const csv = [header.join(',')].concat(rows.map((r:any)=> header.map(h=> escape((r as any)[h])).join(','))).join('\n')
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          const fn = (req.query.filename as string | undefined) || 'outbounds.csv'
          res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
          res.send('\ufeff' + csv);
        })

        // 出库明细导出 CSV（按订单筛选条件展开为行）
  router.get('/outbound-items.csv', async (req: Request, res: Response) => {
          const status = req.query.status as string | undefined;
          const code = req.query.code as string | undefined;
          const dateFrom = req.query.dateFrom as string | undefined;
          const dateTo = req.query.dateTo as string | undefined;
          const qb = AppDataSource.getRepository(OutboundOrder).createQueryBuilder('o')
            .leftJoin('o.items','it')
            .leftJoin('it.material','m')
            .select([
              'o.code AS "code"',
              'o.status AS "status"',
              'o.createdAt AS "createdAt"',
              'o.purpose AS "purpose"',
              'm.code AS "materialCode"',
              'it.qty AS "qty"',
              'it.batchPolicy AS "batchPolicy"',
              'it.batchNo AS "batchNo"',
            ]);
          if (status) qb.andWhere('o.status = :st', { st: status });
          if (code) qb.andWhere('o.code ILIKE :c', { c: `%${code}%` });
          if (dateFrom) qb.andWhere('o.createdAt >= :df', { df: new Date(dateFrom) });
          if (dateTo) qb.andWhere('o.createdAt <= :dt', { dt: new Date(dateTo) });
          const rows = await qb.orderBy('o.createdAt','DESC').addOrderBy('o.code','ASC').getRawMany();
          const header = ['code','status','createdAt','purpose','materialCode','qty','batchPolicy','batchNo'];
          const fmt = (v: any) => v instanceof Date ? v.toISOString() : v
          const escape = (v: any) => '"' + String(fmt(v)??'').replace(/"/g,'""') + '"';
          const csv = [header.join(',')].concat(rows.map((r:any)=> header.map(h=> escape(r[h])).join(','))).join('\n');
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          const fn = (req.query.filename as string | undefined) || 'outbound-items.csv'
          res.setHeader('Content-Disposition', `attachment; filename="${fn}"`);
          res.send('\ufeff' + csv);
        })

        // 出库明细（JSON）
        router.get('/outbound-items', async (req: Request, res: Response) => {
          const status = req.query.status as string | undefined;
          const code = req.query.code as string | undefined;
          const dateFrom = req.query.dateFrom as string | undefined;
          const dateTo = req.query.dateTo as string | undefined;
          const qb = AppDataSource.getRepository(OutboundOrder).createQueryBuilder('o')
            .leftJoin('o.items','it')
            .leftJoin('it.material','m')
            .select([
              'o.code AS "code"',
              'o.status AS "status"',
              'o.createdAt AS "createdAt"',
              'o.purpose AS "purpose"',
              'm.code AS "materialCode"',
              'it.qty AS "qty"',
              'it.batchPolicy AS "batchPolicy"',
              'it.batchNo AS "batchNo"',
            ]);
          if (status) qb.andWhere('o.status = :st', { st: status });
          if (code) qb.andWhere('o.code ILIKE :c', { c: `%${code}%` });
          if (dateFrom) qb.andWhere('o.createdAt >= :df', { df: new Date(dateFrom) });
          if (dateTo) qb.andWhere('o.createdAt <= :dt', { dt: new Date(dateTo) });
          const rows = await qb.orderBy('o.createdAt','DESC').addOrderBy('o.code','ASC').getRawMany();
          res.json(rows);
        })

        // POST /api/outbounds/draft 创建草稿（不动库存）
  router.post('/outbounds/draft', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
          const { code, purpose, items } = req.body || {}
          if (!code || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'code/items required' })
          await AppDataSource.transaction(async (mgr: EntityManager) => {
            const exist = await mgr.getRepository(OutboundOrder).findOne({ where: { code } })
            if (exist) throw new Error('duplicate code')
            const order = mgr.getRepository(OutboundOrder).create({ code, purpose, status: 'DRAFT' })
            await mgr.getRepository(OutboundOrder).save(order)
            for (const it of items) {
              const material = await mgr.getRepository(Material).findOne({ where: { code: it.materialCode } })
              if (!material) throw new Error(`material not found: ${it.materialCode}`)
              const outItem = mgr.getRepository(OutboundItem).create({
                orderId: order.id,
                materialId: material.id,
                qty: String(it.qty),
                batchPolicy: (it.batchPolicy || 'SYSTEM'),
                batchNo: it.batchNo || null,
              })
              await mgr.getRepository(OutboundItem).save(outItem)
            }
            const saved = await mgr.getRepository(OutboundOrder).findOne({ where: { id: order.id }, relations: ['items'] })
            res.status(201).json(saved)
          }).catch((e: any) => res.status(400).json({ message: e.message }))
        })

        // 更新出库草稿（替换明细）
  router.put('/outbounds/:code', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
          const code = req.params.code
          const { purpose, items } = req.body || {}
          await AppDataSource.transaction(async (mgr: EntityManager) => {
            const orderRepo = mgr.getRepository(OutboundOrder)
            const itemRepo = mgr.getRepository(OutboundItem)
            const order = await orderRepo.findOne({ where: { code } })
            if (!order) throw new Error('order not found')
            if (order.status !== 'DRAFT') throw new Error('invalid status')
            if (purpose !== undefined) (order as any).purpose = purpose
            await orderRepo.save(order)
            if (Array.isArray(items)) {
              const oldItems = await itemRepo.find({ where: { orderId: order.id } })
              if (oldItems.length) await itemRepo.remove(oldItems)
              for (const it of items) {
                const material = await mgr.getRepository(Material).findOne({ where: { code: it.materialCode } })
                if (!material) throw new Error(`material not found: ${it.materialCode}`)
                const outItem = itemRepo.create({
                  orderId: order.id,
                  materialId: material.id,
                  qty: String(it.qty),
                  batchPolicy: (it.batchPolicy || 'SYSTEM'),
                  batchNo: it.batchNo || null,
                })
                await itemRepo.save(outItem)
              }
            }
            const saved = await orderRepo.findOne({ where: { id: order.id }, relations: ['items'] })
            res.json(saved)
          }).catch((e:any)=> res.status(400).json({ message: e.message }))
        })

        // POST /api/outbounds/:code/approve 审批（不动库存）
  router.post('/outbounds/:code/approve', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
          const code = req.params.code
          const repo = AppDataSource.getRepository(OutboundOrder)
          const order = await repo.findOne({ where: { code } })
          if (!order) return res.status(404).json({ message: 'order not found' })
          if (order.status !== 'DRAFT') return res.status(409).json({ message: 'invalid status' })
          order.status = 'APPROVED'
          await repo.save(order)
          res.json(order)
        })

  // POST /api/outbounds/:code/pick 拣货完成（此时扣减库存）
  router.post('/outbounds/:code/pick', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
          const code = req.params.code
          await AppDataSource.transaction(async (mgr: EntityManager) => {
            const orderRepo = mgr.getRepository(OutboundOrder)
            const itemRepo = mgr.getRepository(OutboundItem)
            const whRepo = mgr.getRepository(Warehouse)
            const stRepo = mgr.getRepository(Stock)
            const order = await orderRepo.findOne({ where: { code } })
            if (!order) throw new Error('order not found')
            if (order.status !== 'APPROVED') throw new Error('invalid status')
            const items = await itemRepo.find({ where: { orderId: order.id } })
            const wh = await whRepo.findOne({ where: { code: 'WH1' } })
            if (!wh) throw new Error('warehouse not found')

            for (const it of items) {
              let qtyToPick = Number(it.qty)
              if ((it.batchPolicy as any) === 'SPECIFIED' && it.batchNo) {
                const stock = await stRepo.findOne({ where: { materialId: it.materialId, warehouseId: wh.id, batchNo: it.batchNo } })
                if (!stock || Number(stock.qtyOnHand) < qtyToPick) throw new Error('insufficient stock for batch')
                stock.qtyOnHand = String(Number(stock.qtyOnHand) - qtyToPick)
                await stRepo.save(stock)
                // movement: outbound -qty
                await mgr.getRepository(StockMovement).save(
                  mgr.getRepository(StockMovement).create({
                    warehouseId: wh.id,
                    materialId: it.materialId,
                    batchNo: it.batchNo || '',
                    qtyChange: String(-qtyToPick),
                    sourceType: 'OUTBOUND',
                    sourceCode: order.code,
                  })
                )
              } else {
                const stocks = await stRepo.createQueryBuilder('s')
                  .where('s.material_id = :mid AND s.warehouse_id = :wid AND s.qty_on_hand > 0', { mid: it.materialId, wid: wh.id })
                  .orderBy('s.exp_date', 'ASC', 'NULLS LAST')
                  .addOrderBy('s.batch_no', 'ASC')
                  .getMany()
                for (const s of stocks) {
                  if (qtyToPick <= 0) break
                  const take = Math.min(Number(s.qtyOnHand), qtyToPick)
                  if (take > 0) {
                    s.qtyOnHand = String(Number(s.qtyOnHand) - take)
                    await stRepo.save(s)
                    // movement: outbound -take per batch
                    await mgr.getRepository(StockMovement).save(
                      mgr.getRepository(StockMovement).create({
                        warehouseId: wh.id,
                        materialId: it.materialId,
                        batchNo: s.batchNo || '',
                        qtyChange: String(-take),
                        sourceType: 'OUTBOUND',
                        sourceCode: order.code,
                      })
                    )
                    qtyToPick -= take
                  }
                }
                if (qtyToPick > 0) throw new Error('insufficient stock')
              }
            }
            order.status = 'PICKED'
            await orderRepo.save(order)
            await mgr.getRepository(Notification).save({ type: 'success', title: '出库完成', message: `出库单 ${order.code} 已拣货过账`, status: 'UNREAD' as any })
            await recalcAlerts(mgr)
            const saved = await orderRepo.findOne({ where: { id: order.id }, relations: ['items'] })
            res.json(saved)
          }).catch((e: any) => res.status(400).json({ message: e.message }))
        })

  // 兼容：原立即入/出库接口（创建并直接过账）

// 取消出库单（仅 DRAFT/APPROVED 可取消；PICKED 不允许）
router.post('/outbounds/:code/cancel', requireRoles('ADMIN'), async (req: Request, res: Response) => {
  const code = req.params.code
  const repo = AppDataSource.getRepository(OutboundOrder)
  const order = await repo.findOne({ where: { code } })
  if (!order) return res.status(404).json({ message: 'order not found' })
  if (order.status === 'PICKED') return res.status(409).json({ message: 'already posted' })
  if (order.status === 'CANCELLED') return res.json(order)
  order.status = 'CANCELLED' as any
  await repo.save(order)
  res.json(order)
})

// POST /api/adjustments  盘点/调整：把某批次库存调整到指定数量
router.post('/adjustments', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
  const { materialCode, warehouse, batchNo, targetQty, reason } = req.body || {}
  if (!materialCode || !warehouse || targetQty === undefined) {
    return res.status(400).json({ message: 'materialCode/warehouse/targetQty required' })
  }

  await AppDataSource.transaction(async (mgr: EntityManager) => {
    const mat = await mgr.getRepository(Material).findOne({ where: { code: materialCode } })
    if (!mat) throw new Error('material not found')
    const wh = await mgr.getRepository(Warehouse).findOne({ where: { code: warehouse } })
    if (!wh) throw new Error('warehouse not found')

    let stock = await mgr.getRepository(Stock).findOne({ where: { materialId: mat.id, warehouseId: wh.id, batchNo: batchNo || '' } })
    const before = Number(stock?.qtyOnHand || 0)
    const after = Number(targetQty)
    const delta = after - before

    if (!stock) {
      stock = mgr.getRepository(Stock).create({
        materialId: mat.id,
        warehouseId: wh.id,
        batchNo: batchNo || '',
        expDate: null,
        mfgDate: null,
        qtyOnHand: '0',
        qtyAllocated: '0',
        qtyInTransit: '0',
      })
    }
    stock.qtyOnHand = String(after)
    await mgr.getRepository(Stock).save(stock)

    const adj = mgr.getRepository(Adjustment).create({
      materialId: mat.id,
      warehouseId: wh.id,
      batchNo: batchNo || '',
      beforeQty: String(before),
      afterQty: String(after),
      delta: String(delta),
      reason: reason || null,
    })
    await mgr.getRepository(Adjustment).save(adj)
    // movement: adjustment delta (+/-)
    if (delta !== 0) {
      await mgr.getRepository(StockMovement).save(
        mgr.getRepository(StockMovement).create({
          warehouseId: wh.id,
          materialId: mat.id,
          batchNo: batchNo || '',
          qtyChange: String(delta),
          sourceType: 'ADJUST',
          sourceCode: (adj as any).id || null,
        })
      )
    }
  await recalcAlerts(mgr)
  res.status(201).json(adj)
  }).catch((e: any) => res.status(400).json({ message: e.message }))
})

// POST /api/outbounds
router.post('/outbounds', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
  const { code, purpose, items, warehouseCode } = req.body || {};
  if (!code || !Array.isArray(items) || items.length === 0) return res.status(400).json({ message: 'code/items required' });

  await AppDataSource.transaction(async (mgr: EntityManager) => {
    const exist = await mgr.getRepository(OutboundOrder).findOne({ where: { code } });
    if (exist) throw new Error('duplicate code');

    const wh = await mgr.getRepository(Warehouse).findOne({ where: { code: warehouseCode || 'WH1' } });
    if (!wh) throw new Error('warehouse not found');

  // 即时出库：直接扣减库存，并将订单状态置为 PICKED，避免后续再次拣货重复扣减
  const order = mgr.getRepository(OutboundOrder).create({ code, purpose, status: 'PICKED' });
    await mgr.getRepository(OutboundOrder).save(order);

    for (const it of items) {
      const material = await mgr.getRepository(Material).findOne({ where: { code: it.materialCode } });
      if (!material) throw new Error(`material not found: ${it.materialCode}`);

      // pick stock rows by policy
      const policy = (it.batchPolicy || 'SYSTEM') as 'SYSTEM' | 'SPECIFIED';
      let qtyToPick = Number(it.qty);
      const picked: Array<{ stockId: string; qty: number }> = [];

      if (policy === 'SPECIFIED') {
        const stock = await mgr.getRepository(Stock).findOne({ where: { materialId: material.id, warehouseId: wh.id, batchNo: it.batchNo || '' } });
        if (!stock || Number(stock.qtyOnHand) < qtyToPick) throw new Error('insufficient stock for batch');
        stock.qtyOnHand = String(Number(stock.qtyOnHand) - qtyToPick);
        await mgr.getRepository(Stock).save(stock);
        picked.push({ stockId: stock.id, qty: qtyToPick });
        // movement: outbound -qty (即时出库 指定批次)
        await mgr.getRepository(StockMovement).save(
          mgr.getRepository(StockMovement).create({
            warehouseId: wh.id,
            materialId: material.id,
            batchNo: it.batchNo || '',
            qtyChange: String(-qtyToPick),
            sourceType: 'OUTBOUND',
            sourceCode: order.code,
          })
        )
      } else {
        const stocks = await mgr.getRepository(Stock)
          .createQueryBuilder('s')
          .where('s.material_id = :mid AND s.warehouse_id = :wid AND s.qty_on_hand > 0', { mid: material.id, wid: wh.id })
          .orderBy('s.exp_date', 'ASC', 'NULLS LAST')
          .addOrderBy('s.batch_no', 'ASC')
          .getMany();
        for (const s of stocks) {
          if (qtyToPick <= 0) break;
          const take = Math.min(Number(s.qtyOnHand), qtyToPick);
          if (take > 0) {
            s.qtyOnHand = String(Number(s.qtyOnHand) - take);
            await mgr.getRepository(Stock).save(s);
            picked.push({ stockId: s.id, qty: take });
            qtyToPick -= take;
            // movement: outbound -take per batch (即时出库 FEFO)
            await mgr.getRepository(StockMovement).save(
              mgr.getRepository(StockMovement).create({
                warehouseId: wh.id,
                materialId: material.id,
                batchNo: s.batchNo || '',
                qtyChange: String(-take),
                sourceType: 'OUTBOUND',
                sourceCode: order.code,
              })
            )
          }
        }
        if (qtyToPick > 0) throw new Error('insufficient stock');
      }

      const outItem = mgr.getRepository(OutboundItem).create({
        orderId: order.id,
        materialId: material.id,
        qty: String(it.qty),
        batchPolicy: policy,
        batchNo: it.batchNo || null,
      });
      await mgr.getRepository(OutboundItem).save(outItem);
    }

  const saved = await mgr.getRepository(OutboundOrder).findOne({ where: { id: order.id }, relations: ['items'] });
    await mgr.getRepository(Notification).save({ type: 'success', title: '出库完成', message: `出库单 ${code} 完成`, status: 'UNREAD' as any })
  await recalcAlerts(mgr)
    res.status(201).json(saved);
  }).catch((e: any) => res.status(400).json({ message: e.message }));
});

// POST /api/transfers  移库/转移库存
router.post('/transfers', requireRoles('ADMIN', 'OP'), async (req: Request, res: Response) => {
  const { materialCode, qty, fromWarehouse, fromBatchNo, toWarehouse, toLocation } = req.body || {}
  if (!materialCode || !qty || !fromWarehouse || !toWarehouse) {
    return res.status(400).json({ message: 'materialCode/qty/fromWarehouse/toWarehouse required' })
  }

  await AppDataSource.transaction(async (mgr: EntityManager) => {
    const mat = await mgr.getRepository(Material).findOne({ where: { code: materialCode } })
    if (!mat) throw new Error('material not found')
    const fromWh = await mgr.getRepository(Warehouse).findOne({ where: { code: fromWarehouse } })
    if (!fromWh) throw new Error('from warehouse not found')
    const toWh = await mgr.getRepository(Warehouse).findOne({ where: { code: toWarehouse } })
    if (!toWh) throw new Error('to warehouse not found')

    // 1) 扣减来源库存（按 batch 指定，否则按 FEFO）
    let remaining = Number(qty)
    const picked: Array<{ id: string; take: number; batchNo: string | null; expDate: string | null }> = []
    if (fromBatchNo) {
      const s = await mgr.getRepository(Stock).findOne({ where: { materialId: mat.id, warehouseId: fromWh.id, batchNo: fromBatchNo } })
      if (!s || Number(s.qtyOnHand) < remaining) throw new Error('insufficient stock in source')
      s.qtyOnHand = String(Number(s.qtyOnHand) - remaining)
      await mgr.getRepository(Stock).save(s)
      picked.push({ id: s.id, take: remaining, batchNo: s.batchNo, expDate: s.expDate as any })
      // movement: transfer source -remaining
      await mgr.getRepository(StockMovement).save(
        mgr.getRepository(StockMovement).create({
          warehouseId: fromWh.id,
          materialId: mat.id,
          batchNo: s.batchNo || '',
          qtyChange: String(-remaining),
          sourceType: 'TRANSFER',
          sourceCode: null,
        })
      )
      remaining = 0
    } else {
      const rows = await mgr.getRepository(Stock)
        .createQueryBuilder('s')
        .where('s.material_id = :mid AND s.warehouse_id = :wid AND s.qty_on_hand > 0', { mid: mat.id, wid: fromWh.id })
        .orderBy('s.exp_date', 'ASC', 'NULLS LAST')
        .addOrderBy('s.batch_no', 'ASC')
        .getMany()
      for (const s of rows) {
        if (remaining <= 0) break
        const take = Math.min(Number(s.qtyOnHand), remaining)
        if (take > 0) {
          s.qtyOnHand = String(Number(s.qtyOnHand) - take)
          await mgr.getRepository(Stock).save(s)
          picked.push({ id: s.id, take, batchNo: s.batchNo, expDate: s.expDate as any })
          // movement: transfer source -take
          await mgr.getRepository(StockMovement).save(
            mgr.getRepository(StockMovement).create({
              warehouseId: fromWh.id,
              materialId: mat.id,
              batchNo: s.batchNo || '',
              qtyChange: String(-take),
              sourceType: 'TRANSFER',
              sourceCode: null,
            })
          )
          remaining -= take
        }
      }
      if (remaining > 0) throw new Error('insufficient stock in source')
    }

    // 2) 增加入目标库存（逐批对应）
    // 若提供 toLocation 且存在匹配库位，则将目标库存记录的 location 设为该库位
    let targetLocId: string | undefined = undefined
    if ((toLocation || '').trim()) {
      const loc = await mgr.getRepository(Location).createQueryBuilder('l')
        .where('l.warehouse_id = :wid AND l.code = :code', { wid: toWh.id, code: String(toLocation).trim() })
        .getOne()
      if (loc) targetLocId = loc.id
    }
    for (const p of picked) {
      let t = await mgr.getRepository(Stock).findOne({ where: { materialId: mat.id, warehouseId: toWh.id, batchNo: p.batchNo || '' } })
      if (!t) {
        t = mgr.getRepository(Stock).create({
          materialId: mat.id,
          warehouseId: toWh.id,
          locationId: targetLocId,
          batchNo: p.batchNo || '',
          expDate: (p.expDate as any) || null,
          mfgDate: null,
          qtyOnHand: '0',
          qtyAllocated: '0',
          qtyInTransit: '0',
        })
      }
      // 如果已有库存行但之前未设置库位且本次提供库位，则补充库位信息
      if (!t.locationId && targetLocId) t.locationId = targetLocId
      t.qtyOnHand = String(Number(t.qtyOnHand) + p.take)
      await mgr.getRepository(Stock).save(t)
      // movement: transfer target +take
      await mgr.getRepository(StockMovement).save(
        mgr.getRepository(StockMovement).create({
          warehouseId: toWh.id,
          materialId: mat.id,
          batchNo: p.batchNo || '',
          qtyChange: String(p.take),
          sourceType: 'TRANSFER',
          sourceCode: null,
        })
      )
    }

  await recalcAlerts(mgr)
  res.status(201).json({ ok: true, moved: Number(qty) })
  }).catch((e: any) => res.status(400).json({ message: e.message }))
})

// ---------- Notifications ----------
router.get('/notifications', async (req: Request, res: Response) => {
  const status = (req.query.status as string | undefined) || undefined;
  const type = (req.query.type as string | undefined) || undefined;
  const repo = AppDataSource.getRepository(Notification);
  const qb = repo.createQueryBuilder('n');
  if (status) qb.andWhere('n.status = :st', { st: status });
  if (type) qb.andWhere('n.type = :tp', { tp: type });
  qb.orderBy('n.createdAt','DESC');
  const rows = await qb.getMany();
  res.json(rows);
});
router.get('/notifications/unread-count', async (_req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Notification);
  const count = await repo.count({ where: { status: 'UNREAD' as any } });
  res.json({ count });
});
router.post('/notifications', requireRoles('ADMIN','OP'), async (req: Request, res: Response) => {
  const { type, title, message } = req.body || {};
  if (!type || !title) return res.status(400).json({ message: 'type/title required' });
  const repo = AppDataSource.getRepository(Notification);
  const n = repo.create({ type, title, message: message || null, status: 'UNREAD' as any });
  await repo.save(n);
  res.status(201).json(n);
});
router.post('/notifications/:id/read', async (req: Request, res: Response) => {
  const id = req.params.id;
  const repo = AppDataSource.getRepository(Notification);
  const n = await repo.findOne({ where: { id } });
  if (!n) return res.status(404).json({ message: 'not found' });
  n.status = 'READ' as any;
  await repo.save(n);
  res.json(n);
});
router.post('/notifications/mark-all-read', async (_req: Request, res: Response) => {
  const repo = AppDataSource.getRepository(Notification);
  await repo.createQueryBuilder().update(Notification).set({ status: 'READ' as any }).where('status = :st', { st: 'UNREAD' }).execute();
  res.json({ ok: true });
});

// 导出通知 CSV（支持 status、type 筛选）
router.get('/notifications.csv', async (req: Request, res: Response) => {
  const status = (req.query.status as string | undefined) || undefined;
  const type = (req.query.type as string | undefined) || undefined;
  const repo = AppDataSource.getRepository(Notification);
  const qb = repo.createQueryBuilder('n');
  if (status) qb.andWhere('n.status = :st', { st: status });
  if (type) qb.andWhere('n.type = :tp', { tp: type });
  const rows = await qb.orderBy('n.createdAt','DESC').getMany();
  const header = ['id','type','title','message','status','createdAt'];
  const fmt = (v: any) => v instanceof Date ? v.toISOString() : v
  const escape = (v: any) => '"' + String(fmt(v)??'').replace(/"/g,'""') + '"'
  const csv = [header.join(',')].concat(rows.map((r:any)=> header.map(h=> escape((r as any)[h])).join(','))).join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  const fn = (req.query.filename as string | undefined) || 'notifications.csv'
  res.setHeader('Content-Disposition', `attachment; filename="${fn}` + '"');
  res.send('\ufeff' + csv);
});

// ---------- Settings & Alerts ----------
// GET/PUT 阈值设置 { globalMinQty: number, expiryDays: number }
router.get('/settings/thresholds', async (_req: Request, res: Response) => {
  const row = await AppDataSource.query('SELECT v FROM app_settings WHERE k=$1', ['thresholds'])
  const v0 = row?.[0]?.v || { globalMinQty: 0, expiryDays: 30, slowDays: 60 }
  const v = { globalMinQty: Number(v0.globalMinQty||0), expiryDays: Number(v0.expiryDays||30), slowDays: Number(v0.slowDays||60) }
  res.json(v)
})
router.put('/settings/thresholds', requireRoles('ADMIN'), async (req: Request, res: Response) => {
  const { globalMinQty, expiryDays, slowDays } = req.body || {}
  const v = { globalMinQty: Number(globalMinQty||0), expiryDays: Number(expiryDays||30), slowDays: Number(slowDays||60) }
  await AppDataSource.query('INSERT INTO app_settings(k, v) VALUES($1,$2) ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v, "updatedAt"=NOW()', ['thresholds', v])
  res.json(v)
})
// 手动重算预警
router.post('/alerts/recalc', requireRoles('ADMIN','OP'), async (_req: Request, res: Response) => {
  await AppDataSource.transaction(async (mgr)=> {
    await recalcAlerts(mgr)
  })
  res.json({ ok: true })
})

async function recalcAlerts(mgr: EntityManager) {
  // 读取阈值
  const row = await mgr.query('SELECT v FROM app_settings WHERE k=$1', ['thresholds'])
  const { globalMinQty, expiryDays, slowDays } = row?.[0]?.v || { globalMinQty: 0, expiryDays: 30, slowDays: 60 }
  const nRepo = mgr.getRepository(Notification)
  // 低库存（按物料维度聚合）
  const lowRows = await mgr.query(`
    SELECT m.code AS material_code, COALESCE(SUM(s.qty_on_hand),0) AS qty
    FROM materials m
    LEFT JOIN stocks s ON s.material_id = m.id
    GROUP BY m.code
    HAVING COALESCE(SUM(s.qty_on_hand),0) < $1
  `, [globalMinQty])
  for (const r of lowRows) {
    const title = '库存预警'
    const message = `物料 ${r.material_code} 总在库 ${r.qty} 低于阈值 ${globalMinQty}`
    const exist = await nRepo.findOne({ where: { title, message, status: 'UNREAD' as any } as any })
    if (!exist) await nRepo.save(nRepo.create({ type: 'warning', title, message, status: 'UNREAD' as any }))
  }
  // 临期预警（到期日期在 N 天内且有库存）
  const soon = await mgr.query(`
    SELECT m.code AS material_code, s.batch_no, s.exp_date, s.qty_on_hand
    FROM stocks s
    JOIN materials m ON m.id = s.material_id
    WHERE s.exp_date IS NOT NULL AND s.qty_on_hand > 0 AND s.exp_date <= (CURRENT_DATE + INTERVAL '${expiryDays} days')
    ORDER BY s.exp_date ASC
  `)
  for (const r of soon) {
    const title = '临期预警'
    const message = `物料 ${r.material_code} 批次 ${r.batch_no} 将于 ${String(r.exp_date).slice(0,10)} 到期`
    const exist = await nRepo.findOne({ where: { title, message, status: 'UNREAD' as any } as any })
    if (!exist) await nRepo.save(nRepo.create({ type: 'warning', title, message, status: 'UNREAD' as any }))
  }
  // 滞销预警（slowDays 内无出库且当前有库存）
  if (slowDays && Number(slowDays) > 0) {
    const slowRows = await mgr.query(`
      SELECT DISTINCT m.code AS material_code
      FROM materials m
      JOIN stocks s ON s.material_id = m.id
      WHERE s.qty_on_hand > 0
      AND NOT EXISTS (
        SELECT 1
        FROM outbound_items oi
        JOIN outbound_orders oo ON oo.id = oi.order_id
        WHERE oi.material_id = m.id AND oo."createdAt" >= (CURRENT_DATE - INTERVAL '${Number(slowDays)} days')
      )
    `)
    for (const r of slowRows) {
      const title = '滞销预警'
      const message = `物料 ${r.material_code} 在近 ${Number(slowDays)} 天无出库且仍有库存`
      const exist = await nRepo.findOne({ where: { title, message, status: 'UNREAD' as any } as any })
      if (!exist) await nRepo.save(nRepo.create({ type: 'warning', title, message, status: 'UNREAD' as any }))
    }
  }
}

// GET /api/orders/:code
router.get('/orders/:code', async (req: Request, res: Response) => {
  const code = req.params.code;
  const inb = await AppDataSource.getRepository(InboundOrder).findOne({ where: { code }, relations: ['items','items.material'] });
  if (inb) return res.json({ type: 'INBOUND', order: inb });
  const outb = await AppDataSource.getRepository(OutboundOrder).findOne({ where: { code }, relations: ['items','items.material'] });
  if (outb) return res.json({ type: 'OUTBOUND', order: outb });
  return res.status(404).json({ message: 'order not found' });
});

// ---------- Metrics (Dashboard) ----------
router.get('/metrics/dashboard', async (_req: Request, res: Response) => {
  const data = await getDashboardMetrics(AppDataSource)
  res.json(data)
})

// Line chart trends: last N days inbound/outbound order counts
router.get('/metrics/trends', async (req: Request, res: Response) => {
  const days = Math.max(1, Math.min(90, Number((req.query.days as any) || 14)))
  const dateFrom = (req.query.dateFrom as string | undefined)
  const dateTo = (req.query.dateTo as string | undefined)
  const materialCode = (req.query.materialCode as string | undefined)
  const data = await svcGetTrends(AppDataSource, { days, dateFrom, dateTo, materialCode })
  res.json(data)
})

// Trends CSV export
router.get('/metrics/trends.csv', async (req: Request, res: Response) => {
  const days = Math.max(1, Math.min(90, Number((req.query.days as any) || 14)))
  const dateFrom = (req.query.dateFrom as string | undefined)
  const dateTo = (req.query.dateTo as string | undefined)
  const materialCode = (req.query.materialCode as string | undefined)

  let cond = ''
  const params: any[] = []
  if (dateFrom) { cond += (cond? ' AND ': '') + `o."createdAt" >= $${params.length+1}`; params.push(new Date(dateFrom)) }
  if (dateTo) { cond += (cond? ' AND ': '') + `o."createdAt" <= $${params.length+1}`; params.push(new Date(dateTo)) }
  if (!cond) {
    cond = `o."createdAt" >= CURRENT_DATE - INTERVAL '${days - 1} days'`
  }

  let inRows: any[] = []
  let outRows: any[] = []
  if (materialCode) {
    inRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS d, COUNT(DISTINCT o.id)::int AS c
       FROM inbound_orders o
       JOIN inbound_items it ON it.order_id = o.id
       JOIN materials m ON m.id = it.material_id
       WHERE ${cond} AND m.code = $${params.length+1}
       GROUP BY 1 ORDER BY 1`,
      [...params, materialCode]
    )
    outRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS d, COUNT(DISTINCT o.id)::int AS c
       FROM outbound_orders o
       JOIN outbound_items it ON it.order_id = o.id
       JOIN materials m ON m.id = it.material_id
       WHERE ${cond} AND m.code = $${params.length+1}
       GROUP BY 1 ORDER BY 1`,
      [...params, materialCode]
    )
  } else {
    inRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS d, COUNT(1)::int AS c
       FROM inbound_orders o
       WHERE ${cond}
       GROUP BY 1 ORDER BY 1`,
      params
    )
    outRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS d, COUNT(1)::int AS c
       FROM outbound_orders o
       WHERE ${cond}
       GROUP BY 1 ORDER BY 1`,
      params
    )
  }

  // build date list
  const dates: string[] = []
  const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)
  if (dateFrom || dateTo) {
    const start = dateFrom ? new Date(dateFrom) : new Date()
    const end = dateTo ? new Date(dateTo) : new Date()
    const d0 = new Date(start.getFullYear(), start.getMonth(), start.getDate())
    const d1 = new Date(end.getFullYear(), end.getMonth(), end.getDate())
    for (let d = d0; d <= d1; d = new Date(d.getFullYear(), d.getMonth(), d.getDate()+1)) {
      dates.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`)
    }
  } else {
    const today = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const dt = new Date(today)
      dt.setDate(today.getDate() - i)
      dates.push(`${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`)
    }
  }
  const mapIn = new Map(inRows.map((r: any) => [r.d, r.c]))
  const mapOut = new Map(outRows.map((r: any) => [r.d, r.c]))
  const data = dates.map(d => ({ date: d, inbounds: mapIn.get(d) || 0, outbounds: mapOut.get(d) || 0 }))
  const header = ['date','inbounds','outbounds']
  const csv = [header.join(',')].concat(data.map(r=> `${r.date},${r.inbounds},${r.outbounds}`)).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  {
    const fn = (req.query.filename as string | undefined) || 'trends.csv'
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`)
  }
  res.send('\ufeff' + csv)
})

// Bar chart: lowest total stocks by material (top N)
router.get('/metrics/low-stocks', async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(20, Number(req.query.limit || 5)))
  const warehouse = (req.query.warehouse as string | undefined)
  const q = (req.query.q as string | undefined)
  const rows = await svcGetLowStocks(AppDataSource, { limit, warehouse, q })
  return res.json(rows)
})

router.get('/metrics/low-stocks.csv', async (req: Request, res: Response) => {
  const limit = Math.max(1, Math.min(100, Number(req.query.limit || 10)))
  const warehouse = (req.query.warehouse as string | undefined)
  const q = (req.query.q as string | undefined)
  const rows: any[] = await svcGetLowStocks(AppDataSource, { limit, warehouse, q })
  const header = ['materialCode','qty']
  const csv = [header.join(',')].concat(rows.map((r:any)=> `${r.materialcode||r.materialCode},${r.qty}`)).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  {
    const fn = (req.query.filename as string | undefined) || 'low-stocks.csv'
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`)
  }
  res.send('\ufeff' + csv)
})

// Weekly trends (last N weeks)
router.get('/metrics/weekly', async (req: Request, res: Response) => {
  const weeks = Math.max(1, Math.min(52, Number(req.query.weeks || 12)))
  const dateFrom = (req.query.dateFrom as string | undefined)
  const dateTo = (req.query.dateTo as string | undefined)
  const materialCode = (req.query.materialCode as string | undefined)
  let cond = ''
  const params: any[] = []
  if (dateFrom) { cond += (cond? ' AND ': '') + `o."createdAt" >= $${params.length+1}`; params.push(new Date(dateFrom)) }
  if (dateTo) { cond += (cond? ' AND ': '') + `o."createdAt" <= $${params.length+1}`; params.push(new Date(dateTo)) }
  if (!cond) {
    cond = `o."createdAt" >= date_trunc('week', CURRENT_DATE) - INTERVAL '${weeks - 1} weeks'`
  }
  let inRows: any[] = []
  let outRows: any[] = []
  if (materialCode) {
    inRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(DISTINCT o.id)::int AS c
       FROM inbound_orders o
       JOIN inbound_items it ON it.order_id = o.id
       JOIN materials m ON m.id = it.material_id
       WHERE ${cond} AND m.code = $${params.length+1}
       GROUP BY 1 ORDER BY 1`,
      [...params, materialCode]
    )
    outRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(DISTINCT o.id)::int AS c
       FROM outbound_orders o
       JOIN outbound_items it ON it.order_id = o.id
       JOIN materials m ON m.id = it.material_id
       WHERE ${cond} AND m.code = $${params.length+1}
       GROUP BY 1 ORDER BY 1`,
      [...params, materialCode]
    )
  } else {
    inRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(1)::int AS c
       FROM inbound_orders o
       WHERE ${cond}
       GROUP BY 1 ORDER BY 1`,
      params
    )
    outRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(1)::int AS c
       FROM outbound_orders o
       WHERE ${cond}
       GROUP BY 1 ORDER BY 1`,
      params
    )
  }
  const mapIn = new Map(inRows.map((r:any)=> [r.w, r.c]))
  const mapOut = new Map(outRows.map((r:any)=> [r.w, r.c]))
  const keys = Array.from(new Set([...inRows.map((r:any)=> r.w), ...outRows.map((r:any)=> r.w)])).sort()
  const data = keys.map(k => ({ week: k, inbounds: mapIn.get(k) || 0, outbounds: mapOut.get(k) || 0 }))
  res.json({ weeks, data })
})

router.get('/metrics/weekly.csv', async (req: Request, res: Response) => {
  const weeks = Math.max(1, Math.min(52, Number(req.query.weeks || 12)))
  const dateFrom = (req.query.dateFrom as string | undefined)
  const dateTo = (req.query.dateTo as string | undefined)
  const materialCode = (req.query.materialCode as string | undefined)
  let cond = ''
  const params: any[] = []
  if (dateFrom) { cond += (cond? ' AND ': '') + `o."createdAt" >= $${params.length+1}`; params.push(new Date(dateFrom)) }
  if (dateTo) { cond += (cond? ' AND ': '') + `o."createdAt" <= $${params.length+1}`; params.push(new Date(dateTo)) }
  if (!cond) {
    cond = `o."createdAt" >= date_trunc('week', CURRENT_DATE) - INTERVAL '${weeks - 1} weeks'`
  }
  let inRows: any[] = []
  let outRows: any[] = []
  if (materialCode) {
    inRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(DISTINCT o.id)::int AS c
       FROM inbound_orders o
       JOIN inbound_items it ON it.order_id = o.id
       JOIN materials m ON m.id = it.material_id
       WHERE ${cond} AND m.code = $${params.length+1}
       GROUP BY 1 ORDER BY 1`,
      [...params, materialCode]
    )
    outRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(DISTINCT o.id)::int AS c
       FROM outbound_orders o
       JOIN outbound_items it ON it.order_id = o.id
       JOIN materials m ON m.id = it.material_id
       WHERE ${cond} AND m.code = $${params.length+1}
       GROUP BY 1 ORDER BY 1`,
      [...params, materialCode]
    )
  } else {
    inRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(1)::int AS c
       FROM inbound_orders o
       WHERE ${cond}
       GROUP BY 1 ORDER BY 1`,
      params
    )
    outRows = await AppDataSource.query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(1)::int AS c
       FROM outbound_orders o
       WHERE ${cond}
       GROUP BY 1 ORDER BY 1`,
      params
    )
  }
  const header = ['week','inbounds','outbounds']
  const mapIn = new Map(inRows.map((r:any)=> [r.w, r.c]))
  const mapOut = new Map(outRows.map((r:any)=> [r.w, r.c]))
  const keys = Array.from(new Set([...inRows.map((r:any)=> r.w), ...outRows.map((r:any)=> r.w)])).sort()
  const rows = keys.map(k=> ({ week: k, inbounds: mapIn.get(k) || 0, outbounds: mapOut.get(k) || 0 }))
  const csv = [header.join(',')].concat(rows.map(r=> `${r.week},${r.inbounds},${r.outbounds}`)).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  {
    const fn = (req.query.filename as string | undefined) || 'weekly-trends.csv'
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`)
  }
  res.send('\ufeff' + csv)
})

// Compare trends: multi-material daily trends
router.get('/metrics/trends/compare', async (req: Request, res: Response) => {
  const materials = (req.query.materials as string || '').split(',').map(s=> s.trim()).filter(Boolean).slice(0, 5)
  if (!materials.length) return res.json({ days: 0, dates: [], series: [] })
  const days = Math.max(1, Math.min(60, Number((req.query.days as any) || 14)))
  const dateFrom = (req.query.dateFrom as string | undefined)
  const dateTo = (req.query.dateTo as string | undefined)
  const base = await svcGetTrends(AppDataSource, { days, dateFrom, dateTo })
  const series = [] as any[]
  for (const code of materials) {
    const t = await svcGetTrends(AppDataSource, { days, dateFrom, dateTo, materialCode: code })
    series.push({ materialCode: code, data: t.data })
  }
  res.json({ days: base.days, dates: base.data.map(d=> d.date), series })
})

router.get('/metrics/trends/compare.csv', async (req: Request, res: Response) => {
  const materials = (req.query.materials as string || '').split(',').map(s=> s.trim()).filter(Boolean).slice(0, 5)
  const days = Math.max(1, Math.min(60, Number((req.query.days as any) || 14)))
  const dateFrom = (req.query.dateFrom as string | undefined)
  const dateTo = (req.query.dateTo as string | undefined)
  const base = await svcGetTrends(AppDataSource, { days, dateFrom, dateTo })
  const dates = base.data.map(d=> d.date)
  const header = ['date'].concat(materials.map(m=> `in_${m}`)).concat(materials.map(m=> `out_${m}`))
  const rows: string[] = [header.join(',')]
  const seriesData: Record<string, { in: Map<string, number>; out: Map<string, number> }> = {}
  for (const code of materials) {
    const t = await svcGetTrends(AppDataSource, { days, dateFrom, dateTo, materialCode: code })
    seriesData[code] = { in: new Map(t.data.map((r:any)=> [r.date, r.inbounds])), out: new Map(t.data.map((r:any)=> [r.date, r.outbounds])) }
  }
  for (const d of dates) {
    const inCols = materials.map(m=> String(seriesData[m]?.in.get(d) ?? 0))
    const outCols = materials.map(m=> String(seriesData[m]?.out.get(d) ?? 0))
    rows.push([d, ...inCols, ...outCols].join(','))
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8')
  {
    const fn = (req.query.filename as string | undefined) || 'trends-compare.csv'
    res.setHeader('Content-Disposition', `attachment; filename="${fn}"`)
  }
  res.send('\ufeff' + rows.join('\n'))
})

// ---------- Global Search ----------
// GET /api/search?q=keyword
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string || '').trim()
  if (!q) return res.json({ materials: [], orders: [], batches: [] })
  const like = `%${q}%`
  // materials by code/name/spec
  const mats = await AppDataSource.query(`
    SELECT code, name, spec, uom FROM materials
    WHERE code ILIKE $1 OR name ILIKE $1 OR spec ILIKE $1
    ORDER BY code ASC LIMIT 20
  `, [like])
  // orders by code match (inbound/outbound)
  const inOrders = await AppDataSource.query(`SELECT code, 'INBOUND' AS type FROM inbound_orders WHERE code ILIKE $1 ORDER BY code DESC LIMIT 10`, [like])
  const outOrders = await AppDataSource.query(`SELECT code, 'OUTBOUND' AS type FROM outbound_orders WHERE code ILIKE $1 ORDER BY code DESC LIMIT 10`, [like])
  const orders = [...inOrders, ...outOrders]
  // batches by batch_no match in stocks
  const batches = await AppDataSource.query(`
    SELECT DISTINCT s.batch_no AS batchNo, m.code AS materialCode, s.exp_date AS expDate
    FROM stocks s JOIN materials m ON m.id = s.material_id
    WHERE s.batch_no ILIKE $1
    ORDER BY batchNo ASC LIMIT 20
  `, [like])
  res.json({ materials: mats, orders, batches })
})

// 开发环境快速种子：创建 WH1 仓库和一个示例物料 M001
router.post('/seed/dev', async (_req: Request, res: Response) => {
  const whRepo = AppDataSource.getRepository(Warehouse);
  const mRepo = AppDataSource.getRepository(Material);
  const uRepo = AppDataSource.getRepository(User);
  const sRepo = AppDataSource.getRepository(Supplier);
  const lRepo = AppDataSource.getRepository(Location);
  const nRepo = AppDataSource.getRepository(Notification);
  let wh = await whRepo.findOne({ where: { code: 'WH1' } });
  if (!wh) wh = await whRepo.save(whRepo.create({ code: 'WH1', name: '主仓' }));
  // 默认库位
  const ensureLocation = async (warehouseId: string, code: string, zone?: string) => {
    let l = await lRepo.findOne({ where: { warehouseId, code } });
    if (!l) {
      l = lRepo.create({ warehouseId, code, zone: zone || null as any, enabled: true });
      await lRepo.save(l);
    }
    return l;
  };
  await ensureLocation(wh.id, 'A1', 'A区');
  await ensureLocation(wh.id, 'A2', 'A区');
  await ensureLocation(wh.id, 'B1', 'B区');
  let m = await mRepo.findOne({ where: { code: 'M001' } });
  if (!m) m = await mRepo.save(mRepo.create({ code: 'M001', name: '示例物料', uom: 'PCS', isBatch: true, shelfLifeDays: 365 }));
  // seed users
  const ensureUser = async (username: string, role: 'ADMIN'|'OP'|'VIEWER') => {
    let u = await uRepo.findOne({ where: { username } })
    if (!u) {
      const passwordHash = await bcrypt.hash('123456', 10)
      u = uRepo.create({ username, passwordHash, role, enabled: true })
      await uRepo.save(u)
    }
    return { username, role }
  }
  const users = [
    await ensureUser('admin', 'ADMIN'),
    await ensureUser('op', 'OP'),
    await ensureUser('viewer', 'VIEWER'),
  ]
  // seed suppliers
  const ensureSupplier = async (code: string, name: string) => {
    let s = await sRepo.findOne({ where: { code } });
    if (!s) {
      s = sRepo.create({ code, name, contact: null, enabled: true });
      await sRepo.save(s);
    }
    return s;
  };
  const suppliers = [
    await ensureSupplier('S001', '供应商A'),
    await ensureSupplier('S002', '供应商B'),
  ];
  const notifCount = await nRepo.count();
  if (notifCount === 0) {
    await nRepo.save(nRepo.create({ type: 'warning', title: '库存预警', message: 'M001 某批次将于30天后到期', status: 'UNREAD' as any }));
    await nRepo.save(nRepo.create({ type: 'success', title: '入库完成', message: '演示入库单已上架', status: 'UNREAD' as any }));
  }
  res.json({ warehouse: wh, material: m, users, suppliers })
});

export default router;
