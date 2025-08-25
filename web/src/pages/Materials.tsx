import { useEffect, useState } from 'react'
import { Button, Form, Input, Space, Table, message, Flex } from 'antd'
import { api } from '@/api/http'

type Material = {
  id: string
  code: string
  name: string
  uom: string
  spec?: string
  category?: string
  barcode?: string
  isBatch: boolean
  shelfLifeDays?: number
  enabled: boolean
}

export default function MaterialsPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Material[]>([])

  const [form] = Form.useForm()

  const fetchData = async (q?: string) => {
    setLoading(true)
    try {
      const resp = await api.get('/materials', { params: { q, page: 1, pageSize: 50 } })
      setData(resp.data.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const onCreate = async (values: any) => {
    await api.post('/materials', values)
    message.success('已创建')
    form.resetFields()
    fetchData()
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Flex gap={8}>
        <Form layout="inline" onFinish={({ q }) => fetchData(q)}>
          <Form.Item name="q"><Input placeholder="搜索 物料编码/名称" allowClear /></Form.Item>
          <Form.Item><Button htmlType="submit" type="primary">查询</Button></Form.Item>
        </Form>
      </Flex>

      <Form form={form} layout="inline" onFinish={onCreate}>
        <Form.Item name="code" rules={[{ required: true }]}><Input placeholder="物料编码" /></Form.Item>
        <Form.Item name="name" rules={[{ required: true }]}><Input placeholder="物料名称" /></Form.Item>
        <Form.Item name="uom" initialValue="PCS" rules={[{ required: true }]}><Input placeholder="单位" /></Form.Item>
        <Form.Item><Button type="primary" htmlType="submit">新增物料</Button></Form.Item>
      </Form>

      <Table rowKey="id" loading={loading} dataSource={data} pagination={false}
        columns={[
          { title: '编码', dataIndex: 'code' },
          { title: '名称', dataIndex: 'name' },
          { title: '单位', dataIndex: 'uom' },
          { title: '分类', dataIndex: 'category' },
          { title: '是否批次', dataIndex: 'isBatch', render: (v:boolean)=> v? '是':'否' },
        ]}
      />
    </Space>
  )
}
