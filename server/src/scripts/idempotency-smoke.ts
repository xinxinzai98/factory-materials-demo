// 冒烟：校验 Zod 与幂等键
// 运行方式：在 server 目录 `npm run smoke:idempotency`

const API = process.env.API_BASE || 'http://localhost:8080/api'
const headers = { 'X-API-Key': process.env.API_KEY || 'dev-api-key', 'Content-Type': 'application/json' }

async function post(path: string, body: any, extra: Record<string,string> = {}) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers: { ...headers, ...extra }, body: JSON.stringify(body) })
  const text = await res.text()
  let data: any = text
  try { data = JSON.parse(text) } catch {}
  return { ok: res.ok, status: res.status, data }
}

async function main() {
  // 1) 校验失败（缺少 items）
  const bad = await post('/inbounds/draft', { code: 'IDEMP-TEST', sourceType: 'PURCHASE' })
  if (bad.ok || bad.status !== 422 || bad.data?.code !== 'ERR_VALIDATION') throw new Error('expect 422 validation error')

  // 2) 幂等键：相同键重复提交
  const uniq = Date.now()
  const body = { code: `IDEMP-ONCE-${uniq}`, sourceType: 'PURCHASE', supplier: 'S1', items: [{ materialCode: 'M001', qty: 1 }] }
  const key = `k-${Date.now()}`
  const first = await post('/inbounds/draft', body, { 'Idempotency-Key': key })
  if (!first.ok) throw new Error('first request should succeed')
  const dup = await post('/inbounds/draft', body, { 'Idempotency-Key': key })
  if (dup.ok || dup.status !== 409 || dup.data?.code !== 'ERR_IDEMPOTENT_REPLAY') throw new Error('expect 409 idempotent replay')

  console.log('OK')
}

main().catch((e)=>{ console.error('SMOKE FAILED:', e); process.exit(1) })
