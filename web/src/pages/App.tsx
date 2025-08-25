import { Layout, Menu, theme, Typography } from 'antd'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import { HomeOutlined, DatabaseOutlined, InboxOutlined, SendOutlined, SettingOutlined, SwapOutlined, ToolOutlined } from '@ant-design/icons'
import MaterialsPage from './Materials'
import StocksPage from './Stocks'
import InboundPage from './Inbound'
import OutboundPage from './Outbound'
import SettingsPage from './Settings'
import TransferPage from './Transfer'
import AdjustPage from './Adjust'
import LoginPage from './Login'

const { Header, Content, Sider } = Layout

const items = [
  { key: '/', icon: <HomeOutlined />, label: <Link to="/">首页</Link> },
  { key: '/materials', icon: <DatabaseOutlined />, label: <Link to="/materials">物料</Link> },
  { key: '/stocks', icon: <InboxOutlined />, label: <Link to="/stocks">库存</Link> },
  { key: '/inbound', icon: <InboxOutlined />, label: <Link to="/inbound">入库</Link> },
  { key: '/outbound', icon: <SendOutlined />, label: <Link to="/outbound">出库</Link> },
  { key: '/transfer', icon: <SwapOutlined />, label: <Link to="/transfer">移库</Link> },
  { key: '/adjust', icon: <ToolOutlined />, label: <Link to="/adjust">盘点/调整</Link> },
  { key: '/settings', icon: <SettingOutlined />, label: <Link to="/settings">设置</Link> },
]

export default function App() {
  const loc = useLocation()
  const { token } = theme.useToken()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth="0">
        <div style={{ height: 48, margin: 16, color: '#fff', display: 'flex', alignItems: 'center' }}>物料管理</div>
        <Menu theme="dark" mode="inline" selectedKeys={[loc.pathname]} items={items} />
      </Sider>
      <Layout>
        <Header style={{ background: token.colorBgContainer }}>
          <Typography.Title level={4} style={{ margin: 0 }}>工厂物料管理系统</Typography.Title>
        </Header>
        <Content style={{ margin: 16 }}>
          <Routes>
            <Route path="/" element={<div>欢迎使用，左侧选择功能。</div>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/materials" element={<MaterialsPage />} />
            <Route path="/stocks" element={<StocksPage />} />
            <Route path="/inbound" element={<InboundPage />} />
            <Route path="/outbound" element={<OutboundPage />} />
            <Route path="/transfer" element={<TransferPage />} />
            <Route path="/adjust" element={<AdjustPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}
