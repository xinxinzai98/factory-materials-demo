import React from 'react'
import { Card, Col, Row, Typography, Space, Empty } from 'antd'
import { api } from '@/api/http'

export default function AnalyticsPage() {
  const [stats, setStats] = React.useState<any>({})
  const [trends, setTrends] = React.useState<Array<{date: string; inbounds: number; outbounds: number}>>([])
  const [lowStocks, setLowStocks] = React.useState<Array<{ materialCode: string; qty: number }>>([])
  const [loading, setLoading] = React.useState(false)

  React.useEffect(()=>{
    const load = async () => {
      setLoading(true)
      try {
        const [mRes, tRes, lRes] = await Promise.all([
          api.get('/metrics/dashboard'),
          api.get('/metrics/trends', { params: { days: 30 } }),
          api.get('/metrics/low-stocks', { params: { limit: 10 } })
        ])
        setStats(mRes.data || {})
        setTrends(tRes.data?.data || [])
        setLowStocks(lRes.data || [])
      } finally { setLoading(false) }
    }
    load()
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
        <Col xs={24} md={12}>
          <Card loading={loading} title="趋势（30天）">
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
                  {trends.map((t, i) => (<span key={i}>{(t.date || '').slice(5)}</span>))}
                </div>
              </div>
            ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无数据" />}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card loading={loading} title="低库存 Top10">
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
    </div>
  )
}
