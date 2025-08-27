import React from 'react'
import { Layout, Menu, theme, Typography, Button, Input, Modal, Avatar, Tag, Popover, Divider, Badge, List, Space, Segmented, Alert } from 'antd'
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import DatabaseOutlined from '@ant-design/icons/DatabaseOutlined'
import InboxOutlined from '@ant-design/icons/InboxOutlined'
import SendOutlined from '@ant-design/icons/SendOutlined'
import SettingOutlined from '@ant-design/icons/SettingOutlined'
import SwapOutlined from '@ant-design/icons/SwapOutlined'
import ToolOutlined from '@ant-design/icons/ToolOutlined'
import DashboardOutlined from '@ant-design/icons/DashboardOutlined'
import ExperimentOutlined from '@ant-design/icons/ExperimentOutlined'
import BellOutlined from '@ant-design/icons/BellOutlined'
import SearchOutlined from '@ant-design/icons/SearchOutlined'
import MoonOutlined from '@ant-design/icons/MoonOutlined'
import SunOutlined from '@ant-design/icons/SunOutlined'
import RightOutlined from '@ant-design/icons/RightOutlined'
import QuestionCircleOutlined from '@ant-design/icons/QuestionCircleOutlined'
import CrownFilled from '@ant-design/icons/CrownFilled'
import EyeOutlined from '@ant-design/icons/EyeOutlined'
import BarChartOutlined from '@ant-design/icons/BarChartOutlined'
import Splash from './Splash'
import { initPWA } from '@/pwa'
const MaterialsPage = React.lazy(()=> import('@/pages/Materials'))
const StocksPage = React.lazy(()=> import('@/pages/Stocks'))
const InboundPage = React.lazy(()=> import('@/pages/Inbound'))
const OutboundPage = React.lazy(()=> import('@/pages/Outbound'))
const InboundListPage = React.lazy(()=> import('@/pages/InboundsList'))
const OutboundListPage = React.lazy(()=> import('@/pages/OutboundsList'))
const InboundDetailPage = React.lazy(()=> import('@/pages/InboundDetail'))
const OutboundDetailPage = React.lazy(()=> import('@/pages/OutboundDetail'))
const SettingsPage = React.lazy(()=> import('@/pages/Settings'))
const TransferPage = React.lazy(()=> import('@/pages/Transfer'))
const AdjustPage = React.lazy(()=> import('@/pages/Adjust'))
const LoginPage = React.lazy(()=> import('@/pages/Login'))
const Dashboard = React.lazy(()=> import('@/pages/Dashboard'))
const HelpPage = React.lazy(()=> import('@/pages/Help'))
const SearchResultsPage = React.lazy(()=> import('@/pages/SearchResults'))
const AnalyticsPage = React.lazy(()=> import('@/pages/Analytics'))
import { api, isTokenExpired } from '@/api/http'

const { Header, Content, Sider } = Layout

const items = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">仪表盘</Link> },
  { key: '/materials', icon: <DatabaseOutlined />, label: <Link to="/materials">物料</Link> },
  { key: '/stocks', icon: <InboxOutlined />, label: <Link to="/stocks">库存</Link> },
  { key: '/inbounds', icon: <InboxOutlined />, label: <Link to="/inbounds">入库</Link> },
  { key: '/outbounds', icon: <SendOutlined />, label: <Link to="/outbounds">出库</Link> },
  { key: '/transfer', icon: <SwapOutlined />, label: <Link to="/transfer">移库</Link> },
  { key: '/adjust', icon: <ToolOutlined />, label: <Link to="/adjust">盘点</Link> },
  { key: '/analytics', icon: <BarChartOutlined />, label: <Link to="/analytics">分析/报表</Link> },
  // 设置与帮助从侧栏移除，保留在右上角
]

type AppProps = { isDark?: boolean; onToggleTheme?: () => void }
export default function App({ isDark, onToggleTheme }: AppProps) {
  const [updateReady, setUpdateReady] = React.useState<null | ((reload?: boolean)=>void)>(null)
  React.useEffect(()=>{
    initPWA((update)=> setUpdateReady(()=> update))
  }, [])
  const loc = useLocation()
  const navigate = useNavigate()
  const { token } = theme.useToken()
  const role = (localStorage.getItem('role') || 'VIEWER') as 'ADMIN'|'OP'|'VIEWER'
  const rawToken = localStorage.getItem('token')
  const authed = !!rawToken && !isTokenExpired(rawToken)
  if (rawToken && isTokenExpired(rawToken)) {
    localStorage.removeItem('token');
  }
  const username = localStorage.getItem('username') || '未登录'
  const [userOpen, setUserOpen] = React.useState(false)
  const [notifOpen, setNotifOpen] = React.useState(false)
  const [notifications, setNotifications] = React.useState<any[]>([])
  const [notifStatus, setNotifStatus] = React.useState<'ALL'|'UNREAD'>('ALL')
  const [isOffline, setIsOffline] = React.useState(!navigator.onLine)
  React.useEffect(()=>{
    const on = () => setIsOffline(false)
    const off = () => setIsOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return ()=> { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  const loadNotifications = React.useCallback(async ()=>{
    try {
      const params: any = {}
      if (notifStatus === 'UNREAD') params.status = 'UNREAD'
      const { data } = await api.get('/notifications', { params })
      setNotifications((data||[]).map((n:any)=>({ id:n.id, title:n.title, desc:n.message, type:n.type, status:n.status })))
    } catch {}
  }, [notifStatus])
  React.useEffect(()=>{ if (authed) loadNotifications() }, [authed, loadNotifications])
  React.useEffect(()=>{
    if (!authed) return
    const t = setInterval(()=> loadNotifications(), 15000)
    return ()=> clearInterval(t)
  }, [authed, loadNotifications])
  const onNotificationClick = async (n: any) => {
    try {
      await api.post(`/notifications/${n.id}/read`)
    } catch {}
    // 简单解析跳转
    const msg: string = n.desc || ''
    const inb = msg.match(/入库单\s(\S+)/)
    const outb = msg.match(/出库单\s(\S+)/)
    if (inb?.[1]) {
      navigate(`/inbounds/${inb[1]}`)
    } else if (outb?.[1]) {
      navigate(`/outbounds/${outb[1]}`)
    } else {
      // 处理库存/临期/滞销等预警：从文案中提取物料与批次，跳转到库存页并带筛选
      const mat = msg.match(/物料\s([A-Za-z0-9_-]+)/)
      const batch = msg.match(/批次\s([^\s]+)/)
      if (mat?.[1]) {
        const sp = new URLSearchParams({ materialCode: mat[1], ...(batch?.[1]?{ batchNo: batch[1] }: {}) }).toString()
        navigate(`/stocks?${sp}`)
      } else {
        navigate('/stocks')
      }
    }
    loadNotifications()
  }
  if (!authed && loc.pathname === '/') {
    // 未登录且处于根路径：只显示封面页（独立页面，不渲染系统布局）
    return <Splash />
  }
  const pathname = loc.pathname
  const selectedKey = (() => {
    if (pathname.startsWith('/inbounds')) return '/inbounds'
    if (pathname.startsWith('/outbounds')) return '/outbounds'
  if (pathname.startsWith('/inbound-new')) return '/inbound-new'
  if (pathname.startsWith('/outbound-new')) return '/outbound-new'
    if (pathname.startsWith('/materials')) return '/materials'
    if (pathname.startsWith('/stocks')) return '/stocks'
    if (pathname.startsWith('/transfer')) return '/transfer'
    if (pathname.startsWith('/adjust')) return '/adjust'
    if (pathname.startsWith('/dashboard')) return '/dashboard'
  if (pathname.startsWith('/analytics')) return '/analytics'
    return ''
  })()

  // 菜单按角色过滤（VIEWER 隐藏写操作）
  const menusByRole = items.filter(it => {
    if (['/transfer','/adjust'].includes(it.key)) return role !== 'VIEWER'
    return true
  })

  const pageTitle = (() => {
    if (selectedKey === '/dashboard') return '仪表盘'
    if (selectedKey === '/materials') return '物料'
    if (selectedKey === '/stocks') return '库存'
    if (selectedKey === '/inbounds') return '入库'
    if (selectedKey === '/outbounds') return '出库'
  if (selectedKey === '/inbound-new') return '新建入库'
  if (selectedKey === '/outbound-new') return '新建出库'
    if (selectedKey === '/transfer') return '移库'
    if (selectedKey === '/adjust') return '盘点'
  if (selectedKey === '/analytics') return '分析/报表'
    if (pathname.startsWith('/settings')) return '设置'
    if (pathname.startsWith('/help')) return '帮助'
    return '工厂物料管理系统'
  })()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0" style={{ background: isDark ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.85)' }} width={208}>
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          {/* 品牌区 */}
          <div style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <ExperimentOutlined style={{ color: '#16a34a', fontSize: 30 }} />
            <div style={{ lineHeight: 1.04 }}>
              <div style={{ fontWeight: 900, color: '#16a34a', fontSize: 20, letterSpacing: 1 }}>青绿氢能</div>
              <div style={{ fontSize: 10, color: '#86efac', letterSpacing: 2 }}>QINGLV QINENG</div>
            </div>
          </div>
          {/* 导航 */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <Menu style={{ paddingInline: 8 }} theme={isDark ? 'dark' : 'light'} mode="inline" selectedKeys={[selectedKey]} items={menusByRole} />
          </div>
          {/* 底部：用户卡片（帮助移动到右上角） */}
          <div style={{ padding: 12, borderTop: '1px solid var(--card-border)' }}>
            <div onClick={()=>setUserOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: 8, borderRadius: 8, background: 'rgba(0,0,0,0.03)' }}>
              <Avatar size={32} style={{ background: role==='ADMIN'?'#16a34a':role==='OP'?'#2563eb':'#94a3b8' }} icon={role==='ADMIN'?<CrownFilled />:role==='OP'?<ToolOutlined />:<EyeOutlined />} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{username}</div>
                <div style={{ fontSize: 12, opacity: .7 }}>等级：{role === 'ADMIN' ? '管理员' : role === 'OP' ? '操作员' : '访客'}</div>
              </div>
              <RightOutlined style={{ fontSize: 12, opacity: .6 }} />
            </div>
          </div>
        </div>
      </Sider>
      <Layout>
        <Header style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 16, gap: 12 }}>
          <Typography.Title level={4} style={{ margin: 0 }} className="app-header-title">{pageTitle}</Typography.Title>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {updateReady && (
              <Button size="small" type="primary" onClick={()=> updateReady(true)}>有更新，点击刷新</Button>
            )}
            <Input allowClear prefix={<SearchOutlined />} placeholder="全局搜索（物料/单号/批次）" style={{ width: 360 }} onPressEnter={(e)=>{ const kw=(e.target as HTMLInputElement).value.trim(); if(kw) navigate(`/search?q=${encodeURIComponent(kw)}`) }} />
            <Popover content={
              <div style={{ width: 360 }}>
                <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8, alignItems: 'center' }}>
                  <div style={{ fontWeight: 600 }}>通知</div>
                  <Space>
                    <Segmented size="small" value={notifStatus} onChange={(v)=> setNotifStatus(v as any)} options={[{ label:'全部', value:'ALL' }, { label:'仅未读', value:'UNREAD' }]} />
                    <Button size="small" onClick={loadNotifications}>刷新</Button>
                    <Button size="small" onClick={()=>{ const qs = new URLSearchParams({ ...(notifStatus==='UNREAD'?{ status:'UNREAD' }:{} ) }).toString(); const a=document.createElement('a'); a.href='/api/notifications.csv'+(qs?'?'+qs:''); a.download='notifications.csv'; a.click(); }}>导出</Button>
                    <Button size="small" onClick={async()=>{ await api.post('/notifications/mark-all-read'); loadNotifications() }}>全部已读</Button>
                  </Space>
                </div>
                <List dataSource={notifications} renderItem={(n)=> (
                  <List.Item onClick={()=> onNotificationClick(n)} style={{ cursor: 'pointer', background: n.status==='UNREAD'?'rgba(255,77,79,0.06)':'transparent' }}>
                    <List.Item.Meta title={n.title} description={n.desc} />
                    {n.status==='UNREAD' && <Tag color="red">未读</Tag>}
                  </List.Item>
                )} />
              </div>
            } trigger="click" open={notifOpen} onOpenChange={(open)=> { setNotifOpen(open); if (open) loadNotifications() }}>
              <Badge count={notifications.filter(n=>n.status==='UNREAD').length} size="small">
                <Button type="text" icon={<BellOutlined />} />
              </Badge>
            </Popover>
            <Link to="/help"><Button type="text" icon={<QuestionCircleOutlined />} /></Link>
            <Button type="text" onClick={onToggleTheme} icon={isDark ? <SunOutlined /> : <MoonOutlined />} />
            <Link to="/settings"><Button type="text" icon={<SettingOutlined />} /></Link>
          </div>
        </Header>
        <Content style={{ margin: 16 }}>
          {isOffline && (
            <div style={{ marginBottom: 12 }}>
              <Alert type="warning" showIcon message="您处于离线状态" description="可继续浏览已缓存页面，部分接口不可用。" />
            </div>
          )}
          <div key={pathname} className="glass-card page-fade" style={{ padding: 16, borderRadius: 12 }}>
            <React.Suspense fallback={<div style={{ padding: 24 }}>加载中...</div>}>
            <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/search" element={<SearchResultsPage />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/stocks" element={<StocksPage />} />
              <Route path="/inbound-new" element={<InboundPage />} />
              <Route path="/outbound-new" element={<OutboundPage />} />
            <Route path="/inbounds" element={<InboundListPage />} />
            <Route path="/outbounds" element={<OutboundListPage />} />
            <Route path="/inbounds/:code" element={<InboundDetailPage />} />
            <Route path="/outbounds/:code" element={<OutboundDetailPage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="/adjust" element={<AdjustPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help" element={<HelpPage />} />
            {/* 未登录则仅允许访问根封面与登录页 */}
            {!authed && <Route path="*" element={<Navigate to="/" replace />} />}
            </Routes>
            </React.Suspense>
          </div>
        </Content>
        {/* 用户详情弹窗 */}
        <Modal title="用户信息" open={userOpen} onCancel={()=>setUserOpen(false)} footer={null} destroyOnClose>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Avatar size={48} style={{ background: role==='ADMIN'?'#16a34a':role==='OP'?'#2563eb':'#94a3b8' }} icon={role==='ADMIN'?<CrownFilled />:role==='OP'?<ToolOutlined />:<EyeOutlined />} />
            <div>
              <div style={{ fontWeight: 700 }}>{username}</div>
              <Tag color={role==='ADMIN'?'green':role==='OP'?'blue':'default'}>{role}</Tag>
            </div>
          </div>
          <Divider style={{ margin: '8px 0' }} />
          <div style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>这里将展示账号与权限信息、最近登录记录等。</div>
          <Button danger onClick={()=>{
            localStorage.removeItem('token');
            localStorage.removeItem('role');
            localStorage.removeItem('username');
            window.location.href = '/';
          }}>退出当前登录</Button>
        </Modal>
      </Layout>
    </Layout>
  )
}
