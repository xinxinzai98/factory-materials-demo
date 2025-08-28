// 从 NDJSON 批量导入共享模板（幂等 upsert）
// 用法：API_KEY=dev-api-key tsx src/scripts/export-templates-load.ts < templates.ndjson

const API = process.env.API_BASE || 'http://localhost:8080/api'
const API_KEY = process.env.API_KEY || 'dev-api-key'

async function upsert(tpl: any) {
  const body = JSON.stringify({ scope: tpl.scope, name: tpl.name, keys: tpl.keys, headerMap: tpl.headerMap||{} })
  const res = await fetch(`${API}/export-templates`, {
    method: 'POST',
    headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
    body,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
}

async function main() {
  const chunks: Buffer[] = []
  for await (const c of process.stdin) chunks.push(Buffer.from(c))
  const text = Buffer.concat(chunks).toString('utf8')
  const lines = text.split(/\r?\n/).filter(Boolean)
  for (const line of lines) {
    const obj = JSON.parse(line)
    if (!obj.scope || !obj.name || !Array.isArray(obj.keys)) { console.warn('[skip] bad line', line); continue }
    await upsert(obj)
    console.log('[upsert]', obj.scope, '/', obj.name)
  }
  console.log('OK')
}

main().catch(e=> { console.error('LOAD FAILED:', e); process.exit(1) })
