/*
 Minimal assertion tests for metrics service.
 Run with: npm run test:metrics (uses tsx)
*/
import { DataSource } from 'typeorm'
import { getDashboardMetrics, getTrends, getWeeklyTrends, getLowStocks } from '../services/metrics.js'

function assert(cond: any, msg: string) {
  if (!cond) throw new Error('Assertion failed: ' + msg)
}

async function main() {
  // Prepare a transient DataSource using the app's configured connection.
  // We assume an env-backed TypeORM config via ormconfig or data-source module.
  let ds: DataSource
  try {
    const mod = await import('../data-source.js')
    ds = await (mod as any).AppDataSource.initialize()
  } catch (e) {
    throw new Error('无法初始化数据源，请确保 server 端可用并导出 data-source: ' + String(e))
  }

  try {
    const dash = await getDashboardMetrics(ds)
    assert(typeof dash.materialsCount === 'number', 'materialsCount 是数字')
    assert(typeof dash.soonToExpireBatches === 'number', 'soonToExpireBatches 是数字')
    assert(typeof dash.lowStockMaterials === 'number', 'lowStockMaterials 是数字')
    assert(typeof dash.slowMaterials === 'number', 'slowMaterials 是数字')
    assert(dash.expiryDays > 0 && dash.slowDays > 0, '阈值应为正数')

    const t14 = await getTrends(ds, { days: 14 })
    assert(t14.data.length === 14, '默认 14 天趋势长度正确')
    for (const r of t14.data) {
      assert(typeof r.inbounds === 'number' && typeof r.outbounds === 'number', '趋势数值为数字')
    }

    const tMat = await getTrends(ds, { days: 7, materialCode: 'DUMMY' })
    assert(tMat.data.length === 7, '物料筛选长度正确')

  const w = await getWeeklyTrends(ds, { weeks: 8 })
    assert(w.data.length <= 8, '周维度返回不超过 8 个桶')

  const lows = await getLowStocks(ds, { limit: 5 })
  assert(Array.isArray(lows), '低库存列表为数组')

    console.log('metrics-tests: PASS')
  } finally {
    if (ds && ds.isInitialized) await ds.destroy()
  }
}

main().catch(e => {
  console.error('metrics-tests: FAIL\n', e)
  process.exit(1)
})
