import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, InputNumber, Space, Table, message, DatePicker, Select } from 'antd'
import dayjs from 'dayjs'
import { api } from '@/api/http'

type Item = { materialCode: string; qty: number; batchNo?: string; expDate?: string; uprice?: number }

export default function InboundPage() {
  const [form] = Form.useForm()
  const [items, setItems] = useState<Item[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [suppliers, setSuppliers] = useState<{ value: string; label: string }[]>([])
  const [warehouses, setWarehouses] = useState<{ value: string; label: string }[]>([{ value: 'WH1', label: '主仓' }])

  useEffect(() => {
    // 加载供应商列表
    api.get('/suppliers', { params: { enabled: true } }).then(({ data }) => {
      const opts = (data || []).map((s: any) => ({ value: s.name, label: `${s.code} - ${s.name}` }))
      setSuppliers(opts)
    }).catch(() => {})
  }, [])

  const addItem = (it: Item) => {
    setItems((prev: Item[]) => [...prev, it])
  }

  const submit = async () => {
    try {
      setSubmitting(true)
      const v = await form.validateFields()
      const payload = { code: v.code, sourceType: 'PURCHASE', supplier: v.supplier, arriveDate: v.arriveDate?.format('YYYY-MM-DD'), warehouseCode: v.warehouseCode || 'WH1', items: items.map(i=>({ ...i, expDate: i.expDate })) }
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
      <Card className="glass-card" title="入库单">
        <Form form={form} layout="inline">
          <Form.Item name="code" rules={[{ required: true }]}><Input placeholder="入库单号" /></Form.Item>
          <Form.Item name="supplier"><Select placeholder="供应商" style={{ minWidth: 220 }} options={suppliers} allowClear showSearch /></Form.Item>
          <Form.Item name="arriveDate"><DatePicker placeholder="到货日期" /></Form.Item>
          <Form.Item name="warehouseCode" initialValue="WH1"><Select placeholder="仓库名称" style={{ minWidth: 140 }} options={warehouses} /></Form.Item>
          <Form.Item><Button type="primary" onClick={submit} loading={submitting} disabled={items.length===0}>提交</Button></Form.Item>
        </Form>
      </Card>

      <Card className="glass-card" title="新增入库明细">
        <Form layout="inline" onFinish={(v)=> addItem({ ...v, expDate: v.expDate?.format?.('YYYY-MM-DD') })}>
          <Form.Item name="materialCode" rules={[{ required: true }]}><Input placeholder="物料编码" /></Form.Item>
          <Form.Item name="qty" rules={[{ required: true }]}><InputNumber placeholder="数量" min={0} /></Form.Item>
          <Form.Item name="batchNo"><Input placeholder="批次" /></Form.Item>
          <Form.Item name="expDate"><DatePicker placeholder="到期日期" /></Form.Item>
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
