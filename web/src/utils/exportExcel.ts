// 轻量 Excel 导出（使用 SheetJS/xlsx）
import * as XLSX from 'xlsx'

export function exportToExcel(filename: string, rows: Array<Record<string, any>>) {
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
  XLSX.writeFile(wb, filename)
}

export function exportCsvToExcel(filename: string, csvText: string) {
  // 直接读取 CSV 字符串为工作簿
  const wb = XLSX.read(csvText, { type: 'string' })
  // 若读取到多个 sheet，仅保留第一个
  const first = wb.SheetNames[0]
  const out = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(out, wb.Sheets[first], 'Sheet1')
  XLSX.writeFile(out, filename)
}
