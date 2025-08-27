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
