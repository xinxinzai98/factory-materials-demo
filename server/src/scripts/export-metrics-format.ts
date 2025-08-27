// Quick sanity checks for metrics CSV endpoints: filename override + headers
import assert from 'node:assert'

const base = process.env.API_BASE || 'http://localhost:8080/api'

async function getText(url: string) {
  const res = await fetch(url, { headers: { 'X-API-Key': process.env.API_KEY || 'dev-api-key' } as any })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.text()
}

function parseHeader(csv: string) {
  const firstLine = csv.split(/\r?\n/)[0].replace(/^\ufeff/, '')
  return firstLine.split(',')
}

async function main() {
  // trends.csv
  {
    const fn = `trends-test-${Date.now()}.csv`
    const csv = await getText(`${base}/metrics/trends.csv?days=7&filename=${encodeURIComponent(fn)}`)
    const header = parseHeader(csv)
    assert.deepStrictEqual(header, ['date','inbounds','outbounds'], 'trends.csv header mismatch')
  }
  // weekly-trends.csv
  {
    const fn = `weekly-test-${Date.now()}.csv`
    const csv = await getText(`${base}/metrics/weekly.csv?weeks=4&filename=${encodeURIComponent(fn)}`)
    const header = parseHeader(csv)
    assert.deepStrictEqual(header, ['week','inbounds','outbounds'], 'weekly.csv header mismatch')
  }
  // low-stocks.csv
  {
    const fn = `low-stocks-test-${Date.now()}.csv`
    const csv = await getText(`${base}/metrics/low-stocks.csv?limit=3&filename=${encodeURIComponent(fn)}`)
    const header = parseHeader(csv)
    assert.deepStrictEqual(header, ['materialCode','qty'], 'low-stocks.csv header mismatch')
  }
  // trends-compare.csv
  {
    const fn = `trends-compare-test-${Date.now()}.csv`
    const csv = await getText(`${base}/metrics/trends/compare.csv?materials=M001,M002&days=7&filename=${encodeURIComponent(fn)}`)
    const header = parseHeader(csv)
    // header: date, in_M001, in_M002, out_M001, out_M002
    assert.strictEqual(header[0], 'date', 'compare.csv first column should be date')
    assert.ok(header.slice(1).every(h=> /^in_|^out_/.test(h)), 'compare.csv series columns invalid')
  }
  // health OK if reached here
  console.log('export-metrics-format: PASS')
}

main().catch(err=> { console.error(err); process.exit(1) })
