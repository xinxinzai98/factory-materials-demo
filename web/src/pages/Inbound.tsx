import { useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Space, Table, message } from 'antd'
import { api } from '@/api/http'

type Item = { materialCode: string; qty: number; batchNo?: string; expDate?: string; uprice?: number }

export default function InboundPage() {
  const [form] = Form.useForm()
  const [items, setItems] = useState<Item[]>([])
  const [submitting, setSubmitting] = useState(false)

  const addItem = (it: Item) => {
    setItems((prev: Item[]) => [...prev, it])
  }

  const submit = async () => {
    try {
      setSubmitting(true)
      const v = await form.validateFields()
      const payload = { code: v.code, sourceType: 'PURCHASE', supplier: v.supplier, arriveDate: v.arriveDate, warehouseCode: v.warehouseCode || 'WH1', items }
      const resp = await api.post('/inbounds', payload)
      if (resp.status >= 200 && resp.status < 300) {
        message.success('入库成功')
        setItems([])
        form.resetFields()
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '入库失败'
      message.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Card title="入库单">
        <Form form={form} layout="inline">
          <Form.Item name="code" rules={[{ required: true }]}><Input placeholder="入库单号" /></Form.Item>
          <Form.Item name="supplier"><Input placeholder="供应商" /></Form.Item>
          <Form.Item name="arriveDate"><Input placeholder="到货日期 YYYY-MM-DD" /></Form.Item>
          <Form.Item name="warehouseCode" initialValue="WH1"><Input placeholder="仓库编码" /></Form.Item>
          <Form.Item><Button type="primary" onClick={submit} loading={submitting} disabled={items.length===0}>提交</Button></Form.Item>
        </Form>
      </Card>

      <Card title="新增入库明细">
        <Form layout="inline" onFinish={addItem}>
          <Form.Item name="materialCode" rules={[{ required: true }]}><Input placeholder="物料编码" /></Form.Item>
          <Form.Item name="qty" rules={[{ required: true }]}><InputNumber placeholder="数量" min={0} /></Form.Item>
          <Form.Item name="batchNo"><Input placeholder="批次" /></Form.Item>
          <Form.Item name="expDate"><Input placeholder="到期 YYYY-MM-DD" /></Form.Item>
          <Form.Item><Button htmlType="submit">添加</Button></Form.Item>
        </Form>
      </Card>

  <Table rowKey={(_r, i)=> String(i)} dataSource={items} pagination={false}
        columns={[
          { title: '物料', dataIndex: 'materialCode' },
          { title: '数量', dataIndex: 'qty' },
          { title: '批次', dataIndex: 'batchNo' },
          { title: '到期', dataIndex: 'expDate' },
        ]}
      />
    </Space>
  )
}
