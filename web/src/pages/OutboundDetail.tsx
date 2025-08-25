import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/http'
import { Button, Card, Descriptions, Space, Table, Tag, message } from 'antd'

export default function OutboundDetailPage() {
  const { code } = useParams()
  const [data, setData] = useState<any>()
  const load = async () => {
    const resp = await api.get(`/orders/${code}`)
    setData(resp.data.order)
  }
  useEffect(() => { load() }, [code])

  const approve = async () => { await api.post(`/outbounds/${code}/approve`); message.success('已审批'); load() }
  const pick = async () => { await api.post(`/outbounds/${code}/pick`); message.success('已拣货过账'); load() }
  const cancel = async () => { await api.post(`/outbounds/${code}/cancel`); message.success('已取消'); load() }

  if (!data) return null
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
  <Card className="glass-card" title={`出库单 ${code}`} extra={<Tag color={data.status==='DRAFT'?'default':data.status==='APPROVED'?'blue':data.status==='PICKED'?'green':'red'}>{data.status}</Tag>}>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="用途">{data.purpose}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 12 }}>
          {data.status==='DRAFT' && <Button onClick={approve}>审批</Button>}
          {data.status==='APPROVED' && <Button type="primary" onClick={pick} style={{ marginLeft: 8 }}>拣货过账</Button>}
          {(data.status==='DRAFT' || data.status==='APPROVED') && <Button danger onClick={cancel} style={{ marginLeft: 8 }}>取消</Button>}
        </div>
      </Card>
  <Card className="glass-card" title="明细">
        <Table rowKey="id" dataSource={data.items||[]} pagination={false}
          columns={[
            { title:'物料', dataIndex:'materialId' },
            { title:'数量', dataIndex:'qty' },
            { title:'策略', dataIndex:'batchPolicy' },
            { title:'批次', dataIndex:'batchNo' },
          ]}
        />
      </Card>
    </Space>
  )
}
