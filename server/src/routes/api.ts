import { Router, Request, Response } from 'express';
import { AppDataSource } from '../data-source.js';
import { EntityManager } from 'typeorm';
import { Material } from '../entities/Material.js';
import { Stock } from '../entities/Stock.js';
import { InboundOrder } from '../entities/InboundOrder.js';
import { OutboundOrder } from '../entities/OutboundOrder.js';
import { authGuard } from '../middleware/auth.js';
import { Warehouse } from '../entities/Warehouse.js';
import { Location } from '../entities/Location.js';
import { InboundItem } from '../entities/InboundItem.js';
import { OutboundItem } from '../entities/OutboundItem.js';
import { Adjustment } from '../entities/Adjustment.js';

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
router.post('/materials', async (req: Request, res: Response) => {
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
router.post('/warehouses', async (req: Request, res: Response) => {
  const { code, name, address, enabled } = req.body || {};
  if (!code || !name) return res.status(400).json({ message: 'code/name required' });
  const repo = AppDataSource.getRepository(Warehouse);
  const exist = await repo.findOne({ where: { code } });
  if (exist) return res.status(409).json({ message: 'warehouse code exists' });
  const w = repo.create({ code, name, address, enabled: enabled ?? true });
  await repo.save(w);
  res.status(201).json(w);
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

// ------------------- 入库单：列表与流转 -------------------
// GET /api/inbounds 列表
router.get('/inbounds', async (req: Request, res: Response) => {
  const page = +(req.query.page as string || 1)
  const pageSize = +(req.query.pageSize as string || 20)
  const repo = AppDataSource.getRepository(InboundOrder)
  const [data, total] = await repo.findAndCount({
    order: { createdAt: 'DESC' as any },
    skip: (page - 1) * pageSize,
    take: pageSize,
    relations: ['items'],
  })
  res.json({ data, page: { page, pageSize, total } })
})

// POST /api/inbounds/draft 创建草稿（不动库存）
router.post('/inbounds/draft', async (req: Request, res: Response) => {
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
router.post('/inbounds/:code/approve', async (req: Request, res: Response) => {
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
router.post('/inbounds/:code/putaway', async (req: Request, res: Response) => {
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
    const saved = await orderRepo.findOne({ where: { id: order.id }, relations: ['items'] })
    res.json(saved)
  }).catch((e: any) => res.status(400).json({ message: e.message }))
})

// POST /api/inbounds
router.post('/inbounds', async (req: Request, res: Response) => {
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

      // upsert stock
      let stock = await mgr.getRepository(Stock).findOne({
        where: {
          materialId: material.id,
          warehouseId: wh.id,
          batchNo: it.batchNo || '',
        },
      });
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
        });
      }
    }
    const saved = await mgr.getRepository(InboundOrder).findOne({ where: { id: order.id }, relations: ['items'] })
    res.status(201).json(saved)
  }).catch((e: any) => res.status(400).json({ message: e.message }))
})

        // ------------------- 出库单：列表与流转 -------------------
        // GET /api/outbounds 列表
        router.get('/outbounds', async (req: Request, res: Response) => {
          const page = +(req.query.page as string || 1)
          const pageSize = +(req.query.pageSize as string || 20)
          const repo = AppDataSource.getRepository(OutboundOrder)
          const [data, total] = await repo.findAndCount({
            order: { createdAt: 'DESC' as any },
            skip: (page - 1) * pageSize,
            take: pageSize,
            relations: ['items'],
          })
          res.json({ data, page: { page, pageSize, total } })
        })

        // POST /api/outbounds/draft 创建草稿（不动库存）
        router.post('/outbounds/draft', async (req: Request, res: Response) => {
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
        router.post('/outbounds/:code/approve', async (req: Request, res: Response) => {
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
        router.post('/outbounds/:code/pick', async (req: Request, res: Response) => {
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
            const saved = await orderRepo.findOne({ where: { id: order.id }, relations: ['items'] })
            res.json(saved)
          }).catch((e: any) => res.status(400).json({ message: e.message }))
        })

  // 兼容：原立即入/出库接口（创建并直接过账）

// POST /api/adjustments  盘点/调整：把某批次库存调整到指定数量
router.post('/adjustments', async (req: Request, res: Response) => {
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
router.post('/outbounds', async (req: Request, res: Response) => {
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
    res.status(201).json(saved);
  }).catch((e: any) => res.status(400).json({ message: e.message }));
});

// POST /api/transfers  移库/转移库存
router.post('/transfers', async (req: Request, res: Response) => {
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
  let wh = await whRepo.findOne({ where: { code: 'WH1' } });
  if (!wh) wh = await whRepo.save(whRepo.create({ code: 'WH1', name: '主仓' }));
  let m = await mRepo.findOne({ where: { code: 'M001' } });
  if (!m) m = await mRepo.save(mRepo.create({ code: 'M001', name: '示例物料', uom: 'PCS', isBatch: true, shelfLifeDays: 365 }));
  res.json({ warehouse: wh, material: m });
});

export default router;
