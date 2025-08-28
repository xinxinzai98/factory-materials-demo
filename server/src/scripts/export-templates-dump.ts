// 批量导出共享模板到 stdout（JSON 行），便于备份与迁移
// 用法：API_KEY=dev-api-key tsx src/scripts/export-templates-dump.ts > templates.ndjson

const API = process.env.API_BASE || 'http://localhost:8080/api'
const API_KEY = process.env.API_KEY || 'dev-api-key'

const SCOPES = ['inbound-list','inbound-detail','outbound-list','outbound-detail']

aSYNC: for (const s of SCOPES) {
  const url = `${API}/export-templates?scope=${encodeURIComponent(s)}`
  const res = await fetch(url, { headers: { 'X-API-Key': API_KEY } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${url}`)
  const list = await res.json()
  for (const t of (list||[])) {
    process.stdout.write(JSON.stringify({ scope: s, ...t }) + '\n')
  }
}
console.log('OK')
