import { useEffect, useState } from 'react'
import { Button, Card, DatePicker, Form, Input, Select, Space, Table, Tag, message } from 'antd'
import { Link } from 'react-router-dom'
import { api } from '@/api/http'

export default function OutboundsListPage() {
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  const load = async (params?: any) => {
    setLoading(true)
    try {
      const { data } = await api.get('/outbounds', { params: { page: 1, pageSize: 50, ...(params||{}) } })
      setRows(data.data)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])


  const approve = async (code: string) => {
    await api.post(`/outbounds/${code}/approve`)
    message.success('已审批')
    load()
  }
  const pick = async (code: string) => {
    await api.post(`/outbounds/${code}/pick`)
    message.success('已拣货过账')
    load()
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }}>
  <Card className="glass-card" title="出库" extra={
      <Space>
        <Button onClick={()=> window.open('/api/outbounds.csv', '_blank')}>导出 CSV</Button>
        <Link to="/outbound-new">新建出库</Link>
      </Space>
    }>
        <Form form={form} layout="inline" onFinish={(v)=>{
          const q = { ...v } as any
          if (v.dateRange) {
            q.dateFrom = v.dateRange[0]?.format('YYYY-MM-DD')
            q.dateTo = v.dateRange[1]?.format('YYYY-MM-DD')
          }
          delete q.dateRange
          load(q)
        }} style={{ marginBottom: 12 }}>
          <Form.Item name="code"><Input placeholder="单号" allowClear /></Form.Item>
          <Form.Item name="status"><Select placeholder="状态" allowClear style={{ width: 140 }} options={[{value:'DRAFT',label:'DRAFT'},{value:'APPROVED',label:'APPROVED'},{value:'PICKED',label:'PICKED'},{value:'CANCELLED',label:'CANCELLED'}]} /></Form.Item>
          <Form.Item name="dateRange"><DatePicker.RangePicker /></Form.Item>
          <Form.Item><Button htmlType="submit" type="primary">查询</Button></Form.Item>
        </Form>
        <Table rowKey="code" loading={loading} dataSource={rows}
          columns={[
            { title: '单号', dataIndex: 'code', render: (v: string) => <Link to={`/outbounds/${v}`}>{v}</Link> },
            { title: '用途', dataIndex: 'purpose' },
            { title: '状态', dataIndex: 'status', render: (v: string) => <Tag color={v==='DRAFT'?'default':v==='APPROVED'?'blue':'green'}>{v}</Tag> },
            { title: '明细数', dataIndex: 'items', render: (items: any[]) => items?.length || 0 },
            { title: '操作', render: (_: any, r: any) => (
              <Space>
                {r.status==='DRAFT' && <Button size="small" onClick={()=>approve(r.code)}>审批</Button>}
                {r.status==='APPROVED' && <Button size="small" type="primary" onClick={()=>pick(r.code)}>拣货过账</Button>}
              </Space>
            )}
          ]}
        />
      </Card>
    </Space>
  )
}
