import { Layout, Menu, theme, Typography, Button } from 'antd'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { HomeOutlined, DatabaseOutlined, InboxOutlined, SendOutlined, SettingOutlined, SwapOutlined, ToolOutlined, DashboardOutlined } from '@ant-design/icons'
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

const { Header, Content, Sider } = Layout

const items = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: <Link to="/dashboard">仪表盘</Link> },
  { key: '/materials', icon: <DatabaseOutlined />, label: <Link to="/materials">物料</Link> },
  { key: '/stocks', icon: <InboxOutlined />, label: <Link to="/stocks">库存</Link> },
  { key: '/inbounds', icon: <InboxOutlined />, label: <Link to="/inbounds">入库单</Link> },
  { key: '/outbounds', icon: <SendOutlined />, label: <Link to="/outbounds">出库单</Link> },
  { key: '/transfer', icon: <SwapOutlined />, label: <Link to="/transfer">移库</Link> },
  { key: '/adjust', icon: <ToolOutlined />, label: <Link to="/adjust">盘点/调整</Link> },
  { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">设置</Link> },
]

type AppProps = { isDark?: boolean; onToggleTheme?: () => void }
export default function App({ isDark, onToggleTheme }: AppProps) {
  const loc = useLocation()
  const { token } = theme.useToken()
  const pathname = loc.pathname
  const selectedKey = (() => {
    if (pathname.startsWith('/inbounds')) return '/inbounds'
    if (pathname.startsWith('/outbounds')) return '/outbounds'
    if (pathname.startsWith('/materials')) return '/materials'
    if (pathname.startsWith('/stocks')) return '/stocks'
    if (pathname.startsWith('/transfer')) return '/transfer'
    if (pathname.startsWith('/adjust')) return '/adjust'
    if (pathname.startsWith('/settings')) return '/settings'
    if (pathname.startsWith('/dashboard')) return '/dashboard'
    return ''
  })()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
  <div style={{ height: 48, margin: 16, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="brand">Factory Materials</div>
        </div>
  <Menu theme={isDark ? 'dark' : 'light'} mode="inline" selectedKeys={[selectedKey]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingInline: 16 }}>
          <Typography.Title level={4} style={{ margin: 0 }} className="app-header-title">工厂物料管理系统</Typography.Title>
          <div className="header-actions">
            <Button size="small" onClick={onToggleTheme}>{isDark ? '浅色' : '深色'}</Button>
            <Link to="/settings"><Button size="small" type="primary">设置</Button></Link>
          </div>
        </Header>
        <Content style={{ margin: 16 }}>
          <div className="glass-card" style={{ padding: 16, borderRadius: 12 }}>
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
            </Routes>
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
