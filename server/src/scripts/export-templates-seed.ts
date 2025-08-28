// 共享导出模板预设：将一组内置模板写入 app_settings（幂等）
// 用法：API_KEY=dev-api-key npm run seed:export-templates

const API = process.env.API_BASE || 'http://localhost:8080/api'

async function req(path: string, init?: RequestInit) {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      'X-API-Key': process.env.API_KEY || 'dev-api-key',
      'Content-Type': 'application/json',
      ...(init?.headers||{} as any)
    }
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} - ${path}`)
  const ct = res.headers.get('content-type')||''
  const txt = await res.text()
  return ct.includes('application/json')? JSON.parse(txt) : txt
}

type Tpl = { scope: string; name: string; keys: string[]; headerMap?: Record<string,string> }

const presets: Tpl[] = [
  { scope: 'inbound-list', name: '标准列表', keys: ['code','sourceType','supplier','status','createdAt'], headerMap: { code:'单号', sourceType:'来源', supplier:'供应商', status:'状态', createdAt:'创建时间' } },
  { scope: 'inbound-detail', name: '标准明细', keys: ['code','status','createdAt','sourceType','supplier','materialCode','qty','batchNo','expDate'], headerMap: { code:'单号', status:'状态', createdAt:'创建时间', sourceType:'来源', supplier:'供应商', materialCode:'物料', qty:'数量', batchNo:'批次', expDate:'到期' } },
  { scope: 'outbound-list', name: '标准列表', keys: ['code','purpose','status','createdAt'], headerMap: { code:'单号', purpose:'用途', status:'状态', createdAt:'创建时间' } },
  { scope: 'outbound-detail', name: '标准明细', keys: ['code','status','createdAt','purpose','materialCode','qty','batchPolicy','batchNo'], headerMap: { code:'单号', status:'状态', createdAt:'创建时间', purpose:'用途', materialCode:'物料', qty:'数量', batchPolicy:'批次策略', batchNo:'批次' } },
]

async function main() {
  for (const t of presets) {
    try {
      const list = await req(`/export-templates?scope=${encodeURIComponent(t.scope)}`) as any[]
      const exists = (list||[]).some((x:any)=> x.name === t.name)
      if (!exists) {
        await req('/export-templates', { method: 'POST', body: JSON.stringify(t) })
        console.log(`[seed] inserted: ${t.scope} / ${t.name}`)
      } else {
        console.log(`[seed] exists:   ${t.scope} / ${t.name}`)
      }
    } catch (e) {
      console.error('[seed] failed:', t, e)
      throw e
    }
  }
  console.log('OK')
}

main().catch(e=> { console.error('SEED FAILED:', e); process.exit(1) })
