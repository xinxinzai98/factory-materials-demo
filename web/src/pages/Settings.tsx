import { useEffect, useState } from 'react'
import { Button, Card, Form, Input, Space, message, InputNumber } from 'antd'
import { api, setApiBase, setApiKey } from '@/api/http'

export default function SettingsPage() {
  const [form] = Form.useForm()
  const [thForm] = Form.useForm()
  const [loading, setLoading] = useState(false)
  useEffect(() => {
    form.setFieldsValue({ apiBase: localStorage.getItem('apiBase') || 'http://localhost:8080/api', apiKey: localStorage.getItem('apiKey') || 'dev-api-key' })
    // load thresholds
    api.get('/settings/thresholds').then(({data})=>{
      thForm.setFieldsValue({ globalMinQty: data.globalMinQty ?? 0, expiryDays: data.expiryDays ?? 30, slowDays: data.slowDays ?? 60 })
    }).catch(()=>{})
  }, [])

  const save = async () => {
    const v = await form.validateFields()
    setApiBase(v.apiBase)
    setApiKey(v.apiKey)
    message.success('已保存')
  }

  const seed = async () => {
    try {
      await api.post('/seed/dev')
      message.success('已创建示例仓库/物料')
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '创建失败'
      message.error(msg)
    }
  }

  const ping = async () => {
    try {
      const base = (form.getFieldValue('apiBase') || '').replace(/\/$/, '')
      const url = base.replace(/\/api$/, '') + '/health'
      const resp = await fetch(url)
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = await resp.json()
      if (data?.status === 'ok') message.success('后端可达: ' + url)
      else message.warning('后端响应异常: ' + JSON.stringify(data))
    } catch (e: any) {
      message.error('后端不可达: ' + (e?.message || '未知错误'))
    }
  }

  return (
  <Space direction="vertical" style={{ width: 520 }} size="large">
      <Card title="接口设置">
        <Form layout="vertical" form={form}>
          <Form.Item name="apiBase" label="API Base" rules={[{ required: true }]}>
            <Input placeholder="http://localhost:8080/api" />
          </Form.Item>
          <Form.Item name="apiKey" label="X-API-Key" rules={[{ required: true }]}>
            <Input placeholder="dev-api-key" />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" onClick={save}>保存</Button>
              <Button onClick={ping}>测试连接</Button>
              <Button onClick={seed}>创建开发种子</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>

      <Card title="阈值与预警">
        <Form layout="inline" form={thForm}>
          <Form.Item name="globalMinQty" label="全局最低库存" rules={[{ required: true }]}> 
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="expiryDays" label="临期天数" rules={[{ required: true }]}> 
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="slowDays" label="滞销天数" rules={[{ required: true }]}> 
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" loading={loading} onClick={async()=>{
                try { setLoading(true); const v = await thForm.validateFields(); await api.put('/settings/thresholds', v); message.success('阈值已保存') } 
                catch(e:any){ message.error(e?.response?.data?.message || e?.message || '保存失败') } 
                finally { setLoading(false) }
              }}>保存</Button>
              <Button onClick={async()=>{
                try { await api.post('/alerts/recalc'); message.success('已触发重算') } catch(e:any){ message.error(e?.response?.data?.message || e?.message || '失败') }
              }}>重算预警</Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </Space>
  )
}
