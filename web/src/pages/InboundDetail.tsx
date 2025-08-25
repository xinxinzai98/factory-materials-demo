import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '@/api/http'
import { Button, Card, Descriptions, Space, Table, Tag, message } from 'antd'

export default function InboundDetailPage() {
  const { code } = useParams()
  const [data, setData] = useState<any>()
  const load = async () => {
    const resp = await api.get(`/orders/${code}`)
    setData(resp.data.order)
  }
  useEffect(() => { load() }, [code])

  const approve = async () => { await api.post(`/inbounds/${code}/approve`); message.success('已审批'); load() }
  const putaway = async () => { await api.post(`/inbounds/${code}/putaway`); message.success('已上架过账'); load() }
  const cancel = async () => { await api.post(`/inbounds/${code}/cancel`); message.success('已取消'); load() }

  if (!data) return null
  return (
    <Space direction="vertical" style={{ width: '100%' }}>
  <Card className="glass-card" title={`入库单 ${code}`} extra={<Tag color={data.status==='DRAFT'?'default':data.status==='APPROVED'?'blue':data.status==='PUTAWAY'?'green':'red'}>{data.status}</Tag>}>
        <Descriptions size="small" column={2} bordered>
          <Descriptions.Item label="来源">{data.sourceType}</Descriptions.Item>
          <Descriptions.Item label="供应商">{data.supplier||'-'}</Descriptions.Item>
          <Descriptions.Item span={2} label="到货日期">{data.arriveDate||'-'}</Descriptions.Item>
        </Descriptions>
        <div style={{ marginTop: 12 }}>
          {data.status==='DRAFT' && <Button onClick={approve}>审批</Button>}
          {data.status==='APPROVED' && <Button type="primary" onClick={putaway} style={{ marginLeft: 8 }}>上架过账</Button>}
          {(data.status==='DRAFT' || data.status==='APPROVED') && <Button danger onClick={cancel} style={{ marginLeft: 8 }}>取消</Button>}
        </div>
      </Card>
  <Card className="glass-card" title="明细">
        <Table rowKey="id" dataSource={data.items||[]} pagination={false}
          columns={[
            { title:'物料', dataIndex:'materialId' },
            { title:'数量', dataIndex:'qty' },
            { title:'批次', dataIndex:'batchNo' },
            { title:'到期', dataIndex:'expDate' },
          ]}
        />
      </Card>
    </Space>
  )
}
