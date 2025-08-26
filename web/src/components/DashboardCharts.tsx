import { Card, Row, Col } from 'antd'
import { Pie, Column } from '@ant-design/plots'

export function DashboardCharts({ stats }: { stats: any }) {
  // 示例数据，可替换为后端真实聚合
  const pieData = [
    { type: '临期批次', value: stats.soonToExpireBatches || 0 },
    { type: '滞销物料', value: stats.slowMaterials || 0 },
    { type: '安全库存', value: (stats.materialsCount || 0) - (stats.soonToExpireBatches || 0) - (stats.slowMaterials || 0) },
  ]
  const columnData = [
    { name: '今日入库', value: stats.inboundsToday || 0 },
    { name: '今日出库', value: stats.outboundsToday || 0 },
    { name: '未读预警', value: stats.unreadNotifications || 0 },
  ]
  return (
    <Row gutter={[16,16]}>
      <Col xs={24} md={12}>
        <Card bordered={false} style={{ borderRadius: 16, background: 'rgba(30,41,59,0.85)', color: '#fff' }}>
          <Pie
            data={pieData}
            angleField="value"
            colorField="type"
            radius={0.9}
            legend={{ position: 'bottom', itemName: { style: { fill: '#fff' } } }}
            label={{ type: 'outer', style: { fill: '#fff', fontWeight: 600 } }}
            color={['#f59f00','#fa541c','#16a34a']}
            innerRadius={0.5}
            statistic={{ title: { style: { fill: '#fff' } }, content: { style: { fill: '#fff' } } }}
            style={{ height: 260 }}
          />
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card bordered={false} style={{ borderRadius: 16, background: 'rgba(30,41,59,0.85)', color: '#fff' }}>
          <Column
            data={columnData}
            xField="name"
            yField="value"
            color={[ '#16a34a', '#2563eb', '#fa541c' ]}
            columnStyle={{ radius: [8,8,0,0] }}
            label={{ position: 'middle', style: { fill: '#fff', fontWeight: 600 } }}
            style={{ height: 260 }}
          />
        </Card>
      </Col>
    </Row>
  )
}
