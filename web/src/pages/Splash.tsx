import { Button, Modal, Form, Input, message } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { api } from '@/api/http'

export default function Splash() {
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const onEnter = () => {
    const token = localStorage.getItem('token')
    if (token) return nav('/dashboard')
    setOpen(true)
  }
  const onLogin = async (v: any) => {
    setLoading(true)
    try {
      const { data } = await api.post('/auth/login', v)
      localStorage.setItem('token', data.token)
  if (data.user?.username) localStorage.setItem('username', data.user.username)
      if (data.user?.role) localStorage.setItem('role', data.user.role)
      message.success('登录成功')
      setOpen(false)
      nav('/dashboard')
    } catch (e: any) {
      message.error(e?.response?.data?.message || '登录失败')
    } finally { setLoading(false) }
  }
  return (
    <div className="hero" style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', position: 'relative', overflow: 'hidden' }}>
      <div className="blob b1" />
      <div className="blob b2" />
      <div className="blob b3" />
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 2 }}>
        <h1 className="hero-title">青绿氢能广州工厂物料管理系统</h1>
        <p className="hero-sub">更安全 · 更高效 · 更优雅</p>
        <div style={{ marginTop: 24, display: 'flex', gap: 12, justifyContent: 'center' }}>
          <Button type="primary" size="large" shape="round" onClick={onEnter}>点击进入</Button>
        </div>
      </div>
    <Modal title="登录" open={open} onCancel={()=>setOpen(false)} footer={null} destroyOnClose>
        <Form layout="vertical" onFinish={onLogin}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input autoFocus />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
      <div style={{fontSize:12, color:'#888', marginBottom:8}}>默认账号：admin / op / viewer，密码均为 123456</div>
          <Button type="primary" htmlType="submit" block loading={loading}>登录</Button>
        </Form>
      </Modal>
    </div>
  )
}
