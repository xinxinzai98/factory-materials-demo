// 共享导出模板 API 冒烟：要求服务端运行，具备 ADMIN 或 OP 权限的 API Key
// 用法：API_KEY=dev-api-key npm run tsx src/scripts/export-templates-smoke.ts

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

async function main() {
  const scope = 'inbound-list'
  const name = `smoke-tpl-${Date.now()}`
  // list
  const list1 = await req(`/export-templates?scope=${encodeURIComponent(scope)}`)
  console.log('list count before:', list1.length)
  // upsert
  await req('/export-templates', { method: 'POST', body: JSON.stringify({ scope, name, keys: ['code','status'], headerMap: { code: '单号', status: '状态' } }) })
  // rename
  const newName = name + '-renamed'
  await req('/export-templates/rename', { method: 'PUT', body: JSON.stringify({ scope, name, newName }) })
  // delete
  await req('/export-templates', { method: 'DELETE', body: JSON.stringify({ scope, name: newName }) })
  const list2 = await req(`/export-templates?scope=${encodeURIComponent(scope)}`)
  console.log('list count after:', list2.length)
  console.log('OK')
}

main().catch(e=> { console.error('SMOKE FAILED:', e); process.exit(1) })
