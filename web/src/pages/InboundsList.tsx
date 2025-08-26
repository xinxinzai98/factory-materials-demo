import { useEffect, useState } from 'react'
import { Button, Card, Space, Table, Tag, message } from 'antd'
import { Link } from 'react-router-dom'
import { api } from '@/api/http'

export default function InboundsListPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/inbounds', { params: { page: 1, pageSize: 50 } })
      setRows(data.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])


  const approve = async (code: string) => {
    await api.post(`/inbounds/${code}/approve`)
    message.success('已审批')
    load()
  }
  const putaway = async (code: string) => {
    await api.post(`/inbounds/${code}/putaway`)
    message.success('已上架过账')
    load()
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
  <Card className="glass-card" title="入库" extra={<Link to="/inbound-new">新建入库</Link>}>
        <Table rowKey="code" loading={loading} dataSource={rows}
          columns={[
            { title: '单号', dataIndex: 'code', render: (v: string) => <Link to={`/inbounds/${v}`}>{v}</Link> },
            { title: '来源', dataIndex: 'sourceType' },
            { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v==='DRAFT'?'default':v==='APPROVED'?'blue':'green'}>{v}</Tag> },
            { title: '明细数', dataIndex: 'items', render: (items: any[]) => items?.length || 0 },
            { title: '操作', render: (_: any, r: any) => (
              <Space>
                {r.status==='DRAFT' && <Button size="small" onClick={()=>approve(r.code)}>审批</Button>}
                {r.status==='APPROVED' && <Button size="small" type="primary" onClick={()=>putaway(r.code)}>上架过账</Button>}
              </Space>
            )}
          ]}
        />
      </Card>
    </Space>
  )
}
