// Sanity checks for movements CSV endpoints: filename override + headers + period/groupBy
import assert from 'node:assert'

const base = process.env.API_BASE || 'http://localhost:8080/api'
const headers = { 'X-API-Key': process.env.API_KEY || 'dev-api-key' }

async function getText(url: string) {
  const res = await fetch(url, { headers: headers as any })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.text()
}

function parseHeader(csv: string) {
  const firstLine = csv.split(/\r?\n/)[0].replace(/^\ufeff/, '')
  return firstLine.split(',')
}

async function main() {
  // 1) movements.csv header
  {
    const fn = `movements-${Date.now()}.csv`
    const csv = await getText(`${base}/movements.csv?limit=10&filename=${encodeURIComponent(fn)}`)
    const header = parseHeader(csv)
    assert.deepStrictEqual(header, ['createdAt','warehouse','materialCode','batchNo','qtyChange','sourceType','sourceCode'])
  }

  // 2) movement-summary.csv daily overall
  {
    const fn = `mv-sum-${Date.now()}.csv`
    const csv = await getText(`${base}/movements/summary.csv?period=day&filename=${encodeURIComponent(fn)}`)
    const header = parseHeader(csv)
    assert.deepStrictEqual(header, ['date','inQty','outQty','net'])
  }

  // 3) weekly by warehouse
  {
    const csv = await getText(`${base}/movements/summary.csv?period=week&groupBy=warehouse`)
    const header = parseHeader(csv)
    assert.deepStrictEqual(header, ['date','warehouse','inQty','outQty','net'])
  }

  // 4) monthly by material
  {
    const csv = await getText(`${base}/movements/summary.csv?period=month&groupBy=material`)
    const header = parseHeader(csv)
    assert.deepStrictEqual(header, ['date','materialCode','inQty','outQty','net'])
  }

  console.log('export-movements-format: PASS')
}

main().catch(err=> { console.error(err); process.exit(1) })
