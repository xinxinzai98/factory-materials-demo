/*
 Validate numeric columns in CSV are numeric-parsable (no thousands separators, etc.).
 Endpoints: stocks.csv (qtyOnHand, qtyAllocated, qtyAvailable)
 Usage: API_KEY=dev-api-key tsx src/scripts/export-number-format.ts
*/

const API = process.env.API_BASE || 'http://localhost:8080/api'
const API_KEY = process.env.API_KEY || 'dev-api-key'

async function req(path: string, asText = false) {
  const url = `${API}${path}`
  const res = await fetch(url, { headers: { 'X-API-Key': API_KEY } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`)
  return asText ? res.text() : res.json()
}

function parseCsv(text: string): { header: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter(Boolean)
  const parseLine = (line: string): string[] => {
    const out: string[] = []
    const re = /"((?:[^"]|"")*)"(?:,|$)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) out.push(m[1].replace(/""/g, '"'))
    return out
  }
  const header = lines[0]?.split(',').map(h=>h.trim()) || []
  const rows = lines.slice(1).map(parseLine)
  return { header, rows }
}

function assert(cond: any, msg: string) { if (!cond) throw new Error('Assertion failed: ' + msg) }

function isNumberLike(v: string) {
  if (v === '' || v === null || v === undefined) return false
  return /^-?\d+(?:\.\d+)?$/.test(v)
}

async function checkStocks() {
  const csv = await req('/stocks.csv', true) as string
  const { header, rows } = parseCsv(csv)
  const cols = ['qtyOnHand','qtyAllocated','qtyAvailable']
  const idxs = cols.map(c=> header.indexOf(c))
  idxs.forEach((i, k)=> assert(i>=0, `stocks.csv header missing ${cols[k]}`))
  const sample = rows.slice(0, 10)
  for (const r of sample) {
    cols.forEach((c, k)=> { const v = r[idxs[k]]; assert(isNumberLike(v), `stocks.csv ${c} not numeric: ${v}`) })
  }
  console.log('[num] stocks.csv numeric columns OK')
}

async function main() {
  await checkStocks()
  console.log('export-number-format: PASS')
}

main().catch((e)=> { console.error('export-number-format: FAIL\n', e); process.exit(1) })
