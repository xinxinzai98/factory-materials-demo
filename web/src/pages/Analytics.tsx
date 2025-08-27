import React from 'react'
import { Card, Col, Row, Typography, Space, Empty, Segmented, Button, DatePicker, Select, Input } from 'antd'
import dayjs from 'dayjs'
import { api } from '@/api/http'

export default function AnalyticsPage() {
  const [stats, setStats] = React.useState<any>({})
  const [trends, setTrends] = React.useState<Array<any>>([])
  const [lowStocks, setLowStocks] = React.useState<Array<{ materialCode: string; qty: number }>>([])
  const [loading, setLoading] = React.useState(false)
  const [mode, setMode] = React.useState<'daily'|'weekly'>('daily')
  const [dateRange, setDateRange] = React.useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [warehouse, setWarehouse] = React.useState<string | undefined>(undefined)
  const [warehouses, setWarehouses] = React.useState<Array<{ code: string; name: string }>>([])
  const [materialCode, setMaterialCode] = React.useState<string>('')
  const [q, setQ] = React.useState<string>('')
  // 新增：入/出库导出筛选
  const [inStatus, setInStatus] = React.useState<string | undefined>(undefined)
  const [outStatus, setOutStatus] = React.useState<string | undefined>(undefined)
  const [orderCode, setOrderCode] = React.useState<string>('')

  const load = React.useCallback(async (m: 'daily'|'weekly') => {
    setLoading(true)
    try {
      const paramsBase: any = {}
      if (dateRange) { paramsBase.dateFrom = dateRange[0].format('YYYY-MM-DD'); paramsBase.dateTo = dateRange[1].format('YYYY-MM-DD') }
      if (materialCode.trim()) paramsBase.materialCode = materialCode.trim()
      const lowParams: any = { limit: 10 }
      if (warehouse) lowParams.warehouse = warehouse
      if (q.trim()) lowParams.q = q.trim()
      const reqs = [api.get('/metrics/dashboard'), api.get('/metrics/low-stocks', { params: lowParams })]
      if (m === 'daily') reqs.splice(1, 0, api.get('/metrics/trends', { params: { days: 30, ...paramsBase } }))
      else reqs.splice(1, 0, api.get('/metrics/weekly', { params: { weeks: 12, ...paramsBase } }))
      const [mRes, tRes, lRes] = await Promise.all(reqs as any)
      setStats(mRes.data || {})
      setTrends((tRes.data?.data) || [])
      setLowStocks(lRes.data || [])
    } finally { setLoading(false) }
  }, [dateRange, materialCode, warehouse, q])

  React.useEffect(()=>{ load(mode) }, [])
  React.useEffect(()=>{ load(mode) }, [mode, load])
  React.useEffect(()=>{
    // load warehouses
    (async()=>{
      try { const res = await api.get('/warehouses'); setWarehouses(res.data || []) } catch {}
    })()
  }, [])

  return (
    <div>
      <Typography.Title level={5} style={{ marginTop: 0 }}>关键指标</Typography.Title>
      <Row gutter={[12,12]}>
        <Col xs={24} md={8}><Card loading={loading} title="物料数">{stats.materialsCount ?? 0}</Card></Col>
        <Col xs={24} md={8}><Card loading={loading} title="库存总量">{stats.stocksQtyOnHand ?? 0}</Card></Col>
        <Col xs={24} md={8}><Card loading={loading} title={`临期批次（${stats.expiryDays ?? 30}天内）`}>{stats.soonToExpireBatches ?? 0}</Card></Col>
      </Row>
      <Row gutter={[12,12]} style={{ marginTop: 12 }}>
        <Col xs={24} md={8}><Card loading={loading} title={`低库存物料（阈值 ${stats.globalMinQty ?? 0}）`}>{stats.lowStockMaterials ?? 0}</Card></Col>
        <Col xs={24} md={8}><Card loading={loading} title={`滞销物料（${stats.slowDays ?? 60}天）`}>{stats.slowMaterials ?? 0}</Card></Col>
        <Col xs={24} md={8}><Card loading={loading} title="未读预警">{stats.unreadNotifications ?? 0}</Card></Col>
      </Row>

  <Row gutter={[12,12]} style={{ marginTop: 12 }}>
        <Col xs={24} md={12}>
      <Card loading={loading} title={mode==='daily'? '趋势（30天）' : '周趋势（12周）'} extra={
            <Space>
              <Segmented size="small" value={mode} onChange={(v)=> setMode(v as any)} options={[{label:'按日', value:'daily'},{label:'按周', value:'weekly'}]} />
              {mode==='daily' ? (
        <Button size="small" onClick={()=>{ const qs = new URLSearchParams({ days: '30', ...(dateRange?{ dateFrom: dateRange[0].format('YYYY-MM-DD'), dateTo: dateRange[1].format('YYYY-MM-DD') }:{}), ...(materialCode.trim()?{ materialCode: materialCode.trim() }: {}) }).toString(); const a=document.createElement('a'); a.href='/api/metrics/trends.csv?'+qs; a.download='trends.csv'; a.click(); }}>导出</Button>
              ) : (
        <Button size="small" onClick={()=>{ const qs = new URLSearchParams({ weeks: '12', ...(dateRange?{ dateFrom: dateRange[0].format('YYYY-MM-DD'), dateTo: dateRange[1].format('YYYY-MM-DD') }:{}), ...(materialCode.trim()?{ materialCode: materialCode.trim() }: {}) }).toString(); const a=document.createElement('a'); a.href='/api/metrics/weekly.csv?'+qs; a.download='weekly-trends.csv'; a.click(); }}>导出</Button>
              )}
            </Space>
          }>
            {trends.length ? (
              <div style={{ height: 240, position: 'relative' }}>
                <svg width="100%" height="220" viewBox="0 0 600 220" preserveAspectRatio="none">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <line key={i} x1={0} x2={600} y1={10 + i * 35} y2={10 + i * 35} stroke={'rgba(0,0,0,0.08)'} strokeWidth={1} />
                  ))}
                  {['inbounds','outbounds'].map((key) => {
                    const max = Math.max(1, ...trends.map(t => Math.max(t.inbounds || 0, t.outbounds || 0)))
                    const W = 600, H = 190, L = 20, T = 10
                    const step = (W - L * 2) / Math.max(1, trends.length - 1)
                    const y = (v: number) => T + H - (v / max) * H
                    let d = ''
                    trends.forEach((t, i) => { const x = L + i * step; const yy = y(Number((t as any)[key] || 0)); d += (i === 0 ? `M ${x},${yy}` : ` L ${x},${yy}`) })
                    return <path key={key} d={d} fill="none" stroke={key === 'inbounds' ? '#22d3ee' : '#60a5fa'} strokeWidth={2} />
                  })}
                </svg>
                <div style={{ position: 'absolute', bottom: 0, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', opacity: .6, fontSize: 12 }}>
                  {trends.map((t: any, i) => (<span key={i}>{(t.date || t.week || '').slice(5)}</span>))}
                </div>
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card loading={loading} title="低库存 Top10" extra={
            <Space size={8}>
              <Select size="small" style={{ width: 140 }} allowClear placeholder="仓库"
                options={warehouses.map(w=> ({ label: `${w.code}`, value: w.code }))}
                value={warehouse}
                onChange={(v)=> setWarehouse(v)}
              />
              <Input size="small" style={{ width: 160 }} allowClear placeholder="物料模糊匹配"
                value={q} onChange={(e)=> setQ(e.target.value)}
                onPressEnter={()=> load(mode)}
              />
              <Button size="small" onClick={()=>{ const qs = new URLSearchParams({ limit: '10', ...(warehouse?{ warehouse }:{}), ...(q.trim()?{ q: q.trim() }: {}) }).toString(); const a=document.createElement('a'); a.href='/api/metrics/low-stocks.csv?'+qs; a.download='low-stocks.csv'; a.click(); }}>导出</Button>
            </Space>
          }>
            {lowStocks.length ? (
              <div style={{ height: 240, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 8px' }}>
                {(() => {
                  const max = Math.max(1, ...lowStocks.map(x=> Number(x.qty||0)))
                  return lowStocks.map((r, idx) => {
                    const h = Math.max(4, (Number(r.qty || 0) / max) * 180)
                    return (
                      <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div style={{ width: '100%', height: h, background: 'linear-gradient(180deg, #f59f00, #f97316)', borderRadius: 4 }} />
                        <div style={{ fontSize: 12, opacity: .8, marginTop: 6, textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.materialCode || '—'}</div>
                      </div>
                    )
                  })
                })()}
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />}
          </Card>
        </Col>
      </Row>
      <Card size="small" style={{ marginTop: 12 }} title="筛选">
        <Space wrap>
          <DatePicker.RangePicker value={dateRange as any} onChange={(v)=> setDateRange(v as any)} allowEmpty={[true,true]} />
          <Input placeholder="物料编码 精确" value={materialCode} onChange={(e)=> setMaterialCode(e.target.value)} style={{ width: 180 }} allowClear />
          <Button type="primary" onClick={()=> load(mode)} loading={loading}>应用筛选</Button>
          <Button onClick={()=> { setDateRange(null); setMaterialCode(''); setWarehouse(undefined); setQ(''); setInStatus(undefined); setOutStatus(undefined); setOrderCode(''); setTimeout(()=> load(mode), 0)}}>重置</Button>
        </Space>
      </Card>

      <Card size="small" style={{ marginTop: 12 }} title="快捷导出（入/出库）" extra={<span style={{ opacity:.65, fontSize:12 }}>按日期/状态/单号导出 CSV</span>}>
        <Space wrap size={8}>
          <DatePicker.RangePicker value={dateRange as any} onChange={(v)=> setDateRange(v as any)} allowEmpty={[true,true]} />
          <Select
            allowClear size="small" style={{ width: 160 }} placeholder="入库状态"
            options={[
              { label: 'DRAFT', value: 'DRAFT' },
              { label: 'APPROVED', value: 'APPROVED' },
              { label: 'PUTAWAY', value: 'PUTAWAY' },
              { label: 'CANCELLED', value: 'CANCELLED' },
            ]}
            value={inStatus}
            onChange={(v)=> setInStatus(v)}
          />
          <Select
            allowClear size="small" style={{ width: 160 }} placeholder="出库状态"
            options={[
              { label: 'DRAFT', value: 'DRAFT' },
              { label: 'APPROVED', value: 'APPROVED' },
              { label: 'PICKED', value: 'PICKED' },
              { label: 'CANCELLED', value: 'CANCELLED' },
            ]}
            value={outStatus}
            onChange={(v)=> setOutStatus(v)}
          />
          <Input size="small" style={{ width: 180 }} placeholder="单号包含..." allowClear value={orderCode} onChange={(e)=> setOrderCode(e.target.value)} />
          <Space size={8}>
            <Button size="small" onClick={()=>{
              const qs = new URLSearchParams({
                ...(inStatus? { status: inStatus } : {}),
                ...(orderCode.trim()? { code: orderCode.trim() } : {}),
                ...(dateRange? { dateFrom: dateRange[0].format('YYYY-MM-DD'), dateTo: dateRange[1].format('YYYY-MM-DD') } : {}),
              }).toString();
              const a=document.createElement('a'); a.href='/api/inbounds.csv?'+qs; a.download='inbounds.csv'; a.click();
            }}>入库单</Button>
            <Button size="small" onClick={()=>{
              const qs = new URLSearchParams({
                ...(inStatus? { status: inStatus } : {}),
                ...(orderCode.trim()? { code: orderCode.trim() } : {}),
                ...(dateRange? { dateFrom: dateRange[0].format('YYYY-MM-DD'), dateTo: dateRange[1].format('YYYY-MM-DD') } : {}),
              }).toString();
              const a=document.createElement('a'); a.href='/api/inbound-items.csv?'+qs; a.download='inbound-items.csv'; a.click();
            }}>入库明细</Button>
            <Button size="small" onClick={()=>{
              const qs = new URLSearchParams({
                ...(outStatus? { status: outStatus } : {}),
                ...(orderCode.trim()? { code: orderCode.trim() } : {}),
                ...(dateRange? { dateFrom: dateRange[0].format('YYYY-MM-DD'), dateTo: dateRange[1].format('YYYY-MM-DD') } : {}),
              }).toString();
              const a=document.createElement('a'); a.href='/api/outbounds.csv?'+qs; a.download='outbounds.csv'; a.click();
            }}>出库单</Button>
            <Button size="small" onClick={()=>{
              const qs = new URLSearchParams({
                ...(outStatus? { status: outStatus } : {}),
                ...(orderCode.trim()? { code: orderCode.trim() } : {}),
                ...(dateRange? { dateFrom: dateRange[0].format('YYYY-MM-DD'), dateTo: dateRange[1].format('YYYY-MM-DD') } : {}),
              }).toString();
              const a=document.createElement('a'); a.href='/api/outbound-items.csv?'+qs; a.download='outbound-items.csv'; a.click();
            }}>出库明细</Button>
          </Space>
        </Space>
      </Card>

      {/* 数据源切换 */}
      {mode==='weekly' ? (
        <React.Fragment>
          {/** 每次切换时加载 weekly 数据 */}
        </React.Fragment>
      ) : null}
    </div>
  )
}
