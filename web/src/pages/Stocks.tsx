import { useEffect, useState } from 'react'
import { Button, Form, Input, Space, Table, message, Modal, Checkbox } from 'antd'
import { api } from '@/api/http'
import { exportToExcel } from '@/utils/exportExcel'

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
  const [form] = Form.useForm()
  const [excelOpen, setExcelOpen] = useState(false)
  const allFields: Array<{ key: keyof StockRow | 'qtyAvailable'; title: string }> = [
    { key: 'materialCode', title: '物料' },
    { key: 'warehouse', title: '仓库' },
    { key: 'location', title: '库位' },
    { key: 'batchNo', title: '批次' },
    { key: 'expDate', title: '到期' },
    { key: 'qtyOnHand', title: '在库' },
    { key: 'qtyAllocated', title: '占用' },
    { key: 'qtyAvailable', title: '可用' },
  ]
  const [selectedFields, setSelectedFields] = useState<string[]>(allFields.map(f=> f.key as string))

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
  <Form layout="inline" onFinish={fetchData} id="stocksFilter" form={form}>
        <Form.Item name="materialCode"><Input placeholder="物料编码" allowClear /></Form.Item>
        <Form.Item name="warehouse"><Input placeholder="仓库编码" allowClear /></Form.Item>
        <Form.Item name="batchNo"><Input placeholder="批次" allowClear /></Form.Item>
        <Form.Item><Button htmlType="submit" type="primary">查询</Button></Form.Item>
        <Form.Item>
          <Button onClick={()=>{
            const values = form.getFieldsValue()
            const params: Record<string, string> = {}
            Object.entries(values).forEach(([k, v])=> { if (v !== undefined && v !== null && String(v).length>0) params[k] = String(v) })
            const sp = new URLSearchParams(params).toString()
            window.open('/api/stocks.csv' + (sp?`?${sp}`:''), '_blank')
          }}>导出 CSV</Button>
        </Form.Item>
        <Form.Item>
          <Button type="default" onClick={()=>{ setSelectedFields(allFields.map(f=> f.key as string)); setExcelOpen(true) }}>导出 Excel</Button>
        </Form.Item>
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

      <Modal title="导出 Excel" open={excelOpen} onCancel={()=> setExcelOpen(false)} onOk={()=>{
        const cols = allFields.filter(f=> selectedFields.includes(f.key as string))
        if (!cols.length) { message.warning('请选择至少一个字段'); return }
        const rows = data.map(r=> {
          const obj: Record<string, any> = {}
          cols.forEach(c=> { obj[c.title] = (r as any)[c.key] })
          return obj
        })
        try {
          exportToExcel('库存明细.xlsx', rows)
        } catch (e) {
          message.error('导出失败')
        }
        setExcelOpen(false)
      }}>
        <div style={{ marginBottom: 8 }}>选择需要导出的字段：</div>
        <Checkbox.Group style={{ width: '100%' }} value={selectedFields} onChange={(v)=> setSelectedFields(v as string[])}>
          <Space direction="vertical">
            {allFields.map(f=> (
              <Checkbox key={String(f.key)} value={String(f.key)}>{f.title}</Checkbox>
            ))}
          </Space>
        </Checkbox.Group>
      </Modal>
    </Space>
  )
}
