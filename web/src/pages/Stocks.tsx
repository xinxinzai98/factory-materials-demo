import { useEffect, useState } from 'react'
import { Button, Form, Input, Space, Table, message } from 'antd'
import { api } from '@/api/http'

type StockRow = {
  materialId: string
  materialCode: string
  warehouse: string
  location: string | null
  batchNo: string
  expDate?: string | null
  qtyOnHand: number
  qtyAllocated: number
  qtyAvailable: number
}

export default function StocksPage() {
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<StockRow[]>([])

  const fetchData = async (values?: any) => {
    setLoading(true)
    try {
      const resp = await api.get('/stocks', { params: values })
      setData(resp.data)
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || '查询失败'
      message.error(msg)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="large">
      <Form layout="inline" onFinish={fetchData}>
        <Form.Item name="materialCode"><Input placeholder="物料编码" allowClear /></Form.Item>
        <Form.Item name="warehouse"><Input placeholder="仓库编码" allowClear /></Form.Item>
        <Form.Item name="batchNo"><Input placeholder="批次" allowClear /></Form.Item>
        <Form.Item><Button htmlType="submit" type="primary">查询</Button></Form.Item>
      </Form>

  <Table rowKey={(r: StockRow)=> `${r.materialId}-${r.warehouse}-${r.batchNo}`} loading={loading} dataSource={data} pagination={false}
        columns={[
          { title: '物料', dataIndex: 'materialCode' },
          { title: '仓库', dataIndex: 'warehouse' },
          { title: '库位', dataIndex: 'location' },
          { title: '批次', dataIndex: 'batchNo' },
          { title: '到期', dataIndex: 'expDate' },
          { title: '在库', dataIndex: 'qtyOnHand' },
          { title: '占用', dataIndex: 'qtyAllocated' },
          { title: '可用', dataIndex: 'qtyAvailable' },
        ]}
      />
    </Space>
  )
}
