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
  // 图例显隐
  const [showIn, setShowIn] = React.useState(true)
  const [showOut, setShowOut] = React.useState(true)
  const [showNet, setShowNet] = React.useState(true)
  const [hoverTip, setHoverTip] = React.useState<string>('')

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

  <Card size="small" title="汇总（in/out/net）" style={{ marginBottom: 12 }} extra={<Space size={8}>
        <span style={{ opacity:.65, fontSize:12 }}>{groupBy? '按维度汇总（堆叠/表格）' : '折线图展示'}</span>
        {!groupBy && (
          <>
            <label style={{ userSelect:'none' }}><input type="checkbox" checked={showIn} onChange={e=> setShowIn(e.target.checked)} /> 入</label>
            <label style={{ userSelect:'none' }}><input type="checkbox" checked={showOut} onChange={e=> setShowOut(e.target.checked)} /> 出</label>
            <label style={{ userSelect:'none' }}><input type="checkbox" checked={showNet} onChange={e=> setShowNet(e.target.checked)} /> 净</label>
          </>
        )}
      </Space>}>
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
              const pts = summary.map((r,i)=> ({ i, x: L+i*step, vals: { in: Number(r.inQty||0), out: Number(r.outQty||0), net: Number(r.net||0) }, date: String(r.date) }))
              return (
                <svg width="100%" height="200" viewBox={`0 0 ${W} ${T+H+10}`} preserveAspectRatio="none"
                  onMouseLeave={()=> setHoverTip('')} onMouseMove={(e)=>{
                    const rect = (e.target as SVGElement).getBoundingClientRect()
                    const rx = e.clientX - rect.left
                    // 找最近点
                    const nearest = pts.reduce((p,c)=> Math.abs(c.x - rx) < Math.abs(p.x - rx) ? c : p, pts[0])
                    setHoverTip(`${nearest.date}  入:${nearest.vals.in.toFixed(3)} 出:${nearest.vals.out.toFixed(3)} 净:${nearest.vals.net.toFixed(3)}`)
                  }}>
                  {Array.from({ length: 5 }).map((_,i)=> (
                    <line key={i} x1={0} x2={W} y1={T + i*(H/4)} y2={T + i*(H/4)} stroke={'rgba(0,0,0,0.08)'} />
                  ))}
                  {showIn && <path d={inPath} stroke="#10b981" fill="none" strokeWidth={2} />}
                  {showOut && <path d={outPath} stroke="#ef4444" fill="none" strokeWidth={2} />}
                  {showNet && <path d={netPath} stroke="#3b82f6" fill="none" strokeWidth={2} opacity={0.7} />}
                </svg>
              )
            })()}
            <div style={{ position: 'absolute', bottom: 0, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', opacity: .6, fontSize: 12 }}>
              {summary.map((r,i)=> (<span key={i}>{String(r.date).slice(5)}</span>))}
            </div>
            {hoverTip && <div style={{ position:'absolute', top: 0, left: 8, background:'rgba(0,0,0,0.65)', color:'#fff', padding:'2px 6px', borderRadius:4, fontSize:12 }}>{hoverTip}</div>}
          </div>
        ) : summary?.length && groupBy ? (
          <div>
            {/* 时间轴堆叠柱：取每期内 Top5 维度，绘制 in/out 双向堆叠（简化为正值堆叠展示） */}
            {(() => {
              // 生成：period -> dim -> {in,out}
              const dimKey = (r:any)=> (groupBy==='warehouse'? r.warehouse : r.materialCode) || '—'
              const periodKeys = Array.from(new Set((summary as any[]).map(r=> r.date)))
              const dims = Array.from(new Set((summary as any[]).map(dimKey)))
              const color = (i:number)=> ['#0ea5e9','#22c55e','#f97316','#8b5cf6','#e11d48'][i%5]
              const W=640, H=200, L=30, B=28, step = (W - L*2) / Math.max(1, periodKeys.length)
              const groups = periodKeys.map(pk => {
                const rows = (summary as any[]).filter(r=> r.date===pk).map(r=> ({ dim: dimKey(r), in: Number(r.inQty||0), out: Number(r.outQty||0) }))
                rows.sort((a,b)=> (b.in+b.out)-(a.in+b.out))
                return { period: pk, rows: rows.slice(0,5) }
              })
              const max = Math.max(1, ...groups.flatMap(g=> g.rows.map(r=> r.in + r.out)))
              const y = (v:number)=> (H - B) - (v/max) * (H - B - 16)
              return (
                <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ marginBottom: 8 }}>
                  {groups.map((g, gi)=> {
                    let acc = 0
                    return (
                      <g key={g.period}>
                        <text x={L + gi*step + step*0.1} y={H-6} fontSize={11} fill="#555">{String(g.period).slice(5)}</text>
                        {g.rows.map((r, ri)=> {
                          const h = Math.max(2, ((r.in + r.out) / max) * (H - B - 16))
                          const x = L + gi*step + step*0.25
                          const yTop = (H - B - acc) - h
                          acc += h
                          return <rect key={ri} x={x} y={yTop} width={step*0.5} height={h} fill={color(dims.indexOf(r.dim))} opacity={0.9} />
                        })}
                      </g>
                    )
                  })}
                </svg>
              )
            })()}
            {/* 对比柱状图：按维度汇总 period 区间内的总量 */}
            {(() => {
              const agg = new Map<string, { in: number; out: number; net: number }>()
              for (const r of summary as any[]) {
                const key = (groupBy==='warehouse'? r.warehouse : r.materialCode) || '—'
                const o = agg.get(key) || { in: 0, out: 0, net: 0 }
                o.in += Number(r.inQty||0); o.out += Number(r.outQty||0); o.net += Number(r.net||0)
                agg.set(key, o)
              }
              const rows = Array.from(agg.entries()).map(([k,v])=> ({ key: k, ...v }))
                .sort((a,b)=> (b.in + b.out) - (a.in + a.out)).slice(0, 10)
              if (!rows.length) return null
              const W = 600, H = 180, L = 120, R = 20, T = 10, B = 24
              const max = Math.max(1, ...rows.map(r=> Math.max(r.in, r.out, Math.abs(r.net))))
              const x = (v:number) => L + (v/max) * (W - L - R)
              const barH = (H - T) / rows.length - 6
              return (
                <svg width="100%" height={H + B} viewBox={`0 0 ${W} ${H+B}`} preserveAspectRatio="none" style={{ marginBottom: 8 }}>
                  {rows.map((r, i)=> (
                    <g key={r.key}>
                      <text x={8} y={T + i*(barH+6) + barH*0.75} fontSize={12} fill="#555">{r.key}</text>
                      {/* in 绿 */}
                      <rect x={L} y={T + i*(barH+6)} width={Math.max(2, x(r.in)-L)} height={barH/3} fill="#10b981" />
                      {/* out 红 */}
                      <rect x={L} y={T + i*(barH+6) + barH/3 + 2} width={Math.max(2, x(r.out)-L)} height={barH/3} fill="#ef4444" />
                      {/* net 蓝 */}
                      <rect x={L} y={T + i*(barH+6) + 2*barH/3 + 4} width={Math.max(2, x(Math.abs(r.net))-L)} height={barH/3} fill="#3b82f6" opacity={0.8} />
                    </g>
                  ))}
                </svg>
              )
            })()}
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
