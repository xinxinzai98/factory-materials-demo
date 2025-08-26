

import { useEffect, useMemo, useState } from 'react';
import { Card, Col, Row, Statistic, Button, List, Tag, Space, message } from 'antd';
import { Link } from 'react-router-dom';
import { api } from '@/api/http';

export default function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>({});
  const [alerts, setAlerts] = useState<any[]>([]);
  const [trends, setTrends] = useState<{ date: string; inbounds: number; outbounds: number }[]>([]);
  const [lowStocks, setLowStocks] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [mRes, aRes, tRes, lRes] = await Promise.all([
          api.get('/metrics/dashboard'),
          api.get('/notifications', { params: { type: 'warning', status: 'UNREAD' } }),
          api.get('/metrics/trends', { params: { days: 14 } }),
          api.get('/metrics/low-stocks', { params: { limit: 6 } })
        ]);
        setMetrics(mRes.data || {});
        setAlerts(aRes.data || []);
        setTrends((tRes.data?.data) || []);
        setLowStocks(lRes.data || []);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // 支持浅色/深色自动切换
  const isLight = window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
  const palette = useMemo(() => ({
    bg: isLight
      ? 'radial-gradient(900px 400px at 10% 0%, #f5f7fa 0%, #e2e8f0 40%, #cbd5e1 100%)'
      : 'radial-gradient(900px 400px at 10% 0%, #0b132b 0%, #0a0f1f 40%, #070b16 100%)',
    cardBg: isLight
      ? 'linear-gradient(135deg, rgba(255,255,255,0.85), rgba(226,232,240,0.85))'
      : 'linear-gradient(135deg, rgba(8,47,73,0.65), rgba(2,6,23,0.65))',
    text: isLight ? '#222' : '#e2e8f0',
    accent: isLight ? '#22d3ee' : '#22d3ee',
    accent2: isLight ? '#2563eb' : '#60a5fa',
    warn: isLight ? '#f59f00' : '#f59f00',
    danger: isLight ? '#fa541c' : '#fa541c',
    grid: isLight ? 'rgba(120,120,120,0.08)' : 'rgba(226,232,240,0.2)'
  }), [isLight]);

  const maxLow = useMemo(() => Math.max(1, ...lowStocks.map((x: any) => Number(x.qty || 0))), [lowStocks]);

  return (
    <div style={{ background: palette.bg, padding: 12, borderRadius: 12 }}>
      <Row gutter={[16, 16]}>
        <Col xs={24} md={6}>
          <Card loading={loading} style={{ background: palette.cardBg }} className="glass-card">
            <Statistic title={<span style={{ color: palette.text }}>物料数</span>} valueStyle={{ color: palette.accent }} value={metrics.materialsCount || 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card loading={loading} style={{ background: palette.cardBg }} className="glass-card">
            <Statistic title={<span style={{ color: palette.text }}>库存总量</span>} valueStyle={{ color: '#a7f3d0' }} value={metrics.stocksQtyOnHand || 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card loading={loading} style={{ background: palette.cardBg }} className="glass-card">
            <Statistic title={<span style={{ color: palette.text }}>{`临期批次（${metrics.expiryDays || 30}天内）`}</span>} valueStyle={{ color: palette.warn }} value={metrics.soonToExpireBatches || 0} />
          </Card>
        </Col>
        <Col xs={24} md={6}>
          <Card loading={loading} style={{ background: palette.cardBg }} className="glass-card">
            <Statistic title={<span style={{ color: palette.text }}>未读预警</span>} valueStyle={{ color: palette.danger }} value={metrics.unreadNotifications || 0} />
          </Card>
        </Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
        <Col xs={24} md={12}><Card loading={loading} style={{ background: palette.cardBg, boxShadow: isLight ? '0 2px 16px 0 rgba(120,120,120,0.08)' : '0 2px 16px 0 rgba(0,0,0,0.18)' }} className="glass-card"><Statistic title={<span style={{ color: palette.text }}>今日入库单数</span>} value={metrics.inboundsToday || 0} valueStyle={{ color: palette.accent }} /></Card></Col>
        <Col xs={24} md={12}><Card loading={loading} style={{ background: palette.cardBg, boxShadow: isLight ? '0 2px 16px 0 rgba(120,120,120,0.08)' : '0 2px 16px 0 rgba(0,0,0,0.18)' }} className="glass-card"><Statistic title={<span style={{ color: palette.text }}>今日出库单数</span>} value={metrics.outboundsToday || 0} valueStyle={{ color: palette.accent2 }} /></Card></Col>
      </Row>
      <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
        <Col xs={24} md={12}>
          <Card
            className="glass-card"
            size="small"
            headStyle={{ padding: '8px 12px' }}
            bodyStyle={{ padding: 12 }}
            style={{ background: palette.cardBg }}
            title={<span style={{ color: palette.text }}>趋势（14天）</span>}>
            <div style={{ height: 220, position: 'relative' }}>
              <svg width="100%" height="220" viewBox="0 0 600 220" preserveAspectRatio="none">
                {/* grid */}
                {Array.from({ length: 6 }).map((_, i) => (
                  <line key={i} x1={0} x2={600} y1={10 + i * 35} y2={10 + i * 35} stroke={palette.grid} strokeWidth={1} />
                ))}
                {/* lines */}
                {trends.length > 0 && ['inbounds', 'outbounds'].map((key) => {
                  const max = Math.max(1, ...trends.map(t => Math.max(t.inbounds || 0, t.outbounds || 0)));
                  const W = 600, H = 190, L = 20, T = 10;
                  const step = (W - L * 2) / Math.max(1, trends.length - 1);
                  const y = (v: number) => T + H - (v / max) * H;
                  let d = '';
                  trends.forEach((t, i) => {
                    const x = L + i * step; const yy = y(Number((t as any)[key] || 0));
                    d += (i === 0 ? `M ${x},${yy}` : ` L ${x},${yy}`);
                  });
                  return <path key={key} d={d} fill="none" stroke={key === 'inbounds' ? '#22d3ee' : '#60a5fa'} strokeWidth={2} />;
                })}
              </svg>
              <div style={{ position: 'absolute', bottom: 0, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', color: palette.text, opacity: .6, fontSize: 12 }}>
                {trends.map((t, i) => (<span key={i}>{(t.date || '').slice(5)}</span>))}
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            className="glass-card"
            size="small"
            headStyle={{ padding: '8px 12px' }}
            bodyStyle={{ padding: 12 }}
            style={{ background: palette.cardBg }}
            title={<span style={{ color: palette.text }}>低库存 Top6</span>}>
            <div style={{ height: 200, display: 'flex', alignItems: 'flex-end', gap: 8, padding: '0 8px' }}>
              {lowStocks.map((r: any, idx: number) => {
                const h = Math.max(4, (Number(r.qty || 0) / maxLow) * 180);
                return (
                  <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', color: palette.text }}>
                    <div style={{ width: '100%', height: h, background: 'linear-gradient(180deg, #f59f00, #f97316)', borderRadius: 4 }} />
                    <div style={{ fontSize: 12, opacity: .8, marginTop: 6, textAlign: 'center', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.materialcode || r.materialCode || r.material || '—'}</div>
                  </div>
                );
              })}
              {!lowStocks.length && <div style={{ color: palette.text, opacity: .6 }}>暂无数据</div>}
            </div>
          </Card>
        </Col>
      </Row>
    <Row gutter={[16, 16]} style={{ marginTop: 12 }}>
        <Col xs={24} md={12}>
      <Card className="glass-card" size="small" headStyle={{ padding: '8px 12px' }} bodyStyle={{ padding: 12 }} style={{ background: palette.cardBg }} title={<span style={{ color: palette.text }}>快捷操作</span>}>
            <Space>
              <Link to="/inbound-new"><Button type="primary">新建入库</Button></Link>
              <Link to="/outbound-new"><Button>新建出库</Button></Link>
              <Button onClick={() => window.location.reload()}>刷新</Button>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
      <Card className="glass-card" size="small" headStyle={{ padding: '8px 12px' }} bodyStyle={{ padding: 12 }} style={{ background: palette.cardBg }} title={<span style={{ color: palette.text }}>预警（未读）</span>} extra={<Button size="small" onClick={async () => { await api.post('/notifications/mark-all-read'); message.success('已全部标记为已读'); window.location.reload(); }}>全部已读</Button>}>
            <List
              size="small"
              dataSource={alerts}
        locale={{ emptyText: <div style={{ padding: '12px 0', color: isLight ? '#666' : '#94a3b8' }}>暂无预警</div> }}
              renderItem={(it: any) => (
                <List.Item>
                  <Space>
                    <Tag color="orange">预警</Tag>
                    <span>{it.title}</span>
                    <span style={{ color: '#666' }}>{it.message}</span>
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
