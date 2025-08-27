import React from 'react'
import { Card, Col, Row, Typography, Space, Empty, Segmented, Button, DatePicker, Input, Select } from 'antd'
import dayjs from 'dayjs'
import { api } from '@/api/http'

export default function AnalyticsPage() {
  const [stats, setStats] = React.useState<any>({})
  const [trends, setTrends] = React.useState<Array<any>>([])
  const [lowStocks, setLowStocks] = React.useState<Array<{ materialCode: string; qty: number }>>([])
  const [loading, setLoading] = React.useState(false)
  const [mode, setMode] = React.useState<'daily'|'weekly'>('daily')
  const [dateRange, setDateRange] = React.useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [materialCode, setMaterialCode] = React.useState<string>('')
  const [warehouse, setWarehouse] = React.useState<string>('')
  const [warehouses, setWarehouses] = React.useState<Array<{ code: string; name: string }>>([])

  const load = React.useCallback(async (m: 'daily'|'weekly') => {
    setLoading(true)
    try {
      const paramsBase: any = {}
      if (materialCode) paramsBase.materialCode = materialCode
      if (dateRange && m==='daily') {
        paramsBase.dateFrom = dateRange[0].format('YYYY-MM-DD')
        paramsBase.dateTo = dateRange[1].format('YYYY-MM-DD')
      }
      const reqs = [
        api.get('/metrics/dashboard'),
        api.get('/metrics/low-stocks', { params: { limit: 10, warehouse: warehouse || undefined, materialLike: materialCode || undefined } })
      ]
      if (m === 'daily') reqs.splice(1, 0, api.get('/metrics/trends', { params: { days: 30, ...paramsBase } }))
      else reqs.splice(1, 0, api.get('/metrics/weekly', { params: { weeks: 12, ...paramsBase } }))
      const [mRes, tRes, lRes] = await Promise.all(reqs as any)
      setStats(mRes.data || {})
      setTrends((tRes.data?.data) || [])
      setLowStocks(lRes.data || [])
    } finally { setLoading(false) }
  }, [])

  React.useEffect(()=>{ load(mode) }, [])
  React.useEffect(()=>{ load(mode) }, [mode, load])
  React.useEffect(()=>{ (async ()=>{ const r = await api.get('/warehouses'); setWarehouses(r.data || []) })() }, [])

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
              <DatePicker.RangePicker allowClear onChange={(v)=> setDateRange(v as any)} disabled={mode==='weekly'} size="small" />
              <Input allowClear placeholder="物料编码" value={materialCode} onChange={(e)=> setMaterialCode(e.target.value)} size="small" style={{ width: 140 }} />
              <Select allowClear placeholder="仓库" size="small" value={warehouse || undefined} onChange={(v)=> setWarehouse(v||'')} style={{ width: 140 }}
                options={warehouses.map(w=> ({ label: `${w.code} ${w.name}`, value: w.code }))} />
              {mode==='daily' ? (
                <Button size="small" onClick={()=>{ const p = new URLSearchParams({ days:'30', ...(materialCode?{materialCode}:{}) , ...(dateRange?{ dateFrom: dateRange[0].format('YYYY-MM-DD'), dateTo: dateRange[1].format('YYYY-MM-DD') }: {}) }).toString(); const a=document.createElement('a'); a.href=`/api/metrics/trends.csv?${p}`; a.download='trends.csv'; a.click(); }}>导出</Button>
              ) : (
                <Button size="small" onClick={()=>{ const p = new URLSearchParams({ weeks:'12', ...(materialCode?{materialCode}:{}) }).toString(); const a=document.createElement('a'); a.href=`/api/metrics/weekly.csv?${p}`; a.download='weekly-trends.csv'; a.click(); }}>导出</Button>
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
          <Card loading={loading} title="低库存 Top10" extra={<Button size="small" onClick={()=>{ const p = new URLSearchParams({ limit:'10', ...(warehouse?{warehouse}:{}) , ...(materialCode?{materialLike: materialCode}:{}) }).toString(); const a=document.createElement('a'); a.href=`/api/metrics/low-stocks.csv?${p}`; a.download='low-stocks.csv'; a.click(); }}>导出</Button>}>
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
      {/* 数据源切换 */}
      {mode==='weekly' ? (
        <React.Fragment>
          {/** 每次切换时加载 weekly 数据 */}
        </React.Fragment>
      ) : null}
    </div>
  )
}
