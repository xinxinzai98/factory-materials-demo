/*
 Validate export format consistency for date fields.
 - Ensure createdAt in CSV exports is ISO-like (contains 'T'), since we use toISOString.
 - Endpoints covered: inbounds.csv, inbound-items.csv, outbounds.csv, outbound-items.csv, notifications.csv
 Usage: API_KEY=dev-api-key tsx src/scripts/export-format.ts
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
  if (lines.length === 0) return { header: [], rows: [] }
  const parseLine = (line: string): string[] => {
    const out: string[] = []
    const re = /"((?:[^"]|"")*)"(?:,|$)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(line))) {
      out.push(m[1].replace(/""/g, '"'))
    }
    return out
  }
  const header = lines[0].split(',').map((h)=> h.trim())
  const rows = lines.slice(1).map(parseLine)
  return { header, rows }
}

function assert(cond: any, msg: string) {
  if (!cond) throw new Error('Assertion failed: ' + msg)
}

function isIsoLike(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(v)
}

async function checkCreatedAt(path: string) {
  const csv = await req(path, true) as string
  const { header, rows } = parseCsv(csv)
  const idx = header.indexOf('createdAt')
  assert(idx >= 0, `${path} header missing createdAt`)
  const samples = rows.slice(0, 5)
  for (const r of samples) {
    const v = r[idx]
    assert(v && isIsoLike(v), `${path} createdAt not ISO-like: ${v}`)
  }
  console.log(`[format] ${path} createdAt OK`)
}

async function main() {
  await checkCreatedAt('/inbounds.csv')
  await checkCreatedAt('/inbound-items.csv')
  await checkCreatedAt('/outbounds.csv')
  await checkCreatedAt('/outbound-items.csv')
  await checkCreatedAt('/notifications.csv')
  console.log('export-format: PASS')
}

main().catch((e)=> { console.error('export-format: FAIL\n', e); process.exit(1) })
