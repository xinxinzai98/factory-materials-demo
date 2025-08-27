/*
 Export fields parity check between CSV and JSON endpoints.
 - Stocks: ensure JSON has all CSV columns (materialCode, warehouse, location, batchNo, expDate, qtyOnHand, qtyAllocated, qtyAvailable)
 - Inbounds list/detail and Outbounds list/detail: ensure JSON rows include the CSV header columns.
 Usage: API_KEY=dev-api-key tsx src/scripts/export-parity.ts
*/

const API = process.env.API_BASE || 'http://localhost:8080/api'
const API_KEY = process.env.API_KEY || 'dev-api-key'

async function req(path: string, asText = false) {
  const url = `${API}${path}`
  const res = await fetch(url, { headers: { 'X-API-Key': API_KEY } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`)
  return asText ? res.text() : res.json()
}

function parseCsvHeader(text: string): string[] {
  const firstLine = text.split(/\r?\n/)[0] || ''
  // Our CSV writes values always quoted; headers are unquoted simple names without commas.
  return firstLine.split(',').map((h)=> h.trim())
}

function assert(cond: any, msg: string) {
  if (!cond) throw new Error('Assertion failed: ' + msg)
}

async function checkStocks() {
  const csv = await req('/stocks.csv', true) as string
  const header = parseCsvHeader(csv)
  const json = await req('/stocks') as any[]
  const sample = json[0]
  const must = header // all CSV columns must exist in JSON rows
  if (sample) {
    for (const k of must) assert(Object.prototype.hasOwnProperty.call(sample, k), `stocks JSON missing key: ${k}`)
  }
  console.log('[parity] stocks OK - header:', header.join(','))
}

async function checkInbounds() {
  const listCsv = await req('/inbounds.csv', true) as string
  const listHeader = parseCsvHeader(listCsv)
  const listJson = await req('/inbounds?page=1&pageSize=5') as any
  const listSample = (listJson?.data||[])[0]
  if (listSample) for (const k of listHeader) assert(k in listSample, `inbounds list JSON missing: ${k}`)
  console.log('[parity] inbounds list OK - header:', listHeader.join(','))

  const detCsv = await req('/inbound-items.csv', true) as string
  const detHeader = parseCsvHeader(detCsv)
  const detJson = await req('/inbound-items') as any[]
  const detSample = detJson[0]
  if (detSample) for (const k of detHeader) assert(k in detSample, `inbound-items JSON missing: ${k}`)
  console.log('[parity] inbound-items OK - header:', detHeader.join(','))
}

async function checkOutbounds() {
  const listCsv = await req('/outbounds.csv', true) as string
  const listHeader = parseCsvHeader(listCsv)
  const listJson = await req('/outbounds?page=1&pageSize=5') as any
  const listSample = (listJson?.data||[])[0]
  if (listSample) for (const k of listHeader) assert(k in listSample, `outbounds list JSON missing: ${k}`)
  console.log('[parity] outbounds list OK - header:', listHeader.join(','))

  const detCsv = await req('/outbound-items.csv', true) as string
  const detHeader = parseCsvHeader(detCsv)
  const detJson = await req('/outbound-items') as any[]
  const detSample = detJson[0]
  if (detSample) for (const k of detHeader) assert(k in detSample, `outbound-items JSON missing: ${k}`)
  console.log('[parity] outbound-items OK - header:', detHeader.join(','))
}

async function main() {
  await checkStocks()
  await checkInbounds()
  await checkOutbounds()
  console.log('export-parity: PASS')
}

main().catch((e)=> { console.error('export-parity: FAIL\n', e); process.exit(1) })
