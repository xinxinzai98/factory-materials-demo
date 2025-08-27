import { DataSource, EntityManager } from 'typeorm'

type DB = DataSource | EntityManager

export async function getThresholds(db: DB) {
  const row = await (db as any).query('SELECT v FROM app_settings WHERE k=$1', ['thresholds'])
  const v0 = row?.[0]?.v || { globalMinQty: 0, expiryDays: 30, slowDays: 60 }
  return {
    globalMinQty: Number(v0.globalMinQty || 0),
    expiryDays: Number(v0.expiryDays || 30),
    slowDays: Number(v0.slowDays || 60),
  }
}

export async function getDashboardMetrics(db: DB) {
  const { globalMinQty, expiryDays, slowDays } = await getThresholds(db)
  const materialsCount = (await (db as any).query('SELECT COUNT(1)::int AS cnt FROM materials'))?.[0]?.cnt || 0
  const stocksQtyOnHand = Number((await (db as any).query('SELECT COALESCE(SUM(qty_on_hand),0) AS sum FROM stocks'))?.[0]?.sum || 0)
  const soonToExpireBatches = (await (db as any).query(`
    SELECT COUNT(1)::int AS cnt
    FROM stocks s
    WHERE s.exp_date IS NOT NULL AND s.qty_on_hand > 0 AND s.exp_date <= (CURRENT_DATE + INTERVAL '${expiryDays} days')
  `))?.[0]?.cnt || 0
  const inboundsToday = (await (db as any).query(`SELECT COUNT(1)::int AS cnt FROM inbound_orders WHERE "createdAt" >= CURRENT_DATE`))?.[0]?.cnt || 0
  const outboundsToday = (await (db as any).query(`SELECT COUNT(1)::int AS cnt FROM outbound_orders WHERE "createdAt" >= CURRENT_DATE`))?.[0]?.cnt || 0
  const unreadNotifications = (await (db as any).query(`SELECT COUNT(1)::int AS cnt FROM notifications WHERE status='UNREAD'`))?.[0]?.cnt || 0
  const lowStockMaterials = (await (db as any).query(
    `SELECT COUNT(1)::int AS cnt FROM (
      SELECT m.id, COALESCE(SUM(s.qty_on_hand),0) AS qty
      FROM materials m LEFT JOIN stocks s ON s.material_id = m.id
      GROUP BY m.id
    ) t WHERE t.qty < $1`, [Number(globalMinQty||0)]
  ))?.[0]?.cnt || 0
  const sd = Number(slowDays||60)
  const slowMaterials = (await (db as any).query(`
    SELECT COUNT(*)::int AS cnt FROM (
      SELECT DISTINCT m.id
      FROM materials m
      JOIN stocks s ON s.material_id = m.id
      WHERE s.qty_on_hand > 0
    ) has_stock
    WHERE has_stock.id NOT IN (
      SELECT DISTINCT oi.material_id
      FROM outbound_items oi
      JOIN outbound_orders oo ON oo.id = oi.order_id
      WHERE oo."createdAt" >= NOW() - INTERVAL '${sd} days'
    )
  `))?.[0]?.cnt || 0
  return { materialsCount, stocksQtyOnHand, soonToExpireBatches, inboundsToday, outboundsToday, unreadNotifications, expiryDays, globalMinQty, slowDays: sd, lowStockMaterials, slowMaterials }
}

export async function getTrends(db: DB, params: { days?: number; dateFrom?: string; dateTo?: string; materialCode?: string }) {
  const days = Math.max(1, Math.min(90, Number(params.days || 14)))
  const { dateFrom, dateTo, materialCode } = params
  let cond = ''
  const ps: any[] = []
  if (dateFrom) { cond += (cond? ' AND ': '') + `o."createdAt" >= $${ps.length+1}`; ps.push(new Date(dateFrom)) }
  if (dateTo) { cond += (cond? ' AND ': '') + `o."createdAt" <= $${ps.length+1}`; ps.push(new Date(dateTo)) }
  if (!cond) cond = `o."createdAt" >= CURRENT_DATE - INTERVAL '${days - 1} days'`
  let inRows: any[] = []
  let outRows: any[] = []
  if (materialCode) {
    inRows = await (db as any).query(
      `SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS d, COUNT(DISTINCT o.id)::int AS c
       FROM inbound_orders o
       JOIN inbound_items it ON it.order_id = o.id
       JOIN materials m ON m.id = it.material_id
       WHERE ${cond} AND m.code = $${ps.length+1}
       GROUP BY 1 ORDER BY 1`,
      [...ps, materialCode]
    )
    outRows = await (db as any).query(
      `SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS d, COUNT(DISTINCT o.id)::int AS c
       FROM outbound_orders o
       JOIN outbound_items it ON it.order_id = o.id
       JOIN materials m ON m.id = it.material_id
       WHERE ${cond} AND m.code = $${ps.length+1}
       GROUP BY 1 ORDER BY 1`,
      [...ps, materialCode]
    )
  } else {
    inRows = await (db as any).query(
      `SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS d, COUNT(1)::int AS c FROM inbound_orders o WHERE ${cond} GROUP BY 1 ORDER BY 1`, ps)
    outRows = await (db as any).query(
      `SELECT to_char(date_trunc('day', o."createdAt"), 'YYYY-MM-DD') AS d, COUNT(1)::int AS c FROM outbound_orders o WHERE ${cond} GROUP BY 1 ORDER BY 1`, ps)
  }
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
  return { days, data }
}

export async function getWeeklyTrends(db: DB, params: { weeks?: number; dateFrom?: string; dateTo?: string; materialCode?: string }) {
  const weeks = Math.max(1, Math.min(52, Number(params.weeks || 12)))
  const { dateFrom, dateTo, materialCode } = params
  let cond = ''
  const ps: any[] = []
  if (dateFrom) { cond += (cond? ' AND ': '') + `o."createdAt" >= $${ps.length+1}`; ps.push(new Date(dateFrom)) }
  if (dateTo) { cond += (cond? ' AND ': '') + `o."createdAt" <= $${ps.length+1}`; ps.push(new Date(dateTo)) }
  if (!cond) cond = `o."createdAt" >= date_trunc('week', CURRENT_DATE) - INTERVAL '${weeks - 1} weeks'`
  let inRows: any[] = []
  let outRows: any[] = []
  if (materialCode) {
    inRows = await (db as any).query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(DISTINCT o.id)::int AS c
       FROM inbound_orders o
       JOIN inbound_items it ON it.order_id = o.id
       JOIN materials m ON m.id = it.material_id
       WHERE ${cond} AND m.code = $${ps.length+1}
       GROUP BY 1 ORDER BY 1`,
      [...ps, materialCode]
    )
    outRows = await (db as any).query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(DISTINCT o.id)::int AS c
       FROM outbound_orders o
       JOIN outbound_items it ON it.order_id = o.id
       JOIN materials m ON m.id = it.material_id
       WHERE ${cond} AND m.code = $${ps.length+1}
       GROUP BY 1 ORDER BY 1`,
      [...ps, materialCode]
    )
  } else {
    inRows = await (db as any).query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(1)::int AS c FROM inbound_orders o WHERE ${cond} GROUP BY 1 ORDER BY 1`, ps)
    outRows = await (db as any).query(
      `SELECT to_char(date_trunc('week', o."createdAt"), 'IYYY-IW') AS w, COUNT(1)::int AS c FROM outbound_orders o WHERE ${cond} GROUP BY 1 ORDER BY 1`, ps)
  }
  const mapIn = new Map(inRows.map((r:any)=> [r.w, r.c]))
  const mapOut = new Map(outRows.map((r:any)=> [r.w, r.c]))
  const keys = Array.from(new Set([...inRows.map((r:any)=> r.w), ...outRows.map((r:any)=> r.w)])).sort()
  const data = keys.map(k => ({ week: k, inbounds: mapIn.get(k) || 0, outbounds: mapOut.get(k) || 0 }))
  return { weeks, data }
}

export async function getLowStocks(db: DB, params: { limit?: number; warehouse?: string; q?: string }) {
  const limit = Math.max(1, Math.min(100, Number(params.limit || 10)))
  const like = `%${(params.q || '').trim()}%`
  if (params.warehouse) {
    return await (db as any).query(`
      SELECT m.code AS materialCode, COALESCE(SUM(CASE WHEN w.code = $1 THEN s.qty_on_hand ELSE 0 END),0) AS qty
      FROM materials m
      LEFT JOIN stocks s ON s.material_id = m.id
      LEFT JOIN warehouses w ON w.id = s.warehouse_id
      WHERE ($2 = '%%' OR m.code ILIKE $2 OR m.name ILIKE $2)
      GROUP BY m.code
      ORDER BY COALESCE(SUM(CASE WHEN w.code = $1 THEN s.qty_on_hand ELSE 0 END),0) ASC
      LIMIT $3
    `, [params.warehouse, like, limit])
  } else {
    return await (db as any).query(`
      SELECT m.code AS materialCode, COALESCE(SUM(s.qty_on_hand),0) AS qty
      FROM materials m LEFT JOIN stocks s ON s.material_id = m.id
      WHERE ($1 = '%%' OR m.code ILIKE $1 OR m.name ILIKE $1)
      GROUP BY m.code
      ORDER BY COALESCE(SUM(s.qty_on_hand),0) ASC
      LIMIT $2
    `, [like, limit])
  }
}
