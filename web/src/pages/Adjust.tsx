import { Button, Card, Form, Input, InputNumber, message, Space } from 'antd'
import { api } from '@/api/http'

export default function AdjustPage() {
  const [form] = Form.useForm()
  const onFinish = async (v: any) => {
    try {
      await api.post('/adjustments', v)
      message.success('调整成功')
      form.resetFields(['targetQty','reason'])
    } catch (e: any) {
      message.error(e?.response?.data?.message || '调整失败')
    }
  }
  return (
    <Card title="盘点/调整库存">
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Space.Compact block>
          <Form.Item name="materialCode" label="物料编码" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="如 M001" />
          </Form.Item>
          <Form.Item name="warehouse" label="仓库" rules={[{ required: true }]} style={{ flex: 1 }}>
            <Input placeholder="如 WH1" />
          </Form.Item>
          <Form.Item name="batchNo" label="批次(可选)" style={{ flex: 1 }}>
            <Input placeholder="不填则批次为空" />
          </Form.Item>
        </Space.Compact>
        <Space.Compact block>
          <Form.Item name="targetQty" label="目标数量" rules={[{ required: true }]}>
            <InputNumber min={0} step={1} style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="reason" label="原因" style={{ flex: 1 }}>
            <Input placeholder="如 盘点调整/报损/报溢" />
          </Form.Item>
        </Space.Compact>
        <Button type="primary" htmlType="submit">提交调整</Button>
      </Form>
    </Card>
  )
}
