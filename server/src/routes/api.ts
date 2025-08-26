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
import bcrypt from 'bcrypt';
// no external csv lib; build simple CSV manually

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
router.get('/stocks.csv', async (_req: Request, res: Response) => {
  const stockRepo = AppDataSource.getRepository(Stock);
  const rows = await stockRepo.createQueryBuilder('s')
    .leftJoinAndSelect('s.material','m')
    .leftJoinAndSelect('s.warehouse','w')
    .leftJoinAndSelect('s.location','l')
    .orderBy('m.code','ASC').addOrderBy('w.code','ASC').getMany();
  const data = rows.map((r: Stock) => ({
    materialCode: r.material.code,
    warehouse: r.warehouse.code,
    location: r.location?.code || '',
    batchNo: r.batchNo,
    expDate: r.expDate,
    qtyOnHand: r.qtyOnHand,
    qtyAllocated: r.qtyAllocated,
  }));
  const header = ['materialCode','warehouse','location','batchNo','expDate','qtyOnHand','qtyAllocated'];
  const escape = (v: any) => {
    const s = (v===null||v===undefined)?'':String(v)
    return '"' + s.replace(/"/g,'""') + '"'
  }
  const csv = [header.join(',')].concat(data.map(r=> header.map(h=> escape((r as any)[h])).join(','))).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="stocks.csv"');
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
router.get('/inbounds.csv', async (_req: Request, res: Response) => {
  const rows = await AppDataSource.getRepository(InboundOrder).createQueryBuilder('o').orderBy('o.createdAt','DESC').getMany();
  const header = ['code','sourceType','supplier','status','createdAt']
  const escape = (v: any) => '"' + String(v??'').replace(/"/g,'""') + '"'
  const csv = [header.join(',')].concat(rows.map((r:any)=> header.map(h=> escape((r as any)[h])).join(','))).join('\n')
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="inbounds.csv"');
  res.send('\ufeff' + csv);
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
      } else {
        stock.qtyOnHand = String(Number(stock.qtyOnHand) + Number(it.qty))
        await stRepo.save(stock)
      }
    }
    order.status = 'PUTAWAY'
    await orderRepo.save(order)
    // 通知：入库完成
    const nRepo = mgr.getRepository(Notification)
    await nRepo.save(nRepo.create({ type: 'success', title: '入库完成', message: `入库单 ${order.code} 上架完成`, status: 'UNREAD' as any }))
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
    }
    const saved = await mgr.getRepository(InboundOrder).findOne({ where: { id: order.id }, relations: ['items'] })
    await mgr.getRepository(Notification).save({ type: 'success', title: '入库完成', message: `入库单 ${code} 完成`, status: 'UNREAD' as any })
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
        router.get('/outbounds.csv', async (_req: Request, res: Response) => {
          const rows = await AppDataSource.getRepository(OutboundOrder).createQueryBuilder('o').orderBy('o.createdAt','DESC').getMany();
          const header = ['code','purpose','status','createdAt']
          const escape = (v: any) => '"' + String(v??'').replace(/"/g,'""') + '"'
          const csv = [header.join(',')].concat(rows.map((r:any)=> header.map(h=> escape((r as any)[h])).join(','))).join('\n')
          res.setHeader('Content-Type', 'text/csv; charset=utf-8');
          res.setHeader('Content-Disposition', 'attachment; filename="outbounds.csv"');
          res.send('\ufeff' + csv);
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
                    qtyToPick -= take
                  }
                }
                if (qtyToPick > 0) throw new Error('insufficient stock')
              }
            }
            order.status = 'PICKED'
            await orderRepo.save(order)
            await mgr.getRepository(Notification).save({ type: 'success', title: '出库完成', message: `出库单 ${order.code} 已拣货过账`, status: 'UNREAD' as any })
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
          remaining -= take
        }
      }
      if (remaining > 0) throw new Error('insufficient stock in source')
    }

    // 2) 增加入目标库存（逐批对应）
    for (const p of picked) {
      let t = await mgr.getRepository(Stock).findOne({ where: { materialId: mat.id, warehouseId: toWh.id, batchNo: p.batchNo || '' } })
      if (!t) {
        t = mgr.getRepository(Stock).create({
          materialId: mat.id,
          warehouseId: toWh.id,
          locationId: undefined,
          batchNo: p.batchNo || '',
          expDate: (p.expDate as any) || null,
          mfgDate: null,
          qtyOnHand: '0',
          qtyAllocated: '0',
          qtyInTransit: '0',
        })
      }
      t.qtyOnHand = String(Number(t.qtyOnHand) + p.take)
      await mgr.getRepository(Stock).save(t)
    }

    res.status(201).json({ ok: true, moved: Number(qty) })
  }).catch((e: any) => res.status(400).json({ message: e.message }))
})

// ---------- Notifications ----------
router.get('/notifications', async (req: Request, res: Response) => {
  const status = (req.query.status as string | undefined) || undefined;
  const repo = AppDataSource.getRepository(Notification);
  const qb = repo.createQueryBuilder('n');
  if (status) qb.andWhere('n.status = :st', { st: status });
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

// GET /api/orders/:code
router.get('/orders/:code', async (req: Request, res: Response) => {
  const code = req.params.code;
  const inb = await AppDataSource.getRepository(InboundOrder).findOne({ where: { code }, relations: ['items'] });
  if (inb) return res.json({ type: 'INBOUND', order: inb });
  const outb = await AppDataSource.getRepository(OutboundOrder).findOne({ where: { code }, relations: ['items'] });
  if (outb) return res.json({ type: 'OUTBOUND', order: outb });
  return res.status(404).json({ message: 'order not found' });
});

// 开发环境快速种子：创建 WH1 仓库和一个示例物料 M001
router.post('/seed/dev', async (_req: Request, res: Response) => {
  const whRepo = AppDataSource.getRepository(Warehouse);
  const mRepo = AppDataSource.getRepository(Material);
  const uRepo = AppDataSource.getRepository(User);
  const sRepo = AppDataSource.getRepository(Supplier);
  const nRepo = AppDataSource.getRepository(Notification);
  let wh = await whRepo.findOne({ where: { code: 'WH1' } });
  if (!wh) wh = await whRepo.save(whRepo.create({ code: 'WH1', name: '主仓' }));
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
