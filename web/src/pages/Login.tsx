import { Button, Card, Form, Input, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api/http'

export default function LoginPage() {
  const nav = useNavigate()
  const onFinish = async (v: any) => {
    try {
      const { data } = await api.post('/auth/login', v)
      localStorage.setItem('token', data.token)
  if (data.user?.username) localStorage.setItem('username', data.user.username)
  if (data.user?.role) localStorage.setItem('role', data.user.role)
      message.success('登录成功')
      nav('/')
    } catch (e: any) {
      message.error(e?.response?.data?.message || '登录失败')
    }
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Card title="登录" style={{ width: 360 }}>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>登录</Button>
        </Form>
      </Card>
    </div>
  )
}
