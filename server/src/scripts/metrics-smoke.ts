// 轻量级冒烟测试：验证指标与报表接口是否可用
// 使用方法：先启动后端（npm run dev 或部署环境），然后在 server 目录执行：npm run smoke:metrics

const API = process.env.API_BASE || 'http://localhost:8080/api'

async function req(path: string) {
  const url = `${API}${path}`
  const res = await fetch(url, { headers: { 'X-API-Key': process.env.API_KEY || 'dev-api-key' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`)
  const txt = await res.text()
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return JSON.parse(txt)
  return txt
}

async function main() {
  console.log('[smoke] metrics/dashboard')
  const dash = await req('/metrics/dashboard')
  console.log('  materialsCount:', dash.materialsCount, 'stocksQtyOnHand:', dash.stocksQtyOnHand)

  console.log('[smoke] metrics/trends (30d)')
  const t = await req('/metrics/trends?days=30')
  console.log('  days:', t.days, 'points:', (t.data||[]).length)

  console.log('[smoke] metrics/weekly (12w)')
  const w = await req('/metrics/weekly?weeks=12')
  console.log('  weeks:', w.weeks, 'points:', (w.data||[]).length)

  console.log('[smoke] metrics/low-stocks (top10)')
  const ls = await req('/metrics/low-stocks?limit=10')
  console.log('  rows:', Array.isArray(ls)? ls.length : 0)

  console.log('[smoke] metrics/trends.csv export')
  const tcsv = await req('/metrics/trends.csv?days=7')
  console.log('  csv length:', (tcsv as string).length)

  console.log('[smoke] metrics/weekly.csv export')
  const wcsv = await req('/metrics/weekly.csv?weeks=4')
  console.log('  csv length:', (wcsv as string).length)

  console.log('[smoke] metrics/low-stocks.csv export')
  const lcsv = await req('/metrics/low-stocks.csv?limit=5')
  console.log('  csv length:', (lcsv as string).length)

  console.log('OK')
}

main().catch((e) => { console.error('SMOKE FAILED:', e); process.exit(1) })
