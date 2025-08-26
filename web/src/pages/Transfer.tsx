import { Button, Form, Input, InputNumber, message, Space } from 'antd'
import { api } from '@/api/http'

export default function TransferPage() {
  const [form] = Form.useForm()
  const onFinish = async (v: any) => {
    try {
      await api.post('/transfers', v)
      message.success('移库成功')
      form.resetFields()
    } catch (e: any) {
      message.error(e?.response?.data?.message || '移库失败')
    }
  }
  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ qty: 1 }}>
        <Space.Compact block>
          <Form.Item name="materialCode" label="物料编码" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="如 M001" />
          </Form.Item>
          <Form.Item name="qty" label="数量" rules={[{ required: true }]}>
            <InputNumber min={0.0001} step={1} style={{ width: 160 }} />
          </Form.Item>
        </Space.Compact>
        <Space.Compact block>
          <Form.Item name="fromWarehouse" label="来源仓库" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="如 WH1" />
          </Form.Item>
          <Form.Item name="fromBatchNo" label="来源批次(可选)" style={{ flex: 1 }}>
            <Input placeholder="不填则系统策略" />
          </Form.Item>
        </Space.Compact>
        <Space.Compact block>
          <Form.Item name="toWarehouse" label="目标仓库" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="如 WH2" />
          </Form.Item>
          <Form.Item name="toLocation" label="目标库位(可选)" style={{ flex: 1 }}>
            <Input placeholder="可留空" />
          </Form.Item>
        </Space.Compact>
        <Button type="primary" htmlType="submit">提交移库</Button>
      </Form>
    </Space>
  )
}
