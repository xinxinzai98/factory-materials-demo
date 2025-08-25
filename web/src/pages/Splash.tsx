import { Button } from 'antd'
import { Link } from 'react-router-dom'

export default function Splash() {
  return (
    <div className="hero" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
        <h1 className="hero-title">工厂物料管理系统</h1>
        <p className="hero-sub">更安全 · 更高效 · 更优雅</p>
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Link to="/dashboard"><Button type="primary" size="large" shape="round">进入系统</Button></Link>
          <Link to="/inbound-new"><Button size="large" shape="round">快速入库</Button></Link>
        </div>
      </div>
    </div>
  )
}
