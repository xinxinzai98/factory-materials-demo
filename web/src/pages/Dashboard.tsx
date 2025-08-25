import { Card, Col, Row, Statistic, Button } from 'antd'
import { Link } from 'react-router-dom'

export default function Dashboard() {
  return (
    <div>
      <Row gutter={[16,16]}>
        <Col xs={24} md={8}><Card className="glass-card"><Statistic title="物料数" value={128} /></Card></Col>
        <Col xs={24} md={8}><Card className="glass-card"><Statistic title="库存总量" value={32560} /></Card></Col>
        <Col xs={24} md={8}><Card className="glass-card"><Statistic title="即将到期批次" value={12} valueStyle={{ color: '#f59f00' }} /></Card></Col>
      </Row>
      <Row gutter={[16,16]} style={{ marginTop: 16 }}>
        <Col xs={24} md={12}><Card className="glass-card" title="快捷操作"><Link to="/inbound-new"><Button type="primary">新建入库</Button></Link> <Link to="/outbound-new" style={{ marginLeft: 8 }}><Button>新建出库</Button></Link></Card></Col>
        <Col xs={24} md={12}><Card className="glass-card" title="最近动态">后续可接入最新单据与调整记录...</Card></Col>
      </Row>
    </div>
  )
}
