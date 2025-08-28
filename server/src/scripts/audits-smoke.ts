// 冒烟：审计日志基本可用性
// 运行：npm run smoke:audits

const API = process.env.API_BASE || 'http://localhost:8080/api'
const headers = { 'X-API-Key': process.env.API_KEY || 'dev-api-key', 'Content-Type': 'application/json' }

async function post(path: string, body: any) {
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  const json: any = await res.json().catch(()=> ({} as any))
  return { ok: res.ok, status: res.status, data: json } as any
}
async function get(path: string) {
  const res = await fetch(`${API}${path}`, { headers })
  const json: any = await res.json().catch(()=> ({} as any))
  return { ok: res.ok, status: res.status, data: json } as any
}

async function main() {
  const code = `AUDIT-${Date.now()}`
  // 新建入库草稿并审批+作废
  let r = await post('/inbounds/draft', { code, sourceType: 'PURCHASE', supplier: 'S1', items: [{ materialCode: 'M001', qty: 1 }] })
  if (!r.ok) throw new Error('create inbound draft failed')
  r = await post(`/inbounds/${code}/approve`, {})
  if (!r.ok) throw new Error('approve inbound failed')
  r = await post(`/inbounds/${code}/cancel`, { reason: '测试作废' })
  if (!r.ok) throw new Error('cancel inbound failed')

  // 查询审计
  const q = await get(`/audits?code=${code}&page=1&pageSize=10`)
  if (!q.ok) throw new Error('query audits failed')
  const acts = ((q as any).data?.data || []).map((a: any)=> a.action)
  const needed = ['APPROVE','CANCEL']
  for (const a of needed) if (!acts.includes(a)) throw new Error(`audit missing: ${a}`)
  console.log('OK')
}

main().catch((e)=>{ console.error('SMOKE FAILED:', e); process.exit(1) })
