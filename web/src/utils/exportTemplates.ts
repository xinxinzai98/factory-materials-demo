export type ExportTemplate = {
  name: string
  keys: string[]
  headerMap: Record<string, string>
  createdAt: number
  updatedAt: number
}

const PREFIX = 'exportTpl:v1:'

function key(scope: string) {
  return PREFIX + scope
}

export function listTemplates(scope: string): ExportTemplate[] {
  try {
    const raw = localStorage.getItem(key(scope))
    if (!raw) return []
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
    return []
  } catch { return [] }
}

export function loadTemplate(scope: string, name: string): ExportTemplate | null {
  const list = listTemplates(scope)
  return list.find(t => t.name === name) || null
}

export function upsertTemplate(scope: string, name: string, keys: string[], headerMap: Record<string,string>) {
  const now = Date.now()
  const list = listTemplates(scope)
  const idx = list.findIndex(t => t.name === name)
  if (idx >= 0) {
    list[idx] = { ...list[idx], keys, headerMap, updatedAt: now }
  } else {
    list.push({ name, keys, headerMap, createdAt: now, updatedAt: now })
  }
  localStorage.setItem(key(scope), JSON.stringify(list))
}

export function removeTemplate(scope: string, name: string) {
  const list = listTemplates(scope).filter(t => t.name !== name)
  localStorage.setItem(key(scope), JSON.stringify(list))
}

export function renameTemplate(scope: string, oldName: string, newName: string) {
  if (!oldName || !newName || oldName === newName) return
  const list = listTemplates(scope)
  const idx = list.findIndex(t => t.name === oldName)
  if (idx < 0) return
  // 若新名称已存在，覆盖为更新（保留 keys/headerMap），时间刷新
  const now = Date.now()
  const curr = list[idx]
  const existIdx = list.findIndex(t => t.name === newName)
  if (existIdx >= 0) {
    list[existIdx] = { ...list[existIdx], keys: curr.keys, headerMap: curr.headerMap, updatedAt: now }
    list.splice(idx, 1)
  } else {
    list[idx] = { ...curr, name: newName, updatedAt: now }
  }
  localStorage.setItem(key(scope), JSON.stringify(list))
}

// --- 共享模板（服务端存储） ---
import { api } from '@/api/http'

export async function listRemoteTemplates(scope: string): Promise<Array<{ name: string; keys: string[]; headerMap?: Record<string,string>; updatedAt?: string }>> {
  const { data } = await api.get('/export-templates', { params: { scope } })
  return data || []
}

export async function upsertRemoteTemplate(scope: string, name: string, keys: string[], headerMap: Record<string,string>) {
  await api.post('/export-templates', { scope, name, keys, headerMap })
}

export async function removeRemoteTemplate(scope: string, name: string) {
  await api.delete('/export-templates', { data: { scope, name } as any })
}

export async function renameRemoteTemplate(scope: string, name: string, newName: string) {
  await api.put('/export-templates/rename', { scope, name, newName })
}

// 可选：合并本地与远端（名称作为主键）
export async function mergeLocalWithRemote(scope: string) {
  const remote = await listRemoteTemplates(scope)
  const local = listTemplates(scope)
  const map = new Map<string, any>()
  for (const t of remote) map.set(t.name, { name: t.name, keys: t.keys||[], headerMap: t.headerMap||{}, createdAt: Date.now(), updatedAt: Date.now() })
  for (const t of local) map.set(t.name, t)
  const merged = Array.from(map.values())
  localStorage.setItem('exportTpl:v1:' + scope, JSON.stringify(merged))
  return merged
}
