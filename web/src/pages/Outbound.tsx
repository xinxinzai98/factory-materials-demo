import { useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Radio, Space, Table, message, Select } from 'antd'
import { api } from '@/api/http'

type Item = { materialCode: string; qty: number; batchPolicy?: 'SYSTEM' | 'SPECIFIED'; batchNo?: string }

export default function OutboundPage() {
  const [form] = Form.useForm()
  const [items, setItems] = useState<Item[]>([])

  const addItem = (it: Item) => setItems((prev: Item[]) => [...prev, it])

  const submit = async () => {
    const v = await form.validateFields()
    const payload = { code: v.code, purpose: 'MO_ISSUE', warehouseCode: v.warehouseCode || 'WH1', items }
    await api.post('/outbounds', payload)
    message.success('出库成功')
    setItems([])
    form.resetFields()
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
    <Card className="glass-card" title="出库单">
        <Form form={form} layout="inline">
          <Form.Item name="code" rules={[{ required: true }]}><Input placeholder="出库单号" /></Form.Item>
      <Form.Item name="warehouseCode" initialValue="WH1"><Select placeholder="仓库名称" style={{ minWidth: 140 }} options={[{value:'WH1',label:'主仓'}]} /></Form.Item>
          <Form.Item><Button type="primary" onClick={submit}>提交</Button></Form.Item>
        </Form>
      </Card>

    <Card className="glass-card" title="新增出库明细">
        <Form layout="inline" onFinish={addItem} initialValues={{ batchPolicy: 'SYSTEM' }}>
          <Form.Item name="materialCode" rules={[{ required: true }]}><Input placeholder="物料编码" /></Form.Item>
          <Form.Item name="qty" rules={[{ required: true }]}><InputNumber placeholder="数量" min={0} /></Form.Item>
          <Form.Item name="batchPolicy"><Radio.Group options={[{label:'系统策略',value:'SYSTEM'},{label:'指定批次',value:'SPECIFIED'}]} /></Form.Item>
          <Form.Item name="batchNo"><Input placeholder="批次（指定批次时填写）" /></Form.Item>
          <Form.Item><Button htmlType="submit">添加</Button></Form.Item>
        </Form>
      </Card>

  <Table rowKey={(_r, i)=> String(i)} dataSource={items} pagination={false}
        columns={[
          { title: '物料', dataIndex: 'materialCode' },
          { title: '数量', dataIndex: 'qty' },
          { title: '策略', dataIndex: 'batchPolicy' },
          { title: '批次', dataIndex: 'batchNo' },
        ]}
      />
    </Space>
  )
}
