import React from 'react'
import { Card, Space, DatePicker, Select, Input, Button, Table, Empty, Typography } from 'antd'
import dayjs from 'dayjs'
import { api } from '@/api/http'
import { tsSuffix } from '@/utils/time'

type Row = {
  createdAt: string
  warehouse: string
  materialCode: string
  batchNo: string | null
  qtyChange: string | number
  sourceType: 'INBOUND'|'OUTBOUND'|'ADJUST'|'TRANSFER'
  sourceCode?: string | null
}

export default function MovementsPage() {
  const [dateRange, setDateRange] = React.useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [warehouse, setWarehouse] = React.useState<string | undefined>()
  const [warehouses, setWarehouses] = React.useState<Array<{ code: string; name: string }>>([])
  const [materialCode, setMaterialCode] = React.useState<string>('')
  const [sourceType, setSourceType] = React.useState<string | undefined>()
  const [data, setData] = React.useState<Row[]>([])
  const [loading, setLoading] = React.useState(false)
  const [summary, setSummary] = React.useState<Array<any>>([])
  const [period, setPeriod] = React.useState<'day'|'week'|'month'>('day')
  const [groupBy, setGroupBy] = React.useState<''|'warehouse'|'material'>('')

  const loadWarehouses = React.useCallback(async ()=>{
    try { const res = await api.get('/warehouses'); setWarehouses(res.data || []) } catch {}
  }, [])
  React.useEffect(()=>{ loadWarehouses() }, [loadWarehouses])

  const load = React.useCallback(async ()=>{
    setLoading(true)
    try {
      const params: any = { limit: 1000 }
      if (dateRange) { params.dateFrom = dateRange[0].format('YYYY-MM-DD'); params.dateTo = dateRange[1].format('YYYY-MM-DD') }
      if (warehouse) params.warehouse = warehouse
      if (materialCode.trim()) params.materialCode = materialCode.trim()
      if (sourceType) params.sourceType = sourceType
      const [mv, sum] = await Promise.all([
        api.get('/movements', { params }),
        api.get('/movements/summary', { params: { ...params, period, groupBy: groupBy || undefined, limit: undefined } }),
      ])
      setData((mv.data || []).map((r: any)=> ({ ...r, qtyChange: Number(r.qtyChange) })))
      setSummary(sum.data?.data || [])
    } finally { setLoading(false) }
  }, [dateRange, warehouse, materialCode, sourceType, period, groupBy])
  React.useEffect(()=>{ load() }, [])

  const columns = [
    { title: '时间', dataIndex: 'createdAt', render: (v: any)=> String(v).replace('T',' ').slice(0,16) },
    { title: '仓库', dataIndex: 'warehouse' },
    { title: '物料', dataIndex: 'materialCode' },
    { title: '批次', dataIndex: 'batchNo' },
    { title: '变更', dataIndex: 'qtyChange', align: 'right' as const, render: (v: any)=> <span style={{ color: Number(v)>=0? '#16a34a': '#ef4444' }}>{Number(v).toFixed(3)}</span> },
    { title: '来源', dataIndex: 'sourceType' },
    { title: '单据', dataIndex: 'sourceCode' },
  ]

  return (
    <div>
      <Card size="small" title="筛选" style={{ marginBottom: 12 }} extra={<Space>
        <Button size="small" onClick={()=>{
          const qs = new URLSearchParams({
            ...(dateRange? { dateFrom: dateRange[0].format('YYYY-MM-DD'), dateTo: dateRange[1].format('YYYY-MM-DD') }: {}),
            ...(warehouse? { warehouse } : {}),
            ...(materialCode.trim()? { materialCode: materialCode.trim() } : {}),
            ...(sourceType? { sourceType } : {}),
            filename: `movements-${tsSuffix()}.csv`
          }).toString()
          const a = document.createElement('a'); a.href = '/api/movements.csv?' + qs; a.download = `movements-${tsSuffix()}.csv`; a.click()
        }}>导出流水</Button>
        <Button size="small" onClick={()=>{
          const qs = new URLSearchParams({
            ...(dateRange? { dateFrom: dateRange[0].format('YYYY-MM-DD'), dateTo: dateRange[1].format('YYYY-MM-DD') }: {}),
            ...(warehouse? { warehouse } : {}),
            ...(materialCode.trim()? { materialCode: materialCode.trim() } : {}),
            ...(groupBy? { groupBy } : {}),
            period,
            filename: `movement-summary-${tsSuffix()}.csv`
          }).toString()
          const a = document.createElement('a'); a.href = '/api/movements/summary.csv?' + qs; a.download = `movement-summary-${tsSuffix()}.csv`; a.click()
        }}>导出日汇总</Button>
      </Space>}>
        <Space wrap>
          <DatePicker.RangePicker value={dateRange as any} onChange={(v)=> setDateRange(v as any)} allowEmpty={[true,true]} />
          <Select size="small" style={{ width: 140 }} value={period} onChange={(v)=> setPeriod(v)} options={[{label:'按日', value:'day'},{label:'按周', value:'week'},{label:'按月', value:'month'}]} />
          <Select size="small" style={{ width: 160 }} placeholder="仓库" allowClear value={warehouse} onChange={(v)=> setWarehouse(v)}
            options={warehouses.map(w=> ({ label: w.code, value: w.code }))}
          />
          <Input size="small" style={{ width: 180 }} placeholder="物料编码 精确" allowClear value={materialCode} onChange={(e)=> setMaterialCode(e.target.value)} />
          <Select size="small" style={{ width: 160 }} placeholder="来源类型" allowClear value={sourceType} onChange={(v)=> setSourceType(v)}
            options={[
              { label: 'INBOUND', value: 'INBOUND' },
              { label: 'OUTBOUND', value: 'OUTBOUND' },
              { label: 'ADJUST', value: 'ADJUST' },
              { label: 'TRANSFER', value: 'TRANSFER' },
            ]}
          />
          <Select size="small" style={{ width: 160 }} placeholder="按维度汇总" allowClear value={groupBy || undefined} onChange={(v)=> setGroupBy((v||'') as any)}
            options={[
              { label: '不分组', value: '' },
              { label: '按仓库', value: 'warehouse' },
              { label: '按物料', value: 'material' },
            ]}
          />
          <Space>
            <Button type="primary" onClick={load} loading={loading}>查询</Button>
            <Button onClick={()=>{ setDateRange(null); setWarehouse(undefined); setMaterialCode(''); setSourceType(undefined); setPeriod('day'); setGroupBy(''); setTimeout(()=> load(), 0) }}>重置</Button>
          </Space>
        </Space>
      </Card>

      <Card size="small" title="汇总（in/out/net）" style={{ marginBottom: 12 }} extra={<span style={{ opacity:.65, fontSize:12 }}>{groupBy? '按维度汇总（表格展示）' : '折线图展示'}</span>}>
        {summary?.length && !groupBy ? (
          <div style={{ height: 220, position: 'relative' }}>
            {(() => {
              const W = 600, H = 180, L = 24, T = 10
              const max = Math.max(1, ...summary.map(r=> Math.max(Number(r.inQty||0), Number(r.outQty||0), Math.abs(Number(r.net||0)))))
              const step = (W - L * 2) / Math.max(1, summary.length - 1)
              const y = (v: number) => T + H - (v / max) * H
              const build = (vals: number[]) => vals.map((v,i)=> `${i===0? 'M':'L'} ${L+i*step},${y(v)}`).join(' ')
              const inPath = build(summary.map(r=> Number(r.inQty||0)))
              const outPath = build(summary.map(r=> Number(r.outQty||0)))
              const netPath = build(summary.map(r=> Math.abs(Number(r.net||0))))
              return (
                <svg width="100%" height="200" viewBox={`0 0 ${W} ${T+H+10}`} preserveAspectRatio="none">
                  {Array.from({ length: 5 }).map((_,i)=> (
                    <line key={i} x1={0} x2={W} y1={T + i*(H/4)} y2={T + i*(H/4)} stroke={'rgba(0,0,0,0.08)'} />
                  ))}
                  <path d={inPath} stroke="#10b981" fill="none" strokeWidth={2} />
                  <path d={outPath} stroke="#ef4444" fill="none" strokeWidth={2} />
                  <path d={netPath} stroke="#3b82f6" fill="none" strokeWidth={2} opacity={0.7} />
                </svg>
              )
            })()}
            <div style={{ position: 'absolute', bottom: 0, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', opacity: .6, fontSize: 12 }}>
              {summary.map((r,i)=> (<span key={i}>{String(r.date).slice(5)}</span>))}
            </div>
          </div>
        ) : summary?.length && groupBy ? (
          <div>
            <Table size="small" pagination={{ pageSize: 20 }} rowKey={(r)=> `${r.date}-${r.warehouse||r.materialCode||''}`}
              dataSource={summary as any}
              columns={[
                { title: '周期', dataIndex: 'date' },
                ...(groupBy==='warehouse' ? [{ title: '仓库', dataIndex: 'warehouse' }] : groupBy==='material' ? [{ title: '物料', dataIndex: 'materialCode' }] : [] as any),
                { title: '入库量', dataIndex: 'inQty', align: 'right' as const, render: (v:any)=> Number(v).toFixed(3) },
                { title: '出库量', dataIndex: 'outQty', align: 'right' as const, render: (v:any)=> Number(v).toFixed(3) },
                { title: '净变动', dataIndex: 'net', align: 'right' as const, render: (v:any)=> Number(v).toFixed(3) },
              ] as any}
            />
          </div>
        ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />}
      </Card>

      <Card size="small" title="变动流水">
        <Table dataSource={data} columns={columns as any} size="small" pagination={{ pageSize: 20 }} rowKey={(r)=> `${r.createdAt}-${r.materialCode}-${r.batchNo}-${r.sourceType}-${r.sourceCode}`} />
      </Card>
    </div>
  )
}
