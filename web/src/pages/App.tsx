import React from 'react'
import { Layout, Menu, theme, Typography, Button, Input, Modal, Avatar, Tag, Popover, Divider, Badge, List } from 'antd'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DatabaseOutlined, InboxOutlined, SendOutlined, SettingOutlined, SwapOutlined, ToolOutlined, DashboardOutlined, ExperimentOutlined, BellOutlined, SearchOutlined, MoonOutlined, SunOutlined, UserOutlined, RightOutlined, QuestionCircleOutlined, PlusSquareOutlined, CrownFilled, EyeOutlined } from '@ant-design/icons'
import MaterialsPage from './Materials'
import StocksPage from './Stocks'
import InboundPage from './Inbound'
import OutboundPage from './Outbound'
import InboundListPage from './InboundsList'
import OutboundListPage from './OutboundsList'
import InboundDetailPage from './InboundDetail'
import OutboundDetailPage from './OutboundDetail'
import SettingsPage from './Settings'
import TransferPage from './Transfer'
import AdjustPage from './Adjust'
import LoginPage from './Login'
import Splash from './Splash'
import Dashboard from './Dashboard'
import HelpPage from './Help'
import { isTokenExpired } from '@/api/http'

const { Header, Content, Sider } = Layout

const items = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">仪表盘</Link> },
  { key: '/materials', icon: <DatabaseOutlined />, label: <Link to="/materials">物料</Link> },
  { key: '/stocks', icon: <InboxOutlined />, label: <Link to="/stocks">库存</Link> },
  { key: '/inbounds', icon: <InboxOutlined />, label: <Link to="/inbounds">入库</Link> },
  { key: '/outbounds', icon: <SendOutlined />, label: <Link to="/outbounds">出库</Link> },
  { key: '/transfer', icon: <SwapOutlined />, label: <Link to="/transfer">移库</Link> },
  { key: '/adjust', icon: <ToolOutlined />, label: <Link to="/adjust">盘点</Link> },
  // 设置与帮助从侧栏移除，保留在右上角
]

type AppProps = { isDark?: boolean; onToggleTheme?: () => void }
export default function App({ isDark, onToggleTheme }: AppProps) {
  const loc = useLocation()
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
  const notifications = React.useMemo(() => (
    [
      { id: 'n1', title: '库存预警', desc: 'M001 批次将于30天后到期', type: 'warning' },
      { id: 'n2', title: '入库完成', desc: 'IN202508-001 上架完成', type: 'success' },
    ]
  ), [])
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
            <Input allowClear prefix={<SearchOutlined />} placeholder="全局搜索（物料/单号/批次）" style={{ width: 360 }} onPressEnter={(e)=>{ /* 预留搜索逻辑 */ }} />
            <Popover content={
              <div style={{ width: 300 }}>
                <List
                  dataSource={notifications}
                  renderItem={(n)=> (
                    <List.Item>
                      <List.Item.Meta
                        title={n.title}
                        description={n.desc}
                      />
                    </List.Item>
                  )}
                />
              </div>
            } trigger="click" open={notifOpen} onOpenChange={setNotifOpen}>
              <Badge count={notifications.length} size="small">
                <Button type="text" icon={<BellOutlined />} />
              </Badge>
            </Popover>
            <Link to="/help"><Button type="text" icon={<QuestionCircleOutlined />} /></Link>
            <Button type="text" onClick={onToggleTheme} icon={isDark ? <SunOutlined /> : <MoonOutlined />} />
            <Link to="/settings"><Button type="text" icon={<SettingOutlined />} /></Link>
          </div>
        </Header>
        <Content style={{ margin: 16 }}>
          <div key={pathname} className="glass-card page-fade" style={{ padding: 16, borderRadius: 12 }}>
            <Routes>
            <Route path="/" element={<Splash />} />
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
            <Route path="/settings" element={<SettingsPage />} />
              <Route path="/help" element={<HelpPage />} />
            {/* 未登录则仅允许访问根封面与登录页 */}
            {!authed && <Route path="*" element={<Navigate to="/" replace />} />}
            </Routes>
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
